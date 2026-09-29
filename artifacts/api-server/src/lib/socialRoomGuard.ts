import { and, eq, or, sql } from "drizzle-orm";
import { db, onlineRoomsTable as rooms, socialInvitationsTable as invites, socialRelationshipsTable as relationships, socialBlocksTable as blocks } from "@workspace/db";
import { OnlineError, type OnlineRoom } from "@workspace/squabblemon-engine/multiplayer";
import { homiesDiagnostics } from "./homiesDiagnosticsRuntime";
export type SocialTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
// Serializes social mutations, account limits, and unclaimed room access across
// instances. Acquire before room/profile row locks. Already-joined room access
// can omit it ONLY after rechecking both seats under the room row lock.
export async function lockSocial(tx: SocialTx) {
  await homiesDiagnostics.socialLock(() => tx.execute(sql`select pg_advisory_xact_lock(72613402)`));
}
export const pair = (a: string, b: string) => a < b ? [a, b] as const : [b, a] as const;
export async function eligiblePair(tx: SocialTx, a: string, b: string) {
  const [low, high] = pair(a, b);
  const [relation] = await tx.select().from(relationships).where(and(eq(relationships.low, low), eq(relationships.high, high)));
  const blocked = await tx.select().from(blocks).where(or(and(eq(blocks.userId, a), eq(blocks.targetId, b)), and(eq(blocks.userId, b), eq(blocks.targetId, a))));
  return relation?.status === "homie" && blocked.length === 0;
}
export async function guardTargetedRoom(tx: SocialTx, roomId: string, room: OnlineRoom, userId: string, joining: boolean, inviteOnly = false) {
  const [invite] = await tx.select().from(invites).where(eq(invites.roomId, roomId));
  if (!invite) {
    if (inviteOnly && userId !== room.members.player.userId && userId !== room.members.cpu?.userId)
      throw new OnlineError("Room not found.", 404);
    return;
  }
  if (userId !== invite.sender && userId !== invite.recipient) throw new OnlineError("Room not found.", 404);
  // Joined players retain reconnection and rematch rights after remove/block.
  if (room.members.cpu) return;
  if (joining && userId !== invite.sender) {
    if (invite.status !== "pending" || invite.expiresAt.getTime() <= Date.now() || room.status !== "waiting" ||
      !(await eligiblePair(tx, invite.sender, invite.recipient))) throw new OnlineError("This invitation is no longer available.", 409);
  }
}
export async function syncRoomInvitation(tx: SocialTx, roomId: string, room: OnlineRoom) {
  const [invite] = await tx.select().from(invites).where(eq(invites.roomId, roomId));
  if (!invite && !room.members.cpu && room.status === "waiting") {
    const [row] = await tx.select({ inviteOnly: rooms.inviteOnly }).from(rooms).where(eq(rooms.id, roomId));
    if (row?.inviteOnly) {
      room = { ...room, status: "closed", reason: "expired", revision: room.revision + 1 };
      await tx.update(rooms).set({ state: room as unknown as Record<string, unknown>, expiresAt: new Date(), updatedAt: new Date() }).where(eq(rooms.id, roomId));
    }
  }
  if (!invite || !["pending", "accepted"].includes(invite.status)) return room;
  let status = invite.status;
  if (room.members.cpu) status = room.status === "closed" ? "closed" : "accepted";
  else if (invite.expiresAt.getTime() <= Date.now() || room.reason === "expired") status = "expired";
  else if (room.status === "closed") status = "cancelled";
  if (status !== invite.status) await tx.update(invites).set({ status }).where(eq(invites.id, invite.id));
  if (status === "expired" && !room.members.cpu && room.status !== "closed") {
    room = { ...room, status: "closed", reason: "expired", revision: room.revision + 1 };
    await tx.update(rooms).set({ state: room as unknown as Record<string, unknown>, expiresAt: new Date(), updatedAt: new Date() }).where(eq(rooms.id, roomId));
  }
  return room;
}