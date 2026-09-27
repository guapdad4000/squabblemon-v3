import type { CardRarity } from "./data";

export const STYLE_SHARD_RARITIES = [
  "Common",
  "Uncommon",
  "Rare",
  "Epic",
  "Legendary",
  "Mythical",
] as const;
export type StyleShardRarity = (typeof STYLE_SHARD_RARITIES)[number];
export type StyleShardBalances = Partial<Record<StyleShardRarity, number>>;
export type StyleShardWallet = {
  styleShards: number;
  styleShardBalances?: StyleShardBalances;
};

export const STYLE_SHARD_TIERS = {
  Common: { label: "Common", color: "#c9c4ba", duplicatePayout: 5 },
  Uncommon: { label: "Uncommon", color: "#4ade80", duplicatePayout: 8 },
  Rare: { label: "Rare", color: "#76a7ff", duplicatePayout: 12 },
  Epic: { label: "Super Rare", color: "#c58aff", duplicatePayout: 20 },
  Legendary: { label: "Legendary", color: "#f5cc54", duplicatePayout: 40 },
  Mythical: { label: "Mythical", color: "#ff777c", duplicatePayout: 80 },
} as const;

const MAX_BALANCE = 2_147_483_647;
const validAmount = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= 0 &&
  value <= MAX_BALANCE;
export function isStyleShardRarity(value: unknown): value is StyleShardRarity {
  return (
    typeof value === "string" &&
    (STYLE_SHARD_RARITIES as readonly string[]).includes(value)
  );
}
export function styleShardRarityForCard(rarity: CardRarity): StyleShardRarity {
  return rarity === "SuperCommon" ? "Common" : rarity;
}
export function styleShardLabel(rarity?: string | null): string {
  return `${isStyleShardRarity(rarity) ? STYLE_SHARD_TIERS[rarity].label : "Universal"} Style Shards`;
}
/** Missing fields belong to old profiles. Never infer balances from old receipts. */
export function normalizeStyleShardBalances(
  value: unknown,
): Record<StyleShardRarity, number> {
  const input =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return Object.fromEntries(
    STYLE_SHARD_RARITIES.map((rarity) => [
      rarity,
      validAmount(input[rarity]) ? input[rarity] : 0,
    ]),
  ) as Record<StyleShardRarity, number>;
}
export function addStyleShardBalances(
  current: StyleShardBalances | undefined,
  gained: StyleShardBalances,
): Record<StyleShardRarity, number> {
  const next = normalizeStyleShardBalances(current);
  for (const rarity of STYLE_SHARD_RARITIES) {
    const amount = gained[rarity] ?? 0;
    if (!validAmount(amount) || !validAmount(next[rarity] + amount))
      throw new Error("Style Shard balance exceeds the supported range.");
    next[rarity] += amount;
  }
  return next;
}

export function quoteStyleShards(
  wallet: StyleShardWallet,
  cardRarity: CardRarity,
  cost: number,
) {
  if (!validAmount(cost) || cost === 0)
    throw new Error("Invalid Style Shard cost.");
  const rarity = styleShardRarityForCard(cardRarity);
  const matchingAvailable = normalizeStyleShardBalances(
    wallet.styleShardBalances,
  )[rarity];
  const universalAvailable = validAmount(wallet.styleShards)
    ? wallet.styleShards
    : 0;
  const matchingSpend = Math.min(matchingAvailable, cost);
  const universalSpend = Math.min(universalAvailable, cost - matchingSpend);
  const shortfall = cost - matchingSpend - universalSpend;
  return {
    rarity,
    cost,
    matchingAvailable,
    universalAvailable,
    matchingSpend,
    universalSpend,
    shortfall,
    canAfford: shortfall === 0,
  };
}

/** Matching shards first; universal shards cover only the explicitly quoted gap. */
export function spendStyleShards(
  wallet: StyleShardWallet,
  cardRarity: CardRarity,
  cost: number,
) {
  const quote = quoteStyleShards(wallet, cardRarity, cost);
  if (!quote.canAfford)
    throw new Error(
      `You need ${quote.shortfall} more ${STYLE_SHARD_TIERS[quote.rarity].label} or Universal Style Shards.`,
    );
  const balances = normalizeStyleShardBalances(wallet.styleShardBalances);
  balances[quote.rarity] -= quote.matchingSpend;
  return {
    styleShards: wallet.styleShards - quote.universalSpend,
    styleShardBalances: balances,
    payment: {
      rarity: quote.rarity,
      matching: quote.matchingSpend,
      universal: quote.universalSpend,
    },
  };
}

export type ShardReward = {
  kind: string;
  amount: number;
  shardRarity?: string | null;
};
/** Receipt metadata, not the source card rarity, identifies the currency issued. */
export function totalStyleShardRewards(rewards: readonly ShardReward[]) {
  let styleShardsGained = 0;
  const styleShardBalancesGained = normalizeStyleShardBalances(undefined);
  for (const reward of rewards) {
    if (reward.kind !== "styleShards") continue;
    if (!validAmount(reward.amount))
      throw new Error("Invalid Style Shard reward.");
    if (reward.shardRarity != null) {
      if (!isStyleShardRarity(reward.shardRarity))
        throw new Error("Unknown Style Shard rarity.");
      styleShardBalancesGained[reward.shardRarity] += reward.amount;
      if (!validAmount(styleShardBalancesGained[reward.shardRarity]))
        throw new Error("Style Shard reward exceeds the supported range.");
    } else {
      styleShardsGained += reward.amount;
      if (!validAmount(styleShardsGained))
        throw new Error("Style Shard reward exceeds the supported range.");
    }
  }
  return { styleShardsGained, styleShardBalancesGained };
}
