import type { KumiteCurrent } from './kumite';

/** Project the last authenticated server clock; never invent a local weekly deadline. */
export function kumiteBracketClock(current: Pick<KumiteCurrent, 'serverTime' | 'tournament'> | undefined, clientNow: number, receivedAt: number) {
  const waiting = { label: 'BRACKET LOCK', value: 'SYNCING…' };
  if (!current || !Number.isFinite(current.serverTime) || !Number.isFinite(clientNow) || !Number.isFinite(receivedAt) || receivedAt <= 0) return waiting;
  if (current.tournament.status === 'active') return { label: 'LIVE NOW', value: 'IN PROGRESS' };
  if (current.tournament.status === 'complete') return { label: 'THIS WEEK', value: 'COMPLETE' };
  if (current.tournament.status === 'cancelled') return { label: 'THIS WEEK', value: 'CANCELLED' };
  const target = current.tournament.startsAt;
  if (!Number.isFinite(target)) return waiting;
  const now = clientNow + current.serverTime - receivedAt;
  const diff = Math.max(0, target - now);
  const days = Math.floor(diff / 86400000), hours = Math.floor(diff % 86400000 / 3600000), minutes = Math.floor(diff % 3600000 / 60000), seconds = Math.floor(diff % 60000 / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return { label: 'BRACKET LOCK', value: days > 0 ? `${days}D ${pad(hours)}H ${pad(minutes)}M` : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` };
}
