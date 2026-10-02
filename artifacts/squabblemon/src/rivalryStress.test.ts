import assert from 'node:assert/strict';
import test from 'node:test';
import { createMatch, createCardInstance, createAbilityUpgradeSnapshot, playTurnCard, type Match, type Owner, type Lane, type CardInstance } from './gameEngine';
const owners = ['player', 'cpu'] as const;
const other = (o: Owner): Owner => o === 'player' ? 'cpu' : 'player';
const blank = (owner: Owner, tier: number): Match => ({ ...createMatch('block', 'block'), round: 3,
  playerMotion: 9, cpuMotion: 9, playerHand: [], cpuHand: [], boards: [[], [], []],
  abilityUpgradeSnapshot: createAbilityUpgradeSnapshot(['triple-og-red', 'block-spinner', 'cane-corso-red', 'triple-og-blue', 'ganger-blue', 'look-out', 'initiation'], ['triple-og-red', 'block-spinner', 'cane-corso-red', 'triple-og-blue', 'ganger-blue', 'look-out', 'initiation'],
    { [owner]: Object.fromEntries(['triple-og-red', 'block-spinner', 'cane-corso-red', 'triple-og-blue', 'ganger-blue', 'look-out', 'initiation'].map(id => [id, { xp: tier ? 4500 : 0, level: tier ? 10 : 1, moveTier: tier }])) }),
});
let serial = 0;
const unit = (id: string, owner: Owner, lane: Lane): CardInstance => ({ ...createCardInstance(id, owner, 'crip-buffs', serial++), lane });
const get = (m: Match, c: CardInstance) => m.boards.flat().find(x => x.instanceId === c.instanceId)!;
function cast(m: Match, id: string, owner: Owner, lane: Lane) {
  const c = unit(id, owner, lane);
  const after = playTurnCard({ ...m, phase: owner === 'player' ? 'player' : 'cpu-reveal',
    [owner === 'player' ? 'playerMotion' : 'cpuMotion']: 9,
    [owner === 'player' ? 'playerHand' : 'cpuHand']: [{ ...c, lane: null }] }, owner, c.instanceId, lane);
  return { c, after };
}


import { nextRound, getLegalCardCost } from './gameEngine';
for (const owner of owners) for (const tier of [0, 1, 2, 3]) {
  test(`Blue shields do not stack and Blood can break through (${owner}, ${tier})`, () => {
    const m = blank(owner, tier), ally = unit('look-out', owner, 1);
    m.boards[1] = [ally];
    const clue = cast(m, 'triple-og-blue', owner, 0);
    const cover = cast(clue.after, 'ganger-blue', owner, 0);
    assert.equal(cover.after.timedEffects.filter(e => e.kind === 'church-protection' && e.targetInstanceId === ally.instanceId).length, 1);
    const hands = get(cover.after, ally).powerModifier;
    const broken = cast(cover.after, 'block-spinner', other(owner), 1);
    assert.equal(get(broken.after, ally).statuses.burnStacks, 0);
    assert.equal(get(broken.after, ally).statuses.protected, false);
    const hit = cast(broken.after, 'ganger-red', other(owner), 1);
    assert.equal(get(hit.after, ally).powerModifier, hands - 2);
  });
  test(`Folks Burn ticks once and Protection blocks the application (${owner}, ${tier})`, () => {
    const m = blank(owner, tier), covered = unit('look-out', owner, 1), exposed = unit('waterboy', owner, 2);
    exposed.powerModifier = 20;
    m.boards = [[], [covered], [exposed]];
    const protectedState = cast(m, 'bustdown', owner, 1).after;
    const burned = cast(protectedState, 'folks', other(owner), 0).after;
    assert.equal(get(burned, covered).statuses.burnStacks, 0);
    const stacks = get(burned, exposed).statuses.burnStacks;
    assert(stacks >= 3);
    const tick = nextRound({ ...burned, phase: 'resolved', playerDrawIndex: 100, cpuDrawIndex: 100 });
    assert.equal(get(tick, exposed).powerModifier, 20 - stacks);
    assert.equal(get(tick, exposed).statuses.burnStacks, 0);
    const next = nextRound({ ...tick, phase: 'resolved' });
    assert.equal(get(next, exposed).powerModifier, 20 - stacks, 'old burn cannot deal damage twice');
  });
  test(`Initiation recruits join Blue support without a second recruitment payout (${owner}, ${tier})`, () => {
    const m = blank(owner, tier), leader = unit('look-out', owner, 1);
    leader.powerModifier = 20; m.boards[1] = [leader];
    const marked = cast(m, 'initiation', owner, 1);
    const recruit = cast(marked.after, 'waterboy', owner, 1);
    assert.equal(get(recruit.after, recruit.c).gangTag, 'blue');
    assert.equal(get(recruit.after, recruit.c).powerModifier, 2 + tier);
    const support = cast(recruit.after, 'triple-og-blue', owner, 0);
    assert.equal(get(support.after, recruit.c).powerModifier, 4 + tier);
    assert(get(support.after, recruit.c).statuses.protected);
    const later = cast(support.after, 'alchy', owner, 1);
    assert.equal(get(later.after, later.c).powerModifier, 0);
    assert(!later.after.districtTraps?.some(t => t.kind === 'initiation'));
  });
  test(`Red respect cannot displace into full enemy districts (${owner}, ${tier})`, () => {
    const m = blank(owner, tier), immune = unit('blueside1', other(owner), 2);
    m.boards = [Array.from({length:4}, () => unit('waterboy', other(owner), 0)),
      Array.from({length:4}, () => unit('waterboy', other(owner), 1)), [immune]];
    const hit = cast(m, 'triple-og-red', owner, 2);
    assert.equal(get(hit.after, immune).lane, 2);
    assert.equal(get(hit.after, immune).powerModifier, 0);
    assert.equal(get(hit.after, hit.c).powerModifier, 0, 'no damage or move means no training');
    for (const lane of hit.after.boards) assert(lane.filter(c => c.owner === other(owner)).length <= 4);
  });
  test(`Three Look Out calls remain bounded despite repeated enemy plays (${owner}, ${tier})`, () => {
    const m = {...blank(owner, tier), round: 1, playerDrawIndex: 100, cpuDrawIndex: 100};
    m.boards[2] = [unit('blue-nose-pit', owner, 2)];
    const setup = cast(m, 'look-out', owner, 0);
    let state = setup.after;
    for (let round = 1; round <= 6; round++) {
      for (let i = 0; i < 2; i++) state = cast(state, 'waterboy', other(owner), 1).after;
      const cheap = unit('waterboy', owner, 1);
      assert(getLegalCardCost(state, owner, cheap, 1) >= 0);
      assert.equal(get(state, setup.c).lookoutCalls, Math.min(3, round));
      assert(state.discountTokens.filter(t => t.sourceInstanceId === setup.c.instanceId).length <= 3);
      state = {...state, boards: state.boards.map(lane => lane.filter(c => c.owner === owner)) as Match['boards']};
      if (round < 6) state = nextRound({...state, phase: 'resolved'});
    }
    assert.equal(state.effectLog.filter(e => e.abilityMetadata?.sourceInstanceId === setup.c.instanceId).length, tier);
  });
}
