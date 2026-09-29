import { spawn, spawnSync } from "node:child_process";
import { accessSync, constants, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { verifyNativeMigrationTransactions } from "./verify-native-migration-transactions.mjs";

// Always use a newly owned native cluster. Never take a caller's DATABASE_URL.
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const requireDb = createRequire(new URL("../lib/db/package.json", import.meta.url));
const { Client } = requireDb("pg");
const bins = (process.env.PATH ?? "").split(delimiter);
const config = spawnSync("pg_config", ["--bindir"], { encoding: "utf8" });
if (config.status === 0) bins.push(config.stdout.trim());
const hasPostgres = dir => {
  try { for (const name of ["initdb", "pg_ctl"]) accessSync(join(dir, name), constants.X_OK); return true; } catch { return false; }
};
let bin = bins.find(hasPostgres);
// The lazy Nix store can be expensive to enumerate after a workspace restart.
// Prefer the installed toolchain before searching the store as a fallback.
if (!bin) {
  try {
    bin = readdirSync("/nix/store").filter(n => /-postgresql-[0-9]/.test(n)).sort().reverse()
      .map(n => join("/nix/store", n, "bin")).find(hasPostgres);
  } catch {}
}
if (!bin || process.getuid?.() === 0) throw new Error("Feedback tests require native PostgreSQL and an unprivileged OS user.");
if (process.env.DATABASE_URL) throw new Error("Unset DATABASE_URL: feedback tests only use their own disposable native cluster.");
const directory = mkdtempSync(join(tmpdir(), "events-feedback-pg-"));
const data = join(directory, "data");
let started = false;
let child;
const environment = {
  PATH: process.env.PATH, HOME: process.env.HOME,
  NODE_ENV: "test", DATABASE_POOL_MAX: "5", EVENTS_FEEDBACK_TEST_OWNED: "1",
};
function run(command, args, label, visible = false) {
  return new Promise((resolve, reject) => {
    child = spawn(command, args, { cwd: root, env: environment, stdio: visible ? "inherit" : "ignore" });
    child.once("error", () => { child = undefined; reject(new Error(`${label} could not start.`)); });
    child.once("exit", code => { child = undefined; code === 0 ? resolve() : reject(new Error(`${label} failed.`)); });
  });
}
function runTests(command, args) {
  return new Promise((resolve, reject) => {
    child = spawn(command, args, { cwd: root, env: environment, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", chunk => { output += chunk.toString(); });
    child.stderr.on("data", chunk => { output += chunk.toString(); });
    child.once("error", () => { child = undefined; reject(new Error("Feedback API tests could not start.")); });
    child.once("exit", code => {
      child = undefined;
      if (output.includes("NEVER_LOG_FEEDBACK_SENTINEL_78a12")) {
        reject(new Error("Feedback API logs leaked request content."));
      } else {
        process.stdout.write(output);
        code === 0 ? resolve() : reject(new Error("Feedback API tests failed."));
      }
    });
  });
}
async function port() {
  const socket = createServer();
  await new Promise(resolve => socket.listen(0, "127.0.0.1", resolve));
  const value = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  return value;
}
async function queryDb(url, callback) {
  const client = new Client({ connectionString: url });
  await client.connect();
  try { await callback(client); } finally { await client.end(); }
}
async function apply(client, file) {
  await client.query(readFileSync(file, "utf8"));
}
async function verify(client) {
  const indexes = await client.query("SELECT indexname FROM pg_indexes WHERE tablename = 'event_feedback'");
  for (const name of ["event_feedback_pkey", "event_feedback_author_retry_unique", "event_feedback_feed_order", "event_feedback_author_time"]) {
    if (!indexes.rows.some(row => row.indexname === name)) throw new Error(`Missing feedback index: ${name}`);
  }
  const constraints = await client.query("SELECT conname FROM pg_constraint WHERE conrelid = 'event_feedback'::regclass");
  for (const name of ["event_feedback_category_check", "event_feedback_message_check", "event_feedback_display_name_check", "event_feedback_clerk_user_id_player_profiles_clerk_user_id_fk"]) {
    if (!constraints.rows.some(row => row.conname === name) && name !== "event_feedback_clerk_user_id_player_profiles_clerk_user_id_fk") throw new Error(`Missing feedback constraint: ${name}`);
  }
  if (!constraints.rows.some(row => row.conname.endsWith("_fkey"))) throw new Error("Missing feedback author foreign key.");
  const columns = await client.query("SELECT datetime_precision FROM information_schema.columns WHERE table_name='event_feedback' AND column_name='created_at'");
  if (columns.rows[0]?.datetime_precision !== 3) throw new Error("Feedback timestamp precision is not milliseconds.");
}
const interrupt = () => child?.kill("SIGTERM");
process.on("SIGINT", interrupt);
process.on("SIGTERM", interrupt);
try {
  const p = await port();
  await run(join(bin, "initdb"), ["-D", data, "-A", "trust", "-U", "postgres", "--no-locale", "--encoding=UTF8"], "Owned cluster initialization");
  await run(join(bin, "pg_ctl"), ["-D", data, "-l", join(directory, "postgres.log"), "-o", `-h 127.0.0.1 -p ${p} -k ${directory}`, "-w", "-t", "30", "start"], "Owned cluster startup");
  started = true;
  const base = `postgresql://postgres@127.0.0.1:${p}/postgres`;
  await queryDb(base, async client => {
    await client.query("CREATE DATABASE events_feedback_dev");
    await client.query("CREATE DATABASE events_feedback_native");
  });
  const initial = join(root, "netlify/database/migrations/202609170001_initial-game/migration.sql");
  for (const history of ["dev", "native"]) {
    const url = `postgresql://postgres@127.0.0.1:${p}/events_feedback_${history}`;
    await queryDb(url, async client => {
      if (history === "dev") {
        await apply(client, initial);
        for (const entry of readdirSync(join(root, "lib/db/migrations")).filter(n => n.endsWith(".sql")).sort()) {
          await apply(client, join(root, "lib/db/migrations", entry));
        }
      } else {
        await verifyNativeMigrationTransactions(client, root);
      }
      await apply(client, join(root, history === "dev" ? "lib/db/migrations/20260928_event_feedback.sql" : "netlify/database/migrations/202610010005_event-feedback/migration.sql"));
      await verify(client);
    });
    if (history === "native") environment.DATABASE_URL = url;
  }
  console.info("Both isolated development and native migration histories verified.");
  const pnpm = process.env.npm_execpath ? [process.execPath, process.env.npm_execpath] : ["pnpm"];
  const browserOnly = process.argv.includes("--browser-only");
  const migrationsOnly = process.argv.includes("--migrations-only");
  if (!browserOnly && !migrationsOnly) await runTests(pnpm[0], [...pnpm.slice(1), "--filter", "@workspace/api-server", "exec", "tsx", "--test", "--test-concurrency=1", "src/lib/eventFeedback.test.ts"]);
  if (browserOnly || process.argv.includes("--browser")) {
    const separator = process.argv.indexOf("--");
    const browserArgs = separator < 0 ? [] : process.argv.slice(separator + 1);
    await run(process.execPath, ["artifacts/squabblemon/scripts/check-events-browser.mjs", ...browserArgs], "Feedback browser journey", true);
  }
} catch {
  console.error("Feedback test database setup or checks failed. No external database was touched.");
  process.exitCode = 1;
} finally {
  if (started) {
    const stopped = spawnSync(join(bin, "pg_ctl"), ["-D", data, "-w", "-t", "30", "-m", "immediate", "stop"], { stdio: "ignore" });
    if (stopped.status !== 0) process.exitCode = 1;
  }
  try { accessSync(join(data, "postmaster.pid")); console.error("Owned cluster still running; retaining directory."); process.exitCode = 1; }
  catch { rmSync(directory, { recursive: true, force: true }); }
  process.removeListener("SIGINT", interrupt);
  process.removeListener("SIGTERM", interrupt);
}