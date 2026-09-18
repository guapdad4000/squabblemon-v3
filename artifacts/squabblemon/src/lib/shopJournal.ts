import { SHOP_OFFERS, type ShopRequest } from '@workspace/squabblemon-engine/economy';
const key = (playerId: string) => `squabblemon.shop.pending.v1:${playerId}`;
export function readShopRequest(storage: Pick<Storage, 'getItem'>, playerId: string): ShopRequest | null {
  try {
    const request = JSON.parse(storage.getItem(key(playerId)) ?? 'null');
    return request && typeof request.idempotencyKey === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.idempotencyKey)
      && SHOP_OFFERS.some(item => item.id === request.itemId)
      && (request.cardId === undefined || typeof request.cardId === 'string') ? request : null;
  } catch { return null; }
}
export function saveShopRequest(storage: Pick<Storage, 'setItem'>, playerId: string, request: ShopRequest) { storage.setItem(key(playerId), JSON.stringify(request)); }
export function clearShopRequest(storage: Pick<Storage, 'removeItem'>, playerId: string) { storage.removeItem(key(playerId)); }
