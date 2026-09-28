import assert from 'node:assert/strict';
import test from 'node:test';
import { cards, catalogCardByEngineId } from './data';
import { createCardInstance } from './gameEngine';

test('Plant setup cards and Kingpin use the same bounded budgets in collection and battle', () => {
  const budgets: Record<string, readonly [number, number]> = {
    gardener: [1, 2],
    rootnurse: [2, 3],
    canopykeeper: [3, 4],
    'inmate-kingpin': [1, 2],
  };
  for (const [id, [cost, power]] of Object.entries(budgets)) {
    assert.deepEqual([cards[id].cost, cards[id].power], [cost, power], id);
    assert.deepEqual([catalogCardByEngineId[id].cost, catalogCardByEngineId[id].power], [cost, power], id);
    assert(power <= cost + 1, `${id} must stay inside the printed-Hand budget`);
    for (const owner of ['player', 'cpu'] as const) {
      const instance = createCardInstance(id, owner);
      assert.deepEqual([instance.cost, instance.basePower], [cost, power], `${id}/${owner}`);
      assert.equal(instance.effect, cards[id].effect);
    }
  }
});