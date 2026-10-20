import { and, asc, eq } from "drizzle-orm";
import {
  db,
  playerStoryNodesTable,
  type PlayerStoryNodeRecord,
} from "@workspace/db";
import {
  getStoryNode,
  storyContent,
  storySeasons,
  type StoryChapter,
  type StoryNode,
} from "@workspace/squabblemon-engine/story";
import { ensurePlayer } from "./playerState";

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
  chapter: StoryChapter,
) {
  if (progress?.cleared) return "cleared" as const;
  return chapter.prerequisites.every((id) => clearedNodeIds.has(id)) &&
    node.prerequisites.every((id) => clearedNodeIds.has(id))
    ? ("available" as const)
    : ("locked" as const);
}

export function buildStoryCampaign(rows: PlayerStoryNodeRecord[]) {
  const byNode = new Map(rows.map((row) => [row.nodeId, row]));
  const cleared = progressionKeys(rows);
  const orderedChapters = [...storyContent.chapters].sort(
    (a, b) => a.order - b.order,
  );
  // Group once while serializing. All indexes are scoped to this response.
  const chapterEntries = orderedChapters.map((chapter) => ({
    chapter,
    nodes: chapter.nodes.map((node) => {
      const row = byNode.get(node.id);
      return {
        chapterId: chapter.id,
        nodeId: node.id,
        title: node.title,
        kind: node.kind,
        optional: node.optional,
        status: nodeStatus(node, row, cleared, chapter),
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
  }));
  const nodes = chapterEntries.flatMap((entry) => entry.nodes);
  const nodesByChapter = new Map(
    chapterEntries.map((entry) => [entry.chapter.id, entry.nodes]),
  );
  const chapters = chapterEntries.map(({ chapter, nodes: chapterNodes }) => {
    const boss = chapter.nodes.find(
      (node) => node.kind === "battle" && node.battleType === "boss",
    );
    const bossNode = boss
      ? chapterNodes.find((node) => node.nodeId === boss.id)
      : undefined;
    const requiredNodes = chapterNodes.filter((node) => !node.optional);
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
  const chaptersById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  const seasons = storySeasons.map((season) => {
    const seasonChapters = season.chapterIds
      .map((chapterId) => chaptersById.get(chapterId))
      .filter((chapter) => chapter !== undefined);
    const seasonNodes = season.chapterIds.flatMap(
      (chapterId) => nodesByChapter.get(chapterId) ?? [],
    );
    const requiredSeasonNodes = seasonNodes.filter((node) => !node.optional);
    const recommendedNodeId =
      seasonNodes.find(
        (node) =>
          node.status === "available" && !node.cleared && !node.optional,
      )?.nodeId ??
      seasonNodes.find(
        (node) => node.status === "available" && !node.cleared,
      )?.nodeId ??
      null;
    return {
      ...season,
      chapterIds: [...season.chapterIds],
      status:
        seasonChapters.length === season.chapterIds.length &&
        requiredSeasonNodes.length > 0 &&
        requiredSeasonNodes.every((node) => node.cleared)
          ? ("cleared" as const)
          : seasonChapters.some((chapter) => chapter.status !== "locked")
            ? ("available" as const)
            : ("locked" as const),
      recommendedNodeId,
      starsEarned: seasonNodes.reduce((sum, node) => sum + node.stars, 0),
      starsAvailable: seasonNodes.reduce(
        (sum, node) => sum + (node.kind === "battle" ? 3 : 0),
        0,
      ),
      clearedNodes: seasonNodes.filter((node) => node.cleared).length,
      totalNodes: seasonNodes.length,
    };
  });
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
    seasons,
  };
}

export async function getPlayerStoryCampaign(userId: string) {
  await ensurePlayer(userId);
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
