import { ONLINE_RULES_VERSION, type OnlineMember, type OnlineRoom } from '@workspace/squabblemon-engine/multiplayer';
import type { CardRarity } from '@workspace/squabblemon-engine/data';

export const KUMITE_CAPACITY = 8;
export const KUMITE_ROUND_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
export const KUMITE_RULES = {
  roundHours: 6, turnSeconds: 75, minimumEntrants: 2, deckSize: 10,
  deckLocked: true, drawsReplay: true,
  noShow: 'One checked-in entrant advances. Both or neither checked in without a finished game means double forfeit.',
};

export type KumiteEntrant = {
  id: string; member: OnlineMember; registeredAt: number; seed: number | null;
};
export type KumiteRecordProof = Pick<OnlineRoom, 'status' | 'reason' | 'ranked' | 'gameNumber' |
  'winner' | 'startedAt' | 'completedAt' | 'kumite'> & {
    members: { player: Pick<OnlineMember, 'userId'>; cpu: Pick<OnlineMember, 'userId'> | null };
    match: Pick<NonNullable<OnlineRoom['match']>, 'phase'> | null;
  };
export type KumiteMatchState = {
  id: string; round: number; slot: number;
  entrantIds: [string | null, string | null];
  status: 'pending' | 'ready' | 'playing' | 'complete';
  winnerId: string | null;
  reason: null | 'played' | 'timeout' | 'surrender' | 'bye' | 'double-forfeit';
  deadline: number; checkedIn: [boolean, boolean]; roomCode: string | null;
  /** All issued rooms remain auditable; a drawn game gets a new room. */
  roomCodes: string[];
  startedAt: number | null; completedAt: number | null; durationMs: number | null;
  /** Compact settled room proof so 52-week records survive online_rooms archive pruning. */
  recordProof?: KumiteRecordProof | null;
};
export type KumiteState = {
  id: string; weekLabel: string; registrationOpensAt: number; startsAt: number; endsAt: number;
  status: 'registration' | 'active' | 'complete' | 'cancelled';
  entrants: KumiteEntrant[]; rounds: KumiteMatchState[][]; championId: string | null;
  cancellationReason?: 'rules-updated';
};
export type KumitePublicEntrant = {
  id: string; name: string; avatarKey?: string; hero: string; seed: number | null; pool: null;
};
export type KumitePublicMatch = {
  id: string; round: number; pool: null; slot: number; status: KumiteMatchState['status'];
  entrants: [KumitePublicEntrant | null, KumitePublicEntrant | null];
  winner: KumitePublicEntrant | null; reason: KumiteMatchState['reason']; deadline: number;
  checkedIn: [boolean, boolean]; roomCode: string | null;
  startedAt: number | null; completedAt: number | null; durationMs: number | null;
};
export type KumiteCurrentView = {
  tournament: {
    id: string; weekLabel: string; status: KumiteState['status'];
    cancellationReason?: 'rules-updated';
    registrationOpensAt: number; startsAt: number; endsAt: number;
    capacity: 8; poolCount: 1; poolSize: 8; entrants: KumitePublicEntrant[];
    pools: []; finals: KumitePublicMatch[][]; champion: KumitePublicEntrant | null;
  };
  registration: null | { deckId: string; deckName: string; hero: string; registeredAt: number };
  currentMatch: KumitePublicMatch | null; serverTime: number; rules: typeof KUMITE_RULES;
  progression: KumiteProgression | null;
  records: KumitePublicRecords;
};
export type KumiteProgression = {
  completedMatches: number; matchWins: number; championships: number;
  rewards: { id: string; cardId: string; name: string; rarity: CardRarity; requirement: string;
    metric: 'completedMatches' | 'matchWins' | 'championships'; required: number; progress: number; claimed: boolean; owned: boolean }[];
};
export type KumitePublicFighter = { name: string; hero: string; avatarKey?: string };
export type KumitePublicRecords = {
  scope: 'Last 52 weekly tournaments';
  fastestFight: null | { tournamentId: string; weekLabel: string; matchId: string; round: number;
    startedAt: number; completedAt: number; durationMs: number; winner: KumitePublicFighter; opponent: KumitePublicFighter };
  recentWinners: (KumitePublicFighter & { tournamentId: string; weekLabel: string; wonAt: number })[];
  handThrowers: (KumitePublicFighter & { rank: number; playedWins: number; championships: number; lastWonAt: number })[];
};
export const emptyKumiteRecords = (): KumitePublicRecords => ({ scope: 'Last 52 weekly tournaments', fastestFight: null,
  recentWinners: [], handThrowers: [] });

/** UTC Monday registration, Saturday 00:00 start, Saturday 18:00 final cutoff. */
export function kumiteWeek(now: number) {
  const date = new Date(now);
  const day = (date.getUTCDay() + 6) % 7;
  const registrationOpensAt = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - day);
  const id = new Date(registrationOpensAt).toISOString().slice(0, 10);
  const startsAt = registrationOpensAt + 5 * DAY_MS;
  return { id, weekLabel: `Week of ${id}`, registrationOpensAt, startsAt, endsAt: startsAt + 3 * KUMITE_ROUND_MS };
}
export function createKumite(now: number): KumiteState {
  const week = kumiteWeek(now);
  return { ...week, status: 'registration', entrants: [], championId: null,
    rounds: [4, 2, 1].map((count, round) => Array.from({ length: count }, (_, slot) => ({
      id: `r${round + 1}-m${slot + 1}`, round, slot,
      entrantIds: [null, null], status: 'pending', winnerId: null, reason: null,
      deadline: week.startsAt + (round + 1) * KUMITE_ROUND_MS,
      checkedIn: [false, false], roomCode: null, roomCodes: [],
      startedAt: null, completedAt: null, durationMs: null,
    }))),
  };
}

/** The service cryptographically shuffles the full entrant list exactly once at start. */
export function startKumite(input: KumiteState, orderedEntrantIds: string[], now: number): KumiteState {
  if (input.status !== 'registration' || now < input.startsAt) return input;
  const state = structuredClone(input);
  if (state.entrants.length > KUMITE_CAPACITY) throw new Error('Kumite capacity exceeded.');
  if (state.entrants.length < KUMITE_RULES.minimumEntrants) {
    state.status = 'cancelled';
    return state;
  }
  if (orderedEntrantIds.length !== state.entrants.length || new Set(orderedEntrantIds).size !== state.entrants.length ||
    orderedEntrantIds.some(id => !state.entrants.some(entry => entry.id === id))) throw new Error('Invalid Kumite seeds.');
  state.status = 'active';
  state.entrants.forEach(entry => { entry.seed = orderedEntrantIds.indexOf(entry.id) + 1; });
  // Traditional seeded positions give distributed byes in an underfilled bracket.
  const seedPositions = [1, 8, 4, 5, 2, 7, 3, 6];
  state.rounds[0].forEach((match, slot) => {
    match.entrantIds = [orderedEntrantIds[seedPositions[slot * 2] - 1] ?? null,
      orderedEntrantIds[seedPositions[slot * 2 + 1] - 1] ?? null];
  });
  return advanceKumite(state, now);
}

/** Pure bracket propagation. Null winners remain empty seats; no replacement bots exist. */
export function advanceKumite(input: KumiteState, now: number): KumiteState {
  if (input.status !== 'active') return input;
  const state = structuredClone(input);
  state.rounds.forEach((round, roundIndex) => round.forEach(match => {
    if (match.status === 'complete') return;
    if (roundIndex > 0) {
      const sources = state.rounds[roundIndex - 1].slice(match.slot * 2, match.slot * 2 + 2);
      if (sources.some(source => source.status !== 'complete')) return;
      match.entrantIds = [sources[0].winnerId, sources[1].winnerId];
    }
    const occupied = match.entrantIds.filter((id): id is string => id !== null);
    if (occupied.length < 2) {
      match.status = 'complete'; match.winnerId = occupied[0] ?? null;
      match.reason = occupied.length ? 'bye' : 'double-forfeit';
    } else if (now >= match.deadline) {
      match.status = 'complete';
      match.winnerId = match.checkedIn[0] !== match.checkedIn[1]
        ? match.entrantIds[match.checkedIn[0] ? 0 : 1] : null;
      match.reason = match.winnerId ? 'timeout' : 'double-forfeit';
    } else if (match.status === 'pending') match.status = 'ready';
  }));
  const final = state.rounds[2][0];
  if (final.status === 'complete') {
    state.championId = final.winnerId;
    state.status = final.winnerId ? 'complete' : 'cancelled';
  }
  return state;
}

/** A deployment cannot decide a bracket by timeout, bye or a new champion. */
export function retireIncompatibleKumite(state: KumiteState, room: OnlineRoom): KumiteState {
  if (state.status !== 'active' || (room.rulesVersion === ONLINE_RULES_VERSION && room.reason !== 'rules-updated')) return state;
  const match = state.rounds.flat().find(item => item.id === room.kumite?.matchId);
  if (room.kumite?.tournamentId !== state.id || !match || match.status === 'complete') return state;
  return { ...state, status: 'cancelled', cancellationReason: 'rules-updated', championId: null };
}

/** Only a server-issued room with the exact locked members may settle this match. */
export function settleKumiteRoom(state: KumiteState, matchId: string, code: string, room: OnlineRoom): KumiteState {
  if (state.status !== 'active') return state;
  const retired = retireIncompatibleKumite(state, room);
  if (retired !== state) return retired;
  const match = state.rounds.flat().find(item => item.id === matchId);
  if (!match || match.status === 'complete' || match.roomCode !== code || room.status !== 'complete') return state;
  const entries = match.entrantIds.map(id => state.entrants.find(entry => entry.id === id));
  if (!entries[0] || !entries[1] || room.members.player.userId !== entries[0].member.userId ||
    room.members.cpu?.userId !== entries[1].member.userId || room.ranked || room.gameNumber !== 1) {
    throw new Error('Kumite room does not match issued bracket participants.');
  }
  if (room.kumite?.tournamentId !== state.id || room.kumite.matchId !== matchId ||
    room.kumite.finishedAt === undefined || room.kumite.finishedAt > match.deadline) {
    throw new Error('Kumite result has no valid server completion receipt.');
  }
  const next = structuredClone(state);
  const updated = next.rounds.flat().find(item => item.id === matchId)!;
  if (room.winner === 'draw') {
    updated.roomCode = null; updated.status = 'ready';
    return next;
  }
  if (room.winner !== 'player' && room.winner !== 'cpu') return state;
  updated.winnerId = updated.entrantIds[room.winner === 'player' ? 0 : 1];
  updated.status = 'complete';
  updated.reason = room.reason === 'surrender' ? 'surrender' : room.reason === 'timeout' ? 'timeout' : 'played';
  return next;
}

export function kumiteView(state: KumiteState, userId: string | null, now: number): KumiteCurrentView {
  const own = state.entrants.find(entry => entry.member.userId === userId);
  const publicEntry = (id: string | null): KumitePublicEntrant | null => {
    const entry = state.entrants.find(item => item.id === id);
    return entry ? { id: entry.id, name: entry.member.name, avatarKey: entry.member.avatarKey,
      hero: entry.member.deck.hero, seed: entry.seed, pool: null } : null;
  };
  const publicMatch = (match: KumiteMatchState): KumitePublicMatch => ({
    id: match.id, round: match.round, pool: null, slot: match.slot, status: match.status,
    entrants: [publicEntry(match.entrantIds[0]), publicEntry(match.entrantIds[1])],
    winner: publicEntry(match.winnerId), reason: match.reason, deadline: match.deadline,
    checkedIn: match.checkedIn, roomCode: own && match.entrantIds.includes(own.id) ? match.roomCode : null,
    startedAt: match.startedAt ?? null, completedAt: match.completedAt ?? null, durationMs: match.durationMs ?? null,
  });
  const currentMatch = own && state.status === 'active' ? state.rounds.flat().find(match => match.status !== 'complete' && match.entrantIds.includes(own.id)) : null;
  return {
    tournament: { id: state.id, weekLabel: state.weekLabel, status: state.status,
      ...(state.cancellationReason ? { cancellationReason: state.cancellationReason } : {}),
      registrationOpensAt: state.registrationOpensAt, startsAt: state.startsAt, endsAt: state.endsAt,
      capacity: 8, poolCount: 1, poolSize: 8, entrants: state.entrants.map(entry => publicEntry(entry.id)!),
      pools: [], finals: state.rounds.map(round => round.map(publicMatch)), champion: publicEntry(state.championId) },
    registration: own ? { deckId: own.member.deck.id, deckName: own.member.deck.name,
      hero: own.member.deck.hero, registeredAt: own.registeredAt } : null,
    currentMatch: currentMatch ? publicMatch(currentMatch) : null, serverTime: now, rules: KUMITE_RULES, progression: null,
    records: emptyKumiteRecords(),
  };
}
