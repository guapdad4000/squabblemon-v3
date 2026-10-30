import assert from 'node:assert/strict';
import test from 'node:test';
import { cardCatalog } from '@workspace/squabblemon-engine/data';
import { PULL_BANNERS, ANUNAKI_PULL_BANNER, monthlyAnunakiWindow, nextAnunakiBanner, getPullBannerOccurrence, activeAnunakiBanner } from '@workspace/squabblemon-engine/pullBanners';
import { ANUNAKI_BANNER_WINDOWS } from '@workspace/squabblemon-engine/anunakiBanner';
import { generateStreetPack, generateStreetBatch, anunakiBannerPools, isStreetPackCard } from './collectionEconomy';
const empty = { ownedCardIds: [] as string[], discoveredCardIds: [] as string[], ownedVariants: [] as string[], pity: 0, featuredMisses: 0 };
const banners = [...PULL_BANNERS.slice(1), ANUNAKI_PULL_BANNER];
const poolsFor = (id: string) => id === 'anunaki' ? anunakiBannerPools() : undefined;
test('selected launch and monthly returns have exact inclusive-start exclusive-end boundaries', () => {
  const start = Date.parse('2026-11-02T00:00:00.000Z'), end = Date.parse('2026-11-16T00:00:00.000Z');
  assert.deepEqual(ANUNAKI_BANNER_WINDOWS, [{startsAt:new Date(start).toISOString(),endsAt:new Date(end).toISOString()}]);
  assert.equal(activeAnunakiBanner(start - 1), null);
  assert.equal(activeAnunakiBanner(start)?.occurrenceId, 'anunaki:2026-11-02');
  assert(activeAnunakiBanner(end - 1));
  assert.equal(activeAnunakiBanner(end), null);
  assert.equal(nextAnunakiBanner(end)?.startsAt, '2026-12-07T00:00:00.000Z');
  assert.equal(nextAnunakiBanner(end)?.endsAt, '2026-12-14T00:00:00.000Z');
  assert.equal(activeAnunakiBanner(Date.parse('2026-12-14T00:00:00.000Z')), null);
  assert.equal(nextAnunakiBanner(Date.parse('2026-12-14T00:00:00.000Z'))?.startsAt, '2027-01-04T00:00:00.000Z');
  assert.equal(getPullBannerOccurrence('anunaki:2026-11-02')?.endsAt, new Date(end).toISOString());
});
// Four normal slots consume eight calls; the ninth is the dedicated featured check.
const controlled = (roll: number, selected = 0) => { let call = 0; return (max: number) => { call++; return call === 9 ? roll : call === 10 ? selected % max : 0; }; };
test('all featured families use the same exact slot-five 10% threshold regardless of ownership', () => {
  for (const banner of banners) for (const ownedCardIds of [[], cardCatalog.map(c => c.catalogId)]) for (const [roll, hit] of [[0, true], [999, true], [1000, false], [9999, false]] as const) {
    const result = generateStreetPack({ ...empty, ownedCardIds }, controlled(roll), banner.featuredCardIds, poolsFor(banner.id));
    assert.equal(result.featuredHits?.length, hit ? 1 : 0, `${banner.id}/${roll}`);
    assert(result.rewards.slice(0, 4).every(r => !banner.featuredCardIds.includes(r.cardId ?? '')));
    assert.equal(banner.featuredCardIds.includes(result.rewards[4].cardId ?? ''), hit);
    assert.equal(result.featuredMissesAfter, hit ? 0 : 1);
    assert.equal(result.rewards.length, 6);
  }
});
test('natural featured selection is equal across every roster and does not use rarity or ownership protection', () => {
  for (const banner of banners) for (let selected = 0; selected < banner.featuredCardIds.length; selected++) {
    const result = generateStreetPack(empty, controlled(0, selected), banner.featuredCardIds, poolsFor(banner.id));
    assert.equal(result.rewards[4].cardId, banner.featuredCardIds[selected]);
  }
});
test('nine misses guarantee an unowned fighter and duplicate featured hits retain matching shards', () => {
  const banner = ANUNAKI_PULL_BANNER;
  const ids = banner.featuredCardIds;
  const result = generateStreetPack({ ...empty, ownedCardIds: [...ids.slice(0, -1)], featuredMisses: 9 }, () => 0, ids, anunakiBannerPools());
  assert.equal(result.rewards[4].cardId, ids.at(-1));
  assert.equal(result.featuredHits?.[0].guaranteed, true);
  assert.equal(result.featuredMissesAfter, 0);
  const duplicate = generateStreetPack({ ...empty, ownedCardIds: [...ids], featuredMisses: 9 }, () => 0, ids, anunakiBannerPools());
  assert.equal(duplicate.rewards[4].kind, 'styleShards');
  assert(duplicate.rewards[4].shardRarity);
});
test('single and batched purchases advance identically while the full-ten Rare+ guarantee preserves slot five', () => {
  const ids = PULL_BANNERS[1].featuredCardIds;
  const miss = (max: number) => max === 10000 ? 1000 : 0;
  const state = { ...empty, featuredMisses: 0 };
  const nine = generateStreetBatch(state, 9, miss, ids);
  assert.equal(nine.featuredMissesAfter, 9);
  assert.equal(nine.featuredHits?.length, 0);
  const tenth = generateStreetPack({ ...state, ownedCardIds: nine.ownedCardIds, ownedVariants: nine.ownedVariants, featuredMisses: nine.featuredMissesAfter }, miss, ids);
  const ten = generateStreetBatch(state, 10, miss, ids);
  assert.deepEqual(ten.featuredHits, [{ ...tenth.featuredHits![0], index: 58 }]);
  assert.equal(ten.featuredMissesAfter, tenth.featuredMissesAfter);
  assert.equal(ten.rewards[58].cardId, tenth.rewards[4].cardId);
  assert(ten.rewards.some(r => r.rarity && ['Rare','Epic','Legendary','Mythical'].includes(r.rarity)));
  for (const hit of ten.featuredHits!) assert.equal(ten.rewards[hit.index].cardId, hit.cardId);
});
test('Anunaki monthly occurrences begin first Monday, last seven days, and recover historical identity', () => {
  const launchEnd = Math.max(...ANUNAKI_BANNER_WINDOWS.map(w => Date.parse(w.endsAt)));
  for (let offset = 0; offset < 24; offset++) {
    const date = new Date(launchEnd); date.setUTCMonth(date.getUTCMonth() + offset);
    const candidate = monthlyAnunakiWindow(date.getTime());
    if (!candidate) continue;
    const start = Date.parse(candidate.startsAt), end = Date.parse(candidate.endsAt);
    assert.equal(new Date(start).getUTCDay(), 1);
    assert(new Date(start).getUTCDate() <= 7);
    assert.equal(end - start, 7 * 86400000);
    const banner = activeAnunakiBanner(start)!;
    assert.equal(banner.startsAt, candidate.startsAt);
    assert.deepEqual(getPullBannerOccurrence(banner.occurrenceId), banner);
    assert.equal(activeAnunakiBanner(end), null);
    assert(Date.parse(nextAnunakiBanner(end)!.startsAt!) > end);
  }
  assert.equal(monthlyAnunakiWindow(NaN), null);
  assert.equal(getPullBannerOccurrence('anunaki:2026-12-08'), null);
});

test('every featured normal pool retains all seven authored rarity tiers without its selected roster', () => {
  for (const banner of banners) for (const rarity of ['SuperCommon','Common','Uncommon','Rare','Epic','Legendary','Mythical']) {
    assert(cardCatalog.some(card => card.rarity === rarity && isStreetPackCard(card) && !banner.featuredCardIds.includes(card.catalogId)), `${banner.id}/${rarity}`);
  }
});
test('appending a future authored window preserves an earlier monthly calendar identity', () => {
  const before = monthlyAnunakiWindow(Date.parse('2026-12-07T00:00:00Z'));
  assert(before);
  const after = monthlyAnunakiWindow(Date.parse('2026-12-07T00:00:00Z'), [...ANUNAKI_BANNER_WINDOWS, { startsAt: '2028-01-17T00:00:00.000Z', endsAt: '2028-01-24T00:00:00.000Z' }]);
  assert.deepEqual(after, before);
});
