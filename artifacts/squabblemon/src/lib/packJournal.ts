import type { PackOpening } from '@workspace/api-client-react';

type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type PackPayment = 'softCurrency' | 'ticket';
export type PendingPackRequest = { idempotencyKey: string; paymentMethod: PackPayment };
const key = (player: string, kind: 'request' | 'reveal') => `squabblemon:pack-${kind}:${player}`;
function read(storage: StoragePort, name: string): unknown {
  try { return JSON.parse(storage.getItem(name) ?? 'null'); } catch { return null; }
}
export function loadPackRequest(storage: StoragePort, player: string): PendingPackRequest | null {
  const value = read(storage, key(player, 'request')) as Partial<PendingPackRequest> | null;
  return value && typeof value.idempotencyKey === 'string' && value.idempotencyKey.length > 0
    && (value.paymentMethod === 'ticket' || value.paymentMethod === 'softCurrency') ? value as PendingPackRequest : null;
}
/** Retry an uncertain payment with its original method and idempotency key. */
export function reservePackRequest(storage: StoragePort, player: string, paymentMethod: PackPayment, createId: () => string): PendingPackRequest {
  const request = loadPackRequest(storage, player) ?? { idempotencyKey: createId(), paymentMethod };
  storage.setItem(key(player, 'request'), JSON.stringify(request));
  return request;
}
export function loadPackOpening(storage: StoragePort, player: string): PackOpening | null {
  const value = read(storage, key(player, 'reveal')) as PackOpening | null;
  if (!value || typeof value.id !== 'string' || !Array.isArray(value.rewards) || !value.rewards.length) return null;
  if (!value.rewards.every(reward => reward && ['card', 'variant', 'styleShards', 'softCurrency'].includes(reward.kind)
    && Number.isFinite(reward.amount) && (reward.cardId === null || typeof reward.cardId === 'string'))) return null;
  return value;
}
export function savePackOpening(storage: StoragePort, player: string, opening: PackOpening) {
  // Write the receipt first. A failed write leaves the recoverable request intact.
  storage.setItem(key(player, 'reveal'), JSON.stringify(opening));
  storage.removeItem(key(player, 'request'));
}
export function finishPackOpening(storage: StoragePort, player: string) { storage.removeItem(key(player, 'reveal')); }
