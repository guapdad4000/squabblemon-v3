import assert from 'node:assert/strict';
import test from 'node:test';
import { createMatch, createCardInstance, createAbilityUpgradeSnapshot, playTurnCard, type Match, type Owner, type Lane, type CardInstance } from './gameEngine';
const owners = ['player', 'cpu'] as const;
const other = (o: Owner): Owner => o === 'player' ? 'cpu' : 'player';
const blank = (owner: Owner, tier: number): Match => ({ ...createMatch('block', 'block'), round: 3,
  playerMotion: 9, cpuMotion: 9, playerHand: [], cpuHand: [], boards: [[], [], []],
  abilityUpgradeSnapshot: createAbilityUpgradeSnapshot(['cane-corso-red', 'blue-nose-pit'], ['cane-corso-red', 'blue-nose-pit'],
    { [owner]: Object.fromEntries(['cane-corso-red', 'blue-nose-pit'].map(id => [id, { xp: tier ? 4500 : 0, level: tier ? 10 : 1, moveTier: tier }])) }),
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


import { nextRound } from './gameEngine';
for (const owner of owners) for (const [dog, og, home] of [
  ['blue-nose-pit', 'triple-og-blue', 0], ['cane-corso-red', 'triple-og-red', 2],
] as const) {
  for (const tier of [0, 1, 2, 3]) test(`${dog} approaches and supports immediately when adjacent (${owner}, tier ${tier})`, () => {
    const m = blank(owner, tier), leader = unit(og, owner, home), enemy = unit('hooper', other(owner), home);
    m.boards[home] = [leader, enemy];
    const result = cast(m, dog, owner, 1);
    assert.equal(get(result.after, result.c).lane, home);
    assert.equal(get(result.after, result.c).squabblehouseEffectRound, m.round);
    assert.equal(get(result.after, result.c).powerModifier, tier);
    if (dog === 'blue-nose-pit') assert.equal(get(result.after, leader).powerModifier, 1);
    else assert.equal(get(result.after, enemy).powerModifier, -1);
    const moved = result.after.effectLog.find(e => e.cardInstanceId === result.c.instanceId && e.kind === 'move');
    assert(moved, 'movement is replayable');
    assert.equal(moved.replay.before.boards.flat().find(c => c.instanceId === result.c.instanceId)?.lane, 1);
    assert.equal(moved.replay.after.boards.flat().find(c => c.instanceId === result.c.instanceId)?.lane, home);
  });
  test(`${dog} takes only one step and cannot support remotely (${owner})`, () => {
    const m = blank(owner, 3), leader = unit(og, owner, home);
    m.boards[home] = [leader, unit('hooper', other(owner), home)];
    const result = cast(m, dog, owner, home === 0 ? 2 : 0);
    assert.equal(get(result.after, result.c).lane, 1);
    assert.equal(get(result.after, result.c).squabblehouseEffectRound, undefined);
    assert.equal(get(result.after, result.c).powerModifier, 0);
    const arrived = nextRound({ ...result.after, phase: 'resolved', playerDrawIndex: 100, cpuDrawIndex: 100 });
    assert.equal(get(arrived, result.c).lane, home);
    assert.equal(get(arrived, result.c).powerModifier, 3);
    const again = nextRound({ ...arrived, phase: 'resolved' });
    assert.equal(get(again, result.c).powerModifier, 3, 'later support cannot train twice');
  });
  for (const block of ['capacity', 'story-lock', 'locked', 'frozen', 'silenced'] as const) test(`${dog} approach respects ${block} (${owner})`, () => {
    const m = blank(owner, 3);
    m.boards[home] = [unit(og, owner, home)];
    if (block === 'capacity') for (let i = 0; i < 3; i++) m.boards[home].push(unit('waterboy', owner, home));
    if (block === 'story-lock') m.storyRuntime = { activePhaseIndex: 0, appliedEffectIds: [], lanePowerBonuses: [], laneLocks: [{owner, lanes:[home]}] };
    const c = unit(dog, owner, 1);
    if (block === 'locked' || block === 'frozen' || block === 'silenced') c.statuses[block] = true;
    const after = playTurnCard({ ...m, phase: owner === 'player' ? 'player' : 'cpu-reveal',
      [owner === 'player' ? 'playerHand' : 'cpuHand']: [{...c, lane:null}] }, owner, c.instanceId, 1);
    assert.equal(get(after, c).lane, 1);
    assert.equal(get(after, c).waveTrainingUsed, undefined);
  });
}

for (const [dog, og, home] of [
  ['blue-nose-pit', 'triple-og-blue', 0], ['cane-corso-red', 'triple-og-red', 2],
] as const) test(`${dog} reveal echoes cannot grant an extra approach step`, () => {
  const m = blank('player', 0);
  m.boards[home] = [unit(og, 'player', home)];
  const played = cast(m, dog, 'player', home === 0 ? 2 : 0);
  assert.equal(get(played.after, played.c).lane, 1);
  const echoed = cast(played.after, 'squabblehouse-teknician', 'player', 1).after;
  assert(echoed.effectLog.some(e => e.note.includes('Run It Back')), 'the echo actually fired');
  assert.equal(get(echoed, played.c).lane, 1);
  assert.equal(get(echoed, played.c).squabblehouseEffectRound, undefined);
});
