import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { eq } from "drizzle-orm";
import { db, pool, playerProfilesTable as profiles, socialIdentitiesTable as identities } from "@workspace/db";
import { cardCatalog, starterRecipes } from "@workspace/squabblemon-engine/data";
import { homiesDiagnostics, homiesTransaction } from "./homiesDiagnosticsRuntime";
import type { HomiesDiagnosticEvent } from "./homiesDiagnosticsReporter";
import { logger } from "./logger";
import { accessFriendRoom, createFriendRoom } from "./onlineMatches";
import { getSocialState } from "./social";
import { lockSocial } from "./socialRoomGuard";

async function lease() { return pool.connect(); }
type PoolClient = Awaited<ReturnType<typeof lease>>;
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
async function beforeDeadline<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), 6000);
    })]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
async function until(check: () => Promise<boolean> | boolean, label: string) {
  await beforeDeadline((async () => {
    while (!(await check())) await delay(15);
  })(), label);
}

test("Homies diagnostic timings on owned native PostgreSQL", { skip: process.env.SOCIAL_TEST_OWNED !== "1" }, async t => {
  assert.equal(process.env.DATABASE_POOL_MAX, "5");
  assert.equal(process.env.HOMIES_DIAGNOSTICS_SAMPLE_RATE, "1");
  assert.equal(homiesDiagnostics.enabled, true);
  const version = (await pool.query<{ version: string }>("select version()")).rows[0].version;
  assert.match(version, /PostgreSQL/);
  assert.doesNotMatch(version, /PGlite/i);
  const a = await pool.connect(), b = await pool.connect();
  try {
    const firstPid = (await a.query<{ pid: number }>("select pg_backend_pid() as pid")).rows[0].pid;
    const secondPid = (await b.query<{ pid: number }>("select pg_backend_pid() as pid")).rows[0].pid;
    assert.notEqual(firstPid, secondPid, "lock and waiter require separate native backends");
  } finally {
    a.release();
    b.release();
  }

  const events: HomiesDiagnosticEvent[] = [];
  const capture = (value: unknown) => {
    if (value && typeof value === "object" && "event" in value && value.event === "homies_diagnostic")
      events.push(value as HomiesDiagnosticEvent);
  };
  t.mock.method(logger, "info", capture);
  t.mock.method(logger, "warn", capture);
  const userId = `diagnostics-${randomUUID()}`;
  const guestId = `diagnostics-${randomUUID()}`;
  const friendCode = randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase();
  const requestId = randomUUID();
  const errorMessage = `private-error-${randomUUID()}`;
  const credential = `private-credential-${randomUUID()}`;
  let roomCode = "";
  try {
    for (const id of [userId, guestId]) {
      await db.insert(profiles).values({ clerkUserId: id, displayName: credential,
        onboardingStep: "complete", ownedCardIds: cardCatalog.map(c => c.catalogId) });
    }
    await db.insert(identities).values({ userId, friendCode });
    const room = await createFriendRoom(userId, starterRecipes[0].id, requestId);
    roomCode = room.code;
    await accessFriendRoom(roomCode, guestId, { kind: "join", deckId: starterRecipes[0].id });

    await t.test("a joined-room read queues on all five leases, without social locking", async () => {
      const leases: Array<PoolClient | undefined> = [];
      let pending: Promise<unknown> | undefined;
      let borrowed: PoolClient | undefined;
      let originalQuery: PoolClient["query"] | undefined;
      const commands: string[] = [];
      try {
        for (let i = 0; i < 5; i++) leases.push(await pool.connect());
        assert.equal(pool.totalCount, 5);
        borrowed = leases[0]!;
        originalQuery = borrowed.query;
        // Observe only the client the queued service call will receive. No new
        // backend, query, or production hook is needed to inspect its SQL.
        borrowed.query = ((...args: unknown[]) => {
          const query = args[0] as string | { text?: string };
          commands.push(typeof query === "string" ? query : query?.text ?? "");
          return (originalQuery as (...args: unknown[]) => unknown).apply(borrowed, args);
        }) as PoolClient["query"];
        pending = accessFriendRoom(roomCode, guestId);
        await until(() => pool.waitingCount > 0, "joined room to queue for a lease");
        await delay(160);
        leases[0]!.release();
        leases[0] = undefined;
        await beforeDeadline(pending, "joined room after lease release");
        const event = [...events].reverse().find(e => e.category === "joined_room" && e.operation === "room_read");
        assert.ok(event, "joined-room warning must be emitted");
        assert.equal(event.outcome, "ok");
        assert.equal(event.transactions, 1);
        assert.equal(event.checkoutCount, 1);
        assert.equal(event.socialLockAttempts, 0);
        assert.ok(event.checkoutMaxMs >= 100);
        assert.ok(event.poolWaitingPeak >= 1);
        assert.ok(event.warnings.includes("checkout"));
        assert.deepEqual(commands.filter(command => /^(begin|commit|rollback)\b/i.test(command)),
          ["begin", "commit"], "joined read must retain its single existing transaction");
        assert.equal(commands.some(command => /pg_backend_pid|pg_locks|pg_stat_activity|pg_advisory/i.test(command)),
          false, "joined read must not add diagnostic probes or a social lock");
      } finally {
        if (borrowed && originalQuery) borrowed.query = originalQuery;
        for (const lease of leases) lease?.release();
        if (pending) await beforeDeadline(pending, "queued joined-room cleanup");
      }
    });

    await t.test("a menu waits on a real advisory-lock owner on another backend", async () => {
      const owner = await pool.connect(), observer = await pool.connect();
      let begun = false;
      let pending: Promise<unknown> | undefined;
      try {
        const ownerPid = (await owner.query<{ pid: number }>("select pg_backend_pid() as pid")).rows[0].pid;
        const observerPid = (await observer.query<{ pid: number }>("select pg_backend_pid() as pid")).rows[0].pid;
        assert.notEqual(ownerPid, observerPid);
        await owner.query("begin");
        begun = true;
        await owner.query("select pg_advisory_xact_lock(72613402)");
        pending = getSocialState(userId);
        await until(async () => {
          const result = await observer.query(
            "select 1 from pg_locks where locktype = 'advisory' and classid = 0 and objid = 72613402 and objsubid = 1 and not granted",
          );
          return (result.rowCount ?? 0) > 0;
        }, "menu to enter PostgreSQL advisory wait");
        await delay(160);
        await owner.query("rollback");
        begun = false;
        assert.equal((await beforeDeadline(pending, "menu after advisory release") as Awaited<ReturnType<typeof getSocialState>>).self.friendCode, friendCode);
        const event = [...events].reverse().find(e => e.category === "menu_refresh");
        assert.ok(event, "menu advisory-wait warning must be emitted");
        assert.equal(event.outcome, "ok");
        assert.equal(event.transactions, 1);
        assert.equal(event.checkoutCount, 1);
        assert.equal(event.socialLockAttempts, 1);
        assert.equal(event.socialLockAcquired, 1);
        assert.ok(event.socialLockWaitMaxMs >= 100);
        assert.ok(event.socialLockHoldTotalMs >= 0);
        assert.ok(event.warnings.includes("social_lock_wait"));
      } finally {
        if (begun) await owner.query("rollback");
        owner.release();
        observer.release();
        if (pending) await beforeDeadline(pending, "advisory-wait cleanup");
      }
    });

    await t.test("a rollback ends measured lock hold and releases the PostgreSQL lock", async () => {
      const thrown = new Error(errorMessage);
      await assert.rejects(homiesDiagnostics.operation("social_read", "lookup", () =>
        homiesTransaction(async tx => {
          await lockSocial(tx);
          await delay(160);
          throw thrown;
        })), error => error === thrown);
      const event = [...events].reverse().find(e => e.category === "social_read" && e.operation === "lookup");
      assert.ok(event, "rollback lock-hold warning must be emitted");
      assert.equal(event.outcome, "error");
      assert.equal(event.transactions, 1);
      assert.equal(event.checkoutCount, 1);
      assert.equal(event.socialLockAttempts, 1);
      assert.equal(event.socialLockAcquired, 1);
      assert.ok(event.socialLockHoldMaxMs >= 100);
      assert.ok(event.warnings.includes("social_lock_hold"));
      const observer = await pool.connect();
      try {
        await observer.query("begin");
        try {
          const acquired = await observer.query<{ acquired: boolean }>(
            "select pg_try_advisory_xact_lock(72613402) as acquired",
          );
          assert.equal(acquired.rows[0].acquired, true, "rollback must release the transaction lock");
        } finally {
          await observer.query("rollback");
        }
      } finally {
        observer.release();
      }
    });

    assert.ok(events.length >= 3);
    const serialized = JSON.stringify(events);
    for (const secret of [userId, guestId, friendCode, roomCode, requestId, errorMessage, credential])
      assert.equal(serialized.includes(secret), false, "diagnostic records must contain only allowlisted scalars");
    for (const event of events) {
      assert.equal(event.event, "homies_diagnostic");
      assert.equal(event.sampleRate, 1);
      assert.deepEqual(Object.keys(event).sort(), [
        "category", "checkoutCount", "checkoutErrors", "checkoutMaxMs", "checkoutTotalMs", "event",
        "operation", "operationMs", "outcome", "poolWaitingPeak", "retries", "sampleRate",
        "schemaVersion", "socialLockAcquired", "socialLockAttempts", "socialLockHoldMaxMs",
        "socialLockHoldTotalMs", "socialLockWaitMaxMs", "socialLockWaitTotalMs",
        "suppressedNormal", "suppressedWarnings", "transactions", "warnings",
      ].sort());
    }
  } finally {
    t.mock.restoreAll();
    await db.delete(profiles).where(eq(profiles.clerkUserId, guestId));
    await db.delete(profiles).where(eq(profiles.clerkUserId, userId));
  }
});