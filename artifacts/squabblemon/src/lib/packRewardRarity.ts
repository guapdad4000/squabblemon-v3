import type { PackReward } from '@workspace/api-client-react';

export const PACK_REWARD_RARITY_RANK: Readonly<Record<string, number>> = {
  SuperCommon: -1, Common: 0, Uncommon: 1, Rare: 2, Epic: 3, Legendary: 4, Mythical: 5,
};

/** The visual tell reflects the issued receipt, including an all-SuperCommon opening. */
export function highestPackRewardRarity(rewards: readonly Pick<PackReward, 'rarity'>[]): string {
  let best: string | undefined;
  let bestRank = -Infinity;
  for (const reward of rewards) {
    const rarity = reward.rarity;
    if (!rarity || !Object.hasOwn(PACK_REWARD_RARITY_RANK, rarity)) continue;
    const rank = PACK_REWARD_RARITY_RANK[rarity];
    if (rank > bestRank) { best = rarity; bestRank = rank; }
  }
  return best ?? 'Common';
}
