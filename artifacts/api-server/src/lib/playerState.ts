import {
  and,
  asc,
  desc,
  eq,
  isNotNull,
  sql,
} from "drizzle-orm";
import {
  db,
  playerCollectionClaimsTable,
  playerMatchesTable,
  playerMissionsTable,
  playerPackOpeningsTable,
  playerProfilesTable,
  type PlayerPackOpeningRecord,
  type PlayerMissionRecord,
  type PlayerProfileRecord,
} from "@workspace/db";
import {
  catalogCardByEngineId,
  catalogCardById,
  starterRecipes,
  validateSavedDeck,
} from "@workspace/squabblemon-engine/data";
import { COLLECTION_ROAD, STREET_PACK_CONFIG } from "./collectionEconomy";
import { resetExpiredPlayerMissions } from "./playerRewardTransactions";
import {
  normalizeCardProgress,
  type CardProgressionMap,
} from "@workspace/squabblemon-engine/cardProgression";

const missionTemplates = [
  {
    missionKey: "rookie-road",
    cadence: "onboarding",
    title: "Finish Rookie Road",
    description: "Complete the guided match and choose your first crew.",
    goal: 1,
    rewardCurrency: "packTickets",
    rewardAmount: 1,
  },
  {
    missionKey: "daily-show-up",
    cadence: "daily",
    title: "Show Up",
    description: "Finish one match today.",
    goal: 1,
    rewardCurrency: "softCurrency",
    rewardAmount: 100,
  },
  {
    missionKey: "daily-take-room",
    cadence: "daily",
    title: "Take A Room",
    description: "Win one match today.",
    goal: 1,
    rewardCurrency: "softCurrency",
    rewardAmount: 150,
  },
  {
    missionKey: "weekly-main-character",
    cadence: "weekly",
    title: "Main Character Week",
    description: "Finish five matches this week. No streak required.",
    goal: 5,
    rewardCurrency: "packTickets",
    rewardAmount: 2,
  },
] as const;

function nextDailyReset(): Date {
  const reset = new Date();
  reset.setUTCHours(24, 0, 0, 0);
  return reset;
}

function nextWeeklyReset(): Date {
  const reset = new Date();
  reset.setUTCHours(0, 0, 0, 0);
  const daysUntilMonday = (8 - reset.getUTCDay()) % 7 || 7;
  reset.setUTCDate(reset.getUTCDate() + daysUntilMonday);
  return reset;
}

function resetForCadence(cadence: string): Date | null {
  if (cadence === "daily") return nextDailyReset();
  if (cadence === "weekly") return nextWeeklyReset();
  return null;
}

export async function ensurePlayer(clerkUserId: string): Promise<void> {
  await db
    .insert(playerProfilesTable)
    .values({ clerkUserId })
    .onConflictDoNothing();

  for (const template of missionTemplates) {
    await db
      .insert(playerMissionsTable)
      .values({
        clerkUserId,
        ...template,
        resetAt: resetForCadence(template.cadence),
      })
      .onConflictDoNothing();
  }

  const now = new Date();
  await resetExpiredPlayerMissions(clerkUserId, now);

  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select ${playerProfilesTable.clerkUserId} from ${playerProfilesTable} where ${playerProfilesTable.clerkUserId} = ${clerkUserId} for update`,
    );
    const [current] = await tx
      .select()
      .from(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkUserId, clerkUserId));
    if (!current) return;

    const normalizeCardId = (cardId: string) =>
      catalogCardById[cardId]?.catalogId ??
      catalogCardByEngineId[cardId]?.catalogId ??
      null;
    const normalizedOwned = [
      ...new Set(
        current.ownedCardIds
          .map(normalizeCardId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const recipeId = current.starterDeckId ?? null;
    const discovered = new Set(
      current.discoveredCardIds
        .map(normalizeCardId)
        .filter((id): id is string => Boolean(id)),
    );
    for (const id of normalizedOwned) discovered.add(id);
    if (recipeId) {
      for (const starter of starterRecipes) {
        discovered.add(starter.hero);
      }
    }
    const normalizedDecks = current.savedDecks.map((deck) => {
      const inferredRecipeId =
        deck.recipeId ??
        (deck.id.startsWith("starter-")
          ? deck.id.replace(/^starter-/, "")
          : null);
      const inferredRecipe = starterRecipes.find(
        (item) => item.id === inferredRecipeId,
      );
      const cardIds = deck.cardIds
        .map(normalizeCardId)
        .filter((id): id is string => Boolean(id))
        .slice(0, 7);
      return {
        id: deck.id,
        name: deck.name,
        cardIds,
        heroCardId:
          normalizeCardId(deck.heroCardId ?? "") ??
          (inferredRecipe
            ? inferredRecipe.hero
            : cardIds[0] ?? ""),
        recipeId: inferredRecipeId,
      };
    });
    const equippedVariants = Object.fromEntries(
      Object.entries(current.equippedVariants ?? {}).filter(([cardId, variantId]) => {
        const card = catalogCardById[cardId];
        return Boolean(
          card &&
          normalizedOwned.includes(cardId) &&
          current.ownedVariants.includes(variantId) &&
          card.variantSlots.some((slot) => slot.id === variantId),
        );
      }),
    );
    const cardProgression: CardProgressionMap = Object.fromEntries(
      normalizedOwned.map((cardId) => [
        cardId,
        normalizeCardProgress(current.cardProgression?.[cardId]),
      ]),
    );

    await tx
      .update(playerProfilesTable)
      .set({
        lastActiveAt: now,
        ownedCardIds: normalizedOwned,
        cardProgression,
        discoveredCardIds: [...discovered],
        collectionProgress: normalizedOwned.length,
        savedDecks: normalizedDecks,
        equippedVariants,
      })
      .where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  });
}

export async function hasVerifiedTutorialMatch(
  clerkUserId: string,
): Promise<boolean> {
  const [match] = await db
    .select({ id: playerMatchesTable.id })
    .from(playerMatchesTable)
    .where(
      and(
        eq(playerMatchesTable.clerkUserId, clerkUserId),
        eq(playerMatchesTable.mode, "tutorial"),
        isNotNull(playerMatchesTable.completedAt),
      ),
    )
    .limit(1);
  return Boolean(match);
}

export function serializePackOpening(opening: PlayerPackOpeningRecord) {
  return {
    id: opening.id,
    oddsVersion: opening.oddsVersion,
    paymentMethod: opening.paymentMethod,
    cost: opening.cost,
    rewards: opening.rewards,
    pityBefore: opening.pityBefore,
    pityAfter: opening.pityAfter,
    createdAt: opening.createdAt.toISOString(),
  };
}

function serializeProfile(
  profile: PlayerProfileRecord,
  packHistory: PlayerPackOpeningRecord[],
) {
  return {
    id: profile.clerkUserId,
    displayName: profile.displayName,
    avatarKey: profile.avatarKey,
    onboardingStep: profile.onboardingStep,
    starterDeckId: profile.starterDeckId,
    streetRep: profile.streetRep,
    xp: profile.xp,
    level: profile.level,
    softCurrency: profile.softCurrency,
    packTickets: profile.packTickets,
    styleShards: profile.styleShards,
    packPity: profile.packPity,
    deckSlots: profile.deckSlots,
    cosmeticCurrency: profile.cosmeticCurrency,
    collectionProgress: profile.collectionProgress,
    storyChapter: profile.storyChapter,
    storyNode: profile.storyNode,
    tutorialCompleted: profile.tutorialCompleted,
    starterRewardClaimed: profile.starterRewardClaimed,
    ageConfirmedAt: profile.ageConfirmedAt?.toISOString() ?? null,
    termsAcceptedAt: profile.termsAcceptedAt?.toISOString() ?? null,
    settings: profile.settings,
    ownedCardIds: profile.ownedCardIds,
    cardProgression: profile.cardProgression,
    discoveredCardIds: profile.discoveredCardIds,
    ownedVariants: profile.ownedVariants,
    equippedVariants: profile.equippedVariants,
    unlockedCosmeticIds: profile.unlockedCosmeticIds,
    savedDecks: profile.savedDecks.map((deck) => {
      const heroCardId = deck.heroCardId ?? deck.cardIds[0] ?? "";
      const legality = validateSavedDeck(
        deck.cardIds,
        profile.ownedCardIds,
        heroCardId,
      );
      return {
        id: deck.id,
        name: deck.name,
        cardIds: deck.cardIds,
        heroCardId,
        recipeId: deck.recipeId ?? null,
        valid: legality.valid,
        issues: legality.issues,
      };
    }),
    storyProgress: profile.storyProgress,
    inbox: profile.inbox,
    packHistory: packHistory.map(serializePackOpening),
    lastActiveAt: profile.lastActiveAt.toISOString(),
  };
}

function serializeMission(mission: PlayerMissionRecord) {
  const status = mission.claimedAt
    ? "claimed"
    : mission.progress >= mission.goal
      ? "claimable"
      : "active";
  return {
    id: mission.missionKey,
    cadence: mission.cadence,
    title: mission.title,
    description: mission.description,
    progress: mission.progress,
    goal: mission.goal,
    rewardCurrency: mission.rewardCurrency,
    rewardAmount: mission.rewardAmount,
    status,
    resetAt: mission.resetAt?.toISOString() ?? null,
  };
}

function getNextAction(
  profile: PlayerProfileRecord,
  missions: PlayerMissionRecord[],
) {
  if (profile.onboardingStep !== "complete") {
    const messages: Record<string, [string, string]> = {
      profile: ["Create your fighter tag", "Confirm your profile to begin."],
      tutorial: ["Learn the streets", "Play the guided Rookie Road match."],
      crew: ["Choose your first crew", "Pick a playstyle to unlock its cards."],
      reward: ["Claim your starter drop", "Open your guaranteed first reward."],
    };
    const [title, description] =
      messages[profile.onboardingStep] ?? messages.profile;
    return {
      id: `onboarding-${profile.onboardingStep}`,
      eyebrow: "Rookie Road",
      title,
      description,
      destination: "onboarding",
      rewardLabel: "Starter crew + 1 Street Pack",
    };
  }

  const claimable = missions.find(
    (mission) => !mission.claimedAt && mission.progress >= mission.goal,
  );
  if (claimable) {
    return {
      id: `claim-${claimable.missionKey}`,
      eyebrow: "Reward ready",
      title: claimable.title,
      description: "Your work is done. Claim the drop.",
      destination: "missions",
      rewardLabel:
        claimable.rewardCurrency === "packTickets"
          ? `+${claimable.rewardAmount} pack ticket${claimable.rewardAmount === 1 ? "" : "s"}`
          : `+${claimable.rewardAmount} clout`,
    };
  }

  if (profile.storyNode === 0) {
    return {
      id: "story-first-node",
      eyebrow: "Chapter 1",
      title: "Welcome to the Block",
      description: "Your first story rival is waiting.",
      destination: "story",
      rewardLabel: "Guaranteed card",
    };
  }

  return {
    id: "play-practice",
    eyebrow: "Keep moving",
    title: "Take another room",
    description: "Run a practice match to earn Street Rep and Clout.",
    destination: "play",
    rewardLabel: "+40–90 Clout",
  };
}

export async function getPlayerBootstrap(clerkUserId: string) {
  await ensurePlayer(clerkUserId);
  const [profile] = await db
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  const missions = await db
    .select()
    .from(playerMissionsTable)
    .where(eq(playerMissionsTable.clerkUserId, clerkUserId))
    .orderBy(asc(playerMissionsTable.id));
  const packHistory = await db
    .select()
    .from(playerPackOpeningsTable)
    .where(eq(playerPackOpeningsTable.clerkUserId, clerkUserId))
    .orderBy(desc(playerPackOpeningsTable.createdAt))
    .limit(20);
  const roadClaims = await db
    .select({ milestoneKey: playerCollectionClaimsTable.milestoneKey })
    .from(playerCollectionClaimsTable)
    .where(eq(playerCollectionClaimsTable.clerkUserId, clerkUserId));

  if (!profile) {
    throw new Error("Player profile could not be provisioned");
  }

  return {
    profile: serializeProfile(profile, packHistory),
    missions: missions.map(serializeMission),
    nextAction: getNextAction(profile, missions),
    packConfig: STREET_PACK_CONFIG,
    collectionRoad: COLLECTION_ROAD.map((milestone) => ({
      id: milestone.id,
      threshold: milestone.threshold,
      title: milestone.title,
      description: milestone.description,
      rewardLabel: milestone.rewardLabel,
      cardId: milestone.cardId,
      status: roadClaims.some(
        (claim) => claim.milestoneKey === milestone.id,
      )
        ? ("claimed" as const)
        : profile.ownedCardIds.length >= milestone.threshold
          ? ("claimable" as const)
          : ("locked" as const),
    })),
  };
}
