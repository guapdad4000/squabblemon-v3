import { db, pool } from "@workspace/db";
import { logger } from "./logger";
import { createHomiesDiagnostics } from "./homiesDiagnostics";
import { parseHomiesSampleRate } from "./homiesDiagnosticsReporter";
import { instrumentHomiesPool } from "./homiesPoolDiagnostics";

/** Read once at process start. Disabled/invalid configuration does not wrap the pool. */
export const homiesDiagnostics = createHomiesDiagnostics({
  sampleRate: parseHomiesSampleRate(process.env.HOMIES_DIAGNOSTICS_SAMPLE_RATE),
  emit: (level, event) => logger[level](event, "Homies operation diagnostics"),
});
instrumentHomiesPool(pool, homiesDiagnostics);

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
/** Exactly one existing transaction per call; no observer lease or SQL probes. */
export function homiesTransaction<T>(run: (tx: Tx) => Promise<T>): Promise<T> {
  return homiesDiagnostics.transaction(() => db.transaction(run));
}