import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { cardCatalog, cards } from './data';
import { createCardInstance } from './gameEngine';
import { CARD_BALANCE_VERSION } from '@workspace/squabblemon-engine/multiplayer';

// Frozen v60 baseline with the deliberate v61/v62 card changes below.
// Update deliberately when a new balance pass changes a printed budget.
const budgets: Record<string, { cost: number; power: number }> = {
  ...JSON.parse(readFileSync(new URL('./balanceBudgets.v60.json', import.meta.url), 'utf8')),
  // Preserve every unrelated printed budget.
  'bushedo-brown': { cost: 3, power: 4 },
  'franklin-duke': { cost: 4, power: 6 },
  'chonk-lee': { cost: 5, power: 7 },
  ptang: { cost: 3, power: 4 },
  shonuff: { cost: 3, power: 4 },
  yasuke: { cost: 2, power: 3 },
  undercova: { cost: 2, power: 3 },
  thefeds: { cost: 4, power: 3 },
  watson: { cost: 1, power: 2 },
  passportbro: { cost: 2, power: 3 },
  // v62: Energy Drink Freak trades permanent base Hands for tempo.
  rainmaker: { cost: 3, power: 4 },
};

test('all 301 collectible cards retain the approved printed budgets in either authoritative seat', () => {
  assert.equal(CARD_BALANCE_VERSION, 62);
  assert.equal(cardCatalog.length, 301);
  assert.deepEqual(Object.keys(budgets).sort(), cardCatalog.map(c => c.engineId).sort());
  for (const entry of cardCatalog) {
    const expected = budgets[entry.engineId];
    assert.deepEqual({cost: entry.cost, power: entry.power}, expected, entry.name);
    assert.equal(entry.catalogId, cards[entry.engineId].id);
    for (const owner of ['player', 'cpu'] as const) {
      const unit = createCardInstance(entry.engineId, owner);
      assert.equal(unit.basePower, expected.power, `${owner}: ${entry.name} Hands`);
      assert.equal(unit.cost, expected.cost, `${owner}: ${entry.name} Motion`);
      assert.equal(unit.owner, owner);
    }
  }
});
