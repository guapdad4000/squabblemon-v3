import { cardCatalog, catalogCardById } from '@workspace/squabblemon-engine/data';
import { SHOP_OFFERS, planShopPurchase, type ShopRequest, type ShopWallet } from '@workspace/squabblemon-engine/economy';
import { clearShopRequest, readShopRequest, saveShopRequest } from './shopJournal';

export type FinishOfferId = 'tagged-style' | 'chrome-style';
export const isFinishOfferId = (value: unknown): value is FinishOfferId => value === 'tagged-style' || value === 'chrome-style';
export const FINISH_OFFERS = SHOP_OFFERS.filter(offer => isFinishOfferId(offer.id));

/** A saved request is the purchase intent; URL changes cannot replace its card or finish. */
export function finishCounterSelection(wallet: ShopWallet, requestedItem: string | null, requestedCard: string | null, pending: ShopRequest | null) {
  const finishPending = pending && isFinishOfferId(pending.itemId) ? pending : null;
  const itemId = finishPending?.itemId ?? (isFinishOfferId(requestedItem) ? requestedItem : 'tagged-style');
  const offer = FINISH_OFFERS.find(item => item.id === itemId)!;
  const ownedIds = new Set(wallet.ownedCardIds);
  const choices = cardCatalog.filter(card => ownedIds.has(card.catalogId)).sort((a, b) => a.name.localeCompare(b.name));
  const cardId = finishPending ? finishPending.cardId ?? '' : choices.some(card => card.catalogId === requestedCard) ? requestedCard! : choices[0]?.catalogId ?? '';
  const card = catalogCardById[cardId];
  const variant = card?.variantSlots.find(slot => slot.id.endsWith(itemId === 'tagged-style' ? ':tagged' : ':chrome'));
  const owned = Boolean(variant && wallet.ownedVariants.includes(variant.id));
  let quote: ReturnType<typeof planShopPurchase> | null = null, unavailable: string | null = null;
  try { quote = planShopPurchase(wallet, { itemId: offer.id, cardId }); }
  catch (error) { unavailable = error instanceof Error ? error.message : 'This finish is unavailable.'; }
  return { offer, choices, cardId, card, variant, owned, quote, unavailable, cost: quote?.receipt.cost ?? variant?.shardCost ?? offer.price };
}

type JournalStorage = Pick<Storage, 'getItem' | 'setItem'>;
/** Reserve before sending. Recovery bypasses a new quote because the server may already own the receipt. */
export function reserveFinishPurchase(storage: JournalStorage, playerId: string, wallet: ShopWallet,
  input: { itemId: FinishOfferId; cardId: string }, createId: () => string): ShopRequest {
  const saved = readShopRequest(storage, playerId);
  if (saved) return saved;
  planShopPurchase(wallet, input);
  const request = { ...input, idempotencyKey: createId() };
  saveShopRequest(storage, playerId, request);
  const retained = readShopRequest(storage, playerId);
  if (!retained || retained.idempotencyKey !== request.idempotencyKey || retained.itemId !== request.itemId || retained.cardId !== request.cardId) {
    throw new Error('Could not save the purchase reference. No purchase was sent.');
  }
  return request;
}

export function clearConfirmedFinishRequest(storage: Pick<Storage, 'getItem' | 'removeItem'>, playerId: string, request: ShopRequest) {
  if (readShopRequest(storage, playerId)?.idempotencyKey === request.idempotencyKey) clearShopRequest(storage, playerId);
}
