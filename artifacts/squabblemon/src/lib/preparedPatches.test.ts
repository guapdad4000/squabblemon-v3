import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { COLLECTOR_V2_MAIL_ID, getMailEventPresentation } from './mailEvents';
import { catalogCardById, KUMITE_CARD_REWARDS } from '@workspace/squabblemon-engine/data';
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
    assert.ok(patch.buffs.length <= 50 && patch.changes.length <= 50);
    const date = new Date(`${patch.date}T00:00:00.000Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
    const mailBody = [`Patch ${patch.version} · ${date}`, patch.title, '', patch.overview,
      ...(patch.buffs.length ? ['', 'Buffs', ...patch.buffs.map(line => `• ${line}`)] : []),
      ...(patch.changes.length ? ['', 'Changes', ...patch.changes.map(line => `• ${line}`)] : []),
    ].join('\n');
    assert.ok(mailBody.length <= 6000, `${patch.version} rendered mail exceeds server limit`);
    assert.equal(patch.softCurrency, ['1.9', '1.10', '1.11', '1.12', '1.13', '1.14'].includes(patch.version) ? 0 : patch.version === '1.8' ? 50 : 100);
    assert.equal(patch.packTickets, ['1.11', '1.12'].includes(patch.version) ? 10 : ['1.8', '1.9', '1.10', '1.13', '1.14'].includes(patch.version) ? 0 : 1);
  }
  const versionParts = (version: string) => version.split('.').map(Number);
  assert.deepEqual([...versions], [...versions].sort((a, b) => {
    const [aMajor, aMinor] = versionParts(a), [bMajor, bMinor] = versionParts(b);
    return aMajor - bMajor || aMinor - bMinor;
  }), 'notes stay oldest-first for publishing order');
});

test('prepared patch 1.10 announces the complete player-facing SquabbleHouse cleanup', () => {
  const patch = PREPARED_PATCHES.find(item => item.version === '1.10');
  assert.ok(patch);
  assert.equal(patch.artCardId, 'inmate-reformed');
  assert.ok(patch.buffs.some(line => /transparent side padding/.test(line)));
  assert.ok(patch.changes.some(line => /Manager.*Server/.test(line)));
  assert.ok(![patch.overview, ...patch.buffs, ...patch.changes].some(line => /devcode|devsquabblehouse/i.test(line)));
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

test('Street Legends release carries ten tickets with a version-bound uncropped banner', () => {
  const patch = PREPARED_PATCHES.find(item => item.version === '1.11');
  assert.ok(patch);
  assert.equal(patch.packTickets, 10);
  assert.equal(patch.softCurrency, 0);
  assert.ok(patch.changes.some(line => /Lash Tech is her own character/.test(line)));
  const banner = getPatchBanner(patch.version, patch.artCardId);
  assert.ok(banner);
  assert.equal(banner.aspectRatio, '3 / 1');
  assert.ok(existsSync(new URL(`../../public/${banner.path}`, import.meta.url)));
  assert.equal(getPatchBanner('1.11', 'nail'), undefined);
});

test('Kumite 1.13 stays a reviewed zero-gift draft with accurate mode coverage', () => {
  const patch = PREPARED_PATCHES.find(item => item.version === '1.13');
  assert.ok(patch);
  assert.equal(patch.date, '2026-10-13');
  assert.equal(patch.artCardId, 'dragonfly-jones');
  assert.equal(patch.softCurrency, 0);
  assert.equal(patch.packTickets, 0);
  assert.deepEqual(patch.buffs, []);
  const reviewed = JSON.parse(readFileSync(new URL('../../../../docs/releases/kumite-1.13.json', import.meta.url), 'utf8'));
  assert.deepEqual(patch, reviewed, 'the private desk uses the exact reviewable payload');
  const text = [patch.overview, ...patch.changes].join('\n');
  for (const reward of KUMITE_CARD_REWARDS) assert.ok(text.includes(reward.name), `missing unlock ${reward.name}`);
  assert.match(text, /eight human seats/);
  assert.match(text, /ten distinct owned cards/);
  assert.match(text, /Monday 00:00 UTC/);
  assert.match(text, /Saturday 06:00, 12:00 and 18:00 UTC/);
  assert.match(text, /75-second/);
  assert.match(text, /Draws count participation once per bracket pairing/);
  assert.match(text, /latest 52 weekly tournaments/);
  assert.match(text, /only when a ranked result moves you into a higher PvP tier/);
  assert.ok(!/all eight.{0,30}exclusive|claim.{0,20}(?:Clout|tickets)|exclusive skin/i.test(text));
});


test('Collector V2 draft binds the reviewed notes, mail campaign and responsive banner', () => {
  const patch = PREPARED_PATCHES.find(item => item.version === '1.14');
  assert.ok(patch);
  const reviewed = JSON.parse(readFileSync(new URL('../../../../docs/releases/collector-v2-1.14.json', import.meta.url), 'utf8'));
  assert.deepEqual(patch, reviewed);
  assert.equal(patch.softCurrency, 0);
  assert.equal(patch.packTickets, 0);
  assert.ok(patch.buffs.some(line => /BUDDY.*Plant.*Earth/.test(line)));
  assert.ok(patch.changes.some(line => /63/.test(line)));
  const id = `patch_1-14_${createHash('sha256').update(patch.version).digest('hex').slice(0, 16)}`;
  assert.equal(COLLECTOR_V2_MAIL_ID, id);
  const mail = getMailEventPresentation(id);
  const banner = getPatchBanner(patch.version, patch.artCardId);
  assert.ok(mail && banner && 'smallPath' in banner);
  assert.equal(mail.bannerAssetId, banner.path);
  assert.equal(mail.href, '/game/events?patch=1.14');
  for (const path of [banner.path, banner.smallPath]) assert.ok(existsSync(new URL(`../../public/${path}`, import.meta.url)));
  assert.equal(getMailEventPresentation('patch_1-14_wrong'), undefined);
});
