import assert from "node:assert/strict";
import test from "node:test";
import { analyticalOdds, buildCurrentAudit, campaignBoundary, COHORTS, journey, packExperiment, rng, styleLifetime, supplementalScenarios } from "./economy-current";
import { cardCatalog, ROOKIE_FOUNDATION_IDS } from "@workspace/squabblemon-engine/data";
import { STREET_PACK_RARITY_WEIGHTS } from "@workspace/squabblemon-engine/packRules";

test("current analytical rarity odds and specific-card protection stay bounded", () => {
  const odds = analyticalOdds();
  assert.ok(Math.abs(odds.naturalRarePlusSingle - (1 - .85 ** 5)) < 1e-12);
  assert.equal(odds.guaranteedRarePlusTen, 1);
  for (const row of Object.values(odds.byTier)) {
    assert.ok(row.count >= 5, "specific-card formula assumes at least five cards per tier");
    assert.ok(row.onlyMissingCardPerPack >= row.specificOwnedCardPerPack);
    assert.ok(row.effectiveTenProbability >= 0 && row.effectiveTenProbability <= 1);
  }
});

test("seeded current runtime audit is reproducible and shards are separate", () => {
  const a = buildCurrentAudit(2, 123, 2);
  const b = buildCurrentAudit(2, 123, 2);
  assert.deepEqual(a, b);
  assert.equal(a.diagnostics.forcedPity.rewards.at(-1)?.kind, "variant");
  assert.equal(a.diagnostics.exhausted.pityAfter, 0);
  assert.equal(a.diagnostics.exhausted.rewards.at(-1)?.kind, "softCurrency");
  assert.equal(a.diagnostics.forcedGuarantee.rewards.length, 60);
  assert.equal(a.diagnostics.forcedGuarantee.rewards[58].rarity, "Rare");
  assert.equal(a.diagnostics.forcedGuarantee.styleShardBalancesGained.Rare, 12);
  assert.equal(a.diagnostics.forcedGuarantee.styleShardsGained, 45);
});

test("zero-progression online does not accidentally earn match or mission XP", () => {
  const online = journey(30, true, "complete", "save", true, 72);
  assert.equal(online.profileXp, 0);
  assert.equal(online.cardXp, 0);
  assert.equal(online.plants, 0);
  assert.ok(online.clout > 0, "check-ins and daily shop remain independently claimable");
  assert.equal(online.ownedCards, COHORTS.complete.length);
});

test("casual missed days break check-in streak and model real participation", () => {
  const casual = journey(7, false, "new", "save", false, 1);
  assert.equal(casual.sessions, 5);
  assert.equal(casual.matches, 10);
  assert.ok(casual.cardXp <= 10 * 30);
  const random = rng(77);
  assert.ok(Array.from({ length: 100 }, () => random(3)).every(n => n >= 0 && n < 3));
});

test("current onboarding and finite campaign are not historical ten-card/123-ticket assumptions", () => {
  assert.equal(COHORTS.new.length, 24);
  assert.deepEqual(COHORTS.new, ROOKIE_FOUNDATION_IDS);
  const boundary = campaignBoundary();
  assert.equal(boundary.chapters, 29);
  assert.equal(boundary.battles, 101);
  assert.equal(boundary.authoredTickets, 118);
  assert.equal(boundary.authoredAndPerfectTickets, 219);
  assert.equal(boundary.accountXp, 14450);
  assert.equal(boundary.byStartingCollection.complete.newCards, 0);
  assert.ok(boundary.byStartingCollection.complete.storyAndStarterDuplicateUniversal >= 25);
});

test("seeded production slots stay within six binomial standard errors and preserve separate shard EV", () => {
  const iterations = 3000;
  const packs = packExperiment(iterations, 918);
  const sample = packs.complete.single;
  for (const [rarity, weight] of Object.entries(STREET_PACK_RARITY_WEIGHTS)) {
    const p = weight / 100;
    const observed = sample.byTier[rarity].effectiveSlotProbability;
    assert.ok(Math.abs(observed - p) < 6 * Math.sqrt(p * (1 - p) / (iterations * 5)), rarity);
  }
  assert.ok(Math.abs(sample.universal.mean - 3) < .5);
  const matchingTotal = Object.values(sample.matching).reduce((s, r) => s + r.mean, 0);
  assert.ok(Math.abs(matchingTotal - 36.6) < 2);
  assert.equal(sample.newCards.mean, 0);
  assert.equal(packs.complete.ten.rarePlusHaulProbability, 1);
});

test("runtime protection never promotes low rarity and forces the only missing rolled-tier card", async () => {
  const url = new URL("../../artifacts/api-server/src/lib/collectionEconomy.ts", import.meta.url);
  const { generateStreetPack } = await import(url.href);
  const missing = cardCatalog.find(c => c.rarity === "Mythical")!;
  const owned = cardCatalog.filter(c => c !== missing).map(c => c.catalogId);
  const state = { ownedCardIds: owned, discoveredCardIds: owned, ownedVariants: [], pity: 0 };
  const low = generateStreetPack(state, () => 0);
  assert.equal(low.ownedCardIds.includes(missing.catalogId), false);
  const high = generateStreetPack(state, (max: number) => max === 10000 ? 9999 : 0);
  assert.equal(high.rewards[0].cardId, missing.catalogId);
  assert.equal(high.rewards[0].kind, "card");
});

test("finite style renewal exhaustion and pity EV are consistent", () => {
  const model = styleLifetime(1000, 191);
  assert.ok(Math.abs(model.exhaustionPacks.mean - model.exactExpectedExhaustionPacks) < model.exactExpectedExhaustionPacks * .01);
  assert.equal(model.tenFromZero.atLeastOneStyleProbability, 1);
  assert.ok(model.tenFromZero.expectedStyles >= 1);
  assert.ok(model.steadyStateBeforeExhaustion.styleProbability > .05);
  assert.ok(model.steadyStateBeforeExhaustion.universalEV < 3);
  assert.equal(model.afterExhaustion.styleProbability, 0);
});

test("paid/promo overlays are isolated and finite campaign tickets use real pack receipts", () => {
  const result = supplementalScenarios(2, 123);
  assert.deepEqual(result.purchased.map(p => [p.offer.clout, p.offer.amountMinor]), [[500, 299], [1500, 799], [4000, 1999]]);
  for (const offer of result.purchased) assert.ok(Math.abs(offer.finalClout.mean - offer.organicClout.mean - offer.cloutAdded) < 1e-8);
  assert.equal(result.promotional.cloutAdded, 60000);
  assert.equal(result.promotional.ticketsAdded, 25);
  assert.equal(result.promotional.universalAdded, 0);
  assert.deepEqual(result.promotional.cardIds, ["kyle", "dragonfly-jones", "sho-nuff", "yasuke", "mansa-musa", "tron", "john-henry", "leroy"]);
  for (const cohort of Object.values(result.finiteCampaignTicketSpending)) {
    assert.equal(cohort.ticketsSpent, 227);
    assert.ok(cohort.metrics.universal.mean >= cohort.finiteDuplicateUniversal + cohort.finiteMilestoneUniversal);
    assert.ok(cohort.metrics.rebate.mean > 0);
  }
  assert.equal(result.finiteCampaignTicketSpending.complete.metrics.newCards.mean, 0);
  assert.equal(result.finiteCampaignTicketSpending.complete.metrics.owned.mean, COHORTS.complete.length);
});