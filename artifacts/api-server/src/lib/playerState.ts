import { packReceiptPullCount, type PullSeasonReward } from '@workspace/squabblemon-engine/packRules';
import { normalizeStyleShardBalances } from '@workspace/squabblemon-engine/styleShards';
import { resolveReactionTray } from '@workspace/squabblemon-engine/reactions';
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  inArray,
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
import { resetExpiredMissionsInTransaction } from "./playerRewardTransactions";
import {
  normalizeCardProgress,
  type CardProgressionMap,
} from "@workspace/squabblemon-engine/cardProgression";
import { MISSION_TEMPLATES } from "@workspace/squabblemon-engine/economy";

/** Legacy launch roster IDs. Existing ownership is preserved; new accounts earn these. */
export const CITY_NEVER_SLEEPS_CATALOG_IDS = [
  "barber", "bottle", "sneaker", "church", "landlord",
  "carmeet", "promoter", "nail", "og", "delivery",
].map((engineId) => {
  const card = catalogCardByEngineId[engineId];
  if (!card) throw new Error(`Missing City Never Sleeps catalog card: ${engineId}`);
  return card.catalogId;
});

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

/** Profile columns read by initialization's normalization and recovery pass. */
const normalizationColumns = {
  ownedCardIds: playerProfilesTable.ownedCardIds,
  starterDeckId: playerProfilesTable.starterDeckId,
  tutorialCompleted: playerProfilesTable.tutorialCompleted,
  starterRewardClaimed: playerProfilesTable.starterRewardClaimed,
  discoveredCardIds: playerProfilesTable.discoveredCardIds,
  collectionProgress: playerProfilesTable.collectionProgress,
  savedDecks: playerProfilesTable.savedDecks,
  equippedVariants: playerProfilesTable.equippedVariants,
  ownedVariants: playerProfilesTable.ownedVariants,
  cardProgression: playerProfilesTable.cardProgression,
  lastActiveAt: playerProfilesTable.lastActiveAt,
};
type NormalizationProfile = Pick<PlayerProfileRecord, keyof typeof normalizationColumns>;
type Executor = Pick<typeof db, "execute">;

/**
 * Card IDs from immutable, server-issued card reward receipts. Profile reads must
 * not delete newer cards during a rolling deploy or rollback, so ownership is
 * recovered only from these receipts.
 */
async function earnedReceiptCardIds(executor: Executor, clerkUserId: string): Promise<string[]> {
  const earnedCards = await executor.execute<{ cardId: string }>(sql`
      select distinct reward->>'cardId' as "cardId"
      from ${playerPackOpeningsTable},
        lateral jsonb_array_elements(${playerPackOpeningsTable.rewards}) as reward
      where ${playerPackOpeningsTable.clerkUserId} = ${clerkUserId}
        and reward->>'kind' = 'card'
        and reward->>'cardId' is not null
    `);
  return earnedCards.rows.map(reward => reward.cardId);
}

/**
 * JSON text with object keys sorted. PostgreSQL jsonb does not preserve object key
 * order (it stores keys by length, then bytes), so a plain JSON.stringify of a
 * value read back from jsonb never matches freshly built objects and made every
 * read rewrite unchanged decks/progression. Array order stays significant;
 * undefined-valued keys are dropped exactly as JSON.stringify (and jsonb) do.
 */
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : item);
}

function lastActiveIsStale(current: Pick<NormalizationProfile, "lastActiveAt">, now: Date): boolean {
  return !current.lastActiveAt || now.getTime() - current.lastActiveAt.getTime() > 5 * 60_000;
}

/**
 * Pure ownership/deck/variant/progression normalization. Shared by the unlocked
 * pre-check and the locked repair so both decide "changed" identically.
 */
function normalizeProfileState(current: NormalizationProfile, earnedCardIds: string[], now: Date) {
  const normalizeCardId = (cardId: string) =>
    catalogCardById[cardId]?.catalogId ??
    catalogCardByEngineId[cardId]?.catalogId ??
    cardId;
  const normalizedOwned = [
    ...new Set(
      [...current.ownedCardIds, ...earnedCardIds,
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

  const discoveredList = [...discovered];
  const normalizedChanged =
    normalizedOwned.length !== current.ownedCardIds.length ||
    normalizedOwned.some((id, idx) => id !== current.ownedCardIds[idx]) ||
    discoveredList.length !== current.discoveredCardIds.length ||
    discoveredList.some((id, idx) => id !== current.discoveredCardIds[idx]) ||
    current.collectionProgress !== normalizedOwned.length ||
    canonicalJson(normalizedDecks) !== canonicalJson(current.savedDecks) ||
    canonicalJson(equippedVariants) !== canonicalJson(current.equippedVariants ?? {}) ||
    canonicalJson(cardProgression) !== canonicalJson(current.cardProgression ?? {});
  const lastActiveStale = lastActiveIsStale(current, now);
  return {
    needsWrite: normalizedChanged || lastActiveStale,
    update: {
      lastActiveAt: now,
      ownedCardIds: normalizedOwned,
      cardProgression,
      discoveredCardIds: discoveredList,
      collectionProgress: normalizedOwned.length,
      savedDecks: normalizedDecks,
      equippedVariants,
    },
  };
}

/**
 * Lock-free pre-check: true only when initialization would change nothing — the
 * profile exists, every mission template is provisioned, no mission cadence has
 * expired, ownership/decks/variants/progression are already normalized and
 * lastActiveAt is fresh. Any doubt falls through to the locked path, which
 * re-reads and re-decides under the row lock.
 */
async function playerIsSettled(clerkUserId: string, now: Date): Promise<boolean> {
  const [profiles, missions] = await Promise.all([
    db
      .select(normalizationColumns)
      .from(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkUserId, clerkUserId)),
    db
      .select({ missionKey: playerMissionsTable.missionKey, resetAt: playerMissionsTable.resetAt })
      .from(playerMissionsTable)
      .where(eq(playerMissionsTable.clerkUserId, clerkUserId)),
  ]);
  const [current] = profiles;
  if (!current || lastActiveIsStale(current, now)) return false;
  const provisioned = new Set(missions.map(mission => mission.missionKey));
  if (MISSION_TEMPLATES.some(template => !provisioned.has(template.missionKey))) return false;
  if (missions.some(mission => mission.resetAt && mission.resetAt.getTime() <= now.getTime())) return false;
  // Only scan receipts once the cheap checks pass, so a stale or new player
  // pays for the receipt scan once (under the lock), not twice.
  return !normalizeProfileState(current, await earnedReceiptCardIds(db, clerkUserId), now).needsWrite;
}

export async function ensurePlayer(clerkUserId: string): Promise<void> {
  // Settled players (the common repeat-bootstrap case) take no row lock, open no
  // transaction and issue no writes.
  if (await playerIsSettled(clerkUserId, new Date())) return;

  await db
    .insert(playerProfilesTable)
    .values({ clerkUserId })
    .onConflictDoNothing();

  if (MISSION_TEMPLATES.length > 0) {
    await db
      .insert(playerMissionsTable)
      .values(
        MISSION_TEMPLATES.map((template) => ({
          clerkUserId,
          ...template,
          resetAt: resetForCadence(template.cadence),
        })),
      )
      .onConflictDoNothing();
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    // Mission cadence and ownership reconciliation share the reward writers' lock.
    // Read the locked row once, avoiding a second transaction and lock roundtrip.
    const [current] = await tx
      .select(normalizationColumns)
      .from(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkUserId, clerkUserId))
      .for("update");
    if (!current) return;
    await resetExpiredMissionsInTransaction(tx, clerkUserId, now);

    const normalized = normalizeProfileState(current, await earnedReceiptCardIds(tx, clerkUserId), now);
    if (normalized.needsWrite) {
      await tx
        .update(playerProfilesTable)
        .set(normalized.update)
        .where(eq(playerProfilesTable.clerkUserId, clerkUserId));
    }
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

/** Columns serialized for a receipt; idempotency keys and owners stay server-side. */
type SerializedPackOpening = Omit<PlayerPackOpeningRecord, "clerkUserId" | "idempotencyKey">;
type BootstrapProfile = Omit<PlayerProfileRecord, "packHistory" | "createdAt" | "updatedAt">;
type BootstrapMission = Omit<PlayerMissionRecord, "id" | "clerkUserId" | "createdAt" | "updatedAt">;

/**
 * Bootstrap projections: every column the response reads, nothing else. The
 * legacy profile pack_history JSON is never serialized (receipts come from the
 * pack openings table), so it is not transferred.
 */
const {
  packHistory: _legacyPackHistory, createdAt: _profileCreatedAt, updatedAt: _profileUpdatedAt,
  ...bootstrapProfileColumns
} = getTableColumns(playerProfilesTable);
const {
  id: _missionId, clerkUserId: _missionOwner, createdAt: _missionCreatedAt, updatedAt: _missionUpdatedAt,
  ...bootstrapMissionColumns
} = getTableColumns(playerMissionsTable);
const {
  clerkUserId: _openingOwner, idempotencyKey: _openingKey,
  ...bootstrapPackOpeningColumns
} = getTableColumns(playerPackOpeningsTable);

export function serializePackOpening(opening: SerializedPackOpening, seasonRewards?: PullSeasonReward[]) {
  const pullCount = packReceiptPullCount(opening.oddsVersion);
  return {
    id: opening.id,
    oddsVersion: opening.oddsVersion,
    paymentMethod: opening.paymentMethod,
    cost: opening.cost,
    pullCount,
    ...(seasonRewards?.length ? { seasonRewards } : {}),
    rewards: opening.rewards,
    pityBefore: opening.pityBefore,
    pityAfter: opening.pityAfter,
    createdAt: opening.createdAt.toISOString(),
  };
}

function serializeProfile(
  profile: BootstrapProfile,
  packHistory: SerializedPackOpening[],
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
    styleShardBalances: normalizeStyleShardBalances(profile.styleShardBalances),
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
    settings: { ...profile.settings, reactionTray: resolveReactionTray(profile.settings.reactionTray, profile.unlockedCosmeticIds) },
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
    packHistory: packHistory.map(opening => serializePackOpening(opening)),
    lastActiveAt: profile.lastActiveAt.toISOString(),
  };
}

function serializeMission(mission: BootstrapMission) {
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
  profile: BootstrapProfile,
  missions: BootstrapMission[],
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
      description: "The Opps are waiting in your first story fight.",
      destination: "story",
      rewardLabel: "Guaranteed card",
    };
  }

  return {
    id: "play-practice",
    eyebrow: "Build your gang",
    title: "XP Training",
    description: "Train against The Opps with fair CPU play. Played owned cards earn XP even when you lose.",
    destination: "play",
    rewardLabel: "20–30 Card XP per participant",
  };
}

export async function getPlayerBootstrap(clerkUserId: string) {
  await ensurePlayer(clerkUserId);
  return getInitializedPlayerBootstrap(clerkUserId);
}

/**
 * Serialize an already initialized player without repeating economy recovery.
 * Call ensurePlayer first in this request. This is a read-only step, so delivery
 * of inbox letters between initialization and serialization remains visible
 * without another profile-lock/receipt-recovery pass.
 */
export async function getInitializedPlayerBootstrap(clerkUserId: string) {
  const [profileResult, missions, packHistory, roadClaims] = await Promise.all([
    db
      .select(bootstrapProfileColumns)
      .from(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkUserId, clerkUserId)),
    db
      .select(bootstrapMissionColumns)
      .from(playerMissionsTable)
      .where(eq(playerMissionsTable.clerkUserId, clerkUserId))
      .orderBy(asc(playerMissionsTable.id)),
    db
      .select(bootstrapPackOpeningColumns)
      .from(playerPackOpeningsTable)
      .where(eq(playerPackOpeningsTable.clerkUserId, clerkUserId))
      .orderBy(desc(playerPackOpeningsTable.createdAt))
      .limit(20),
    db
      .select({ milestoneKey: playerCollectionClaimsTable.milestoneKey })
      .from(playerCollectionClaimsTable)
      .where(and(
        eq(playerCollectionClaimsTable.clerkUserId, clerkUserId),
        inArray(playerCollectionClaimsTable.milestoneKey, COLLECTION_ROAD.map(milestone => milestone.id)),
      )),
  ]);
  const [profile] = profileResult;

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
