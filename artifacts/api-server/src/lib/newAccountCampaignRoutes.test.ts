import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import express from "express";
import { count, eq, or } from "drizzle-orm";
import {
  db,
  onlineRoomsTable,
  playerMatchesTable,
  playerProfilesTable,
  playerStoryNodesTable,
} from "@workspace/db";
import {
  ROOKIE_MENTOR_CORE_IDS,
  ROOKIE_DECK_ID,
  ROOKIE_FOUNDATION_ID,
  catalogIdsToEngineIds,
} from "@workspace/squabblemon-engine/data";
import {
  createGuidedTutorialTranscript,
  createStoryMatch,
} from "@workspace/squabblemon-engine/gameEngine";
import { storyContent, type StoryNode } from "@workspace/squabblemon-engine/story";
import playerRouter from "../routes/player";
import storyRouter from "../routes/story";
import collectionRouter from "../routes/collection";
import { ensurePlayer } from "./playerState";
import {
  STORY_SOLVER_NODE_BUDGET_MS,
  solveStoryMoves,
} from "./storyMoveSolver";

const passMoves = Array.from({ length: 6 }, () => ({
  cardInstanceId: null,
  lane: null,
  squabble: false,
  endTurn: true,
}));


test("new account completes every campaign node through HTTP with isolated, idempotent persistence", {
  skip: !process.env.DATABASE_URL,
  timeout: 240_000,
}, async t => {
  const campaignCrew = [...ROOKIE_MENTOR_CORE_IDS];
  campaignCrew[5] = "nail-tech"; // The same required first swap as Dr. Fade’s UI lesson.
  const runId = randomUUID();
  const playerId = `campaign-e2e-${runId}`;
  const controlId = `campaign-control-${runId}`;

  await ensurePlayer(controlId);
  const [controlBefore] = await db.select().from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, controlId));

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const userId = req.header("x-test-user-id");
    (req as any).auth = Object.assign(
      () => ({
        userId,
        sessionId: `campaign-${runId}`,
        tokenType: "session_token",
        isAuthenticated: Boolean(userId),
      }),
      { [Symbol.for("@clerk/express.auth")]: true },
    );
    (req as any).log = { warn() {}, error() {} };
    next();
  });
  app.use("/api", playerRouter, storyRouter, collectionRouter);
  app.use((error: Error, _req: unknown, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: error.message });
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}/api`;

  t.after(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    const rooms = await db.select({ value: count() }).from(onlineRoomsTable).where(or(
      eq(onlineRoomsTable.hostUserId, playerId),
      eq(onlineRoomsTable.guestUserId, playerId),
      eq(onlineRoomsTable.hostUserId, controlId),
      eq(onlineRoomsTable.guestUserId, controlId),
    ));
    assert.equal(Number(rooms[0]?.value ?? 0), 0, "campaign accounts must not own multiplayer rooms");
    await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, playerId));
    await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, controlId));
    const [matches] = await db.select({ value: count() }).from(playerMatchesTable)
      .where(eq(playerMatchesTable.clerkUserId, playerId));
    const [nodes] = await db.select({ value: count() }).from(playerStoryNodesTable)
      .where(eq(playerStoryNodesTable.clerkUserId, playerId));
    assert.equal(Number(matches.value), 0);
    assert.equal(Number(nodes.value), 0);
  });

  async function request(userId: string, path: string, body?: unknown, method = body === undefined ? "GET" : "POST") {
    const response = await fetch(origin + path, {
      method,
      headers: {
        "content-type": "application/json",
        "connection": "close",
        "x-test-user-id": userId,
        "x-campaign-run-id": runId,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    const result = text ? JSON.parse(text) : null;
    assert.notEqual(response.status, 500, `${method} ${path}: ${text}`);
    return { status: response.status, body: result };
  }
  const playerRequest = (path: string, body?: unknown, method?: string) =>
    request(playerId, path, body, method);

  const bootstrap = await playerRequest("/player/bootstrap");
  assert.equal(bootstrap.status, 200);
  assert.equal(bootstrap.body.profile.onboardingStep, "profile");
  assert.equal(bootstrap.body.profile.ownedCardIds.length, 0);

  const accepted = await playerRequest("/player/onboarding", {
    action: "accept-terms",
    displayName: `Campaign ${runId.slice(0, 8)}`,
    ageConfirmed: true,
    termsAccepted: true,
  });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.profile.onboardingStep, "tutorial");

  const collection = await playerRequest("/player/onboarding", { action: "choose-starter", starterDeckId: ROOKIE_FOUNDATION_ID });
  assert.equal(collection.body.profile.onboardingStep, "tutorial");
  assert.equal(collection.body.profile.ownedCardIds.length, 21);
  const savedDeck = await playerRequest(`/player/decks/${ROOKIE_DECK_ID}`, {
    name: "My First Gang", cardIds: campaignCrew, heroCardId: "dr-fade", recipeId: null,
  }, "PUT");
  assert.equal(savedDeck.status, 200, JSON.stringify(savedDeck.body));
  assert.deepEqual(savedDeck.body.profile.savedDecks.find((deck: { id: string }) => deck.id === ROOKIE_DECK_ID).cardIds, campaignCrew);
  const beforeLessonReward = await playerRequest("/player/onboarding", { action: "claim-reward" });
  assert.equal(beforeLessonReward.body.profile.starterRewardClaimed, false);
  const tutorial = await playerRequest("/player/matches", {
    mode: "tutorial",
    playerDeckId: ROOKIE_DECK_ID,
    rivalDeckId: "combo",
  });
  assert.equal(tutorial.status, 201, JSON.stringify(tutorial.body));
  const tutorialBypass = await playerRequest(
    `/player/matches/${tutorial.body.id}/complete`,
    { moves: passMoves.slice(0, 4) },
  );
  assert.equal(tutorialBypass.status, 400, JSON.stringify(tutorialBypass.body));
  assert.deepEqual(tutorialBypass.body.milestones, {
    playerCardPlayed: false,
    bankedMotionAfterPlay: false,
    squabbleUsed: false,
  });
  const tutorialMoves = createGuidedTutorialTranscript(
    tutorial.body.abilityUpgradeSnapshot,
    tutorial.body.districtSnapshot,
    tutorial.body.encounterSnapshot,
    catalogIdsToEngineIds(campaignCrew),
    ROOKIE_DECK_ID,
  );
  const tutorialComplete = await playerRequest(
    `/player/matches/${tutorial.body.id}/complete`,
    { moves: tutorialMoves },
  );
  assert.equal(tutorialComplete.status, 200, JSON.stringify(tutorialComplete.body));
  const tutorialReplay = await playerRequest(
    `/player/matches/${tutorial.body.id}/complete`,
    { moves: tutorialMoves },
  );
  assert.equal(tutorialReplay.body.alreadyCompleted, true);
  const advanced = await playerRequest("/player/onboarding", { action: "complete-tutorial" });
  assert.equal(advanced.body.profile.onboardingStep, "reward");

  const starter = await playerRequest("/player/onboarding", {
    action: "choose-starter",
    starterDeckId: ROOKIE_FOUNDATION_ID,
  });
  assert.equal(starter.status, 200);
  assert.equal(starter.body.profile.onboardingStep, "reward");
  assert(starter.body.profile.savedDecks.some((deck: { id: string }) => deck.id === ROOKIE_DECK_ID));

  const beforeReward = tutorialComplete.body.profile;
  const rewards = await Promise.all([
    playerRequest("/player/onboarding", { action: "claim-reward" }),
    playerRequest("/player/onboarding", { action: "claim-reward" }),
  ]);
  assert(rewards.every(result => result.status === 200));
  const afterReward = (await playerRequest("/player/bootstrap")).body.profile;
  assert.equal(afterReward.onboardingStep, "complete");
  assert.equal(afterReward.softCurrency - beforeReward.softCurrency, 250);
  assert.equal(afterReward.packTickets - beforeReward.packTickets, 1);

  const lockedFinale = storyContent.chapters.at(-1)!.nodes.find(node => node.kind !== "battle")!;
  const locked = await playerRequest(`/player/story/nodes/${lockedFinale.id}/complete`, {
    idempotencyKey: `locked-${runId}`,
    dialogueSeen: [],
  });
  assert.equal(locked.status, 409);

  let intentionalLossTested = false;
  let actionConflictTested = false;
  let completed = 0;
  let shortenedStoryRoundPersisted = false;
  const runtimeCheckedBattleNodes = new Set<string>();

  function solveWithinNodeBudget(
    match: Parameters<typeof solveStoryMoves>[0],
    outcome: "win" | "loss",
    nodeId: string,
  ) {
    const startedAt = performance.now();
    const moves = solveStoryMoves(match, outcome);
    const elapsed = performance.now() - startedAt;
    assert(
      elapsed <= STORY_SOLVER_NODE_BUDGET_MS + 500,
      `${nodeId}: solver took ${elapsed.toFixed(1)}ms; budget is ${STORY_SOLVER_NODE_BUDGET_MS}ms (+500ms assertion margin)`,
    );
    if (outcome === "win") runtimeCheckedBattleNodes.add(nodeId);
    return moves;
  }

  async function completeNode(node: StoryNode) {
    const dialogueKey = `dialogue-${node.id}-${runId}`;
    const dialogueSeen = [`seen:${node.id}`];
    const dialogue = await playerRequest(`/player/story/nodes/${node.id}/dialogue`, {
      idempotencyKey: dialogueKey,
      dialogueSeen,
    });
    assert.equal(dialogue.status, 200, `${node.id}: ${JSON.stringify(dialogue.body)}`);
    const dialogueRetry = await playerRequest(`/player/story/nodes/${node.id}/dialogue`, {
      idempotencyKey: dialogueKey,
      dialogueSeen,
    });
    assert.equal(dialogueRetry.status, 200);

    if (node.kind !== "battle") {
      const key = `complete-${node.id}-${runId}`;
      const completionPath = node.puzzle
        ? "/player/story/puzzle"
        : `/player/story/nodes/${node.id}/complete`;
      const completionBody = (seen: string[]) => node.puzzle
        ? {
            nodeId: node.id,
            idempotencyKey: key,
            order: [...node.puzzle.solution],
            dialogueSeen: seen,
          }
        : {
            idempotencyKey: key,
            dialogueSeen: seen,
          };
      if (node.puzzle) {
        const ordinary = await playerRequest(`/player/story/nodes/${node.id}/complete`, {
          idempotencyKey: `ordinary-puzzle-${node.id}-${runId}`,
          dialogueSeen,
        });
        assert.equal(ordinary.status, 400);
      }
      const first = await playerRequest(completionPath, completionBody(dialogueSeen));
      assert.equal(first.status, 200, `${node.id}: ${JSON.stringify(first.body)}`);
      if (node.puzzle) assert.equal(first.body.resolution, "solved");
      const retry = await playerRequest(completionPath, completionBody(dialogueSeen));
      assert.equal(retry.status, 200);
      assert.equal(retry.body.alreadyCompleted, true);
      if (!actionConflictTested) {
        const conflict = await playerRequest(completionPath, completionBody([
          ...dialogueSeen,
          "changed",
        ]));
        assert.equal(conflict.status, 409);
        actionConflictTested = true;
      }
      completed += 1;
      return;
    }

    async function startStoryMatch() {
      const started = await playerRequest("/player/matches", {
        mode: "story",
        playerDeckId: ROOKIE_DECK_ID,
        rivalDeckId: "block",
        storyNodeId: node.id,
      });
      assert.equal(started.status, 201, `${node.id}: ${JSON.stringify(started.body)}`);
      const match = createStoryMatch(
        started.body.encounterSnapshot,
        catalogIdsToEngineIds(campaignCrew),
        ROOKIE_DECK_ID,
        started.body.abilityUpgradeSnapshot,
        started.body.districtSnapshot,
      );
      return { started, match };
    }

    if (!intentionalLossTested) {
      const { started, match } = await startStoryMatch();
      const moves = solveWithinNodeBudget(match, "loss", node.id);
      const loss = await playerRequest(`/player/matches/${started.body.id}/complete`, { moves });
      assert.equal(loss.status, 200, JSON.stringify(loss.body));
      assert.equal(loss.body.story.outcome, "loss");
      const afterLoss = await playerRequest("/player/story");
      const state = afterLoss.body.nodes.find((item: { nodeId: string }) => item.nodeId === node.id);
      assert.equal(state.status, "available");
      assert.equal(state.attempts, 1);
      intentionalLossTested = true;
    }

    const { started, match } = await startStoryMatch();
    let moves;
    try { moves = solveWithinNodeBudget(match, "win", node.id); }
    catch (error) { throw new Error(`${node.id}: ${error instanceof Error ? error.message : String(error)}`); }
    const first = await playerRequest(`/player/matches/${started.body.id}/complete`, { moves });
    assert.equal(first.status, 200, `${node.id}: ${JSON.stringify(first.body)}`);
    assert.equal(first.body.story.outcome, "win");
    const expectedRounds = started.body.encounterSnapshot.roundLimit ?? 6;
    const [storedMatch] = await db
      .select({ rounds: playerMatchesTable.rounds })
      .from(playerMatchesTable)
      .where(eq(playerMatchesTable.id, started.body.id));
    assert.equal(storedMatch?.rounds, expectedRounds, `${node.id}: persisted round count`);
    if (expectedRounds < 6) shortenedStoryRoundPersisted = true;
    assert.equal(first.body.campaign.nodes.find((item: { nodeId: string }) => item.nodeId === node.id).status, "cleared");
    const currency = first.body.profile.softCurrency;
    const retry = await playerRequest(`/player/matches/${started.body.id}/complete`, { moves });
    assert.equal(retry.status, 200);
    assert.equal(retry.body.alreadyCompleted, true);
    assert.equal(retry.body.profile.softCurrency, currency);
    completed += 1;
  }

  for (const chapter of storyContent.chapters) {
    const optional: StoryNode[] = [];
    for (const node of chapter.nodes) {
      if (node.optional) optional.push(node);
      else await completeNode(node);
    }
    for (const node of optional) await completeNode(node);
  }

  const finalCampaign = await playerRequest("/player/story");
  assert.equal(finalCampaign.status, 200);
  assert.equal(completed, storyContent.chapters.flatMap(chapter => chapter.nodes).length);
  assert(finalCampaign.body.nodes.every((node: { status: string }) => node.status === "cleared"));
  assert(finalCampaign.body.chapters.every((chapter: { status: string }) => chapter.status === "cleared"));
  assert.equal(finalCampaign.body.recommendedNodeId, null);
  assert.equal(intentionalLossTested, true);
  assert.equal(actionConflictTested, true);
  assert.equal(shortenedStoryRoundPersisted, true);
  const authoredBattleNodes = storyContent.chapters
    .flatMap(chapter => chapter.nodes)
    .filter(node => node.kind === "battle");
  assert.equal(runtimeCheckedBattleNodes.size, authoredBattleNodes.length);
  assert(
    authoredBattleNodes.every(node => runtimeCheckedBattleNodes.has(node.id)),
    "Every authored battle must complete under the per-node solver runtime ceiling.",
  );

  const [controlAfter] = await db.select().from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, controlId));
  assert.deepEqual(
    {
      onboardingStep: controlAfter.onboardingStep,
      ownedCardIds: controlAfter.ownedCardIds,
      softCurrency: controlAfter.softCurrency,
      packTickets: controlAfter.packTickets,
      storyProgress: controlAfter.storyProgress,
    },
    {
      onboardingStep: controlBefore.onboardingStep,
      ownedCardIds: controlBefore.ownedCardIds,
      softCurrency: controlBefore.softCurrency,
      packTickets: controlBefore.packTickets,
      storyProgress: controlBefore.storyProgress,
    },
  );
});

