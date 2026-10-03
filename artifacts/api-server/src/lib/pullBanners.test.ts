import assert from 'node:assert/strict';
import test from 'node:test';
import { cardCatalog } from '@workspace/squabblemon-engine/data';
import { PULL_BANNERS, resolvePullBanner } from "@workspace/squabblemon-engine/pullBanners";
import { choosePackCardFromTier } from '@workspace/squabblemon-engine/packRules';
import { drawGameplayCard, generateStreetTenPull } from './collectionEconomy';

test('banner schedules are fixed, inclusive at start and exclusive at expiry', () => {
  for (const banner of PULL_BANNERS.filter(b => b.startsAt)) {
    assert.throws(() => resolvePullBanner(banner.id, Date.parse(banner.startsAt!) - 1));
    assert.equal(resolvePullBanner(banner.id, Date.parse(banner.startsAt!)).id, banner.id);
    assert.throws(() => resolvePullBanner(banner.id, Date.parse(banner.endsAt!)));
    assert.ok(banner.featuredCardIds.every(id => cardCatalog.some(card => card.catalogId === id)));
  }
  assert.equal(resolvePullBanner(undefined, 0).id, 'standard');
  assert.throws(() => resolvePullBanner('unknown'));
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
