import { catalogCardById } from './data';
import { CHARACTER_STYLE_OFFERS, cosmeticId, hasCharacterStickers, styleSetFor, type CharacterStyleOfferId } from './cosmetics';
import { CARD_XP_CAP, cardLevelFromXp, normalizeCardProgress, type CardProgressionMap } from './cardProgression';

export const LEGACY_ECONOMY_VERSION = 'block-economy-v1';
export const ECONOMY_VERSION = 'block-economy-v2';
export type EconomyVersion = typeof LEGACY_ECONOMY_VERSION | typeof ECONOMY_VERSION;
export const ACCOUNT_XP_PER_LEVEL = 250;
export const TICKETS_PER_MAJOR_STORY_NODE = 2;
/** Finite story card rewards retain their original issued duplicate promise. */
export const STORY_DUPLICATE_STYLE_SHARDS = 25;
export const MOVE_TRAINING_COSTS = [100, 250, 500] as const;
export const WELCOME_REWARD = Object.freeze({
  accountXp: 100,
  softCurrency: 250,
  packTickets: 1,
  streetRep: 5,
});
export const MISSION_TEMPLATES = [
  { missionKey: 'weekly-cleanse', cadence: 'weekly', title: 'Clear the Air', description: 'Cleanse a friendly card in a verified practice fade.', goal: 1, rewardCurrency: 'softCurrency', rewardAmount: 100 },
  { missionKey: 'weekly-movement', cadence: 'weekly', title: 'Make Room', description: 'Win practice with a moved ally in a district you hold.', goal: 1, rewardCurrency: 'softCurrency', rewardAmount: 100 },
  { missionKey: 'weekly-experiment', cadence: 'weekly', title: 'Try Something New', description: 'Finish practice after changing at least one card from your last tested gang. Drafts do not count.', goal: 1, rewardCurrency: 'softCurrency', rewardAmount: 100 },
  { missionKey: 'rookie-road', cadence: 'onboarding', title: 'Finish Rookie Road', description: 'Complete the guided fade and choose your first gang.', goal: 1, rewardCurrency: 'packTickets', rewardAmount: 1 },
  { missionKey: 'daily-show-up', cadence: 'daily', title: 'Show Up', description: 'Finish one fade today.', goal: 1, rewardCurrency: 'softCurrency', rewardAmount: 100 },
  { missionKey: 'daily-take-room', cadence: 'daily', title: 'Take A Room', description: 'Win one fade today.', goal: 1, rewardCurrency: 'softCurrency', rewardAmount: 150 },
  { missionKey: 'weekly-main-character', cadence: 'weekly', title: 'Main Character Week', description: 'Finish five fades this week. No streak required.', goal: 5, rewardCurrency: 'packTickets', rewardAmount: 2 },
] as const;
export const MAX_DECK_SLOTS = 12;
export const SHOP_OFFERS = [
  ...CHARACTER_STYLE_OFFERS,
  { id: 'training', name: 'Practice Session', description: '+100 XP for one owned character.', price: 100, currency: 'softCurrency', needsCard: true },
  { id: 'training-intensive', name: 'Intensive Training', description: '+250 XP for one owned character.', price: 225, currency: 'softCurrency', needsCard: true },
  { id: 'move-training', name: 'Move Coaching', description: 'Activate the next move tier. Requires character level 2, 5, or 8.', price: MOVE_TRAINING_COSTS[0], currency: 'softCurrency', needsCard: true },
  { id: 'ticket', name: 'Street Pack Ticket', description: 'One ticket for one Street Pack.', price: 200, currency: 'softCurrency', needsCard: false },
  { id: 'deck-slot', name: 'Extra Gang Slot', description: 'Save one more custom deck. Maximum 12 slots.', price: 350, currency: 'softCurrency', needsCard: false },
  { id: 'common-recruit', name: 'Neighborhood Recruit', description: 'Choose one unowned Common. A guaranteed character, with no random roll.', price: 400, currency: 'softCurrency', needsCard: true },
  { id: 'tagged-style', name: 'Tagged Finish', description: 'Craft the Tagged cosmetic for an owned character.', price: 80, currency: 'styleShards', needsCard: true },
  { id: 'chrome-style', name: 'Chrome Finish', description: 'Craft the Chrome cosmetic for an owned character.', price: 140, currency: 'styleShards', needsCard: true },
] as const;
export type ShopItemId = typeof SHOP_OFFERS[number]['id'];
export type ShopRequest = { idempotencyKey: string; itemId: ShopItemId; cardId?: string };
export type ShopWallet = {
  softCurrency: number; packTickets: number; styleShards: number; deckSlots: number;
  ownedCardIds: string[]; discoveredCardIds: string[]; ownedVariants: string[]; unlockedCosmeticIds?: string[];
  cardProgression: CardProgressionMap; collectionProgress: number;
};
export type ShopReceipt = { itemId: ShopItemId; cardId: string | null; cost: number; currency: 'softCurrency' | 'styleShards'; summary: string };
export class ShopRuleError extends Error {}

export function accountLevelFromXp(xp: number): number {
  return 1 + Math.floor(Math.max(0, xp) / ACCOUNT_XP_PER_LEVEL);
}

export function economyVersionFromSnapshot(snapshot: unknown): EconomyVersion {
  return snapshot && typeof snapshot === 'object' &&
    (snapshot as { economyVersion?: unknown }).economyVersion === ECONOMY_VERSION
    ? ECONOMY_VERSION
    : LEGACY_ECONOMY_VERSION;
}

export function battleEarnings(outcome: 'win' | 'loss' | 'draw', version: EconomyVersion = ECONOMY_VERSION) {
  const softCurrency = version === LEGACY_ECONOMY_VERSION
    ? (outcome === 'win' ? 40 : outcome === 'draw' ? 30 : 20)
    : (outcome === 'win' ? 80 : outcome === 'draw' ? 60 : 40);
  return outcome === 'win' ? { xp: 50, streetRep: 8, softCurrency, packTickets: 0 }
    : outcome === 'draw' ? { xp: 35, streetRep: 4, softCurrency, packTickets: 0 }
    : { xp: 25, streetRep: 2, softCurrency, packTickets: 0 };
}

/** Pure authoritative purchase plan, shared by UI quotes and the locked server transaction. */
export function planShopPurchase(wallet: ShopWallet, input: Pick<ShopRequest, 'itemId' | 'cardId'>): { wallet: ShopWallet; receipt: ShopReceipt } {
  const offer = SHOP_OFFERS.find(item => item.id === input.itemId);
  if (!offer) throw new ShopRuleError('Unknown shop item.');
  const card = input.cardId ? catalogCardById[input.cardId] : undefined;
  if (offer.needsCard && !card) throw new ShopRuleError('Choose a character first.');
  if (!offer.needsCard && input.cardId) throw new ShopRuleError('This purchase does not target a character.');
  if (card && offer.id !== 'common-recruit' && !wallet.ownedCardIds.includes(card.catalogId)) throw new ShopRuleError('Unlock this character first.');
  const next = { ...wallet, cardProgression: { ...wallet.cardProgression } };
  let cost: number = offer.price;
  let summary: string = offer.name;
  if (offer.id === 'training' || offer.id === 'training-intensive') {
    const previous = normalizeCardProgress(wallet.cardProgression[card!.catalogId]);
    if (previous.xp >= CARD_XP_CAP) throw new ShopRuleError('This character is already at maximum level.');
    const gain = Math.min(offer.id === 'training' ? 100 : 250, CARD_XP_CAP - previous.xp);
    // Charge proportionally near the cap; no paid XP is discarded.
    cost = Math.ceil(offer.price * gain / (offer.id === 'training' ? 100 : 250));
    const xp = previous.xp + gain;
    next.cardProgression[card!.catalogId] = { ...previous, xp, level: cardLevelFromXp(xp) };
    summary = `${card!.name}: +${gain} XP (level ${cardLevelFromXp(xp)}).`;
  } else if (offer.id === 'move-training') {
    const previous = normalizeCardProgress(wallet.cardProgression[card!.catalogId]);
    const tier = previous.moveTier ?? 0;
    if (tier >= 3) throw new ShopRuleError('All three move tiers are already active.');
    const upgrade = card!.abilityUpgrades[tier];
    if (previous.level < upgrade.unlockLevel) throw new ShopRuleError(`Reach character level ${upgrade.unlockLevel} to learn ${upgrade.name}.`);
    cost = MOVE_TRAINING_COSTS[tier];
    next.cardProgression[card!.catalogId] = { ...previous, moveTier: tier + 1 };
    summary = `${card!.name} learned ${upgrade.name}. ${upgrade.description}`;
  } else if (offer.id === 'ticket') {
    next.packTickets += 1;
    summary = '+1 Street Pack ticket.';
  } else if (offer.id === 'deck-slot') {
    if (wallet.deckSlots >= MAX_DECK_SLOTS) throw new ShopRuleError('All 12 gang slots are unlocked.');
    next.deckSlots += 1;
    summary = `Gang slot ${next.deckSlots} unlocked.`;
  } else if (offer.id === 'common-recruit') {
    if (card!.rarity !== 'Common') throw new ShopRuleError('Neighborhood recruitment is for Common cards.');
    if (wallet.ownedCardIds.includes(card!.catalogId)) throw new ShopRuleError('You already own this character.');
    next.ownedCardIds = [...wallet.ownedCardIds, card!.catalogId];
    next.discoveredCardIds = [...new Set([...wallet.discoveredCardIds, card!.catalogId])];
    next.cardProgression[card!.catalogId] = normalizeCardProgress();
    next.collectionProgress = next.ownedCardIds.length;
    summary = `${card!.name} joined your collection.`;
  } else if (offer.id.startsWith('character-')) {
    const set = styleSetFor(card!.catalogId);
    if (!set || (offer.id === 'character-stickers' && !hasCharacterStickers(set))) throw new ShopRuleError('This character collection is not ready yet.');
    const id = cosmeticId(card!.catalogId, offer.id as CharacterStyleOfferId);
    if (wallet.unlockedCosmeticIds?.includes(id)) throw new ShopRuleError('You already own this cosmetic.');
    next.unlockedCosmeticIds = [...(wallet.unlockedCosmeticIds ?? []), id];
    summary = card!.name + ': ' + offer.name + ' unlocked. Find it in your character collection.';
  } else {
    const variant = card!.variantSlots.find(slot => slot.id.endsWith(offer.id === 'tagged-style' ? ':tagged' : ':chrome'))!;
    if (!variant) throw new ShopRuleError('This finish is unavailable.');
    if (wallet.ownedVariants.includes(variant.id)) throw new ShopRuleError('You already own this finish.');
    cost = variant.shardCost;
    next.ownedVariants = [...wallet.ownedVariants, variant.id];
    summary = `${card!.name}: ${variant.name} finish unlocked. Equip it in Collection.`;
  }
  if (wallet[offer.currency] < cost) throw new ShopRuleError(`You need ${cost} ${offer.currency === 'softCurrency' ? 'Clout' : 'Style Shards'}.`);
  next[offer.currency] -= cost;
  return { wallet: next, receipt: { itemId: offer.id, cardId: card?.catalogId ?? null, cost, currency: offer.currency, summary } };
}
