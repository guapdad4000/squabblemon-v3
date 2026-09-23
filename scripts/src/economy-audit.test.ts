import assert from "node:assert/strict";
import test from "node:test";
import { cardCatalog } from "@workspace/squabblemon-engine/data";
import { MISSION_TEMPLATES, WELCOME_REWARD } from "@workspace/squabblemon-engine/economy";
import {
  buildAudit,
  drawRarePlusGuarantee,
  openPack,
  openTenPull,
  RULES,
  seededRandom,
  V1_BASELINE,
} from "./economy-audit";

test("economy audit is deterministic and covers every authored story battle", () => {
  const first = buildAudit(200, 12345);
  const second = buildAudit(200, 12345);
  assert.deepEqual(first, second);
  assert.equal(first.story.v1.battles, 81);
  assert.equal(first.story.v1.totalTicketsWithAllPerfectClears, 181);
  assert.equal(first.story.v2.totalTicketsWithAllPerfectClears, 123);
  assert.equal(first.catalog.starterV1, 21);
  assert.equal(first.catalog.starterV2, 10);
  assert.equal(first.catalog.midCollectionCards, 81);
});

test("v2 guarantee and pacing encode the finalized shared baseline", () => {
  const audit = buildAudit(5_000, 991);
  assert.deepEqual(RULES.v2.matchClout, { win: 80, draw: 60, loss: 40 });
  assert.deepEqual(RULES.v2.coaching, [100, 250, 500]);
  assert.equal(RULES.v2.duplicateShards, 5);
  assert.equal(audit.journeys.v2.matchesPer200CloutPack, 3.23);
  assert.ok(Math.abs(audit.packs.v2.forcedRarePlus.Rare - 80) < 1);
  assert.ok(Math.abs(audit.packs.v2.forcedRarePlus.Epic - 15) < 1);
  assert.ok(Math.abs(audit.packs.v2.forcedRarePlus.Legendary - 4) < 0.5);
  assert.ok(Math.abs(audit.packs.v2.forcedRarePlus.Mythical - 1) < 0.3);
  assert.equal(audit.journeys.v2.firstSession.tickets, 3);
  assert.equal(audit.journeys.v2.sevenDay.tickets, 5);
  assert.equal(audit.journeys.v2.cardXpPacing.cap, 4_500);
  assert.equal(audit.journeys.v2.ticketSpending.firstSession.averageRoadClaims, 3);
});

test("historical fixture is immutable and source-addressed after the audit commit", () => {
  assert.equal(V1_BASELINE.sourceRevision, "e3069d1437f23412743a1811a6d2a9ff9459f4a1");
  assert.equal(V1_BASELINE.sourceBlobs["lib/squabblemon-engine/src/economy.ts"].length, 40);
  assert.equal(V1_BASELINE.starterCardIds.length, 21);
  assert.equal(V1_BASELINE.storyChapters.reduce((sum, chapter) => sum + chapter[4], 0), 100);
  assert.ok(Object.isFrozen(V1_BASELINE));
});

test("journey model consumes finalized welcome and mission exports", () => {
  const audit = buildAudit(100, 44);
  const mission = (key: string) => MISSION_TEMPLATES.find((item) => item.missionKey === key)!.rewardAmount;
  assert.equal(audit.journeys.v2.firstSession.clout,
    WELCOME_REWARD.softCurrency + 2 * 80 + 40 + mission("daily-show-up") + mission("daily-take-room"));
  assert.equal(audit.journeys.v2.sevenDay.tickets,
    WELCOME_REWARD.packTickets + mission("rookie-road") + mission("weekly-main-character") + 1);
});

test("v2 Rare+ guarantee is ownership-independent within the rolled tier", () => {
  const rareCards = cardCatalog.filter((card) => card.rarity === "Rare");
  const owned = new Set([rareCards[0].catalogId]);
  const forced = drawRarePlusGuarantee("v2", owned, () => 0);
  assert.equal(forced.card.catalogId, rareCards[0].catalogId);
  assert.equal(forced.isDuplicate, true);
  assert.ok(rareCards.slice(1).some((card) => !owned.has(card.catalogId)));
});

test("v2 simulator matches runtime pack state and forced replacement accounting", async () => {
  const runtimeModuleUrl = new URL(
    "../../artifacts/api-server/src/lib/collectionEconomy.ts",
    import.meta.url,
  );
  const { generateStreetPack, generateStreetTenPull } = await import(runtimeModuleUrl.href);
  const starter = [...V1_BASELINE.starterCardIds.slice(0, 10)];
  const auditWallet = {
    owned: new Set(starter), variants: new Set<string>(), pity: 0,
    clout: 0, tickets: 0, shards: 0,
  };
  let runtimeState = {
    ownedCardIds: starter, discoveredCardIds: starter,
    ownedVariants: [] as string[], pity: 0,
  };
  const auditRandom = seededRandom(7123);
  const runtimeRandom = seededRandom(7123);
  for (let index = 0; index < 25; index += 1) {
    const audit = openPack("v2", auditWallet, auditRandom);
    const runtime = generateStreetPack(runtimeState, (max: number) => Math.floor(runtimeRandom() * max));
    assert.deepEqual([...auditWallet.owned].sort(), [...runtime.ownedCardIds].sort());
    assert.deepEqual([...auditWallet.variants].sort(), [...runtime.ownedVariants].sort());
    assert.equal(auditWallet.pity, runtime.pityAfter);
    assert.equal(audit.shards, runtime.styleShardsGained);
    assert.equal(audit.clout, runtime.softCurrencyGained);
    runtimeState = {
      ownedCardIds: runtime.ownedCardIds,
      discoveredCardIds: runtime.discoveredCardIds,
      ownedVariants: runtime.ownedVariants,
      pity: runtime.pityAfter,
    };
  }

  const rareCards = cardCatalog.filter((card) => card.rarity === "Rare");
  const forcedStart = [rareCards[0].catalogId];
  const forcedWallet = {
    owned: new Set(forcedStart), variants: new Set<string>(), pity: 0,
    clout: 0, tickets: 0, shards: 0,
  };
  const auditForced = openTenPull("v2", forcedWallet, () => 0);
  const runtimeForced = generateStreetTenPull({
    ownedCardIds: forcedStart,
    discoveredCardIds: forcedStart,
    ownedVariants: [],
    pity: 0,
  }, () => 0);
  const guaranteed = runtimeForced.rewards[runtimeForced.guaranteedRareIndex!];
  assert.equal(guaranteed.cardId, rareCards[0].catalogId);
  assert.equal(guaranteed.kind, "styleShards");
  assert.ok(rareCards.slice(1).some((card) => !forcedWallet.owned.has(card.catalogId)));
  assert.deepEqual([...forcedWallet.owned].sort(), [...runtimeForced.ownedCardIds].sort());
  assert.equal(
    auditForced.reduce((sum, result) => sum + result.shards, 0),
    runtimeForced.styleShardsGained,
  );
  assert.equal(
    auditForced.reduce((sum, result) => sum + result.clout, 0),
    runtimeForced.softCurrencyGained,
  );
  assert.equal(forcedWallet.pity, runtimeForced.pityAfter);
});

test("seeded generator remains stable", () => {
  const random = seededRandom(1);
  assert.deepEqual(
    Array.from({ length: 4 }, () => Number(random().toFixed(8))),
    [0.62707394, 0.00273572, 0.52744704, 0.98105097],
  );
});