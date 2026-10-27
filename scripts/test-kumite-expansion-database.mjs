import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { assertCampaignDatabaseTarget } from "./database-safety.mjs";
import path from "node:path";
import os from "node:os";
const root = path.resolve(import.meta.dirname, "..");
const versions = fs.existsSync("/usr/lib/postgresql")
  ? fs.readdirSync("/usr/lib/postgresql").sort((a, b) => Number(b) - Number(a))
  : [];
const bin =
  process.env.KUMITE_POSTGRES_BIN ??
  versions
    .map((v) => "/usr/lib/postgresql/" + v + "/bin")
    .find((p) => fs.existsSync(p + "/initdb"));
if (!bin || process.getuid?.() === 0)
  throw Error(
    "Kumite race tests require native PostgreSQL and an unprivileged user.",
  );
if (process.env.DATABASE_URL)
  throw Error("This runner only accepts its own temporary database.");
const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "kumite-expansion-pg-"),
  ),
  out = directory;
const server = createServer();
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
await new Promise((r) => server.close(r));
const config = out + "/api-source-test.tsconfig.json";
fs.writeFileSync(
  config,
  JSON.stringify({
    compilerOptions: {
      moduleResolution: "bundler",
      jsx: "react-jsx",
      paths: {
        "@workspace/db": [root + "/lib/db/src/index.ts"],
        "@workspace/db/*": [root + "/lib/db/src/*"],
        "@workspace/squabblemon-engine": [
          root + "/lib/squabblemon-engine/src/gameEngine.ts",
        ],
        "@workspace/squabblemon-engine/*": [
          root + "/lib/squabblemon-engine/src/*",
        ],
        "@workspace/api-zod": [root + "/lib/api-zod/src/index.ts"],
        "@workspace/api-client-react": [
          root + "/lib/api-client-react/src/index.ts",
        ],
      },
    },
  }),
);
function sync(cmd, args, env = process.env, cwd = root) {
  const x = spawnSync(cmd, args, {
    env,
    cwd,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  process.stdout.write(x.stdout ?? "");
  process.stderr.write(x.stderr ?? "");
  if (x.status !== 0) throw Error("Command failed " + cmd + " " + x.status);
  return x.stdout;
}
let started = false;
try {
  sync(bin + "/initdb", [
    "-D",
    directory + "/data",
    "-A",
    "trust",
    "-U",
    "postgres",
    "--no-locale",
  ]);
  sync(bin + "/pg_ctl", [
    "-D",
    directory + "/data",
    "-l",
    directory + "/postgres.log",
    "-o",
    `-F -h 127.0.0.1 -p ${port} -k ${directory} -c max_connections=12`,
    "-w",
    "start",
  ]);
  started = true;
  const env = {
    ...process.env,
    DATABASE_URL: `postgresql://postgres@127.0.0.1:${port}/postgres`,
    CAMPAIGN_DATABASE_TESTS: "1",
    DATABASE_POOL_MAX: "4",
    TSX_TSCONFIG_PATH: config,
  };
  assertCampaignDatabaseTarget(env);
  sync(
    process.execPath,
    [
      root + "/node_modules/drizzle-kit/bin.cjs",
      "push",
      "--config",
      "artifacts/gameplay-test-db/drizzle.config.ts",
    ],
    env,
  );
  console.log("OWNED NATIVE POSTGRESQL 17 · FOUR INDEPENDENT POOL CONNECTIONS");
  sync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--test",
      "--test-concurrency=1",
      "src/lib/bossRaid.test.ts",
      "src/lib/kumite.test.ts",
      "src/lib/kumiteFilmReceipts.test.ts",
      "src/lib/kumiteExpansion.native.test.ts",
      "src/lib/storyPuzzleTransactions.test.ts",
      "src/lib/collectionTransactions.test.ts",
    ],
    env,
    root + "/artifacts/api-server",
  );
} finally {
  if (started)
    sync(bin + "/pg_ctl", [
      "-D",
      directory + "/data",
      "-m",
      "immediate",
      "-w",
      "stop",
    ]);
  fs.rmSync(directory, { recursive: true, force: true });
}
