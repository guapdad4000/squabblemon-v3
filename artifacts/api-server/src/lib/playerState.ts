import { and, asc, eq, isNotNull, lte } from "drizzle-orm";
import {
  db,
  playerMatchesTable,
  playerMissionsTable,
  playerProfilesTable,
  type PlayerMissionRecord,
  type PlayerProfileRecord,
} from "@workspace/db";

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
  const expired = await db
    .select()
    .from(playerMissionsTable)
    .where(
      and(
        eq(playerMissionsTable.clerkUserId, clerkUserId),
        lte(playerMissionsTable.resetAt, now),
      ),
    );

  for (const mission of expired) {
    await db
      .update(playerMissionsTable)
      .set({
        progress: 0,
        claimedAt: null,
        resetAt: resetForCadence(mission.cadence),
      })
      .where(
        and(
          eq(playerMissionsTable.id, mission.id),
          lte(playerMissionsTable.resetAt, now),
        ),
      );
  }

  await db
    .update(playerProfilesTable)
    .set({ lastActiveAt: now })
    .where(eq(playerProfilesTable.clerkUserId, clerkUserId));
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

function serializeProfile(profile: PlayerProfileRecord) {
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
    ownedVariants: profile.ownedVariants,
    savedDecks: profile.savedDecks,
    storyProgress: profile.storyProgress,
    inbox: profile.inbox,
    packHistory: profile.packHistory,
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

  if (!profile) {
    throw new Error("Player profile could not be provisioned");
  }

  return {
    profile: serializeProfile(profile),
    missions: missions.map(serializeMission),
    nextAction: getNextAction(profile, missions),
  };
}
