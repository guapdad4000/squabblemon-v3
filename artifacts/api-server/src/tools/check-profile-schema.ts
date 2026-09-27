// Use the runtime pool so DATABASE_URL / Netlify branch selection and search_path
// are identical to signed-in bootstrap. Never print the URL or raw pg errors.
export {};

let closePool: (() => Promise<void>) | undefined;
try {
  let missing: { tables: string[]; columns: string[] };
  try {
    // Import inside the guard: connection resolution itself can fail.
    const { checkPlayerBootstrapSchema, pool } = await import("@workspace/db");
    closePool = () => pool.end();
    missing = await checkPlayerBootstrapSchema((statement, values) =>
      pool.query<{ table_name: string; table_exists: boolean; attname: string | null }>(statement, values),
    );
  } catch {
    throw new Error(
      "Could not inspect the runtime database. Check database access and the selected deployment branch, then retry.",
    );
  }
  if (missing.tables.length || missing.columns.length) {
    throw new Error(
      `Missing required player bootstrap schema: ` +
      [
        ...(missing.tables.length ? [`tables: ${missing.tables.join(", ")}`] : []),
        ...(missing.columns.length ? [`columns: ${missing.columns.join(", ")}`] : []),
      ].join("; ") + ". " +
      "Apply the reviewed migrations to this exact database target before starting the API. " +
      "See docs/economy/rarity-style-shards.md#runtime-profile-schema-preflight.",
    );
  }
  process.stdout.write("Runtime player bootstrap schema is compatible.\n");
} catch (error) {
  process.stderr.write(`Profile schema preflight failed: ${(error as Error).message}\n`);
  process.exitCode = 1;
} finally {
  await closePool?.().catch(() => {});
}