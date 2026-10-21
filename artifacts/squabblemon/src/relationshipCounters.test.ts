import assert from 'node:assert/strict';
import test from 'node:test';
import { cards } from './data';
import {
  createAbilityUpgradeSnapshot, createCardInstance, createMatch, playTurnCard,
  type CardInstance, type Lane, type Match, type Owner,
} from './gameEngine';

const other = (owner: Owner): Owner => owner === 'player' ? 'cpu' : 'player';
const blank = (): Match => ({ ...createMatch('block', 'block'), round: 3,
  boards: [[], [], []], playerHand: [], cpuHand: [], playerMotion: 9, cpuMotion: 9 });
const unit = (id: string, owner: Owner, lane: Lane, index = 0): CardInstance =>
  ({ ...createCardInstance(id, owner, 'relationship-unit', index), lane, playedRound: 2 });
const find = (m: Match, c: CardInstance) => m.boards.flat().find(x => x.instanceId === c.instanceId)!;
const json = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function cast(m: Match, id: string, owner: Owner, lane: Lane = 0, patch: Partial<CardInstance> = {}) {
  const source = { ...createCardInstance(id, owner, 'relationship-cast', m.nextEventSequence), ...patch };
  const input: Match = { ...m, phase: owner === 'player' ? 'player' : 'cpu-reveal',
    [owner === 'player' ? 'playerHand' : 'cpuHand']: [source], playerMotion: 9, cpuMotion: 9 };
  const before = json(input);
  const after = playTurnCard(input, owner, source.instanceId, lane);
  assert.deepEqual(json(input), before, 'the submitted match remains immutable');
  assert.deepEqual(json(after), json(playTurnCard(json(input), owner, source.instanceId, lane)),
    'JSON reload produces the identical authoritative result');
  return { source, after };
}
function cover(m: Match, c: CardInstance): void {
  c.statuses.protected = true;
  m.timedEffects.push({ id: `relationship-cover:${c.instanceId}`, kind: 'church-protection',
    sourceInstanceId: c.instanceId, targetInstanceId: c.instanceId, owner: c.owner,
    lane: c.lane!, startsAtRound: m.round, expiresAtRound: 7, expiration: 'match-complete' });
}
function train(m: Match, id: string, owner: Owner): Match {
  return { ...m, abilityUpgradeSnapshot: createAbilityUpgradeSnapshot(
    owner === 'player' ? [id] : [], owner === 'cpu' ? [id] : [],
    { [owner]: { [id]: { xp: 2800, level: 8, moveTier: 3 } } },
  ) };
}

test('relationship counters retain their canonical identities and print their actual targets', () => {
  assert.match(cards['side-chick'].effect, /Snow Bunny, Wifey, Baby Momma or Suga Mama/);
  assert.match(cards['pimp-swookie'].effect, /^Ongoing:/);
  assert.match(cards['pimp-swookie'].effect, /Maximum two successful recruitments per side per match/);
  assert(!cards['pimp-swookie'].effect.includes('Name Check'));
});

for (const owner of ['player', 'cpu'] as const) {
  const enemy = other(owner);

  for (const targetId of ['snow', 'wifey', 'baby', 'suga-mama']) {
    test(`${owner}: Side Chick counters enemy ${targetId} across districts and leaves her friendly counterpart alone`, () => {
      const friend = { ...unit(targetId, owner, 1), basePower: 20 };
      const target = { ...unit(targetId, enemy, 2), basePower: 12 };
      const local = { ...unit('hooper', enemy, 0), basePower: 30 };
      const m = blank(); m.boards = [[local], [friend], [target]];
      const result = cast(m, 'side-chick', owner);
      assert.equal(find(result.after, friend).powerModifier, 0);
      assert.equal(find(result.after, local).powerModifier, 0);
      assert.equal(find(result.after, target).powerModifier, -3);
      assert.equal(find(result.after, target).statuses.weakened, true);
    });
  }

  test(`${owner}: Side Chick chooses the strongest relationship target and keeps her local fallback`, () => {
    const snow = { ...unit('snow', enemy, 1), basePower: 12 };
    const baby = { ...unit('baby', enemy, 2), basePower: 8 };
    const m = blank(); m.boards = [[], [snow], [baby]];
    const after = cast(m, 'side-chick', owner).after;
    assert.equal(find(after, snow).powerModifier, -3);
    assert.equal(find(after, baby).powerModifier, 0);
    const ordinary = { ...unit('hooper', enemy, 0), basePower: 12 }, fallback = blank(); fallback.boards[0] = [ordinary];
    const hit = cast(fallback, 'side-chick', owner).after;
    assert.equal(find(hit, ordinary).powerModifier, -1);
    assert.equal(find(hit, ordinary).statuses.weakened, false);
  });

  test(`${owner}: one ward or Janitor reversal stops Side Chick's complete relationship package and training`, () => {
    for (const defense of ['ward', 'janitor']) {
      const target = { ...unit('suga-mama', enemy, 2), basePower: 12 }, m = blank(); m.boards[2] = [target];
      if (defense === 'ward') cover(m, target);
      else m.boards[2].push(unit('janitor', enemy, 2, 1));
      const result = cast(train(m, 'side-chick', owner), 'side-chick', owner);
      assert.equal(find(result.after, target).powerModifier, defense === 'janitor' ? 2 : 0);
      assert.equal(find(result.after, target).statuses.weakened, false);
      assert.equal(find(result.after, result.source).powerModifier, 0);
      assert.equal(find(result.after, result.source).waveTrainingUsed, undefined);
    }
  });

  test(`${owner}: Side Chick's complete relationship hit follows the actual remote interceptor`, () => {
    const snow = { ...unit('snow', enemy, 2), basePower: 12 };
    const fan = { ...unit('grownfanboy', enemy, 1), basePower: 10, idolId: snow.instanceId };
    const m = blank(); m.boards = [[], [fan], [snow]];
    const result = cast(train(m, 'side-chick', owner), 'side-chick', owner);
    assert.equal(find(result.after, snow).powerModifier, 0);
    assert.equal(find(result.after, snow).statuses.weakened, false);
    assert.equal(find(result.after, fan).powerModifier, -3);
    assert.equal(find(result.after, fan).statuses.weakened, true);
    assert.equal(find(result.after, result.source).powerModifier, 3);
  });

  test(`${owner}: Swookie recruits an existing Snow Bunny without changing deck membership or her invested state`, () => {
    const snow = { ...unit('snow', enemy, 2), powerModifier: 5, waveTrainingUsed: true };
    snow.statuses.locked = true;
    const rival = { ...unit('hooper', enemy, 2), basePower: 12 }, m = blank(); m.boards[2] = [snow, rival];
    const deckIds = [m.playerCardIds, m.cpuCardIds];
    const result = cast(train(m, 'pimp-swookie', owner), 'pimp-swookie', owner);
    const stolen = find(result.after, snow);
    assert.equal(stolen.owner, owner);
    assert.equal(stolen.lane, 2);
    assert.equal(stolen.instanceId, snow.instanceId);
    assert.equal(stolen.powerModifier, 5);
    assert.equal(stolen.statuses.locked, true);
    assert.equal(stolen.waveTrainingUsed, true);
    assert.equal(stolen.swookieRecruited, true);
    assert.equal(find(result.after, rival).statuses.frozen, true);
    assert.equal(find(result.after, result.source).powerModifier, 3);
    assert.deepEqual([result.after.playerCardIds, result.after.cpuCardIds], deckIds);
    assert.equal(result.after.swookieRecruitment?.[owner]?.count, 1);
  });

  test(`${owner}: future Snow Bunny changes side before her original entrance can Freeze Swookie's ally`, () => {
    const swookie = unit('pimp-swookie', owner, 0), ally = { ...unit('hooper', owner, 1), basePower: 12 };
    const rival = { ...unit('og', enemy, 1), basePower: 10 }, m = blank(); m.boards = [[swookie], [ally, rival], []];
    const result = cast(m, 'snow', enemy, 1);
    assert.equal(find(result.after, result.source).owner, owner);
    assert.equal(find(result.after, ally).statuses.frozen, false);
    assert.equal(find(result.after, rival).statuses.frozen, true);
    assert.equal(result.after.effectLog.filter(e => e.cardInstanceId === result.source.instanceId && /Cold Shoulder/.test(e.note)).length <= 1, true);
  });

  test(`${owner}: blocked fresh recruitment leaves Snow Bunny's original Freeze intact`, () => {
    const swookie = unit('pimp-swookie', owner, 0), guard = unit('wifey', enemy, 1);
    guard.statuses.protected = true;
    const ally = { ...unit('hooper', owner, 1), basePower: 12 }, m = blank(); m.boards = [[swookie], [guard, ally], []];
    const result = cast(m, 'snow', enemy, 1);
    assert.equal(find(result.after, result.source).owner, enemy);
    assert.equal(find(result.after, ally).statuses.frozen, true);
    assert.equal(result.after.swookieRecruitment?.[owner]?.count ?? 0, 0);
  });

  test(`${owner}: a ward consumes the shared round attempt; a later round can recruit without removing an earlier Freeze`, () => {
    const snow = unit('snow', enemy, 2), victim = unit('hooper', owner, 1), rival = unit('og', enemy, 2);
    victim.statuses.frozen = true;
    const m = blank(); m.boards = [[], [victim], [snow, rival]]; cover(m, snow);
    const first = cast(train(m, 'pimp-swookie', owner), 'pimp-swookie', owner);
    assert.equal(find(first.after, snow).owner, enemy);
    assert.equal(find(first.after, first.source).waveTrainingUsed, undefined);
    const sameRound = cast(json(first.after), 'buspass', owner).after;
    assert.equal(find(sameRound, snow).owner, enemy);
    const next = cast({ ...json(sameRound), round: 4 }, 'buspass', owner).after;
    assert.equal(find(next, snow).owner, owner);
    assert.equal(find(next, victim).statuses.frozen, true);
    assert.equal(find(next, rival).statuses.frozen, true);
  });

  test(`${owner}: Fanboy interception or Janitor prevents ownership theft rather than stealing the defender`, () => {
    for (const defense of ['fanboy', 'janitor']) {
      const snow = unit('snow', enemy, 2), guard = unit(defense === 'fanboy' ? 'grownfanboy' : 'janitor', enemy, 2, 1);
      if (defense === 'fanboy') guard.idolId = snow.instanceId;
      const m = blank(); m.boards[2] = [snow, guard];
      const result = cast(train(m, 'pimp-swookie', owner), 'pimp-swookie', owner);
      assert.equal(find(result.after, snow).owner, enemy);
      assert.equal(find(result.after, guard).owner, enemy);
      assert.equal(find(result.after, snow).swookieRecruited, undefined);
      assert.equal(result.after.swookieRecruitment?.[owner]?.count ?? 0, 0);
      assert.equal(find(result.after, result.source).waveTrainingUsed, undefined);
    }
  });

  test(`${owner}: a separate Freeze ward can stop the follow-up without undoing successful recruitment`, () => {
    const snow = unit('snow', enemy, 2), rival = { ...unit('hooper', enemy, 2), basePower: 12 };
    const m = blank(); m.boards[2] = [snow, rival]; cover(m, rival);
    const after = cast(m, 'pimp-swookie', owner).after;
    assert.equal(find(after, snow).owner, owner);
    assert.equal(find(after, rival).statuses.frozen, false);
    assert.equal(find(after, rival).statuses.protected, false);
    assert.equal(after.swookieRecruitment?.[owner]?.count, 1);
  });

  test(`${owner}: Snow Bunny's immunity blocks recruitment and does not award a successful capture`, () => {
    const snow = unit('snow', enemy, 2); snow.statuses.uncounterable = true;
    const rival = unit('hooper', enemy, 2), m = blank(); m.boards[2] = [snow, rival];
    const result = cast(train(m, 'pimp-swookie', owner), 'pimp-swookie', owner);
    assert.equal(find(result.after, snow).owner, enemy);
    assert.equal(find(result.after, snow).swookieRecruited, undefined);
    assert.equal(find(result.after, rival).statuses.frozen, false);
    assert.equal(result.after.swookieRecruitment?.[owner]?.count ?? 0, 0);
    assert.equal(find(result.after, result.source).waveTrainingUsed, undefined);
  });

  test(`${owner}: Scammer's copied ongoing Swookie ability recruits without changing either identity`, () => {
    const swookie = unit('pimp-swookie', enemy, 0), m = blank(); m.boards[0] = [swookie];
    const copied = cast(m, 'scammer', owner);
    assert.equal(find(copied.after, copied.source).cardId, 'scammer');
    assert.equal(find(copied.after, copied.source).copiedAbilityCardId, 'pimp-swookie');
    const snow = cast(copied.after, 'snow', enemy, 1);
    assert.equal(find(snow.after, snow.source).owner, owner);
    assert.equal(find(snow.after, snow.source).cardId, 'snow');
    assert.equal(find(snow.after, copied.source).cardId, 'scammer');
    assert.equal(snow.after.swookieRecruitment?.[owner]?.count, 1);
    assert.equal(snow.after.swookieRecruitment?.[enemy]?.count ?? 0, 0);
  });

  test(`${owner}: a disabled Swookie cannot recruit and a disabled stolen Snow does not Freeze`, () => {
    const snow = unit('snow', enemy, 2), rival = unit('og', enemy, 2), m = blank(); m.boards[2] = [snow, rival];
    const statuses = { ...createCardInstance('pimp-swookie', owner).statuses, silenced: true };
    const disabled = cast(m, 'pimp-swookie', owner, 0, { statuses }).after;
    assert.equal(find(disabled, snow).owner, enemy);
    const frozenSnow = { ...snow, statuses: { ...snow.statuses, frozen: true } };
    const frozen = blank(); frozen.boards[2] = [frozenSnow, rival];
    const after = cast(frozen, 'pimp-swookie', owner).after;
    assert.equal(find(after, frozenSnow).owner, owner);
    assert.equal(find(after, frozenSnow).statuses.frozen, true);
    assert.equal(find(after, rival).statuses.frozen, false);
  });

  test(`${owner}: no room does not consume an attempt; recruitment keeps normal district capacity`, () => {
    const snow = unit('snow', enemy, 2), guests = [0, 1, 2, 3].map(i => unit('cornball', owner, 2, i + 1));
    const m = blank(); m.boards[2] = [snow, ...guests];
    const first = cast(m, 'pimp-swookie', owner).after;
    assert.equal(find(first, snow).owner, enemy);
    assert.equal(first.swookieRecruitment?.[owner]?.attemptRound, undefined);
    const space = { ...first, boards: first.boards.map(cs => cs.filter(c => c.instanceId !== guests[0].instanceId)) as Match['boards'] };
    const after = cast(space, 'buspass', owner).after;
    assert.equal(find(after, snow).owner, owner);
    assert.equal(after.boards[2].filter(c => !c.hazard && c.owner === owner).length, 4);
  });

  test(`${owner}: recruitment caps survive copies and JSON reload and stolen Snow cannot be stolen back`, () => {
    const snow = unit('snow', enemy, 1), m = blank(); m.boards[1] = [snow];
    const first = cast(m, 'pimp-swookie', owner);
    const second = unit('snow', enemy, 2, 1), same = json(first.after); same.boards[2].push(second);
    const sameRound = cast(same, 'pimp-swookie', owner, 0).after;
    assert.equal(find(sameRound, second).owner, enemy);
    const next = cast({ ...json(sameRound), round: 4 }, 'buspass', owner).after;
    assert.equal(find(next, second).owner, owner);
    const third = unit('snow', enemy, 2, 2), later = { ...json(next), round: 5 }; later.boards[2].push(third);
    const capped = cast(later, 'buspass', owner).after;
    assert.equal(find(capped, third).owner, enemy);
    assert.equal(capped.swookieRecruitment?.[owner]?.count, 2);
    const opponent = cast(capped, 'pimp-swookie', enemy, 0).after;
    assert.equal(find(opponent, snow).owner, owner);
    assert.equal(find(opponent, second).owner, owner);
    assert.equal(opponent.swookieRecruitment?.[enemy]?.count ?? 0, 0);
  });

  test(`${owner}: genuine return and redeployment keep the battle controller and once-recruited marker`, () => {
    const snow = unit('snow', enemy, 2), m = blank(); m.boards[2] = [snow];
    const stolen = cast(m, 'pimp-swookie', owner).after;
    const returned = cast(stolen, 'madhatter', owner, 2).after;
    const hand = returned[owner === 'player' ? 'playerHand' : 'cpuHand'];
    const traveler = hand.find(c => c.instanceId === snow.instanceId)!;
    assert(traveler);
    assert.equal(traveler.owner, owner);
    assert.equal(traveler.swookieRecruited, true);
    const key = owner === 'player' ? 'playerHand' : 'cpuHand';
    const replayed = playTurnCard({ ...returned, phase: owner === 'player' ? 'player' : 'cpu-reveal', [key]: [traveler],
      playerMotion: 9, cpuMotion: 9 }, owner, traveler.instanceId, 2);
    assert.equal(find(replayed, snow).owner, owner);
    assert.equal(find(replayed, snow).swookieRecruited, true);
    assert.equal(replayed.swookieRecruitment?.[owner]?.count, 1);
  });

  test(`${owner}: Snow Bunny's former Work Hubby cannot collect on growth after her allegiance changes`, () => {
    const snow = unit('snow', enemy, 2), hubby = unit('work-hubby', enemy, 2, 1);
    const m = blank(); m.boards[2] = [snow, hubby];
    // The lunch shield was already spent, leaving the unspent friendly gain contract.
    m.creativeMarks = [{ id: 'former-lunch-bond', kind: 'sl-lunch', owner: enemy,
      source: hubby, lane: 2, targets: [snow.instanceId], expires: 4 }];
    const stolen = cast(m, 'pimp-swookie', owner).after;
    assert.equal(find(stolen, snow).owner, owner);
    const grown = cast(stolen, 'nail', owner, 2).after;
    assert.equal(find(grown, snow).powerModifier, 2);
    assert.equal(find(grown, hubby).powerModifier, 0,
      'a friendly contract cannot pay the former side after recruitment');
  });

  test(`${owner}: recruitment invalidates old company, promise and movement contracts while preserving hostile marks and usage ledgers`, () => {
    const snow = unit('snow', enemy, 2), partner = unit('hooper', enemy, 1);
    const company = { ...unit('bblnice', enemy, 1), basePower: 20 };
    const promise = { ...unit('canopykeeper', enemy, 1), basePower: 20 };
    snow.statuses.burnStacks = 2;
    const m = blank(); m.boards = [[], [partner, company, promise], [snow]];
    const hostile = { id: 'existing-hostile-primer', kind: 'primer', owner,
      source: unit('redneck-evil', owner, 0), lane: 2 as Lane, targets: [snow.instanceId], expires: 4 };
    const ledger = { id: 'sl-ledger:old-usage', kind: 'sl-ledger-old-usage', owner: enemy,
      source: company, lane: 2 as Lane, targets: [snow.instanceId], expires: 99, amount: 1 };
    m.creativeMarks = [
      { id: 'old-company', kind: 'company', owner: enemy, source: company,
        lane: 1, targets: [snow.instanceId, partner.instanceId], expires: 5 },
      { id: 'old-promise', kind: 'promise', owner: enemy, source: promise,
        lane: 2, targets: [snow.instanceId], expires: 5 },
      { id: 'old-selected-ward', kind: 'sw-ward', owner: enemy, source: company,
        lane: 2, targets: [snow.instanceId], expires: 5 },
      hostile, ledger,
    ];
    const stolen = cast(m, 'pimp-swookie', owner).after;
    assert.equal(find(stolen, snow).owner, owner);
    assert(!stolen.creativeMarks?.some(mark => ['old-company', 'old-promise', 'old-selected-ward'].includes(mark.id)),
      'a two-card company cannot survive with only its old partner');
    assert.deepEqual(stolen.creativeMarks?.find(mark => mark.id === hostile.id), hostile);
    assert.deepEqual(stolen.creativeMarks?.find(mark => mark.id === ledger.id), ledger);
    assert.equal(find(stolen, snow).statuses.burnStacks, 2);
    const moved = cast(stolen, 'subwaymap', owner, 2).after;
    assert.notEqual(find(moved, snow).lane, 2);
    assert.equal(find(moved, snow).powerModifier, 1, 'only Subway Map pays; the former selected ward pays nothing');
    const oldSideGrew = cast(moved, 'nail', enemy, 1).after;
    assert.equal(find(oldSideGrew, partner).powerModifier, 2);
    assert.equal(find(oldSideGrew, snow).powerModifier, 1, 'the former company cannot share enemy growth');
    const newSideGrew = cast(oldSideGrew, 'nail', owner, find(oldSideGrew, snow).lane!).after;
    assert.equal(find(newSideGrew, snow).powerModifier, 3, 'the former promise adds no extra Hands');
    assert.equal(find(newSideGrew, promise).powerModifier, 0, 'the old provider cannot earn a promise payout');
  });
}
