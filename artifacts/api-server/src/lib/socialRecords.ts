import { restoreOnlineRoom } from './onlineRoomPersistence';
import { and, eq, inArray, or, sql } from "drizzle-orm";
import {
  db,
  onlineRoomsTable as rooms,
  socialIdentitiesTable as identities,
  socialRelationshipsTable as relations,
  socialBlocksTable as blocks,
} from "@workspace/db";
import {
  OnlineError,
  roomSeries,
  type OnlineRoom,
} from "@workspace/squabblemon-engine/multiplayer";
export type FadeRecord = { wins: number; losses: number; draws: number };
type FadeRecordRow = {
  hostUserId: string;
  guestUserId: string | null;
  state: Record<string, unknown>;
};
const emptyFadeRecord = (): FadeRecord => ({ wins: 0, losses: 0, draws: 0 });

function addFadeRecord(
  total: FadeRecord,
  room: OnlineRoom,
  seat: "player" | "cpu",
) {
  if (room.ranked) {
    if (!room.ranked.settlement || !Object.keys(room.ranked.settlement).length)
      return;
    if (room.winner === "draw") total.draws++;
    else if (room.winner === seat) total.wins++;
    else if (room.winner) total.losses++;
  } else {
    const series = roomSeries(room);
    total.wins += series[seat];
    total.losses += series[seat === "player" ? "cpu" : "player"];
    total.draws += series.draws;
  }
}

export function tallyFadeRecords(
  rows: FadeRecordRow[],
  userId: string,
  opponent?: string,
): FadeRecord {
  const total = emptyFadeRecord();
  for (const row of rows) {
    const seat =
      row.hostUserId === userId
        ? "player"
        : row.guestUserId === userId
          ? "cpu"
          : null;
    if (
      !seat ||
      (opponent &&
        (seat === "player" ? row.guestUserId : row.hostUserId) !== opponent)
    )
      continue;
    addFadeRecord(total, restoreOnlineRoom(row.state), seat);
  }
  return total;
}

/** Request-local totals avoid scanning all history again for every visible player. */
export function tallySocialFadeRecords(
  rows: FadeRecordRow[],
  userId: string,
  playerIds: readonly string[],
) {
  const players = new Map(playerIds.map(id => [
    id, { overall: emptyFadeRecord(), personal: emptyFadeRecord() },
  ] as const));
  // With no visible players the original single self tally is already optimal.
  if (!players.size) return { self: tallyFadeRecords(rows, userId), players };
  const self = emptyFadeRecord();
  for (const row of rows) {
    const hostId = row.hostUserId;
    const guestId = row.guestUserId;
    const seat = hostId === userId ? "player" : guestId === userId ? "cpu" : null;
    const host = players.get(hostId);
    // A legacy room with the same ID in both seats counts only its host seat.
    const guest = guestId !== null && guestId !== hostId ? players.get(guestId) : undefined;
    if (!seat && !host && !guest) continue;
    const room = restoreOnlineRoom(row.state);
    if (seat) addFadeRecord(self, room, seat);
    if (host) addFadeRecord(host.overall, room, "player");
    if (guest) addFadeRecord(guest.overall, room, "cpu");
    if (seat) {
      const opponentId = seat === "player" ? guestId : hostId;
      const opponent = opponentId === null ? undefined : players.get(opponentId);
      if (opponent) addFadeRecord(opponent.personal, room, seat);
    }
  }
  // The existing optional-opponent tally treats an empty ID as no filter.
  const emptyId = players.get("");
  if (emptyId) Object.assign(emptyId.personal, self);
  return { self, players };
}

export async function getSocialRecords(userId: string, roomCode?: string) {
  const relationships = await db
    .select()
    .from(relations)
    .where(
      and(
        eq(relations.status, "homie"),
        or(eq(relations.low, userId), eq(relations.high, userId)),
      ),
    );
  const homies = new Set(
    relationships.map((r) => (r.low === userId ? r.high : r.low)),
  );
  let opponent: string | undefined;
  if (roomCode) {
    const [room] = await db
      .select()
      .from(rooms)
      .where(eq(rooms.code, roomCode.toUpperCase()));
    if (!room || (room.hostUserId !== userId && room.guestUserId !== userId))
      throw new OnlineError(
        "Only room participants can view this record.",
        403,
      );
    opponent =
      (room.hostUserId === userId ? room.guestUserId : room.hostUserId) ??
      undefined;
  }
  const blocked = await db
    .select()
    .from(blocks)
    .where(or(eq(blocks.userId, userId), eq(blocks.targetId, userId)));
  const hidden = new Set(
    blocked.map((r) => (r.userId === userId ? r.targetId : r.userId)),
  );
  const allowed = [
    ...new Set([...homies, ...(opponent ? [opponent] : [])]),
  ].filter((id) => !hidden.has(id));
  const ids = [userId, ...allowed];
  const history = await db
    .select({
      hostUserId: rooms.hostUserId,
      guestUserId: rooms.guestUserId,
      state: sql<
        Record<string, unknown>
      >`jsonb_build_object('series', ${rooms.state}->'series', 'ranked', ${rooms.state}->'ranked', 'winner', ${rooms.state}->'winner')`,
    })
    .from(rooms)
    .where(or(inArray(rooms.hostUserId, ids), inArray(rooms.guestUserId, ids)));
  const people = allowed.length
    ? await db
        .select()
        .from(identities)
        .where(inArray(identities.userId, allowed))
    : [];
  const totals = tallySocialFadeRecords(history, userId, people.map(p => p.userId));
  return {
    self: totals.self,
    players: people.map((p) => ({
      friendCode: p.friendCode,
      homie: homies.has(p.userId),
      overall: totals.players.get(p.userId)!.overall,
      personal: totals.players.get(p.userId)!.personal,
    })),
    opponentCode: people.find((p) => p.userId === opponent)?.friendCode ?? null,
  };
}
