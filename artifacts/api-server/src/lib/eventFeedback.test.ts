import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import express from "express";
import { db, eventFeedbackTable as feedback, playerProfilesTable as profiles } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import route from "../routes/eventFeedback";
import { FeedbackConflict, FeedbackThrottled, listFeedback, submitFeedback } from "./eventFeedback";
import { createApp } from "../app";

async function player(t: test.TestContext, name = "Player") {
  const id = `feedback-${randomUUID()}`;
  await db.insert(profiles).values({ clerkUserId: id, displayName: name });
  t.after(async () => { await db.delete(profiles).where(eq(profiles.clerkUserId, id)); });
  return id;
}
const input = (message = "A good idea", retryId = randomUUID()) => ({ category: "suggestion" as const, message, retryId });
const publicKeys = ["category", "createdAt", "displayName", "id", "message"];

test("feedback actions never mutate existing profile economy, mail, or settings", async t => {
  const userId = await player(t);
  await db.update(profiles).set({
    softCurrency: 1234, packTickets: 7, styleShards: 42,
    inbox: [{ type: "legacy", text: "Keep existing mail" }],
    settings: { reducedMotion: true, turnTimerEnabled: false },
  }).where(eq(profiles.clerkUserId, userId));
  const [before] = await db.select().from(profiles).where(eq(profiles.clerkUserId, userId));
  const request = input("Preserve account");
  const receipt = await submitFeedback(userId, request);
  assert.equal((await submitFeedback(userId, request)).receiptId, receipt.receiptId);
  assert.ok((await listFeedback()).posts.some(post => post.id === receipt.receiptId));
  await assert.rejects(submitFeedback(userId, { ...request, category: "bug" }), FeedbackConflict);
  const [after] = await db.select().from(profiles).where(eq(profiles.clerkUserId, userId));
  assert.deepEqual(after, before);
});

test("saved feedback is public to signed-in players; receipts hide identity and preserve snapshot names", async t => {
  const a = await player(t, "First"), b = await player(t, "Second");
  const request = input("  Plain <script>alert(1)</script>  ");
  const first = await submitFeedback(a, request);
  assert.equal(first.replayed, false);
  assert.deepEqual(Object.keys(first).sort(), ["post", "receiptId", "replayed"]);
  assert.deepEqual(Object.keys(first.post).sort(), publicKeys);
  assert.equal(first.post.message, "Plain <script>alert(1)</script>");
  await db.update(profiles).set({ displayName: "Renamed" }).where(eq(profiles.clerkUserId, a));
  const page = await listFeedback();
  assert.deepEqual(Object.keys(page).sort(), ["nextCursor", "posts"]);
  assert.deepEqual(Object.keys(page.posts.find(p => p.id === first.receiptId)!).sort(), publicKeys);
  assert.deepEqual(page.posts.find(p => p.id === first.receiptId), first.post);
  assert.equal((await submitFeedback(a, { ...request, message: request.message.trim() })).receiptId, first.receiptId);
  await assert.rejects(submitFeedback(a, { ...request, message: "Changed" }), FeedbackConflict);
  assert.notEqual((await submitFeedback(b, request)).receiptId, first.receiptId);
  assert.equal((await db.select().from(feedback).where(eq(feedback.clerkUserId, a))).length, 1);
});

test("concurrent retry lock deduplicates, concurrent new posts throttle, saved retries work after limit", async t => {
  const a = await player(t);
  const same = input();
  const receipts = await Promise.all(Array.from({ length: 10 }, () => submitFeedback(a, same)));
  assert.equal(new Set(receipts.map(r => r.receiptId)).size, 1);
  assert.equal(receipts.filter(r => !r.replayed).length, 1);
  const burst = await Promise.allSettled(Array.from({ length: 10 }, (_, i) => submitFeedback(a, input(`Post ${i}`))));
  assert.equal(burst.filter(r => r.status === "fulfilled").length, 4);
  assert.equal(burst.filter(r => r.status === "rejected" && r.reason instanceof FeedbackThrottled).length, 6);
  assert.equal((await submitFeedback(a, same)).replayed, true);
  await assert.rejects(submitFeedback(a, { ...same, message: "Changed" }), FeedbackConflict);
  await db.execute(sql`UPDATE event_feedback SET created_at = now() - interval '11 minutes' WHERE clerk_user_id = ${a}`);
  assert.equal((await submitFeedback(a, input("Window reset"))).replayed, false);
  // Saturate 24h allowance using backdated records without changing application time.
  await db.execute(sql`UPDATE event_feedback SET created_at = now() - interval '11 minutes' WHERE clerk_user_id = ${a}`);
  for (let i = 0; i < 14; i++) {
    await submitFeedback(a, input(`Daily ${i}`));
    await db.execute(sql`UPDATE event_feedback SET created_at = now() - interval '11 minutes' WHERE clerk_user_id = ${a}`);
  }
  await assert.rejects(submitFeedback(a, input("Limit")), FeedbackThrottled);
  await db.execute(sql`UPDATE event_feedback SET created_at = now() - interval '25 hours' WHERE clerk_user_id = ${a}`);
  assert.equal((await submitFeedback(a, input("Day reset"))).replayed, false);
});

test("keyset paging holds ties and new inserts never shift later pages", async t => {
  const a = await player(t);
  const created = await Promise.all(Array.from({ length: 3 }, (_, i) => submitFeedback(a, input(`Page ${i}`))));
  const tie = new Date("2025-01-02T00:00:00.123Z");
  await db.update(feedback).set({ createdAt: tie }).where(eq(feedback.clerkUserId, a));
  const first = await listFeedback(2);
  const newer = await submitFeedback(a, input("Inserted after first page"));
  const second = await listFeedback(2, first.nextCursor!);
  assert.equal(new Set([...first.posts, ...second.posts].filter(p => created.some(r => r.receiptId === p.id)).map(p => p.id)).size, 3);
  assert.equal(second.posts.some(p => p.id === newer.receiptId), false);
  assert.equal(second.nextCursor, null);
  await assert.rejects(listFeedback(2, "bad!"), RangeError);
});

test("HTTP validates strict fields, size, whitespace, query and auth; no uncommitted success", async t => {
  const a = await player(t), b = await player(t);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const userId = req.header("x-test-user-id");
    (req as any).auth = Object.assign(() => ({ userId, sessionId: "test", tokenType: "session_token", isAuthenticated: !!userId }), { [Symbol.for("@clerk/express.auth")]: true });
    next();
  });
  app.use("/api", route);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const url = `http://127.0.0.1:${(server.address() as {port: number}).port}/api/events/feedback`;
  const post = (body: unknown, user = a) => fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-test-user-id": user }, body: JSON.stringify(body) });
  assert.equal((await fetch(url)).status, 401);
  assert.equal((await fetch(url, { method: "POST" })).status, 401);
  for (const invalid of [{ ...input(), clerkUserId: a }, { ...input(), displayName: "NEVER_LOG_FEEDBACK_SENTINEL_78a12" }, { ...input(), createdAt: new Date().toISOString() }, input(" "), input("a".repeat(2001)), { ...input(), category: "other" }]) {
    const response = await post(invalid);
    assert.equal(response.status, 400);
    assert.equal(JSON.stringify(await response.json()).includes("NEVER_LOG_FEEDBACK_SENTINEL_78a12"), false);
  }
  assert.equal((await fetch(`${url}?limit=1.5`, { headers: { "x-test-user-id": a } })).status, 400);
  assert.equal((await fetch(`${url}?cursor=bad!`, { headers: { "x-test-user-id": a } })).status, 400);
  const request = input("Shared NEVER_LOG_FEEDBACK_SENTINEL_78a12");
  const saved = await post(request);
  assert.equal(saved.status, 201);
  const savedReceipt = await saved.json() as { receiptId: string; post: Record<string, unknown>; replayed: boolean };
  assert.deepEqual(Object.keys(savedReceipt).sort(), ["post", "receiptId", "replayed"]);
  assert.deepEqual(Object.keys(savedReceipt.post).sort(), publicKeys);
  assert.equal((await post(request)).status, 200);
  assert.equal((await post({ ...request, message: "Changed" })).status, 409);
  const page = await (await fetch(url, { headers: { "x-test-user-id": b } })).json() as { posts: Record<string, unknown>[]; nextCursor: string | null };
  assert.deepEqual(Object.keys(page).sort(), ["nextCursor", "posts"]);
  assert.equal(page.posts.length, 1);
  assert.deepEqual(Object.keys(page.posts[0]).sort(), publicKeys);
  for (let i = 0; i < 4; i++) assert.equal((await post(input(`Next ${i}`))).status, 201);
  const limited = await post(input("Sixth"));
  assert.equal(limited.status, 429);
  const retrySeconds = Number(limited.headers.get("retry-after"));
  assert.ok(Number.isInteger(retrySeconds) && retrySeconds >= 1);
  assert.equal((await limited.json() as { retryAfterSeconds: number }).retryAfterSeconds, retrySeconds);
  const repeat = await post(request);
  assert.equal(repeat.status, 200);
  assert.equal((await repeat.json() as { receiptId: string }).receiptId, savedReceipt.receiptId);
  // Simulate storage unavailability only in the disposable owned cluster; restore
  // the table before the optional browser journey uses this same database.
  await db.execute(sql`ALTER TABLE event_feedback RENAME TO event_feedback_unavailable`);
  try {
    assert.equal((await post(input("Failed NEVER_LOG_FEEDBACK_SENTINEL_78a12"))).status, 503);
    assert.equal((await fetch(url, { headers: { "x-test-user-id": b } })).status, 503);
  } finally {
    await db.execute(sql`ALTER TABLE event_feedback_unavailable RENAME TO event_feedback`);
  }
});

test("real app origin gate blocks cross-origin writes without blocking same-session same-origin writes", async t => {
  const userId = await player(t);
  const app = createApp((req, _res, next) => {
    (req as any).auth = Object.assign(() => ({
      userId: req.header("x-test-user-id"), sessionId: "feedback-origin-test",
      tokenType: "session_token", isAuthenticated: true,
    }), { [Symbol.for("@clerk/express.auth")]: true });
    next();
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const url = `${origin}/api/events/feedback`;
  const request = input("Same session");
  const post = (requestOrigin: string) => fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", origin: requestOrigin, "x-test-user-id": userId },
    body: JSON.stringify(request),
  });
  assert.equal((await post("https://other.example")).status, 403);
  assert.equal((await db.select().from(feedback).where(eq(feedback.clerkUserId, userId))).length, 0);
  const accepted = await post(origin);
  assert.equal(accepted.status, 201);
  const receipt = await accepted.json() as { post: Record<string, unknown>; receiptId: string; replayed: boolean };
  assert.deepEqual(Object.keys(receipt).sort(), ["post", "receiptId", "replayed"]);
  assert.deepEqual(Object.keys(receipt.post).sort(), publicKeys);
  assert.equal((await db.select().from(feedback).where(eq(feedback.clerkUserId, userId))).length, 1);
});

test("feedback parser rejects malformed and oversized JSON without reflecting submitted text", async t => {
  const sentinel = "NEVER_LOG_FEEDBACK_SENTINEL_78a12";
  const app = createApp((_req, _res, next) => next());
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const url = `http://127.0.0.1:${(server.address() as {port: number}).port}/api/events/feedback`;
  for (const [body, status] of [[`{"message":"${sentinel}",`, 400], [JSON.stringify({ message: `${sentinel}${"x".repeat(120_000)}` }), 413]] as const) {
    const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body });
    assert.equal(response.status, status);
    assert.equal((await response.text()).includes(sentinel), false);
  }
});