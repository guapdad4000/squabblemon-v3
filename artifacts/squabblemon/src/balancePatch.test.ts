import assert from 'node:assert/strict';
import test from 'node:test';
import { cards, catalogCardByEngineId, decks } from './data';
import { createCardInstance, createMatch, playTurnCard, type Owner } from './gameEngine';

test('Plant setup cards and Kingpin keep their authored budgets in collection and battle', () => {
  const budgets: Record<string, readonly [number, number]> = {
    gardener: [1, 2],
    rootnurse: [2, 3],
    canopykeeper: [3, 4],
    'inmate-kingpin': [1, 3],
  };
  for (const [id, [cost, power]] of Object.entries(budgets)) {
    assert.deepEqual([cards[id].cost, cards[id].power], [cost, power], id);
    assert.deepEqual([catalogCardByEngineId[id].cost, catalogCardByEngineId[id].power], [cost, power], id);
    if (id !== 'inmate-kingpin') {
      assert(power <= cost + 1, `${id} must stay inside the Plant setup printed-Hand budget`);
    }
    for (const owner of ['player', 'cpu'] as const) {
      const instance = createCardInstance(id, owner);
      assert.deepEqual([instance.cost, instance.basePower], [cost, power], `${id}/${owner}`);
      assert.equal(instance.effect, cards[id].effect);
    }
  }
});

test('Dark and detective setup costs match collection and both battle owners', () => {
  const budgets: Record<string, readonly [number, number]> = {
    nerd: [3, 3],
    counter: [3, 3],
    sherlock: [2, 3],
  };
  for (const [id, [cost, power]] of Object.entries(budgets)) {
    assert.deepEqual([cards[id].cost, cards[id].power], [cost, power], id);
    assert.deepEqual([catalogCardByEngineId[id].cost, catalogCardByEngineId[id].power], [cost, power], id);
    assert(power <= cost + 1, `${id} printed Hands budget`);
    for (const owner of ['player', 'cpu'] as Owner[]) {
      const source = createCardInstance(id, owner);
      const hand = owner === 'player' ? 'playerHand' : 'cpuHand';
      const motion = owner === 'player' ? 'playerMotion' : 'cpuMotion';
      const match = {
        ...createMatch(decks[0].id, decks[1].id),
        phase: owner === 'player' ? 'player' as const : 'cpu-reveal' as const,
        [hand]: [source],
        [motion]: cost,
      };
      const after = playTurnCard(match, owner, source.instanceId, 0);
      assert.equal(after[motion], 0, `${id}/${owner} pays its printed Motion`);
      const deployed = after.boards.flat().find(card => card.instanceId === source.instanceId);
      assert.ok(deployed, `${id}/${owner} is playable with exactly ${cost} Motion`);
      assert.equal(deployed.basePower, power);
      assert.equal(deployed.effect, cards[id].effect);
    }
  }
});
