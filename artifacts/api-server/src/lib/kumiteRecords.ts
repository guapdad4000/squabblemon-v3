import type { OnlineMember, OnlineRoom } from '@workspace/squabblemon-engine/multiplayer';
import { emptyKumiteRecords, type KumitePublicFighter, type KumitePublicRecords, type KumiteState } from './kumiteEngine';

const fighter = (member: OnlineMember): KumitePublicFighter => ({ name: member.name,
  hero: member.deck.hero, ...(member.avatarKey ? { avatarKey: member.avatarKey } : {}) });

/** Historical polling needs a completion receipt, not hands, boards or effect logs. */
export type KumiteRecordRoom = Pick<OnlineRoom, 'status' | 'reason' | 'ranked' | 'gameNumber' |
  'winner' | 'startedAt' | 'completedAt' | 'kumite'> & {
    members: { player: Pick<OnlineMember, 'userId'>; cpu: Pick<OnlineMember, 'userId'> | null };
    match: Pick<NonNullable<OnlineRoom['match']>, 'phase'> | null;
  };

/** One public snapshot per warm worker. New settlements and changed frozen presentation miss immediately. */
export function createKumiteRecordCache(ttlMs = 15_000) {
  let cached: { key: string; fetchedAt: number; records: KumitePublicRecords } | null = null;
  return {
    async read(states: readonly KumiteState[], now: number, load: () => Promise<KumitePublicRecords>) {
      const key = JSON.stringify(states.slice(0, 52).map(state => [state.id, state.weekLabel, state.status,
        state.championId, state.startsAt,
        state.entrants.map(entry => [entry.id, entry.member.userId, entry.member.name,
          entry.member.deck.hero, entry.member.avatarKey]),
        state.rounds.flat().filter(match => match.status === 'complete' && match.reason === 'played')
          .map(match => [match.id, match.round, match.winnerId, match.roomCode, match.deadline,
            match.startedAt, match.completedAt, match.durationMs, match.reason]),
      ]));
      if (!cached || cached.key !== key || now < cached.fetchedAt || now >= cached.fetchedAt + ttlMs) {
        cached = { key, fetchedAt: now, records: structuredClone(await load()) };
      }
      return structuredClone(cached.records);
    },
  };
}

/** Public records use verified decisive full battles in the bounded recent tournament window. */
export function buildKumiteRecords(states: readonly KumiteState[], rooms: ReadonlyMap<string, KumiteRecordRoom>): KumitePublicRecords {
  const records = emptyKumiteRecords();
  const leaders = new Map<string, KumitePublicFighter & { playedWins: number; championships: number; lastWonAt: number }>();
  const seen = new Set<string>();
  for (const state of states.slice(0, 52)) for (const match of state.rounds.flat()) {
    if (match.status !== 'complete' || match.reason !== 'played' || !match.roomCode || !match.winnerId) continue;
    const room = rooms.get(match.roomCode);
    const [host, guest] = match.entrantIds.map(id => state.entrants.find(entry => entry.id === id));
    if (!room || !host || !guest || room.status !== 'complete' || room.reason !== 'districts' ||
      room.match?.phase !== 'complete' || room.ranked || room.gameNumber !== 1 ||
      room.members.player.userId !== host.member.userId || room.members.cpu?.userId !== guest.member.userId ||
      room.kumite?.tournamentId !== state.id || room.kumite.matchId !== match.id ||
      room.kumite.roundDeadline !== match.deadline ||
      room.startedAt == null || room.completedAt == null || room.kumite.finishedAt !== room.completedAt ||
      !Number.isSafeInteger(room.startedAt) || !Number.isSafeInteger(room.completedAt) ||
      room.startedAt < state.startsAt || room.completedAt < room.startedAt || room.completedAt > match.deadline ||
      (room.winner !== 'player' && room.winner !== 'cpu')) continue;
    const winner = room.winner === 'player' ? host : guest;
    const opponent = room.winner === 'player' ? guest : host;
    if (winner.id !== match.winnerId || seen.has(match.roomCode)) continue;
    seen.add(match.roomCode);
    const durationMs = room.completedAt - room.startedAt;
    if (!records.fastestFight || durationMs < records.fastestFight.durationMs ||
      (durationMs === records.fastestFight.durationMs && room.completedAt < records.fastestFight.completedAt)) {
      records.fastestFight = { tournamentId: state.id, weekLabel: state.weekLabel, matchId: match.id, round: match.round,
        startedAt: room.startedAt, completedAt: room.completedAt, durationMs,
        winner: fighter(winner.member), opponent: fighter(opponent.member) };
    }
    const champion = state.status === 'complete' && state.championId === winner.id && match.round === 2;
    if (champion) records.recentWinners.push({ ...fighter(winner.member), tournamentId: state.id,
      weekLabel: state.weekLabel, wonAt: room.completedAt });
    const previous = leaders.get(winner.member.userId);
    leaders.set(winner.member.userId, { ...(previous && previous.lastWonAt > room.completedAt ? previous : fighter(winner.member)),
      playedWins: (previous?.playedWins ?? 0) + 1, championships: (previous?.championships ?? 0) + Number(champion),
      lastWonAt: Math.max(previous?.lastWonAt ?? 0, room.completedAt) });
  }
  records.recentWinners.sort((a, b) => b.wonAt - a.wonAt || a.tournamentId.localeCompare(b.tournamentId));
  records.recentWinners = records.recentWinners.slice(0, 10);
  records.handThrowers = [...leaders.values()].sort((a, b) => b.playedWins - a.playedWins ||
    b.championships - a.championships || b.lastWonAt - a.lastWonAt || a.name.localeCompare(b.name))
    .slice(0, 10).map((entry, index) => ({ ...entry, rank: index + 1 }));
  return records;
}
