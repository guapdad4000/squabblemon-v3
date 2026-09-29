import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { and, eq, or, desc, sql } from "drizzle-orm";
import { socialIdentitiesTable as identities,
  socialRelationshipsTable as relations, socialBlocksTable as blocks,
  socialInvitationsTable as invites, socialThrottleTable as throttles, onlineRoomsTable as rooms } from "@workspace/db";
import { OnlineError, createOnlineRoom, joinOnlineRoom, expireOnlineRoom, type OnlineRoom } from "@workspace/squabblemon-engine/multiplayer";
import { loadMember } from "./onlineMatches";
import { eligiblePair, lockSocial, pair, syncRoomInvitation, type SocialTx } from "./socialRoomGuard";
import type { SocialPlayer, SocialRequest } from "@workspace/api-zod";
import { homiesDiagnostics, homiesTransaction } from "./homiesDiagnosticsRuntime";
import { identity, identityViews, normalizeUsername } from "./socialIdentity";

const involved = (id: string) => or(eq(relations.low, id), eq(relations.high, id));
const invited = (id: string) => or(eq(invites.sender, id), eq(invites.recipient, id));
export function normalizeFriendCode(code: string) {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-F0-9]{12}$/.test(normalized)) throw new OnlineError("Enter a valid 12-character friend code.", 400);
  return normalized;
}
async function target(tx: SocialTx, code: string) {
  const [found] = await tx.select().from(identities).where(eq(identities.friendCode, normalizeFriendCode(code)));
  if (!found) throw new OnlineError("Player not found.", 404);
  return found.userId;
}
async function relation(tx: SocialTx, a: string, b: string) {
  const [low, high] = pair(a, b);
  return (await tx.select().from(relations).where(and(eq(relations.low, low), eq(relations.high, high))))[0];
}
async function blocked(tx: SocialTx, a: string, b: string) {
  return (await tx.select().from(blocks).where(or(and(eq(blocks.userId, a), eq(blocks.targetId, b)), and(eq(blocks.userId, b), eq(blocks.targetId, a))))).length > 0;
}
/** Separate committed transaction: even failed enumeration attempts consume budget. */
export async function socialThrottle(userId: string, action: "lookup" | "mutate") {
  return homiesDiagnostics.operation("social_throttle", action === "lookup" ? "throttle_lookup" : "throttle_mutate", async () => {
    const allowed = await homiesTransaction(async tx => {
      await lockSocial(tx);
      await identity(tx, userId);
      const now = new Date();
      const [old] = await tx.select().from(throttles).where(and(eq(throttles.userId, userId), eq(throttles.action, action)));
      const fresh = !old || now.getTime() - old.windowAt.getTime() >= 60_000;
      const count = fresh ? 1 : old.count + 1;
      await tx.insert(throttles).values({ userId, action, windowAt: now, count }).onConflictDoUpdate({
        target: [throttles.userId, throttles.action], set: { count, windowAt: fresh ? now : old!.windowAt },
      });
      return count <= (action === "lookup" ? 30 : 40);
    });
    if (!allowed) throw new OnlineError("Slow down and try again in a minute.", 429);
  });
}
const liveInvitation = (status: string) => status === "pending" || status === "accepted";
function invitationReceipt(row: typeof invites.$inferSelect, roomCode: string, userId: string, player: SocialPlayer) {
  return { id: row.id, roomCode, direction: row.sender === userId ? "outgoing" as const : "incoming" as const,
    player, status: row.status, expiresAt: row.expiresAt.toISOString() };
}
async function invitationView(tx: SocialTx, row: typeof invites.$inferSelect, userId: string, player?: SocialPlayer) {
  const query = tx.select().from(rooms).where(eq(rooms.id, row.roomId));
  // Terminal receipts never transition again. Pending/accepted receipts still
  // synchronize under the room lock, including joined-room commands that do
  // not take the global social lock.
  const live = liveInvitation(row.status);
  const [room] = await (live ? query.for("update") : query);
  if (!room) throw new OnlineError("Invitation not found.", 404);
  if (live) {
    await syncRoomInvitation(tx, room.id, expireOnlineRoom(room.state as unknown as OnlineRoom, Date.now()));
    [row] = await tx.select().from(invites).where(eq(invites.id, row.id));
  }
  return invitationReceipt(row, room.code, userId,
    player ?? await identity(tx, row.sender === userId ? row.recipient : row.sender));
}
async function state(tx: SocialTx, userId: string) {
  const rows = await tx.select().from(relations).where(and(involved(userId), or(eq(relations.status, "pending"), eq(relations.status, "homie")))).orderBy(desc(relations.updatedAt)).limit(160);
  const blockedRows = await tx.select().from(blocks).where(eq(blocks.userId, userId)).limit(100);
  const invitationRows = await tx.select({ invitation: invites, roomCode: rooms.code }).from(invites)
    .innerJoin(rooms, eq(rooms.id, invites.roomId)).where(invited(userId))
    .orderBy(desc(sql`${invites.status} = 'pending'`), desc(invites.createdAt)).limit(40);
  const otherParty = (row: typeof invites.$inferSelect) => row.sender === userId ? row.recipient : row.sender;
  const players = await identityViews(tx, [userId,
    ...rows.map(row => row.low === userId ? row.high : row.low),
    ...blockedRows.map(row => row.targetId),
    ...invitationRows.map(({ invitation }) => otherParty(invitation))]);
  const self = players.get(userId)!;
  const homies = [];
  const incomingRequests: SocialRequest[] = [], outgoingRequests: SocialRequest[] = [];
  for (const row of rows) {
    const player = players.get(row.low === userId ? row.high : row.low)!;
    if (row.status === "homie") homies.push(player);
    else (row.sender === userId ? outgoingRequests : incomingRequests).push({ id: row.id, player, createdAt: row.createdAt.toISOString() });
  }
  const blockedPlayers = blockedRows.map(row => players.get(row.targetId)!);
  const invitations = [];
  for (const { invitation, roomCode } of invitationRows) {
    const player = players.get(otherParty(invitation))!;
    invitations.push(liveInvitation(invitation.status)
      ? await invitationView(tx, invitation, userId, player)
      : invitationReceipt(invitation, roomCode, userId, player));
  }
  return { self, homies, incomingRequests, outgoingRequests, blocked: blockedPlayers, invitations,
    counts: { requests: incomingRequests.length, invitations: invitations.filter(i => i.direction === "incoming" && i.status === "pending").length } };
}
export async function getSocialState(userId: string) {
  return homiesDiagnostics.operation("menu_refresh", "menu_refresh",
    () => homiesTransaction(async tx => { await lockSocial(tx); return state(tx, userId); }));
}
export async function lookupSocialPlayer(userId: string, code: string) {
  return homiesDiagnostics.operation("social_read", "lookup", () => homiesTransaction(async tx => {
    await lockSocial(tx);
    const other = await target(tx, code);
    const player = await identity(tx, other);
    if (other === userId) return { player, relationship: "self", requestId: null };
    const ownBlock = await tx.select().from(blocks).where(and(eq(blocks.userId, userId), eq(blocks.targetId, other)));
    if (ownBlock.length) return { player, relationship: "blocked", requestId: null };
    if (await blocked(tx, userId, other)) throw new OnlineError("Player not found.", 404);
    const row = await relation(tx, userId, other);
    return { player, requestId: row?.status === "pending" ? row.id : null, relationship: row?.status === "homie" ? "homie" : row?.status === "pending" ? row.sender === userId ? "outgoing" : "incoming" : "none" };
  }));
}
export async function updateSocialUsername(userId: string, value: string) {
  const username = normalizeUsername(value);
  return homiesDiagnostics.operation("social_write", "relationship_write", () => homiesTransaction(async tx => {
    await lockSocial(tx);
    await identity(tx, userId);
    const [taken] = await tx.select().from(identities).where(eq(identities.username, username));
    if (taken && taken.userId !== userId) throw new OnlineError("That username is already taken.", 409);
    await tx.update(identities).set({ username }).where(eq(identities.userId, userId));
    return state(tx, userId);
  }));
}
async function limits(tx: SocialTx, userId: string, status: string, maximum: number) {
  const rows = await tx.select({ id: relations.id }).from(relations).where(and(involved(userId), eq(relations.status, status))).limit(maximum);
  if (rows.length >= maximum) throw new OnlineError("This player's social list is full. Clear an existing entry first.", 429);
}
async function invalidate(tx: SocialTx, a: string, b: string) {
  const [low, high] = pair(a, b);
  const pending = await tx.select().from(invites).where(and(eq(invites.low, low), eq(invites.high, high), eq(invites.status, "pending")));
  for (const row of pending) {
    const [room] = await tx.select().from(rooms).where(eq(rooms.id, row.roomId)).for("update");
    const current = room.state as unknown as OnlineRoom;
    if (current.members.cpu) { await syncRoomInvitation(tx, room.id, current); continue; }
    await tx.update(invites).set({ status: "unavailable" }).where(eq(invites.id, row.id));
    await tx.update(rooms).set({ state: { ...current, status: "closed", revision: current.revision + 1 }, expiresAt: new Date(), updatedAt: new Date() }).where(eq(rooms.id, room.id));
  }
}
export async function mutateRelationship(userId: string, operation: "send" | "respond" | "remove" | "block" | "unblock", input: { code?: string; id?: string; action?: string }) {
  return homiesDiagnostics.operation("social_write", "relationship_write", () => homiesTransaction(async tx => {
    await lockSocial(tx);
    await identity(tx, userId);
    let row = input.id ? (await tx.select().from(relations).where(eq(relations.id, input.id)))[0] : undefined;
    if (input.id && (!row || (row.low !== userId && row.high !== userId))) throw new OnlineError("Request not found.", 404);
    const other = row ? row.low === userId ? row.high : row.low : await target(tx, input.code!);
    if (other === userId) throw new OnlineError("Choose another player.", 400);
    row ??= await relation(tx, userId, other);
    const [low, high] = pair(userId, other);
    if (operation === "send") {
      if (await blocked(tx, userId, other)) throw new OnlineError("Player unavailable.", 404);
      if (row?.status === "homie" || (row?.status === "pending" && row.sender === userId)) return state(tx, userId);
      if (row?.status === "pending") throw new OnlineError("This player already sent you a request. Accept it from your incoming requests.", 409);
      if (row && Date.now() - row.updatedAt.getTime() < 60_000) throw new OnlineError("Wait a minute before sending another request.", 429);
      await limits(tx, userId, "pending", 30); await limits(tx, other, "pending", 30);
      await limits(tx, userId, "homie", 100); await limits(tx, other, "homie", 100);
      if (row) await tx.update(relations).set({ id: randomUUID(), sender: userId, status: "pending", createdAt: new Date(), updatedAt: new Date() }).where(eq(relations.id, row.id));
      else await tx.insert(relations).values({ low, high, sender: userId, status: "pending" });
    } else if (operation === "respond") {
      if (!row || (input.action === "cancel" ? row.sender !== userId : row.sender === userId)) throw new OnlineError("Request not found.", 404);
      const status = input.action === "accept" ? "homie" : input.action === "cancel" ? "cancelled" : "declined";
      if (row.status !== "pending") {
        if (row.status !== status) throw new OnlineError("This request is no longer pending.", 409);
      } else {
        if (await blocked(tx, userId, other)) throw new OnlineError("Player unavailable.", 404);
        if (status === "homie") { await limits(tx, userId, "homie", 100); await limits(tx, other, "homie", 100); }
        await tx.update(relations).set({ status, updatedAt: new Date() }).where(eq(relations.id, row.id));
      }
    } else if (operation === "unblock") {
      await tx.delete(blocks).where(and(eq(blocks.userId, userId), eq(blocks.targetId, other)));
    } else {
      if (operation === "block") {
        const existing = await tx.select().from(blocks).where(eq(blocks.userId, userId)).limit(100);
        if (existing.length >= 100 && !existing.some(b => b.targetId === other)) throw new OnlineError("Your blocked list is full.", 429);
        await tx.insert(blocks).values({ userId, targetId: other }).onConflictDoNothing();
      }
      if (row) await tx.update(relations).set({ status: "removed", updatedAt: new Date() }).where(eq(relations.id, row.id));
      await invalidate(tx, userId, other);
    }
    return state(tx, userId);
  }));
}
export async function sendFadeInvitation(userId: string, input: { friendCode: string; deckId: string; requestId: string }) {
  return homiesDiagnostics.operation("social_write", "invitation_send", () => homiesTransaction(async tx => {
    await lockSocial(tx);
    const other = await target(tx, input.friendCode);
    const [prior] = await tx.select().from(invites).where(and(eq(invites.sender, userId), eq(invites.requestId, input.requestId)));
    if (prior) {
      if (prior.recipient !== other || prior.deckId !== input.deckId) throw new OnlineError("This request ID was already used for another invitation.", 409);
      return invitationView(tx, prior, userId);
    }
    const [usedRoom] = await tx.select({ id: rooms.id }).from(rooms).where(and(eq(rooms.hostUserId, userId), eq(rooms.createRequestId, input.requestId)));
    if (usedRoom) throw new OnlineError("This request ID was already used for another room.", 409);
    if (other === userId || !(await eligiblePair(tx, userId, other))) throw new OnlineError("Only homies can receive invitations.", 409);
    // Refresh pending receipts before applying limits and the unique active-pair constraint.
    for (const row of await tx.select().from(invites).where(and(or(invited(userId), invited(other)), eq(invites.status, "pending")))) await invitationView(tx, row, userId);
    for (const id of [userId, other]) {
      const pending = await tx.select().from(invites).where(and(invited(id), eq(invites.status, "pending"))).limit(10);
      if (pending.length >= 10) throw new OnlineError("Clear a pending invitation before sending another.", 429);
    }
    const [low, high] = pair(userId, other);
    const [active] = await tx.select().from(invites).where(and(eq(invites.low, low), eq(invites.high, high))).orderBy(desc(invites.createdAt)).limit(1);
    if (active?.status === "pending") throw new OnlineError("An invitation is already pending between you.", 409);
    if (active && Date.now() - active.createdAt.getTime() < 60_000) throw new OnlineError("Wait a minute before inviting this homie again.", 429);
    const member = await loadMember(tx, userId, input.deckId);
    const open = await tx.select().from(rooms).where(and(eq(rooms.hostUserId, userId), sql`${rooms.expiresAt} > now()`));
    if (open.filter(r => ["waiting", "active"].includes((r.state as unknown as OnlineRoom).status)).length >= 5) throw new OnlineError("Close an existing room first.", 429);
    const current = createOnlineRoom(member, randomInt(2) ? "player" : "cpu", Date.now());
    // Invitations expire quickly; an accepted room keeps the ordinary lifecycle.
    const expiresAt = new Date(Date.now() + 10 * 60_000);
    const [room] = await tx.insert(rooms).values({ code: randomBytes(6).toString("hex").toUpperCase(), hostUserId: userId,
      inviteOnly: true, createRequestId: input.requestId, state: current as unknown as Record<string, unknown>, expiresAt: new Date(current.expiresAt) }).returning();
    const [invitation] = await tx.insert(invites).values({ sender: userId, recipient: other, low, high, roomId: room.id,
      requestId: input.requestId, deckId: input.deckId, expiresAt }).returning();
    return invitationView(tx, invitation, userId);
  }));
}
export async function accessInvitation(userId: string, id: string, input?: { action: string; deckId?: string }) {
  return homiesDiagnostics.operation(input ? "social_write" : "social_read", input ? "invitation_write" : "invitation_read", () => homiesTransaction(async tx => {
    await lockSocial(tx);
    const [row] = await tx.select().from(invites).where(eq(invites.id, id));
    if (!row || (row.sender !== userId && row.recipient !== userId)) throw new OnlineError("Invitation not found.", 404);
    let view = await invitationView(tx, row, userId);
    if (!input) return view;
    if (input.action === "cancel" ? row.sender !== userId : row.recipient !== userId) throw new OnlineError("Invitation not found.", 404);
    if (view.status !== "pending") return view;
    const [room] = await tx.select().from(rooms).where(eq(rooms.id, row.roomId)).for("update");
    let current = expireOnlineRoom(room.state as unknown as OnlineRoom, Date.now());
    if (input.action === "accept") {
      if (!input.deckId) throw new OnlineError("Choose a gang.", 400);
      if (!(await eligiblePair(tx, row.sender, row.recipient))) throw new OnlineError("This invitation is unavailable.", 409);
      current = joinOnlineRoom(current, await loadMember(tx, userId, input.deckId), Date.now());
      await tx.update(invites).set({ status: "accepted" }).where(eq(invites.id, id));
    } else {
      await tx.update(invites).set({ status: input.action === "cancel" ? "cancelled" : "declined" }).where(eq(invites.id, id));
      current = { ...current, status: "closed", revision: current.revision + 1 };
    }
    await tx.update(rooms).set({ state: current as unknown as Record<string, unknown>, guestUserId: current.members.cpu?.userId ?? null,
      expiresAt: new Date(current.status === "closed" ? Date.now() : current.expiresAt), updatedAt: new Date() }).where(eq(rooms.id, room.id));
    view = await invitationView(tx, row, userId);
    return view;
  }));
}