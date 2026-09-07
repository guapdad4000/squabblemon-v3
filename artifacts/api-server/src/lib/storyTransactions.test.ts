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
  getStoryBattle,
  storyContent,
} from "@workspace/squabblemon-engine/story";
import {
  createStoryMatch,
  verifyStoryMatchTranscript,
} from "@workspace/squabblemon-engine/gameEngine";
import { starterRecipes } from "@workspace/squabblemon-engine/data";
import { getPlayerStoryCampaign, StoryRequestError } from "./storyService";
import { getStoredStoryMatchResult } from "./storyMatchResult";
import {
  createStoryMatchProgressionSnapshot,
  parseStoryMatchProgressionSnapshot,
} from "./storyMatchSnapshot";
import {
  completeNonBattleStoryNode,
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

test("story nodes persist normalized progress and merged dialogue", async (t) => {
  const userId = await storyPlayer(t, "story-dialogue");
  const first = await completeNonBattleStoryNode(
    userId,
    "prologue-welcome",
    randomUUID(),
    ["line-1"],
  );
  const retry = await completeNonBattleStoryNode(
    userId,
    "prologue-welcome",
    randomUUID(),
    ["line-1", "line-2"],
  );
  assert.equal(first.alreadyCompleted, false);
  assert.equal(retry.alreadyCompleted, true);

  const [row] = await db
    .select()
    .from(playerStoryNodesTable)
    .where(eq(playerStoryNodesTable.clerkUserId, userId));
  assert.equal(row.cleared, true);
  assert.equal(row.attempts, 1);
  assert.deepEqual(row.dialogueSeen, ["line-1", "line-2"]);
  const campaign = await getPlayerStoryCampaign(userId);
  assert.equal(campaign.recommendedNodeId, "prologue-first-hand");
});

test("server registry prerequisites reject out-of-order completion", async (t) => {
  const userId = await storyPlayer(t, "story-locked");
  await assert.rejects(
    () =>
      completeNonBattleStoryNode(
        userId,
        "prologue-starter-drop",
        randomUUID(),
        ["scene"],
      ),
    (error) =>
      error instanceof StoryRequestError &&
      error.status === 409 &&
      error.message.includes("locked"),
  );
});

test("concurrent story reward completion grants immutable rewards once", async (t) => {
  const userId = await storyPlayer(t, "story-reward");
  await db.insert(playerStoryNodesTable).values([
    {
      clerkUserId: userId,
      chapterId: "prologue-street-rules",
      nodeId: "prologue-welcome",
      cleared: true,
    },
    {
      clerkUserId: userId,
      chapterId: "prologue-street-rules",
      nodeId: "prologue-first-hand",
      cleared: true,
      stars: 1,
      attempts: 1,
      wins: 1,
    },
  ]);
  const results = await Promise.all([
    completeNonBattleStoryNode(
      userId,
      "prologue-starter-drop",
      "same-action-key",
      ["drop"],
    ),
    completeNonBattleStoryNode(
      userId,
      "prologue-starter-drop",
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
  assert.equal(claims.value, 2);
  assert.equal(profile.xp, 75);
  assert.equal(profile.ownedCardIds.includes("plug"), true);
  const [actions] = await db
    .select({ value: count() })
    .from(playerStoryActionsTable)
    .where(eq(playerStoryActionsTable.clerkUserId, userId));
  assert.equal(actions.value, 1);
});

test("story action keys reject cross-node, action, and payload reuse", async (t) => {
  const userId = await storyPlayer(t, "story-action-conflict");
  await completeNonBattleStoryNode(
    userId,
    "prologue-welcome",
    "immutable-story-action",
    ["one"],
  );
  await assert.rejects(
    () =>
      saveStoryDialogue(
        userId,
        "prologue-welcome",
        "immutable-story-action",
        ["one"],
      ),
    (error) => error instanceof StoryRequestError && error.status === 409,
  );
  await assert.rejects(
    () =>
      completeNonBattleStoryNode(
        userId,
        "prologue-welcome",
        "immutable-story-action",
        ["different"],
      ),
    (error) => error instanceof StoryRequestError && error.status === 409,
  );
});

test("dialogue actions persist on unlocked battle nodes without clearing", async (t) => {
  const userId = await storyPlayer(t, "story-battle-dialogue");
  await completeNonBattleStoryNode(
    userId,
    "prologue-welcome",
    randomUUID(),
    ["welcome"],
  );
  const first = await saveStoryDialogue(
    userId,
    "prologue-first-hand",
    "battle-dialogue-key",
    ["pre:0", "skip:pre"],
  );
  const retry = await saveStoryDialogue(
    userId,
    "prologue-first-hand",
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
        eq(playerStoryNodesTable.nodeId, "prologue-first-hand"),
      ),
    );
  assert.equal(row.cleared, false);
  assert.equal(row.attempts, 0);
  assert.deepEqual(row.dialogueSeen, ["pre:0", "skip:pre"]);
});

test("story transcript verification uses explicit immutable snapshot and cards", () => {
  const battle = getStoryBattle("prologue-first-hand");
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

test("story match progression snapshot survives a later content revision", () => {
  const chapter = storyContent.chapters[0];
  const node = getStoryBattle("prologue-first-hand");
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
  ]);
  assert.notDeepEqual(stored.rewards, revisedNode.rewards);
  assert.equal(stored.chapterId, chapter.id);
  assert.equal(stored.nodeId, node.id);
});

test("stored story match result reconstructs byte-equivalent retry metadata", async (t) => {
  const userId = await storyPlayer(t, "story-match-retry");
  const reward = {
    rewardKey: "prologue-first-hand:0:currency:street-xp",
    kind: "currency" as const,
    id: "street-xp",
    amount: 50,
    duplicateShards: 0,
    description: "+50 Street XP",
  };
  const [match] = await db
    .insert(playerMatchesTable)
    .values({
      clerkUserId: userId,
      mode: "story",
      playerDeckId: "block",
      rivalDeckId: "prologue-blue",
      storyNodeId: "prologue-first-hand",
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