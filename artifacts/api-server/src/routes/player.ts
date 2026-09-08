import { getAuth } from "@clerk/express";
import { and, eq, isNull, sql } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  AdvancePlayerOnboardingBody,
  AdvancePlayerOnboardingResponse,
  ClaimPlayerMissionParams,
  ClaimPlayerMissionResponse,
  CompletePlayerMatchBody,
  CompletePlayerMatchParams,
  CompletePlayerMatchResponse,
  GetPlayerBootstrapResponse,
  StartPlayerMatchBody,
  StartPlayerMatchResponse,
  UpdatePlayerProfileBody,
  UpdatePlayerProfileResponse,
} from "@workspace/api-zod";
import {
  db,
  playerMatchesTable,
  playerMissionsTable,
  playerProfilesTable,
  playerStoryNodesTable,
} from "@workspace/db";
import {
  createStoryMatch,
  getDistrictResults,
  getMatchWinner,
  type StoryEncounterSnapshot,
  verifyMatchTranscript,
  verifyStoryMatchTranscript,
} from "@workspace/squabblemon-engine/gameEngine";
import { starterRecipes } from "@workspace/squabblemon-engine/data";
import { storyContent } from "@workspace/squabblemon-engine/story";
import {
  ensurePlayer,
  getPlayerBootstrap,
  hasVerifiedTutorialMatch,
} from "../lib/playerState";
import { canUseRewardedRecipe } from "../lib/matchAuthorization";
import {
  getPlayerStoryCampaign,
  requireAvailableStoryNode,
  StoryRequestError,
} from "../lib/storyService";
import {
  grantStoryRewards,
  type GrantedStoryReward,
} from "../lib/storyTransactions";
import { getStoredStoryMatchResult } from "../lib/storyMatchResult";
import {
  claimMissionReward,
  claimStarterReward,
  completeStandardMatchReward,
  PlayerRewardError,
} from "../lib/playerRewardTransactions";
import {
  createStoryMatchProgressionSnapshot,
  parseStoryMatchProgressionSnapshot,
  type StoryMatchProgressionSnapshot,
} from "../lib/storyMatchSnapshot";

const router: IRouter = Router();

const deckCards: Record<string, string[]> = {
  block: [
    "cornball",
    "snow-bunny",
    "all-jokes-roaster",
    "rastamon",
    "wifey",
    "officer-oink",
    "baby-momma",
  ],
  slide: [
    "cornball",
    "bikelife-yn",
    "cool-vibe-yn",
    "plug",
    "snow-bunny",
    "hooper",
    "baby-momma",
  ],
  combo: [
    "cornball",
    "plug",
    "live-streamer",
    "gamer",
    "techbro-rich",
    "cool-vibe-yn",
    "wifey",
  ],
  receipts: [
    "cornball",
    "all-jokes-roaster",
    "closet-nerd",
    "snow-bunny",
    "plug",
    "baby-momma",
    "hooper",
  ],
  crashout: [
    "cornball",
    "rastamon",
    "snow-bunny",
    "wifey",
    "baby-momma",
    "hooper",
    "all-jokes-roaster",
  ],
  vibes: [
    "rastamon",
    "wifey",
    "snow-bunny",
    "cool-vibe-yn",
    "hooper",
    "officer-oink",
    "plug",
  ],
  compound: [
    "cornball",
    "plug",
    "live-streamer",
    "rastamon",
    "gamer",
    "techbro-rich",
    "wifey",
  ],
};

const deckHeroes: Record<string, string> = {
  block: "officer-oink",
  slide: "bikelife-yn",
  combo: "techbro-rich",
  receipts: "all-jokes-roaster",
  crashout: "baby-momma",
  vibes: "rastamon",
  compound: "gamer",
};

function authenticatedUserId(req: Request, res: Response): string | null {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  return auth.userId;
}

router.get("/player/bootstrap", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req, res);
  if (!userId) return;
  const state = await getPlayerBootstrap(userId);
  res.json(GetPlayerBootstrapResponse.parse(state));
});

router.patch("/player/profile", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req, res);
  if (!userId) return;
  const parsed = UpdatePlayerProfileBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid profile update");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [current] = await db
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, userId));
  if (!current) await getPlayerBootstrap(userId);

  const settings = {
    reducedMotion:
      parsed.data.reducedMotion ??
      current?.settings.reducedMotion ??
      false,
    turnTimerEnabled:
      parsed.data.turnTimerEnabled ??
      current?.settings.turnTimerEnabled ??
      true,
  };
  await db
    .update(playerProfilesTable)
    .set({
      ...(parsed.data.displayName
        ? { displayName: parsed.data.displayName.trim() }
        : {}),
      ...(parsed.data.avatarKey ? { avatarKey: parsed.data.avatarKey } : {}),
      settings,
    })
    .where(eq(playerProfilesTable.clerkUserId, userId));

  res.json(
    UpdatePlayerProfileResponse.parse(await getPlayerBootstrap(userId)),
  );
});

router.post("/player/onboarding", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req, res);
  if (!userId) return;
  const parsed = AdvancePlayerOnboardingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const state = await getPlayerBootstrap(userId);
  const profile = state.profile;

  if (parsed.data.action === "accept-terms") {
    if (
      !parsed.data.ageConfirmed ||
      !parsed.data.termsAccepted ||
      !parsed.data.displayName
    ) {
      res.status(400).json({ error: "Name, age, and terms are required" });
      return;
    }
    if (profile.onboardingStep === "profile") {
      await db
        .update(playerProfilesTable)
        .set({
          displayName: parsed.data.displayName.trim(),
          ageConfirmedAt: new Date(),
          termsAcceptedAt: new Date(),
          onboardingStep: "tutorial",
        })
        .where(eq(playerProfilesTable.clerkUserId, userId));
    }
  } else if (parsed.data.action === "complete-tutorial") {
    if (profile.onboardingStep === "profile") {
      res.status(400).json({ error: "Accept the player terms first" });
      return;
    }
    if (profile.onboardingStep === "tutorial") {
      if (!(await hasVerifiedTutorialMatch(userId))) {
        res.status(409).json({
          error: "Complete the guided match before choosing a starter crew",
        });
        return;
      }
      await db
        .update(playerProfilesTable)
        .set({ tutorialCompleted: true, onboardingStep: "crew" })
        .where(
          and(
            eq(playerProfilesTable.clerkUserId, userId),
            eq(playerProfilesTable.onboardingStep, "tutorial"),
          ),
        );
    }
  } else if (parsed.data.action === "choose-starter") {
    const starterDeckId = parsed.data.starterDeckId;
    if (!starterDeckId || !deckCards[starterDeckId]) {
      res.status(400).json({ error: "Choose a valid starter crew" });
      return;
    }
    if (profile.onboardingStep === "crew") {
      await db
        .update(playerProfilesTable)
        .set({
          starterDeckId,
          avatarKey: deckHeroes[starterDeckId],
          ownedCardIds: deckCards[starterDeckId],
          discoveredCardIds: [
            ...new Set([
              ...deckCards[starterDeckId],
              ...Object.values(deckHeroes),
            ]),
          ],
          savedDecks: [
            {
              id: `starter-${starterDeckId}`,
              name: "Starter Crew",
              cardIds: deckCards[starterDeckId],
              heroCardId: deckHeroes[starterDeckId],
              recipeId: starterDeckId,
            },
          ],
          collectionProgress: deckCards[starterDeckId].length,
          onboardingStep: "reward",
        })
        .where(
          and(
            eq(playerProfilesTable.clerkUserId, userId),
            eq(playerProfilesTable.onboardingStep, "crew"),
          ),
        );
    }
  } else if (parsed.data.action === "claim-reward") {
    if (profile.onboardingStep === "reward") {
      await claimStarterReward(userId);
    }
  }

  res.json(
    AdvancePlayerOnboardingResponse.parse(await getPlayerBootstrap(userId)),
  );
});

router.post("/player/matches", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req, res);
  if (!userId) return;
  const parsed = StartPlayerMatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!deckCards[parsed.data.playerDeckId] ||
    (parsed.data.mode !== "story" && !deckCards[parsed.data.rivalDeckId])) {
    res.status(400).json({ error: "Unknown crew" });
    return;
  }
  const state = await getPlayerBootstrap(userId);
  const allowed =
    (parsed.data.mode === "tutorial" &&
      state.profile.onboardingStep === "tutorial") ||
    (parsed.data.mode !== "tutorial" &&
      state.profile.onboardingStep === "complete");
  if (!allowed) {
    res.status(400).json({ error: "Finish the current Rookie Road step first" });
    return;
  }
  if (parsed.data.mode !== "tutorial") {
    if (
      !canUseRewardedRecipe(
        parsed.data.playerDeckId,
        state.profile.ownedCardIds,
      )
    ) {
      res.status(403).json({
        error: "Unlock every card in this crew before using it for rewards",
      });
      return;
    }
  }
  let storyNodeId: string | null = null;
  let storyContentVersion: number | null = null;
  let storyEncounterSnapshot: StoryEncounterSnapshot | null = null;
  let storyProgressionSnapshot: StoryMatchProgressionSnapshot | null = null;
  let playerEngineCardIds: string[] | null = null;
  let rivalDeckId = parsed.data.rivalDeckId;
  if (parsed.data.mode === "story") {
    if (!parsed.data.storyNodeId) {
      res.status(400).json({ error: "Story mode requires a story node" });
      return;
    }
    const rows = await db
      .select()
      .from(playerStoryNodesTable)
      .where(eq(playerStoryNodesTable.clerkUserId, userId));
    try {
      const { node, chapter } = requireAvailableStoryNode(
        parsed.data.storyNodeId,
        rows,
      );
      if (node.kind !== "battle") {
        res.status(400).json({ error: "Story node is not a battle" });
        return;
      }
      const recipe = starterRecipes.find(
        (item) => item.id === parsed.data.playerDeckId,
      );
      if (!recipe) {
        res.status(400).json({ error: "Unknown player crew" });
        return;
      }
      storyNodeId = node.id;
      storyContentVersion = storyContent.version;
      storyEncounterSnapshot = structuredClone(node.encounter);
      storyProgressionSnapshot = createStoryMatchProgressionSnapshot(
        storyContent.version,
        chapter,
        node,
      );
      playerEngineCardIds = [...recipe.cards];
      rivalDeckId = node.encounter.enemy.deckId;
      createStoryMatch(
        storyEncounterSnapshot,
        playerEngineCardIds,
        parsed.data.playerDeckId,
      );
    } catch (error) {
      if (error instanceof StoryRequestError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      throw error;
    }
  }
  const [match] = await db
    .insert(playerMatchesTable)
    .values({
      clerkUserId: userId,
      mode: parsed.data.mode,
      playerDeckId: parsed.data.playerDeckId,
      rivalDeckId,
      storyNodeId,
      storyContentVersion,
      storyEncounterSnapshot: storyEncounterSnapshot
        ? { ...storyEncounterSnapshot }
        : null,
      storyProgressionSnapshot,
      playerEngineCardIds,
    })
    .returning();
  res.status(201).json(
    StartPlayerMatchResponse.parse({
      id: match.id,
      mode: match.mode,
      playerDeckId: match.playerDeckId,
      rivalDeckId: match.rivalDeckId,
      storyNodeId: match.storyNodeId,
      contentVersion: match.storyContentVersion,
      encounterSnapshot: match.storyEncounterSnapshot,
      status: "active",
      createdAt: match.createdAt.toISOString(),
    }),
  );
});

router.post(
  "/player/matches/:matchId/complete",
  async (req, res): Promise<void> => {
    const userId = authenticatedUserId(req, res);
    if (!userId) return;
    const params = CompletePlayerMatchParams.safeParse(req.params);
    const parsed = CompletePlayerMatchBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({ error: "Invalid match completion" });
      return;
    }

    const [match] = await db
      .select()
      .from(playerMatchesTable)
      .where(
        and(
          eq(playerMatchesTable.id, params.data.matchId),
          eq(playerMatchesTable.clerkUserId, userId),
        ),
      );
    if (!match) {
      res.status(404).json({ error: "Match not found" });
      return;
    }

    await ensurePlayer(userId);
    let alreadyCompleted = Boolean(match.completedAt);
    let verifiedOutcome = match.outcome as "win" | "loss" | "draw" | null;
    let districtsWon = match.districtsWon ?? 0;
    let verifiedMatch:
      | ReturnType<typeof verifyMatchTranscript>
      | ReturnType<typeof verifyStoryMatchTranscript>
      | null = null;
    let storyProgression: StoryMatchProgressionSnapshot | null = null;

    if (match.mode === "story") {
      try {
        storyProgression = parseStoryMatchProgressionSnapshot(
          match.storyProgressionSnapshot,
        );
        if (storyProgression.nodeId !== match.storyNodeId) {
          throw new Error("Stored story match has mismatched node snapshots");
        }
      } catch (error) {
        req.log.warn({ error, matchId: match.id }, "Rejected stale story match");
        res.status(409).json({
          error: "This story encounter is outdated. Return to the map and start it again.",
        });
        return;
      }
    }

    if (!alreadyCompleted) {
      try {
        verifiedMatch =
          match.mode === "story"
            ? verifyStoryMatchTranscript(
                match.storyEncounterSnapshot as StoryEncounterSnapshot,
                match.playerEngineCardIds ?? [],
                parsed.data.moves,
                match.playerDeckId,
              )
            : verifyMatchTranscript(
                match.playerDeckId,
                match.rivalDeckId,
                parsed.data.moves,
              );
        const winner = getMatchWinner(verifiedMatch);
        verifiedOutcome =
          winner === "player" ? "win" : winner === "cpu" ? "loss" : "draw";
        districtsWon = getDistrictResults(verifiedMatch).filter(
          (district) => district.winner === "player",
        ).length;
      } catch (error) {
        req.log.warn({ error }, "Rejected invalid match transcript");
        res.status(400).json({ error: "Match transcript could not be verified" });
        return;
      }
    }

    if (!verifiedOutcome) {
      res.status(409).json({ error: "Completed match is missing its outcome" });
      return;
    }

    const amounts =
      verifiedOutcome === "win"
        ? { xp: 75, streetRep: 2, softCurrency: 90, packTickets: 0 }
        : verifiedOutcome === "draw"
          ? { xp: 55, streetRep: 1, softCurrency: 60, packTickets: 0 }
          : { xp: 40, streetRep: 1, softCurrency: 45, packTickets: 0 };
    const computedReward =
      match.completedAt
        ? {
            xp: match.rewardXp ?? 0,
            streetRep: match.rewardStreetRep ?? 0,
            softCurrency: match.rewardSoftCurrency ?? 0,
            packTickets: match.rewardPackTickets ?? 0,
          }
        : match.mode === "tutorial" || match.mode === "story"
          ? { xp: 0, streetRep: 0, softCurrency: 0, packTickets: 0 }
          : amounts;

    let grantedStoryRewards =
      (match.storyGrantedRewards as GrantedStoryReward[] | null) ?? [];
    let firstStoryClear = match.storyFirstClear ?? false;
    if (!alreadyCompleted && match.mode !== "story" && match.mode !== "tutorial") {
      const result = await completeStandardMatchReward({
        clerkUserId: userId,
        matchId: match.id,
        outcome: verifiedOutcome,
        districtsWon,
      });
      alreadyCompleted = !result.completed;
    } else if (!alreadyCompleted) {
      const completed = await db.transaction(async (tx) => {
        if (match.mode === "story") {
          await tx.execute(
            sql`select ${playerProfilesTable.clerkUserId} from ${playerProfilesTable} where ${playerProfilesTable.clerkUserId} = ${userId} for update`,
          );
        }
        const [updated] = await tx
          .update(playerMatchesTable)
          .set({
            outcome: verifiedOutcome,
            rounds: 6,
            districtsWon,
            rewardXp: computedReward.xp,
            rewardStreetRep: computedReward.streetRep,
            rewardSoftCurrency: computedReward.softCurrency,
            rewardPackTickets: computedReward.packTickets,
            completedAt: new Date(),
          })
          .where(
            and(
              eq(playerMatchesTable.id, match.id),
              isNull(playerMatchesTable.completedAt),
            ),
          )
          .returning();
        if (!updated) return false;

        if (match.mode === "tutorial") {
          await tx
            .update(playerProfilesTable)
            .set({
              tutorialCompleted: true,
              onboardingStep: "crew",
            })
            .where(
              and(
                eq(playerProfilesTable.clerkUserId, userId),
                eq(playerProfilesTable.onboardingStep, "tutorial"),
              ),
            );
        } else if (match.mode !== "story") {
          await tx
            .update(playerProfilesTable)
            .set({
              xp: sql`${playerProfilesTable.xp} + ${computedReward.xp}`,
              level: sql`1 + floor((${playerProfilesTable.xp} + ${computedReward.xp}) / 250)`,
              streetRep: sql`${playerProfilesTable.streetRep} + ${computedReward.streetRep}`,
              softCurrency: sql`${playerProfilesTable.softCurrency} + ${computedReward.softCurrency}`,
              packTickets: sql`${playerProfilesTable.packTickets} + ${computedReward.packTickets}`,
            })
            .where(eq(playerProfilesTable.clerkUserId, userId));

          const progressKeys = [
            "daily-show-up",
            "weekly-main-character",
            ...(verifiedOutcome === "win" ? ["daily-take-room"] : []),
          ];
          for (const key of progressKeys) {
            await tx
              .update(playerMissionsTable)
              .set({
                progress: sql`least(${playerMissionsTable.goal}, ${playerMissionsTable.progress} + 1)`,
              })
              .where(
                and(
                  eq(playerMissionsTable.clerkUserId, userId),
                  eq(playerMissionsTable.missionKey, key),
                  isNull(playerMissionsTable.claimedAt),
                ),
              );
          }
        }
        if (
          match.mode === "story" &&
          match.storyNodeId &&
          storyProgression &&
          verifiedMatch &&
          match.storyEncounterSnapshot
        ) {
          const [prior] = await tx
            .select()
            .from(playerStoryNodesTable)
            .where(
              and(
                eq(playerStoryNodesTable.clerkUserId, userId),
                eq(playerStoryNodesTable.nodeId, storyProgression.nodeId),
              ),
            );
          const won = verifiedOutcome === "win";
          const stars = won
            ? 1 +
              (districtsWon === 3 ? 1 : 0) +
              (!verifiedMatch.squabbleUsed ? 1 : 0)
            : 0;
          firstStoryClear = won && !prior?.cleared;
          const canonicalCleared = (prior?.cleared ?? false) || won;
          const canonicalStars = Math.max(prior?.stars ?? 0, stars);
          const highestPhase = Math.max(
            prior?.bossProgress.highestPhase ?? 0,
            (verifiedMatch.storyRuntime?.activePhaseIndex ?? -1) + 1,
          );
          const now = new Date();
          await tx
            .insert(playerStoryNodesTable)
            .values({
              clerkUserId: userId,
              chapterId: storyProgression.chapterId,
              nodeId: storyProgression.nodeId,
              cleared: won,
              stars,
              attempts: 1,
              wins: won ? 1 : 0,
              lastOutcome: verifiedOutcome,
              dialogueSeen: prior?.dialogueSeen ?? [],
              bossProgress: { highestPhase },
              firstClearedAt: won ? now : null,
              lastPlayedAt: now,
            })
            .onConflictDoUpdate({
              target: [
                playerStoryNodesTable.clerkUserId,
                playerStoryNodesTable.nodeId,
              ],
              set: {
                cleared: sql`${playerStoryNodesTable.cleared} or ${won}`,
                stars: sql`greatest(${playerStoryNodesTable.stars}, ${stars})`,
                attempts: sql`${playerStoryNodesTable.attempts} + 1`,
                wins: sql`${playerStoryNodesTable.wins} + ${won ? 1 : 0}`,
                lastOutcome: verifiedOutcome,
                bossProgress: { highestPhase },
                firstClearedAt: prior?.firstClearedAt ?? (won ? now : null),
                lastPlayedAt: now,
              },
            });
          if (firstStoryClear) {
            grantedStoryRewards = await grantStoryRewards(
              tx,
              userId,
              storyProgression.chapterId,
              storyProgression.nodeId,
              storyProgression.rewards,
            );
          }
          await tx
            .update(playerMatchesTable)
            .set({
              storyFirstClear: firstStoryClear,
              storyStars: stars,
              storyBossHighestPhase: highestPhase,
              storyGrantedRewards: grantedStoryRewards,
            })
            .where(eq(playerMatchesTable.id, match.id));
          const chapterNumber = Math.max(1, storyProgression.chapterOrder);
          const nodeNumber = storyProgression.nodeOrder + 1;
          await tx
            .update(playerProfilesTable)
            .set({
              storyChapter: sql`greatest(${playerProfilesTable.storyChapter}, ${chapterNumber})`,
              storyNode: sql`case when ${playerProfilesTable.storyChapter} < ${chapterNumber} then ${nodeNumber} when ${playerProfilesTable.storyChapter} = ${chapterNumber} then greatest(${playerProfilesTable.storyNode}, ${nodeNumber}) else ${playerProfilesTable.storyNode} end`,
              storyProgress: sql`coalesce(${playerProfilesTable.storyProgress}, '{}'::jsonb) || ${JSON.stringify({ [storyProgression.nodeId]: { cleared: canonicalCleared, stars: canonicalStars } })}::jsonb`,
            })
            .where(eq(playerProfilesTable.clerkUserId, userId));
        }
        return true;
      });
      alreadyCompleted = !completed;
    }

    const [persistedMatch] = await db
      .select()
      .from(playerMatchesTable)
      .where(
        and(
          eq(playerMatchesTable.id, match.id),
          eq(playerMatchesTable.clerkUserId, userId),
        ),
      );
    if (!persistedMatch?.completedAt || !persistedMatch.outcome) {
      res.status(409).json({ error: "Match completion did not persist" });
      return;
    }
    const persistedOutcome = persistedMatch.outcome as "win" | "loss" | "draw";
    const persistedReward = {
      xp: persistedMatch.rewardXp ?? 0,
      streetRep: persistedMatch.rewardStreetRep ?? 0,
      softCurrency: persistedMatch.rewardSoftCurrency ?? 0,
      packTickets: persistedMatch.rewardPackTickets ?? 0,
    };

    const state = await getPlayerBootstrap(userId);
    const campaign =
      match.mode === "story" ? await getPlayerStoryCampaign(userId) : null;
    const storedStoryResult = getStoredStoryMatchResult(persistedMatch);
    grantedStoryRewards = storedStoryResult.rewards;
    res.json(
      CompletePlayerMatchResponse.parse({
        ...state,
        reward: {
          id: `match-${match.id}`,
          label:
            persistedOutcome === "win"
              ? "Room secured"
              : persistedOutcome === "draw"
                ? "Dead heat"
                : "You still earned rep",
          ...persistedReward,
          descriptions: storedStoryResult.descriptions,
          storyRewards: grantedStoryRewards,
        },
        alreadyCompleted,
        campaign,
        story: storedStoryResult.story,
      }),
    );
  },
);

router.post(
  "/player/missions/:missionId/claim",
  async (req, res): Promise<void> => {
    const userId = authenticatedUserId(req, res);
    if (!userId) return;
    const params = ClaimPlayerMissionParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    await getPlayerBootstrap(userId);
    try {
      await claimMissionReward(userId, params.data.missionId);
    } catch (error) {
      if (error instanceof PlayerRewardError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      throw error;
    }

    res.json(
      ClaimPlayerMissionResponse.parse(await getPlayerBootstrap(userId)),
    );
  },
);

export default router;
