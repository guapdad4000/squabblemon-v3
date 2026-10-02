import assert from 'node:assert/strict';
import test from 'node:test';
import { createMatch, createCardInstance, createAbilityUpgradeSnapshot, playTurnCard, type Match, type Owner, type Lane, type CardInstance } from './gameEngine';
const owners = ['player', 'cpu'] as const;
const other = (o: Owner): Owner => o === 'player' ? 'cpu' : 'player';
const blank = (owner: Owner, tier: number): Match => ({ ...createMatch('block', 'block'), round: 3,
  playerMotion: 9, cpuMotion: 9, playerHand: [], cpuHand: [], boards: [[], [], []],
  abilityUpgradeSnapshot: createAbilityUpgradeSnapshot(['triple-og-red', 'block-spinner', 'cane-corso-red'], ['triple-og-red', 'block-spinner', 'cane-corso-red'],
    { [owner]: Object.fromEntries(['triple-og-red', 'block-spinner', 'cane-corso-red'].map(id => [id, { xp: tier ? 4500 : 0, level: tier ? 10 : 1, moveTier: tier }])) }),
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
for (const owner of owners) for (const tier of [0, 1, 2, 3]) {
  for (const id of ['triple-og-red', 'block-spinner']) test(`${id} pays training only on a real hit (${owner}, ${tier})`, () => {
    const empty = cast(blank(owner, tier), id, owner, 2);
    assert.equal(get(empty.after, empty.c).powerModifier, 0);
    const m = blank(owner, tier);
    m.boards[2] = [unit('hooper', other(owner), 2)];
    const hit = cast(m, id, owner, 2);
    assert.equal(get(hit.after, hit.c).powerModifier, tier + (id === 'triple-og-red' ? 1 : 0));
  });
  test(`Spinner delayed burn trains once (${owner}, ${tier})`, () => {
    const setup = cast(blank(owner, tier), 'block-spinner', owner, 2);
    const hit = cast(setup.after, 'hooper', other(owner), 2).after;
    assert.equal(get(hit, setup.c).powerModifier, tier);
    const again = cast(hit, 'hooper', other(owner), 2).after;
    assert.equal(get(again, setup.c).powerModifier, tier);
  });
  test(`Corso waits for real damage and trains on delayed support (${owner}, ${tier})`, () => {
    const m = blank(owner, tier);
    m.boards[2] = [unit('triple-og-red', owner, 2)];
    const setup = cast(m, 'cane-corso-red', owner, 2);
    assert.equal(get(setup.after, setup.c).powerModifier, 0);
    setup.after.boards[2].push(unit('hooper', other(owner), 2));
    const hit = nextRound({ ...setup.after, phase: 'resolved', playerDrawIndex: 100, cpuDrawIndex: 100 });
    assert.equal(get(hit, setup.c).powerModifier, tier);
    assert.equal(get(hit, setup.c).waveTrainingUsed, true);
  });
  test(`Blocked Spinner burn does not train (${owner}, ${tier})`, () => {
    const m = blank(owner, tier), target = unit('hooper', other(owner), 2);
    target.statuses.protected = true; m.boards[2] = [target];
    m.timedEffects = [{ id: 'shield', kind: 'church-protection', sourceInstanceId: target.instanceId, targetInstanceId: target.instanceId, owner: target.owner, lane: 2, startsAtRound: 1, expiresAtRound: 99, expiration: 'match-complete' }];
    const hit = cast(m, 'block-spinner', owner, 2);
    assert.equal(get(hit.after, hit.c).powerModifier, 0);
  });
}
import { decks } from './data';
import { canAffordSelection, createMatchFromEngineCards, createDistrictSnapshot, pass, revealCpuTurn, verifyMatchTranscript, type PlayerMove } from './gameEngine';
for (const tier of [0, 1, 2, 3]) test(`Blood crew actions replay exactly under authoritative rules (tier ${tier})`, () => {
  const ids = ['triple-og-red', 'block-spinner', 'redside1', 'ganger-red', 'cane-corso-red', 'initiation', 'redneck-evil', 'folks', 'cognac', 'bustdown'];
  const opponent = decks.find(d => d.id === 'block')!;
  const snapshot = createAbilityUpgradeSnapshot(ids, opponent.cards, {
    player: Object.fromEntries(ids.map(id => [id, { xp: tier ? 4500 : 0, level: tier ? 10 : 1, moveTier: tier }])),
  });
  const districts = createDistrictSnapshot('blood-repair-replay');
  let local = createMatchFromEngineCards('focused-red-set', ids, opponent.id, opponent.cards, undefined, undefined, snapshot, districts);
  const moves: PlayerMove[] = [];
  while (local.phase !== 'complete') {
    const choice = local.playerHand.flatMap(card => ([0, 1, 2] as Lane[])
      .filter(lane => canAffordSelection(local, 'player', card.instanceId, lane)).map(lane => ({ card, lane })))[0];
    if (choice) {
      const squabble = !local.squabbleUsed && local.round >= 4;
      moves.push({ cardInstanceId: choice.card.instanceId, lane: choice.lane, squabble, endTurn: false });
      local = playTurnCard(local, 'player', choice.card.instanceId, choice.lane, squabble);
    } else {
      moves.push({ cardInstanceId: null, lane: null, squabble: false, endTurn: true });
      local = nextRound(revealCpuTurn(pass(local, 'player')));
    }
    assert(moves.length <= 64);
  }
  const replay = verifyMatchTranscript('focused-red-set', opponent.id, JSON.parse(JSON.stringify(moves)),
    JSON.parse(JSON.stringify(snapshot)), ids, JSON.parse(JSON.stringify(districts)));
  assert.deepEqual(replay, local);
});


for (const owner of owners) {
  test(`Corso blocked damage cannot cash training (${owner})`, () => {
    const m = blank(owner, 3), target = unit('hooper', other(owner), 2);
    m.boards[2] = [unit('triple-og-red', owner, 2), target];
    m.timedEffects = [{ id: 'corso-shield', kind: 'church-protection', sourceInstanceId: target.instanceId,
      targetInstanceId: target.instanceId, owner: target.owner, lane: 2, startsAtRound: 1, expiresAtRound: 99, expiration: 'match-complete' }];
    const hit = cast(m, 'cane-corso-red', owner, 2);
    assert.equal(get(hit.after, hit.c).powerModifier, 0);
    assert(!get(hit.after, hit.c).waveTrainingUsed);
  });
  test(`Echoed Spinner trap burns without awarding copied training (${owner})`, () => {
    const m = blank(owner, 3);
    m.lastRevealedCardId = 'block-spinner';
    const setup = cast(m, 'tayaty', owner, 2);
    assert.equal(setup.after.districtTraps?.find(t => t.kind === 'spinner')?.echoed, true);
    const hit = cast(setup.after, 'hooper', other(owner), 2);
    assert(get(hit.after, hit.c).statuses.burnStacks > 0);
    assert(!hit.after.effectLog.some(e => e.abilityMetadata?.sourceCardId === 'block-spinner'));
  });
}

for (const owner of owners) for (const tier of [0, 1, 2, 3]) {
  for (const outcome of ['damage', 'protection', 'stacked-protection', 'empty', 'immune'] as const) test(`Ganger Red rewards actual pressure: ${outcome} (${owner}, tier ${tier})`, () => {
    const m = blank(owner, tier);
    m.abilityUpgradeSnapshot = createAbilityUpgradeSnapshot(['ganger-red'], ['ganger-red'],
      { [owner]: { 'ganger-red': { xp: tier ? 4500 : 0, level: tier ? 10 : 1, moveTier: tier } } });
    const target = unit(outcome === 'immune' ? 'triple-og-blue' : 'hooper', other(owner), 2);
    if (outcome === 'protection' || outcome === 'stacked-protection') {
      target.statuses.protected = true;
      m.timedEffects.push({ id: 'test-cover', kind: 'church-protection', owner: target.owner,
        sourceInstanceId: target.instanceId, targetInstanceId: target.instanceId, lane: 2,
        startsAtRound: 1, expiresAtRound: 99, expiration: 'match-complete' });
      if (outcome === 'stacked-protection') m.timedEffects.push({ ...m.timedEffects[m.timedEffects.length - 1], id: 'second-cover' });
    }
    if (outcome !== 'empty') m.boards[2] = [target];
    const result = cast(m, 'ganger-red', owner, 2);
    const success = outcome === 'damage' || outcome === 'protection' || outcome === 'stacked-protection';
    assert.equal(get(result.after, result.c).powerModifier, success ? 1 + tier : 0);
    if (outcome === 'protection' || outcome === 'stacked-protection') {
      assert.equal(get(result.after, target).statuses.protected, outcome === 'stacked-protection');
      assert.equal(result.after.timedEffects.some(effect => effect.id === 'test-cover'), false);
      assert.equal(get(result.after, target).powerModifier, 0, 'Protection still prevents damage');
    }
  });
}
test('Cane Corso has three base Hands at two Motion', () => {
  const dog = unit('cane-corso-red', 'player', 0);
  assert.equal(dog.power, 3);
  assert.equal(dog.cost, 2);
});
