import { randomBytes } from "node:crypto";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { playerProfilesTable as profiles, socialIdentitiesTable as identities } from "@workspace/db";
import { OnlineError } from "@workspace/squabblemon-engine/multiplayer";
import type { SocialPlayer } from "@workspace/api-zod";
import type { SocialTx } from "./socialRoomGuard";

const reserved = new Set(["admin", "administrator", "system", "support", "moderator", "mod", "official", "fadebook", "squabblemon", "deleted", "null", "undefined"]);
export function normalizeUsername(value: string) {
  const username = value.trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(username)) throw new OnlineError("Use 3–24 letters, numbers, or underscores.", 400);
  if (reserved.has(username)) throw new OnlineError("That username is reserved.", 400);
  return username;
}
export function usernameBase(displayName: string) {
  const base = displayName.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24);
  return base.length < 3 || reserved.has(base) ? "player" : base;
}
/** All callers hold lockSocial: claims and lazy allocations share the same lock. */
export async function identity(tx: SocialTx, id: string): Promise<SocialPlayer> {
  const [profile] = await tx.select({ displayName: profiles.displayName, avatarKey: profiles.avatarKey, lastActiveAt: profiles.lastActiveAt }).from(profiles).where(eq(profiles.clerkUserId, id));
  if (!profile) throw new OnlineError("Player not found.", 404);
  let [found] = await tx.select().from(identities).where(eq(identities.userId, id));
  if (!found) {
    for (let attempt = 0; attempt < 5 && !found; attempt++) {
      [found] = await tx.insert(identities).values({ userId: id, friendCode: randomBytes(6).toString("hex").toUpperCase() }).onConflictDoNothing().returning();
    }
    if (!found) throw new OnlineError("Could not create a friend code. Please retry.", 503);
  }
  if (!found.username) {
    const base = usernameBase(profile.displayName);
    for (let attempt = 0; attempt < 8; attempt++) {
      const username = attempt ? `${base.slice(0, 15)}_${randomBytes(4).toString("hex")}` : base;
      const [taken] = await tx.select({ id: identities.userId }).from(identities).where(eq(identities.username, username));
      if (taken) continue;
      [found] = await tx.update(identities).set({ username }).where(eq(identities.userId, id)).returning();
      break;
    }
    if (!found.username) throw new OnlineError("Could not allocate a username. Please retry.", 503);
  }
  return { friendCode: found.friendCode, username: found.username, ...profile, lastActiveAt: profile.lastActiveAt?.toISOString() ?? null };
}
/** Preserve batched reads for already allocated related people. */
export async function identityViews(tx: SocialTx, userIds: string[]) {
  const unique = [...new Set(userIds)];
  if (!unique.length) return new Map<string, SocialPlayer>();
  const rows = await tx.select({ userId: profiles.clerkUserId, friendCode: identities.friendCode, username: identities.username,
    displayName: profiles.displayName, avatarKey: profiles.avatarKey, lastActiveAt: profiles.lastActiveAt }).from(profiles)
    .leftJoin(identities, eq(identities.userId, profiles.clerkUserId)).where(inArray(profiles.clerkUserId, unique));
  if (rows.length !== unique.length) throw new OnlineError("Player not found.", 404);
  const missing = rows.filter(row => !row.friendCode || !row.username);
  if (missing.length) {
    // A legacy 100-homie menu must not perform one allocation transaction/query
    // per person. Bulk-create codes, reserve collision-checked names, then update
    // all missing handles in one statement under the existing social lock.
    const noCode = missing.filter(row => !row.friendCode);
    if (noCode.length) {
      await tx.insert(identities).values(noCode.map(row => ({
        userId: row.userId, friendCode: randomBytes(6).toString("hex").toUpperCase(),
      }))).onConflictDoNothing();
    }
    const allocated = new Map<string, string>();
    for (let attempt = 0; attempt < 8 && allocated.size < missing.length; attempt++) {
      const candidates = missing.filter(row => !allocated.has(row.userId)).map(row => ({
        userId: row.userId, username: `${usernameBase(row.displayName).slice(0, 15)}_${randomBytes(4).toString("hex")}`,
      }));
      const taken = await tx.select({ username: identities.username }).from(identities)
        .where(inArray(identities.username, candidates.map(row => row.username)));
      const used = new Set([...taken.map(row => row.username), ...allocated.values()]);
      for (const candidate of candidates) {
        if (used.has(candidate.username)) continue;
        allocated.set(candidate.userId, candidate.username);
        used.add(candidate.username);
      }
    }
    if (allocated.size !== missing.length) throw new OnlineError("Could not allocate usernames. Please retry.", 503);
    const cases = [...allocated].map(([id, username]) => sql`when ${id} then ${username}`);
    await tx.update(identities).set({ username: sql`case ${identities.userId} ${sql.join(cases, sql` `)} end` })
      .where(and(inArray(identities.userId, [...allocated.keys()]), isNull(identities.username)));
    const refreshed = await tx.select().from(identities).where(inArray(identities.userId, missing.map(row => row.userId)));
    const byId = new Map(refreshed.map(row => [row.userId, row]));
    for (const row of missing) {
      const found = byId.get(row.userId);
      if (found) { row.friendCode = found.friendCode; row.username = found.username; }
      // An exceedingly rare code collision uses the bounded single-person retry.
    }
  }
  const players = new Map<string, SocialPlayer>();
  for (const row of rows) players.set(row.userId, row.friendCode && row.username
    ? { friendCode: row.friendCode, username: row.username, displayName: row.displayName, avatarKey: row.avatarKey, lastActiveAt: row.lastActiveAt?.toISOString() ?? null }
    : await identity(tx, row.userId));
  return players;
}