/** Versioned seed for the Rookie Road board. Change the suffix only with an intentional tutorial rebalance. */
export const ROOKIE_ROAD_DISTRICT_SEED = "rookie-road-v1";
/** Authored story boards stay stable across accounts and retries for fair balancing. */
export const STORY_DISTRICT_SEED_VERSION = "story-node-v1";

export function districtSeedForMatch(
  mode: string,
  randomSeed: string,
  storyNodeId?: string,
): string {
  if (mode === "tutorial") return ROOKIE_ROAD_DISTRICT_SEED;
  if (mode === "story" && storyNodeId) {
    return `${STORY_DISTRICT_SEED_VERSION}:${storyNodeId}`;
  }
  return randomSeed;
}