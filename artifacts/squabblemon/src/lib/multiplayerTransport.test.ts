import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "@workspace/api-client-react";
import { isOnlineConnectionFresh, isTransientOnlineError, ONLINE_READ_TIMEOUT_MS,
  ONLINE_WRITE_TIMEOUT_MS, request, searchRanked } from "./multiplayer";

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { "Content-Type": "application/json" },
});
const stalledFetch = (_input: RequestInfo | URL, init?: RequestInit) =>
  new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal!.reason), { once: true });
  });
const apiError = (status: number) => new ApiError(json({ error: "Unavailable" }, status),
  { error: "Unavailable" }, { method: "GET", url: "/api/multiplayer/ABCDEF123456" });

test("a committed write can acknowledge after the former eight-second cutoff", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let capturedSignal: AbortSignal | null | undefined;
  t.mock.method(globalThis, "fetch", (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedSignal = init?.signal;
    return new Promise<Response>((resolve, reject) => {
      const timer = setTimeout(() => resolve(json({ revision: 3 })), 9_000);
      init?.signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(init.signal!.reason);
      }, { once: true });
    });
  });
  const pending = request<{ revision: number }>("/ABCDEF123456/actions", { requestId: "stable-id" });
  t.mock.timers.tick(9_000);
  assert.deepEqual(await pending, { revision: 3 });
  assert.equal(capturedSignal?.aborted, false);
  t.mock.timers.tick(ONLINE_WRITE_TIMEOUT_MS);
  assert.equal(capturedSignal?.aborted, false, "a settled request clears its abort timer");
});

test("stalled reads release after twelve seconds with a recognizable timeout", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const fetch = t.mock.method(globalThis, "fetch", stalledFetch);
  const pending = request("/ranked");
  const rejection = assert.rejects(pending, error => {
    assert.ok(error instanceof Error);
    assert.equal(error.name, "TimeoutError");
    assert.equal(isTransientOnlineError(error), true);
    return true;
  });
  t.mock.timers.tick(ONLINE_READ_TIMEOUT_MS - 1);
  const init = fetch.mock.calls[0].arguments[1] as RequestInit;
  assert.equal(init.signal?.aborted, false);
  t.mock.timers.tick(1);
  await rejection;
  assert.equal(init.signal?.aborted, true);
});

test("stalled writes remain bounded and timeout at fifteen seconds", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const fetch = t.mock.method(globalThis, "fetch", stalledFetch);
  const pending = request("/ABCDEF123456/actions", { type: "end-turn" });
  const rejection = assert.rejects(pending, { name: "TimeoutError" });
  t.mock.timers.tick(ONLINE_READ_TIMEOUT_MS);
  const init = fetch.mock.calls[0].arguments[1] as RequestInit;
  assert.equal(init.signal?.aborted, false, "writes allow database acquisition plus acknowledgement");
  t.mock.timers.tick(ONLINE_WRITE_TIMEOUT_MS - ONLINE_READ_TIMEOUT_MS);
  await rejection;
});

test("caller cancellation propagates its own reason and removes its listener", async t => {
  const caller = new AbortController();
  const remove = t.mock.method(caller.signal, "removeEventListener");
  t.mock.method(globalThis, "fetch", (_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }));
  const reason = new DOMException("Lobby read superseded", "AbortError");
  const pending = request("/ranked", undefined, caller.signal);
  const rejection = assert.rejects(pending, error => error === reason);
  caller.abort(reason);
  await rejection;
  assert.equal(remove.mock.calls.length, 1);
  assert.equal(isTransientOnlineError(reason), false, "cancelled lobby reads must not restart");
});

test("a pre-cancelled query never starts a network request", async t => {
  const caller = new AbortController();
  caller.abort(new DOMException("Superseded", "AbortError"));
  const fetch = t.mock.method(globalThis, "fetch", () => { throw new Error("Unexpected fetch"); });
  await assert.rejects(request("/ranked", undefined, caller.signal), { name: "AbortError" });
  assert.equal(fetch.mock.calls.length, 0);
});

test("lost search acknowledgement retries the identical search ID and payload", async t => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const committedSearches = new Set<string>();
  t.mock.method(globalThis, "fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    committedSearches.add(JSON.parse(String(init?.body)).requestId);
    if (calls.length === 1) throw new TypeError("Failed to fetch");
    return Promise.resolve(json({ room: { code: "ABCDEF123456", status: "active" } }));
  });
  const lobby = await searchRanked("my-gang", "d6700af7-e628-49d9-baf4-d4d2bcf68f79");
  assert.equal(lobby.room?.code, "ABCDEF123456");
  assert.equal(calls.length, 2);
  assert.equal(committedSearches.size, 1);
  assert.equal(calls[0].init?.body, calls[1].init?.body);
  for (const call of calls) {
    assert.equal(call.url, "/api/multiplayer/ranked/search");
    assert.equal(call.init?.method, "POST");
    assert.equal(call.init?.cache, "no-store");
    assert.equal(call.init?.credentials, "same-origin");
  }
});

test("a server failure during search retries once, then returns its acknowledgement", async t => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", () => Promise.resolve(++calls === 1
    ? json({ error: "Database briefly unavailable" }, 503)
    : json({ room: { code: "ABCDEF123456", status: "waiting" } })));
  assert.equal((await searchRanked("crew", "same-id")).room?.status, "waiting");
  assert.equal(calls, 2);
});

test("a timed-out search retries even when fetch reports a generic AbortError", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const bodies: BodyInit[] = [];
  t.mock.method(globalThis, "fetch", (_input: RequestInfo | URL, init?: RequestInit) => {
    bodies.push(init!.body!);
    if (bodies.length === 2) return Promise.resolve(json({ room: { code: "ABCDEF123456", status: "active" } }));
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    });
  });
  const pending = searchRanked("crew", "same-id");
  t.mock.timers.tick(ONLINE_WRITE_TIMEOUT_MS);
  assert.equal((await pending).room?.status, "active");
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0], bodies[1]);
});

test("persistent search network failure is bounded to two attempts", async t => {
  const fetch = t.mock.method(globalThis, "fetch", () => Promise.reject(new TypeError("Failed to fetch")));
  await assert.rejects(searchRanked("crew", "same-id"), /Failed to fetch/);
  assert.equal(fetch.mock.calls.length, 2);
});

test("search never retries rejected credentials, invalid gangs, stale requests or rate limits", async t => {
  let status = 400, calls = 0;
  t.mock.method(globalThis, "fetch", () => { calls++; return Promise.resolve(json({ error: "Rejected" }, status)); });
  for (status of [400, 401, 403, 404, 409, 429]) {
    const before = calls;
    await assert.rejects(searchRanked("crew", "same-id"), error => error instanceof ApiError && error.status === status);
    assert.equal(calls, before + 1, `HTTP ${status} is not retryable`);
  }
});

test("search cancellation and programming errors are not retried", async t => {
  let failure: Error = new DOMException("Cancelled", "AbortError"), calls = 0;
  t.mock.method(globalThis, "fetch", () => { calls++; return Promise.reject(failure); });
  await assert.rejects(searchRanked("crew", "same-id"), { name: "AbortError" });
  assert.equal(calls, 1);
  failure = new Error("Unexpected client bug");
  await assert.rejects(searchRanked("crew", "same-id"), /Unexpected client bug/);
  assert.equal(calls, 2);
});

test("one missed poll keeps a fresh board playable, but stale or offline state does not", () => {
  const view = { online: true, hasData: true, dataUpdatedAt: 20_000, now: 21_000 };
  assert.equal(isOnlineConnectionFresh(view), true);
  for (const error of [new TypeError("Failed to fetch"), new DOMException("Timed out", "TimeoutError"), apiError(503)])
    assert.equal(isOnlineConnectionFresh({ ...view, error }), true);
  assert.equal(isOnlineConnectionFresh({ ...view, now: 30_000, error: apiError(503) }), false);
  assert.equal(isOnlineConnectionFresh({ ...view, online: false }), false);
  assert.equal(isOnlineConnectionFresh({ ...view, hasData: false }), false);
});

test("auth, access and missing-room errors disable even a recently fetched board", () => {
  for (const status of [400, 401, 403, 404, 409, 429])
    assert.equal(isOnlineConnectionFresh({ online: true, hasData: true,
      dataUpdatedAt: 20_000, now: 21_000, error: apiError(status) }), false);
});
