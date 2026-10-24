import type { ShopRequest } from '@workspace/squabblemon-engine/economy';

/** Keep recovery on the counter that owns the original server purchase. */
export function shopPurchaseDestination(request: Pick<ShopRequest, 'itemId' | 'cardId'>): string {
  const query = new URLSearchParams();
  const { itemId, cardId } = request;
  if (itemId === 'tagged-style' || itemId === 'chrome-style') {
    query.set('view', 'finishes');
    query.set('item', itemId);
    if (cardId) query.set('card', cardId);
    return `/game/style?${query}`;
  }
  if (itemId.startsWith('character-') && cardId) return `/game/style/${encodeURIComponent(cardId)}`;
  if (itemId === 'player-mat') return '/game/style?view=mats';
  if (itemId.startsWith('reaction-pack')) return '/game/shop?view=reactions';
  if (itemId === 'ticket') return '/game/shop?view=packs';
  if (itemId === 'common-recruit') {
    query.set('view', 'packs'); query.set('banner', 'neighborhood');
    if (cardId) query.set('card', cardId);
    return `/game/shop?${query}`;
  }
  query.set('view', itemId === 'deck-slot' ? 'corner' : 'training');
  query.set('item', itemId);
  if (cardId) query.set('card', cardId);
  return `/game/shop?${query}`;
}
