import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogCardById } from '@workspace/squabblemon-engine/data';
import { PREPARED_PATCHES } from './preparedPatches';

test('prepared patch notes fit the publication contract', () => {
  const versions = new Set<string>();
  for (const patch of PREPARED_PATCHES) {
    assert.ok(!versions.has(patch.version), `duplicate version ${patch.version}`);
    versions.add(patch.version);
    assert.match(patch.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(`Patch ${patch.version}: ${patch.title}`.length <= 120, `${patch.version} mail title too long`);
    assert.ok(patch.overview.trim() && patch.overview.length <= 3000);
    for (const line of [...patch.buffs, ...patch.changes]) assert.ok(line.trim() && line.length <= 500, line);
    const letter = [patch.version, patch.title, patch.overview, ...patch.buffs, ...patch.changes].join('\n');
    assert.ok(letter.length < 5500, `${patch.version} letter too long`);
    assert.equal(patch.softCurrency, 100);
    assert.equal(patch.packTickets, 1);
  }
  assert.deepEqual([...versions], [...versions].sort((a, b) => Number(a) - Number(b)), 'notes stay oldest-first for publishing order');
});

test('every prepared note headlines an original character portrait', () => {
  for (const patch of PREPARED_PATCHES) {
    const card = catalogCardById[patch.artCardId];
    assert.ok(card, `${patch.version} art ${patch.artCardId} is not in the catalog`);
    assert.ok(card.kind !== 'support' && card.kind !== 'token', `${patch.version} art must be a character`);
  }
});
