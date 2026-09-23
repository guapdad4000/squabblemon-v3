import { randomInt } from "node:crypto";
import {
  cardCatalog,
  catalogCardById,
  type CardRarity,
} from "@workspace/squabblemon-engine/data";
import {
  choosePackCardFromTier,
  RARE_PLUS_GUARANTEE_WEIGHTS,
  rollWeightedRarity,
  STREET_PACK_DISCLOSURES,
  STREET_PACK_RARITY_WEIGHTS,
  STREET_PACK_RULES,
  type PackRandomInt,
  type PackRarity,
} from "@workspace/squabblemon-engine/packRules";

export { STREET_PACK_RARITY_WEIGHTS };

export const STREET_PACK_CONFIG = {
  id: "street-pack",
  name: "Street Pack",
  oddsVersion: "street-pack-v6",
  softCurrencyCost: STREET_PACK_RULES.single.softCurrencyCost,
  ticketCost: STREET_PACK_RULES.single.ticketCost,
  rewardsPerPack: STREET_PACK_RULES.single.rewards,
  pityLimit: STREET_PACK_RULES.pityLimit,
  odds: STREET_PACK_DISCLOSURES,
} as const;

export const STREET_PACK_TEN_PULL_CONFIG = {
  id: "street-pack-ten",
  name: "Street Pack Ten-Pull",
  oddsVersion: "street-pack-ten-v2",
  pullCount: 10,
  ticketCost: STREET_PACK_RULES.ten.ticketCost,
  softCurrencyCost: STREET_PACK_RULES.ten.softCurrencyCost,
  rewardsPerPull: STREET_PACK_RULES.ten.rewards,
  rarePityBonusPerPull: 1,
} as const;

export type StreetPackTier = typeof STREET_PACK_CONFIG | typeof STREET_PACK_TEN_PULL_CONFIG;
export const ALLOWED_PULL_COUNTS = [1, 10] as const;
export type PullCount = (typeof ALLOWED_PULL_COUNTS)[number];
export const isPullCount = (value: unknown): value is PullCount =>
  typeof value === "number" && (ALLOWED_PULL_COUNTS as readonly number[]).includes(value);
export const tierForPullCount = (pullCount: PullCount): StreetPackTier =>
  pullCount === 10 ? STREET_PACK_TEN_PULL_CONFIG : STREET_PACK_CONFIG;

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

const choose = <T>(items: readonly T[], rng: PackRandomInt): T => {
  if (!items.length) throw new Error("Cannot choose from an empty pool");
  return items[rng(items.length)];
};

const cardReward = (card: (typeof cardCatalog)[number]): ApiPackReward => ({
  kind: "card", cardId: card.catalogId, variantId: null, name: card.name,
  rarity: card.rarity, isNew: true, amount: 1,
});
const shardReward = (amount: number, sourceCardId: string | null = null): ApiPackReward => ({
  kind: "styleShards", cardId: sourceCardId, variantId: null,
  name: sourceCardId ? "Duplicate converted" : "Style Shards",
  rarity: sourceCardId ? catalogCardById[sourceCardId]?.rarity ?? null : null,
  isNew: false, amount,
});
const currencyReward = (amount: number): ApiPackReward => ({
  kind: "softCurrency", cardId: null, variantId: null, name: "Clout",
  rarity: null, isNew: false, amount,
});

function availableVariants(ownedVariants: ReadonlySet<string>) {
  return cardCatalog.flatMap(card => card.variantSlots
    .filter(variant => !ownedVariants.has(variant.id))
    .map(variant => ({ card, variant })));
}

type CardPools = Readonly<Record<PackRarity, readonly (typeof cardCatalog)[number][]>>;
const catalogPools = Object.fromEntries(
  Object.keys(STREET_PACK_RARITY_WEIGHTS).map(rarity => [
    rarity,
    cardCatalog.filter(card => card.rarity === rarity),
  ]),
) as unknown as CardPools;

/** Testable tier boundary used by pack generation; empty authored tiers fail loudly. */
export function drawGameplayCard(input: {
  pools?: CardPools;
  pulledCardIds: ReadonlySet<string>;
  ownedCardIds: ReadonlySet<string>;
  protectNew: boolean;
  rng: PackRandomInt;
}) {
  const rarity = rollWeightedRarity(STREET_PACK_RARITY_WEIGHTS, input.rng);
  return choosePackCardFromTier({
    rarity,
    tier: (input.pools ?? catalogPools)[rarity],
    pulledCardIds: input.pulledCardIds,
    ownedCardIds: input.ownedCardIds,
    protectNew: input.protectNew,
    rng: input.rng,
  });
}

export function generateStreetPack(
  current: { ownedCardIds: string[]; discoveredCardIds: string[]; ownedVariants: string[]; pity: number },
  rng: PackRandomInt = randomInt,
): GeneratedStreetPack {
  const ownedCards = new Set(current.ownedCardIds);
  const discoveredCards = new Set(current.discoveredCardIds);
  const ownedVariants = new Set(current.ownedVariants);
  const pulled = new Set<string>();
  const rewards: ApiPackReward[] = [];

  for (let slot = 0; slot < STREET_PACK_RULES.gameplaySlots; slot++) {
    const card = drawGameplayCard({
      pulledCardIds: pulled, ownedCardIds: ownedCards,
      protectNew: slot < STREET_PACK_RULES.protectedSlots, rng,
    });
    pulled.add(card.catalogId);
    discoveredCards.add(card.catalogId);
    if (ownedCards.has(card.catalogId)) {
      rewards.push(shardReward(STREET_PACK_RULES.duplicateStyleShards, card.catalogId));
    } else {
      ownedCards.add(card.catalogId);
      rewards.push(cardReward(card));
    }
  }

  const variants = availableVariants(ownedVariants);
  const forceStyle = variants.length > 0 && current.pity >= STREET_PACK_RULES.pityLimit - 1;
  const bonusRoll = forceStyle ? 9999 : rng(10000);
  const styleOutcome = forceStyle || bonusRoll >= 9500;
  if (styleOutcome && variants.length > 0) {
    const { card, variant } = choose(variants, rng);
    ownedVariants.add(variant.id);
    discoveredCards.add(card.catalogId);
    rewards.push({
      kind: "variant", cardId: card.catalogId, variantId: variant.id,
      name: `${card.name} · ${variant.name}`, rarity: card.rarity, isNew: true, amount: 1,
    });
  } else if (styleOutcome) {
    rewards.push(currencyReward(STREET_PACK_RULES.bonus.exhaustedStyleClout));
  } else if (bonusRoll < 3000) {
    rewards.push(shardReward(choose(STREET_PACK_RULES.bonus.styleShardAmounts, rng)));
  } else {
    rewards.push(currencyReward(choose(STREET_PACK_RULES.bonus.cloutAmounts, rng)));
  }

  return {
    rewards,
    ownedCardIds: [...ownedCards],
    discoveredCardIds: [...discoveredCards],
    ownedVariants: [...ownedVariants],
    styleShardsGained: rewards.filter(r => r.kind === "styleShards").reduce((sum, r) => sum + r.amount, 0),
    softCurrencyGained: rewards.filter(r => r.kind === "softCurrency").reduce((sum, r) => sum + r.amount, 0),
    pityAfter: variants.length === 0 || styleOutcome
      ? 0
      : Math.min(STREET_PACK_RULES.pityLimit - 1, current.pity + 1),
  };
}

export type GeneratedStreetTenPull = GeneratedStreetPack & { guaranteedRareIndex: number | null };
const RARE_PLUS = new Set<CardRarity>(["Rare", "Epic", "Legendary", "Mythical"]);
const gameplayRarePlus = (reward: ApiPackReward) =>
  (reward.kind === "card" || (reward.kind === "styleShards" && reward.cardId !== null))
  && reward.rarity !== null && RARE_PLUS.has(reward.rarity);

function rebuildInventory(
  current: { ownedCardIds: string[]; discoveredCardIds: string[]; ownedVariants: string[] },
  rewards: readonly ApiPackReward[],
) {
  const owned = new Set(current.ownedCardIds);
  const discovered = new Set(current.discoveredCardIds);
  const variants = new Set(current.ownedVariants);
  for (const reward of rewards) {
    if (reward.cardId) discovered.add(reward.cardId);
    if (reward.kind === "card" && reward.isNew && reward.cardId) owned.add(reward.cardId);
    if (reward.kind === "variant" && reward.variantId) variants.add(reward.variantId);
  }
  return { ownedCardIds: [...owned], discoveredCardIds: [...discovered], ownedVariants: [...variants] };
}

export function generateStreetTenPull(
  current: { ownedCardIds: string[]; discoveredCardIds: string[]; ownedVariants: string[]; pity: number },
  rng: PackRandomInt = randomInt,
): GeneratedStreetTenPull {
  let state = { ...current };
  const rewards: ApiPackReward[] = [];
  for (let pull = 0; pull < STREET_PACK_TEN_PULL_CONFIG.pullCount; pull++) {
    const result = generateStreetPack(state, rng);
    rewards.push(...result.rewards);
    state = {
      ownedCardIds: result.ownedCardIds, discoveredCardIds: result.discoveredCardIds,
      ownedVariants: result.ownedVariants, pity: result.pityAfter,
    };
  }

  let guaranteedRareIndex = rewards.findIndex(gameplayRarePlus);
  if (guaranteedRareIndex < 0) {
    // Final gameplay slot, never the cosmetic/currency bonus.
    guaranteedRareIndex = rewards.length - 2;
    const rarity = rollWeightedRarity(RARE_PLUS_GUARANTEE_WEIGHTS, rng);
    const card = choose(catalogPools[rarity], rng);
    const initiallyOrPreviouslyOwned = current.ownedCardIds.includes(card.catalogId)
      || rewards.slice(0, guaranteedRareIndex).some(r => r.kind === "card" && r.cardId === card.catalogId);
    rewards[guaranteedRareIndex] = initiallyOrPreviouslyOwned
      ? shardReward(STREET_PACK_RULES.duplicateStyleShards, card.catalogId)
      : cardReward(card);
  }

  const inventory = rebuildInventory(current, rewards);
  return {
    rewards,
    ...inventory,
    styleShardsGained: rewards.filter(r => r.kind === "styleShards").reduce((sum, r) => sum + r.amount, 0),
    softCurrencyGained: rewards.filter(r => r.kind === "softCurrency").reduce((sum, r) => sum + r.amount, 0),
    pityAfter: state.pity,
    guaranteedRareIndex,
  };
}

export type CollectionRoadDefinition = {
  id: string;
  threshold: number;
  title: string;
  description: string;
  rewardLabel: string;
  cardId: string | null;
  reward: { cardId?: string; softCurrency?: number; styleShards?: number; deckSlots?: number };
};

export const COLLECTION_ROAD: CollectionRoadDefinition[] = [
  { id: "first-seven", threshold: 7, title: "Gang Certified", description: "Your collection has seven cards. Keep collecting to fill a ten-card gang.", rewardLabel: "Closet Nerd", cardId: "closet-nerd", reward: { cardId: "closet-nerd" } },
  { id: "nine-deep", threshold: 9, title: "Room Reader", description: "Nine different cards means more ways to answer a district.", rewardLabel: "Live Streamer + 50 Shards", cardId: "live-streamer", reward: { cardId: "live-streamer", styleShards: 50 } },
  { id: "twelve-deep", threshold: 12, title: "Neighborhood Name", description: "Your binder is starting to tell its own story.", rewardLabel: "Techbro Rich + 150 Clout", cardId: "techbro-rich", reward: { cardId: "techbro-rich", softCurrency: 150 } },
  { id: "full-roster", threshold: cardCatalog.length, title: "Whole Block", description: "Every gameplay card in the launch pool is yours.", rewardLabel: "2 deck slots + 300 Clout", cardId: null, reward: { deckSlots: 2, softCurrency: 300 } },
];