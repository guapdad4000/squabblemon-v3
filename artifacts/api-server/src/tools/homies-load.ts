import assert from "node:assert/strict";
import { cpus, totalmem } from "node:os";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, relative, dirname } from "node:path";
import { performance } from "node:perf_hooks";
import { db, pool, onlineRoomsTable as rooms, socialInvitationsTable as invites,
  socialRelationshipsTable as relations, socialBlocksTable as blocks } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { getSocialState, socialThrottle, sendFadeInvitation, mutateRelationship, accessInvitation } from "../lib/social";
import { accessFriendRoom, createFriendRoom } from "../lib/onlineMatches";
import { seedPlayers, deckId, type Player } from "./homies-load-fixtures";
import { makeRecorder, monitorPool } from "./homies-load-metrics";
import { randomUUID } from "node:crypto";

if (process.env.SOCIAL_LOAD_OWNED !== "1" || process.env.CAMPAIGN_DATABASE_TESTS !== "1")
  throw new Error("Run only through the --social-load owned-cluster wrapper.");
const args = process.argv.slice(2);
function option(name: string, fallback: string) {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1] ?? (() => { throw new Error(`Missing ${name}`); })();
}
const label = option("--label", "baseline");
if (!["baseline", "optimized"].includes(label)) throw new Error("--label must be baseline or optimized.");
const counts = option("--players", "25,100,250").split(",").map(Number);
if (!counts.length || counts.some(n => !Number.isInteger(n) || n < 25 || n > 250)) throw new Error("--players must be 25..250.");
const duration = Number(option("--duration-seconds", "35"));
if (!Number.isFinite(duration) || duration < 4 || duration > 90) throw new Error("--duration-seconds must be 4..90.");
const output = option("--output", `scripts/results/homies-contention-${label}.json`);
const repo = resolve(process.cwd(), "../..");
const target = resolve(repo, output);
if (relative(repo, target).startsWith("..") || target === repo) throw new Error("--output must stay inside repository.");
if (args.some((v, i) => v.startsWith("--") && !["--label", "--players", "--duration-seconds", "--output"].includes(v)))
  throw new Error("Unknown option.");

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
type Measured = ReturnType<typeof makeRecorder>;
async function race(players: Player[], recorder: Measured) {
  const m = recorder.measure;
  const mutation = async <T>(userId: string, fn: () => Promise<T>) => {
    await socialThrottle(userId, "mutate");
    return fn();
  };
  async function invite(index: number) {
    const a = players[index], b = players[index + 1], requestId = randomUUID();
    const sent = await m("invite", performance.now(), () => mutation(a.id, () => sendFadeInvitation(a.id,
      { friendCode: b.code, deckId, requestId })), [409, 429]);
    assert.equal(sent.status, 200, `Race fixture invite failed (${sent.status})`);
    return { a, b, requestId, invitation: sent.value! };
  }
  const first = await invite(0);
  const retry = await Promise.all(Array.from({ length: 2 }, () =>
    m("invite-retry", performance.now(), () => mutation(first.a.id, () => sendFadeInvitation(first.a.id,
      { friendCode: first.b.code, deckId, requestId: first.requestId })))));
  assert.ok(retry.every(r => r.status === 200 && r.value?.id === first.invitation.id));
  const invalidGuest = players[players.length - 1];
  const denied = await m("direct-code-denied", performance.now(),
    () => accessFriendRoom(first.invitation.roomCode, invalidGuest.id, { kind: "join", deckId }), [404]);
  assert.equal(denied.status, 404);

  for (const [index, operation, join] of [[2, "remove", false], [4, "block", true]] as const) {
    const { a, b, invitation } = await invite(index);
    const outcomes = await Promise.all([
      join ? m("direct-code-race", performance.now(), () =>
        accessFriendRoom(invitation.roomCode, b.id, { kind: "join", deckId }), [409]) :
        m("accept-race", performance.now(), () => mutation(b.id, () =>
          accessInvitation(b.id, invitation.id, { action: "accept", deckId })), [409]),
      m(operation, performance.now(), () => mutation(a.id, () =>
        mutateRelationship(a.id, operation, { code: b.code })), [404, 409, 429]),
    ]);
    assert.equal(outcomes[1].status, 200, `${operation} must succeed`);
    const [receipt] = await db.select().from(invites).where(eq(invites.id, invitation.id));
    const [room] = await db.select().from(rooms).where(eq(rooms.code, invitation.roomCode));
    assert.ok(["accepted", "unavailable"].includes(receipt.status));
    assert.equal(!!(room.state as { members: { cpu?: unknown } }).members.cpu, receipt.status === "accepted",
      "Reserved seat may be held only if invitation was accepted before revocation.");
    if (receipt.status === "unavailable") {
      const attempt = await m("revoked-join", performance.now(),
        () => accessFriendRoom(invitation.roomCode, b.id, { kind: "join", deckId }), [409]);
      assert.equal(attempt.status, 409);
    }
  }
  const concurrent = await invite(6);
  const joined = await Promise.all([
    m("accept-race", performance.now(), () => mutation(concurrent.b.id, () =>
      accessInvitation(concurrent.b.id, concurrent.invitation.id, { action: "accept", deckId })), [409]),
    m("direct-code-race", performance.now(), () => accessFriendRoom(concurrent.invitation.roomCode,
      concurrent.b.id, { kind: "join", deckId }), [409]),
  ]);
  assert.ok(joined.some(r => r.status === 200));
  const [accepted] = await db.select().from(invites).where(eq(invites.id, concurrent.invitation.id));
  assert.equal(accepted.status, "accepted");
  const [room] = await db.select().from(rooms).where(eq(rooms.code, concurrent.invitation.roomCode));
  assert.equal((room.state as { members: { cpu?: { userId: string } } }).members.cpu?.userId, concurrent.b.id);
  const repeated = await m("accept-retry", performance.now(), () => mutation(concurrent.b.id, () =>
    accessInvitation(concurrent.b.id, concurrent.invitation.id, { action: "accept", deckId })));
  assert.equal(repeated.value?.status, "accepted");

  const a = players[8], b = players[20]; // not among the ten neighbors in a 25+ player ring
  const pair = [a.id, b.id].sort();
  const existing = await db.select().from(relations).where(and(eq(relations.low, pair[0]), eq(relations.high, pair[1])));
  if (!existing.length) {
    const crossed = await Promise.all([
      m("request-send-race", performance.now(), () => mutation(a.id, () => mutateRelationship(a.id, "send", { code: b.code })), [409]),
      m("request-send-race", performance.now(), () => mutation(b.id, () => mutateRelationship(b.id, "send", { code: a.code })), [409]),
    ]);
    assert.deepEqual(crossed.map(x => x.status).sort(), [200, 409]);
    const [request] = await db.select().from(relations).where(and(eq(relations.low, pair[0]), eq(relations.high, pair[1])));
    const sender = request.sender === a.id ? a : b, recipient = sender === a ? b : a;
    const decisions = await Promise.all([
      m("request-cancel-race", performance.now(), () => mutation(sender.id, () => mutateRelationship(sender.id, "respond",
        { id: request.id, action: "cancel" })), [409]),
      m("request-accept-race", performance.now(), () => mutation(recipient.id, () => mutateRelationship(recipient.id, "respond",
        { id: request.id, action: "accept" })), [409]),
    ]);
    assert.deepEqual(decisions.map(x => x.status).sort(), [200, 409]);
  }
  const [blocked] = await db.select().from(blocks).where(and(eq(blocks.userId, players[4].id), eq(blocks.targetId, players[5].id)));
  assert.ok(blocked, "Blocking race did not persist.");
}

async function run(count: number) {
  const players = await seedPlayers(count);
  const recorder = makeRecorder();
  const roomPolls: Array<{ code: string; id: string; cadence: number }> = [];
  const roomPairs = Math.max(1, Math.floor(count / 20));
  for (let i = 0; i < roomPairs * 2; i++) {
    const host = players[count - 1 - i * 2], guest = players[count - 2 - i * 2];
    const created = await createFriendRoom(host.id, deckId, randomUUID());
    if (i < roomPairs) {
      await accessFriendRoom(created.code, guest.id, { kind: "join", deckId });
      let view = await accessFriendRoom(created.code, host.id);
      view = await accessFriendRoom(created.code, host.id, { kind: "command",
        expectedRevision: view.revision, requestId: randomUUID(), command: { type: "ready" } });
      await accessFriendRoom(created.code, guest.id, { kind: "command",
        expectedRevision: view.revision, requestId: randomUUID(), command: { type: "ready" } });
      roomPolls.push({ code: created.code, id: host.id, cadence: 800 }, { code: created.code, id: guest.id, cadence: 800 });
    } else roomPolls.push({ code: created.code, id: host.id, cadence: 2000 });
  }
  const monitor = await monitorPool();
  const start = performance.now(), end = start + duration * 1000;
  const work: Promise<unknown>[] = [];
  // One synchronized reconnect burst; subsequent visible-menu refreshes are
  // phase-spread across ten seconds. No closed-loop "sleep after completion".
  const menuPlayers = players.slice(0, count - roomPairs * 4);
  for (const p of menuPlayers) {
    work.push(recorder.measure("menu-reconnect", start, () => getSocialState(p.id)));
    const phase = (Number.parseInt(p.code.slice(-6), 16) * 7919 % 10000);
    for (let at = start + phase + 10000; at < end; at += 10000) {
      const due = at;
      work.push(delay(Math.max(0, due - performance.now())).then(() =>
        recorder.measure("menu-staggered", due, () => getSocialState(p.id))));
    }
  }
  for (const [i, room] of roomPolls.entries()) {
    for (let at = start + (i * 97 % room.cadence); at < end; at += room.cadence) {
      const due = at;
      work.push(delay(Math.max(0, due - performance.now())).then(() =>
        recorder.measure(room.cadence === 800 ? "room-active-800ms" : "room-waiting-2s",
          due, () => accessFriendRoom(room.code, room.id))));
    }
  }
  // Durable throttle paths use separate transactions; one mutate and lookup
  // per fixture account stays below account-local per-minute limits.
  for (let i = 0; i < count; i += 4) {
    const p = players[i], due = start + 500 + (i * 71 % Math.max(1000, duration * 500));
    work.push(delay(Math.max(0, due - performance.now())).then(async () => {
      await recorder.measure("throttle-lookup", due, () => socialThrottle(p.id, "lookup"), [429]);
      await recorder.measure("throttle-mutate", due, () => socialThrottle(p.id, "mutate"), [429]);
    }));
  }
  const races = delay(1500).then(() => race(players, recorder));
  let failure: unknown;
  try { await Promise.all([...work, races]); }
  catch (error) { failure = error; }
  const elapsed = (performance.now() - start) / 1000;
  const sql = await monitor.finish();
  const summary = { players: count, configuredSeconds: duration, wallSeconds: Math.round(elapsed * 100) / 100,
    menuPlayers: count - roomPairs * 4, activeRoomPollers: roomPairs * 2, waitingRoomPollers: roomPairs, records: recorder.summary(elapsed),
    sql, nativeConnectionProof: monitor.proof, unexpectedErrors: recorder.unexpected };
  if (failure || recorder.unexpected.length || sql.observedSamples < 3)
    throw new Error(`Run ${count} failed: ${failure instanceof Error ? failure.message : String(failure ?? (recorder.unexpected.join("; ") || "insufficient monitor samples"))}`);
  return summary;
}

try {
  const version = (await pool.query<{ version: string }>("select version()")).rows[0].version;
  assert.match(version, /PostgreSQL/);
  const runs = [];
  for (const count of counts) {
    const result = await run(count);
    runs.push(result);
    console.log(`Homies ${count}: ${result.records.count} calls, ${result.records.throughputPerSecond}/s, checkout p95 ${result.sql.checkoutWait.p95Ms}ms, peak advisory waiters ${result.sql.peakAdvisoryWaiters}, peak pool queue ${result.sql.peakPoolWaiting}`);
  }
  const evidence = { label, timestamp: new Date().toISOString(),
    configuration: { counts, durationSeconds: duration, menuPollMs: 10000, activeRoomPollMs: 800,
      waitingRoomPollMs: 2000, friendsPerAccount: 20, historicalReceiptsPerAccount: 10,
      poolMax: Number(process.env.DATABASE_POOL_MAX), nativeMaxConnections: 100,
      limitation: "One process, up to 50 native connections for up to 250 logical players; not one connection per player." },
    environment: { postgresVersion: version.split(" on ")[0], nodeVersion: process.version,
      cpuCount: cpus().length, memoryBytes: totalmem(), processPid: process.pid }, runs };
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(evidence, null, 2) + "\n");
  console.log(`Saved ${output}`);
} catch (error) {
  console.error(`Homies load FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally { await pool.end(); }