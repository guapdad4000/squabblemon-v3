// Frozen pre-optimization implementation for exact response/query parity tests.
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
export function tallyFadeRecordsReference(
  rows: {
    hostUserId: string;
    guestUserId: string | null;
    state: Record<string, unknown>;
  }[],
  userId: string,
  opponent?: string,
): FadeRecord {
  const total = { wins: 0, losses: 0, draws: 0 };
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
    const room = row.state as unknown as OnlineRoom;
    if (room.ranked) {
      if (
        !room.ranked.settlement ||
        !Object.keys(room.ranked.settlement).length
      )
        continue;
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
  return total;
}
export async function getSocialRecordsReference(userId: string, roomCode?: string) {
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
  return {
    self: tallyFadeRecordsReference(history, userId),
    players: people.map((p) => ({
      friendCode: p.friendCode,
      homie: homies.has(p.userId),
      overall: tallyFadeRecordsReference(history, p.userId),
      personal: tallyFadeRecordsReference(history, userId, p.userId),
    })),
    opponentCode: people.find((p) => p.userId === opponent)?.friendCode ?? null,
  };
}
