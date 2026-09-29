import type { pool as databasePool } from "@workspace/db";
import type { HomiesDiagnostics } from "./homiesDiagnostics";

type Pool = typeof databasePool;
type ConnectCallback = Parameters<Pool["connect"]>[0];
type Client = NonNullable<Parameters<ConnectCallback>[1]>;
const installed = new WeakSet<Pool>();

/** Wrap only checkout; never replace clients, queries, release, or transaction SQL. */
export function instrumentHomiesPool(pool: Pool, diagnostics: HomiesDiagnostics): () => void {
  if (!diagnostics.enabled || installed.has(pool)) return () => {};
  const original = pool.connect;
  const connectPromise = original as (this: Pool) => Promise<Client>;
  const wrapped = function (this: Pool, callback?: ConnectCallback) {
    const timing = diagnostics.startCheckout(() => this.waitingCount);
    if (!timing) return callback ? original.call(this, callback) : connectPromise.call(this);
    try {
      if (callback) {
        const result = original.call(this, (error, client, release) => {
          timing.finish(!!error);
          // Preserve the exact client, release callback, error, and callback semantics.
          callback(error, client, release);
        });
        timing.queued();
        return result;
      }
      const pending = connectPromise.call(this);
      timing.queued();
      return pending.then(
        client => { timing.finish(false); return client; },
        error => { timing.finish(true); throw error; },
      );
    } catch (error) {
      timing.finish(true);
      throw error;
    }
  } as Pool["connect"];
  try {
    pool.connect = wrapped;
    installed.add(pool);
  } catch { return () => {}; }
  return () => {
    // Do not remove a later benchmark/observer's wrapper.
    if (pool.connect === wrapped) {
      pool.connect = original;
      installed.delete(pool);
    }
  };
}