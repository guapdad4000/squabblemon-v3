import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { and, count, eq } from "drizzle-orm";
import {
  db,
  playerMatchesTable,
  playerProfilesTable,
  playerStoryActionsTable,
  playerStoryNodesTable,
  playerStoryRewardClaimsTable,
} from "@workspace/db";
import {
  blockPartyChapter,
  getStoryBattle,
  storyContent,
  storySeasons,
} from "@workspace/squabblemon-engine/story";
import {
  createStoryMatch,
  verifyStoryMatchTranscript,
} from "@workspace/squabblemon-engine/gameEngine";
import {
  catalogCardByEngineId,
  starterRecipes,
} from "@workspace/squabblemon-engine/data";
import { getPlayerStoryCampaign, StoryRequestError } from "./storyService";
import { getStoredStoryMatchResult } from "./storyMatchResult";
import {
  createStoryMatchProgressionSnapshot,
  parseStoryMatchProgressionSnapshot,
} from "./storyMatchSnapshot";
import {
  completeNonBattleStoryNode,
  grantStoryTicketAward,
  grantStoryRewards,
  getPlayerStoryCampaignWithPayoutCatchUp,
  isDevelopmentStoryResetEnabled,
  saveStoryDialogue,
} from "./storyTransactions";

async function storyPlayer(t: test.TestContext, prefix: string) {
  const clerkUserId = `${prefix}-${randomUUID()}`;
  await db.insert(playerProfilesTable).values({
    clerkUserId,
    onboardingStep: "complete",
  });
  t.after(async () => {
    await db
      .delete(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  });
  return clerkUserId;
}
const requiredBeforeCrown = [
  "welcome-to-the-block",
  "blue-side-pressure",
  "receipts-on-camera",
  "red-side-retaliation",
  "snitch-at-the-corner",
  "cracked-head-takes-the-block",
];
async function unlockCrown(userId: string) {
  await db.insert(playerStoryNodesTable).values(requiredBeforeCrown.map((nodeId) => ({
    clerkUserId: userId, chapterId: "block-party", nodeId, cleared: true,
  })));
}

test("story nodes persist normalized progress and merged dialogue", async (t) => {
  const userId = await storyPlayer(t, "story-dialogue");
  await unlockCrown(userId);
  const first = await completeNonBattleStoryNode(
    userId,
    "block-crowned",
    randomUUID(),
    ["line-1"],
  );
  const retry = await completeNonBattleStoryNode(
    userId,
    "block-crowned",
    randomUUID(),
    ["line-1", "line-2"],
  );
  assert.equal(first.alreadyCompleted, false);
  assert.equal(retry.alreadyCompleted, true);

  const [row] = await db
    .select()
    .from(playerStoryNodesTable)
    .where(and(eq(playerStoryNodesTable.clerkUserId, userId), eq(playerStoryNodesTable.nodeId, "block-crowned")));
  assert.equal(row.cleared, true);
  assert.equal(row.attempts, 1);
  assert.deepEqual(row.dialogueSeen, ["line-1", "line-2"]);
  const campaign = await getPlayerStoryCampaign(userId);
  assert.equal(campaign.recommendedNodeId, "red-tapes-open-the-envelope");
});

test("Chapter Two opens after the Crown and hands off to Chapter Three", async (t) => {
  const userId = await storyPlayer(t, "story-chapter-two");
  await unlockCrown(userId);
  await completeNonBattleStoryNode(userId, "block-crowned", randomUUID(), []);
  const opening = await completeNonBattleStoryNode(
    userId, "red-tapes-open-the-envelope", randomUUID(), [],
  );
  assert.equal(opening.alreadyCompleted, false);
  const chapter = storyContent.chapters.find((item) => item.id === "red-side-tapes")!;
  await db.insert(playerStoryNodesTable).values(chapter.nodes
    .filter((node) => !node.optional && node.id !== "red-tapes-open-the-envelope" && node.id !== "red-tapes-let-her-grieve")
    .map((node) => ({ clerkUserId: userId, chapterId: chapter.id, nodeId: node.id, cleared: true })));
  const ending = await completeNonBattleStoryNode(userId, "red-tapes-let-her-grieve", randomUUID(), []);
  assert.equal(ending.alreadyCompleted, false);
  assert.deepEqual(ending.rewards.map((reward) => reward.id).sort(), ["baby", "clout", "story-key:chapter-three", "street-pack-ticket"]);
  const campaign = await getPlayerStoryCampaign(userId);
  assert.equal(campaign.chapters.find((item) => item.id === "blue-side-blues")?.status, "available");
  assert.equal(campaign.recommendedNodeId, "blue-in-denial");
  const retry = await completeNonBattleStoryNode(userId, "red-tapes-let-her-grieve", randomUUID(), []);
  assert.equal(retry.alreadyCompleted, true);
  assert.deepEqual(retry.rewards, []);
});

test("Courier Table separates a legacy perfect ticket from its direct-clear payout", async (t) => {
  const userId = await storyPlayer(t, "story-courier-migration");
  await unlockCrown(userId);
  await completeNonBattleStoryNode(userId, "block-crowned", randomUUID(), []);
  await completeNonBattleStoryNode(userId, "red-tapes-open-the-envelope", randomUUID(), []);
  await db.insert(playerStoryNodesTable).values([
    { clerkUserId: userId, chapterId: "red-side-tapes", nodeId: "red-tapes-red-side-open", cleared: true },
    { clerkUserId: userId, chapterId: "red-side-tapes", nodeId: "red-tapes-courier-table", cleared: true, stars: 3 },
  ]);
  const [profile] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userId));
  await db.update(playerProfilesTable).set({ xp: profile.xp + 75, packTickets: profile.packTickets + 1 })
    .where(eq(playerProfilesTable.clerkUserId, userId));
  await db.insert(playerStoryRewardClaimsTable).values([
    {
      clerkUserId: userId,
      chapterId: "red-side-tapes",
      nodeId: "red-tapes-courier-table",
      rewardKey: "red-tapes-courier-table:0:currency:street-xp",
      reward: { kind: "currency", id: "street-xp", amount: 75 },
    },
    {
      clerkUserId: userId,
      chapterId: "red-side-tapes",
      nodeId: "red-tapes-courier-table",
      rewardKey: "red-tapes-courier-table:stars:3:auto-ticket:v1",
      reward: { kind: "pack-ticket", id: "street-pack-ticket", amount: 1 },
    },
  ]);
  const before = (await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userId)))[0];
  const result = await completeNonBattleStoryNode(userId, "red-tapes-courier-table", randomUUID(), []);
  const after = (await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userId)))[0];
  assert.equal(result.alreadyCompleted, true);
  assert.deepEqual(
    result.rewards.map((reward) => [reward.kind, reward.amount]).sort(),
    [["currency", 100], ["pack-ticket", 1]].sort(),
  );
  assert.ok(result.rewards.every((reward) => reward.rewardKey.startsWith("story-payout-make-good:v1:")));
  assert.equal(after.xp, before.xp);
  assert.equal(after.packTickets, before.packTickets + 1);
  assert.equal(after.softCurrency, before.softCurrency + 100);
  const [claims] = await db.select({ value: count() }).from(playerStoryRewardClaimsTable)
    .where(and(eq(playerStoryRewardClaimsTable.clerkUserId, userId), eq(playerStoryRewardClaimsTable.nodeId, "red-tapes-courier-table")));
  assert.equal(claims.value, 4);
});
test("story campaign GET backfills the lower-star Courier ticket once with confirmed bootstrap", async (t) => {
  const userId = await storyPlayer(t, "story-courier-lower-star-migration");
  await db.insert(playerStoryNodesTable).values({
    clerkUserId: userId,
    chapterId: "red-side-tapes",
    nodeId: "red-tapes-courier-table",
    cleared: true,
    stars: 2,
  });
  const [legacyProfile] = await db
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, userId));
  await db
    .update(playerProfilesTable)
    .set({ xp: legacyProfile.xp + 75 })
    .where(eq(playerProfilesTable.clerkUserId, userId));
  await db.insert(playerStoryRewardClaimsTable).values({
    clerkUserId: userId,
    chapterId: "red-side-tapes",
    nodeId: "red-tapes-courier-table",
    rewardKey: "red-tapes-courier-table:0:currency:street-xp",
    reward: { kind: "currency", id: "street-xp", amount: 75 },
  });

  const [before] = await db
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, userId));
  const passiveCampaign = await getPlayerStoryCampaign(userId);
  const [afterPassiveRead] = await db
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, userId));
  assert.equal(
    passiveCampaign.nodes.find((node) => node.nodeId === "red-tapes-courier-table")?.cleared,
    true,
  );
  assert.equal(afterPassiveRead.packTickets, before.packTickets);
  const firstCampaign = await getPlayerStoryCampaignWithPayoutCatchUp(userId);
  const secondCampaign = await getPlayerStoryCampaignWithPayoutCatchUp(userId);
  const [afterLoads] = await db
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, userId));

  assert.equal(
    firstCampaign.nodes.find((node) => node.nodeId === "red-tapes-courier-table")?.cleared,
    true,
  );
  assert.equal(secondCampaign.contentVersion, firstCampaign.contentVersion);
  assert.equal(afterLoads.xp, before.xp);
  assert.equal(afterLoads.packTickets, before.packTickets + 1);
  assert.equal(afterLoads.softCurrency, before.softCurrency + 100);
  assert.deepEqual(
    firstCampaign.catchUp?.rewards.map((reward) => [reward.kind, reward.amount]).sort(),
    [["currency", 100], ["pack-ticket", 1]].sort(),
  );
  assert.equal(
    firstCampaign.catchUp?.bootstrap.profile.packTickets,
    afterLoads.packTickets,
  );
  assert.equal(
    firstCampaign.catchUp?.bootstrap.profile.softCurrency,
    afterLoads.softCurrency,
  );
  assert.equal(secondCampaign.catchUp, undefined);
  const claims = await db
    .select()
    .from(playerStoryRewardClaimsTable)
    .where(
      and(
        eq(playerStoryRewardClaimsTable.clerkUserId, userId),
        eq(playerStoryRewardClaimsTable.nodeId, "red-tapes-courier-table"),
      ),
    );

  assert.deepEqual(
    claims.map((claim) => claim.rewardKey).sort(),
    [
      "red-tapes-courier-table:0:currency:street-xp",
      "story-payout-make-good:v1:red-tapes-courier-table:clout",
      "story-payout-make-good:v1:red-tapes-courier-table:tickets",
    ],
  );
});

test("story-earned cards are delivered on first clear and replayed idempotently", async (t) => {
  const userId = await storyPlayer(t, "story-card-first-clear");
  const historicalSnapshotRewards = [
    { kind: "currency" as const, id: "street-xp", amount: 50 },
  ];

  const first = await db.transaction((tx) =>
    grantStoryRewards(
      tx,
      userId,
      "block-party",
      "welcome-to-the-block",
      historicalSnapshotRewards,
    ),
  );
  const replay = await db.transaction((tx) =>
    grantStoryRewards(
      tx,
      userId,
      "block-party",
      "welcome-to-the-block",
      historicalSnapshotRewards,
    ),
  );
  const [profile] = await db
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, userId));
  const blueCard = catalogCardByEngineId["ganger-blue"];

  assert.ok(first.some((reward) =>
    reward.kind === "card" &&
    reward.id === "ganger-blue" &&
    reward.rewardKey === "story-card-reward:v1:welcome-to-the-block:ganger-blue",
  ));
  assert.deepEqual(replay, []);
  assert.deepEqual(historicalSnapshotRewards, [
    { kind: "currency", id: "street-xp", amount: 50 },
  ]);
  assert.ok(profile.ownedCardIds.includes(blueCard.catalogId));
  assert.ok(profile.discoveredCardIds.includes(blueCard.catalogId));
});

test("authenticated campaign entry catches up earned cards without replaying money", async (t) => {
  const userId = await storyPlayer(t, "story-card-legacy-catchup");
  const legacyClearedIds = [...requiredBeforeCrown, "block-crowned"];
  await db.insert(playerStoryNodesTable).values(
    legacyClearedIds.map((nodeId) => ({
      clerkUserId: userId,
      chapterId: "block-party",
      nodeId,
      cleared: true,
    })),
  );

  // Legacy monetary receipts already exist. The card contract uses its own
  // stable claim-key namespace and must not alter any historical money total.
  const legacyPayoutClaims = legacyClearedIds.flatMap((nodeId) => {
    const node = storyContent.chapters
      .flatMap((chapter) => chapter.nodes)
      .find((item) => item.id === nodeId)!;
    const clout = node.rewards
      .filter((reward) => reward.kind === "currency" && reward.id === "clout")
      .reduce((sum, reward) => sum + reward.amount, 0);
    const tickets = node.rewards
      .filter((reward) => reward.kind === "pack-ticket" && reward.id === "street-pack-ticket")
      .reduce((sum, reward) => sum + reward.amount, 0);
    return [
      ...(clout ? [{
        clerkUserId: userId,
        chapterId: "block-party",
        nodeId,
        rewardKey: `legacy-story-currency:v1:${nodeId}`,
        reward: { kind: "currency" as const, id: "clout", amount: clout },
      }] : []),
      ...(tickets ? [{
        clerkUserId: userId,
        chapterId: "block-party",
        nodeId,
        rewardKey: `legacy-story-tickets:v1:${nodeId}`,
        reward: { kind: "pack-ticket" as const, id: "street-pack-ticket", amount: tickets },
      }] : []),
    ];
  });
  await db.insert(playerStoryRewardClaimsTable).values(legacyPayoutClaims);
  const [before] = await db
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, userId));

  const mutationRetry = await completeNonBattleStoryNode(
    userId,
    "block-crowned",
    randomUUID(),
    [],
  );
  assert.equal(mutationRetry.alreadyCompleted, true);
  const claimsBeforeCampaignEntry = await db
    .select()
    .from(playerStoryRewardClaimsTable)
    .where(eq(playerStoryRewardClaimsTable.clerkUserId, userId));
  assert.equal(
    claimsBeforeCampaignEntry.some((claim) => claim.reward.kind === "card"),
    false,
  );

  const firstCampaign = await getPlayerStoryCampaignWithPayoutCatchUp(userId);
  const secondCampaign = await getPlayerStoryCampaignWithPayoutCatchUp(userId);
  const [after] = await db
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, userId));
  const earnedCardIds = ["ganger-blue", "ganger-red", "snitch", "cracked-head"];
  const expectedCatalogIds = earnedCardIds.map(
    (id) => catalogCardByEngineId[id].catalogId,
  );

  assert.deepEqual(
    firstCampaign.catchUp?.rewards
      .filter((reward) => reward.kind === "card")
      .map((reward) => reward.id)
      .sort(),
    [...earnedCardIds].sort(),
  );
  assert.equal(firstCampaign.catchUp?.rewards.length, earnedCardIds.length);
  assert.equal(secondCampaign.catchUp, undefined);
  assert.equal(after.xp, before.xp);
  assert.equal(after.softCurrency, before.softCurrency);
  assert.equal(after.packTickets, before.packTickets);
  for (const cardId of expectedCatalogIds) {
    assert.ok(after.ownedCardIds.includes(cardId));
    assert.ok(after.discoveredCardIds.includes(cardId));
  }
  const claims = await db
    .select()
    .from(playerStoryRewardClaimsTable)
    .where(eq(playerStoryRewardClaimsTable.clerkUserId, userId));
  assert.deepEqual(
    claims
      .filter((claim) => claim.reward.kind === "card")
      .map((claim) => claim.rewardKey)
      .sort(),
    [
      "story-card-reward:v1:welcome-to-the-block:ganger-blue",
      "story-card-reward:v1:receipts-on-camera:ganger-red",
      "story-card-reward:v1:snitch-at-the-corner:snitch",
      "story-card-reward:v1:block-crowned:cracked-head",
    ].sort(),
  );
});

test("campaign catch-up does not grant cards for uncleared story nodes", async (t) => {
  const userId = await storyPlayer(t, "story-card-unearned");
  const campaign = await getPlayerStoryCampaignWithPayoutCatchUp(userId);
  const [profile] = await db
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, userId));
  const cardClaims = await db
    .select()
    .from(playerStoryRewardClaimsTable)
    .where(eq(playerStoryRewardClaimsTable.clerkUserId, userId));

  assert.equal(campaign.catchUp, undefined);
  assert.deepEqual(cardClaims, []);
  assert.equal(profile.ownedCardIds.includes(catalogCardByEngineId["ganger-blue"].catalogId), false);
  await assert.rejects(
    () => completeNonBattleStoryNode(userId, "block-crowned", randomUUID(), []),
    (error) => error instanceof StoryRequestError && error.status === 409,
  );
});

test("concurrent story campaign GETs reconcile all cleared nodes once and exclude perfect tickets", async (t) => {
  const userId = await storyPlayer(t, "story-campaign-payout-race");
  await db.insert(playerStoryNodesTable).values([
    {
      clerkUserId: userId,
      chapterId: "block-party",
      nodeId: "welcome-to-the-block",
      cleared: true,
      stars: 3,
    },
    {
      clerkUserId: userId,
      chapterId: "block-party",
      nodeId: "blue-side-pressure",
      cleared: true,
      stars: 1,
    },
  ]);
  await db
    .update(playerProfilesTable)
    .set({ softCurrency: 30, packTickets: 1 })
    .where(eq(playerProfilesTable.clerkUserId, userId));
  await db.insert(playerStoryRewardClaimsTable).values([
    {
      clerkUserId: userId,
      chapterId: "block-party",
      nodeId: "welcome-to-the-block",
      rewardKey: "welcome-to-the-block:legacy-clout",
      reward: { kind: "currency", id: "clout", amount: 30 },
    },
    {
      clerkUserId: userId,
      chapterId: "block-party",
      nodeId: "welcome-to-the-block",
      rewardKey: "welcome-to-the-block:stars:3:auto-ticket:v1",
      reward: { kind: "pack-ticket", id: "street-pack-ticket", amount: 1 },
    },
  ]);

  const responses = await Promise.all([
    getPlayerStoryCampaignWithPayoutCatchUp(userId),
    getPlayerStoryCampaignWithPayoutCatchUp(userId),
  ]);
  const acknowledgements = responses.filter((response) => response.catchUp);
  assert.equal(acknowledgements.length, 1);
  const acknowledgement = acknowledgements[0].catchUp!;
  assert.deepEqual(
    acknowledgement.rewards
      .map((reward) => [reward.id, reward.amount])
      .sort(),
    [
      ["clout", 70],
      ["clout", 100],
      ["ganger-blue", 1],
      ["street-pack-ticket", 1],
      ["street-pack-ticket", 1],
    ].sort(),
  );
  assert.ok(
    acknowledgement.rewards.every((reward) =>
      reward.kind === "card"
        ? reward.rewardKey === "story-card-reward:v1:welcome-to-the-block:ganger-blue"
        : reward.rewardKey.startsWith("story-payout-make-good:v1:"),
    ),
  );
  assert.equal(acknowledgement.bootstrap.profile.softCurrency, 200);
  assert.equal(acknowledgement.bootstrap.profile.packTickets, 3);
  const [profile] = await db
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, userId));
  assert.equal(profile.softCurrency, 200);
  assert.equal(profile.packTickets, 3);
  const claims = await db
    .select()
    .from(playerStoryRewardClaimsTable)
    .where(eq(playerStoryRewardClaimsTable.clerkUserId, userId));
  assert.equal(
    claims.filter((claim) =>
      claim.rewardKey.startsWith("story-payout-make-good:v1:"),
    ).length,
    4,
  );
});

test("all eight chapters unlock in order and the final reward is claimed once", async (t) => {
  const userId = await storyPlayer(t, "story-season-one");
  const seasonOne = storySeasons.find((season) => season.id === "season-1");
  assert.ok(seasonOne);
  const seasonOneChapters = seasonOne.chapterIds.map((chapterId) => {
    const chapter = storyContent.chapters.find((item) => item.id === chapterId);
    assert.ok(chapter, chapterId);
    return chapter;
  });
  assert.equal(seasonOneChapters.length, 8);
  for (const [index, chapter] of seasonOneChapters.entries()) {
    const openingCampaign = await getPlayerStoryCampaign(userId);
    assert.equal(openingCampaign.chapters.find((item) => item.id === chapter.id)?.status, "available", chapter.id);
    const ending = chapter.nodes.find((node) => node.kind === "reward" && !node.optional);
    assert.ok(ending, `${chapter.id} needs a required finale`);
    await db.insert(playerStoryNodesTable).values(chapter.nodes
      .filter((node) => !node.optional && node.id !== ending.id)
      .map((node) => ({ clerkUserId: userId, chapterId: chapter.id, nodeId: node.id, cleared: true })));
    const result = await completeNonBattleStoryNode(userId, ending.id, randomUUID(), []);
    assert.equal(result.alreadyCompleted, false, chapter.id);
    const after = await getPlayerStoryCampaign(userId);
    assert.equal(after.chapters.find((item) => item.id === chapter.id)?.status, "cleared", chapter.id);
    if (index + 1 < seasonOneChapters.length) {
      const next = seasonOneChapters[index + 1];
      assert.equal(after.chapters.find((item) => item.id === next.id)?.status, "available", next.id);
      assert.equal(after.recommendedNodeId, next.nodes.find((node) => !node.optional)?.id, next.id);
    } else {
      const seasonOneNodeIds = new Set(
        seasonOneChapters.flatMap((item) => item.nodes.map((node) => node.id)),
      );
      assert.ok(
        after.nodes
          .filter((node) => seasonOneNodeIds.has(node.nodeId) && !node.optional)
          .every((node) => node.status === "cleared"),
      );
      assert.deepEqual(result.rewards.map((reward) => reward.id).sort(), ["clout", "cracked-head", "street-pack-ticket", "street-xp"]);
      const retry = await completeNonBattleStoryNode(userId, ending.id, randomUUID(), []);
      assert.equal(retry.alreadyCompleted, true);
      assert.deepEqual(retry.rewards, []);
    }
  }
});

test("every exported story node meets the direct-clear payout contract", () => {
  for (const chapter of [...storyContent.chapters, blockPartyChapter]) {
    const finale = [...chapter.nodes].reverse().find((node) => !node.optional);
    assert.ok(finale, `${chapter.id} has no required finale`);
    for (const node of chapter.nodes) {
      const clout = node.rewards
        .filter((reward) => reward.kind === "currency" && reward.id === "clout")
        .reduce((sum, reward) => sum + reward.amount, 0);
      const tickets = node.rewards
        .filter((reward) => reward.kind === "pack-ticket" && reward.id === "street-pack-ticket")
        .reduce((sum, reward) => sum + reward.amount, 0);
      assert.ok(clout >= 100, `${chapter.id}/${node.id} must award at least 100 Clout`);
      assert.ok(tickets >= 1, `${chapter.id}/${node.id} must award a direct ticket`);
      if (node.kind === "battle" && ["boss", "mini-boss"].includes(node.battleType)) {
        assert.ok(clout >= 200, `${chapter.id}/${node.id} boss Clout`);
      }
      if (node.id === finale.id) {
        assert.ok(clout >= 250, `${chapter.id}/${node.id} finale Clout`);
        assert.equal(tickets, 10, `${chapter.id}/${node.id} finale direct tickets`);
      }
    }
  }
  const blockCrowned = storyContent.chapters
    .flatMap((chapter) => chapter.nodes)
    .find((node) => node.id === "block-crowned")!;
  assert.equal(
    blockCrowned.rewards
      .filter((reward) => reward.kind === "currency" && reward.id === "clout")
      .reduce((sum, reward) => sum + reward.amount, 0),
    250,
  );
  assert.equal(
    blockCrowned.rewards
      .filter((reward) => reward.kind === "pack-ticket")
      .reduce((sum, reward) => sum + reward.amount, 0),
    10,
  );
  assert.ok(blockCrowned.rewards.some((reward) => reward.kind === "card" && reward.id === "nerd"));
});

test("completed nodes return only one-time Clout and direct-ticket make-good rewards", async (t) => {
  const userId = await storyPlayer(t, "story-payout-make-good");
  await unlockCrown(userId);
  await db.insert(playerStoryNodesTable).values({
    clerkUserId: userId,
    chapterId: "block-party",
    nodeId: "block-crowned",
    cleared: true,
  });
  await db.insert(playerStoryRewardClaimsTable).values([
    {
      clerkUserId: userId,
      chapterId: "block-party",
      nodeId: "block-crowned",
      rewardKey: "dr-fade-training:chapter-one:v1",
      reward: { kind: "currency", id: "clout", amount: 50 },
    },
    {
      clerkUserId: userId,
      chapterId: "block-party",
      nodeId: "block-crowned",
      rewardKey: "block-crowned:legacy-ticket",
      reward: { kind: "pack-ticket", id: "street-pack-ticket", amount: 2 },
    },
  ]);
  const first = await completeNonBattleStoryNode(
    userId,
    "block-crowned",
    "payout-make-good-once",
    [],
  );
  assert.equal(first.alreadyCompleted, true);
  assert.deepEqual(
    first.rewards.map((reward) => [reward.kind, reward.amount]).sort(),
    [["currency", 200], ["pack-ticket", 8]].sort(),
  );
  assert.ok(
    first.rewards.every((reward) =>
      reward.rewardKey.startsWith("story-payout-make-good:v1:"),
    ),
  );
  const replay = await completeNonBattleStoryNode(
    userId,
    "block-crowned",
    "payout-make-good-once",
    [],
  );
  assert.equal(replay.alreadyCompleted, true);
  assert.deepEqual(replay.rewards, []);
  const checkAgain = await completeNonBattleStoryNode(
    userId,
    "block-crowned",
    "payout-make-good-check-again",
    [],
  );
  assert.deepEqual(checkAgain.rewards, []);
  const [profile] = await db
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, userId));
  assert.equal(profile.softCurrency, 200);
  assert.equal(profile.packTickets, 8);
});

test("concurrent completed-node checks make-good each historical payout gap once", async (t) => {
  const userId = await storyPlayer(t, "story-payout-concurrent");
  await unlockCrown(userId);
  await db.insert(playerStoryNodesTable).values({
    clerkUserId: userId,
    chapterId: "block-party",
    nodeId: "block-crowned",
    cleared: true,
  });
  const results = await Promise.all([
    completeNonBattleStoryNode(userId, "block-crowned", "payout-race-a", []),
    completeNonBattleStoryNode(userId, "block-crowned", "payout-race-b", []),
  ]);
  assert.deepEqual(
    results.map((result) =>
      result.rewards
        .filter((reward) => reward.kind !== "card")
        .reduce((sum, reward) => sum + reward.amount, 0),
    ).sort(),
    [0, 260],
  );
  const [profile] = await db
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, userId));
  assert.equal(profile.softCurrency, 250);
  assert.equal(profile.packTickets, 10);
});

test("server registry prerequisites reject out-of-order completion", async (t) => {
  const userId = await storyPlayer(t, "story-locked");
  await assert.rejects(
    () =>
      completeNonBattleStoryNode(
        userId,
        "block-crowned",
        randomUUID(),
        ["scene"],
      ),
    (error) =>
      error instanceof StoryRequestError &&
      error.status === 409 &&
      error.message.includes("locked"),
  );
});

test("optional Side Alley never gates required completion or recommendation", async (t) => {
  const userId = await storyPlayer(t, "story-optional");
  await db.insert(playerStoryNodesTable).values([
    { clerkUserId: userId, chapterId: "block-party", nodeId: "welcome-to-the-block", cleared: true },
    { clerkUserId: userId, chapterId: "block-party", nodeId: "blue-side-pressure", cleared: true },
  ]);
  const campaign = await getPlayerStoryCampaign(userId);
  const receipts = campaign.nodes.find((node) => node.nodeId === "receipts-on-camera");
  const alley = campaign.nodes.find((node) => node.nodeId === "side-alley-challenge");
  assert.equal(receipts?.status, "available");
  assert.equal(alley?.status, "available");
  assert.equal(campaign.recommendedNodeId, "receipts-on-camera");
  assert.equal(campaign.chapters[0].completedRequiredNodes, 2);
  assert.equal(campaign.chapters[0].totalRequiredNodes, 7);
});

test("development story reset guard is disabled outside development", () => {
  assert.equal(isDevelopmentStoryResetEnabled("production"), false);
  assert.equal(isDevelopmentStoryResetEnabled("test"), false);
  assert.equal(isDevelopmentStoryResetEnabled("development"), true);
});

test("concurrent story reward completion grants immutable rewards once", async (t) => {
  const userId = await storyPlayer(t, "story-reward");
  await unlockCrown(userId);
  const results = await Promise.all([
    completeNonBattleStoryNode(
      userId,
      "block-crowned",
      "same-action-key",
      ["drop"],
    ),
    completeNonBattleStoryNode(
      userId,
      "block-crowned",
      "same-action-key",
      ["drop"],
    ),
  ]);
  assert.deepEqual(
    results.map((result) => result.alreadyCompleted).sort(),
    [false, true],
  );
  const [claims] = await db
    .select({ value: count() })
    .from(playerStoryRewardClaimsTable)
    .where(eq(playerStoryRewardClaimsTable.clerkUserId, userId));
  const [profile] = await db
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, userId));
  assert.equal(claims.value, 6);
  assert.equal(profile.softCurrency, 250);
  assert.equal(profile.packTickets, 10);
  assert.equal(profile.ownedCardIds.includes("closet-nerd"), true);
  assert.equal(profile.ownedCardIds.includes(catalogCardByEngineId["cracked-head"].catalogId), true);
  assert.deepEqual(profile.unlockedCosmeticIds.sort(), ["block-party-crowned", "story-key:chapter-two"]);
  const [actions] = await db
    .select({ value: count() })
    .from(playerStoryActionsTable)
    .where(eq(playerStoryActionsTable.clerkUserId, userId));
  assert.equal(actions.value, 1);
});

test("story action keys reject cross-node, action, and payload reuse", async (t) => {
  const userId = await storyPlayer(t, "story-action-conflict");
  await unlockCrown(userId);
  await completeNonBattleStoryNode(
    userId,
    "block-crowned",
    "immutable-story-action",
    ["one"],
  );
  await assert.rejects(
    () =>
      saveStoryDialogue(
        userId,
        "block-crowned",
        "immutable-story-action",
        ["one"],
      ),
    (error) => error instanceof StoryRequestError && error.status === 409,
  );
  await assert.rejects(
    () =>
      completeNonBattleStoryNode(
        userId,
        "block-crowned",
        "immutable-story-action",
        ["different"],
      ),
    (error) => error instanceof StoryRequestError && error.status === 409,
  );
});

test("dialogue actions persist on unlocked battle nodes without clearing", async (t) => {
  const userId = await storyPlayer(t, "story-battle-dialogue");
  const first = await saveStoryDialogue(
    userId,
    "welcome-to-the-block",
    "battle-dialogue-key",
    ["pre:0", "skip:pre"],
  );
  const retry = await saveStoryDialogue(
    userId,
    "welcome-to-the-block",
    "battle-dialogue-key",
    ["pre:0", "skip:pre"],
  );
  assert.equal(first.alreadyApplied, false);
  assert.equal(retry.alreadyApplied, true);
  const [row] = await db
    .select()
    .from(playerStoryNodesTable)
    .where(
      and(
        eq(playerStoryNodesTable.clerkUserId, userId),
        eq(playerStoryNodesTable.nodeId, "welcome-to-the-block"),
      ),
    );
  assert.equal(row.cleared, false);
  assert.equal(row.attempts, 0);
  assert.deepEqual(row.dialogueSeen, ["pre:0", "skip:pre"]);
});

test("story transcript verification uses explicit immutable snapshot and cards", () => {
  const battle = getStoryBattle("welcome-to-the-block");
  const recipe = starterRecipes[0];
  assert.ok(battle);
  const initial = createStoryMatch(battle.encounter, recipe.cards, recipe.id);
  const moves = Array.from({ length: 6 }, () => ({
    cardInstanceId: null,
    lane: null,
    squabble: false,
  }));
  const verified = verifyStoryMatchTranscript(
    battle.encounter,
    recipe.cards,
    moves,
    recipe.id,
  );
  assert.equal(initial.storyEncounter?.id, battle.encounter.id);
  assert.equal(verified.phase, "complete");
  assert.deepEqual(verified.playerCardIds, recipe.cards);
});

test("story fade progression snapshot survives a later content revision", () => {
  const chapter = storyContent.chapters[0];
  const node = getStoryBattle("welcome-to-the-block");
  assert.ok(chapter);
  assert.ok(node);
  const issued = createStoryMatchProgressionSnapshot(
    storyContent.version,
    chapter,
    node,
  );
  const revisedRewards = [
    { kind: "currency" as const, id: "street-xp", amount: 999 },
  ];
  const revisedNode = { ...node, rewards: revisedRewards };
  const stored = parseStoryMatchProgressionSnapshot(
    JSON.parse(JSON.stringify(issued)),
  );

  assert.deepEqual(stored.rewards, [
    { kind: "currency", id: "street-xp", amount: 50 },
    {
      kind: "card",
      id: "ganger-blue",
      amount: 1,
      claimKey: "story-card-reward:v1:welcome-to-the-block:ganger-blue",
    },
    {
      kind: "currency",
      id: "clout",
      amount: 100,
      claimKey: "story-payout-contract:v1:welcome-to-the-block:clout",
    },
    {
      kind: "pack-ticket",
      id: "street-pack-ticket",
      amount: 1,
      claimKey: "story-payout-contract:v1:welcome-to-the-block:ticket",
    },
  ]);
  assert.notDeepEqual(stored.rewards, revisedNode.rewards);
  assert.equal(stored.chapterId, chapter.id);
  assert.equal(stored.nodeId, node.id);
});

test("old issued battle rewards stay immutable while first-clear delivery fills the current contract", async (t) => {
  const userId = await storyPlayer(t, "story-issued-snapshot-contract");
  const chapterId = "block-party";
  const nodeId = "welcome-to-the-block";
  const historicalSnapshotRewards = [
    { kind: "currency" as const, id: "street-xp", amount: 50 },
  ];
  const first = await db.transaction((tx) =>
    grantStoryRewards(tx, userId, chapterId, nodeId, historicalSnapshotRewards),
  );
  assert.deepEqual(
    first.map((reward) => [reward.kind, reward.id, reward.amount]),
    [
      ["currency", "street-xp", 50],
      ["card", "ganger-blue", 1],
      ["currency", "clout", 100],
      ["pack-ticket", "street-pack-ticket", 1],
    ],
  );
  assert.deepEqual(historicalSnapshotRewards, [
    { kind: "currency", id: "street-xp", amount: 50 },
  ]);
  const retry = await db.transaction((tx) =>
    grantStoryRewards(tx, userId, chapterId, nodeId, historicalSnapshotRewards),
  );
  assert.deepEqual(retry, []);
  const claims = await db
    .select()
    .from(playerStoryRewardClaimsTable)
    .where(eq(playerStoryRewardClaimsTable.clerkUserId, userId));
  assert.deepEqual(
    claims.map((claim) => claim.rewardKey).sort(),
    [
      "welcome-to-the-block:0:currency:street-xp",
      "story-card-reward:v1:welcome-to-the-block:ganger-blue",
      "story-payout-contract:v1:welcome-to-the-block:clout",
      "story-payout-contract:v1:welcome-to-the-block:ticket",
    ].sort(),
  );
});

test("perfect-battle ticket remains distinct from the direct-clear ticket", async (t) => {
  const userId = await storyPlayer(t, "story-perfect-direct-ticket");
  const battle = getStoryBattle("welcome-to-the-block")!;
  const chapterId = "block-party";
  const result = await db.transaction(async (tx) => {
    const directRewards = await grantStoryRewards(
      tx,
      userId,
      chapterId,
      battle.id,
      battle.rewards,
    );
    const perfectReward = await grantStoryTicketAward(
      tx,
      userId,
      chapterId,
      battle.id,
      3,
    );
    return { directRewards, perfectReward };
  });
  assert.equal(
    result.directRewards.filter((reward) => reward.kind === "pack-ticket").length,
    1,
  );
  assert.ok(result.perfectReward);
  assert.notEqual(
    result.directRewards.find((reward) => reward.kind === "pack-ticket")?.rewardKey,
    result.perfectReward.rewardKey,
  );
  const [profile] = await db
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, userId));
  assert.equal(profile.packTickets, 2);
});

test("stored story fade result reconstructs byte-equivalent retry metadata", async (t) => {
  const userId = await storyPlayer(t, "story-match-retry");
  const reward = {
    rewardKey: "welcome-to-the-block:0:currency:street-xp",
    kind: "currency" as const,
    id: "street-xp",
    amount: 50,
    duplicateShards: 0,
    description: "+50 Account XP",
  };
  const [match] = await db
    .insert(playerMatchesTable)
    .values({
      clerkUserId: userId,
      mode: "story",
      playerDeckId: "block",
      rivalDeckId: "welcome-to-the-block-deck",
      storyNodeId: "welcome-to-the-block",
      outcome: "win",
      rounds: 6,
      districtsWon: 3,
      completedAt: new Date(),
      storyFirstClear: true,
      storyStars: 3,
      storyBossHighestPhase: 0,
      storyGrantedRewards: [reward],
    })
    .returning();
  const initial = {
    ...getStoredStoryMatchResult(match),
    alreadyCompleted: false,
  };
  const [reloaded] = await db
    .select()
    .from(playerMatchesTable)
    .where(eq(playerMatchesTable.id, match.id));
  const retry = {
    ...getStoredStoryMatchResult(reloaded),
    alreadyCompleted: true,
  };
  const { alreadyCompleted: initialFlag, ...initialCanonical } = initial;
  const { alreadyCompleted: retryFlag, ...retryCanonical } = retry;
  assert.equal(initialFlag, false);
  assert.equal(retryFlag, true);
  assert.equal(JSON.stringify(initialCanonical), JSON.stringify(retryCanonical));
});

test('saved closing dialogue can recover rewards and repeated delivery checks never mint twice', async (t) => {
  const userId = await storyPlayer(t, 'story-reward-recovery');
  await unlockCrown(userId);
  const node = storyContent.chapters[0].nodes.find(node => node.id === 'block-crowned')!;
  await saveStoryDialogue(userId, node.id, randomUUID(), ['saved-final-line']);
  const first = await completeNonBattleStoryNode(userId, node.id, randomUUID(), []);
  assert.equal(first.alreadyCompleted, false);
  assert.equal(first.rewards.length, node.rewards.length);
  const [credited] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userId));
  const retry = await completeNonBattleStoryNode(userId, node.id, randomUUID(), []);
  assert.equal(retry.alreadyCompleted, true);
  assert.deepEqual(retry.rewards, []);
  const [after] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userId));
  assert.deepEqual([after.packTickets, after.xp, after.softCurrency, after.styleShards], [credited.packTickets, credited.xp, credited.softCurrency, credited.styleShards]);
  const [claims] = await db.select({value:count()}).from(playerStoryRewardClaimsTable).where(and(eq(playerStoryRewardClaimsTable.clerkUserId,userId),eq(playerStoryRewardClaimsTable.nodeId,node.id)));
  assert.equal(claims.value,node.rewards.length);
});
