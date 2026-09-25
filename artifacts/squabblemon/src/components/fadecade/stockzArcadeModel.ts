import type { StockzRound } from '@workspace/squabblemon-engine/accountRewards';

export type SettledStockzRound = StockzRound & { closePrice: number; payout: number };
export type StockzOrder = { id: string; ticker: string; direction: 'up' | 'down'; stake: number };

/** Freeze the original order across a network retry, even if UI choices changed. */
export function resolveStockzOrder(pending: StockzOrder | null, choices: Omit<StockzOrder, 'id'>, createId: () => string): StockzOrder {
  return pending ?? { ...choices, id: createId() };
}

/** A missing payout is pending, not a loss. Only server receipts qualify. */
export function isSettledStockzRound(round: StockzRound | null | undefined): round is SettledStockzRound {
  return !!round && Number.isFinite(round.closePrice) && (round.closePrice ?? 0) > 0
    && Number.isFinite(round.payout) && (round.payout ?? -1) >= 0
    && Number.isFinite(round.stake) && round.stake > 0
    && Number.isFinite(round.openPrice) && round.openPrice > 0;
}

export function stockzClock(round: StockzRound | null | undefined, now: number) {
  if (!round) return { valid: false, seconds: 0, progress: 0 };
  const start = Date.parse(round.startedAt), close = Date.parse(round.closesAt);
  if (![start, close, now].every(Number.isFinite) || close <= start)
    return { valid: false, seconds: 0, progress: 0 };
  return {
    valid: true,
    seconds: Math.max(0, Math.ceil((close - now) / 1000)),
    progress: Math.max(0, Math.min(1, (now - start) / (close - start))),
  };
}

export function stockzReceipts(rounds: readonly StockzRound[]) {
  const receipts = rounds.filter(isSettledStockzRound);
  return {
    receipts,
    wins: receipts.filter(round => round.payout > round.stake).length,
    net: receipts.reduce((sum, round) => sum + round.payout - round.stake, 0),
  };
}

export function signedClout(value: number) {
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toLocaleString('en-US')}`;
}

/** Synchronous gate: React's batched busy state alone cannot block two rapid clicks. */
export function createStockzGate() {
  let locked = false;
  return {
    acquire() { if (locked) return false; locked = true; return true; },
    release() { locked = false; },
  };
}

/**
 * Decorative cabinet trace, NOT interim market prices or a prediction.
 * Even if an active response accidentally includes closePrice, ignore it until
 * a settled server receipt is explicitly supplied. The UI labels this clearly.
 */
export function stockzTrace(seed: string, progress = 1, receipt?: SettledStockzRound) {
  let hash = 7;
  for (const char of seed) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  const safeProgress = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const count = Math.max(2, Math.min(37, Math.floor(safeProgress * 36) + 1));
  const delta = receipt ? receipt.closePrice - receipt.openPrice : 0;
  const domain = receipt ? Math.max(Math.abs(delta) * 1.35, Math.abs(receipt.openPrice) * 0.1, 1) : 1;
  const endY = 108 - delta / domain * 68;
  const points = Array.from({ length: count }, (_, i) => {
    const t = i / 36;
    const noise = Math.sin(i * 1.71 + hash % 17) * 16 + Math.sin(i * 0.73 + hash % 11) * 9;
    const y = receipt ? 108 + (endY - 108) * t + noise * Math.sin(t * Math.PI) : 108 + noise * Math.sin(t * Math.PI);
    return { x: 20 + t * 560, y: Math.round(y * 10) / 10 };
  });
  const line = points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)},${point.y}`).join(' ');
  const last = points[points.length - 1];
  return { line, area: `${line} L${last.x.toFixed(1)},190 L20,190 Z`, last };
}
