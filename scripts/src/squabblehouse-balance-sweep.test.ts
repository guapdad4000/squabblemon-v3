import assert from 'node:assert/strict';
import test from 'node:test';
import { decks } from '@workspace/squabblemon-engine/data';
import { getShell, MIXED_SHELL_IDS, STAFF_SHELL_IDS, validateRoster } from './squabblehouse-balance-sweep';

test('the pre-diner staff/utility baseline stays frozen when the starter recipe evolves', () => {
  assert.deepEqual(STAFF_SHELL_IDS, [
    'squabble-house-manager', 'plug', 'waterboy', 'squabblehouse-security',
    'squabblehouse-teknician', 'griddle-master', 'inmate-reformed', 'janitor',
    'laundry', 'nail',
  ]);
  assert.equal(new Set(STAFF_SHELL_IDS).size, 10);
  validateRoster('staff', STAFF_SHELL_IDS);
  const recipe = decks.find(deck => deck.id === 'squabblehouse-shift');
  assert.ok(recipe, 'current authored staff recipe exists');
  assert.notDeepEqual(recipe.cards, STAFF_SHELL_IDS);
  assert.deepEqual(getShell('staff').cardIds, [...STAFF_SHELL_IDS]);
  assert.match(getShell('staff').name, /Frozen pre-diner/);
});

test('staff mode rejects replaced cards, duplicates, and non-ten-card rosters', () => {
  assert.throws(() => validateRoster('staff', [...STAFF_SHELL_IDS.slice(0, 9), 'cane-corso-red']), /frozen pre-diner staff\/utility roster/);
  assert.throws(() => validateRoster('staff', [...STAFF_SHELL_IDS.slice(0, 9), 'squabble-house-manager']), /ten unique cards/);
  assert.throws(() => validateRoster('staff', STAFF_SHELL_IDS.slice(0, 9)), /ten unique cards/);
});

test('historical mixed shell remains explicitly separate and still validates', () => {
  assert.equal(new Set(MIXED_SHELL_IDS).size, 10);
  validateRoster('mixed', MIXED_SHELL_IDS);
  assert.notDeepEqual(MIXED_SHELL_IDS, STAFF_SHELL_IDS);
});