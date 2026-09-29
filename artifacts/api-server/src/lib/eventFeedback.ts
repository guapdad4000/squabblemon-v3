import { randomUUID } from "node:crypto";
import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { db, eventFeedbackTable as feedback, playerProfilesTable as profiles } from "@workspace/db";

export type FeedbackInput = { category: "bug" | "suggestion" | "general"; message: string; retryId: string };
export class FeedbackConflict extends Error {}
export class FeedbackUnavailable extends Error {}
export class FeedbackThrottled extends Error {
  constructor(readonly retryAfterSeconds: number) { super("Feedback posting limit reached"); }
}

function publicPost(row: typeof feedback.$inferSelect) {
  return {
    id: row.id,
    displayName: row.displayName,
    category: row.category,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function submitFeedback(userId: string, input: FeedbackInput) {
  const message = input.message.trim();
  if (!message || message.length > 2000) throw new RangeError("Invalid feedback message");
  return db.transaction(async tx => {
    // Per-account transaction advisory lock serializes idempotency AND rolling limits
    // across independent servers without locking or mutating the player profile.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 773411))`);
    const [prior] = await tx.select().from(feedback)
      .where(and(eq(feedback.clerkUserId, userId), eq(feedback.retryId, input.retryId)));
    if (prior) {
      if (prior.message !== message || prior.category !== input.category) throw new FeedbackConflict();
      return { post: publicPost(prior), receiptId: prior.id, replayed: true };
    }
    const [profile] = await tx.select({ displayName: profiles.displayName }).from(profiles)
      .where(eq(profiles.clerkUserId, userId));
    if (!profile || !profile.displayName.trim() || profile.displayName.length > 200) throw new FeedbackUnavailable();
    // Clock and windows come from PostgreSQL, not individual app server clocks.
    const windows = await tx.execute(sql<{ short_count: number; day_count: number; short_retry: number | null; day_retry: number | null }>`
      SELECT
        count(*) FILTER (WHERE created_at > now() - interval '10 minutes')::int AS short_count,
        count(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS day_count,
        ceil(extract(epoch FROM min(created_at) FILTER (WHERE created_at > now() - interval '10 minutes') + interval '10 minutes' - now()))::int AS short_retry,
        ceil(extract(epoch FROM min(created_at) FILTER (WHERE created_at > now() - interval '24 hours') + interval '24 hours' - now()))::int AS day_retry
      FROM event_feedback WHERE clerk_user_id = ${userId}
    `);
    const window = windows.rows[0] as { short_count: number; day_count: number; short_retry: number | null; day_retry: number | null };
    if (window.short_count >= 5 || window.day_count >= 20) {
      throw new FeedbackThrottled(Math.max(1, window.short_count >= 5 ? window.short_retry ?? 1 : window.day_retry ?? 1));
    }
    const [saved] = await tx.insert(feedback).values({
      id: randomUUID(),
      clerkUserId: userId,
      retryId: input.retryId,
      displayName: profile.displayName,
      category: input.category,
      message,
    }).returning();
    return { post: publicPost(saved), receiptId: saved.id, replayed: false };
  });
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function decodeFeedbackCursor(value: string): { createdAt: Date; id: string } {
  if (value.length > 256 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new RangeError("Invalid feedback cursor");
  try {
    const raw = Buffer.from(value, "base64url");
    if (raw.toString("base64url") !== value) throw new RangeError("Invalid feedback cursor");
    const parsed: unknown = JSON.parse(raw.toString("utf8"));
    if (!Array.isArray(parsed) || parsed.length !== 2 || typeof parsed[0] !== "string" || typeof parsed[1] !== "string") throw new RangeError("Invalid feedback cursor");
    const [time, id] = parsed;
    if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(time) || !Number.isFinite(Date.parse(time)) || new Date(time).toISOString() !== time || !uuidPattern.test(id)) throw new RangeError("Invalid feedback cursor");
    return { createdAt: new Date(time), id };
  } catch { throw new RangeError("Invalid feedback cursor"); }
}

export async function listFeedback(limit = 20, cursor?: string) {
  const key = cursor === undefined ? undefined : decodeFeedbackCursor(cursor);
  const rows = await db.select().from(feedback)
    .where(key ? or(lt(feedback.createdAt, key.createdAt),
      and(eq(feedback.createdAt, key.createdAt), sql`${feedback.id} < ${key.id}::uuid`)) : undefined)
    .orderBy(desc(feedback.createdAt), desc(feedback.id)).limit(limit + 1);
  const more = rows.length > limit;
  const posts = rows.slice(0, limit).map(publicPost);
  const last = posts.at(-1);
  return { posts, nextCursor: more && last ? Buffer.from(JSON.stringify([last.createdAt, last.id])).toString("base64url") : null };
}