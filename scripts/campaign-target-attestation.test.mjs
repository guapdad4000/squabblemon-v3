import assert from "node:assert/strict";
import test from "node:test";
import { assertCampaignTarget } from "./campaign-target-attestation.mjs";

const stagingEnvironment = {
  CAMPAIGN_E2E_EXPECT_ENVIRONMENT: "staging",
  CAMPAIGN_E2E_ORIGIN: "https://deploy-123.example.netlify.app",
  CAMPAIGN_E2E_DEPLOY_ID: "deploy-123",
  CAMPAIGN_E2E_DATABASE_FINGERPRINT: "0123456789abcdef",
  CAMPAIGN_E2E_CLERK_ENV: "test",
};
const stagingIdentity = {
  environment: "staging",
  context: "deploy-preview",
  deployId: "deploy-123",
  origin: "https://deploy-123.example.netlify.app",
  databaseFingerprint: "0123456789abcdef",
  clerkEnvironment: "test",
};

test("staging requires every value to match the target-side deployment identity", () => {
  assert.deepEqual(assertCampaignTarget(stagingEnvironment, stagingIdentity), stagingIdentity);
  for (const [field, value] of [
    ["origin", "https://production-alias.example"],
    ["deployId", "deploy-other"],
    ["databaseFingerprint", "fedcba9876543210"],
    ["clerkEnvironment", "live"],
  ]) {
    assert.throws(() => assertCampaignTarget(stagingEnvironment, { ...stagingIdentity, [field]: value }), /does not match|requires/);
  }
  assert.throws(() => assertCampaignTarget(stagingEnvironment, { ...stagingIdentity, context: "production" }), /context/);
});

test("target-attested production is gated even when reached through an unfamiliar alias", () => {
  const identity = {
    ...stagingIdentity,
    environment: "production",
    context: "production",
    origin: "https://production-alias.example",
    clerkEnvironment: "live",
  };
  const environment = {
    ...stagingEnvironment,
    CAMPAIGN_E2E_EXPECT_ENVIRONMENT: "production",
    CAMPAIGN_E2E_ORIGIN: identity.origin,
    CAMPAIGN_E2E_CLERK_ENV: "live",
  };
  assert.throws(() => assertCampaignTarget(environment, identity), /confirmation/);
  environment.CAMPAIGN_E2E_ALLOW_PRODUCTION = "production:deploy-123:production-alias.example";
  assert.equal(assertCampaignTarget(environment, identity).environment, "production");
});

test("caller cannot relabel a target-attested production deployment as staging", () => {
  assert.throws(() => assertCampaignTarget(stagingEnvironment, {
    ...stagingIdentity,
    environment: "production",
    context: "production",
    clerkEnvironment: "live",
  }), /environment/);
});
