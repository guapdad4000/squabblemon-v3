import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createHomiesDiagnosticsReporter,
  HOMIES_DIAGNOSTIC_WINDOW_MS,
  HOMIES_WARNING_THRESHOLDS,
  parseHomiesSampleRate,
  type HomiesDiagnosticEvent,
  type HomiesMeasurement,
} from './homiesDiagnosticsReporter';

function measurement(overrides: Partial<HomiesMeasurement> = {}): HomiesMeasurement {
  return {
    category: 'social_read',
    operation: 'lookup',
    outcome: 'ok',
    operationMs: 10,
    transactions: 1,
    retries: 0,
    checkoutCount: 1,
    checkoutErrors: 0,
    checkoutTotalMs: 5,
    checkoutMaxMs: 5,
    poolWaitingPeak: 0,
    socialLockAttempts: 0,
    socialLockAcquired: 0,
    socialLockWaitTotalMs: 0,
    socialLockWaitMaxMs: 0,
    socialLockHoldTotalMs: 0,
    socialLockHoldMaxMs: 0,
    ...overrides,
  };
}

function capture(now: () => number = () => 0) {
  const entries: { level: 'info' | 'warn'; event: HomiesDiagnosticEvent }[] = [];
  const reporter = createHomiesDiagnosticsReporter({
    sampleRate: 1,
    now,
    emit: (level, event) => { entries.push({ level, event }); },
  });
  return { entries, reporter };
}

test('parses only finite sample rates in the inclusive 0..1 range', () => {
  for (const value of [undefined, '', '   ', 'garbage', 'NaN', 'Infinity', '-Infinity', '-0.01', '1.01']) {
    assert.equal(parseHomiesSampleRate(value), 0);
  }
  assert.equal(parseHomiesSampleRate('0'), 0);
  assert.equal(parseHomiesSampleRate('0.25'), 0.25);
  assert.equal(parseHomiesSampleRate(' 1 '), 1);
  for (const rate of [0, -1, 1.1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const calls: HomiesDiagnosticEvent[] = [];
    createHomiesDiagnosticsReporter({ sampleRate: rate, emit: (_, event) => { calls.push(event); } })
      .record(measurement());
    assert.equal(calls.length, 0);
  }
});

test('warning thresholds are inclusive and joined operations use their own threshold', () => {
  assert.deepEqual(HOMIES_WARNING_THRESHOLDS, {
    checkoutMs: 100,
    socialLockWaitMs: 100,
    socialLockHoldMs: 100,
    joinedOperationMs: 400,
    otherOperationMs: 750,
  });
  let time = 0;
  const { entries, reporter } = capture(() => time);
  const thresholdCases: Array<[Partial<HomiesMeasurement>, string]> = [
    [{ checkoutMaxMs: 100 }, 'checkout'],
    [{ socialLockWaitMaxMs: 100 }, 'social_lock_wait'],
    [{ socialLockHoldMaxMs: 100 }, 'social_lock_hold'],
    [{ category: 'joined_room', operation: 'room_join', operationMs: 400 }, 'operation'],
    [{ category: 'room_access', operation: 'room_read', operationMs: 750 }, 'operation'],
  ];
  for (const [fields, warning] of thresholdCases) {
    reporter.record(measurement(fields));
    const entry = entries.at(-1);
    assert.equal(entry?.level, 'warn');
    assert.deepEqual(entry?.event.warnings, [warning]);
    time += HOMIES_DIAGNOSTIC_WINDOW_MS;
  }
});

test('just below each threshold stays normal', () => {
  const { entries, reporter } = capture();
  reporter.record(measurement({
    checkoutMaxMs: 99.999,
    socialLockWaitMaxMs: 99.999,
    socialLockHoldMaxMs: 99.999,
    operationMs: 749.999,
  }));
  reporter.record(measurement({ category: 'joined_room', operation: 'room_join', operationMs: 399.999 }));
  assert.deepEqual(entries.map(({ level, event }) => [level, event.warnings]), [
    ['info', []], ['info', []],
  ]);
});

test('independent per-category warning and normal budgets reset at the window boundary', () => {
  let time = 0;
  const { entries, reporter } = capture(() => time);
  const normal = measurement();
  const slow = measurement({ checkoutMaxMs: 100 });
  reporter.record(normal);
  reporter.record(normal);
  reporter.record(normal); // suppressed normal
  reporter.record(slow);
  assert.equal(entries.at(-1)?.event.suppressedNormal, 1);
  assert.equal(entries.at(-1)?.event.suppressedWarnings, 0);
  reporter.record(slow);
  reporter.record(slow); // suppressed warning
  reporter.record(measurement({ category: 'joined_room', operation: 'room_read' }));
  assert.equal(entries.length, 5);

  time = HOMIES_DIAGNOSTIC_WINDOW_MS - 1;
  reporter.record(normal);
  reporter.record(slow);
  assert.equal(entries.length, 5);
  time = HOMIES_DIAGNOSTIC_WINDOW_MS;
  reporter.record(normal);
  assert.deepEqual(entries.at(-1)?.event.warnings, []);
  assert.equal(entries.at(-1)?.event.suppressedNormal, 1);
  assert.equal(entries.at(-1)?.event.suppressedWarnings, 2);
  reporter.record(slow);
  assert.equal(entries.at(-1)?.event.suppressedNormal, 0);
  assert.equal(entries.at(-1)?.event.suppressedWarnings, 0);
});

test('a burst of thousands emits at most two events of each kind per category per window', () => {
  const { entries, reporter } = capture();
  for (let i = 0; i < 5000; i++) {
    reporter.record(measurement());
    reporter.record(measurement({ checkoutMaxMs: 100 }));
  }
  assert.equal(entries.length, 4);
  assert.deepEqual(entries.map(entry => entry.level), ['info', 'warn', 'info', 'warn']);
});

test('only allowlisted scalar fields are emitted, not extra IDs, credentials or errors', () => {
  const { entries, reporter } = capture();
  const input = {
    ...measurement(),
    userId: 'user-secret',
    accessToken: 'credential-secret',
    query: 'SELECT secret',
    error: new Error('private-error'),
    payload: { secret: 'private-payload' },
  };
  reporter.record(input);
  const event = entries[0]?.event;
  assert.ok(event);
  assert.deepEqual(Object.keys(event).sort(), [
    'event', 'schemaVersion', 'category', 'operation', 'outcome', 'operationMs',
    'transactions', 'retries', 'checkoutCount', 'checkoutErrors', 'checkoutTotalMs',
    'checkoutMaxMs', 'poolWaitingPeak', 'socialLockAttempts', 'socialLockAcquired',
    'socialLockWaitTotalMs', 'socialLockWaitMaxMs', 'socialLockHoldTotalMs',
    'socialLockHoldMaxMs', 'sampleRate', 'warnings', 'suppressedNormal',
    'suppressedWarnings',
  ].sort());
  assert.equal(event.event, 'homies_diagnostic');
  assert.equal(event.schemaVersion, 1);
  assert.equal(event.sampleRate, 1);
  assert.equal(JSON.stringify(event).includes('secret'), false);
});

test('invalid runtime strings, numbers, and hostile getters are silently discarded', () => {
  const { entries, reporter } = capture();
  reporter.record(measurement({ category: 'user-123' as HomiesMeasurement['category'] }));
  reporter.record(measurement({ operation: 'SELECT *' as HomiesMeasurement['operation'] }));
  reporter.record(measurement({ outcome: 'unknown' as HomiesMeasurement['outcome'] }));
  for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY, '3', undefined]) {
    reporter.record(measurement({ checkoutCount: bad as number }));
  }
  reporter.record({ ...measurement(), get operationMs(): number { throw new Error('getter'); } });
  assert.equal(entries.length, 0);
});

test('throwing clock and sink never throw from record; sink failures still spend budget', () => {
  const sample = measurement();
  const brokenClock = createHomiesDiagnosticsReporter({
    sampleRate: 1,
    now: () => { throw new Error('clock'); },
    emit: () => { throw new Error('unreachable'); },
  });
  assert.doesNotThrow(() => brokenClock.record(sample));

  let attempts = 0;
  const brokenSink = createHomiesDiagnosticsReporter({
    sampleRate: 1,
    now: () => 0,
    emit: () => { attempts++; throw new Error('sink'); },
  });
  assert.doesNotThrow(() => {
    for (let i = 0; i < 1000; i++) brokenSink.record(sample);
  });
  assert.equal(attempts, 2);
});