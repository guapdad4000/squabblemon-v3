import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  accountRewardStatus, growthLabStatus, GROWTH_GARDEN_REWARD, LOGIN_REWARDS,
  type AccountRewardGrant,
} from "@workspace/squabblemon-engine/accountRewards";
import { planShopPurchase, type ShopWallet } from "@workspace/squabblemon-engine/economy";
import { checkRecordedLedger, extractCurrentLedgerEvidence, stockzDistribution, ECONOMIC_CLASSIFICATIONS, classifyLedger } from "./economy-current-ledger";

const receipt = (date: string, streak: number): AccountRewardGrant => ({
  key: `login:${date}`, title: "Recorded login", date, streak, ...LOGIN_REWARDS[(streak - 1) % 7],
});

test("canonical full story extraction and manifest match recorded ledger", () => {
  const current = extractCurrentLedgerEvidence();
  const ledger = JSON.parse(readFileSync(new URL("../../docs/economy-audit-current-v1/ledger.json", import.meta.url), "utf8"));
  assert.deepEqual(checkRecordedLedger(ledger, current), []);
  assert.equal(current.storyPerNode.flatMap(chapter => chapter.nodes).length, 209);
  assert.deepEqual(current.computedStoryTotals, {
    chapters: 29, nodes: 209, battles: 101, xp: 14450, softCurrency: 750,
    authoredTickets: 118, perfectTickets: 101, maximumTickets: 219,
  });
  assert.equal(current.starterOwnedIds.length, 24);
  assert.ok(current.sourceManifest.every(entry => /^[a-f0-9]{64}$/.test(entry.sha256)));
});

test("every ledger path and generated story reward has explicit economic classification", () => {
  const ledger = JSON.parse(readFileSync(new URL("../../docs/economy-audit-current-v1/ledger.json", import.meta.url), "utf8"));
  for (const section of ["balances", "earns", "spends", "missionCatalog", "promoCatalog", "collectionRoadCatalog"]) {
    for (const entry of ledger[section]) {
      assert.ok(ECONOMIC_CLASSIFICATIONS.includes(entry.economicClassification), `${section}:${entry.id ?? entry.code}`);
      assert.ok(entry.classificationReason);
      if (section === "spends") assert.ok(entry.repeatLimit);
    }
  }
  for (const chapter of ledger.generatedEvidence.storyPerNode) for (const node of chapter.nodes) {
    for (const reward of [...node.rewards, ...(node.firstPerfectReward ? [node.firstPerfectReward] : [])]) {
      assert.ok(ECONOMIC_CLASSIFICATIONS.includes(reward.economicClassification));
      assert.ok(reward.classificationReason);
    }
  }
  assert.equal(ledger.earns.find((entry: {id: string}) => entry.id === "payment-fulfillment").economicClassification, "mixed/gameplay-reachable");
  assert.deepEqual(ledger.earns.find((entry: {id: string}) => entry.id === "payment-fulfillment").bundles.map((offer: {softCurrency: number}) => offer.softCurrency), [500,1500,4000]);
  assert.equal(ledger.balances.find((entry: {id: string}) => entry.id === "rankPoints").economicClassification, "identity/rank");
  ledger.earns.push({ id: "new-unreviewed-path" });
  assert.throws(() => classifyLedger(ledger), /Unclassified/);
});

test("login claims reset at UTC midnight; missing day resets streak; day eight cycles", () => {
  const created = new Date("2025-01-01T00:00:00Z");
  const seven = receipt("2026-01-07", 7);
  const before = accountRewardStatus(1, created, [seven], new Date("2026-01-07T23:59:59Z"));
  assert.equal(before.claimedToday, true);
  assert.ok(!before.pending.some(reward => reward.key.startsWith("login:")));
  const after = accountRewardStatus(1, created, [seven], new Date("2026-01-08T00:00:00Z"));
  assert.equal(after.streak, 8);
  assert.equal(after.pending.find(reward => reward.key.startsWith("login:"))?.softCurrency, 50);
  assert.equal(after.nextResetAt, "2026-01-09T00:00:00.000Z");
  const missed = accountRewardStatus(1, created, [seven], new Date("2026-01-09T00:00:00Z"));
  assert.equal(missed.streak, 1);
});

test("new-player eligibility expires after seven days and milestone batching is once per key", () => {
  const created = new Date("2026-01-01T00:00:00Z");
  const boundary = accountRewardStatus(20, created, [], new Date("2026-01-08T00:00:00Z"));
  assert.ok(boundary.pending.some(reward => reward.key === "new-player"));
  assert.deepEqual(boundary.pending.filter(reward => reward.key.startsWith("level:")).map(reward => reward.key), ["level:10", "level:20"]);
  assert.ok(!accountRewardStatus(20, created, [], new Date("2026-01-08T00:00:00.001Z")).pending.some(reward => reward.key === "new-player"));
  const replay = accountRewardStatus(20, created, boundary.pending, new Date("2026-01-08T12:00:00Z"));
  assert.equal(replay.pending.length, 0);
});

test("garden needs login and unexpired mission progress, watering is once daily, plants survive gaps", () => {
  const now = new Date("2026-01-10T12:00:00Z");
  const missions = ["daily-show-up", "daily-take-room"].map(missionKey => ({
    missionKey, goal: 1, progress: 1, resetAt: "2026-01-11T00:00:00Z",
  }));
  const receipts = [receipt("2026-01-10", 1), {
    key: "growth:water:2026-01-01", title: "Plant", date: "2026-01-01",
    softCurrency: 0, packTickets: 0, styleShards: 0,
  }];
  assert.equal(growthLabStatus(receipts, missions, now).ready, true);
  assert.equal(growthLabStatus(receipts, missions, now).totalPlants, 1);
  assert.equal(growthLabStatus(receipts.slice(1), missions, now).ready, false);
  assert.equal(growthLabStatus(receipts, missions.map(m => ({ ...m, resetAt: now.toISOString() })), now).ready, false);
  assert.equal(growthLabStatus([...receipts, { ...receipts[1], key: "growth:water:2026-01-10", date: "2026-01-10" }], missions, now).ready, false);
  const sevenPlants = Array.from({ length: 7 }, (_, index) => ({
    ...receipts[1], key: `growth:water:2026-01-0${index + 1}`, date: `2026-01-0${index + 1}`,
  }));
  const grown = growthLabStatus(sevenPlants, [], now);
  assert.equal(grown.completedGardens, 1);
  assert.equal(grown.totalPlants, 7);
  assert.equal(grown.plantsInGarden, 7);
  assert.deepEqual(GROWTH_GARDEN_REWARD, { softCurrency: 350, packTickets: 1, styleShards: 25 });
});

test("Stockz exact two-point net expectation is zero, not gross-income projection", () => {
  for (const stake of [10, 25, 50, 100]) {
    const distribution = stockzDistribution(stake);
    assert.equal(distribution.expectedNet, 0);
    assert.equal(distribution.expectedGross, stake);
    assert.equal(distribution.variance, stake * stake);
    assert.equal(distribution.dailyStartLimit, 5);
  }
  assert.throws(() => stockzDistribution(101), /Unsupported/);
  // Source anchor guards this intentionally small analytic model against payout/RNG drift.
  const source = readFileSync(new URL("../../artifacts/api-server/src/lib/stockz.ts", import.meta.url), "utf8");
  assert.match(source, /randomInt\(2\) \? 1 : -1/);
  assert.match(source, /const payout = won \? bet\.stake \* 2 : 0/);
});

test("shop plan charges only remaining XP and tier shards precede universal", () => {
  const wallet: ShopWallet = {
    softCurrency: 1000, packTickets: 0, styleShards: 100,
    styleShardBalances: { Common: 70 }, deckSlots: 4,
    ownedCardIds: ["cornball"], discoveredCardIds: ["cornball"], ownedVariants: [],
    cardProgression: { cornball: { xp: 4490, level: 9, moveTier: 3 } },
    collectionProgress: 1,
  };
  const trained = planShopPurchase(wallet, { itemId: "training-intensive", cardId: "cornball" });
  assert.equal(trained.receipt.cost, 9);
  assert.equal(trained.wallet.cardProgression.cornball.xp, 4500);
  assert.equal(wallet.softCurrency, 1000);
  const styled = planShopPurchase(wallet, { itemId: "tagged-style", cardId: "cornball" });
  assert.equal(styled.receipt.shardPayment?.matching, 70);
  assert.equal(styled.receipt.shardPayment?.universal, 10);
  assert.equal(styled.wallet.styleShards, 90);
});