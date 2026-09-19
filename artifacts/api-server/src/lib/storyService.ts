import { and, asc, eq, lt, sql } from "drizzle-orm";
import {
  db,
  playerProfilesTable,
  playerStoryNodesTable,
  playerStoryRewardClaimsTable,
  type PlayerStoryNodeRecord,
} from "@workspace/db";
import {
  getStoryNode,
  storyContent,
  type StoryChapter,
  type StoryNode,
} from "@workspace/squabblemon-engine/story";
import { ensurePlayer } from "./playerState";

const COURIER_TABLE_NODE_ID = "red-tapes-courier-table";
const COURIER_TABLE_CHAPTER_ID = "red-side-tapes";
const COURIER_TABLE_TICKET_CLAIM_KEY =
  "red-tapes-courier-table:stars:3:auto-ticket:v1";

/**
 * Courier Table used to be a battle whose ticket required three stars. It is
 * now a reward node whose ticket belongs to every clear. Backfill historical
 * sub-three-star clears when their campaign is next loaded. The immutable
 * reward claim makes repeated and concurrent loads safe.
 */
async function backfillCourierTableTicket(userId: string) {
  const [legacyCandidate] = await db
    .select({ id: playerStoryNodesTable.id })
    .from(playerStoryNodesTable)
    .where(
      and(
        eq(playerStoryNodesTable.clerkUserId, userId),
        eq(playerStoryNodesTable.nodeId, COURIER_TABLE_NODE_ID),
        eq(playerStoryNodesTable.cleared, true),
        lt(playerStoryNodesTable.stars, 3),
      ),
    )
    .limit(1);
  if (!legacyCandidate) return;

  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select ${playerProfilesTable.clerkUserId} from ${playerProfilesTable} where ${playerProfilesTable.clerkUserId} = ${userId} for update`,
    );
    const [legacyClear] = await tx
      .select({ id: playerStoryNodesTable.id })
      .from(playerStoryNodesTable)
      .where(
        and(
          eq(playerStoryNodesTable.clerkUserId, userId),
          eq(playerStoryNodesTable.nodeId, COURIER_TABLE_NODE_ID),
          eq(playerStoryNodesTable.cleared, true),
          lt(playerStoryNodesTable.stars, 3),
        ),
      )
      .limit(1);
    if (!legacyClear) return;

    const reward = {
      kind: "pack-ticket" as const,
      id: "street-pack-ticket",
      amount: 1,
    };
    const [claim] = await tx
      .insert(playerStoryRewardClaimsTable)
      .values({
        clerkUserId: userId,
        chapterId: COURIER_TABLE_CHAPTER_ID,
        nodeId: COURIER_TABLE_NODE_ID,
        rewardKey: COURIER_TABLE_TICKET_CLAIM_KEY,
        reward,
      })
      .onConflictDoNothing()
      .returning({ id: playerStoryRewardClaimsTable.id });
    if (!claim) return;

    await tx
      .update(playerProfilesTable)
      .set({
        packTickets: sql`${playerProfilesTable.packTickets} + ${reward.amount}`,
      })
      .where(eq(playerProfilesTable.clerkUserId, userId));
  });
}

export class StoryRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function storyNodeChapter(nodeId: string): StoryChapter | undefined {
  return storyContent.chapters.find((chapter) =>
    chapter.nodes.some((node) => node.id === nodeId),
  );
}

export function isStoryNodeAvailable(
  node: StoryNode,
  clearedNodeIds: ReadonlySet<string>,
): boolean {
  const chapter = storyNodeChapter(node.id);
  return Boolean(
    chapter &&
      chapter.prerequisites.every((id) => clearedNodeIds.has(id)) &&
      node.prerequisites.every((id) => clearedNodeIds.has(id)),
  );
}

function progressionKeys(rows: PlayerStoryNodeRecord[]): Set<string> {
  const keys = new Set(
    rows.filter((row) => row.cleared).map((row) => row.nodeId),
  );
  for (const chapter of storyContent.chapters) {
    if (
      chapter.nodes.length > 0 &&
      chapter.nodes.filter((node) => !node.optional).every((node) => keys.has(node.id))
    ) {
      keys.add(chapter.id);
    }
  }
  return keys;
}

function nodeStatus(
  node: StoryNode,
  progress: PlayerStoryNodeRecord | undefined,
  clearedNodeIds: ReadonlySet<string>,
) {
  if (progress?.cleared) return "cleared" as const;
  return isStoryNodeAvailable(node, clearedNodeIds)
    ? ("available" as const)
    : ("locked" as const);
}

export function buildStoryCampaign(rows: PlayerStoryNodeRecord[]) {
  const byNode = new Map(rows.map((row) => [row.nodeId, row]));
  const cleared = progressionKeys(rows);
  const orderedChapters = [...storyContent.chapters].sort(
    (a, b) => a.order - b.order,
  );
  const nodes = orderedChapters.flatMap((chapter) =>
    chapter.nodes.map((node) => {
      const row = byNode.get(node.id);
      return {
        chapterId: chapter.id,
        nodeId: node.id,
        title: node.title,
        kind: node.kind,
        optional: node.optional,
        status: nodeStatus(node, row, cleared),
        mapPosition: node.mapPosition,
        prerequisites: [...node.prerequisites],
        rewards: node.rewards.map((reward) => ({ ...reward })),
        cleared: row?.cleared ?? false,
        stars: row?.stars ?? 0,
        attempts: row?.attempts ?? 0,
        wins: row?.wins ?? 0,
        lastOutcome: row?.lastOutcome ?? null,
        dialogueSeen: row?.dialogueSeen ?? [],
        bossHighestPhase: row?.bossProgress.highestPhase ?? 0,
        firstClearedAt: row?.firstClearedAt?.toISOString() ?? null,
        lastPlayedAt: row?.lastPlayedAt?.toISOString() ?? null,
      };
    }),
  );
  const chapters = orderedChapters.map((chapter) => {
    const chapterNodes = nodes.filter((node) => node.chapterId === chapter.id);
    const boss = chapter.nodes.find(
      (node) => node.kind === "battle" && node.battleType === "boss",
    );
    const bossNode = boss
      ? chapterNodes.find((node) => node.nodeId === boss.id)
      : undefined;
    const requiredNodes = chapterNodes.filter((node) => !chapter.nodes.find((item) => item.id === node.nodeId)?.optional);
    const completedNodes = chapterNodes.filter((node) => node.cleared).length;
    const completedRequiredNodes = requiredNodes.filter((node) => node.cleared).length;
    const chapterAvailable = chapter.prerequisites.every((id) =>
      cleared.has(id),
    );
    return {
      id: chapter.id,
      title: chapter.title,
      subtitle: chapter.subtitle,
      description: chapter.description,
      order: chapter.order,
      mapAssetId: chapter.mapAssetId,
      status:
        completedRequiredNodes === requiredNodes.length
          ? ("cleared" as const)
          : chapterAvailable
            ? ("available" as const)
            : ("locked" as const),
      completedNodes,
      totalNodes: chapterNodes.length,
      completedRequiredNodes,
      totalRequiredNodes: requiredNodes.length,
      stars: chapterNodes.reduce((sum, node) => sum + node.stars, 0),
      bossStatus: bossNode
        ? bossNode.cleared
          ? ("cleared" as const)
          : bossNode.status === "available"
            ? bossNode.attempts
              ? ("in-progress" as const)
              : ("available" as const)
            : ("locked" as const)
        : ("locked" as const),
    };
  });
  const bosses = chapters.filter((chapter) => chapter.bossStatus !== "locked");
  const bossStatus =
    bosses.find((chapter) => chapter.bossStatus === "in-progress")
      ?.bossStatus ??
    bosses.find((chapter) => chapter.bossStatus === "available")?.bossStatus ??
    (bosses.length && bosses.every((chapter) => chapter.bossStatus === "cleared")
      ? "cleared"
      : "locked");
  return {
    contentVersion: storyContent.version,
    chapters,
    nodes,
    recommendedNodeId:
      nodes.find((node) => node.status === "available" && !node.cleared && !node.optional)
        ?.nodeId ??
      nodes.find((node) => node.status === "available" && !node.cleared)
        ?.nodeId ?? null,
    totalStars: nodes.reduce((sum, node) => sum + node.stars, 0),
    completedNodes: nodes.filter((node) => node.cleared).length,
    bossStatus,
  };
}

export async function getPlayerStoryCampaign(userId: string) {
  await ensurePlayer(userId);
  await backfillCourierTableTicket(userId);
  const rows = await db
    .select()
    .from(playerStoryNodesTable)
    .where(eq(playerStoryNodesTable.clerkUserId, userId))
    .orderBy(asc(playerStoryNodesTable.createdAt));
  return buildStoryCampaign(rows);
}

export function requireAvailableStoryNode(
  nodeId: string,
  rows: PlayerStoryNodeRecord[],
): { node: StoryNode; chapter: StoryChapter } {
  const node = getStoryNode(nodeId);
  const chapter = storyNodeChapter(nodeId);
  if (!node || !chapter) throw new StoryRequestError(404, "Story node not found");
  const cleared = progressionKeys(rows);
  if (!isStoryNodeAvailable(node, cleared) && !cleared.has(nodeId)) {
    throw new StoryRequestError(409, "Story node is locked");
  }
  return { node, chapter };
}