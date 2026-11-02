import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "node:net";
const require = createRequire(
  new URL("../lib/db/package.json", import.meta.url),
);
const { Pool } = require("pg");
const { build } = createRequire(new URL("../package.json", import.meta.url))(
  "esbuild",
);
const directory = mkdtempSync(join(tmpdir(), "breakthrough-pg-"));
const config = spawnSync("pg_config", ["--bindir"], { encoding: "utf8" });
if (config.status !== 0) throw Error("Native PostgreSQL tools required");
const bin = config.stdout.trim(),
  data = join(directory, "data");
let started = false,
  pool;
const run = (name, args) => {
  const r = spawnSync(join(bin, name), args, { encoding: "utf8" });
  if (r.status !== 0) throw Error(`${name}: ${r.stderr}`);
};
try {
  // Never consume DATABASE_URL: this runner owns a fresh loopback-only database.
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  run("initdb", [
    "-D",
    data,
    "-A",
    "trust",
    "-U",
    "postgres",
    "--no-locale",
    "--encoding=UTF8",
  ]);
  run("pg_ctl", [
    "-D",
    data,
    "-l",
    join(directory, "postgres.log"),
    "-o",
    `-h 127.0.0.1 -p ${port} -k ${directory}`,
    "-w",
    "start",
  ]);
  started = true;
  pool = new Pool({
    host: "127.0.0.1",
    port,
    user: "postgres",
    database: "postgres",
    max: 5,
  });
  await pool.query(
    readFileSync(
      new URL(
        "../lib/db/migrations/20261102_breakthrough_rooms.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await pool.query(
    readFileSync(
      new URL(
        "../lib/db/migrations/20261102_breakthrough_sessions.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const output = join(directory, "test.mjs");
  await build({
    entryPoints: [
      new URL("./test-breakthrough-database-suite.ts", import.meta.url)
        .pathname,
    ],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: output,
  });
  await (await import(output)).verify(pool);
  const onlineOutput = join(directory, "online.mjs");
  await build({
    entryPoints: [
      new URL("./test-breakthrough-online-suite.ts", import.meta.url).pathname,
    ],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: onlineOutput,
    banner: {
      js: 'import { createRequire as __createRequire } from "node:module"; const require=__createRequire(import.meta.url);',
    },
  });
  await (await import(onlineOutput)).verifyOnline(pool);
  if (process.argv.includes("--browser")) {
    await pool.query(
      "TRUNCATE breakthrough_searches,breakthrough_receipts,breakthrough_records,breakthrough_room_outbox,breakthrough_room_journal,breakthrough_rooms CASCADE",
    );
    const browserOutput = join(directory, "browser.mjs");
    await build({
      entryPoints: [
        new URL("./test-breakthrough-browser-suite.ts", import.meta.url)
          .pathname,
      ],
      bundle: true,
      platform: "node",
      format: "esm",
      outfile: browserOutput,
      banner: {
        js: 'import { createRequire as __createRequire } from "node:module"; const require=__createRequire(import.meta.url);',
      },
    });
    await (await import(browserOutput)).verifyBrowser(pool);
  }
} finally {
  await pool?.end();
  if (started) run("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
  rmSync(directory, { recursive: true, force: true });
}
