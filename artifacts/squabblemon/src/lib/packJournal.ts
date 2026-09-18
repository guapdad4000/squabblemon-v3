import type { PackOpening } from '@workspace/api-client-react';

type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type PackPayment = 'softCurrency' | 'ticket';
export type PendingPackRequest = {
  idempotencyKey: string;
  paymentMethod: PackPayment;
  // Persist the original pull size so a refresh mid-punch sends the same
  // intent (1 or 10) when the user taps "Retry this opening".
  pullCount?: 1 | 10;
};
const key = (player: string, kind: 'request' | 'reveal') => `squabblemon:pack-${kind}:${player}`;
function read(storage: StoragePort, name: string): unknown {
  try { return JSON.parse(storage.getItem(name) ?? 'null'); } catch { return null; }
}
export function loadPackRequest(storage: StoragePort, player: string): PendingPackRequest | null {
  const value = read(storage, key(player, 'request')) as Partial<PendingPackRequest> | null;
  if (!value || typeof value.idempotencyKey !== 'string' || value.idempotencyKey.length === 0) return null;
  if (value.paymentMethod !== 'ticket' && value.paymentMethod !== 'softCurrency') return null;
  if (value.pullCount !== undefined && value.pullCount !== 1 && value.pullCount !== 10) return null;
  return value as PendingPackRequest;
}
/** Retry an uncertain payment with its original method, pull count, and idempotency key. */
export function reservePackRequest(
  storage: StoragePort,
  player: string,
  paymentMethod: PackPayment,
  createId: () => string,
  pullCount: 1 | 10 = 1,
): PendingPackRequest {
  const existing = loadPackRequest(storage, player);
  const request = existing
    ? { ...existing, pullCount: existing.pullCount ?? 1 }
    : { idempotencyKey: createId(), paymentMethod, pullCount };
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
