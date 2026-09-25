import assert from 'node:assert/strict';
import test from 'node:test';
import { cards, catalogCardById, ROOKIE_FOUNDATION_IDS, validateCardAbilityUpgrades } from './data';
import { createCardInstance, createMatch, createAbilityUpgradeSnapshot, playCard, nextRound,
  suppressMatchPresentationEvents, type CardInstance, type Match, type Owner, type Lane } from './gameEngine';

const unit = (id: string, owner: Owner, lane: Lane, index: number, power = 10): CardInstance =>
  ({ ...createCardInstance(id, owner, 'light-leaders', index), lane, basePower: power, power });
const find = (m: Match, c: CardInstance) => m.boards.flat().find(x => x.instanceId === c.instanceId)!;
const blank = (): Match => ({ ...createMatch('block', 'combo'), round: 4,
  playerMotion: 9, cpuMotion: 9, playerHand: [], cpuHand: [], boards: [[], [], []] });
function cast(m: Match, id: string, owner: Owner, lane: Lane = 0, index = 0) {
  const source = createCardInstance(id, owner, 'cast', index);
  const after = playCard({ ...m, phase: owner === 'player' ? 'player' : 'cpu-reveal',
    playerMotion: 9, cpuMotion: 9, [owner === 'player' ? 'playerHand' : 'cpuHand']: [source] },
  owner, source.instanceId, lane);
  return { after, source };
}
function shield(m: Match, target: CardInstance, kind: 'church-protection' | 'salon-protection' | 'nail-mitigation' = 'church-protection') {
  target.statuses.protected = kind !== 'nail-mitigation';
  m.timedEffects.push({ id: kind + ':' + target.instanceId, kind, owner: target.owner, lane: target.lane!,
    sourceInstanceId: 'shield', targetInstanceId: target.instanceId, startsAtRound: m.round, expiresAtRound: 7, expiration: 'match-complete' });
}
function defense(owner: Owner = 'player') {
  const enemy = owner === 'player' ? 'cpu' : 'player';
  const m = blank(), leader = unit('church', owner, 2, 1, 4), target = unit('leroy', owner, 0, 2, 20);
  m.boards = [[target], [], [leader]];
  return { m, leader, target, enemy };
}

test('both leaders become Epic without changing IDs, training keys, opening grants, or printed budget', () => {
  for (const [engineId, catalogId] of [['church', 'church-auntie'], ['nightmedic', 'night-shift-medic']] as const) {
    const card = catalogCardById[catalogId];
    assert.equal(card.rarity, 'Epic'); assert.equal(card.engineId, engineId);
    assert.deepEqual([cards[engineId].cost, cards[engineId].power], [3, 4]);
    assert.deepEqual(cards[engineId].abilityUpgrades.map(u => u.id), [1, 2, 3].map(n => engineId + ':upgrade:' + n));
  }
  assert(ROOKIE_FOUNDATION_IDS.includes('church-auntie'));
  validateCardAbilityUpgrades();
});

for (const owner of ['player', 'cpu'] as const) for (const kind of ['church-protection', 'salon-protection', 'wifey'] as const) {
  test('Auntie rewards the Light target protected by ' + kind + ' for ' + owner, () => {
    const { m, leader, target, enemy } = defense(owner);
    if (kind === 'wifey') {
      const guard = unit('wifey', owner, 0, 3, 2); guard.statuses.protected = true; m.boards[0].push(guard);
    } else shield(m, target, kind);
    m.abilityUpgradeSnapshot = createAbilityUpgradeSnapshot(['folks'], ['folks'], { [enemy]: { folks: { xp: 2800, level: 8, moveTier: 3 } } });
    const original = JSON.stringify(m);
    const { after, source } = cast(m, 'folks', enemy);
    assert.equal(find(after, target).powerModifier, 2);
    assert.equal(find(after, target).statuses.silenced, false);
    assert.equal(find(after, source).powerModifier, 2, 'Folks retains its own trained reward; the protection reward belongs to the Light target');
    assert.equal(after.leaderRounds?.[owner]?.church, 4);
    assert.equal(after.pendingLeaderReactions?.length, 0);
    const reward = after.effectLog.find(e => e.note.includes('a protection block gave'));
    assert.equal(reward?.cardInstanceId, leader.instanceId);
    assert.equal(reward?.targets[0]?.cardInstanceId, target.instanceId);
    assert.equal(reward?.replay.after.leaderRounds?.[owner]?.church, 4);
    assert.equal(JSON.stringify(m), original);
  });
}
test('Auntie keeps Covered reveal and does not reward merely granting protection', () => {
  const m = blank(), ally = unit('crossingguard', 'player', 0, 1, 2);
  m.boards[0] = [ally];
  const { after } = cast(m, 'church', 'player');
  assert.equal(find(after, ally).powerModifier, 2);
  assert(find(after, ally).statuses.protected);
  assert.equal(after.leaderRounds, undefined);
});
test('Auntie caps board-wide multi-hit reactions at one and refreshes next round', () => {
  const { m, target, enemy } = defense();
  const other = unit('crossingguard', 'player', 1, 3);
  m.boards[1].push(other); shield(m, target); shield(m, other);
  const { after } = cast(m, 'folks', enemy);
  assert.equal(find(after, target).powerModifier, 2);
  assert.equal(find(after, other).powerModifier, 0);
  assert.equal(find(after, other).statuses.burnStacks, 0);
  const advanced = nextRound({ ...after, phase: 'resolved', playerHand: [], cpuHand: [] });
  shield(advanced, find(advanced, target));
  const again = cast(advanced, 'folks', enemy, 0, 1).after;
  assert.equal(find(again, target).powerModifier, 4);
  assert.equal(again.leaderRounds?.player?.church, 5);
});
for (const reason of ['silenced', 'frozen', 'weakened', 'absent', 'hand', 'non-light', 'support', 'hazard', 'immune', 'mitigation'] as const) {
  test('Auntie does not reward ' + reason, () => {
    const { m, leader, target, enemy } = defense();
    if (['silenced', 'frozen', 'weakened'].includes(reason)) leader.statuses[reason as 'silenced'] = true;
    if (reason === 'absent' || reason === 'hand') m.boards[2] = [];
    if (reason === 'hand') m.playerHand = [{ ...leader, lane: null }];
    if (reason === 'non-light') target.type = 'Water';
    if (reason === 'support') target.kind = 'support';
    if (reason === 'hazard') target.hazard = true;
    if (reason === 'immune') target.statuses.uncounterable = true;
    shield(m, target, reason === 'mitigation' ? 'nail-mitigation' : 'church-protection');
    const { after } = cast(m, 'folks', enemy);
    assert.equal(after.leaderRounds?.player?.church, undefined);
    assert(!after.effectLog.some(e => e.note.includes('a protection block gave')));
  });
}
test('Scammer copies share the per-side cap; a copied Auntie works by itself', () => {
  const { m, target, leader, enemy } = defense();
  const copy = { ...unit('scammer', 'player', 1, 3), copiedAbilityCardId: 'church' };
  m.boards[1] = [copy]; shield(m, target);
  const both = cast(m, 'folks', enemy).after;
  assert.equal(find(both, target).powerModifier, 2);
  const alone = { ...m, boards: [[target], [copy], []] } as Match;
  const copied = cast(alone, 'folks', enemy).after;
  assert.equal(find(copied, target).powerModifier, 2);
  assert.equal(copied.effectLog.find(e => e.note.includes('a protection block gave'))?.cardInstanceId, copy.instanceId);
  assert.equal(find(both, leader).powerModifier, 0);
});

for (const owner of ['player', 'cpu'] as const) test('Medic clears every harmful status locally and rewards one Light character for ' + owner, () => {
  const m = blank(), first = unit('church', owner, 0, 1), second = unit('crossingguard', owner, 0, 2);
  const normal = unit('cornball', owner, 0, 3), distant = unit('leroy', owner, 1, 4);
  for (const c of [first, second, normal, distant]) c.statuses = {
    ...c.statuses, frozen: true, silenced: true, weakened: true, locked: true, burnStacks: 3, protected: true, boosted: true,
  };
  m.boards = [[first, second, normal], [distant], []];
  const { after, source } = cast(m, 'nightmedic', owner);
  for (const c of [first, second, normal]) {
    const statuses = find(after, c).statuses;
    for (const key of ['frozen', 'silenced', 'weakened', 'locked'] as const) assert.equal(statuses[key], false);
    assert.equal(statuses.burnStacks, 0); assert.equal(statuses.protected, true); assert.equal(statuses.boosted, true);
  }
  assert.equal(find(after, first).powerModifier, 2);
  assert.equal(find(after, second).powerModifier, 0); assert.equal(find(after, normal).powerModifier, 0);
  assert.equal(find(after, distant).statuses.frozen, true);
  assert.equal(find(after, source).powerModifier, 0);
  assert.equal(after.leaderRounds?.[owner]?.nightmedic, 4);
});
for (const status of ['frozen', 'silenced', 'weakened', 'locked', 'burnStacks'] as const) {
  test('Medic recognizes ' + status + ' alone', () => {
    const m = blank(), target = unit('church', 'player', 0, 1);
    if (status === 'burnStacks') target.statuses.burnStacks = 3; else target.statuses[status] = true;
    m.boards[0] = [target];
    const { after } = cast(m, 'nightmedic', 'player');
    assert.equal(find(after, target).statuses[status], status === 'burnStacks' ? 0 : false);
    assert.equal(find(after, target).powerModifier, 2);
  });
}
test('Foodz cleanses Burn/Weaken/Lock across the board and triggers Medic once', () => {
  const m = blank(), medic = unit('nightmedic', 'player', 2, 1);
  const burned = unit('church', 'player', 0, 2), weakened = unit('crossingguard', 'player', 1, 3);
  const locked = unit('leroy', 'player', 2, 4, 2);
  burned.statuses.burnStacks = 3; weakened.statuses.weakened = true; locked.statuses.locked = true;
  m.boards = [[burned], [weakened], [medic, locked]];
  const { after } = cast(m, 'foodz', 'player');
  assert.equal(find(after, burned).statuses.burnStacks, 0);
  assert.equal(find(after, weakened).statuses.weakened, false);
  assert.equal(find(after, locked).statuses.locked, false);
  assert.equal(find(after, burned).powerModifier, 3, 'Foodz district buff plus Medic');
  assert.equal(find(after, weakened).powerModifier, 1); assert.equal(find(after, locked).powerModifier, 2, 'Foodz also rewards the weakest cleansed Light ally');
  assert.equal(after.effectLog.filter(e => e.note.startsWith('All Clear: cleansing gave')).length, 1);
});
for (const id of ['rastamon', 'laundry', 'firstaid', 'pinaynurse', 'soulfood', 'stonersr'] as const) {
  test(id + ' can trigger an active Medic in another district', () => {
    const m = blank(), medic = unit('nightmedic', 'player', 2, 1), ally = unit('church', 'player', 0, 2);
    ally.statuses.frozen = true; m.boards = [[ally], [], [medic]];
    const { after } = cast(m, id, 'player');
    assert.equal(find(after, ally).statuses.frozen, false);
    assert.equal(after.effectLog.filter(e => e.note.startsWith('All Clear: cleansing gave')).length, 1);
  });
}
test('Medic never rewards healthy allies, natural status expiry, or cleaning only non-Light cards', () => {
  const m = blank(), medic = unit('nightmedic', 'player', 2, 1), ally = unit('church', 'player', 0, 2);
  const normal = unit('cornball', 'player', 1, 3); normal.statuses.frozen = true;
  m.boards = [[ally], [normal], [medic]];
  const healthy = cast(m, 'foodz', 'player').after;
  assert.equal(healthy.leaderRounds?.player?.nightmedic, undefined);
  ally.statuses.burnStacks = 1;
  const expired = nextRound({ ...m, phase: 'resolved' });
  assert.equal(find(expired, ally).statuses.burnStacks, 0);
  assert.equal(expired.leaderRounds?.player?.nightmedic, undefined);
});
for (const status of ['silenced', 'frozen', 'weakened'] as const) test('Medic cannot reward her own recovery from ' + status, () => {
  const m = blank(), medic = unit('nightmedic', 'player', 0, 1);
  medic.statuses[status] = true; m.boards[0] = [medic];
  const { after } = cast(m, 'foodz', 'player');
  assert.equal(find(after, medic).statuses[status], false);
  assert.equal(find(after, medic).powerModifier, 2, 'only Foodz district and recovery buffs');
  assert.equal(after.leaderRounds?.player?.nightmedic, undefined);
});
test('Medic is once per round, survives JSON saves and copy changes, and refreshes next round', () => {
  const m = blank(), medic = unit('nightmedic', 'player', 2, 1), target = unit('church', 'player', 0, 2);
  target.statuses.burnStacks = 1; m.boards = [[target], [], [medic]];
  let after = cast(m, 'foodz', 'player').after;
  const saved = JSON.parse(JSON.stringify(after)) as Match;
  find(saved, target).statuses.burnStacks = 1;
  after = cast(saved, 'nightmedic', 'player', 0, 1).after;
  assert.equal(find(after, target).powerModifier, 4, 'no second leader bonus this round');
  after = nextRound({ ...after, phase: 'resolved', playerHand: [], cpuHand: [] });
  find(after, target).statuses.burnStacks = 1;
  after = cast(after, 'nightmedic', 'player', 0, 2).after;
  assert.equal(find(after, target).powerModifier, 6);
});
test('both leader rewards agree in AI search and replayable matches', () => {
  const { m, target, enemy } = defense();
  const medic = unit('nightmedic', 'player', 1, 3); m.boards[1] = [medic]; shield(m, target);
  const visible = cast(m, 'folks', enemy).after;
  const search = cast(suppressMatchPresentationEvents(m), 'folks', enemy).after;
  assert.deepEqual(search.boards, visible.boards);
  assert.deepEqual(search.leaderRounds, visible.leaderRounds);
  assert.equal(search.effectLog.length, 0);
  const original = JSON.parse(JSON.stringify(visible)) as Match;
  find(original, target).statuses.burnStacks = 1;
  const clean = cast(original, 'foodz', 'player').after;
  const searchClean = cast(suppressMatchPresentationEvents(original), 'foodz', 'player').after;
  assert.deepEqual(searchClean.boards, clean.boards);
  assert.deepEqual(searchClean.leaderRounds, clean.leaderRounds);
  assert.deepEqual(clean.leaderRounds?.player, { church: 4, nightmedic: 4 });
});
