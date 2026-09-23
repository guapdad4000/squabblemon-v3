import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { and, count, eq } from "drizzle-orm";
import {
  db,
  playerProfilesTable,
  playerStoryActionsTable,
  playerStoryNodesTable,
  playerStoryRewardClaimsTable,
} from "@workspace/db";
import {
  storyContent,
  storySeasons,
  type StoryNode,
} from "@workspace/squabblemon-engine/story";
import {
  completeNonBattleStoryNode,
  completeStoryPuzzle,
} from "./storyTransactions";
import { getPlayerStoryCampaign, StoryRequestError } from "./storyService";

if (!storyContent.chapters.some((chapter) => chapter.nodes.some((node) => node.puzzle))) {
  const fixtureSource = storyContent.chapters[0]?.nodes.find(
    (node) => node.kind !== "battle",
  );
  assert.ok(fixtureSource);
  (storyContent.chapters[0].nodes as StoryNode[]).push({
    ...fixtureSource,
    id: "test-authoritative-puzzle",
    title: "Test authoritative puzzle",
    prerequisites: [storyContent.chapters[0].nodes[0].id],
    rewards: [{ kind: "currency", id: "street-xp", amount: 11 }],
    puzzle: {
      id: "test-sequence",
      title: "Test sequence",
      instruction: "Put the evidence in order.",
      imageAssetId: "assets/story/theater/evidence.webp",
      pieces: [
        { id: "first", label: "First", detail: "The first event." },
        { id: "second", label: "Second", detail: "The second event." },
        { id: "third", label: "Third", detail: "The third event." },
      ],
      solution: ["first", "second", "third"],
      hints: ["Begin with the first event."],
      solvedText: "Solved.",
      skipText: "Skipped.",
    },
  });
}

const puzzleChapter = storyContent.chapters.find((chapter) =>
  chapter.nodes.some((node) => node.puzzle),
);
const puzzleNode = puzzleChapter?.nodes.find((node) => node.puzzle);

async function player(t: test.TestContext, prefix: string) {
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

async function unlockPuzzle(userId: string) {
  assert.ok(puzzleChapter);
  assert.ok(puzzleNode);
  const prerequisiteRows = storyContent.chapters.flatMap((chapter) =>
    chapter.nodes
      .filter((node) => node.id !== puzzleNode.id)
      .map((node) => ({
        clerkUserId: userId,
        chapterId: chapter.id,
        nodeId: node.id,
        cleared: true,
      })),
  );
  await db.insert(playerStoryNodesTable).values(prerequisiteRows);
}

function expectStoryError(status: number, text: RegExp) {
  return (error: unknown) =>
    error instanceof StoryRequestError &&
    error.status === status &&
    text.test(error.message);
}

test("campaign exposes authoritative summaries for every authored season", async (t) => {
  const userId = await player(t, "story-seasons");
  const campaign = await getPlayerStoryCampaign(userId);
  assert.equal(campaign.seasons.length, storySeasons.length);
  for (const season of campaign.seasons) {
    const authored = storySeasons.find((item) => item.id === season.id);
    assert.ok(authored);
    const nodes = campaign.nodes.filter((node) =>
      authored.chapterIds.includes(node.chapterId),
    );
    assert.equal(season.totalNodes, nodes.length);
    assert.equal(season.clearedNodes, nodes.filter((node) => node.cleared).length);
    assert.equal(
      season.starsAvailable,
      nodes.filter((node) => node.kind === "battle").length * 3,
    );
    assert.equal(
      season.starsEarned,
      nodes.reduce((total, node) => total + node.stars, 0),
    );
  }
});

test("puzzle completion validates authority, solutions, bypass, and idempotency", async (t) => {
  assert.ok(puzzleChapter, "story content must include a puzzle chapter");
  assert.ok(puzzleNode?.puzzle, "story content must include a puzzle node");
  const lockedUser = await player(t, "story-puzzle-locked");
  await assert.rejects(
    completeStoryPuzzle(
      lockedUser,
      puzzleNode.id,
      randomUUID(),
      [...puzzleNode.puzzle.solution],
      undefined,
    ),
    expectStoryError(409, /locked/i),
  );
  await assert.rejects(
    completeStoryPuzzle(
      lockedUser,
      "unknown-story-puzzle",
      randomUUID(),
      [],
      undefined,
    ),
    expectStoryError(404, /not found/i),
  );

  const userId = await player(t, "story-puzzle");
  await unlockPuzzle(userId);
  const ordinaryNode = storyContent.chapters
    .flatMap((chapter) => chapter.nodes)
    .find((node) => !node.puzzle);
  assert.ok(ordinaryNode);
  await assert.rejects(
    completeStoryPuzzle(
      userId,
      ordinaryNode.id,
      randomUUID(),
      [...puzzleNode.puzzle.solution],
      undefined,
    ),
    expectStoryError(400, /does not have a puzzle/i),
  );
  await assert.rejects(
    completeNonBattleStoryNode(userId, puzzleNode.id, randomUUID(), []),
    expectStoryError(400, /puzzle endpoint/i),
  );
  const permutation = [...puzzleNode.puzzle.solution].reverse();
  const duplicate = puzzleNode.puzzle.solution.map(
    (_piece, index) => puzzleNode.puzzle!.solution[index ? 0 : index],
  );
  await assert.rejects(
    completeStoryPuzzle(
      userId,
      puzzleNode.id,
      randomUUID(),
      permutation,
      undefined,
    ),
    expectStoryError(400, /incorrect/i),
  );
  await assert.rejects(
    completeStoryPuzzle(
      userId,
      puzzleNode.id,
      randomUUID(),
      duplicate,
      undefined,
    ),
    expectStoryError(400, /incorrect/i),
  );
  await assert.rejects(
    completeStoryPuzzle(
      userId,
      puzzleNode.id,
      randomUUID(),
      [...puzzleNode.puzzle.solution],
      true,
    ),
    expectStoryError(400, /cannot include/i),
  );

  const key = randomUUID();
  const first = await completeStoryPuzzle(
    userId,
    puzzleNode.id,
    key,
    undefined,
    true,
    ["puzzle:intro"],
  );
  const replay = await completeStoryPuzzle(
    userId,
    puzzleNode.id,
    key,
    undefined,
    true,
    ["puzzle:intro"],
  );
  assert.equal(first.resolution, "skipped");
  assert.equal(first.alreadyCompleted, false);
  assert.equal(replay.resolution, "skipped");
  assert.equal(replay.alreadyCompleted, true);
  assert.deepEqual(replay.rewards, first.rewards);
  await assert.rejects(
    completeStoryPuzzle(
      userId,
      puzzleNode.id,
      key,
      undefined,
      true,
      ["different-payload"],
    ),
    expectStoryError(409, /Idempotency key/i),
  );

  const retry = await completeStoryPuzzle(
    userId,
    puzzleNode.id,
    randomUUID(),
    undefined,
    true,
  );
  assert.equal(retry.alreadyCompleted, true);
  assert.deepEqual(retry.rewards, []);
  const [nodeRow] = await db
    .select()
    .from(playerStoryNodesTable)
    .where(
      and(
        eq(playerStoryNodesTable.clerkUserId, userId),
        eq(playerStoryNodesTable.nodeId, puzzleNode.id),
      ),
    );
  assert.equal(nodeRow.attempts, 1);
  const [claims] = await db
    .select({ value: count() })
    .from(playerStoryRewardClaimsTable)
    .where(
      and(
        eq(playerStoryRewardClaimsTable.clerkUserId, userId),
        eq(playerStoryRewardClaimsTable.nodeId, puzzleNode.id),
      ),
    );
  assert.equal(claims.value, puzzleNode.rewards.length);
  const [actions] = await db
    .select({ value: count() })
    .from(playerStoryActionsTable)
    .where(
      and(
        eq(playerStoryActionsTable.clerkUserId, userId),
        eq(playerStoryActionsTable.nodeId, puzzleNode.id),
      ),
    );
  assert.equal(actions.value, 2);
});

test("an exact solved puzzle replay is stable and grants authored rewards once", async (t) => {
  assert.ok(puzzleNode?.puzzle);
  const userId = await player(t, "story-puzzle-solved");
  await unlockPuzzle(userId);
  const key = randomUUID();
  const first = await completeStoryPuzzle(
    userId,
    puzzleNode.id,
    key,
    [...puzzleNode.puzzle.solution],
    undefined,
  );
  const replay = await completeStoryPuzzle(
    userId,
    puzzleNode.id,
    key,
    [...puzzleNode.puzzle.solution],
    undefined,
  );
  assert.equal(first.resolution, "solved");
  assert.equal(replay.resolution, "solved");
  assert.equal(first.alreadyCompleted, false);
  assert.equal(replay.alreadyCompleted, true);
  assert.deepEqual(replay.rewards, first.rewards);
});