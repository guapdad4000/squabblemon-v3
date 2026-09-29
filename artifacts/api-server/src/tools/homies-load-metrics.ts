import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { pool } from "@workspace/db";

export const percentile = (values: number[], p: number) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.ceil(p * sorted.length) - 1] * 100) / 100;
};
export const distribution = (values: number[]) => ({ count: values.length,
  p50Ms: percentile(values, .5), p95Ms: percentile(values, .95), p99Ms: percentile(values, .99),
  maxMs: values.length ? Math.round(Math.max(...values) * 100) / 100 : null });

export type Outcome = { operation: string; outcome: string; elapsedMs: number; lagMs: number };
export function makeRecorder() {
  const rows: Outcome[] = [];
  const unexpected: string[] = [];
  async function measure<T>(operation: string, scheduledAt: number, task: () => Promise<T>, expected: number[] = []):
    Promise<{ value?: T; status: number }> {
    const started = performance.now();
    let outcome = "success", status = 200, value: T | undefined;
    try { value = await task(); }
    catch (error) {
      const code = (error as { status?: number }).status;
      if (typeof code === "number" && expected.includes(code)) { status = code; outcome = `expected-${code}`; }
      else {
        status = typeof code === "number" ? code : 0;
        outcome = "unexpected";
        if (unexpected.length < 12) unexpected.push(`${operation}: ${error instanceof Error ? error.message : String(error)}`.slice(0, 160));
      }
    }
    rows.push({ operation, outcome, elapsedMs: performance.now() - scheduledAt, lagMs: Math.max(0, started - scheduledAt) });
    return { value, status };
  }
  return { rows, unexpected, measure, summary(seconds: number) {
    const operations = [...new Set(rows.map(r => r.operation))];
    return { count: rows.length, throughputPerSecond: Math.round(rows.length / seconds * 100) / 100,
      scheduleLag: distribution(rows.map(r => r.lagMs)),
      operations: Object.fromEntries(operations.map(op => [op, Object.fromEntries(
        ["success", "expected-404", "expected-409", "expected-429", "unexpected"].map(outcome =>
          [outcome, distribution(rows.filter(r => r.operation === op && r.outcome === outcome).map(r => r.elapsedMs))]))])) };
  } };
}

/**
 * Isolated benchmark only: full sample arrays and a reserved SQL observer are
 * intentionally NOT used by the bounded runtime Homies diagnostics.
 * Capture actual checkout time; preserve any pre-existing runtime wrapper.
 */
export async function monitorPool() {
  const original = pool.connect.bind(pool);
  const observer = await original();
  const probes = await Promise.all(Array.from({ length: 3 }, () => original()));
  try {
    const pids = await Promise.all(probes.map(c => c.query<{ pid: number }>("select pg_backend_pid() as pid")));
    assert.equal(new Set(pids.map(r => r.rows[0].pid)).size, 3, "Native simultaneous requests must use distinct PostgreSQL backends");
  } finally { probes.forEach(c => c.release()); }
  const acquisitionMs: number[] = [], samples: Array<{ advisoryWaiters: number; poolWaiting: number;
    lockWaiters: number; advisoryQueryAgeMs: number | null; advisoryLocks: number }> = [];
  // Drizzle's node-postgres driver calls connect() on this shared pool for every
  // transaction. Instrument only checkout, avoiding any extra service queries.
  (pool as unknown as { connect: typeof pool.connect }).connect = ((callback?: (...args: any[]) => void) => {
    const started = performance.now();
    if (callback) {
      (original as unknown as (cb: (...args: any[]) => void) => void)((error, client, release) => {
        acquisitionMs.push(performance.now() - started);
        callback(error, client, release);
      });
      return;
    }
    return original().then(client => {
      acquisitionMs.push(performance.now() - started);
      return client;
    });
  }) as typeof pool.connect;
  let busy = false;
  const sample = async () => {
    if (busy) return;
    busy = true;
    try {
      const result = await observer.query<{ advisory_waiters: string; lock_waiters: string; advisory_age_ms: string | null; advisory_locks: string }>(`
        select count(*) filter (where wait_event = 'advisory')::text as advisory_waiters,
          count(*) filter (where wait_event_type = 'Lock')::text as lock_waiters,
          (max(extract(epoch from clock_timestamp() - query_start) * 1000)
            filter (where wait_event = 'advisory' and query like '%pg_advisory_xact_lock%'))::text as advisory_age_ms,
          (select count(*)::text from pg_locks where locktype = 'advisory' and not granted) as advisory_locks
        from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid()`);
      const r = result.rows[0];
      samples.push({ advisoryWaiters: Number(r.advisory_waiters), lockWaiters: Number(r.lock_waiters),
        advisoryQueryAgeMs: r.advisory_age_ms === null ? null : Number(r.advisory_age_ms),
        advisoryLocks: Number(r.advisory_locks), poolWaiting: pool.waitingCount });
    } catch (error) { monitorError = error instanceof Error ? error.message : String(error); }
    finally { busy = false; }
  };
  let monitorError: string | undefined;
  const timer = setInterval(() => { void sample(); }, 100);
  return { proof: { simultaneousDistinctBackendPids: 3, nativeDriver: "node-postgres" },
    snapshot() { return { acquired: acquisitionMs.length, samples: samples.length }; },
    async finish() {
      clearInterval(timer);
      while (busy) await new Promise(resolve => setTimeout(resolve, 10));
      (pool as unknown as { connect: typeof pool.connect }).connect = original as typeof pool.connect;
      observer.release();
      if (monitorError) throw new Error(`Monitor probe failed: ${monitorError}`);
      return { checkoutWait: distribution(acquisitionMs),
        observedSamples: samples.length, peakPoolWaiting: Math.max(0, ...samples.map(s => s.poolWaiting)),
        peakAdvisoryWaiters: Math.max(0, ...samples.map(s => s.advisoryWaiters)),
        peakLockWaiters: Math.max(0, ...samples.map(s => s.lockWaiters)),
        peakAdvisoryLocks: Math.max(0, ...samples.map(s => s.advisoryLocks)),
        advisoryQueryAgeObservedMs: distribution(samples.flatMap(s => s.advisoryQueryAgeMs === null ? [] : [s.advisoryQueryAgeMs])),
        explanation: "Advisory query ages are sampled in-flight SQL durations, NOT exact advisory lock waits. pg_locks values are global snapshots, not summed across players." };
    } };
}