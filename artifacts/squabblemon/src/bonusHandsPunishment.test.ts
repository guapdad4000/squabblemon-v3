import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bonusHandsRemovedBetween, createAbilityUpgradeSnapshot, createCardInstance, createMatch,
  getLegalCardCost, nextRound, playCard, playTurnCard, removableBonusHands, trimBonusHandsUnshielded,
  trimEnemyBonusHands, type CardInstance, type Lane, type Match, type Owner,
} from './gameEngine';

const blank = (): Match => ({ ...createMatch('block', 'block'), round: 3,
  boards: [[], [], []], playerHand: [], cpuHand: [], playerMotion: 9, cpuMotion: 9 });
const unit = (id: string, owner: Owner, lane: Lane, index = 0): CardInstance =>
  ({ ...createCardInstance(id, owner, 'bonus-fixture', index), lane, playedRound: 3 });
const find = (m: Match, c: CardInstance) => m.boards.flat().find(x => x.instanceId === c.instanceId)!;
const json = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function cast(m: Match, id: string, owner: Owner, lane: Lane = 0, patch: Partial<CardInstance> = {}) {
  const source = { ...createCardInstance(id, owner, 'bonus-cast', m.nextEventSequence), ...patch };
  return { source, after: playTurnCard({ ...m, phase: owner === 'player' ? 'player' : 'cpu-reveal',
    [owner === 'player' ? 'playerHand' : 'cpuHand']: [source], playerMotion: 9, cpuMotion: 9 }, owner, source.instanceId, lane) };
}
function cover(m: Match, c: CardInstance): void {
  c.statuses.protected = true;
  m.timedEffects.push({ id: `bonus-cover:${c.instanceId}`, kind: 'church-protection',
    sourceInstanceId: c.instanceId, targetInstanceId: c.instanceId, owner: c.owner,
    lane: c.lane!, startsAtRound: m.round, expiresAtRound: 7, expiration: 'match-complete' });
}

test('removable bonus accounting excludes copied base Hands, auras, damage and Freeze', () => {
  const copied = { ...unit('scammer', 'cpu', 0), basePower: 7, powerModifier: 4, continuousPower: 9 };
  assert.equal(removableBonusHands(copied), 4);
  copied.statuses.frozen = true;
  assert.equal(removableBonusHands(copied), 4);
  const m = blank(); m.boards[0] = [copied];
  const result = trimBonusHandsUnshielded(m, copied, 8, 'Confiscation');
  assert.equal(result.removed, 4);
  assert.equal(find(result.match, copied).basePower, 7);
  assert.equal(find(result.match, copied).powerModifier, 0);
  assert.equal(find(result.match, copied).statuses.frozen, true);
  assert.equal(result.match.laneDamage?.length, 0);
  assert.equal(find(result.match, copied).recoverableDamage ?? 0, 0);
  assert.equal(removableBonusHands({ powerModifier: -3 }), 0);
});

for (const owner of ['player', 'cpu'] as const) {
  const enemy: Owner = owner === 'player' ? 'cpu' : 'player';

  test(`${owner}: Feds confiscate eight genuine bonus Hands and Lock without damage reactions`, () => {
    const target = { ...unit('hooper', enemy, 0), powerModifier: 12 }, bonnet = unit('bonnetgirl', enemy, 0);
    const m = blank(); m.boards[0] = [target, bonnet];
    const after = cast(m, 'thefeds', owner).after;
    assert.equal(find(after, target).powerModifier, 4);
    assert.equal(find(after, target).statuses.locked, true);
    assert.equal(find(after, target).statuses.weakened, false);
    assert.equal(find(after, target).recoverableDamage ?? 0, 0);
    assert.equal(find(after, bonnet).powerModifier, 0);
    assert.equal(after.laneDamage?.length, 0);
  });

  test(`${owner}: Feds never confuse copied printed Hands with buffs; fallback Locks and Weakens`, () => {
    const copied = { ...unit('scammer', enemy, 0), basePower: 7, powerModifier: 0 };
    const m = blank(); m.boards[0] = [copied];
    const after = cast(m, 'thefeds', owner).after;
    assert.equal(find(after, copied).basePower, 7);
    assert.equal(find(after, copied).powerModifier, 0);
    assert.equal(find(after, copied).statuses.locked, true);
    assert.equal(find(after, copied).statuses.weakened, true);
  });

  test(`${owner}: protected and Hands-loss-immune targets cannot mint confiscated Hands`, () => {
    for (const id of ['hooper', 'blueside1', 'triple-og-blue']) {
      const source = unit('uncle-sam', owner, 0), target = { ...unit(id, enemy, 0), powerModifier: 8 };
      const m = blank(); m.boards[0] = [source, target];
      if (id === 'hooper') cover(m, target);
      const result = trimEnemyBonusHands(m, source, target, 6);
      assert.equal(result.removed, 0, id);
      assert.equal(find(result.match, target).powerModifier, 8, id);
      assert.equal(result.match.laneDamage?.length, 0, id);
    }
  });

  test(`${owner}: confiscation follows the actual Fanboy interceptor and pays only committed bonus loss`, () => {
    const source = unit('uncle-sam', owner, 0), idol = { ...unit('hooper', enemy, 0), powerModifier: 10 };
    const fan = { ...unit('grownfanboy', enemy, 1), powerModifier: 3, idolId: idol.instanceId };
    const m = blank(); m.boards = [[source, idol], [fan], []];
    const result = trimEnemyBonusHands(m, source, idol, 6);
    assert.equal(result.recipientId, fan.instanceId);
    assert.equal(result.removed, 3);
    assert.equal(find(result.match, idol).powerModifier, 10);
    assert.equal(find(result.match, fan).powerModifier, 0);
    assert.equal(find(result.match, fan).recoverableDamage ?? 0, 0);
    assert.equal(result.match.laneDamage?.length, 0);
    const castSam = cast({ ...m, boards: [[idol], [fan], []] }, 'uncle-sam', owner);
    assert.equal(find(castSam.after, castSam.source).powerModifier, 3);
    assert.equal(find(castSam.after, idol).powerModifier, 10);
  });

  test(`${owner}: Janitor rollback cancels theft and training instead of paying provisional loss`, () => {
    const victim = { ...unit('hooper', enemy, 0), powerModifier: 9 }, janitor = unit('janitor', enemy, 0);
    const m = blank(); m.boards[0] = [victim, janitor];
    m.abilityUpgradeSnapshot = createAbilityUpgradeSnapshot(owner === 'player' ? ['uncle-sam'] : [], owner === 'cpu' ? ['uncle-sam'] : [],
      { [owner]: { 'uncle-sam': { level: 8, xp: 2800, moveTier: 3 } } });
    const result = cast(m, 'uncle-sam', owner);
    assert.equal(find(result.after, victim).powerModifier, 11);
    assert.equal(find(result.after, result.source).powerModifier, 0);
    assert.equal(find(result.after, result.source).waveTrainingUsed, undefined);
    assert.equal(bonusHandsRemovedBetween(m, result.after, victim.instanceId), 0);
    assert.equal(result.after.laneDamage?.length, 0);
  });

  test(`${owner}: confiscation does not spend emergency damage kits or heal removed buffs`, () => {
    const target = { ...unit('homelesslegend', enemy, 0), powerModifier: 8 }, source = unit('uncle-sam', owner, 0);
    const m = blank(); m.boards[0] = [target, source];
    m.creativeMarks = [{ id: 'bonus-emergency-kit', kind: 'kit', owner: enemy,
      source: unit('firstaid', enemy, 0), lane: 0, targets: [target.instanceId], expires: 99 }];
    const result = trimEnemyBonusHands(m, source, target, 6);
    assert.equal(result.removed, 6);
    assert.equal(find(result.match, target).powerModifier, 2);
    assert(result.match.creativeMarks?.some(x => x.id === 'bonus-emergency-kit'));
    assert.equal(find(result.match, target).recoverableDamage ?? 0, 0);
    assert.equal(result.match.laneDamage?.length, 0);
  });

  test(`${owner}: genuine Squabble and ability-training Hands remain removable bonuses`, () => {
    const target = createCardInstance('youngbull', enemy, 'trained-squabble');
    const m: Match = { ...blank(), phase: enemy === 'player' ? 'player' : 'cpu-reveal',
      squabbleByOwner: { player: false, cpu: false },
      [enemy === 'player' ? 'playerHand' : 'cpuHand']: [target],
      abilityUpgradeSnapshot: createAbilityUpgradeSnapshot(enemy === 'player' ? ['youngbull'] : [], enemy === 'cpu' ? ['youngbull'] : [],
        { [enemy]: { youngbull: { level: 8, xp: 2800, moveTier: 3 } } }),
    };
    const played = playTurnCard(m, enemy, target.instanceId, 0, true);
    const grown = find(played, target);
    assert.equal(grown.powerModifier, target.basePower + 4, 'Squabble, reveal and three trained gains are all modifiers');
    const source = unit('uncle-sam', owner, 0), staged = { ...played,
      boards: played.boards.map((cs, lane) => lane === 0 ? [...cs, source] : cs) as Match['boards'] };
    const stripped = trimEnemyBonusHands(staged, source, grown, 99);
    assert.equal(stripped.removed, grown.powerModifier);
    assert.equal(find(stripped.match, target).basePower, target.basePower);
    assert.equal(find(stripped.match, target).powerModifier, 0);
    assert.equal(find(stripped.match, target).recoverableDamage ?? 0, 0);
  });

  test(`${owner}: Sam takes six actual bonuses; his fallback Audit taxes exactly one character by two`, () => {
    const target = { ...unit('hooper', enemy, 0), powerModifier: 9 }, m = blank(); m.boards[0] = [target];
    const result = cast(m, 'uncle-sam', owner);
    assert.equal(find(result.after, target).powerModifier, 3);
    assert.equal(find(result.after, result.source).powerModifier, 6);
    const audit = cast(blank(), 'uncle-sam', owner).after;
    const guest = createCardInstance('hooper', enemy);
    assert.equal(getLegalCardCost(audit, enemy, guest, 0), guest.cost + 2);
    const paid = cast(audit, 'hooper', enemy).after;
    assert.equal(getLegalCardCost(paid, enemy, guest, 0), guest.cost);
  });

  test(`${owner}: Inside Man combines bonus confiscation and real damage in one package`, () => {
    const spy = unit('undercova', owner, 0), m = blank(); m.boards[0] = [spy];
    const result = cast(m, 'roommate', enemy, 0, { powerModifier: 3 });
    assert.equal(find(result.after, result.source).powerModifier, -1);
    assert.equal(find(result.after, result.source).recoverableDamage, 2, 'confiscated bonuses are not damage');
    assert.equal(result.after.laneDamage?.reduce((n, hit) => n + hit.amount, 0), 2);
    assert.equal(find(result.after, spy).powerModifier, 4);
    assert.notEqual(find(result.after, spy).lane, 0);
    assert.deepEqual(result.after.undercovaPayouts?.[owner], { round: 3, count: 1 });
    const replay = result.after.effectLog.findLast(e => e.cardInstanceId === spy.instanceId)!;
    assert.deepEqual(replay.replay.after.undercovaPayouts?.[owner], { round: 3, count: 1 });
  });

  test(`${owner}: Inside Man spends no successful payout and never escapes after a blocked attempt`, () => {
    const spy = unit('undercova', owner, 0), m = blank(); m.boards[0] = [spy];
    const blocked = cast(m, 'lion', enemy);
    assert.equal(find(blocked.after, spy).powerModifier, 0);
    assert.equal(find(blocked.after, spy).lane, 0);
    assert.equal(blocked.after.undercovaPayouts?.[owner], undefined);
    const success = cast(blocked.after, 'roommate', enemy, 0, { powerModifier: 3 });
    assert.deepEqual(success.after.undercovaPayouts?.[owner], { round: 3, count: 1 });
  });

  test(`${owner}: Block Spin repeats only Inside Man's two real damage, never its bonus confiscation`, () => {
    const spy = unit('undercova', owner, 0), m = blank(); m.boards[0] = [spy];
    const first = cast(m, 'roommate', enemy, 0, { basePower: 10, powerModifier: 3 });
    assert.equal(find(first.after, first.source).powerModifier, -1);
    const spin = cast(first.after, 'the-block-spin', owner).after;
    assert.equal(find(spin, first.source).powerModifier, -7);
    assert.equal(find(spin, first.source).basePower, 10);
    assert.equal(spin.laneDamage?.reduce((n, hit) => n + hit.amount, 0), 2);
  });

  test(`${owner}: Inside Man shares one successful payout per round and two per match across copies and JSON reload`, () => {
    const spy = unit('undercova', owner, 0), clone = unit('undercova', owner, 1, 1), m = blank();
    m.boards = [[spy], [clone], []];
    const first = cast(m, 'roommate', enemy, 0, { powerModifier: 3 }).after;
    const sameRound = cast(json(first), 'roommate', enemy, 1, { powerModifier: 3 });
    assert.equal(find(sameRound.after, sameRound.source).powerModifier, 3);
    const second = cast({ ...json(sameRound.after), round: 4 }, 'roommate', enemy, 1, { powerModifier: 3 }).after;
    assert.deepEqual(second.undercovaPayouts?.[owner], { round: 4, count: 2 });
    const liveSpy = find(second, spy);
    const final = cast({ ...json(second), round: 5 }, 'roommate', enemy, liveSpy.lane!, { powerModifier: 3 }).after;
    assert.deepEqual(final.undercovaPayouts?.[owner], { round: 4, count: 2 });
    assert.deepEqual(json(final), json(cast({ ...json(second), round: 5 }, 'roommate', enemy, liveSpy.lane!, { powerModifier: 3 }).after));
  });
}

for (const owner of ['player', 'cpu'] as const) {
  const enemy: Owner = owner === 'player' ? 'cpu' : 'player';

  for (const command of [playCard, playTurnCard]) test(`${owner}: ${command.name} preserves exact recovery after two sequential confiscations`, () => {
    const target = { ...unit('hooper', enemy, 0), powerModifier: 20 };
    const m = blank(); m.boards[0] = [target];
    const before = structuredClone(m);
    const confiscate = (state: Match, index: number) => {
      const source = createCardInstance('bushedo-brown', owner, 'confiscation-recovery', index);
      return command({ ...state, phase: owner === 'player' ? 'player' : 'cpu-reveal',
        [owner === 'player' ? 'playerHand' : 'cpuHand']: [source], playerMotion: 9, cpuMotion: 9,
      }, owner, source.instanceId, 0);
    };
    const first = confiscate(m, 1);
    assert.deepEqual(m, before, 'the command cannot mutate its input');
    assert.equal(find(first, target).powerModifier, 16);
    const second = confiscate(first, 2), recovered = confiscate(json(first), 2);
    assert.equal(find(second, target).powerModifier, 12);
    assert.deepEqual(second, recovered, 'JSON recovery preserves the exact next authoritative state');
    assert.equal(find(second, target).recoverableDamage ?? 0, 0);
    assert.equal(second.laneDamage?.length, 0);
  });

  test(`${owner}: round advance and final scoring discard completed confiscation accounting`, () => {
    for (const round of [3, 6]) {
      const target = { ...unit('hooper', enemy, 0), powerModifier: 20 };
      const m: Match = { ...blank(), round, phase: 'resolved' }; m.boards[0] = [target];
      // A low-level defended resolution deliberately retains its delta until its public boundary settles.
      const source = unit('bushedo-brown', owner, 0, 10);
      const confiscated = trimEnemyBonusHands(m, source, target, 4).match;
      const before = { ...confiscated }; // Preserve symbol keys when checking boundary cleanup immutability.
      const direct = nextRound(confiscated), recovered = nextRound(json(confiscated));
      assert.deepEqual(confiscated, before, 'round resolution cannot mutate the confiscated snapshot');
      assert.deepEqual(direct, recovered, 'round boundaries cannot retain non-serialized accounting');
      assert.equal(direct.phase, round === 6 ? 'complete' : 'player');
      assert.equal(direct.round, round === 6 ? 6 : 4);
    }
  });
}
