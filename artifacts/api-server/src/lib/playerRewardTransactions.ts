import { advanceCareer, availableCareerChoices, readCareer } from "@workspace/squabblemon-engine/career";
import { battleAchievements } from "@workspace/squabblemon-engine/insights";
import { cardCatalog } from "@workspace/squabblemon-engine/data";
import { and, eq, isNull, isNotNull, lte, sql } from "drizzle-orm";
import {
  db,
  challengeRunsTable,
  playerMatchesTable,
  playerMissionsTable,
  playerProfilesTable,
  type PlayerMatchRecord,
  type PlayerMissionRecord,
} from "@workspace/db";
import type { Match } from "@workspace/squabblemon-engine/gameEngine";
import { ACCOUNT_XP_PER_LEVEL, WELCOME_REWARD, battleEarnings, economyVersionFromSnapshot } from '@workspace/squabblemon-engine/economy';
import { checkpointFor, encounterFor } from '@workspace/squabblemon-engine/challenge';
import { starterRecipes, ROOKIE_FOUNDATION_ID, ROOKIE_DECK_ID, ROOKIE_MENTOR_CORE_IDS, ROOKIE_MENTOR_ID, ROOKIE_FOUNDATION_IDS } from "@workspace/squabblemon-engine/data";
import {
  applyCardXp,
  createCardProgressionSnapshot,
  normalizeCatalogCardId,
  participatingCatalogCardIds,
  type CardProgressionSnapshot,
  type CardXpReward,
} from "./cardProgression";

type RewardOutcome = "win" | "loss" | "draw";

function nextReset(cadence: string, now: Date): Date | null {
  const reset = new Date(now);
  reset.setUTCHours(0, 0, 0, 0);
  if (cadence === "daily") {
    reset.setUTCDate(reset.getUTCDate() + 1);
    return reset;
  }
  if (cadence === "weekly") {
    const daysUntilMonday = (8 - reset.getUTCDay()) % 7 || 7;
    reset.setUTCDate(reset.getUTCDate() + daysUntilMonday);
    return reset;
  }
  return null;
}

export class PlayerRewardError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function lockPlayerProfile(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  clerkUserId: string,
): Promise<void> {
  await tx.execute(
    sql`select ${playerProfilesTable.clerkUserId} from ${playerProfilesTable} where ${playerProfilesTable.clerkUserId} = ${clerkUserId} for update`,
  );
}

async function resetExpiredMissionsInTransaction(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  clerkUserId: string,
  now: Date,
): Promise<void> {
  const expired = await tx
    .select()
    .from(playerMissionsTable)
    .where(
      and(
        eq(playerMissionsTable.clerkUserId, clerkUserId),
        lte(playerMissionsTable.resetAt, now),
      ),
    );
  for (const mission of expired) {
    await tx
      .update(playerMissionsTable)
      .set({
        progress: 0,
        claimedAt: null,
        resetAt: nextReset(mission.cadence, now),
      })
      .where(
        and(
          eq(playerMissionsTable.id, mission.id),
          lte(playerMissionsTable.resetAt, now),
        ),
      );
  }
}

export async function grantFirstCollection(clerkUserId: string): Promise<void> {
  await db.transaction(async tx => {
    await lockPlayerProfile(tx, clerkUserId);
    const [profile] = await tx.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, clerkUserId));
    if (!profile || !["crew", "tutorial"].includes(profile.onboardingStep)) return;
    const ownedCardIds = [...new Set([...profile.ownedCardIds, ...ROOKIE_FOUNDATION_IDS])];
    const savedDecks = [...profile.savedDecks];
    if (!savedDecks.some(deck => deck.id === ROOKIE_DECK_ID)) savedDecks.push({ id: ROOKIE_DECK_ID, name: "My First Gang", cardIds: [...ROOKIE_MENTOR_CORE_IDS], heroCardId: ROOKIE_MENTOR_ID, recipeId: null });
    await tx.update(playerProfilesTable).set({
      starterDeckId: ROOKIE_FOUNDATION_ID, ownedCardIds,
      discoveredCardIds: [...new Set([...profile.discoveredCardIds, ...ownedCardIds])],
      savedDecks, deckSlots: Math.max(profile.deckSlots, savedDecks.length),
      collectionProgress: ownedCardIds.length, onboardingStep: profile.onboardingStep === "tutorial" ? "tutorial" : "reward",
    }).where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  });
}

export async function claimStarterReward(
  clerkUserId: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    await lockPlayerProfile(tx, clerkUserId);
    const [profile] = await tx.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, clerkUserId));
    if (profile?.starterDeckId === ROOKIE_FOUNDATION_ID && profile.onboardingStep === "reward") {
      const [tested] = await tx.select({ id: playerMatchesTable.id }).from(playerMatchesTable).where(and(
        eq(playerMatchesTable.clerkUserId, clerkUserId), sql`${playerMatchesTable.mode} in ('practice', 'tutorial')`,
        eq(playerMatchesTable.playerDeckId, ROOKIE_DECK_ID), isNotNull(playerMatchesTable.completedAt),
      )).limit(1);
      if (!tested) throw new PlayerRewardError("Finish a practice fade with your gang before claiming the welcome reward", 409);
    }
    const [claimed] = await tx
      .update(playerProfilesTable)
      .set({
        starterRewardClaimed: true,
        onboardingStep: "complete",
        softCurrency: sql`${playerProfilesTable.softCurrency} + ${WELCOME_REWARD.softCurrency}`,
        packTickets: sql`${playerProfilesTable.packTickets} + ${WELCOME_REWARD.packTickets}`,
        xp: sql`${playerProfilesTable.xp} + ${WELCOME_REWARD.accountXp}`,
        level: sql`1 + floor((${playerProfilesTable.xp} + ${WELCOME_REWARD.accountXp}) / ${ACCOUNT_XP_PER_LEVEL})`,
        streetRep: sql`${playerProfilesTable.streetRep} + ${WELCOME_REWARD.streetRep}`,
      })
      .where(
        and(
          eq(playerProfilesTable.clerkUserId, clerkUserId),
          eq(playerProfilesTable.starterRewardClaimed, false),
          eq(playerProfilesTable.onboardingStep, "reward"),
        ),
      )
      .returning({ clerkUserId: playerProfilesTable.clerkUserId });
    if (!claimed) return false;
    await tx
      .update(playerMissionsTable)
      .set({ progress: 1 })
      .where(
        and(
          eq(playerMissionsTable.clerkUserId, clerkUserId),
          eq(playerMissionsTable.missionKey, "rookie-road"),
        ),
      );
    return true;
  });
}

export async function claimMissionReward(
  clerkUserId: string,
  missionKey: string,
): Promise<{ claimed: boolean; mission: PlayerMissionRecord }> {
  return db.transaction(async (tx) => {
    await lockPlayerProfile(tx, clerkUserId);
    await resetExpiredMissionsInTransaction(tx, clerkUserId, new Date());
    const [mission] = await tx
      .select()
      .from(playerMissionsTable)
      .where(
        and(
          eq(playerMissionsTable.clerkUserId, clerkUserId),
          eq(playerMissionsTable.missionKey, missionKey),
        ),
      );
    if (!mission) throw new PlayerRewardError("Mission not found", 404);
    if (mission.claimedAt) return { claimed: false, mission };
    if (mission.progress < mission.goal) {
      throw new PlayerRewardError("Mission is not complete", 400);
    }
    const [claimed] = await tx
      .update(playerMissionsTable)
      .set({ claimedAt: new Date() })
      .where(
        and(
          eq(playerMissionsTable.id, mission.id),
          isNull(playerMissionsTable.claimedAt),
        ),
      )
      .returning();
    if (!claimed) return { claimed: false, mission };
    await tx
      .update(playerProfilesTable)
      .set(
        mission.rewardCurrency === "packTickets"
          ? {
              packTickets: sql`${playerProfilesTable.packTickets} + ${mission.rewardAmount}`,
            }
          : {
              softCurrency: sql`${playerProfilesTable.softCurrency} + ${mission.rewardAmount}`,
            },
      )
      .where(eq(playerProfilesTable.clerkUserId, clerkUserId));
    return { claimed: true, mission: claimed };
  });
}

export async function completeStandardMatchReward(input: {
  clerkUserId: string;
  matchId: string;
  outcome: RewardOutcome;
  districtsWon: number;
  verifiedMatch: Match;
  moves?: readonly unknown[];
  challengeRunId?: string | null;
}): Promise<{ completed: boolean; match: PlayerMatchRecord; cardXpRewards: CardXpReward[] }> {
  const challengeDraw = Boolean(input.challengeRunId && input.outcome === "draw");
  return db.transaction(async (tx) => {
    await lockPlayerProfile(tx, input.clerkUserId);
    await resetExpiredMissionsInTransaction(tx, input.clerkUserId, new Date());
    const [profile] = await tx
      .select()
      .from(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkUserId, input.clerkUserId));
    if (!profile) throw new PlayerRewardError("Player profile not found", 404);
    const participantCardIds = challengeDraw
      ? []
      : participatingCatalogCardIds(input.verifiedMatch).filter(id => profile.ownedCardIds.includes(id));
    const [storedMatch] = await tx
      .select({
        playerDeckId: playerMatchesTable.playerDeckId,
        snapshot: playerMatchesTable.playerCardProgressionSnapshot,
      })
      .from(playerMatchesTable)
      .where(
        and(
          eq(playerMatchesTable.id, input.matchId),
          eq(playerMatchesTable.clerkUserId, input.clerkUserId),
        ),
      );
    if (!storedMatch) throw new PlayerRewardError("Fade not found", 404);
    const amounts = challengeDraw
      ? { xp: 0, streetRep: 0, softCurrency: 0, packTickets: 0 }
      : battleEarnings(input.outcome, economyVersionFromSnapshot(storedMatch.snapshot));
    // Pre-upgrade snapshots were an array. They remain reward-safe by
    // rebuilding only from the server-owned recipe and current profile; never
    // access `.cards` on the legacy JSON shape.
    let progressionSnapshot =
      storedMatch.snapshot && !Array.isArray(storedMatch.snapshot)
        ? storedMatch.snapshot as CardProgressionSnapshot
        : null;
    if (!progressionSnapshot && participantCardIds.length > 0) {
      const canonicalRoster = starterRecipes.find(
        (recipe) => recipe.id === storedMatch.playerDeckId,
      )?.cards;
      if (!canonicalRoster) {
        throw new PlayerRewardError("Legacy fade roster is unavailable", 409);
      }
      const owned = new Set(profile.ownedCardIds);
      const compatibleRoster = canonicalRoster.filter(cardId => {
        const catalogId = normalizeCatalogCardId(cardId);
        return catalogId !== null && owned.has(catalogId);
      });
      // A historical recipe may have lost or reordered cards since this match
      // was issued. Keep any verified participating cards that the player
      // still owns so legacy matches can award their earned card XP.
      for (const cardId of input.verifiedMatch.playerCardIds) {
        const catalogId = normalizeCatalogCardId(cardId);
        if (
          catalogId &&
          owned.has(catalogId) &&
          participantCardIds.includes(catalogId) &&
          !compatibleRoster.includes(cardId)
        ) {
          compatibleRoster.push(cardId);
        }
      }
      progressionSnapshot = createCardProgressionSnapshot(
        compatibleRoster,
        profile.ownedCardIds,
        profile.cardProgression,
      );
    }
    if (!progressionSnapshot) {
      progressionSnapshot = createCardProgressionSnapshot(
        starterRecipes.find((recipe) => recipe.id === storedMatch.playerDeckId)?.cards ?? [],
        profile.ownedCardIds,
        profile.cardProgression,
        true,
      );
    }
    const cardXp = applyCardXp(
      profile.cardProgression,
      progressionSnapshot,
      participantCardIds,
      input.outcome,
    );
    const [updated] = await tx
      .update(playerMatchesTable)
      .set({
        outcome: input.outcome,
        rounds: 6,
        districtsWon: input.districtsWon,
        rewardXp: amounts.xp,
        rewardStreetRep: amounts.streetRep,
        rewardSoftCurrency: amounts.softCurrency,
        rewardPackTickets: amounts.packTickets,
        cardXpRewards: cardXp.rewards,
        completedAt: new Date(),
      })
      .where(
        and(
          eq(playerMatchesTable.id, input.matchId),
          eq(playerMatchesTable.clerkUserId, input.clerkUserId),
          isNull(playerMatchesTable.completedAt),
        ),
      )
      .returning();
    if (updated) {
      if (!challengeDraw) {
        await advanceBattleMissions(tx, input.clerkUserId, input.outcome);
        const facts = battleAchievements(input.verifiedMatch);
        for (const key of [facts.cleansed && 'weekly-cleanse', facts.movementWin && 'weekly-movement', facts.changedCrew && input.verifiedMatch.storyEncounter?.activity?.kind !== 'draft' && 'weekly-experiment'].filter(Boolean)) {
          await tx.update(playerMissionsTable).set({ progress: sql`least(${playerMissionsTable.goal}, ${playerMissionsTable.progress} + 1)` })
            .where(and(eq(playerMissionsTable.clerkUserId, input.clerkUserId), eq(playerMissionsTable.missionKey, key as string), isNull(playerMissionsTable.claimedAt)));
        }
      }
      const career = challengeDraw
        ? { progress: profile.storyProgress.gameplay, cosmetics: profile.unlockedCosmeticIds }
        : advanceCareer(profile.storyProgress.gameplay, input.verifiedMatch, profile.ownedCardIds, profile.unlockedCosmeticIds);
      if (input.challengeRunId) {
        const [run] = await tx.select().from(challengeRunsTable)
          .where(and(
            eq(challengeRunsTable.id, input.challengeRunId),
            eq(challengeRunsTable.clerkUserId, input.clerkUserId),
          ))
          .for("update");
        if (!run) throw new PlayerRewardError("Challenge run no longer exists", 409);
        const encounter = run.encounterSnapshot as { playerMatchId?: string };
        if (run.status === "active" && encounter.playerMatchId === input.matchId) {
          const won = input.outcome === "win";
          const draw = input.outcome === "draw";
          const moves = structuredClone(input.moves ?? []);
          await tx.update(challengeRunsTable).set({
            status: won || draw ? "active" : "settled",
            wins: won ? run.wins + 1 : run.wins,
            encounterIndex: won ? run.encounterIndex + 1 : run.encounterIndex,
            encounterSnapshot: won
              ? encounterFor(run.seed, run.encounterIndex + 1)
              : { ...encounter, playerMatchId: "" },
            transcripts: [
              ...(run.transcripts as Array<Record<string, unknown>>),
              {
                matchId: input.matchId,
                outcome: input.outcome,
                moves,
                checkpoint: checkpointFor(input.matchId, moves),
              },
            ],
            updatedAt: new Date(),
            completedAt: won || draw ? run.completedAt : new Date(),
          }).where(eq(challengeRunsTable.id, run.id));
        }
      }
      await tx
        .update(playerProfilesTable)
        .set({
          xp: sql`${playerProfilesTable.xp} + ${amounts.xp}`,
          level: sql`1 + floor((${playerProfilesTable.xp} + ${amounts.xp}) / ${ACCOUNT_XP_PER_LEVEL})`,
          streetRep: sql`${playerProfilesTable.streetRep} + ${amounts.streetRep}`,
          softCurrency: sql`${playerProfilesTable.softCurrency} + ${amounts.softCurrency}`,
          packTickets: sql`${playerProfilesTable.packTickets} + ${amounts.packTickets}`,
          cardProgression: cardXp.progression,
          storyProgress: { ...profile.storyProgress, gameplay: career.progress },
          unlockedCosmeticIds: career.cosmetics,
        })
        .where(eq(playerProfilesTable.clerkUserId, input.clerkUserId));
    }
    const [persisted] = await tx
      .select()
      .from(playerMatchesTable)
      .where(
        and(
          eq(playerMatchesTable.id, input.matchId),
          eq(playerMatchesTable.clerkUserId, input.clerkUserId),
        ),
      );
    if (!persisted?.completedAt || !persisted.outcome) {
      throw new PlayerRewardError("Fade completion did not persist", 409);
    }
    return {
      completed: Boolean(updated),
      match: persisted,
      cardXpRewards: (persisted.cardXpRewards ?? []) as CardXpReward[],
    };
  });
}

/** Caller holds the player row lock and invokes this only for a newly completed match. */
export async function advanceBattleMissions(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], userId: string, outcome: RewardOutcome) {
  await resetExpiredMissionsInTransaction(tx, userId, new Date());
  for (const key of ['daily-show-up', 'weekly-main-character', ...(outcome === 'win' ? ['daily-take-room'] : [])]) {
    await tx.update(playerMissionsTable).set({ progress: sql`least(${playerMissionsTable.goal}, ${playerMissionsTable.progress} + 1)` })
      .where(and(eq(playerMissionsTable.clerkUserId, userId), eq(playerMissionsTable.missionKey, key), isNull(playerMissionsTable.claimedAt)));
  }
}

export async function resetExpiredPlayerMissions(
  clerkUserId: string,
  now: Date,
): Promise<void> {
  await db.transaction(async (tx) => {
    await lockPlayerProfile(tx, clerkUserId);
    await resetExpiredMissionsInTransaction(tx, clerkUserId, now);
  });
}

/** A permanent experiment milestone buys one chosen Common; profile lock makes retries safe. */
export async function claimExperimentCard(userId: string, cardId: string) {
  if (!cardCatalog.some(c => c.catalogId === cardId && c.rarity === 'Common')) throw new PlayerRewardError('Choose a Common card', 400);
  return db.transaction(async tx => {
    await lockPlayerProfile(tx, userId);
    const [profile] = await tx.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userId));
    if (!profile) throw new PlayerRewardError('Player not found', 404);
    const progress = readCareer(profile.storyProgress.gameplay);
    if (progress.choices.includes(cardId)) return false;
    if (!availableCareerChoices(progress)) throw new PlayerRewardError('Complete an experiment milestone first', 409);
    if (profile.ownedCardIds.includes(cardId)) throw new PlayerRewardError('You already own this card', 409);
    const owned = [...profile.ownedCardIds, cardId];
    await tx.update(playerProfilesTable).set({ ownedCardIds: owned, discoveredCardIds: [...new Set([...profile.discoveredCardIds, cardId])], collectionProgress: owned.length,
      storyProgress: { ...profile.storyProgress, gameplay: { ...progress, choices: [...progress.choices, cardId] } } }).where(eq(playerProfilesTable.clerkUserId, userId));
    return true;
  });
}
