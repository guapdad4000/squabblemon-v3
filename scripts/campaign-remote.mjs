import { spawnSync } from "node:child_process";

const pnpmCli = process.env.npm_execpath;
if (!pnpmCli) throw new Error("Run this command through pnpm.");
function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run(process.execPath, ["scripts/campaign-e2e-preflight.mjs"]);
run(process.execPath, [pnpmCli, "--filter", "@workspace/squabblemon", "exec", "playwright", "test", "--config", "e2e/playwright.campaign.config.ts"]);

