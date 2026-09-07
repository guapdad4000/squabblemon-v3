import type {
  StoryBattleNode,
  StoryChapter,
  StoryReward,
} from "@workspace/squabblemon-engine/story";

export type StoryMatchProgressionSnapshot = {
  contentVersion: number;
  chapterId: string;
  chapterOrder: number;
  nodeId: string;
  nodeOrder: number;
  rewards: readonly StoryReward[];
};

export function createStoryMatchProgressionSnapshot(
  contentVersion: number,
  chapter: StoryChapter,
  node: StoryBattleNode,
): StoryMatchProgressionSnapshot {
  return structuredClone({
    contentVersion,
    chapterId: chapter.id,
    chapterOrder: chapter.order,
    nodeId: node.id,
    nodeOrder: chapter.nodes.findIndex((item) => item.id === node.id),
    rewards: node.rewards,
  });
}

export function parseStoryMatchProgressionSnapshot(
  value: unknown,
): StoryMatchProgressionSnapshot {
  if (!value || typeof value !== "object") {
    throw new Error("Stored story match is missing its progression snapshot");
  }
  const candidate = value as Partial<StoryMatchProgressionSnapshot>;
  const validReward = (reward: unknown): reward is StoryReward => {
    if (!reward || typeof reward !== "object") return false;
    const item = reward as Partial<StoryReward>;
    return (
      ["currency", "card", "chapter-key"].includes(item.kind ?? "") &&
      typeof item.id === "string" &&
      item.id.length > 0 &&
      Number.isInteger(item.amount) &&
      (item.amount ?? 0) > 0
    );
  };
  if (
    !Number.isInteger(candidate.contentVersion) ||
    typeof candidate.chapterId !== "string" ||
    !Number.isInteger(candidate.chapterOrder) ||
    typeof candidate.nodeId !== "string" ||
    !Number.isInteger(candidate.nodeOrder) ||
    !Array.isArray(candidate.rewards) ||
    !candidate.rewards.every(validReward)
  ) {
    throw new Error("Stored story match has an invalid progression snapshot");
  }
  return structuredClone(candidate as StoryMatchProgressionSnapshot);
}