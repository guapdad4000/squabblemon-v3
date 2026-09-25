import { spawn, spawnSync } from "node:child_process";
import { accessSync, constants, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { assertCampaignDatabaseTarget } from "./database-safety.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mailOnly = process.argv.includes('--mail');
process.chdir(root);
let ownedDirectory;
let pgBin;
let child;
let interrupted = false;
const environment = {
  ...process.env,
  CAMPAIGN_DATABASE_TESTS: "1",
  PAYMENT_REQUIRE_POSTGRES: "1",
  DATABASE_POOL_MAX: "5",
};

function discoverPostgres() {
  const directories = (process.env.PATH ?? "").split(delimiter);
  const config = spawnSync("pg_config", ["--bindir"], { encoding: "utf8" });
  if (config.status === 0) directories.push(config.stdout.trim());
  // Nix installations can provide PostgreSQL without putting its tools on PATH.
  try {
    directories.push(...readdirSync("/nix/store")
      .filter(name => /-postgresql-[0-9]/.test(name))
      .sort().reverse().map(name => join("/nix/store", name, "bin")));
  } catch { /* Not a Nix host. */ }
  for (const directory of directories) {
    if (!directory) continue;
    try {
      for (const name of ["initdb", "pg_ctl", "postgres"]) accessSync(join(directory, name), constants.X_OK);
      return directory;
    } catch { /* Try the next complete installation. */ }
  }
  throw new Error("Native PostgreSQL is required for payment lock/rollback tests. Install PostgreSQL tools (initdb, pg_ctl, postgres) on PATH; PGlite is not a substitute.");
}

async function unusedLoopbackPort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

function run(command, args, label, visible = false) {
  if (interrupted) throw new Error("Payment database tests interrupted.");
  return new Promise((resolve, reject) => {
    child = spawn(command, args, {
      cwd: root, env: environment,
      // Setup failures never print connection strings or inherited secrets.
      stdio: visible ? "inherit" : "ignore",
    });
    child.once("error", () => { child = undefined; reject(new Error(`${label} could not start.`)); });
    child.once("exit", code => {
      child = undefined;
      if (code === 0 && !interrupted) resolve();
      else reject(new Error(`${label} failed${code === null ? "" : ` (exit ${code})`}.`));
    });
  });
}

const interrupt = () => {
  interrupted = true;
  child?.kill("SIGTERM");
};
process.on("SIGINT", interrupt);
process.on("SIGTERM", interrupt);

try {
  const provided = process.env.DATABASE_URL?.trim();
  if (mailOnly && provided) throw new Error('Mail broadcast tests require a fresh owned cluster. Unset DATABASE_URL.');
  if (provided) {
    const target = assertCampaignDatabaseTarget(process.env);
    if (!target.local) throw new Error("Payment database tests refuse remote databases.");
    environment.DATABASE_URL = provided;
    console.log("Using caller-provided local PostgreSQL; no schema push or database cleanup will be performed.");
  } else {
    pgBin = discoverPostgres();
    if (process.getuid?.() === 0) throw new Error("Run owned PostgreSQL payment tests as an unprivileged user, not root.");
    ownedDirectory = mkdtempSync(join(tmpdir(), "payment-tests-pg-"));
    const data = join(ownedDirectory, "data");
    const port = await unusedLoopbackPort();
    await run(join(pgBin, "initdb"), ["-D", data, "-A", "trust", "-U", "postgres", "--no-locale", "--encoding=UTF8"], "Owned PostgreSQL initialization");
    await run(join(pgBin, "pg_ctl"), [
      "-D", data, "-l", join(ownedDirectory, "postgres.log"),
      "-o", `-h 127.0.0.1 -p ${port} -k ${ownedDirectory}`,
      "-w", "-t", "30", "start",
    ], "Owned loopback PostgreSQL startup");
    environment.DATABASE_URL = `postgresql://postgres@127.0.0.1:${port}/postgres`;
    assertCampaignDatabaseTarget(environment);
    // Schema push is restricted to the freshly initialized, owned cluster.
    await run(process.execPath, [
      join(dirname(createRequire(new URL('../lib/db/package.json', import.meta.url)).resolve("drizzle-kit")), "bin.cjs"),
      "push", "--config", "artifacts/gameplay-test-db/drizzle.config.ts",
    ], "Fresh payment test schema creation");
    console.log("Using fresh owned native PostgreSQL with independent connections; no external database is modified.");
  }
  const args = ["--filter", "@workspace/api-server", "exec", "tsx", "--test", "--test-concurrency=1",
    ...(mailOnly ? ['src/lib/mail.test.ts'] : ["src/lib/payments/provider.test.ts", "src/lib/payments/service.test.ts", "src/lib/payments/geography.test.ts"])];
  if (mailOnly) environment.MAIL_TEST_OWNED = '1';
  if (process.env.npm_execpath) {
    await run(process.execPath, [process.env.npm_execpath, ...args], "Payment database tests", true);
  } else {
    await run("pnpm", args, "Payment database tests", true);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Payment database tests failed.");
  process.exitCode = 1;
} finally {
  if (ownedDirectory) {
    const stopped = spawnSync(join(pgBin, "pg_ctl"), [
      "-D", join(ownedDirectory, "data"), "-w", "-t", "30", "-m", "immediate", "stop",
    ], { stdio: "ignore" });
    // Never remove a cluster that could still be running.
    let running = false;
    try { accessSync(join(ownedDirectory, "data", "postmaster.pid")); running = true; } catch { /* stopped or never initialized */ }
    if (stopped.status !== 0 && running) {
      console.error("Owned PostgreSQL did not stop; temporary cluster retained for safe manual cleanup.");
      process.exitCode = 1;
    } else rmSync(ownedDirectory, { recursive: true, force: true });
  }
  process.removeListener("SIGINT", interrupt);
  process.removeListener("SIGTERM", interrupt);
}
