import { defineConfig, devices } from "@playwright/test";

const value = process.env.CAMPAIGN_E2E_ORIGIN;
if (!value) throw new Error("CAMPAIGN_E2E_ORIGIN is required.");
const url = new URL(value);
if (url.protocol !== "https:" || url.origin !== value.replace(/\/$/, "")) {
  throw new Error("CAMPAIGN_E2E_ORIGIN must be an exact HTTPS origin.");
}
const expectedEnvironment = process.env.CAMPAIGN_E2E_EXPECT_ENVIRONMENT;
if (expectedEnvironment !== "staging" && expectedEnvironment !== "production") {
  throw new Error("CAMPAIGN_E2E_EXPECT_ENVIRONMENT must explicitly be staging or production.");
}
const productionToken = `production:${process.env.CAMPAIGN_E2E_DEPLOY_ID ?? ""}:${url.hostname}`;
if (expectedEnvironment === "production" && process.env.CAMPAIGN_E2E_ALLOW_PRODUCTION !== productionToken) {
  throw new Error("Production browser verification requires the exact deployment-scoped confirmation token.");
}

export default defineConfig({
  testDir: ".",
  testMatch: "new-account-campaign.remote.spec.ts",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 20 * 60_000,
  expect: { timeout: 20_000 },
  outputDir: "test-results/campaign",
  reporter: [["line"], ["json", { outputFile: "test-results/campaign/results.json" }]],
  use: {
    baseURL: url.origin,
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
});
