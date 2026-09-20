import assert from "node:assert/strict";
import test from "node:test";
import { assertCampaignDatabaseTarget, assertOwnedPgliteReady, databaseFingerprint } from "./database-safety.mjs";

test("database target guard allows local and requires exact staging fingerprint", () => {
  assert.equal(assertCampaignDatabaseTarget({ DATABASE_URL: "postgresql://u:p@127.0.0.1:55439/db" }).local, true);
  const url = "postgresql://u:p@stage.example:5432/campaign";
  const fingerprint = databaseFingerprint(url);
  assert.throws(() => assertCampaignDatabaseTarget({ DATABASE_URL: url, APP_ENV: "staging" }), /FINGERPRINT/);
  assert.throws(() => assertCampaignDatabaseTarget({
    DATABASE_URL: url, APP_ENV: "staging", CAMPAIGN_DATABASE_FINGERPRINT: fingerprint,
  }), /authorization token/);
  assert.equal(assertCampaignDatabaseTarget({
    DATABASE_URL: url,
    APP_ENV: "staging",
    CAMPAIGN_DATABASE_FINGERPRINT: fingerprint,
    ALLOW_REMOTE_CAMPAIGN_DATABASE: `staging:${fingerprint}`,
  }).environment, "staging");
});

test("production database target requires matching database, deploy, and origin confirmations", () => {
  const url = "postgresql://u:p@prod.example:5432/campaign";
  const fingerprint = databaseFingerprint(url);
  const base = {
    DATABASE_URL: url,
    APP_ENV: "production",
    CAMPAIGN_DATABASE_FINGERPRINT: fingerprint,
    CAMPAIGN_E2E_DEPLOY_ID: "deploy-123",
    CAMPAIGN_E2E_ORIGIN: "https://squabble.today",
  };
  assert.throws(() => assertCampaignDatabaseTarget(base), /deployment-scoped/);
  assert.throws(() => assertCampaignDatabaseTarget({
    ...base,
    ALLOW_REMOTE_CAMPAIGN_DATABASE: `production:${fingerprint}:deploy-123`,
  }), /origin confirmation/);
  assert.equal(assertCampaignDatabaseTarget({
    ...base,
    ALLOW_REMOTE_CAMPAIGN_DATABASE: `production:${fingerprint}:deploy-123`,
    CAMPAIGN_E2E_ALLOW_PRODUCTION: "production:deploy-123:squabble.today",
  }).environment, "production");
});
test("PGlite readiness requires the exact spawned child token and loopback endpoint", () => {
  const token = "3c42ab84-b3e4-4da5-9d2b-7fb767331635";
  const ready = {
    type: "pglite-ready",
    token,
    host: "127.0.0.1",
    port: 49152,
  };
  assert.deepEqual(assertOwnedPgliteReady(ready, token), {
    host: "127.0.0.1",
    port: 49152,
  });
  assert.throws(
    () => assertOwnedPgliteReady({ ...ready, token: "wrong" }, token),
    /owned loopback child/,
  );
  assert.throws(
    () => assertOwnedPgliteReady({ ...ready, host: "0.0.0.0" }, token),
    /owned loopback child/,
  );
  assert.throws(
    () => assertOwnedPgliteReady({ ...ready, port: 55439.5 }, token),
    /owned loopback child/,
  );
});