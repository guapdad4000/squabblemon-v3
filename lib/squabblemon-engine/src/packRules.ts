export const STREET_PACK_RARITY_WEIGHTS = {
  SuperCommon: 40,
  Common: 20,
  Uncommon: 25,
  Rare: 12,
  Epic: 2,
  Legendary: 0.8,
  Mythical: 0.2,
} as const;

export type PackRarity = keyof typeof STREET_PACK_RARITY_WEIGHTS;
export const PACK_RARITIES = Object.keys(STREET_PACK_RARITY_WEIGHTS) as PackRarity[];
export const PACK_RARITY_LABELS: Readonly<Record<PackRarity, string>> = {
  SuperCommon: "Super Common",
  Common: "Common",
  Uncommon: "Uncommon",
  Rare: "Rare",
  Epic: "Super Rare",
  Legendary: "Legendary",
  Mythical: "Mythical",
};

export const RARE_PLUS_GUARANTEE_WEIGHTS = {
  Rare: 80,
  Epic: 15,
  Legendary: 4,
  Mythical: 1,
} as const satisfies Partial<Record<PackRarity, number>>;

export const STREET_PACK_RULES = {
  gameplaySlots: 5,
  protectedSlots: 2,
  duplicateStyleShards: 5,
  pityLimit: 10,
  single: { ticketCost: 1, softCurrencyCost: 200, rewards: 6 },
  ten: { ticketCost: 10, softCurrencyCost: 1800, rewards: 60 },
  bonus: {
    styleShardChance: 30,
    styleShardAmounts: [5, 10, 15] as const,
    cloutChance: 65,
    cloutAmounts: [25, 50] as const,
    featuredStyleChance: 5,
    exhaustedStyleClout: 25,
  },
} as const;

export type PackRandomInt = (maxExclusive: number) => number;

export function rollWeightedRarity<T extends string>(
  weights: Readonly<Record<T, number>>,
  rng: PackRandomInt,
): T {
  const entries = Object.entries(weights) as Array<[T, number]>;
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  const scale = 100;
  const roll = rng(Math.round(total * scale));
  let threshold = 0;
  for (const [rarity, weight] of entries) {
    threshold += Math.round(weight * scale);
    if (roll < threshold) return rarity;
  }
  return entries[entries.length - 1][0];
}

/**
 * Selects only within the independently rolled rarity. A pack avoids repeating
 * cards in that tier until the tier is exhausted, then restores the whole tier.
 */
export function choosePackCardFromTier<T extends { catalogId: string }>(input: {
  rarity: PackRarity;
  tier: readonly T[];
  pulledCardIds: ReadonlySet<string>;
  ownedCardIds: ReadonlySet<string>;
  protectNew: boolean;
  rng: PackRandomInt;
}): T {
  if (input.tier.length === 0) {
    throw new Error(`Street Pack rarity tier ${input.rarity} has no gameplay cards`);
  }
  const notPulled = input.tier.filter(card => !input.pulledCardIds.has(card.catalogId));
  const eligible = notPulled.length > 0 ? notPulled : [...input.tier];
  const protectedPool = input.protectNew
    ? eligible.filter(card => !input.ownedCardIds.has(card.catalogId))
    : [];
  const pool = protectedPool.length > 0 ? protectedPool : eligible;
  return pool[input.rng(pool.length)];
}

export const STREET_PACK_DISCLOSURES = [
  {
    label: "Slots 1–2 · Same-rarity new-card protection",
    chance: 100,
    detail: `Each slot rolls rarity independently. Within that rolled rarity, an unowned gameplay card is chosen when available. If that rarity has no unowned card, duplicates are possible.`,
  },
  {
    label: "Slots 3–5 · Gang cards",
    chance: 100,
    detail: `Each slot independently rolls ${PACK_RARITY_LABELS.SuperCommon} ${STREET_PACK_RARITY_WEIGHTS.SuperCommon}%, ${PACK_RARITY_LABELS.Common} ${STREET_PACK_RARITY_WEIGHTS.Common}%, ${PACK_RARITY_LABELS.Uncommon} ${STREET_PACK_RARITY_WEIGHTS.Uncommon}%, ${PACK_RARITY_LABELS.Rare} ${STREET_PACK_RARITY_WEIGHTS.Rare}%, ${PACK_RARITY_LABELS.Epic} ${STREET_PACK_RARITY_WEIGHTS.Epic}%, ${PACK_RARITY_LABELS.Legendary} ${STREET_PACK_RARITY_WEIGHTS.Legendary}%, or ${PACK_RARITY_LABELS.Mythical} ${STREET_PACK_RARITY_WEIGHTS.Mythical}%. A card does not repeat within its rarity tier until that tier is exhausted. Duplicate gameplay cards become ${STREET_PACK_RULES.duplicateStyleShards} Style Shards. An empty authored rarity tier fails the opening explicitly; it is never promoted to another rarity.`,
  },
  {
    label: "Bonus · Style Shards",
    chance: STREET_PACK_RULES.bonus.styleShardChance,
    detail: `Nominal ${STREET_PACK_RULES.bonus.styleShardChance}% chance. ${STREET_PACK_RULES.bonus.styleShardAmounts.join(", ")} Style Shards, each amount equally likely. Cosmetic pity can override the nominal bonus probabilities.`,
  },
  {
    label: "Bonus · Clout",
    chance: STREET_PACK_RULES.bonus.cloutChance,
    detail: `Nominal ${STREET_PACK_RULES.bonus.cloutChance}% chance. ${STREET_PACK_RULES.bonus.cloutAmounts.join(" or ")} Clout, each amount equally likely. Cosmetic pity can override the nominal bonus probabilities.`,
  },
  {
    label: "Bonus · Featured style",
    chance: STREET_PACK_RULES.bonus.featuredStyleChance,
    detail: `Nominal ${STREET_PACK_RULES.bonus.featuredStyleChance}% chance for an unowned cosmetic card variant. The ${STREET_PACK_RULES.pityLimit}th eligible pack overrides the nominal bonus probabilities and guarantees this result. When every style is owned, a style result becomes ${STREET_PACK_RULES.bonus.exhaustedStyleClout} Clout and style pity resets.`,
  },
  {
    label: "Ten-Pull · Rare or better guarantee",
    chance: 100,
    detail: `After all 50 gameplay slots roll, the ten-pull checks gameplay cards only. A duplicate ${PACK_RARITY_LABELS.Rare}, ${PACK_RARITY_LABELS.Epic}, ${PACK_RARITY_LABELS.Legendary}, or ${PACK_RARITY_LABELS.Mythical} counts; cosmetic styles do not. If none appeared, the last gameplay card is replaced so the haul stays at ${STREET_PACK_RULES.ten.rewards} rewards. The replacement rarity rolls ${PACK_RARITY_LABELS.Rare} ${RARE_PLUS_GUARANTEE_WEIGHTS.Rare}%, ${PACK_RARITY_LABELS.Epic} ${RARE_PLUS_GUARANTEE_WEIGHTS.Epic}%, ${PACK_RARITY_LABELS.Legendary} ${RARE_PLUS_GUARANTEE_WEIGHTS.Legendary}%, or ${PACK_RARITY_LABELS.Mythical} ${RARE_PLUS_GUARANTEE_WEIGHTS.Mythical}% independent of ownership, so it is not guaranteed to be a new card.`,
  },
] as const;