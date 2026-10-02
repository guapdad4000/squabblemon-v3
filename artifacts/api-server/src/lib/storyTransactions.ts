import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import {
  db,
  playerProfilesTable,
  playerMatchesTable,
  playerStoryActionsTable,
  playerStoryNodesTable,
  playerStoryRewardClaimsTable,
  type PlayerProfileRecord,
  type PlayerStoryReward,
} from "@workspace/db";
import { catalogCardByEngineId, catalogCardById } from "@workspace/squabblemon-engine/data";
import {
  MAX_STARS_PER_BATTLE,
  TICKETS_PER_PERFECT_BATTLE,
  getStoryNode,
  isStoryPuzzleSolution,
  isStoryCharacterId,
  isStoryCosmeticId,
  storyDialogueToken,
  storyContent,
  ticketsForStars,
  type StoryReward,
} from "@workspace/squabblemon-engine/story";
import { ensurePlayer, getPlayerBootstrap } from "./playerState";
import {
  ACCOUNT_XP_PER_LEVEL,
  STORY_DUPLICATE_STYLE_SHARDS,
} from "@workspace/squabblemon-engine/economy";
import {
  getPlayerStoryCampaign,
  requireAvailableStoryNode,
  storyNodeChapter,
  StoryRequestError,
} from "./storyService";

type StoryTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type GrantedStoryReward = PlayerStoryReward & {
  rewardKey: string;
  duplicateShards: number;
  description: string;
};

export const STORY_PAYOUT_MAKE_GOOD_REWARD_KEY_PREFIX = "story-payout-make-good:v1:";
export const STORY_CARD_REWARD_CLAIM_KEY_PREFIX = "story-card-reward:v1:";

type StoryActionKind = "complete" | "dialogue" | "puzzle";
export const isDevelopmentStoryResetEnabled = (
  environment: string | undefined = process.env.NODE_ENV,
) => environment === "development";

type StoryActionPayload = {
  dialogueSeen: string[];
  order?: string[];
  skip?: boolean;
};

function canonicalActionPayload(payload: StoryActionPayload): StoryActionPayload {
  return {
    dialogueSeen: [...new Set(payload.dialogueSeen)],
    ...(payload.order ? { order: [...payload.order] } : {}),
    ...(payload.skip !== undefined ? { skip: payload.skip } : {}),
  };
}

function actionFingerprint(
  nodeId: string,
  actionKind: StoryActionKind,
  payload: StoryActionPayload,
) {
  return createHash("sha256")
    .update(JSON.stringify({ nodeId, actionKind, payload }))
    .digest("hex");
}

async function claimStoryAction(
  tx: StoryTx,
  userId: string,
  idempotencyKey: string,
  nodeId: string,
  actionKind: StoryActionKind,
  input: StoryActionPayload,
): Promise<{ alreadyApplied: boolean; dialogueSeen: string[] }> {
  const payload = canonicalActionPayload(input);
  const requestFingerprint = actionFingerprint(nodeId, actionKind, payload);
  const [existing] = await tx
    .select()
    .from(playerStoryActionsTable)
    .where(
      and(
        eq(playerStoryActionsTable.clerkUserId, userId),
        eq(playerStoryActionsTable.idempotencyKey, idempotencyKey),
      ),
    );
  if (existing) {
    if (
      existing.nodeId !== nodeId ||
      existing.actionKind !== actionKind ||
      existing.requestFingerprint !== requestFingerprint
    ) {
      throw new StoryRequestError(
        409,
        "Idempotency key was already used for a different story action",
      );
    }
    return {
      alreadyApplied: true,
      dialogueSeen: existing.payload.dialogueSeen,
    };
  }
  await tx.insert(playerStoryActionsTable).values({
    clerkUserId: userId,
    idempotencyKey,
    nodeId,
    actionKind,
    requestFingerprint,
    payload: { dialogueSeen: payload.dialogueSeen },
  });
  return { alreadyApplied: false, dialogueSeen: payload.dialogueSeen };
}

function describeClaim(
  rewardKey: string,
  reward: PlayerStoryReward,
): GrantedStoryReward {
  const duplicateShards = reward.duplicateShards ?? 0;
  let description = `${reward.amount} ${reward.id}`;
  if (reward.kind === "currency" && reward.id === "street-xp") {
    description = `+${reward.amount} Account XP`;
  } else if (reward.kind === "currency" && reward.id === "clout") {
    description = `+${reward.amount} Clout · Training fund`;
  } else if (reward.kind === "card") {
    const card = catalogCardById[reward.id] ?? catalogCardByEngineId[reward.id];
    description = duplicateShards
      ? `${card?.name ?? reward.id} duplicate converted to ${duplicateShards} Style Shards`
      : `${card?.name ?? reward.id} unlocked`;
  } else if (reward.kind === "chapter-key") {
    description = "Chapter key unlocked";
  } else if (reward.kind === "pack-ticket") {
    description = `+${reward.amount} Street Pack Ticket${reward.amount === 1 ? "" : "s"}`;
  } else if (reward.kind === "cosmetic") {
    description = `${reward.id} unlocked`;
  } else if (reward.kind === "character-unlock") {
    description = `Character unlocked: ${reward.id}`;
  }
  return { ...reward, rewardKey, duplicateShards, description };
}

export async function getClaimedStoryRewards(
  tx: StoryTx,
  userId: string,
  nodeId: string,
): Promise<GrantedStoryReward[]> {
  const claims = await tx
    .select()
    .from(playerStoryRewardClaimsTable)
    .where(
      and(
        eq(playerStoryRewardClaimsTable.clerkUserId, userId),
        eq(playerStoryRewardClaimsTable.nodeId, nodeId),
      ),
    );
  return claims
    .sort((a, b) => a.rewardKey.localeCompare(b.rewardKey))
    .map((claim) => describeClaim(claim.rewardKey, claim.reward));
}

/**
 * Repairs a previously-cleared node against the current payout contract.
 * Claim history, not the mutable profile balance, is authoritative. The
 * caller holds the profile row lock; claim insertion and balance credit share
 * that same transaction so retries and concurrent checks cannot mint twice.
 */
export async function grantStoryPayoutMakeGood(
  tx: StoryTx,
  userId: string,
  chapterId: string,
  nodeId: string,
  stars: number,
): Promise<GrantedStoryReward[]> {
  const node = getStoryNode(nodeId);
  if (!node) return [];
  const claims = await tx
    .select()
    .from(playerStoryRewardClaimsTable)
    .where(
      and(
        eq(playerStoryRewardClaimsTable.clerkUserId, userId),
        eq(playerStoryRewardClaimsTable.nodeId, nodeId),
      ),
    );
  const targetClout = node.rewards
    .filter((reward) => reward.kind === "currency" && reward.id === "clout")
    .reduce((sum, reward) => sum + reward.amount, 0);
  const targetTickets = node.rewards
    .filter((reward) => reward.kind === "pack-ticket" && reward.id === "street-pack-ticket")
    .reduce((sum, reward) => sum + reward.amount, 0);
  const creditedClout = claims
    .filter((claim) => claim.reward.kind === "currency" && claim.reward.id === "clout")
    .reduce((sum, claim) => sum + claim.reward.amount, 0);
  const isLegacyCourierDirectTicket =
    nodeId === "red-tapes-courier-table" && stars < MAX_STARS_PER_BATTLE;
  const creditedTickets = claims
    .filter(
      (claim) =>
        claim.reward.kind === "pack-ticket" &&
        claim.reward.id === "street-pack-ticket" &&
        (!claim.rewardKey.endsWith(`:stars:${MAX_STARS_PER_BATTLE}:auto-ticket:v1`) ||
          isLegacyCourierDirectTicket),
    )
    .reduce((sum, claim) => sum + claim.reward.amount, 0);
  const deficits = [
    {
      kind: "currency" as const,
      id: "clout",
      amount: Math.max(0, targetClout - creditedClout),
      rewardKey: `${STORY_PAYOUT_MAKE_GOOD_REWARD_KEY_PREFIX}${nodeId}:clout`,
    },
    {
      kind: "pack-ticket" as const,
      id: "street-pack-ticket",
      amount: Math.max(0, targetTickets - creditedTickets),
      rewardKey: `${STORY_PAYOUT_MAKE_GOOD_REWARD_KEY_PREFIX}${nodeId}:tickets`,
    },
  ];
  const granted: GrantedStoryReward[] = [];
  for (const deficit of deficits) {
    if (deficit.amount <= 0) continue;
    const reward: PlayerStoryReward = {
      kind: deficit.kind,
      id: deficit.id,
      amount: deficit.amount,
    };
    const [claim] = await tx
      .insert(playerStoryRewardClaimsTable)
      .values({ clerkUserId: userId, chapterId, nodeId, rewardKey: deficit.rewardKey, reward })
      .onConflictDoNothing()
      .returning();
    if (!claim) continue;
    if (deficit.kind === "currency") {
      await tx
        .update(playerProfilesTable)
        .set({
          softCurrency: sql`${playerProfilesTable.softCurrency} + ${deficit.amount}`,
        })
        .where(eq(playerProfilesTable.clerkUserId, userId));
    } else {
      await tx
        .update(playerProfilesTable)
        .set({
          packTickets: sql`${playerProfilesTable.packTickets} + ${deficit.amount}`,
        })
        .where(eq(playerProfilesTable.clerkUserId, userId));
    }
    granted.push(describeClaim(deficit.rewardKey, reward));
  }
  return granted;
}

/**
 * Delivers only the explicitly versioned card contract for a cleared node.
 * The separate claim-key namespace keeps these collection catch-ups distinct
 * from historical currency/ticket receipts and other node rewards.
 */
async function grantStoryCardContractRewards(
  tx: StoryTx,
  userId: string,
  chapterId: string,
  node: NonNullable<ReturnType<typeof getStoryNode>>,
): Promise<GrantedStoryReward[]> {
  const configuredCards = node.rewards.filter(
    (reward) =>
      reward.kind === "card" &&
      reward.claimKey?.startsWith(STORY_CARD_REWARD_CLAIM_KEY_PREFIX),
  );
  if (!configuredCards.length) return [];

  const progressRows = await tx
    .select()
    .from(playerStoryNodesTable)
    .where(eq(playerStoryNodesTable.clerkUserId, userId));
  const clearedNodes = new Set(
    progressRows.filter((row) => row.cleared).map((row) => row.nodeId),
  );
  if (
    !clearedNodes.has(node.id) ||
    !node.prerequisites.every((prerequisite) => clearedNodes.has(prerequisite))
  ) {
    return [];
  }

  const [profile] = await tx
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, userId));
  if (!profile) throw new StoryRequestError(404, "Player profile not found");

  const granted: GrantedStoryReward[] = [];
  const owned = new Set(profile.ownedCardIds);
  const discovered = new Set(profile.discoveredCardIds);
  let styleShards = profile.styleShards;
  for (const configured of configuredCards) {
    const card = catalogCardById[configured.id] ?? catalogCardByEngineId[configured.id];
    if (!card) throw new StoryRequestError(500, "Story reward card is unknown");
    const rewardKey = configured.claimKey!;
    const duplicateShards = owned.has(card.catalogId)
      ? STORY_DUPLICATE_STYLE_SHARDS
      : 0;
    const reward: PlayerStoryReward = {
      kind: "card",
      id: configured.id,
      amount: configured.amount,
      ...(duplicateShards ? { duplicateShards } : {}),
    };
    const [claim] = await tx
      .insert(playerStoryRewardClaimsTable)
      .values({ clerkUserId: userId, chapterId, nodeId: node.id, rewardKey, reward })
      .onConflictDoNothing()
      .returning();
    if (!claim) continue;

    discovered.add(card.catalogId);
    owned.add(card.catalogId);
    styleShards += duplicateShards;
    await tx
      .update(playerProfilesTable)
      .set({
        ownedCardIds: [...owned],
        discoveredCardIds: [...discovered],
        collectionProgress: owned.size,
        styleShards,
      })
      .where(eq(playerProfilesTable.clerkUserId, userId));
    granted.push({
      ...reward,
      rewardKey,
      duplicateShards,
      description: duplicateShards
        ? `${card.name} duplicate converted to ${duplicateShards} Style Shards`
        : `${card.name} unlocked`,
    });
  }
  return granted;
}

type StoryCampaignWithPayoutCatchUp = Awaited<
  ReturnType<typeof getPlayerStoryCampaign>
> & {
  catchUp?: {
    rewards: GrantedStoryReward[];
    bootstrap: Awaited<ReturnType<typeof getPlayerBootstrap>>;
  };
};

/**
 * GET /player/story-only payout reconciliation. Its single profile lock
 * serializes all cleared-node claim checks; grants and claims commit together.
 * Ordinary campaign reads used inside mutations intentionally do not invoke
 * this path, so they cannot alter a mutation's receipt.
 */
export async function getPlayerStoryCampaignWithPayoutCatchUp(
  userId: string,
): Promise<StoryCampaignWithPayoutCatchUp> {
  await ensurePlayer(userId);
  const rewards = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select ${playerProfilesTable.clerkUserId} from ${playerProfilesTable} where ${playerProfilesTable.clerkUserId} = ${userId} for update`,
    );
    const clearedRows = await tx
      .select()
      .from(playerStoryNodesTable)
      .where(
        and(
          eq(playerStoryNodesTable.clerkUserId, userId),
          eq(playerStoryNodesTable.cleared, true),
        ),
      );
    const granted: GrantedStoryReward[] = [];
    for (const row of clearedRows) {
      granted.push(
        ...(await grantStoryPayoutMakeGood(
          tx,
          userId,
          row.chapterId,
          row.nodeId,
          row.stars,
        )),
      );
      const node = getStoryNode(row.nodeId);
      if (node) {
        granted.push(
          ...(await grantStoryCardContractRewards(
            tx,
            userId,
            row.chapterId,
            node,
          )),
        );
      }
    }
    return granted;
  });
  const [campaign, bootstrap] = await Promise.all([
    getPlayerStoryCampaign(userId),
    getPlayerBootstrap(userId),
  ]);
  return rewards.length
    ? { ...campaign, catchUp: { rewards, bootstrap } }
    : campaign;
}

export async function grantStoryRewards(
  tx: StoryTx,
  userId: string,
  chapterId: string,
  nodeId: string,
  rewards: readonly StoryReward[],
): Promise<GrantedStoryReward[]> {
  const granted: GrantedStoryReward[] = [];
  const snapshotRewardKeys = new Set(
    rewards.map((reward, index) =>
      reward.claimKey ?? `${nodeId}:${index}:${reward.kind}:${reward.id}`,
    ),
  );
  const currentContractRewards = getStoryNode(nodeId)?.rewards.filter(
    (reward) =>
      reward.claimKey !== undefined &&
      (reward.claimKey.startsWith("story-payout-contract:v1:") ||
        (reward.kind === "card" &&
          reward.claimKey.startsWith(STORY_CARD_REWARD_CLAIM_KEY_PREFIX))) &&
      !snapshotRewardKeys.has(reward.claimKey),
  ) ?? [];
  const payout = [...rewards, ...currentContractRewards];
  for (const [index, configured] of payout.entries()) {
    if (
      (configured.kind === "cosmetic" && !isStoryCosmeticId(configured.id)) ||
      (configured.kind === "chapter-key" && !configured.id.startsWith("story-key:")) ||
      (configured.kind === "character-unlock" && !isStoryCharacterId(configured.id))
    ) {
      throw new StoryRequestError(500, "Story reward is invalid");
    }
    const rewardKey = configured.claimKey ?? `${nodeId}:${index}:${configured.kind}:${configured.id}`;
    let duplicateShards = 0;
    let rewardCard:
      | (typeof catalogCardById)[string]
      | undefined;
    let cardProfile: PlayerProfileRecord | undefined;
    if (configured.kind === "card") {
      rewardCard =
        catalogCardById[configured.id] ?? catalogCardByEngineId[configured.id];
      if (!rewardCard) {
        throw new StoryRequestError(500, "Story reward card is unknown");
      }
      const [profile] = await tx
        .select()
        .from(playerProfilesTable)
        .where(eq(playerProfilesTable.clerkUserId, userId));
      if (!profile) throw new StoryRequestError(404, "Player profile not found");
      cardProfile = profile;
      duplicateShards = profile.ownedCardIds.includes(rewardCard.catalogId)
        ? STORY_DUPLICATE_STYLE_SHARDS
        : 0;
    }
    const base: PlayerStoryReward = {
      kind: configured.kind,
      id: configured.id,
      amount: configured.amount,
      ...(duplicateShards ? { duplicateShards } : {}),
    };
    const [claim] = await tx
      .insert(playerStoryRewardClaimsTable)
      .values({ clerkUserId: userId, chapterId, nodeId, rewardKey, reward: base })
      .onConflictDoNothing()
      .returning();
    if (!claim) continue;

    let description = `${configured.amount} ${configured.id}`;
    if (configured.kind === "currency" && configured.id === "street-xp") {
      await tx
        .update(playerProfilesTable)
        .set({
          xp: sql`${playerProfilesTable.xp} + ${configured.amount}`,
          level: sql`1 + floor((${playerProfilesTable.xp} + ${configured.amount}) / ${ACCOUNT_XP_PER_LEVEL})`,
        })
        .where(eq(playerProfilesTable.clerkUserId, userId));
      description = `+${configured.amount} Account XP`;
    } else if (configured.kind === "currency" && configured.id === "clout") {
      await tx.update(playerProfilesTable)
        .set({ softCurrency: sql`${playerProfilesTable.softCurrency} + ${configured.amount}` })
        .where(eq(playerProfilesTable.clerkUserId, userId));
      description = `+${configured.amount} Clout · Training fund`;
    } else if (configured.kind === "card") {
      const card = rewardCard!;
      const profile = cardProfile as typeof playerProfilesTable.$inferSelect;
      const owned = new Set(profile.ownedCardIds);
      const discovered = new Set(profile.discoveredCardIds);
      discovered.add(card.catalogId);
      if (owned.has(card.catalogId)) {
        duplicateShards = STORY_DUPLICATE_STYLE_SHARDS;
      }
      else owned.add(card.catalogId);
      await tx
        .update(playerProfilesTable)
        .set({
          ownedCardIds: [...owned],
          discoveredCardIds: [...discovered],
          collectionProgress: owned.size,
          styleShards: profile.styleShards + duplicateShards,
        })
        .where(eq(playerProfilesTable.clerkUserId, userId));
      description = duplicateShards
        ? `${card.name} duplicate converted to ${duplicateShards} Style Shards`
        : `${card.name} unlocked`;
    } else if (configured.kind === "pack-ticket") {
      await tx
        .update(playerProfilesTable)
        .set({ packTickets: sql`${playerProfilesTable.packTickets} + ${configured.amount}` })
        .where(eq(playerProfilesTable.clerkUserId, userId));
      description = `+${configured.amount} Street Pack Ticket${configured.amount === 1 ? "" : "s"}`;
    } else if (
      configured.kind === "cosmetic" ||
      configured.kind === "chapter-key"
    ) {
      const [profile] = await tx
        .select()
        .from(playerProfilesTable)
        .where(eq(playerProfilesTable.clerkUserId, userId));
      if (!profile) throw new StoryRequestError(404, "Player profile not found");
      const unlocked = new Set(profile.unlockedCosmeticIds);
      unlocked.add(configured.id);
      await tx
        .update(playerProfilesTable)
        .set({ unlockedCosmeticIds: [...unlocked] })
        .where(eq(playerProfilesTable.clerkUserId, userId));
      description =
        configured.kind === "chapter-key"
          ? "Chapter key unlocked"
          : `${configured.id} unlocked`;
    } else if (configured.kind === "character-unlock") {
      const [profile] = await tx
        .select()
        .from(playerProfilesTable)
        .where(eq(playerProfilesTable.clerkUserId, userId));
      if (!profile) throw new StoryRequestError(404, "Player profile not found");
      const unlocked = new Set(profile.unlockedCharacterIds ?? []);
      unlocked.add(configured.id);
      await tx
        .update(playerProfilesTable)
        .set({ unlockedCharacterIds: [...unlocked] })
        .where(eq(playerProfilesTable.clerkUserId, userId));
      description = `Character unlocked: ${configured.id}`;
    } else {
      throw new StoryRequestError(500, "Unsupported story reward");
    }
    granted.push({ ...base, rewardKey, duplicateShards, description });
  }
  return granted;
}

/**
 * `grantStoryTicketAward` — the 3-stars-to-ticket auto-grant. Called the
 * first time a story battle returns 3 stars. Idempotent: we only insert a
 * `pack-ticket` reward claim when no prior claim exists for this node, and we
 * bump the player's pack-ticket balance by `ticketsForStars(stars)` exactly
 * once per 3-star clear. This is the single source of truth for the "3
 * battles → 3 stars → 1 ticket" loop.
 */
export async function grantStoryTicketAward(
  tx: StoryTx,
  userId: string,
  chapterId: string,
  nodeId: string,
  stars: number,
): Promise<GrantedStoryReward | null> {
  if (stars < MAX_STARS_PER_BATTLE) return null;
  const amount = ticketsForStars(stars);
  if (amount <= 0) return null;
  const rewardKey = `${nodeId}:stars:${MAX_STARS_PER_BATTLE}:auto-ticket:v1`;
  const base: PlayerStoryReward = { kind: "pack-ticket", id: "street-pack-ticket", amount };
  const [claim] = await tx
    .insert(playerStoryRewardClaimsTable)
    .values({ clerkUserId: userId, chapterId, nodeId, rewardKey, reward: base })
    .onConflictDoNothing()
    .returning();
  if (!claim) return null;
  await tx
    .update(playerProfilesTable)
    .set({
      packTickets: sql`${playerProfilesTable.packTickets} + ${amount}`,
    })
    .where(eq(playerProfilesTable.clerkUserId, userId));
  const description = `+${amount} Street Pack Ticket${amount === 1 ? "" : "s"} (3-star clean sweep)`;
  return { ...base, rewardKey, duplicateShards: 0, description };
}

export const STORY_TICKET_REWARDS = {
  TICKETS_PER_PERFECT_BATTLE,
  MAX_STARS_PER_BATTLE,
} as const;

export async function completeNonBattleStoryNode(
  userId: string,
  nodeId: string,
  idempotencyKey: string,
  dialogueSeen: string[],
) {
  const result = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select ${playerProfilesTable.clerkUserId} from ${playerProfilesTable} where ${playerProfilesTable.clerkUserId} = ${userId} for update`,
    );
    const rows = await tx
      .select()
      .from(playerStoryNodesTable)
      .where(eq(playerStoryNodesTable.clerkUserId, userId));
    const { node, chapter } = requireAvailableStoryNode(nodeId, rows);
    if (node.kind === "battle") {
      throw new StoryRequestError(400, "Battle nodes must be completed by a fade");
    }
    if (node.puzzle) {
      throw new StoryRequestError(
        400,
        "Puzzle nodes must be completed by the puzzle endpoint",
      );
    }
    const action = await claimStoryAction(
      tx,
      userId,
      idempotencyKey,
      nodeId,
      "complete",
      { dialogueSeen },
    );
    if (action.alreadyApplied) {
      const priorClear = rows.find((row) => row.nodeId === nodeId);
      return {
        alreadyCompleted: true,
        rewards: priorClear?.cleared
          ? await grantStoryPayoutMakeGood(
              tx,
              userId,
              chapter.id,
              node.id,
              priorClear.stars,
            )
          : [],
      };
    }
    const existing = rows.find((row) => row.nodeId === nodeId);
    const seen = [
      ...new Set([
        ...(existing?.dialogueSeen ?? []),
        ...action.dialogueSeen,
      ]),
    ];
    const alreadyCompleted = existing?.cleared ?? false;
    const now = new Date();
    await tx
      .insert(playerStoryNodesTable)
      .values({
        clerkUserId: userId,
        chapterId: chapter.id,
        nodeId,
        cleared: true,
        stars: 0,
        attempts: (existing?.attempts ?? 0) + (alreadyCompleted ? 0 : 1),
        wins: 0,
        lastOutcome: "complete",
        dialogueSeen: seen,
        firstClearedAt: existing?.firstClearedAt ?? now,
        lastPlayedAt: now,
      })
      .onConflictDoUpdate({
        target: [playerStoryNodesTable.clerkUserId, playerStoryNodesTable.nodeId],
        set: {
          cleared: true,
          dialogueSeen: seen,
          firstClearedAt: existing?.firstClearedAt ?? now,
          lastPlayedAt: now,
        },
      });
    const rewards = alreadyCompleted
      ? await grantStoryPayoutMakeGood(
          tx,
          userId,
          chapter.id,
          node.id,
          existing?.stars ?? 0,
        )
      : await grantStoryRewards(
          tx,
          userId,
          chapter.id,
          node.id,
          node.rewards,
        );
    const chapterNumber = Math.max(1, chapter.order);
    const nodeNumber = chapter.nodes.findIndex((item) => item.id === node.id) + 1;
    await tx
      .update(playerProfilesTable)
      .set({
        storyChapter: sql`greatest(${playerProfilesTable.storyChapter}, ${chapterNumber})`,
        storyNode: sql`case when ${playerProfilesTable.storyChapter} < ${chapterNumber} then ${nodeNumber} when ${playerProfilesTable.storyChapter} = ${chapterNumber} then greatest(${playerProfilesTable.storyNode}, ${nodeNumber}) else ${playerProfilesTable.storyNode} end`,
        storyProgress: sql`coalesce(${playerProfilesTable.storyProgress}, '{}'::jsonb) || ${JSON.stringify({ [node.id]: { cleared: true } })}::jsonb`,
      })
      .where(eq(playerProfilesTable.clerkUserId, userId));
    return { alreadyCompleted, rewards };
  });
  return {
    ...result,
    campaign: await getPlayerStoryCampaign(userId),
    bootstrap: await getPlayerBootstrap(userId),
  };
}

export async function completeStoryPuzzle(
  userId: string,
  nodeId: string,
  idempotencyKey: string,
  order: string[] | undefined,
  skip: boolean | undefined,
  dialogueSeen: string[] = [],
) {
  const resolution = skip === true ? ("skipped" as const) : ("solved" as const);
  const result = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select ${playerProfilesTable.clerkUserId} from ${playerProfilesTable} where ${playerProfilesTable.clerkUserId} = ${userId} for update`,
    );
    const rows = await tx
      .select()
      .from(playerStoryNodesTable)
      .where(eq(playerStoryNodesTable.clerkUserId, userId));
    const { node, chapter } = requireAvailableStoryNode(nodeId, rows);
    if (!node.puzzle) {
      throw new StoryRequestError(400, "Story node does not have a puzzle");
    }
    if (skip === true && order !== undefined) {
      throw new StoryRequestError(400, "Puzzle skip cannot include a solution");
    }
    if (skip !== true && (!order || !isStoryPuzzleSolution(node.puzzle, order))) {
      throw new StoryRequestError(400, "Puzzle solution is incorrect");
    }
    const action = await claimStoryAction(
      tx,
      userId,
      idempotencyKey,
      nodeId,
      "puzzle",
      {
        dialogueSeen,
        ...(order ? { order } : {}),
        ...(skip !== undefined ? { skip } : {}),
      },
    );
    if (action.alreadyApplied) {
      return {
        alreadyCompleted: true,
        rewards: await getClaimedStoryRewards(tx, userId, nodeId),
      };
    }
    const existing = rows.find((row) => row.nodeId === nodeId);
    const seen = [
      ...new Set([...(existing?.dialogueSeen ?? []), ...action.dialogueSeen]),
    ];
    const alreadyCompleted = existing?.cleared ?? false;
    const now = new Date();
    await tx
      .insert(playerStoryNodesTable)
      .values({
        clerkUserId: userId,
        chapterId: chapter.id,
        nodeId,
        cleared: true,
        stars: 0,
        attempts: (existing?.attempts ?? 0) + (alreadyCompleted ? 0 : 1),
        wins: 0,
        lastOutcome: `puzzle-${resolution}`,
        dialogueSeen: seen,
        firstClearedAt: existing?.firstClearedAt ?? now,
        lastPlayedAt: now,
      })
      .onConflictDoUpdate({
        target: [playerStoryNodesTable.clerkUserId, playerStoryNodesTable.nodeId],
        set: {
          cleared: true,
          dialogueSeen: seen,
          firstClearedAt: existing?.firstClearedAt ?? now,
          lastPlayedAt: now,
        },
      });
    const rewards = alreadyCompleted
      ? await grantStoryPayoutMakeGood(
          tx,
          userId,
          chapter.id,
          node.id,
          existing?.stars ?? 0,
        )
      : await grantStoryRewards(
          tx,
          userId,
          chapter.id,
          node.id,
          node.rewards,
        );
    const chapterNumber = Math.max(1, chapter.order);
    const nodeNumber =
      chapter.nodes.findIndex((item) => item.id === node.id) + 1;
    await tx
      .update(playerProfilesTable)
      .set({
        storyChapter: sql`greatest(${playerProfilesTable.storyChapter}, ${chapterNumber})`,
        storyNode: sql`case when ${playerProfilesTable.storyChapter} < ${chapterNumber} then ${nodeNumber} when ${playerProfilesTable.storyChapter} = ${chapterNumber} then greatest(${playerProfilesTable.storyNode}, ${nodeNumber}) else ${playerProfilesTable.storyNode} end`,
        storyProgress: sql`coalesce(${playerProfilesTable.storyProgress}, '{}'::jsonb) || ${JSON.stringify({ [node.id]: { cleared: true } })}::jsonb`,
      })
      .where(eq(playerProfilesTable.clerkUserId, userId));
    return { alreadyCompleted, rewards };
  });
  return {
    ...result,
    resolution,
    campaign: await getPlayerStoryCampaign(userId),
    bootstrap: await getPlayerBootstrap(userId),
  };
}

export async function saveStoryDialogue(
  userId: string,
  nodeId: string,
  idempotencyKey: string,
  dialogueSeen: string[],
) {
  const result = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select ${playerProfilesTable.clerkUserId} from ${playerProfilesTable} where ${playerProfilesTable.clerkUserId} = ${userId} for update`,
    );
    const rows = await tx
      .select()
      .from(playerStoryNodesTable)
      .where(eq(playerStoryNodesTable.clerkUserId, userId));
    const existing = rows.find((row) => row.nodeId === nodeId);
    let node = getStoryNode(nodeId);
    let chapter = storyNodeChapter(nodeId);
    if (!node || !chapter) {
      throw new StoryRequestError(404, "Story node not found");
    }
    try {
      ({ node, chapter } = requireAvailableStoryNode(nodeId, rows));
    } catch (error) {
      if (
        !(error instanceof StoryRequestError) ||
        error.status !== 409 ||
        !existing ||
        existing.attempts < 1
      ) {
        throw error;
      }
    }
    if (
      node.kind === "battle" &&
      !existing?.cleared &&
      dialogueSeen.some((token) =>
        node.postDialogue.some(
          (_line, index) =>
            token === storyDialogueToken(node.id, "post", index),
        ),
      )
    ) {
      throw new StoryRequestError(
        409,
        "Post-match dialogue requires a verified story win",
      );
    }
    const action = await claimStoryAction(
      tx,
      userId,
      idempotencyKey,
      nodeId,
      "dialogue",
      { dialogueSeen },
    );
    if (action.alreadyApplied) return { alreadyApplied: true };
    const seen = [
      ...new Set([
        ...(existing?.dialogueSeen ?? []),
        ...action.dialogueSeen,
      ]),
    ];
    const now = new Date();
    await tx
      .insert(playerStoryNodesTable)
      .values({
        clerkUserId: userId,
        chapterId: chapter.id,
        nodeId: node.id,
        cleared: false,
        stars: 0,
        attempts: 0,
        wins: 0,
        dialogueSeen: seen,
        lastPlayedAt: now,
      })
      .onConflictDoUpdate({
        target: [playerStoryNodesTable.clerkUserId, playerStoryNodesTable.nodeId],
        set: { dialogueSeen: seen, lastPlayedAt: now },
      });
    return { alreadyApplied: false };
  });
  const campaign = await getPlayerStoryCampaign(userId);
  const node = campaign.nodes.find((item) => item.nodeId === nodeId);
  if (!node) throw new StoryRequestError(404, "Story node not found");
  return {
    ...result,
    campaign,
    bootstrap: await getPlayerBootstrap(userId),
    node,
  };
}

/** Development-only caller must gate this function before use.  It never grants rewards. */
export async function resetStoryDevelopment(userId: string, selectNodeId: string | null) {
  const selected = selectNodeId ? getStoryNode(selectNodeId) : undefined;
  if (selectNodeId && !selected) throw new StoryRequestError(404, "Story node not found");
  await db.transaction(async (tx) => {
    await tx.execute(sql`select ${playerProfilesTable.clerkUserId} from ${playerProfilesTable} where ${playerProfilesTable.clerkUserId} = ${userId} for update`);
    await tx.delete(playerStoryActionsTable).where(eq(playerStoryActionsTable.clerkUserId, userId));
    await tx.delete(playerStoryRewardClaimsTable).where(eq(playerStoryRewardClaimsTable.clerkUserId, userId));
    await tx.delete(playerStoryNodesTable).where(eq(playerStoryNodesTable.clerkUserId, userId));
    await tx.delete(playerMatchesTable).where(and(eq(playerMatchesTable.clerkUserId, userId), eq(playerMatchesTable.mode, "story")));
    if (selected) {
      const needed = new Set<string>();
      const addPrerequisites = (nodeId: string) => {
        const node = getStoryNode(nodeId);
        if (!node) return;
        for (const prerequisite of node.prerequisites) {
          const prerequisiteNode = getStoryNode(prerequisite);
          if (prerequisiteNode && !prerequisiteNode.optional && !needed.has(prerequisite)) {
            needed.add(prerequisite);
            addPrerequisites(prerequisite);
          }
        }
      };
      addPrerequisites(selected.id);
      for (const nodeId of needed) {
        const chapter = storyContent.chapters.find((item) => item.nodes.some((node) => node.id === nodeId));
        if (chapter) await tx.insert(playerStoryNodesTable).values({ clerkUserId: userId, chapterId: chapter.id, nodeId, cleared: true, stars: 0, attempts: 0, wins: 0, lastOutcome: "development-selected", firstClearedAt: new Date(), lastPlayedAt: new Date() });
      }
    }
    const selectedChapter = selected
      ? storyContent.chapters.find((chapter) => chapter.nodes.some((node) => node.id === selected.id))
      : undefined;
    await tx.update(playerProfilesTable).set({
      storyChapter: selectedChapter ? Math.max(1, selectedChapter.order) : 1,
      storyNode: selectedChapter ? selectedChapter.nodes.findIndex((node) => node.id === selected!.id) : 0,
      storyProgress: {},
    }).where(eq(playerProfilesTable.clerkUserId, userId));
  });
  return getPlayerStoryCampaign(userId);
}