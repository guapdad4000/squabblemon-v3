import assert from 'node:assert/strict';
import test from 'node:test';
import { cardCatalog } from '@workspace/squabblemon-engine/data';
import { PULL_BANNERS, PULL_BANNER_ROTATION_ANCHOR, PULL_BANNER_WEEK_MS, getPullBannerSchedule, getPullBannerOccurrence, isPullBannerActive, pullBannerOddsVersion, pullBannerReceiptIdentity, resolvePullBanner } from "@workspace/squabblemon-engine/pullBanners";
import { choosePackCardFromTier } from '@workspace/squabblemon-engine/packRules';
import { drawGameplayCard, generateStreetTenPull } from './collectionEconomy';

test('weekly rotation uses a fixed Monday UTC anchor with one feature and a continuous next preview', () => {
  const anchor = Date.parse(PULL_BANNER_ROTATION_ANCHOR);
  assert.equal(new Date(anchor).getUTCDay(), 1);
  assert.equal(getPullBannerSchedule(anchor - 1).featured, null);
  assert.equal(getPullBannerSchedule(anchor - 1).next.occurrenceId, 'inmates:2026-10-19');
  assert.equal(resolvePullBanner(undefined, 0).id, 'standard');
  const ids = ['inmates', 'oz', 'wonderland', 'red-blue'];
  // Covers recurrence, UTC year boundaries, and both daylight saving changes.
  for (let week = 0; week < 104; week++) {
    const start = anchor + week * PULL_BANNER_WEEK_MS;
    const end = start + PULL_BANNER_WEEK_MS;
    const schedule = getPullBannerSchedule(start);
    assert.equal(schedule.featured?.id, ids[week % 4]);
    assert.equal(Date.parse(schedule.featured!.endsAt!), end);
    assert.equal(schedule.next.id, ids[(week + 1) % 4]);
    assert.equal(schedule.next.startsAt, schedule.featured?.endsAt);
    for (const now of [start, end - 1]) {
      assert.equal(PULL_BANNERS.filter(b => b.id !== 'standard' && isPullBannerActive(b, now)).length, 1);
      assert.equal(resolvePullBanner(schedule.featured!.id, now, schedule.featured!.occurrenceId!).occurrenceId, schedule.featured!.occurrenceId);
    }
    assert.throws(() => resolvePullBanner(schedule.featured!.id, start - 1, schedule.featured!.occurrenceId!));
    assert.throws(() => resolvePullBanner(schedule.featured!.id, end, schedule.featured!.occurrenceId!));
    assert.deepEqual(getPullBannerSchedule(end).featured, schedule.next);
    assert.deepEqual(getPullBannerOccurrence(schedule.featured!.occurrenceId), schedule.featured);
    assert.ok(schedule.featured!.featuredCardIds.every(id => cardCatalog.some(card => card.catalogId === id)));
  }
  assert.throws(() => resolvePullBanner('unknown'));
});

test('an occurrence cannot be substituted, revived four weeks later, or attached to Standard', () => {
  const anchor = Date.parse(PULL_BANNER_ROTATION_ANCHOR);
  assert.throws(() => resolvePullBanner('inmates', anchor, 'oz:2026-10-19'));
  assert.throws(() => resolvePullBanner('inmates', anchor + 4 * PULL_BANNER_WEEK_MS, 'inmates:2026-10-19'));
  assert.equal(resolvePullBanner('inmates', anchor + 4 * PULL_BANNER_WEEK_MS).occurrenceId, 'inmates:2026-11-16');
  assert.throws(() => resolvePullBanner('standard', anchor, 'inmates:2026-10-19'));
  for (const value of ['inmates:2026-10-20', 'inmates:2026-02-31', 'oz:2026-10-19', 'inmates:2026-10-12', 'bad']) {
    assert.equal(getPullBannerOccurrence(value), null);
  }
});

test('receipt metadata preserves the week and reads existing v1 banner receipts', () => {
  const banner = resolvePullBanner('red-blue', Date.parse('2026-11-09T00:00:00Z'));
  const version = pullBannerOddsVersion('street-pack-ten-v3', banner);
  assert.equal(version, 'street-pack-ten-v3:banner-red-blue-v1:week-2026-11-09');
  assert.deepEqual(pullBannerReceiptIdentity(version), { bannerId: 'red-blue', occurrenceId: 'red-blue:2026-11-09' });
  assert.deepEqual(pullBannerReceiptIdentity('street-pack-v7:banner-red-blue-v1'), { bannerId: 'red-blue' });
  assert.deepEqual(pullBannerReceiptIdentity('street-pack-v7'), { bannerId: 'standard' });
  assert.equal(pullBannerOddsVersion('street-pack-v7', resolvePullBanner()), 'street-pack-v7');
});

test('featured weight is exactly 3:2, after protection and repeat exclusion', () => {
  const tier = [{ catalogId: 'featured' }, { catalogId: 'ordinary' }];
  const counts = { featured: 0, ordinary: 0 };
  for (let roll = 0; roll < 5; roll++) {
    const card = choosePackCardFromTier({ rarity: 'Rare', tier, pulledCardIds: new Set(), ownedCardIds: new Set(), protectNew: false, featuredCardIds: ['featured'], rng: max => { assert.equal(max, 5); return roll; } });
    counts[card.catalogId as keyof typeof counts]++;
  }
  assert.deepEqual(counts, { featured: 3, ordinary: 2 });
  for (const protectNew of [true, false]) {
    const card = choosePackCardFromTier({ rarity: 'Rare', tier, pulledCardIds: new Set(protectNew ? [] : ['featured']), ownedCardIds: new Set(['featured']), protectNew, featuredCardIds: ['featured'], rng: () => 0 });
    assert.equal(card.catalogId, 'ordinary');
  }
});

test('focus cannot promote the independently rolled rarity', () => {
  for (const banner of PULL_BANNERS) for (const roll of [0, 4000, 6000, 8500, 9700, 9900, 9980]) {
    const draw = (featuredCardIds: readonly string[]) => {
      let calls = 0;
      return drawGameplayCard({ pulledCardIds: new Set(), ownedCardIds: new Set(), protectNew: true, featuredCardIds, rng: () => calls++ === 0 ? roll : 0 });
    };
    assert.equal(draw(banner.featuredCardIds).rarity, draw([]).rarity);
  }
});

test('focused ten pull preserves rewards and Rare+ guarantee', () => {
  for (const banner of PULL_BANNERS) {
    const result = generateStreetTenPull({ ownedCardIds: [], discoveredCardIds: [], ownedVariants: [], pity: 0 }, () => 0, banner.featuredCardIds);
    assert.equal(result.rewards.length, 60);
    assert.ok(result.rewards.some(r => r.kind === 'card' && ['Rare','Epic','Legendary','Mythical'].includes(r.rarity!)));
  }
});
