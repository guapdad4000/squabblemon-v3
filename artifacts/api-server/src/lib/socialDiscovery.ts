import { and, eq, inArray, or, sql } from "drizzle-orm";
import { socialIdentitiesTable as identities, socialRelationshipsTable as relations, socialBlocksTable as blocks, onlineRoomsTable as rooms } from "@workspace/db";
import type { SocialLookup } from "@workspace/api-zod";
import { OnlineError, type OnlineRoom } from "@workspace/squabblemon-engine/multiplayer";
import { identityViews } from "./socialIdentity";
import { lockSocial, type SocialTx } from "./socialRoomGuard";
import { homiesDiagnostics, homiesTransaction } from "./homiesDiagnosticsRuntime";

async function lookups(tx: SocialTx, userId: string, others: string[]): Promise<SocialLookup[]> {
  if (!others.length) return [];
  const players = await identityViews(tx, others);
  const rows = await tx.select().from(relations).where(or(
    and(eq(relations.low, userId), inArray(relations.high, others)),
    and(eq(relations.high, userId), inArray(relations.low, others))));
  return others.map(other => {
    const row = rows.find(row => row.low === other || row.high === other);
    return { player: players.get(other)!, requestId: row?.status === "pending" ? row.id : null,
      relationship: row?.status === "homie" ? "homie" : row?.status === "pending" ? row.sender === userId ? "outgoing" : "incoming" : "none" };
  });
}
export function normalizeSearch(value: string) {
  const query = value.trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(query)) throw new OnlineError("Enter at least 3 username characters (letters, numbers, or underscores).", 400);
  return query;
}
export async function searchSocialPlayers(userId: string, value: string) {
  const query = normalizeSearch(value);
  return homiesDiagnostics.operation("social_read", "lookup", () => homiesTransaction(async tx => {
    await lockSocial(tx);
    // Escape underscores: usernames are literal prefixes, not LIKE patterns.
    const prefix = query.replace(/_/g, "\\_") + "%";
    const rows = await tx.select({ userId: identities.userId }).from(identities).where(and(
      sql`${identities.userId} <> ${userId}`, sql`${identities.username} like ${prefix}`,
      sql`not exists (select 1 from ${blocks} where (${blocks.userId} = ${userId} and ${blocks.targetId} = ${identities.userId}) or (${blocks.targetId} = ${userId} and ${blocks.userId} = ${identities.userId}))`
    )).orderBy(sql`(${identities.username} = ${query}) desc`, identities.username).limit(12);
    return { players: await lookups(tx, userId, rows.map(row => row.userId)) };
  }));
}
export async function getSocialMatchOpponent(userId: string, code: string) {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-F0-9]{12}$/.test(normalized)) throw new OnlineError("Room not found.", 404);
  return homiesDiagnostics.operation("social_read", "lookup", () => homiesTransaction(async tx => {
    await lockSocial(tx);
    // No expiry filter: persisted members survive completion, surrender and closing.
    const [row] = await tx.select().from(rooms).where(eq(rooms.code, normalized));
    if (!row) throw new OnlineError("Room not found.", 404);
    const room = row.state as unknown as OnlineRoom;
    const seat = room.members.player.userId === userId ? "player" : room.members.cpu?.userId === userId ? "cpu" : null;
    if (!seat) throw new OnlineError("Only room participants can view an opponent.", 403);
    const other = room.members[seat === "player" ? "cpu" : "player"]?.userId;
    if (!other || other === userId || room.ranked?.bot) return { opponent: null };
    const [blocked] = await tx.select({ userId: blocks.userId }).from(blocks).where(or(
      and(eq(blocks.userId, userId), eq(blocks.targetId, other)),
      and(eq(blocks.userId, other), eq(blocks.targetId, userId))));
    if (blocked) return { opponent: null };
    return { opponent: (await lookups(tx, userId, [other]))[0] };
  }));
}