import assert from 'node:assert/strict';
import test from 'node:test';
import { createHomiesDiagnostics } from './homiesDiagnostics';
import type { HomiesDiagnosticEvent } from './homiesDiagnosticsReporter';

function harness() {
  let time = 0;
  const entries: HomiesDiagnosticEvent[] = [];
  const diagnostics = createHomiesDiagnostics({
    sampleRate: 1,
    now: () => time,
    emit: (_level, event) => { entries.push(event); },
  });
  return { diagnostics, entries, setTime: (value: number) => { time = value; } };
}

test('disabled, invalid, and unsampled operations pass through promises and synchronous throws unchanged', async () => {
  for (const rate of [0, -1, 2, NaN, Infinity, 0.5]) {
    let clocks = 0;
    let calls = 0;
    const diagnostic = createHomiesDiagnostics({
      sampleRate: rate,
      now: () => { clocks++; return 0; },
      random: () => 0.9,
      emit: () => { throw new Error('unexpected emission'); },
    });
    assert.equal(diagnostic.enabled, rate === 0.5);
    const promise = Promise.resolve('value');
    assert.equal(diagnostic.operation('menu_refresh', 'menu_refresh', () => { calls++; return promise; }), promise);
    const thrown = new Error('synchronous');
    assert.throws(
      () => diagnostic.operation('menu_refresh', 'menu_refresh', () => { calls++; throw thrown; }),
      error => error === thrown,
    );
    assert.equal(await promise, 'value');
    assert.equal(calls, 2);
    assert.equal(clocks, 0);
  }
});

test('bad sampler or initial clock does not affect task result or rejection identity', async () => {
  const failure = { status: 409 };
  for (const config of [
    { sampleRate: 0.5, random: () => { throw failure; }, now: () => 0 },
    { sampleRate: 1, random: () => 0, now: () => { throw failure; } },
  ]) {
    let calls = 0;
    const diagnostics = createHomiesDiagnostics({ ...config, emit: () => { throw failure; } });
    const promise = Promise.resolve(17);
    assert.equal(diagnostics.operation('social_read', 'lookup', () => { calls++; return promise; }), promise);
    await assert.rejects(
      diagnostics.operation('social_read', 'lookup', () => { calls++; return Promise.reject(failure); }),
      error => error === failure,
    );
    assert.equal(calls, 2);
  }
});

test('selected fractional-rate operation emits once without reporter resampling', async () => {
  let draws = 0;
  const entries: HomiesDiagnosticEvent[] = [];
  const diagnostics = createHomiesDiagnostics({
    sampleRate: 0.5,
    random: () => { draws++; return 0.25; },
    now: () => 0,
    emit: (_level, event) => { entries.push(event); },
  });
  await diagnostics.operation('menu_refresh', 'menu_refresh', async () => 'done');
  assert.equal(draws, 1);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].sampleRate, 0.5);
});

test('checkout, lock wait, and lock hold include transaction settlement after the callback', async () => {
  const { diagnostics, entries, setTime } = harness();
  const result = await diagnostics.operation('social_write', 'relationship_write', () =>
    diagnostics.transaction(async () => {
      setTime(1);
      let waiting = 3;
      const checkout = diagnostics.startCheckout(() => waiting);
      assert.ok(checkout);
      setTime(3);
      waiting = 5;
      checkout.queued();
      setTime(5);
      checkout.finish(false);
      checkout.finish(true); // Idempotent even if the caller repeats completion.
      setTime(8);
      await diagnostics.socialLock(async () => { setTime(18); });
      setTime(20); // User callback is finished, but COMMIT/release comes afterwards.
      await Promise.resolve();
      setTime(30);
      return 'committed';
    }).then(value => { setTime(35); return value; }),
  );
  assert.equal(result, 'committed');
  assert.equal(entries.length, 1);
  assert.deepEqual({
    operationMs: entries[0].operationMs,
    transactions: entries[0].transactions,
    checkoutCount: entries[0].checkoutCount,
    checkoutErrors: entries[0].checkoutErrors,
    checkoutTotalMs: entries[0].checkoutTotalMs,
    checkoutMaxMs: entries[0].checkoutMaxMs,
    poolWaitingPeak: entries[0].poolWaitingPeak,
    socialLockAttempts: entries[0].socialLockAttempts,
    socialLockAcquired: entries[0].socialLockAcquired,
    socialLockWaitTotalMs: entries[0].socialLockWaitTotalMs,
    socialLockHoldTotalMs: entries[0].socialLockHoldTotalMs,
  }, {
    operationMs: 35, transactions: 1, checkoutCount: 1, checkoutErrors: 0,
    checkoutTotalMs: 4, checkoutMaxMs: 4, poolWaitingPeak: 5,
    socialLockAttempts: 1, socialLockAcquired: 1, socialLockWaitTotalMs: 10,
    socialLockHoldTotalMs: 12,
  });
});

test('rollback rejection is classified; failed lock wait and failed checkout have no hold', async () => {
  const { diagnostics, entries, setTime } = harness();
  const denied = { status: 409 };
  await assert.rejects(
    diagnostics.operation('social_write', 'relationship_write', () =>
      diagnostics.transaction(async () => {
        const checkout = diagnostics.startCheckout(() => 2);
        setTime(4);
        checkout?.finish(true);
        setTime(5);
        await diagnostics.socialLock(async () => { setTime(13); throw denied; });
      }).catch(error => { setTime(20); throw error; }),
    ),
    error => error === denied,
  );
  assert.equal(entries[0].outcome, 'rejected');
  assert.equal(entries[0].checkoutErrors, 1);
  assert.equal(entries[0].socialLockAttempts, 1);
  assert.equal(entries[0].socialLockAcquired, 0);
  assert.equal(entries[0].socialLockWaitTotalMs, 8);
  assert.equal(entries[0].socialLockHoldTotalMs, 0);
  const unexpected = new Error('unexpected');
  await assert.rejects(
    diagnostics.operation('social_read', 'lookup', () => Promise.reject(unexpected)),
    error => error === unexpected,
  );
  assert.equal(entries[1].outcome, 'error');
});

test('overlapping operations isolate samples; nested transactions and retries count once per call', async () => {
  const { diagnostics, entries, setTime } = harness();
  let finishFirst!: () => void;
  let finishSecond!: () => void;
  let reachedFirstGate!: () => void;
  const firstAtGate = new Promise<void>(resolve => { reachedFirstGate = resolve; });
  const firstGate = new Promise<void>(resolve => { finishFirst = resolve; });
  const secondGate = new Promise<void>(resolve => { finishSecond = resolve; });
  const first = diagnostics.operation('social_write', 'relationship_write', () =>
    diagnostics.transaction(async () => {
      setTime(1);
      await diagnostics.socialLock(async () => { setTime(4); });
      await diagnostics.transaction(async () => {
        diagnostics.retry(); // One stale-hint retry; transaction nesting does not add another.
        reachedFirstGate();
        await firstGate;
      });
      setTime(40);
    }));
  await firstAtGate;
  setTime(10);
  const second = diagnostics.operation('social_read', 'lookup', async () => {
    const checkout = diagnostics.startCheckout(() => 7);
    await secondGate;
    setTime(20);
    checkout?.finish(false);
  });
  finishSecond();
  await second;
  finishFirst();
  await first;
  assert.equal(entries.length, 2);
  const read = entries.find(entry => entry.category === 'social_read');
  const write = entries.find(entry => entry.category === 'social_write');
  assert.equal(read?.checkoutCount, 1);
  assert.equal(read?.checkoutTotalMs, 10);
  assert.equal(read?.transactions, 0);
  assert.equal(read?.socialLockHoldTotalMs, 0);
  assert.equal(write?.checkoutCount, 0);
  assert.equal(write?.transactions, 2);
  assert.equal(write?.retries, 1);
  assert.equal(write?.socialLockWaitTotalMs, 3);
  assert.equal(write?.socialLockHoldTotalMs, 36);
});

test('room path classifies without acquiring locks; clock/sink failure never masks task result', async () => {
  const { diagnostics, entries } = harness();
  await diagnostics.operation('room_access', 'room_read', async () => { diagnostics.roomPath(true); });
  await diagnostics.operation('room_access', 'room_read', async () => { diagnostics.roomPath(false); });
  assert.deepEqual(entries.map(entry => entry.category), ['joined_room', 'unclaimed_room']);
  assert.ok(entries.every(entry => entry.socialLockAttempts === 0));

  let clocks = 0;
  const broken = createHomiesDiagnostics({
    sampleRate: 1,
    now: () => { if (++clocks > 1) throw new Error('clock'); return 0; },
    emit: () => { throw new Error('sink'); },
  });
  assert.equal(await broken.operation('social_read', 'lookup', async () => 'ok'), 'ok');
  const rejection = new Error('original');
  const sinkThrows = createHomiesDiagnostics({
    sampleRate: 1, now: () => 0, emit: () => { throw new Error('sink'); },
  });
  await assert.rejects(
    sinkThrows.operation('social_read', 'lookup', () => Promise.reject(rejection)),
    error => error === rejection,
  );
});