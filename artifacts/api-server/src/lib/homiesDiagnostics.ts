import { AsyncLocalStorage } from "node:async_hooks";
import { performance } from "node:perf_hooks";
import {
  createHomiesDiagnosticsReporter,
  type HomiesCategory,
  type HomiesDiagnosticEvent,
  type HomiesMeasurement,
  type HomiesOperation,
} from "./homiesDiagnosticsReporter";

type Sample = { values: HomiesMeasurement; startedAt: number; valid: boolean; finished: boolean };
type TransactionSample = { sample: Sample; acquiredAt?: number };
type Options = {
  sampleRate: number;
  emit: (level: "info" | "warn", event: HomiesDiagnosticEvent) => void;
  now?: () => number;
  random?: () => number;
};

/** Request-local scalars only: no identifiers, SQL, payloads, timers, or sample buffers. */
export function createHomiesDiagnostics(options: Options) {
  const sampleRate = Number.isFinite(options.sampleRate) && options.sampleRate > 0 && options.sampleRate <= 1
    ? options.sampleRate : 0;
  const operationScope = new AsyncLocalStorage<Sample>();
  const transactionScope = new AsyncLocalStorage<TransactionSample>();
  const now = options.now ?? (() => performance.now());
  const random = options.random ?? Math.random;
  const reporter = createHomiesDiagnosticsReporter({ sampleRate, emit: options.emit, now });

  function clock(sample?: Sample): number | undefined {
    try {
      const value = now();
      if (Number.isFinite(value) && value >= 0) return value;
    } catch { /* Observability must never change the operation's result. */ }
    if (sample) sample.valid = false;
    return undefined;
  }
  function current() {
    const sample = operationScope.getStore();
    return sample?.valid && !sample.finished ? sample : undefined;
  }
  function elapsed(sample: Sample, start: number | undefined) {
    const end = clock(sample);
    if (start === undefined || end === undefined || end < start) {
      sample.valid = false;
      return 0;
    }
    return end - start;
  }
  function outcome(error: unknown): HomiesMeasurement["outcome"] {
    // Only the status class is retained. Never stringify the thrown value.
    try {
      const status = (error as { status?: unknown } | null)?.status;
      if (typeof status === "number" && status >= 400 && status < 500) return "rejected";
    } catch { /* A hostile error getter must not mask the original failure. */ }
    return "error";
  }
  function operation<T>(category: HomiesCategory, name: HomiesOperation, run: () => Promise<T>): Promise<T> {
    if (!sampleRate || operationScope.getStore()) return run();
    let selected = sampleRate === 1;
    try {
      if (sampleRate < 1) {
        const draw = random();
        selected = Number.isFinite(draw) && draw >= 0 && draw < sampleRate;
      }
    } catch { /* A broken sampler disables this sample, never the operation. */ }
    if (!selected) return run();
    const startedAt = clock();
    if (startedAt === undefined) return run();
    const sample: Sample = { startedAt, valid: true, finished: false, values: {
      category, operation: name, outcome: "ok", operationMs: 0, transactions: 0, retries: 0,
      checkoutCount: 0, checkoutErrors: 0, checkoutTotalMs: 0, checkoutMaxMs: 0, poolWaitingPeak: 0,
      socialLockAttempts: 0, socialLockAcquired: 0, socialLockWaitTotalMs: 0, socialLockWaitMaxMs: 0,
      socialLockHoldTotalMs: 0, socialLockHoldMaxMs: 0,
    } };
    return operationScope.run(sample, async () => {
      try { return await run(); }
      catch (error) { sample.values.outcome = outcome(error); throw error; }
      finally {
        sample.values.operationMs = elapsed(sample, startedAt);
        sample.finished = true;
        if (sample.valid) reporter.record(sample.values);
      }
    });
  }
  function transaction<T>(run: () => Promise<T>): Promise<T> {
    const sample = current();
    if (!sample) return run();
    sample.values.transactions++;
    const tx: TransactionSample = { sample };
    return transactionScope.run(tx, async () => {
      try { return await run(); }
      finally {
        // The supplied existing db.transaction has settled: COMMIT/ROLLBACK and
        // client release are included, not just its user callback.
        if (tx.acquiredAt !== undefined) {
          const held = elapsed(sample, tx.acquiredAt);
          sample.values.socialLockHoldTotalMs += held;
          sample.values.socialLockHoldMaxMs = Math.max(sample.values.socialLockHoldMaxMs, held);
        }
      }
    });
  }
  function socialLock<T>(run: () => Promise<T>): Promise<T> {
    const sample = current();
    const tx = transactionScope.getStore();
    if (!sample || tx?.sample !== sample) return run();
    sample.values.socialLockAttempts++;
    const startedAt = clock(sample);
    return (async () => {
      try {
        const result = await run();
        // Timestamp on SQL acknowledgement. It is a client-observed duration,
        // not a claim to measure PostgreSQL's internal lock grant instant.
        const acquiredAt = clock(sample);
        if (tx.acquiredAt === undefined) tx.acquiredAt = acquiredAt;
        sample.values.socialLockAcquired++;
        return result;
      } finally {
        const waited = elapsed(sample, startedAt);
        sample.values.socialLockWaitTotalMs += waited;
        sample.values.socialLockWaitMaxMs = Math.max(sample.values.socialLockWaitMaxMs, waited);
      }
    })();
  }
  function startCheckout(waitingCount: () => number) {
    const sample = current();
    if (!sample) return undefined;
    const startedAt = clock(sample);
    sample.values.checkoutCount++;
    let finished = false;
    const queued = () => {
      try {
        const waiting = waitingCount();
        if (Number.isFinite(waiting) && waiting >= 0)
          sample.values.poolWaitingPeak = Math.max(sample.values.poolWaitingPeak, waiting);
      } catch { /* Pool gauges are optional; checkout/result handling is not. */ }
    };
    queued();
    return {
      queued,
      finish(failed: boolean) {
        if (finished) return;
        finished = true;
        const waited = elapsed(sample, startedAt);
        sample.values.checkoutTotalMs += waited;
        sample.values.checkoutMaxMs = Math.max(sample.values.checkoutMaxMs, waited);
        if (failed) sample.values.checkoutErrors++;
        queued();
      },
    };
  }
  function roomPath(joined: boolean) {
    const sample = current();
    if (sample && ["room_read", "room_join", "room_command"].includes(sample.values.operation))
      sample.values.category = joined ? "joined_room" : "unclaimed_room";
  }
  function retry() {
    const sample = current();
    if (sample) sample.values.retries++;
  }
  return { enabled: sampleRate > 0, operation, transaction, socialLock, startCheckout, roomPath, retry };
}

export type HomiesDiagnostics = ReturnType<typeof createHomiesDiagnostics>;