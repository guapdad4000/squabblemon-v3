import { randomInt } from "node:crypto";
import {
  cardCatalog,
  catalogCardById,
  type CardRarity,
} from "@workspace/squabblemon-engine/data";

export const STREET_PACK_CONFIG = {
  id: "street-pack",
  name: "Street Pack",
  oddsVersion: "street-pack-v2",
  softCurrencyCost: 200,
  ticketCost: 1,
  rewardsPerPack: 3,
  pityLimit: 10,
  odds: [
    {
      label: "Slot 1 · Crew card",
      chance: 100,
      detail:
        "Guaranteed new gameplay card while one remains in the Street Pack pool. A duplicate becomes 25 Style Shards.",
    },
    {
      label: "Slot 2 · Crew card",
      chance: 45,
      detail: "Base card rarity odds: Common 60%, Uncommon 25%, Rare 12%, Epic 3%.",
    },
    {
      label: "Slot 2 · Style Shards",
      chance: 30,
      detail: "20 or 35 Style Shards.",
    },
    {
      label: "Slot 2 · Clout",
      chance: 20,
      detail: "75 or 125 Clout.",
    },
    {
      label: "Slot 2 · Featured style",
      chance: 5,
      detail:
        "An unowned cosmetic card variant, protected by pity. After every style is owned, this 5% result converts to 50 Style Shards and pity is retired.",
    },
    {
      label: "Slot 3 · Style Shards",
      chance: 70,
      detail: "15, 25, or 40 Style Shards.",
    },
    {
      label: "Slot 3 · Clout",
      chance: 30,
      detail: "50 or 100 Clout.",
    },
  ],
} as const;

export type ApiPackReward = {
  kind: "card" | "styleShards" | "softCurrency" | "variant";
  cardId: string | null;
  variantId: string | null;
  name: string | null;
  rarity: string | null;
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

const rarityThresholds: Array<[CardRarity, number]> = [
  ["Common", 6000],
  ["Uncommon", 8500],
  ["Rare", 9700],
  ["Epic", 10000],
];

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
  rarity: null,
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

  const missing = cardCatalog.filter((card) => !ownedCards.has(card.catalogId));
  const firstCard = chooseCardByRarity(
    missing.length ? missing : cardCatalog,
    rng,
  );
  discoveredCards.add(firstCard.catalogId);
  if (missing.length) {
    ownedCards.add(firstCard.catalogId);
    rewards.push(cardReward(firstCard));
  } else {
    rewards.push(shardReward(25, firstCard.catalogId));
    styleShardsGained += 25;
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
  } else if (bonusRoll < 4500) {
    const bonusCard = chooseCardByRarity(cardCatalog, rng);
    discoveredCards.add(bonusCard.catalogId);
    if (!ownedCards.has(bonusCard.catalogId)) {
      ownedCards.add(bonusCard.catalogId);
      rewards.push(cardReward(bonusCard));
    } else {
      rewards.push(shardReward(25, bonusCard.catalogId));
      styleShardsGained += 25;
    }
  } else if (bonusRoll < 7500) {
    const amount = choose([20, 35], rng);
    rewards.push(shardReward(amount));
    styleShardsGained += amount;
  } else if (bonusRoll < 9500) {
    const amount = choose([75, 125], rng);
    rewards.push(currencyReward(amount));
    softCurrencyGained += amount;
  } else {
    rewards.push(shardReward(50));
    styleShardsGained += 50;
  }

  if (rng(10000) < 7000) {
    const amount = choose([15, 25, 40], rng);
    rewards.push(shardReward(amount));
    styleShardsGained += amount;
  } else {
    const amount = choose([50, 100], rng);
    rewards.push(currencyReward(amount));
    softCurrencyGained += amount;
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
    description: "Your first legal seven-card crew is ready for the street.",
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