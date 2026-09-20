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
  isStoryCharacterId,
  isStoryCosmeticId,
  storyContent,
  ticketsForStars,
  type StoryReward,
} from "@workspace/squabblemon-engine/story";
import { getPlayerBootstrap } from "./playerState";
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

type StoryActionKind = "complete" | "dialogue";
export const isDevelopmentStoryResetEnabled = (
  environment: string | undefined = process.env.NODE_ENV,
) => environment === "development";

function canonicalActionPayload(dialogueSeen: string[]) {
  return { dialogueSeen: [...new Set(dialogueSeen)] };
}

function actionFingerprint(
  nodeId: string,
  actionKind: StoryActionKind,
  payload: { dialogueSeen: string[] },
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
  dialogueSeen: string[],
): Promise<{ alreadyApplied: boolean; dialogueSeen: string[] }> {
  const payload = canonicalActionPayload(dialogueSeen);
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
    payload,
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
    description = `+${reward.amount} Street XP`;
  } else if (reward.kind === "currency" && reward.id === "clout") {
    description = `+${reward.amount} Clout · Training fund`;
  } else if (reward.kind === "card") {
    const card = catalogCardById[reward.id] ?? catalogCardByEngineId[reward.id];
    description = duplicateShards
      ? `${card?.name ?? reward.id} duplicate converted to 25 Style Shards`
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

export async function grantStoryRewards(
  tx: StoryTx,
  userId: string,
  chapterId: string,
  nodeId: string,
  rewards: readonly StoryReward[],
): Promise<GrantedStoryReward[]> {
  const granted: GrantedStoryReward[] = [];
  for (const [index, configured] of rewards.entries()) {
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
        ? 25
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
          level: sql`1 + floor((${playerProfilesTable.xp} + ${configured.amount}) / 250)`,
        })
        .where(eq(playerProfilesTable.clerkUserId, userId));
      description = `+${configured.amount} Street XP`;
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
      if (owned.has(card.catalogId)) duplicateShards = 25;
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
        ? `${card.name} duplicate converted to 25 Style Shards`
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
    const action = await claimStoryAction(
      tx,
      userId,
      idempotencyKey,
      nodeId,
      "complete",
      dialogueSeen,
    );
    if (action.alreadyApplied) {
      return {
        alreadyCompleted: true,
        rewards: await getClaimedStoryRewards(tx, userId, nodeId),
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
    const rewards = await grantStoryRewards(
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
    const action = await claimStoryAction(
      tx,
      userId,
      idempotencyKey,
      nodeId,
      "dialogue",
      dialogueSeen,
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