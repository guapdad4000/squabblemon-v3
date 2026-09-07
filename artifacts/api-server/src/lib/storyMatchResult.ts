import type { PlayerMatchRecord } from "@workspace/db";
import type { GrantedStoryReward } from "./storyTransactions";

export function getStoredStoryMatchResult(match: PlayerMatchRecord) {
  const rewards =
    (match.storyGrantedRewards as GrantedStoryReward[] | null) ?? [];
  const outcome = match.outcome as "win" | "loss" | "draw" | null;
  return {
    rewards,
    descriptions: rewards.map((reward) => reward.description),
    story:
      match.mode === "story" && match.storyNodeId && outcome
        ? {
            nodeId: match.storyNodeId,
            stars: match.storyStars ?? 0,
            firstClear: match.storyFirstClear ?? false,
            outcome,
            bossHighestPhase: match.storyBossHighestPhase ?? 0,
          }
        : null,
  };
}