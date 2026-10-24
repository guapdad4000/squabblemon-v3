import { isPullCount, type PullCount } from '@workspace/squabblemon-engine/packRules';
import type { PackOpening } from '@workspace/api-client-react';

type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type PackPayment = 'softCurrency' | 'ticket';
export type PendingPackRequest = {
  idempotencyKey: string;
  paymentMethod: PackPayment;
  // Persist the original pull size so a refresh mid-punch sends the same
  // exact batch intent (1–10) when the user taps "Retry this opening".
  pullCount?: PullCount;
  bannerId?: string;
  bannerOccurrenceId?: string;
};
const key = (player: string, kind: 'request' | 'reveal') => `squabblemon:pack-${kind}:${player}`;
function read(storage: StoragePort, name: string): unknown {
  try { return JSON.parse(storage.getItem(name) ?? 'null'); } catch { return null; }
}
export function loadPackRequest(storage: StoragePort, player: string): PendingPackRequest | null {
  const value = read(storage, key(player, 'request')) as Partial<PendingPackRequest> | null;
  if (!value || typeof value.idempotencyKey !== 'string' || value.idempotencyKey.length === 0) return null;
  if (value.paymentMethod !== 'ticket' && value.paymentMethod !== 'softCurrency') return null;
  if (value.bannerId !== undefined && (typeof value.bannerId !== 'string' || !value.bannerId)) return null;
  if (value.bannerOccurrenceId !== undefined && (typeof value.bannerOccurrenceId !== 'string' || !value.bannerOccurrenceId)) return null;
  if (value.pullCount !== undefined && !isPullCount(value.pullCount)) return null;
  return value as PendingPackRequest;
}
/** Retry an uncertain payment with its original method, pull count, and idempotency key. */
export function reservePackRequest(
  storage: StoragePort,
  player: string,
  paymentMethod: PackPayment,
  createId: () => string,
  pullCount: PullCount = 1,
  bannerId?: string,
  bannerOccurrenceId?: string,
): PendingPackRequest {
  const existing = loadPackRequest(storage, player);
  const request = existing
    ? { ...existing, pullCount: existing.pullCount ?? 1 }
    : { idempotencyKey: createId(), paymentMethod, pullCount, ...(bannerId ? { bannerId } : {}), ...(bannerOccurrenceId ? { bannerOccurrenceId } : {}) };
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
/** A delayed retry must not replace a subsequent opening's request or saved reveal. */
export function saveCurrentPackOpening(storage: StoragePort, player: string, request: PendingPackRequest, opening: PackOpening): boolean {
  const pending = loadPackRequest(storage, player);
  if (pending && (pending.idempotencyKey !== request.idempotencyKey
    || pending.paymentMethod !== request.paymentMethod
    || (pending.pullCount ?? 1) !== (request.pullCount ?? 1)
    || (pending.bannerId ?? 'standard') !== (request.bannerId ?? 'standard')
    || (pending.bannerOccurrenceId ?? null) !== (request.bannerOccurrenceId ?? null))) return false;
  const saved = loadPackOpening(storage, player);
  if (saved && saved.id !== opening.id) return false;
  savePackOpening(storage, player, opening);
  return true;
}
export function finishPackOpening(storage: StoragePort, player: string) { storage.removeItem(key(player, 'reveal')); }
