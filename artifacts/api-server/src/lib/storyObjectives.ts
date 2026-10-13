import { and, eq, isNotNull } from "drizzle-orm";
import { db, playerMatchesTable, playerStoryNodesTable } from "@workspace/db";
import { getStoryBattle } from "@workspace/squabblemon-engine/story";
import {
  recoverLegacyStoryObjectiveIds,
  type StoryEncounterSnapshot,
} from "@workspace/squabblemon-engine/gameEngine";
import { StoryRequestError } from "./storyService";
/** Read-only: the battle settlement owns objective banking and its ticket receipt. */
export async function getStoryObjectiveProgress(
  userId: string,
  nodeId: string,
) {
  const battle = getStoryBattle(nodeId);
  if (!battle) throw new StoryRequestError(404, "Story battle not found.");
  const [node] = await db
    .select()
    .from(playerStoryNodesTable)
    .where(
      and(
        eq(playerStoryNodesTable.clerkUserId, userId),
        eq(playerStoryNodesTable.nodeId, nodeId),
      ),
    );
  let completedObjectiveIds = node?.bossProgress.completedObjectiveIds ?? [];
  if (node?.stars && !node.bossProgress.completedObjectiveIds) {
    const receipts = await db
      .select({
        outcome: playerMatchesTable.outcome,
        districtsWon: playerMatchesTable.districtsWon,
        storyStars: playerMatchesTable.storyStars,
        snapshot: playerMatchesTable.storyEncounterSnapshot,
      })
      .from(playerMatchesTable)
      .where(
        and(
          eq(playerMatchesTable.clerkUserId, userId),
          eq(playerMatchesTable.storyNodeId, nodeId),
          isNotNull(playerMatchesTable.completedAt),
          eq(playerMatchesTable.outcome, "win"),
        ),
      );
    completedObjectiveIds = recoverLegacyStoryObjectiveIds(
      receipts.map((receipt) => ({
        ...receipt,
        objectives:
          (receipt.snapshot as unknown as StoryEncounterSnapshot | null)
            ?.starObjectives ?? [],
      })),
    );
  }
  const allowed = new Set(
    battle.starObjectives.map((objective) => objective.id),
  );
  return {
    nodeId,
    stars: node?.stars ?? 0,
    completedObjectiveIds: completedObjectiveIds.filter((id) =>
      allowed.has(id),
    ),
  };
}
