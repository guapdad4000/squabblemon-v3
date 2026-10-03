import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { catalogCardById } from '@workspace/squabblemon-engine/data';
import { PREPARED_PATCHES } from './preparedPatches';
import { getPatchBanner, PATCH_BANNERS } from './patchBanners';

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
    assert.equal(patch.softCurrency, patch.version === '1.9' ? 0 : patch.version === '1.8' ? 50 : 100);
    assert.equal(patch.packTickets, ['1.8', '1.9'].includes(patch.version) ? 0 : 1);
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

test('prepared patch 1.7 has the approved additions, changes, and gift', () => {
  const patch = PREPARED_PATCHES.find(item => item.version === '1.7');
  assert.ok(patch);
  assert.equal(patch.date, '2026-09-29');
  assert.equal(patch.title, 'Triple OGs Run the Block');
  assert.equal(patch.artCardId, 'triple-og-blue');
  assert.equal(patch.softCurrency, 100);
  assert.equal(patch.packTickets, 1);
  assert.equal(patch.buffs.length, 5);
  for (const name of ['CLUE COOKY', 'RED PUNCH', 'INITIATION', 'BLOCK SPINNER', 'LOOK OUT']) {
    assert.ok(patch.buffs.some(line => line.startsWith(name)), `${name} is included`);
  }
  assert.ok(patch.changes.some(line => /ordinary Street Pack pulls/.test(line)));
  assert.ok(patch.changes.some(line => /Triple OG reveal.*ignore Silence/.test(line)));
  assert.ok(patch.changes.some(line => /Roll Call.*removes defeated 1-Hand allies/.test(line)));
  assert.ok(patch.changes.some(line => /Forced moves.*in order without replay jumps/.test(line)));
  assert.ok(![patch.overview, ...patch.buffs, ...patch.changes].some(line => /devcode|tripleogdev/i.test(line)));
});

test('editorial banner is version-and-art-bound with a valid bundled asset path', () => {
  const banner = getPatchBanner('1.7', 'triple-og-blue');
  assert.deepEqual(banner, PATCH_BANNERS['1.7']);
  assert.match(banner!.path, /^assets\/events\/[a-z0-9-]+\.webp$/);
  assert.ok(existsSync(new URL(`../../public/${banner!.path}`, import.meta.url)), `missing bundled banner ${banner!.path}`);
  assert.equal(getPatchBanner('1.6', 'triple-og-blue'), undefined);
  assert.equal(getPatchBanner('1.7', 'cracked-head'), undefined);
  assert.equal(getPatchBanner('1.7', null), undefined);
  const house = getPatchBanner('1.9', 'squabble-house-manager');
  assert.deepEqual(house, PATCH_BANNERS['1.9']);
  assert.ok(existsSync(new URL(`../../public/${house!.path}`, import.meta.url)));
  assert.equal(getPatchBanner('1.9', 'triple-og-blue'), undefined);
});
