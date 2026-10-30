import { STYLE_SHARD_TIERS, styleShardRarityForCard, totalStyleShardRewards, type StyleShardBalances, type StyleShardRarity } from '@workspace/squabblemon-engine/styleShards';
import { randomInt } from "node:crypto";
import { isAnunakiCardId } from '@workspace/squabblemon-engine/anunakiWave';
import { ANUNAKI_BANNER_CARD_IDS, ANUNAKI_BANNER_GAMEPLAY_READY } from '@workspace/squabblemon-engine/anunakiBanner';
import {
  cardCatalog,
  catalogCardById,
  isGeneralPackCardId,
  isKumiteExclusiveCard,
  type CardRarity,
} from "@workspace/squabblemon-engine/data";
import {
  FEATURED_PACK_RULES,
  choosePackCardFromTier,
  RARE_PLUS_GUARANTEE_WEIGHTS,
  rollWeightedRarity,
  STREET_PACK_DISCLOSURES,
  STREET_PACK_RARITY_WEIGHTS,
  STREET_PACK_RULES,
  type PackRandomInt,
  type PackRarity,
  isPullCount, streetPackCost, type PullCount,
} from "@workspace/squabblemon-engine/packRules";

export { STREET_PACK_RARITY_WEIGHTS };

export const STREET_PACK_CONFIG = {
  id: "street-pack",
  name: "Street Pack",
  oddsVersion: "street-pack-v7",
  softCurrencyCost: STREET_PACK_RULES.single.softCurrencyCost,
  ticketCost: STREET_PACK_RULES.single.ticketCost,
  rewardsPerPack: STREET_PACK_RULES.single.rewards,
  pityLimit: STREET_PACK_RULES.pityLimit,
  odds: STREET_PACK_DISCLOSURES,
} as const;

export const STREET_PACK_TEN_PULL_CONFIG = {
  id: "street-pack-ten",
  name: "Street Pack Ten-Pull",
  oddsVersion: "street-pack-ten-v3",
  pullCount: 10,
  ticketCost: STREET_PACK_RULES.ten.ticketCost,
  softCurrencyCost: STREET_PACK_RULES.ten.softCurrencyCost,
  rewardsPerPull: STREET_PACK_RULES.ten.rewards,
  rarePityBonusPerPull: 1,
} as const;

export { ALLOWED_PULL_COUNTS, isPullCount, type PullCount } from '@workspace/squabblemon-engine/packRules';
export const tierForPullCount = (pullCount: PullCount) => pullCount === 10 ? STREET_PACK_TEN_PULL_CONFIG
  : pullCount === 1 ? STREET_PACK_CONFIG
    : { ...STREET_PACK_CONFIG, ...streetPackCost(pullCount), oddsVersion: `street-pack-batch-${pullCount}-v1`, pullCount };
export type StreetPackTier = ReturnType<typeof tierForPullCount>;

export type ApiPackReward = {
  kind: "card" | "styleShards" | "softCurrency" | "variant";
  cardId: string | null;
  variantId: string | null;
  name: string | null;
  rarity: CardRarity | null;
  isNew: boolean;
  amount: number;
  shardRarity?: StyleShardRarity | null;
};

export type GeneratedStreetPack = {
  rewards: ApiPackReward[];
  ownedCardIds: string[];
  discoveredCardIds: string[];
  ownedVariants: string[];
  styleShardsGained: number;
  styleShardBalancesGained: StyleShardBalances;
  softCurrencyGained: number;
  pityAfter: number;
  featuredMissesAfter?: number;
  featuredHits?: Array<{ index: number; cardId: string; guaranteed: boolean }>;
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
const duplicateReward = (card: (typeof cardCatalog)[number]): ApiPackReward => {
  const shardRarity = styleShardRarityForCard(card.rarity);
  return { ...shardReward(STYLE_SHARD_TIERS[shardRarity].duplicatePayout, card.catalogId), shardRarity };
};
const currencyReward = (amount: number): ApiPackReward => ({
  kind: "softCurrency", cardId: null, variantId: null, name: "Clout",
  rarity: null, isNew: false, amount,
});

export function isStreetPackCard(card: Pick<(typeof cardCatalog)[number], "catalogId">) {
  return isGeneralPackCardId(card.catalogId);
}

function availableVariants(ownedVariants: ReadonlySet<string>, ownedCardIds: ReadonlySet<string>) {
  return cardCatalog.filter(card => !isKumiteExclusiveCard(card.catalogId) && !isAnunakiCardId(card.catalogId) && (isStreetPackCard(card) || ownedCardIds.has(card.catalogId))).flatMap(card => card.variantSlots
    .filter(variant => !variant.progressionOnly && !ownedVariants.has(variant.id))
    .map(variant => ({ card, variant })));
}

export type CardPools = Readonly<Record<PackRarity, readonly (typeof cardCatalog)[number][]>>;
const catalogPools = Object.fromEntries(
  Object.keys(STREET_PACK_RARITY_WEIGHTS).map(rarity => [
    rarity,
    cardCatalog.filter(card => card.rarity === rarity && isStreetPackCard(card)),
  ]),
) as unknown as CardPools;

/** Only the separately authorized event banner adds its seven cards to normal rarity tiers. */
export function buildAnunakiBannerPools(source: readonly (typeof cardCatalog)[number][], ready: boolean): CardPools {
  if (!ready || ANUNAKI_BANNER_CARD_IDS.some(id => !source.some(card => card.catalogId === id))) {
    throw new Error('Anunaki banner is unavailable.');
  }
  return Object.fromEntries(Object.keys(STREET_PACK_RARITY_WEIGHTS).map(rarity => [rarity,
    source.filter(card => card.rarity === rarity && (isStreetPackCard(card)
      || (ANUNAKI_BANNER_CARD_IDS as readonly string[]).includes(card.catalogId))),
  ])) as unknown as CardPools;
}
export function anunakiBannerPools(): CardPools {
  return buildAnunakiBannerPools(cardCatalog, ANUNAKI_BANNER_GAMEPLAY_READY);
}

/** Testable tier boundary used by pack generation; empty authored tiers fail loudly. */
export function drawGameplayCard(input: {
  featuredCardIds?: readonly string[];
  pools?: CardPools;
  pulledCardIds: ReadonlySet<string>;
  ownedCardIds: ReadonlySet<string>;
  protectNew: boolean;
  rng: PackRandomInt;
}) {
  const rarity = rollWeightedRarity(STREET_PACK_RARITY_WEIGHTS, input.rng);
  return choosePackCardFromTier({
    featuredCardIds: input.featuredCardIds,
    rarity,
    tier: (input.pools ?? catalogPools)[rarity],
    pulledCardIds: input.pulledCardIds,
    ownedCardIds: input.ownedCardIds,
    protectNew: input.protectNew,
    rng: input.rng,
  });
}

export function generateStreetPack(
  current: { ownedCardIds: string[]; discoveredCardIds: string[]; ownedVariants: string[]; pity: number; featuredMisses?: number },
  rng: PackRandomInt = randomInt,
  featuredCardIds: readonly string[] = [],
  pools: CardPools = catalogPools,
): GeneratedStreetPack {
  const ownedCards = new Set(current.ownedCardIds);
  const discoveredCards = new Set(current.discoveredCardIds);
  const ownedVariants = new Set(current.ownedVariants);
  const pulled = new Set<string>();
  const rewards: ApiPackReward[] = [];
  const featuredCards = featuredCardIds.map(id => catalogCardById[id]);
  if (featuredCards.some(card => !card)) throw new Error('Featured banner has an unknown fighter.');
  const selected = new Set(featuredCardIds);
  const normalPools = featuredCards.length ? Object.fromEntries(Object.entries(pools).map(([rarity, cards]) => [rarity, cards.filter(card => !selected.has(card.catalogId))])) as unknown as CardPools : pools;
  const misses = Math.min(9, Math.max(0, current.featuredMisses ?? 0));
  let featuredMissesAfter = misses;
  const featuredHits: NonNullable<GeneratedStreetPack['featuredHits']> = [];

  for (let slot = 0; slot < STREET_PACK_RULES.gameplaySlots; slot++) {
    const guaranteed = featuredCards.length > 0 && misses >= FEATURED_PACK_RULES.pityLimit - 1;
    const featuredSlot = featuredCards.length > 0 && slot === FEATURED_PACK_RULES.slot - 1;
    const featuredHit = featuredSlot && (guaranteed || rng(10000) < FEATURED_PACK_RULES.chance * 100);
    const unownedFeatured = guaranteed ? featuredCards.filter(card => !ownedCards.has(card.catalogId)) : [];
    const card = featuredHit ? choose(unownedFeatured.length ? unownedFeatured : featuredCards, rng) : drawGameplayCard({
      pulledCardIds: pulled, ownedCardIds: ownedCards,
      protectNew: slot < STREET_PACK_RULES.protectedSlots, rng, pools: normalPools,
    });
    if (featuredSlot) featuredMissesAfter = featuredHit ? 0 : Math.min(9, misses + 1);
    if (featuredHit) featuredHits.push({ index: slot, cardId: card.catalogId, guaranteed });
    pulled.add(card.catalogId);
    discoveredCards.add(card.catalogId);
    if (ownedCards.has(card.catalogId)) {
      rewards.push(duplicateReward(card));
    } else {
      ownedCards.add(card.catalogId);
      rewards.push(cardReward(card));
    }
  }

  const variants = availableVariants(ownedVariants, ownedCards);
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
    ...(featuredCards.length ? { featuredMissesAfter, featuredHits } : {}),
    ownedCardIds: [...ownedCards],
    discoveredCardIds: [...discoveredCards],
    ownedVariants: [...ownedVariants],
    ...totalStyleShardRewards(rewards),
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
  current: { ownedCardIds: string[]; discoveredCardIds: string[]; ownedVariants: string[]; pity: number; featuredMisses?: number },
  rng: PackRandomInt = randomInt,
  featuredCardIds: readonly string[] = [],
  pools: CardPools = catalogPools,
): GeneratedStreetTenPull {
  let state = { ...current };
  const rewards: ApiPackReward[] = [];
  const featuredHits: NonNullable<GeneratedStreetPack['featuredHits']> = [];
  for (let pull = 0; pull < STREET_PACK_TEN_PULL_CONFIG.pullCount; pull++) {
    const result = generateStreetPack(state, rng, featuredCardIds, pools);
    featuredHits.push(...(result.featuredHits ?? []).map(hit => ({ ...hit, index: rewards.length + hit.index })));
    rewards.push(...result.rewards);
    state = {
      ownedCardIds: result.ownedCardIds, discoveredCardIds: result.discoveredCardIds,
      ownedVariants: result.ownedVariants, pity: result.pityAfter, featuredMisses: result.featuredMissesAfter,
    };
  }

  let guaranteedRareIndex = rewards.findIndex(gameplayRarePlus);
  if (guaranteedRareIndex < 0) {
    // Final gameplay slot, never the cosmetic/currency bonus.
    guaranteedRareIndex = rewards.length - (featuredCardIds.length ? 3 : 2);
    const rarity = rollWeightedRarity(RARE_PLUS_GUARANTEE_WEIGHTS, rng);
    const card = choosePackCardFromTier({ rarity, tier: pools[rarity].filter(card => !featuredCardIds.includes(card.catalogId)), pulledCardIds: new Set(), ownedCardIds: new Set(), protectNew: false, rng });
    const initiallyOrPreviouslyOwned = current.ownedCardIds.includes(card.catalogId)
      || rewards.slice(0, guaranteedRareIndex).some(r => r.kind === "card" && r.cardId === card.catalogId);
    rewards[guaranteedRareIndex] = initiallyOrPreviouslyOwned
      ? duplicateReward(card)
      : cardReward(card);
  }

  const inventory = rebuildInventory(current, rewards);
  return {
    rewards,
    ...inventory,
    ...totalStyleShardRewards(rewards),
    softCurrencyGained: rewards.filter(r => r.kind === "softCurrency").reduce((sum, r) => sum + r.amount, 0),
    pityAfter: state.pity,
    ...(featuredCardIds.length ? { featuredMissesAfter: state.featuredMisses, featuredHits } : {}),
    guaranteedRareIndex,
  };
}

/** Exactly N sequential singles, sharing inventory and style pity, with no ten-pack guarantee. */
export function generateStreetBatch(
  current: { ownedCardIds: string[]; discoveredCardIds: string[]; ownedVariants: string[]; pity: number; featuredMisses?: number },
  count: PullCount, rng: PackRandomInt = randomInt, featuredCardIds: readonly string[] = [],
  pools: CardPools = catalogPools,
): GeneratedStreetPack {
  if (!isPullCount(count)) throw new Error('Pull count must be an integer from 1 to 10');
  if (count === 10) return generateStreetTenPull(current, rng, featuredCardIds, pools);
  let state = { ...current };
  const rewards: ApiPackReward[] = [];
  const featuredHits: NonNullable<GeneratedStreetPack['featuredHits']> = [];
  for (let index = 0; index < count; index++) {
    const next = generateStreetPack(state, rng, featuredCardIds, pools);
    featuredHits.push(...(next.featuredHits ?? []).map(hit => ({ ...hit, index: rewards.length + hit.index })));
    rewards.push(...next.rewards);
    state = { ownedCardIds: next.ownedCardIds, discoveredCardIds: next.discoveredCardIds, ownedVariants: next.ownedVariants, pity: next.pityAfter, featuredMisses: next.featuredMissesAfter };
  }
  return { rewards, ...(featuredCardIds.length ? { featuredMissesAfter: state.featuredMisses, featuredHits } : {}), ...rebuildInventory(current, rewards), ...totalStyleShardRewards(rewards),
    softCurrencyGained: rewards.filter(reward => reward.kind === 'softCurrency').reduce((sum, reward) => sum + reward.amount, 0), pityAfter: state.pity };
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
  { id: "full-roster", threshold: cardCatalog.filter(card => !isAnunakiCardId(card.catalogId)).length, title: "Whole Block", description: "Every gameplay card in the launch pool is yours.", rewardLabel: "2 deck slots + 300 Clout", cardId: null, reward: { deckSlots: 2, softCurrency: 300 } },
];
/** Event cards count toward ordinary early milestones, but cannot replace launch cards in Whole Block. */
const fullRosterCardIds = new Set(cardCatalog.filter(card => !isAnunakiCardId(card.catalogId)).map(card => card.catalogId));
export function collectionRoadProgress(milestone: CollectionRoadDefinition, ownedCardIds: readonly string[]): number {
  return milestone.id === 'full-roster' ? new Set(ownedCardIds.filter(id => fullRosterCardIds.has(id))).size : ownedCardIds.length;
}
