import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertCampaignDatabaseTarget } from "./database-safety.mjs";
import { partitionDatabaseTests } from "./database-test-tiers.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
if (process.env.CAMPAIGN_DATABASE_TESTS !== "1") {
  throw new Error("Set CAMPAIGN_DATABASE_TESTS=1 through the guarded campaign database runner.");
}
assertCampaignDatabaseTarget(process.env);
const testDirectory = join(root, "artifacts", "api-server", "src", "lib");
const { embedded: tests, native } = partitionDatabaseTests(readdirSync(testDirectory));
console.log("Running the embedded-compatible database tier. Native suites are separate required checks, not passed or skipped by this command:");
for (const command of new Set(native.map(entry => entry.command))) {
  console.log(`  REQUIRED: ${command} (${native.filter(entry => entry.command === command).map(entry => entry.name).join(", ")})`);
}
// mail.test.ts retains its generic cases here; the full owned-mail suite and
// payment tests below lib/payments also have separately inventoried commands.
if (!tests.some(name => name.endsWith("newAccountCampaignRoutes.test.ts"))) {
  throw new Error("The full campaign database suite is missing.");
}
const pnpmCli = process.env.npm_execpath;
if (!pnpmCli) throw new Error("Run this command through pnpm.");
const result = spawnSync(
  process.execPath,
  [pnpmCli, "--filter", "@workspace/api-server", "exec", "tsx", "--test", "--test-concurrency=1", ...tests],
  { cwd: root, env: process.env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);
process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
const summary = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
const skipped = [...summary.matchAll(/(?:^|\s)skipped\s+([0-9]+)/gim)]
  .reduce((maximum, match) => Math.max(maximum, Number(match[1])), 0);
if (skipped > 0) {
  throw new Error(`Database test command rejected ${skipped} skipped test(s).`);
}
