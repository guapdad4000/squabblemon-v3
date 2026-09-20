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
  validateSavedDeck, DECK_SIZE, upgradeLegacySavedDeck,
  ROOKIE_FOUNDATION_ID, ROOKIE_DECK_ID, ROOKIE_MENTOR_ID,
} from "@workspace/squabblemon-engine/data";
import { COLLECTION_ROAD, STREET_PACK_CONFIG, STREET_PACK_TEN_PULL_CONFIG } from "./collectionEconomy";
import { resetExpiredPlayerMissions } from "./playerRewardTransactions";
import {
  normalizeCardProgress,
  type CardProgressionMap,
} from "@workspace/squabblemon-engine/cardProgression";

/** Legacy launch roster IDs. Existing ownership is preserved; new accounts earn these. */
export const CITY_NEVER_SLEEPS_CATALOG_IDS = [
  "barber", "bottle", "sneaker", "church", "landlord",
  "carmeet", "promoter", "nail", "og", "delivery",
].map((engineId) => {
  const card = catalogCardByEngineId[engineId];
  if (!card) throw new Error(`Missing City Never Sleeps catalog card: ${engineId}`);
  return card.catalogId;
});

const missionTemplates = [
  { missionKey: 'weekly-cleanse', cadence: 'weekly', title: 'Clear the Air', description: 'Cleanse a friendly card in a verified practice fade.', goal: 1, rewardCurrency: 'softCurrency', rewardAmount: 100 },
  { missionKey: 'weekly-movement', cadence: 'weekly', title: 'Make Room', description: 'Win practice with a moved ally in a district you hold.', goal: 1, rewardCurrency: 'softCurrency', rewardAmount: 100 },
  { missionKey: 'weekly-experiment', cadence: 'weekly', title: 'Try Something New', description: 'Finish practice after changing at least one card from your last tested gang. Drafts do not count.', goal: 1, rewardCurrency: 'softCurrency', rewardAmount: 100 },
  {
    missionKey: "rookie-road",
    cadence: "onboarding",
    title: "Finish Rookie Road",
    description: "Complete the guided fade and choose your first gang.",
    goal: 1,
    rewardCurrency: "packTickets",
    rewardAmount: 1,
  },
  {
    missionKey: "daily-show-up",
    cadence: "daily",
    title: "Show Up",
    description: "Finish one fade today.",
    goal: 1,
    rewardCurrency: "softCurrency",
    rewardAmount: 100,
  },
  {
    missionKey: "daily-take-room",
    cadence: "daily",
    title: "Take A Room",
    description: "Win one fade today.",
    goal: 1,
    rewardCurrency: "softCurrency",
    rewardAmount: 150,
  },
  {
    missionKey: "weekly-main-character",
    cadence: "weekly",
    title: "Main Character Week",
    description: "Finish five fades this week. No streak required.",
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
      cardId;
    // Profile reads must not delete newer cards during a rolling deploy or rollback.
    // Recover ownership only from immutable, server-issued card reward receipts.
    const earnedCards = await tx.execute<{ cardId: string }>(sql`
      select distinct reward->>'cardId' as "cardId"
      from ${playerPackOpeningsTable},
        lateral jsonb_array_elements(${playerPackOpeningsTable.rewards}) as reward
      where ${playerPackOpeningsTable.clerkUserId} = ${clerkUserId}
        and reward->>'kind' = 'card'
        and reward->>'cardId' is not null
    `);
    const normalizedOwned = [
      ...new Set(
        [...current.ownedCardIds, ...earnedCards.rows.map(reward => reward.cardId),
          ...(current.starterDeckId || current.tutorialCompleted || current.starterRewardClaimed ? [ROOKIE_MENTOR_ID] : [])]
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
      const normalizedCards = deck.cardIds
        .map(normalizeCardId)
        .filter((id): id is string => Boolean(id))
        .slice(0, DECK_SIZE);
      const cardIds = deck.deckSize === undefined ? upgradeLegacySavedDeck(normalizedCards, normalizedOwned) : normalizedCards;
      return {
        deckSize: DECK_SIZE,
        id: deck.id,
        name: deck.name,
        cardIds,
        heroCardId:
          (deck.heroCardId ? normalizeCardId(deck.heroCardId) : null) ??
          (inferredRecipe
            ? inferredRecipe.hero
            : cardIds[0] ?? ""),
        recipeId: inferredRecipeId,
      };
    });
    const equippedVariants = Object.fromEntries(
      Object.entries(current.equippedVariants ?? {}).filter(([cardId, variantId]) => {
        return Boolean(
          normalizedOwned.includes(cardId) &&
          current.ownedVariants.includes(variantId),
        );
      }),
    );
    const cardProgression: CardProgressionMap = Object.fromEntries(
      normalizedOwned.map((cardId) => [
        cardId,
        !catalogCardById[cardId] && current.cardProgression?.[cardId]
          ? current.cardProgression[cardId]
          : normalizeCardProgress(current.cardProgression?.[cardId]),
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
  // Derive pullCount from the persisted odds version so the UI can render the
  // upgraded ten-pull presentation for ten-pull openings without a schema
  // migration. Single-pack openings keep pullCount=1.
  const pullCount = opening.oddsVersion === "street-pack-ten-v1" ? 10 : 1;
  return {
    id: opening.id,
    oddsVersion: opening.oddsVersion,
    paymentMethod: opening.paymentMethod,
    cost: opening.cost,
    pullCount,
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
    unlockedCharacterIds: profile.unlockedCharacterIds ?? [],
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
      tutorial: ["Learn the streets", "Play the guided Rookie Road fade."],
      crew: ["Make it your gang", "Open your collection and build around the cards you like."],
      reward: ["Build and test your gang", "Choose a card, save your deck, and try it in practice."],
    };
    const [title, description] =
      messages[profile.onboardingStep] ?? messages.profile;
    return {
      id: `onboarding-${profile.onboardingStep}`,
      eyebrow: "Rookie Road",
      title,
      description,
      destination: "onboarding",
      rewardLabel: "Starter gang + 1 Street Pack",
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
    eyebrow: "Build your gang",
    title: "XP Training",
    description: "Train against a fair CPU rival. Played owned cards earn XP even when you lose.",
    destination: "play",
    rewardLabel: "20–30 Card XP per participant",
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

  const nextAction = getNextAction(profile, missions);
  if (profile.starterDeckId === ROOKIE_FOUNDATION_ID && profile.onboardingStep === "reward") {
    const [tested] = await db.select({ id: playerMatchesTable.id }).from(playerMatchesTable).where(and(
      eq(playerMatchesTable.clerkUserId, clerkUserId), sql`${playerMatchesTable.mode} in ('practice', 'tutorial')`,
      eq(playerMatchesTable.playerDeckId, ROOKIE_DECK_ID), isNotNull(playerMatchesTable.completedAt),
    )).limit(1);
    if (tested) { nextAction.id = "rookie-tested"; nextAction.title = "Your gang is ready"; }
  }

  return {
    profile: serializeProfile(profile, packHistory),
    missions: missions.map(serializeMission),
    nextAction,
    packConfig: STREET_PACK_CONFIG,
    tenPullConfig: STREET_PACK_TEN_PULL_CONFIG,
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
