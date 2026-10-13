import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { assertOwnedPgliteReady } from "./database-safety.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (process.env.DATABASE_URL)
  throw new Error(
    "Player notes tests require their own disposable database; unset DATABASE_URL.",
  );
const token = randomUUID();
const database = spawn(
  process.execPath,
  ["artifacts/gameplay-test-db/server.mjs"],
  {
    cwd: root,
    env: { ...process.env, PGLITE_PORT: "0", PGLITE_READY_TOKEN: token },
    stdio: ["ignore", "pipe", "inherit"],
  },
);
async function run(args, env) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: root,
      env,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Test command failed (${code})`)),
    );
  });
}
try {
  const ready = await new Promise((resolve, reject) => {
    let buffer = "";
    const timer = setTimeout(
      () => reject(new Error("Disposable database did not start.")),
      20000,
    );
    database.on("error", reject);
    database.stdout.on("data", (chunk) => {
      buffer += String(chunk);
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const identity = assertOwnedPgliteReady(JSON.parse(line), token);
          clearTimeout(timer);
          resolve(identity);
        } catch (error) {
          reject(error);
        }
      }
    });
  });
  const env = {
    ...process.env,
    DATABASE_URL: `postgresql://postgres:postgres@127.0.0.1:${ready.port}/postgres`,
    DATABASE_POOL_MAX: "1",
    TSX_TSCONFIG_PATH: "scripts/player-notes-api.tsconfig.json",
  };
  await run(
    [
      "lib/db/node_modules/drizzle-kit/bin.cjs",
      "push",
      "--config",
      "artifacts/gameplay-test-db/drizzle.config.ts",
    ],
    env,
  );
  const requireDb = createRequire(
    new URL("../lib/db/package.json", import.meta.url),
  );
  const { Client } = requireDb("pg");
  const client = new Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  try {
    const migration = readFileSync(
      resolve(
        root,
        "netlify/database/migrations/202610130002_player-community/migration.sql",
      ),
      "utf8",
    );
    await client.query(migration);
    await client.query(migration);
  } finally {
    await client.end();
  }
  await run(
    [
      "--import",
      "./scripts/node_modules/tsx/dist/loader.mjs",
      "--test",
      "--test-concurrency=1",
      "artifacts/api-server/src/lib/playerNotes.test.ts",
      "artifacts/api-server/src/lib/socialRecords.test.ts",
      "artifacts/api-server/src/lib/rankedMatches.test.ts",
      "artifacts/api-server/src/lib/activityRoutes.test.ts",
      "artifacts/api-server/src/lib/playerRewardTransactions.test.ts",
      "artifacts/api-server/src/lib/legendBounties.test.ts",
      "artifacts/api-server/src/lib/accountRewards.test.ts",
    ],
    env,
  );
} finally {
  database.kill("SIGTERM");
}
