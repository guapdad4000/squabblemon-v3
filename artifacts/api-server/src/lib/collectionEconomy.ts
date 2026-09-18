import { randomInt } from "node:crypto";
import {
  cardCatalog,
  catalogCardById,
  type CardRarity,
  CARD_RARITY_DEFINITIONS,
} from "@workspace/squabblemon-engine/data";

export const STREET_PACK_RARITY_WEIGHTS: Record<CardRarity, number> = {
  SuperCommon: 40,
  Common: 20,
  Uncommon: 25,
  Rare: 12,
  Epic: 2,
  Legendary: 0.8,
  Mythical: 0.2,
};

const publishedRarityOdds = Object.entries(STREET_PACK_RARITY_WEIGHTS)
  .map(([rarity, chance]) => `${CARD_RARITY_DEFINITIONS[rarity as CardRarity].label} ${chance}%`)
  .join(", ");

export const STREET_PACK_CONFIG = {
  id: "street-pack",
  name: "Street Pack",
  oddsVersion: "street-pack-v5",
  softCurrencyCost: 200,
  ticketCost: 1,
  rewardsPerPack: 6,
  pityLimit: 10,
  odds: [
    {
      label: "Slots 1–2 · New crew cards",
      chance: 100,
      detail:
        "Each of the first two pulls guarantees a new gameplay card while one remains. If the rolled rarity has no unowned cards, choose uniformly from remaining missing cards. Effective rarity odds change with your collection. Owned cards become 25 Style Shards.",
    },
    {
      label: "Slots 3–5 · Crew cards",
      chance: 100,
      detail: `Base card rarity odds: ${publishedRarityOdds}. Five different card pulls per pack; a rarity with no eligible cards falls back to the remaining pool, so effective odds can vary. Owned cards become 25 Style Shards.`,
    },
    {
      label: "Bonus · Style Shards",
      chance: 70,
      detail: "15, 25, or 40 Style Shards.",
    },
    {
      label: "Bonus · Clout",
      chance: 25,
      detail: "50 or 100 Clout.",
    },
    {
      label: "Bonus · Featured style",
      chance: 5,
      detail:
        "An unowned cosmetic card variant, protected by pity. After every style is owned, this 5% result converts to 50 Style Shards and pity is retired.",
    },
  ],
} as const;

export type ApiPackReward = {
  kind: "card" | "styleShards" | "softCurrency" | "variant";
  cardId: string | null;
  variantId: string | null;
  name: string | null;
  rarity: CardRarity | null;
  isNew: boolean;
  amount: number;
};

export type GeneratedStreetPack = {
  rewards: ApiPackReward[];
  ownedCardIds: string[];
  discoveredCardIds: string[];
  ownedVariants: string[];
  styleShardsGained: number;
  softCurrencyGained: number;
  pityAfter: number;
};

type RandomInt = (maxExclusive: number) => number;

const rarityThresholds = Object.entries(STREET_PACK_RARITY_WEIGHTS).reduce(
  (thresholds, [rarity, weight]) => {
    const previous = thresholds.at(-1)?.[1] ?? 0;
    thresholds.push([rarity as CardRarity, previous + weight * 100]);
    return thresholds;
  },
  [] as Array<[CardRarity, number]>,
);

function choose<T>(items: T[], rng: RandomInt): T {
  if (!items.length) throw new Error("Cannot choose from an empty pool");
  return items[rng(items.length)];
}

function chooseCardByRarity<T extends { rarity: CardRarity }>(
  pool: T[],
  rng: RandomInt,
): T {
  const roll = rng(10000);
  const rarity =
    rarityThresholds.find(([, threshold]) => roll < threshold)?.[0] ??
    "Common";
  const rarityPool = pool.filter((card) => card.rarity === rarity);
  return choose(rarityPool.length ? rarityPool : pool, rng);
}

const cardReward = (
  card: (typeof cardCatalog)[number],
): ApiPackReward => ({
  kind: "card",
  cardId: card.catalogId,
  variantId: null,
  name: card.name,
  rarity: card.rarity,
  isNew: true,
  amount: 1,
});

const shardReward = (
  amount: number,
  sourceCardId: string | null = null,
): ApiPackReward => ({
  kind: "styleShards",
  cardId: sourceCardId,
  variantId: null,
  name: sourceCardId ? "Duplicate converted" : "Style Shards",
  rarity: sourceCardId ? catalogCardById[sourceCardId]?.rarity ?? null : null,
  isNew: false,
  amount,
});

const currencyReward = (amount: number): ApiPackReward => ({
  kind: "softCurrency",
  cardId: null,
  variantId: null,
  name: "Clout",
  rarity: null,
  isNew: false,
  amount,
});

function availableVariants(ownedVariants: Set<string>) {
  return cardCatalog.flatMap((card) =>
    card.variantSlots
      .filter((variant) => !ownedVariants.has(variant.id))
      .map((variant) => ({ card, variant })),
  );
}

export function generateStreetPack(
  current: {
    ownedCardIds: string[];
    discoveredCardIds: string[];
    ownedVariants: string[];
    pity: number;
  },
  rng: RandomInt = randomInt,
): GeneratedStreetPack {
  const ownedCards = new Set(
    current.ownedCardIds.filter((id) => catalogCardById[id]),
  );
  const discoveredCards = new Set(
    current.discoveredCardIds.filter((id) => catalogCardById[id]),
  );
  const ownedVariants = new Set(current.ownedVariants);
  const rewards: ApiPackReward[] = [];
  let styleShardsGained = 0;
  let softCurrencyGained = 0;
  let featuredVariantFound = false;

  const pulled = new Set<string>();
  for (let slot = 0; slot < 5; slot++) {
    const eligible = cardCatalog.filter(card => !pulled.has(card.catalogId));
    const missing = eligible.filter(card => !ownedCards.has(card.catalogId));
    const card = chooseCardByRarity(slot < 2 && missing.length ? missing : eligible, rng);
    pulled.add(card.catalogId);
    discoveredCards.add(card.catalogId);
    if (!ownedCards.has(card.catalogId)) {
      ownedCards.add(card.catalogId);
      rewards.push(cardReward(card));
    } else {
      rewards.push(shardReward(25, card.catalogId));
      styleShardsGained += 25;
    }
  }

  const variants = availableVariants(ownedVariants);
  const forceFeatured =
    variants.length > 0 &&
    current.pity >= STREET_PACK_CONFIG.pityLimit - 1;
  const bonusRoll = forceFeatured ? 9999 : rng(10000);

  if ((forceFeatured || bonusRoll >= 9500) && variants.length) {
    const { card, variant } = choose(variants, rng);
    ownedVariants.add(variant.id);
    discoveredCards.add(card.catalogId);
    rewards.push({
      kind: "variant",
      cardId: card.catalogId,
      variantId: variant.id,
      name: `${card.name} · ${variant.name}`,
      rarity: card.rarity,
      isNew: true,
      amount: 1,
    });
    featuredVariantFound = true;
  } else if (bonusRoll < 7000) {
    const amount = choose([15, 25, 40], rng);
    rewards.push(shardReward(amount));
    styleShardsGained += amount;
  } else if (bonusRoll < 9500) {
    const amount = choose([50, 100], rng);
    rewards.push(currencyReward(amount));
    softCurrencyGained += amount;
  } else {
    rewards.push(shardReward(50));
    styleShardsGained += 50;
  }

  return {
    rewards,
    ownedCardIds: [...ownedCards],
    discoveredCardIds: [...discoveredCards],
    ownedVariants: [...ownedVariants],
    styleShardsGained,
    softCurrencyGained,
    pityAfter:
      variants.length === 0 || featuredVariantFound
        ? 0
        : Math.min(
            STREET_PACK_CONFIG.pityLimit - 1,
            current.pity + 1,
          ),
  };
}

export type CollectionRoadDefinition = {
  id: string;
  threshold: number;
  title: string;
  description: string;
  rewardLabel: string;
  cardId: string | null;
  reward: {
    cardId?: string;
    softCurrency?: number;
    styleShards?: number;
    deckSlots?: number;
  };
};

export const COLLECTION_ROAD: CollectionRoadDefinition[] = [
  {
    id: "first-seven",
    threshold: 7,
    title: "Crew Certified",
    description: "Your collection has seven cards. Keep collecting to fill a ten-card crew.",
    rewardLabel: "Closet Nerd",
    cardId: "closet-nerd",
    reward: { cardId: "closet-nerd" },
  },
  {
    id: "nine-deep",
    threshold: 9,
    title: "Room Reader",
    description: "Nine different cards means more ways to answer a district.",
    rewardLabel: "Live Streamer + 50 Shards",
    cardId: "live-streamer",
    reward: { cardId: "live-streamer", styleShards: 50 },
  },
  {
    id: "twelve-deep",
    threshold: 12,
    title: "Neighborhood Name",
    description: "Your binder is starting to tell its own story.",
    rewardLabel: "Techbro Rich + 150 Clout",
    cardId: "techbro-rich",
    reward: { cardId: "techbro-rich", softCurrency: 150 },
  },
  {
    id: "full-roster",
    threshold: cardCatalog.length,
    title: "Whole Block",
    description: "Every gameplay card in the launch pool is yours.",
    rewardLabel: "2 deck slots + 300 Clout",
    cardId: null,
    reward: { deckSlots: 2, softCurrency: 300 },
  },
];
