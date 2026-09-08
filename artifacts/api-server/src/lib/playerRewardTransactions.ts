import { and, eq, isNull, lte, sql } from "drizzle-orm";
import {
  db,
  playerMatchesTable,
  playerMissionsTable,
  playerProfilesTable,
  type PlayerMatchRecord,
  type PlayerMissionRecord,
} from "@workspace/db";
import type { Match } from "@workspace/squabblemon-engine/gameEngine";
import { starterRecipes } from "@workspace/squabblemon-engine/data";
import {
  applyCardXp,
  createCardProgressionSnapshot,
  participatingCatalogCardIds,
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

export async function claimStarterReward(
  clerkUserId: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    await lockPlayerProfile(tx, clerkUserId);
    const [claimed] = await tx
      .update(playerProfilesTable)
      .set({
        starterRewardClaimed: true,
        onboardingStep: "complete",
        softCurrency: sql`${playerProfilesTable.softCurrency} + 250`,
        packTickets: sql`${playerProfilesTable.packTickets} + 1`,
        xp: sql`${playerProfilesTable.xp} + 100`,
        streetRep: sql`${playerProfilesTable.streetRep} + 5`,
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
}): Promise<{ completed: boolean; match: PlayerMatchRecord; cardXpRewards: CardXpReward[] }> {
  const amounts = { xp: 0, streetRep: 0, softCurrency: 0, packTickets: 0 };
  return db.transaction(async (tx) => {
    await lockPlayerProfile(tx, input.clerkUserId);
    await resetExpiredMissionsInTransaction(tx, input.clerkUserId, new Date());
    const [profile] = await tx
      .select()
      .from(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkUserId, input.clerkUserId));
    if (!profile) throw new PlayerRewardError("Player profile not found", 404);
    const participantCardIds = participatingCatalogCardIds(input.verifiedMatch);
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
    if (!storedMatch) throw new PlayerRewardError("Match not found", 404);
    let progressionSnapshot = storedMatch.snapshot ?? [];
    if (!storedMatch.snapshot && participantCardIds.length > 0) {
      const canonicalRoster = starterRecipes.find(
        (recipe) => recipe.id === storedMatch.playerDeckId,
      )?.cards;
      if (!canonicalRoster) {
        throw new PlayerRewardError("Legacy match roster is unavailable", 409);
      }
      progressionSnapshot = createCardProgressionSnapshot(
        canonicalRoster,
        profile.ownedCardIds,
        profile.cardProgression,
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
      await tx
        .update(playerProfilesTable)
        .set({
          xp: sql`${playerProfilesTable.xp} + ${amounts.xp}`,
          level: sql`1 + floor((${playerProfilesTable.xp} + ${amounts.xp}) / 250)`,
          streetRep: sql`${playerProfilesTable.streetRep} + ${amounts.streetRep}`,
          softCurrency: sql`${playerProfilesTable.softCurrency} + ${amounts.softCurrency}`,
          packTickets: sql`${playerProfilesTable.packTickets} + ${amounts.packTickets}`,
          cardProgression: cardXp.progression,
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
      throw new PlayerRewardError("Match completion did not persist", 409);
    }
    return {
      completed: Boolean(updated),
      match: persisted,
      cardXpRewards: (persisted.cardXpRewards ?? []) as CardXpReward[],
    };
  });
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