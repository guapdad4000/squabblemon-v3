import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { and, eq, sql } from "drizzle-orm";
import { db, pool, playerProfilesTable as profiles, socialIdentitiesTable as identities,
  socialRelationshipsTable as relations, socialInvitationsTable as invitations, socialThrottleTable as throttle, onlineRoomsTable as rooms } from "@workspace/db";
import { cardCatalog, starterRecipes } from "@workspace/squabblemon-engine/data";
import { createApp } from "../app";
import { identityViews } from "./socialIdentity";
import { lockSocial } from "./socialRoomGuard";

test("Homies authenticated routes on owned native PostgreSQL", { skip: process.env.SOCIAL_TEST_OWNED !== "1" }, async t => {
  assert.equal(process.env.DATABASE_POOL_MAX, "5");
  const version = await pool.query("select version()");
  assert.match(version.rows[0].version, /PostgreSQL/);
  assert.doesNotMatch(version.rows[0].version, /PGlite/i);
  const server = createApp((req, _res, next) => {
    const userId = typeof req.headers["x-test-user"] === "string" ? req.headers["x-test-user"] : null;
    const auth = Object.assign(() => ({ userId, sessionId: userId ? "test-session" : null, tokenType: "session_token",
      isAuthenticated: !!userId, sessionClaims: userId ? { sub: userId } : null }), { [Symbol.for("@clerk/express.auth")]: true });
    Object.assign(req, { auth }); next();
  }).listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const users: string[] = [];
  const deckId = starterRecipes[0].id;
  async function request(user: string | null, path: string, body?: unknown, method = body === undefined ? "GET" : "POST") {
    const response = await fetch(base + path, { method,
      headers: { ...(user ? { "x-test-user": user } : {}), "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
    return { status: response.status, data: await response.json() as Record<string, any> };
  }
  async function ok(user: string, path: string, body?: unknown) {
    const result = await request(user, path, body);
    assert.equal(result.status, 200, `${path}: ${JSON.stringify(result.data)}`);
    return result.data;
  }
  async function player() {
    const id = `social-test-${randomUUID()}`; users.push(id);
    await db.insert(profiles).values({ clerkUserId: id, displayName: "Duplicate Name", onboardingStep: "complete",
      ownedCardIds: cardCatalog.map(c => c.catalogId), softCurrency: 1234, inbox: [{ id: "preserved-reward" }] });
    const state = await ok(id, "/social");
    return { id, code: state.self.friendCode };
  }
  async function friends() {
    const a = await player(), b = await player();
    const sent = await ok(a.id, "/social/requests", { friendCode: b.code });
    await ok(b.id, `/social/requests/${sent.outgoingRequests[0].id}/respond`, { action: "accept" });
    return { a, b };
  }
  async function invite(a: { id: string }, b: { code: string }) {
    return ok(a.id, "/social/invitations", { friendCode: b.code, deckId, requestId: randomUUID() });
  }
  async function lease() { return pool.connect(); }
  type LockClient = Awaited<ReturnType<typeof lease>>;
  // Reserve two of the five pool leases for a real PostgreSQL lock owner and observer.
  // HTTP requests must execute on another backend, not on the lock owner's session.
  async function withHeldLock(
    lock: (owner: LockClient) => Promise<void>,
    run: (observer: LockClient) => Promise<void>,
  ) {
    const owner = await lease();
    let observer: LockClient | undefined;
    let begun = false;
    try {
      observer = await lease();
      const ownerPid = (await owner.query<{ pid: number }>("select pg_backend_pid() as pid")).rows[0].pid;
      const observerPid = (await observer.query<{ pid: number }>("select pg_backend_pid() as pid")).rows[0].pid;
      assert.notEqual(ownerPid, observerPid, "lock owner and observer need distinct native backends");
      await owner.query("begin");
      begun = true;
      await lock(owner);
      await run(observer);
    } finally {
      if (begun) await owner.query("rollback").finally(() => { owner.release(); observer?.release(); });
      else { owner.release(); observer?.release(); }
    }
  }
  async function beforeDeadline<T>(promise: Promise<T>, label: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    try {
      return await Promise.race([promise, new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), 6000);
      })]);
    } finally {
      clearTimeout(timer!);
    }
  }
  async function observeWait(
    observer: LockClient,
    pending: Promise<unknown>,
    label: string,
    lockType: "advisory" | "room",
  ) {
    let settled = false;
    void pending.then(() => { settled = true; }, () => { settled = true; });
    await beforeDeadline((async () => {
      while (true) {
        assert.equal(settled, false, `${label} finished before waiting on the database lock`);
        const { rows } = await observer.query<{ pid: number }>(
          lockType === "advisory"
            ? `select pid from pg_locks where locktype = 'advisory' and classid = 0 and objid = 72613402 and objsubid = 1 and not granted`
            : `select l.pid from pg_locks l join pg_stat_activity a on a.pid = l.pid
               where not l.granted and l.locktype in ('transactionid', 'tuple')
               and a.query ilike '%online_rooms%'`,
        );
        if (rows.length) {
          assert.equal(settled, false, `${label} completed while still observed waiting`);
          return;
        }
        await new Promise<void>(resolve => setTimeout(resolve, 15));
      }
    })(), `${label} to enter a PostgreSQL ${lockType} lock wait`);
  }
  try {
    await t.test("legacy 100-person identity allocation is batched and stable", async () => {
      const ids = Array.from({ length: 100 }, () => `social-test-${randomUUID()}`);
      users.push(...ids);
      await db.insert(profiles).values(ids.map(clerkUserId => ({ clerkUserId, displayName: "Legacy Public Name" })));
      let queries = 0;
      const views = await db.transaction(async tx => {
        await lockSocial(tx);
        const counted = new Proxy(tx, { get(target, key) {
          const value = Reflect.get(target, key);
          if (typeof value !== "function") return value;
          return (...args: unknown[]) => {
            if (["select", "insert", "update"].includes(String(key))) queries++;
            return value.apply(target, args);
          };
        } });
        return identityViews(counted, ids);
      });
      assert.equal(views.size, 100);
      assert.equal(new Set([...views.values()].map(p => p.username)).size, 100);
      assert.ok(queries <= 5, `allocation should remain batched, received ${queries} queries`);
      await db.update(profiles).set({ displayName: "Changed Display Name" }).where(sql`${profiles.clerkUserId} in (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`);
      const again = await db.transaction(async tx => { await lockSocial(tx); return identityViews(tx, ids); });
      assert.deepEqual([...again.values()].map(p => p.username).sort(), [...views.values()].map(p => p.username).sort());
    });
    await t.test("Fadebook handles, concurrent claims, bounded private search and durable opponents", async () => {
      const a = await player(), b = await player(), c = await player();
      const rename = (id: string, username: string) => request(id, "/social/username", { username }, "PATCH");
      const before = (await ok(a.id, "/social")).self;
      const second = (await ok(b.id, "/social")).self;
      assert.notEqual(before.username, second.username);
      await db.update(identities).set({ username: null }).where(eq(identities.userId, b.id));
      assert.equal((await ok(a.id, `/social/lookup/${b.code}`)).player.friendCode, b.code);
      assert.ok((await ok(b.id, "/social")).self.username);
      assert.equal(typeof before.lastActiveAt, "string");
      for (const username of ["ab", "a-b", "éclair", "admin", "a".repeat(25), "@@abc"]) {
        assert.equal((await rename(a.id, username)).status, 400);
      }
      const claim = "claim_" + randomUUID().replaceAll("-", "").slice(0, 12);
      const claims = await Promise.all([rename(a.id, claim), rename(b.id, claim.toUpperCase())]);
      assert.deepEqual(claims.map(r => r.status).sort(), [200, 409]);
      const owner = claims[0].status === 200 ? a : b;
      assert.equal((await rename(owner.id, ` @${claim.toUpperCase()} `)).status, 200);
      assert.equal((await rename(c.id, claim + "z")).status, 200);
      assert.equal((await ok(c.id, `/social/search?query=${claim}`)).players[0].player.friendCode, owner.code);
      assert.equal((await ok(c.id, "/social/search?query=___")).players.length, 0);
      await db.update(profiles).set({ displayName: "Different Public Name" }).where(eq(profiles.clerkUserId, owner.id));
      assert.equal((await ok(owner.id, "/social")).self.username, claim);
      assert.equal((await ok(c.id, `/social/lookup/${owner.code}`)).player.username, claim);
      const sent = await ok(c.id, "/social/requests", { friendCode: owner.code });
      assert.equal((await ok(c.id, `/social/search?query=@${claim.toUpperCase()}`)).players[0].requestId, sent.outgoingRequests[0].id);
      await ok(owner.id, `/social/requests/${sent.outgoingRequests[0].id}/respond`, { action: "accept" });
      assert.equal((await rename(owner.id, claim + "_x")).status, 200);
      assert.equal((await ok(c.id, "/social")).homies[0].friendCode, owner.code);
      assert.equal((await ok(owner.id, `/social/search?query=${claim}`)).players.some((p: any) => p.player.friendCode === owner.code), false);
      assert.equal((await request(c.id, "/social/search?query=ab")).status, 400);
      assert.equal((await request(null, "/social/search?query=abc")).status, 401);
      for (let i = 0; i < 14; i++) await player();
      assert.equal((await ok(c.id, "/social/search?query=duplicate")).players.length, 12);
      const invitation = await invite(c, owner);
      await ok(owner.id, `/social/invitations/${invitation.id}/respond`, { action: "accept", deckId });
      const path = `/social/match-opponent/${invitation.roomCode}`;
      const outsider = await player();
      assert.equal((await request(outsider.id, path)).status, 403);
      assert.equal((await ok(c.id, path)).opponent.player.friendCode, owner.code);
      const room = await ok(owner.id, `/multiplayer/${invitation.roomCode}`);
      await ok(owner.id, `/multiplayer/${invitation.roomCode}/actions`, { requestId: randomUUID(), expectedRevision: room.revision, command: { type: "surrender" } });
      assert.equal((await ok(c.id, path)).opponent.player.friendCode, owner.code);
      await ok(owner.id, "/social/blocks", { friendCode: c.code });
      assert.equal((await ok(c.id, path)).opponent, null);
      assert.equal((await ok(c.id, `/social/search?query=${claim}`)).players.length, 0);
      assert.equal((await ok(owner.id, "/social/search?query=duplicate")).players.some((p: any) => p.player.friendCode === c.code), false);
      const [stored] = await db.select().from(rooms).where(eq(rooms.code, invitation.roomCode));
      const state = stored.state as any;
      await db.update(rooms).set({ state: { ...state, ranked: { bot: true } } }).where(eq(rooms.id, stored.id));
      await ok(owner.id, `/social/blocks/${c.code}/remove`, {});
      assert.equal((await ok(c.id, path)).opponent, null);
      await db.update(rooms).set({ state: { ...state, status: "complete" } }).where(eq(rooms.id, stored.id));
      assert.equal((await ok(c.id, path)).opponent.player.friendCode, owner.code);
      await db.update(rooms).set({ state: { ...state, members: { player: state.members.player } } }).where(eq(rooms.id, stored.id));
      assert.equal((await ok(c.id, path)).opponent, null);
    });
    await t.test("unauthenticated, minimal stable exact identity, duplicate/crossed requests and persistence", async () => {
      assert.equal((await request(null, "/social")).status, 401);
      const a = await player(), b = await player(), c = await player();
      const self = (await ok(a.id, "/social")).self;
      assert.deepEqual(Object.keys(self).sort(), ["avatarKey", "displayName", "friendCode", "lastActiveAt", "username"]);
      assert.match(self.friendCode, /^[A-F0-9]{12}$/);
      assert.equal((await ok(a.id, `/social/lookup/%20${b.code.toLowerCase()}%20`)).player.friendCode, b.code);
      assert.equal((await request(a.id, "/social/requests", { friendCode: a.code })).status, 400);
      assert.equal((await request(a.id, "/social/requests", { friendCode: b.code, userId: c.id })).status, 400);
      const results = await Promise.all([ok(a.id, "/social/requests", { friendCode: b.code }), ok(a.id, "/social/requests", { friendCode: b.code })]);
      const id = results[0].outgoingRequests[0].id;
      assert.equal(results[1].outgoingRequests[0].id, id);
      assert.equal((await request(b.id, "/social/requests", { friendCode: a.code })).status, 409);
      assert.equal((await request(c.id, `/social/requests/${id}/respond`, { action: "accept" })).status, 404);
      assert.equal((await request(a.id, `/social/requests/${id}/respond`, { action: "accept" })).status, 404);
      await Promise.all([ok(b.id, `/social/requests/${id}/respond`, { action: "accept" }), ok(b.id, `/social/requests/${id}/respond`, { action: "accept" })]);
      assert.equal((await ok(a.id, "/social")).homies[0].friendCode, b.code);
      await db.update(profiles).set({ displayName: "Renamed" }).where(eq(profiles.clerkUserId, b.id));
      assert.equal((await ok(a.id, "/social")).homies[0].displayName, "Renamed");
      assert.equal((await ok(b.id, "/social")).self.friendCode, b.code);
      const [saved] = await db.select().from(profiles).where(eq(profiles.clerkUserId, a.id));
      assert.equal(saved.softCurrency, 1234); assert.deepEqual(saved.inbox, [{ id: "preserved-reward" }]);
    });
    await t.test("targeted invitation atomic retries, all code bypasses, legal decks, joined reconnect and ordinary rooms", async () => {
      const { a, b } = await friends(), c = await player();
      const requestId = randomUUID();
      const sent = await Promise.all([ok(a.id, "/social/invitations", { friendCode: b.code, deckId, requestId }), ok(a.id, "/social/invitations", { friendCode: b.code, deckId, requestId })]);
      assert.equal(sent[0].id, sent[1].id); const inv = sent[0];
      assert.equal((await request(c.id, `/social/invitations/${inv.id}`)).status, 404);
      assert.equal((await request(c.id, `/multiplayer/${inv.roomCode}`)).status, 404);
      assert.equal((await request(c.id, `/multiplayer/${inv.roomCode}/join`, { deckId })).status, 404);
      assert.equal((await request(c.id, `/multiplayer/${inv.roomCode}/actions`, { requestId: randomUUID(), expectedRevision: 0, command: { type: "rematch" } })).status, 404);
      assert.equal((await request(b.id, `/social/invitations/${inv.id}/respond`, { action: "accept", deckId: "illegal" })).status, 400);
      assert.equal((await request(a.id, `/social/invitations/${inv.id}/respond`, { action: "accept", deckId })).status, 404);
      const joined = await Promise.all([ok(b.id, `/social/invitations/${inv.id}/respond`, { action: "accept", deckId }), ok(b.id, `/multiplayer/${inv.roomCode}/join`, { deckId })]);
      assert.equal(joined[0].status, "accepted");
      await ok(a.id, "/social/blocks", { friendCode: b.code });
      await ok(b.id, `/multiplayer/${inv.roomCode}`);
      await ok(b.id, `/multiplayer/${inv.roomCode}/join`, { deckId });
      let view = await ok(a.id, `/multiplayer/${inv.roomCode}`);
      view = await ok(a.id, `/multiplayer/${inv.roomCode}/actions`, { requestId: randomUUID(), expectedRevision: view.revision, command: { type: "ready" } });
      await ok(b.id, `/multiplayer/${inv.roomCode}/actions`, { requestId: randomUUID(), expectedRevision: view.revision, command: { type: "ready" } });
      const ordinary = await request(c.id, "/multiplayer", { deckId, requestId: randomUUID() });
      assert.equal(ordinary.status, 201);
      await ok(a.id, `/multiplayer/${ordinary.data.code}/join`, { deckId });
      assert.equal((await ok(a.id, `/social/invitations/${inv.id}`)).status, "accepted");
    });
    await t.test("remove/block races cannot leave pending seats claimable", async () => {
      for (const operation of ["remove", "block"] as const) {
        const { a, b } = await friends(); const inv = await invite(a, b);
        const mutation = operation === "block" ? "/social/blocks" : `/social/homies/${b.code}/remove`;
        await Promise.all([request(b.id, `/social/invitations/${inv.id}/respond`, { action: "accept", deckId }),
          ok(a.id, mutation, operation === "block" ? { friendCode: b.code } : {})]);
        const receipt = await ok(a.id, `/social/invitations/${inv.id}`);
        assert.ok(["accepted", "unavailable"].includes(receipt.status));
        const join = await request(b.id, `/multiplayer/${inv.roomCode}/join`, { deckId });
        assert.equal(join.status, receipt.status === "accepted" ? 200 : 409);
        assert.equal((await ok(a.id, "/social")).homies.length, 0);
        if (operation === "block") {
          assert.equal((await request(b.id, `/social/lookup/${a.code}`)).status, 404);
          assert.equal((await request(b.id, "/social/requests", { friendCode: a.code })).status, 404);
          await ok(a.id, `/social/blocks/${b.code}/remove`, {});
          assert.equal((await ok(a.id, "/social")).homies.length, 0);
        }
      }
    });
    await t.test("accept/cancel races, terminal retries, expiry and host room cancellation", async () => {
      const { a, b } = await friends(); const inv = await invite(a, b);
      await Promise.all([ok(b.id, `/social/invitations/${inv.id}/respond`, { action: "accept", deckId }),
        ok(a.id, `/social/invitations/${inv.id}/respond`, { action: "cancel" })]);
      const receipt = await ok(a.id, `/social/invitations/${inv.id}`);
      assert.ok(["accepted", "cancelled"].includes(receipt.status));
      assert.equal((await ok(a.id, `/social/invitations/${inv.id}/respond`, { action: "cancel" })).status, receipt.status);
      const f = await friends(); const exp = await invite(f.a, f.b);
      await db.update(invitations).set({ expiresAt: new Date(Date.now() - 1) }).where(eq(invitations.id, exp.id));
      assert.equal((await ok(f.b.id, `/social/invitations/${exp.id}/respond`, { action: "accept", deckId })).status, "expired");
      assert.equal((await request(f.b.id, `/multiplayer/${exp.roomCode}/join`, { deckId })).status, 409);
      const g = await friends(); const close = await invite(g.a, g.b);
      const room = await ok(g.a.id, `/multiplayer/${close.roomCode}`);
      await ok(g.a.id, `/multiplayer/${close.roomCode}/actions`, { requestId: randomUUID(), expectedRevision: room.revision, command: { type: "surrender" } });
      assert.equal((await ok(g.b.id, `/social/invitations/${close.id}`)).status, "cancelled");
      assert.equal((await request(g.b.id, `/multiplayer/${close.roomCode}/join`, { deckId })).status, 409);
    });
    await t.test("durable lookup throttle and resend cooldown survive separate connections", async () => {
      const a = await player(), b = await player();
      const sent = await ok(a.id, "/social/requests", { friendCode: b.code });
      await ok(b.id, `/social/requests/${sent.outgoingRequests[0].id}/respond`, { action: "decline" });
      assert.equal((await request(a.id, "/social/requests", { friendCode: b.code })).status, 429);
      const results = await Promise.all(Array.from({ length: 34 }, () => request(a.id, "/social/lookup/FFFFFFFFFFFF")));
      assert.equal(results.filter(r => r.status === 429).length, 4);
      const [stored] = await db.select().from(throttle).where(and(eq(throttle.userId, a.id), eq(throttle.action, "lookup")));
      assert.equal(stored.count, 34);
      await db.update(throttle).set({ windowAt: new Date(Date.now() - 61000) }).where(eq(throttle.userId, a.id));
      assert.equal((await request(a.id, `/social/lookup/${b.code}`)).status, 200);
    });
    await t.test("stale request IDs cannot accept a new send; concurrent crossed send and cancel stay explicit", async () => {
      const a = await player(), b = await player();
      const crossed = await Promise.all([request(a.id, "/social/requests", { friendCode: b.code }), request(b.id, "/social/requests", { friendCode: a.code })]);
      assert.deepEqual(crossed.map(r => r.status).sort(), [200, 409]);
      const sender = crossed[0].status === 200 ? a : b, recipient = sender === a ? b : a;
      const first = (await ok(sender.id, "/social")).outgoingRequests[0].id;
      const race = await Promise.all([request(sender.id, `/social/requests/${first}/respond`, { action: "cancel" }),
        request(recipient.id, `/social/requests/${first}/respond`, { action: "accept" })]);
      assert.deepEqual(race.map(r => r.status).sort(), [200, 409]);
      const current = await ok(sender.id, "/social");
      if (current.homies.length) await ok(sender.id, `/social/homies/${recipient.code}/remove`, {});
      await db.update(relations).set({ updatedAt: new Date(Date.now() - 61000) }).where(eq(relations.id, first));
      const sent = await ok(sender.id, "/social/requests", { friendCode: recipient.code });
      assert.notEqual(sent.outgoingRequests[0].id, first);
      assert.equal((await request(recipient.id, `/social/requests/${first}/respond`, { action: "accept" })).status, 404);
      assert.equal((await ok(recipient.id, "/social")).homies.length, 0);
    });
    await t.test("direct code join races with block and invitation decline is idempotent", async () => {
      const { a, b } = await friends(); const inv = await invite(a, b);
      await Promise.all([request(b.id, `/multiplayer/${inv.roomCode}/join`, { deckId }),
        ok(a.id, "/social/blocks", { friendCode: b.code })]);
      const receipt = await ok(b.id, `/social/invitations/${inv.id}`);
      assert.ok(["accepted", "unavailable"].includes(receipt.status));
      const f = await friends(); const declined = await invite(f.a, f.b);
      await ok(f.b.id, `/social/invitations/${declined.id}/respond`, { action: "decline" });
      assert.equal((await ok(f.b.id, `/social/invitations/${declined.id}/respond`, { action: "decline" })).status, "declined");
      assert.equal((await request(f.b.id, `/multiplayer/${declined.roomCode}/join`, { deckId })).status, 409);
      assert.equal((await request(f.a.id, "/social/invitations", { friendCode: f.b.code, deckId, requestId: randomUUID() })).status, 429);
      assert.equal((await ok(f.b.id, "/social")).counts.invitations, 0);
    });
    await t.test("joined ordinary and targeted rooms bypass a held global social lock", async () => {
      const { a, b } = await friends(), stranger = await player();
      const ordinary = await request(a.id, "/multiplayer", { deckId, requestId: randomUUID() });
      assert.equal(ordinary.status, 201);
      await ok(b.id, `/multiplayer/${ordinary.data.code}/join`, { deckId });
      const targeted = await invite(a, b);
      await ok(b.id, `/multiplayer/${targeted.roomCode}/join`, { deckId });
      await withHeldLock(
        async owner => { await owner.query("select pg_advisory_xact_lock(72613402)"); },
        async observer => {
          const { rows } = await observer.query(
            `select pid from pg_locks where locktype = 'advisory' and classid = 0
             and objid = 72613402 and objsubid = 1 and granted`,
          );
          assert.equal(rows.length, 1, "global social lock stays held during all joined requests");
          for (const code of [ordinary.data.code, targeted.roomCode]) {
            const path = `/multiplayer/${code}`;
            const first = await beforeDeadline(ok(b.id, path), `${code} joined read`);
            await beforeDeadline(ok(b.id, `${path}/join`, { deckId }), `${code} joined rejoin`);
            const ready = await beforeDeadline(ok(a.id, `${path}/actions`, {
              requestId: randomUUID(), expectedRevision: first.revision, command: { type: "ready" },
            }), `${code} joined ready command`);
            assert.equal(ready.revision, first.revision + 1);
            await beforeDeadline(ok(b.id, `${path}/actions`, {
              requestId: randomUUID(), expectedRevision: ready.revision, command: { type: "ready" },
            }), `${code} second joined ready command`);
          }
        },
      );
      assert.equal((await request(stranger.id, `/multiplayer/${targeted.roomCode}`)).status, 404);
      assert.equal((await request(stranger.id, `/multiplayer/${targeted.roomCode}/join`, { deckId })).status, 404);
    });
    await t.test("unclaimed targeted joins and social mutations wait for the global lock", async () => {
      for (const operation of ["join", "invitation", "remove", "block"] as const) {
        const { a, b } = await friends();
        const pendingInvite = operation === "invitation" ? undefined : await invite(a, b);
        let pending!: Promise<{ status: number; data: Record<string, any> }>;
        await withHeldLock(
          async owner => { await owner.query("select pg_advisory_xact_lock(72613402)"); },
          async observer => {
            pending = operation === "join"
              ? request(b.id, `/multiplayer/${pendingInvite!.roomCode}/join`, { deckId })
              : operation === "invitation"
                ? request(a.id, "/social/invitations", { friendCode: b.code, deckId, requestId: randomUUID() })
                : operation === "remove"
                  ? request(a.id, `/social/homies/${b.code}/remove`, {})
                  : request(a.id, "/social/blocks", { friendCode: b.code });
            await observeWait(observer, pending, `${operation} mutation`, "advisory");
          },
        );
        const result = await beforeDeadline(pending, `${operation} after social lock release`);
        assert.equal(result.status, 200, `${operation}: ${JSON.stringify(result.data)}`);
        if (operation === "join") {
          assert.equal((await ok(a.id, `/social/invitations/${pendingInvite!.id}`)).status, "accepted");
        } else if (operation === "remove" || operation === "block") {
          assert.equal((await ok(a.id, `/social/invitations/${pendingInvite!.id}`)).status, "unavailable");
          assert.equal((await request(b.id, `/multiplayer/${pendingInvite!.roomCode}/join`, { deckId })).status, 409);
        } else {
          assert.equal(result.data.status, "pending");
        }
      }
    });
    await t.test("joined commands still serialize on their room row, independently of the global lock", async () => {
      const { a, b } = await friends(), targeted = await invite(a, b);
      await ok(b.id, `/multiplayer/${targeted.roomCode}/join`, { deckId });
      const path = `/multiplayer/${targeted.roomCode}`;
      const before = await ok(a.id, path);
      let pending!: Promise<{ status: number; data: Record<string, any> }>;
      await withHeldLock(
        async owner => {
          const { rows } = await owner.query("select id from online_rooms where code = $1 for update", [targeted.roomCode]);
          assert.equal(rows.length, 1);
        },
        async observer => {
          pending = request(a.id, `${path}/actions`, {
            requestId: randomUUID(), expectedRevision: before.revision, command: { type: "ready" },
          });
          await observeWait(observer, pending, "joined ready command", "room");
        },
      );
      const result = await beforeDeadline(pending, "joined ready after row release");
      assert.equal(result.status, 200, JSON.stringify(result.data));
      assert.equal(result.data.revision, before.revision + 1);
      assert.equal((await ok(b.id, path)).revision, result.data.revision);
    });
    await t.test("terminal invitation menus do not wait for their room row, but pending receipts do", async () => {
      for (const action of ["decline", "cancel"] as const) {
        const { a, b } = await friends(), receipt = await invite(a, b);
        await ok(action === "decline" ? b.id : a.id, `/social/invitations/${receipt.id}/respond`, { action });
        await withHeldLock(
          async owner => {
            const { rows } = await owner.query("select id from online_rooms where code = $1 for update", [receipt.roomCode]);
            assert.equal(rows.length, 1);
          },
          async () => {
            const menu = await beforeDeadline(ok(a.id, "/social"), `${action} terminal menu while room is locked`);
            const terminal = menu.invitations.find((inv: { id: string }) => inv.id === receipt.id);
            assert.ok(terminal, "terminal receipt must remain visible");
            assert.equal(terminal.status, action === "decline" ? "declined" : "cancelled");
            assert.equal(terminal.roomCode, receipt.roomCode);
            assert.deepEqual(Object.keys(terminal).sort(), ["direction", "expiresAt", "id", "player", "roomCode", "status"]);
            assert.deepEqual(Object.keys(terminal.player).sort(), ["avatarKey", "displayName", "friendCode", "lastActiveAt", "username"]);
            assert.deepEqual(Object.keys(menu.self).sort(), ["avatarKey", "displayName", "friendCode", "lastActiveAt", "username"]);
          },
        );
      }
      const { a, b } = await friends(), pendingReceipt = await invite(a, b);
      let pending!: Promise<Record<string, any>>;
      await withHeldLock(
        async owner => {
          await owner.query("select id from online_rooms where code = $1 for update", [pendingReceipt.roomCode]);
        },
        async observer => {
          pending = ok(a.id, "/social");
          await observeWait(observer, pending, "pending invitation menu", "room");
        },
      );
      const menu = await beforeDeadline(pending, "pending invitation menu after row release");
      assert.equal(menu.invitations.find((inv: { id: string }) => inv.id === pendingReceipt.id)?.status, "pending");
    });
    await t.test("stale joined hint retries global-first after a seat is removed under the room lock", async () => {
      const { a, b } = await friends(), receipt = await invite(a, b);
      await ok(b.id, `/multiplayer/${receipt.roomCode}/join`, { deckId });
      const roomOwner = await lease();
      let socialOwner: LockClient | undefined;
      let observer: LockClient | undefined;
      let roomTransaction = false, socialTransaction = false;
      let pending: Promise<{ status: number; data: Record<string, any> }> | undefined;
      try {
        socialOwner = await lease();
        observer = await lease();
        const pids = await Promise.all([roomOwner, socialOwner, observer].map(async client =>
          (await client.query<{ pid: number }>("select pg_backend_pid() as pid")).rows[0].pid));
        assert.equal(new Set(pids).size, 3, "room owner, social owner and observer need separate backends");
        await roomOwner.query("begin");
        roomTransaction = true;
        const { rows } = await roomOwner.query("select id from online_rooms where code = $1 for update", [receipt.roomCode]);
        assert.equal(rows.length, 1);
        pending = request(b.id, `/multiplayer/${receipt.roomCode}/join`, { deckId });
        await observeWait(observer, pending, "joined rejoin awaiting old room row", "room");
        // Simulate future seat-changing code, which current rematch commands do not do.
        await roomOwner.query(
          `update online_rooms set state = jsonb_set(jsonb_set(state, '{members,cpu}', 'null'::jsonb),
           '{status}', '"closed"'::jsonb), guest_user_id = null, expires_at = now() where code = $1`,
          [receipt.roomCode],
        );
        await roomOwner.query("update social_invitations set status = 'unavailable' where id = $1", [receipt.id]);
        await socialOwner.query("begin");
        socialTransaction = true;
        await socialOwner.query("select pg_advisory_xact_lock(72613402)");
        await roomOwner.query("commit");
        roomTransaction = false;
        await observeWait(observer, pending, "stale hint global-first retry", "advisory");
        const { rows: waiting } = await observer.query<{ pid: number }>(
          `select pid from pg_locks where locktype = 'advisory' and classid = 0
           and objid = 72613402 and objsubid = 1 and not granted`,
        );
        assert.equal(waiting.length, 1);
        const { rows: heldRoomLocks } = await observer.query(
          `select 1 from pg_locks where pid = $1 and relation = 'online_rooms'::regclass
           and mode = 'RowShareLock' and granted`, [waiting[0].pid],
        );
        assert.equal(heldRoomLocks.length, 0, "retry must release the row lock before waiting for social");
        await socialOwner.query("rollback");
        socialTransaction = false;
        const denied = await beforeDeadline(pending, "stale joined rejoin after global release");
        assert.equal(denied.status, 409, JSON.stringify(denied.data));
        assert.equal((await ok(a.id, `/social/invitations/${receipt.id}`)).status, "unavailable");
      } finally {
        if (roomTransaction) await roomOwner.query("rollback").finally(() => roomOwner.release());
        else roomOwner.release();
        if (socialOwner) {
          const owner = socialOwner;
          if (socialTransaction) await owner.query("rollback").finally(() => owner.release());
          else owner.release();
        }
        observer?.release();
        if (pending) await beforeDeadline(pending, "stale rejoin cleanup").catch(() => undefined);
      }
    });
    await t.test("normal room creation competes atomically with invitation for the last hosted slot", async () => {
      const { a, b } = await friends();
      for (let i = 0; i < 4; i++) {
        assert.equal((await request(a.id, "/multiplayer", { deckId, requestId: randomUUID() })).status, 201);
      }
      const [ordinary, targeted] = await Promise.all([
        request(a.id, "/multiplayer", { deckId, requestId: randomUUID() }),
        request(a.id, "/social/invitations", { friendCode: b.code, deckId, requestId: randomUUID() }),
      ]);
      assert.ok((ordinary.status === 201 && targeted.status === 429) ||
        (ordinary.status === 429 && targeted.status === 200),
        `normal: ${JSON.stringify(ordinary.data)}, invitation: ${JSON.stringify(targeted.data)}`);
      const { rows } = await pool.query<{ count: string }>(
        `select count(*)::text as count from online_rooms where host_user_id = $1
         and expires_at > now() and state->>'status' in ('waiting', 'active')`, [a.id],
      );
      assert.equal(Number(rows[0].count), 5);
    });
    await t.test("pending and homie limits are enforced atomically and lists bounded", async () => {
      const a = await player(), b = await player();
      const fixtures = Array.from({ length: 100 }, () => `social-test-${randomUUID()}`);
      users.push(...fixtures);
      await db.insert(profiles).values(fixtures.map(clerkUserId => ({ clerkUserId })));
      await db.insert(relations).values(fixtures.slice(0, 30).map(other => ({
        low: a.id < other ? a.id : other, high: a.id < other ? other : a.id, sender: a.id, status: "pending",
      })));
      assert.equal((await request(a.id, "/social/requests", { friendCode: b.code })).status, 429);
      const state = await ok(a.id, "/social");
      assert.equal(state.outgoingRequests.length, 30);
      await db.update(relations).set({ status: "homie" }).where(orPair(a.id));
      await db.insert(relations).values(fixtures.slice(30).map(other => ({
        low: a.id < other ? a.id : other, high: a.id < other ? other : a.id, sender: a.id, status: "homie",
      })));
      assert.equal((await request(b.id, "/social/requests", { friendCode: a.code })).status, 429);
      assert.equal((await ok(a.id, "/social")).homies.length, 100);
    });
    await t.test("mutate throttle counts failures across independent requests", async () => {
      const a = await player();
      const results = await Promise.all(Array.from({ length: 43 }, () => request(a.id, "/social/requests", { friendCode: a.code })));
      assert.equal(results.filter(r => r.status === 400).length, 40);
      assert.equal(results.filter(r => r.status === 429).length, 3);
    });
    await t.test("deleted invitation parties cannot turn targeted rooms into ordinary rooms", async () => {
      const { a, b } = await friends(), stranger = await player();
      const pending = await invite(a, b);
      await db.delete(profiles).where(eq(profiles.clerkUserId, b.id));
      assert.equal((await request(stranger.id, `/multiplayer/${pending.roomCode}`)).status, 404);
      assert.equal((await request(stranger.id, `/multiplayer/${pending.roomCode}/join`, { deckId })).status, 404);
      assert.equal((await ok(a.id, `/multiplayer/${pending.roomCode}`)).status, "closed");
      const f = await friends(); const deletedHost = await invite(f.a, f.b);
      await db.delete(profiles).where(eq(profiles.clerkUserId, f.a.id));
      assert.equal((await request(stranger.id, `/multiplayer/${deletedHost.roomCode}`)).status, 404);
      assert.equal((await request(stranger.id, `/multiplayer/${deletedHost.roomCode}/join`, { deckId })).status, 404);
      assert.equal((await request(f.b.id, `/social/invitations/${deletedHost.id}`)).status, 404);
      // A missing receipt does not revoke an already joined member's rights.
      const g = await friends(); const joined = await invite(g.a, g.b);
      await ok(g.b.id, `/social/invitations/${joined.id}/respond`, { action: "accept", deckId });
      await db.delete(invitations).where(eq(invitations.id, joined.id));
      await ok(g.b.id, `/multiplayer/${joined.roomCode}`);
      await ok(g.b.id, `/multiplayer/${joined.roomCode}/join`, { deckId });
      assert.equal((await request(stranger.id, `/multiplayer/${joined.roomCode}/join`, { deckId })).status, 404);
    });
    await t.test("additive native/development migration parity and profile cascades", async () => {
      const usernameDev = readFileSync("../../lib/db/migrations/20261003_social_usernames.sql", "utf8");
      const usernameNative = readFileSync("../../netlify/database/migrations/202610030001_social-usernames/migration.sql", "utf8");
      assert.equal(usernameDev, usernameNative);
      // Apply checked additive SQL in an isolated schema of the owned test cluster.
      const client = await pool.connect();
      try {
        await client.query("CREATE SCHEMA fadebook_migration_test");
        await client.query("SET search_path TO fadebook_migration_test");
        await client.query("CREATE TABLE social_identities (user_id text PRIMARY KEY, friend_code text NOT NULL UNIQUE)");
        await client.query("INSERT INTO social_identities VALUES ('legacy', '0123456789AB')");
        await client.query(usernameNative);
        assert.equal((await client.query("SELECT username FROM social_identities")).rows[0].username, null);
        await assert.rejects(client.query("UPDATE social_identities SET username = 'ADMIN'"));
        await assert.rejects(client.query("UPDATE social_identities SET username = 'admin'"));
        await client.query("UPDATE social_identities SET username = 'valid_name'");
        await assert.rejects(client.query("INSERT INTO social_identities VALUES ('second', '0123456789AC', 'valid_name')"));
      } finally {
        await client.query("SET search_path TO public");
        await client.query("DROP SCHEMA fadebook_migration_test CASCADE");
        client.release();
      }
      const dev = readFileSync("../../lib/db/migrations/20261002_social.sql", "utf8");
      const native = readFileSync("../../netlify/database/migrations/202610020001_social/migration.sql", "utf8");
      assert.equal(dev, native);
      // Replaying additive SQL against schema-pushed owned PostgreSQL is harmless.
      await pool.query(native);
      const { a, b } = await friends(); await invite(a, b);
      await db.delete(profiles).where(eq(profiles.clerkUserId, a.id));
      assert.equal((await db.select().from(identities).where(eq(identities.userId, a.id))).length, 0);
      assert.equal((await db.select().from(relations).where(orPair(a.id)) ).length, 0);
      assert.equal((await db.select().from(invitations).where(eq(invitations.sender, a.id))).length, 0);
      assert.equal((await db.select().from(rooms).where(eq(rooms.hostUserId, a.id))).length, 0);
    });
  } finally {
    for (const id of users) await db.delete(profiles).where(eq(profiles.clerkUserId, id));
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await pool.end();
  }
});
const orPair = (id: string) => sql`${relations.low} = ${id} or ${relations.high} = ${id}`;