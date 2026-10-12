import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { cardCatalog, cards } from './data';
import { createCardInstance } from './gameEngine';
import { CARD_BALANCE_VERSION } from '@workspace/squabblemon-engine/multiplayer';

// Frozen after v60 elemental tempo buffs; printed Hands unchanged.
// Update deliberately when a new balance pass changes a printed budget.
const budgets = JSON.parse(readFileSync(new URL('./balanceBudgets.v60.json', import.meta.url), 'utf8')) as Record<string, { cost: number; power: number }>;

test('all 298 collectible cards retain the approved printed budgets in either authoritative seat', () => {
  assert.equal(CARD_BALANCE_VERSION, 60);
  assert.equal(cardCatalog.length, 298);
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
