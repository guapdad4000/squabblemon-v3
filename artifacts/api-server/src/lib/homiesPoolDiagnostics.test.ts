import assert from 'node:assert/strict';
import test from 'node:test';
import { createHomiesDiagnostics } from './homiesDiagnostics';
import { instrumentHomiesPool } from './homiesPoolDiagnostics';
import type { HomiesDiagnosticEvent } from './homiesDiagnosticsReporter';

type Callback = (error: Error | undefined, client?: object, release?: () => void) => void;
type FakePool = {
  waitingCount: number;
  connect: (this: FakePool, callback?: Callback) => Promise<object> | void;
  calls: number;
};
type RealPool = Parameters<typeof instrumentHomiesPool>[0];
const asPool = (fake: FakePool): RealPool => fake as unknown as RealPool;

function diagnosticHarness(sampleRate = 1, random = () => 0) {
  let time = 0;
  const entries: HomiesDiagnosticEvent[] = [];
  const diagnostics = createHomiesDiagnostics({
    sampleRate, random, now: () => time,
    emit: (_level, event) => { entries.push(event); },
  });
  return { diagnostics, entries, setTime: (value: number) => { time = value; } };
}

test('disabled pool stays untouched; unscoped and unsampled calls return the exact original Promise', async () => {
  const client = {};
  const pending = Promise.resolve(client);
  const fake: FakePool = {
    waitingCount: 0,
    calls: 0,
    connect() { this.calls++; return pending; },
  };
  const original = fake.connect;
  const off = diagnosticHarness(0);
  instrumentHomiesPool(asPool(fake), off.diagnostics);
  assert.equal(fake.connect, original);

  const selected = diagnosticHarness(1);
  const restore = instrumentHomiesPool(asPool(fake), selected.diagnostics);
  assert.notEqual(fake.connect, original);
  assert.equal(fake.connect(), pending);
  const unsampled = diagnosticHarness(0.5, () => 0.9);
  await unsampled.diagnostics.operation('social_read', 'lookup', () => {
    assert.equal(fake.connect(), pending);
    return pending;
  });
  assert.equal(fake.calls, 2);
  assert.equal(selected.entries.length, 0);
  restore();
  assert.equal(fake.connect, original);
});

test('patch is installed only once; cleanup does not clobber a later benchmark wrapper', () => {
  const fake: FakePool = { waitingCount: 0, calls: 0, connect() { this.calls++; return Promise.resolve({}); } };
  const original = fake.connect;
  const { diagnostics } = diagnosticHarness();
  const restore = instrumentHomiesPool(asPool(fake), diagnostics);
  const first = fake.connect;
  const duplicateCleanup = instrumentHomiesPool(asPool(fake), diagnostics);
  assert.equal(fake.connect, first);
  duplicateCleanup();
  assert.equal(fake.connect, first);
  const benchmark = function (this: FakePool, callback?: Callback) { return first.call(this, callback); };
  fake.connect = benchmark;
  restore();
  assert.equal(fake.connect, benchmark);
  assert.notEqual(fake.connect, original);
});

test('promise checkout observes queue before/after enqueue and completion, preserving client and this', async () => {
  const { diagnostics, entries, setTime } = diagnosticHarness();
  const client = { marker: 'same-client' };
  let resolve!: (client: object) => void;
  const pending = new Promise<object>(res => { resolve = res; });
  let bound: FakePool | undefined;
  const fake: FakePool = {
    waitingCount: 2, calls: 0,
    connect() {
      bound = this;
      this.calls++;
      this.waitingCount = 6;
      return pending;
    },
  };
  instrumentHomiesPool(asPool(fake), diagnostics);
  const operation = diagnostics.operation('social_read', 'lookup', async () => {
    setTime(1);
    const result = fake.connect();
    assert.notEqual(result, pending); // Scoped connect needs to observe settlement.
    setTime(9);
    fake.waitingCount = 3;
    resolve(client);
    assert.equal(await result, client);
  });
  await operation;
  assert.equal(bound, fake);
  assert.equal(fake.calls, 1);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].checkoutCount, 1);
  assert.equal(entries[0].checkoutErrors, 0);
  assert.equal(entries[0].checkoutTotalMs, 8);
  assert.equal(entries[0].poolWaitingPeak, 6);
});

test('promise rejection and synchronous connect throw preserve exact error identity', async () => {
  const { diagnostics, entries, setTime } = diagnosticHarness();
  const rejection = new Error('promise reject');
  const fake: FakePool = {
    waitingCount: 0, calls: 0,
    connect() { this.calls++; setTime(5); return Promise.reject(rejection); },
  };
  instrumentHomiesPool(asPool(fake), diagnostics);
  await assert.rejects(
    diagnostics.operation('social_read', 'lookup', async () => { await fake.connect(); }),
    error => error === rejection,
  );
  assert.equal(entries[0].checkoutErrors, 1);
  assert.equal(entries[0].checkoutCount, 1);
  assert.equal(entries[0].checkoutTotalMs, 5);

  const thrown = new Error('synchronous throw');
  const second: FakePool = {
    waitingCount: 1, calls: 0,
    connect() { this.calls++; throw thrown; },
  };
  instrumentHomiesPool(asPool(second), diagnostics);
  await assert.rejects(
    diagnostics.operation('social_write', 'relationship_write', async () => { second.connect(); }),
    error => error === thrown,
  );
  assert.equal(entries[1].checkoutErrors, 1);
  assert.equal(second.calls, 1);
});

test('callback connect passes original error/client/release exactly once and observes queue', async () => {
  const { diagnostics, entries, setTime } = diagnosticHarness();
  const client = { id: 1 };
  const release = () => {};
  const error = new Error('callback error');
  let completion!: () => void;
  let originalThis: FakePool | undefined;
  const fake: FakePool = {
    waitingCount: 2, calls: 0,
    connect(callback) {
      originalThis = this;
      this.calls++;
      this.waitingCount = 8;
      completion = () => {
        this.waitingCount = 1;
        callback?.(error, client, release);
      };
    },
  };
  instrumentHomiesPool(asPool(fake), diagnostics);
  let calls = 0;
  await diagnostics.operation('social_read', 'lookup', async () => {
    setTime(1);
    const returned = fake.connect((receivedError, receivedClient, receivedRelease) => {
      calls++;
      assert.equal(receivedError, error);
      assert.equal(receivedClient, client);
      assert.equal(receivedRelease, release);
    });
    assert.equal(returned, undefined);
    setTime(7);
    completion();
  });
  assert.equal(originalThis, fake);
  assert.equal(fake.calls, 1);
  assert.equal(calls, 1);
  assert.equal(entries[0].checkoutCount, 1);
  assert.equal(entries[0].checkoutErrors, 1);
  assert.equal(entries[0].checkoutTotalMs, 6);
  assert.equal(entries[0].poolWaitingPeak, 8);
});

test('successful callback connect preserves client and release and never counts an error', async () => {
  const { diagnostics, entries, setTime } = diagnosticHarness();
  const client = { identity: 'client' };
  const release = () => {};
  const fake: FakePool = {
    waitingCount: 0, calls: 0,
    connect(callback) {
      this.calls++;
      this.waitingCount = 4;
      setTime(6);
      callback?.(undefined, client, release);
    },
  };
  instrumentHomiesPool(asPool(fake), diagnostics);
  let callbacks = 0;
  await diagnostics.operation('social_read', 'lookup', async () => {
    fake.connect((error, receivedClient, receivedRelease) => {
      callbacks++;
      assert.equal(error, undefined);
      assert.equal(receivedClient, client);
      assert.equal(receivedRelease, release);
    });
  });
  assert.equal(callbacks, 1);
  assert.equal(fake.calls, 1);
  assert.equal(entries[0].checkoutErrors, 0);
  assert.equal(entries[0].checkoutCount, 1);
  assert.equal(entries[0].checkoutTotalMs, 6);
  assert.equal(entries[0].poolWaitingPeak, 4);
});