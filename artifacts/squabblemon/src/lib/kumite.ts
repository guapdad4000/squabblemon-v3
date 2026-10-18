import { customFetch } from '@workspace/api-client-react';
import type { OnlineRoomView } from '@workspace/squabblemon-engine/multiplayer';

export interface KumiteEntrant {
  id: string;
  name: string;
  avatarKey?: string;
  hero: string;
  seed: number | null;
  pool: number | null;
}
export interface KumiteMatch {
  id: string;
  round: number;
  pool: number | null;
  slot: number;
  status: 'pending' | 'ready' | 'playing' | 'complete';
  entrants: [KumiteEntrant | null, KumiteEntrant | null];
  winner: KumiteEntrant | null;
  reason: null | 'played' | 'timeout' | 'surrender' | 'bye' | 'double-forfeit';
  deadline: number;
  checkedIn: [boolean, boolean];
  roomCode: string | null;
  startedAt?: number | null;
  completedAt?: number | null;
  durationMs?: number | null;
}
export interface KumiteTournament {
  id: string;
  weekLabel: string;
  status: 'registration' | 'active' | 'complete' | 'cancelled';
  registrationOpensAt: number;
  startsAt: number;
  endsAt: number;
  capacity: number;
  poolCount: number;
  poolSize: number;
  entrants: KumiteEntrant[];
  pools: { index: number; name: string; rounds: KumiteMatch[][] }[];
  finals: KumiteMatch[][];
  champion: KumiteEntrant | null;
}
export interface KumiteCurrent {
  tournament: KumiteTournament;
  registration: null | { deckId: string; deckName: string; hero: string; registeredAt: number };
  currentMatch: KumiteMatch | null;
  serverTime: number;
  rules: { roundHours: number; turnSeconds: number; [key: string]: unknown };
  progression?: KumiteProgression | null;
  records?: KumiteRecords;
}
export interface KumiteProgression {
  completedMatches: number;
  matchWins: number;
  championships: number;
  rewards: { id: string; cardId: string; name: string; requirement: string; required: number; progress: number; claimed: boolean; rarity?: string; owned?: boolean; metric?: 'completedMatches' | 'matchWins' | 'championships' }[];
}
export interface KumiteRecords {
  scope: string;
  fastestFight: null | { tournamentId: string; weekLabel: string; matchId: string; round: number; startedAt: number; completedAt: number; durationMs: number; winner: { name: string; hero: string; avatarKey?: string }; opponent: { name: string; hero: string; avatarKey?: string } };
  recentWinners: { tournamentId: string; weekLabel: string; name: string; hero: string; avatarKey?: string; wonAt: number }[];
  handThrowers: { rank: number; name: string; hero: string; avatarKey?: string; playedWins: number; championships: number; lastWonAt: number }[];
}
export interface KumiteWinner {
  tournamentId: string;
  weekLabel: string;
  name: string;
  hero: string;
  avatarKey?: string;
  wonAt: number;
  entrantCount: number;
}
export interface KumiteArchive { winners: KumiteWinner[]; serverTime: number }

/** Requests use the same authenticated transport as the rest of the player game. */
async function kumiteRequest<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort(signal?.reason);
  if (signal?.aborted) cancel();
  signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(() => controller.abort(new DOMException('Tournament connection timed out. Please retry.', 'TimeoutError')), 10000);
  try {
    return await customFetch<T>(`/api/kumite${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin', cache: 'no-store', responseType: 'json', signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', cancel);
  }
}
export const getKumite = (signal?: AbortSignal) => kumiteRequest<KumiteCurrent>('/current', undefined, signal);
export const getKumiteWinners = (signal?: AbortSignal) => kumiteRequest<KumiteArchive>('/winners', undefined, signal);
export const registerKumite = (deckId: string) => kumiteRequest<KumiteCurrent>('/register', { deckId });
export const withdrawKumite = () => kumiteRequest<KumiteCurrent>('/withdraw', {});
export const enterKumiteMatch = () => kumiteRequest<{ room: OnlineRoomView | null; current: KumiteCurrent }>('/match', {});
export interface KumiteFilmReceipt { id: string; cardId: string; name: string }
export const getKumiteFilmReceipts = (signal?: AbortSignal) => kumiteRequest<{ receipts: KumiteFilmReceipt[] }>('/film-receipts', undefined, signal);
export const claimKumiteFilmReceipt = (receiptId: string) => kumiteRequest<{ receipt: KumiteFilmReceipt | null }>('/film-receipts/claim', { receiptId });

export function kumiteCountdown(target: number, now: number): string {
  const minutes = Math.ceil(Math.max(0, target - now) / 60000);
  const days = Math.floor(minutes / 1440), hours = Math.floor(minutes % 1440 / 60), remainder = minutes % 60;
  return days ? `${days}d ${hours}h ${remainder}m` : hours ? `${hours}h ${remainder}m` : `${remainder}m`;
}
export function kumiteDate(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(timestamp);
}

/** Empty bracket slots describe the real draw structure without inventing players. */
export function emptyKumiteRounds(pool: number | null, size = 8): KumiteMatch[][] {
  return Array.from({ length: Math.log2(size) }, (_, round) =>
    Array.from({ length: size / 2 ** (round + 1) }, (_, slot) => ({
      id: `unseeded-${pool ?? 'finals'}-${round}-${slot}`, round, pool, slot,
      status: 'pending' as const, entrants: [null, null] as [null, null], winner: null,
      reason: null, deadline: 0, checkedIn: [false, false] as [boolean, boolean], roomCode: null,
    })),
  );
}
