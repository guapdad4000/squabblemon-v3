import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertCampaignDatabaseTarget,
  assertOwnedPgliteReady,
} from "./database-safety.mjs";

const workspaceRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(workspaceRoot);

const dailyCloutOnly = process.argv[2] === 'daily-clout';
const starterMythicOnly = process.argv[2] === 'starter-mythic';
const rankedBrowser = process.argv[2] === 'fade-park';
const cosmeticsBrowser = process.argv[2] === 'cosmetics';
const paymentsOnly = process.argv[2] === 'payments';
if (paymentsOnly) {
  await import("./test-payments-database.mjs");
  process.exit(process.exitCode ?? 0);
}
const providedUrl = process.env.DATABASE_URL?.trim();
let databaseUrl = providedUrl;
const pnpmCli = process.env.npm_execpath;
if (!pnpmCli) throw new Error("Run this command through pnpm.");
let databaseProcess;

function run(args, environment) {
  const result = spawnSync(process.execPath, [pnpmCli, ...args], {
    stdio: "inherit",
    env: environment,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
  return result.status === 0;
}

async function startOwnedPglite() {
  const token = randomUUID();
  const child = spawn(process.execPath, ["artifacts/gameplay-test-db/server.mjs"], {
    stdio: ["ignore", "pipe", "inherit"],
    env: {
      ...process.env,
      PGLITE_PORT: "0",
      PGLITE_READY_TOKEN: token,
    },
  });
  databaseProcess = child;

  return await new Promise((resolve, reject) => {
    let buffer = "";
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("Owned PGlite database did not become ready within 20 seconds."));
    }, 20_000);
    timeout.unref?.();

    const fail = error => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    };

    child.once("error", fail);
    child.once("exit", code => {
      if (!settled) {
        fail(new Error(`Owned PGlite process exited before readiness with code ${code}.`));
      }
    });
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", chunk => {
      if (settled) return;
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        let candidate;
        try {
          candidate = JSON.parse(line);
        } catch {
          process.stdout.write(line + "\n");
          continue;
        }
        try {
          const identity = assertOwnedPgliteReady(candidate, token);
          settled = true;
          clearTimeout(timeout);
          resolve(identity);
          return;
        } catch (error) {
          fail(error);
          return;
        }
      }
    });
  });
}

try {
  if (!providedUrl) {
    const identity = await startOwnedPglite();
    databaseUrl =
      `postgresql://postgres:postgres@127.0.0.1:${identity.port}/postgres`;
    const drizzle = spawnSync(
      process.execPath,
      [
        join(
          process.cwd(),
          "lib",
          "db",
          "node_modules",
          "drizzle-kit",
          "bin.cjs",
        ),
        "push",
        "--config",
        "artifacts/gameplay-test-db/drizzle.config.ts",
      ],
      {
        stdio: "inherit",
        env: { ...process.env, DATABASE_URL: databaseUrl },
      },
    );
    if (drizzle.error) throw drizzle.error;
    if (drizzle.status !== 0) process.exit(drizzle.status ?? 1);
    process.stdout.write(
      `Using owned in-memory PGlite database on 127.0.0.1:${identity.port}.\n`,
    );
  } else {
    const target = assertCampaignDatabaseTarget({
      ...process.env,
      DATABASE_URL: databaseUrl,
    });
    process.stdout.write(
      target.local
        ? "Using caller-provided local PostgreSQL database.\n"
        : `Using authorized ${target.environment} database fingerprint ${target.fingerprint}.\n`,
    );
  }

  assertCampaignDatabaseTarget({ ...process.env, DATABASE_URL: databaseUrl });
  run(
    dailyCloutOnly ? ['--filter', '@workspace/api-server', 'exec', 'tsx', '--test', 'src/lib/dailyClout.test.ts'] : starterMythicOnly ? ['--filter', '@workspace/api-server', 'exec', 'tsx', '--test', 'src/lib/starterMythic.test.ts'] : cosmeticsBrowser ? ['exec', 'node', 'scripts/check-cosmetics-browser.mjs'] : rankedBrowser ? ['--filter', '@workspace/api-server', 'exec', 'tsx', '--test', 'src/lib/rankedMatches.test.ts'] : ['--filter', '@workspace/api-server', 'test:db'],
    {
      ...process.env,
      DATABASE_URL: databaseUrl,
      CAMPAIGN_DATABASE_TESTS: "1",
      ...(rankedBrowser ? { FADE_PARK_BROWSER: "1" } : {}),
      ...(databaseProcess ? { DATABASE_POOL_MAX: "1" } : {}),
    },
  );
} finally {
  if (databaseProcess && !databaseProcess.killed) {
    databaseProcess.kill();
  }
}
if (process.exitCode) process.exit(process.exitCode);