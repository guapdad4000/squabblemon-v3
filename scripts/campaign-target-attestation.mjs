function exactOrigin(name, value) {
  if (!value) throw new Error(`${name} is required.`);
  const url = new URL(value);
  if (url.protocol !== "https:" || url.origin !== value.replace(/\/$/, "")) {
    throw new Error(`${name} must be an exact HTTPS origin.`);
  }
  return url.origin;
}

export function assertCampaignTarget(environment, candidate) {
  const expectedEnvironment = environment.CAMPAIGN_E2E_EXPECT_ENVIRONMENT;
  if (!new Set(["staging", "production"]).has(expectedEnvironment)) {
    throw new Error("CAMPAIGN_E2E_EXPECT_ENVIRONMENT must explicitly be staging or production.");
  }
  const expectedOrigin = exactOrigin("CAMPAIGN_E2E_ORIGIN", environment.CAMPAIGN_E2E_ORIGIN);
  if (!candidate || typeof candidate !== "object") throw new Error("Target deployment identity is unavailable.");
  const requiredStrings = ["environment", "context", "deployId", "origin", "databaseFingerprint", "clerkEnvironment"];
  if (requiredStrings.some(name => typeof candidate[name] !== "string" || !candidate[name])) {
    throw new Error("Target deployment identity is incomplete.");
  }
  exactOrigin("Target deployment origin", candidate.origin);
  if (!/^[a-f0-9]{16}$/.test(candidate.databaseFingerprint)) {
    throw new Error("Target database identity is invalid.");
  }
  const expectedContext = candidate.environment === "production"
    ? new Set(["production"])
    : new Set(["deploy-preview", "branch-deploy", "staging"]);
  if (!expectedContext.has(candidate.context)) {
    throw new Error("Target environment does not match its Netlify context.");
  }
  const expected = {
    environment: expectedEnvironment,
    origin: expectedOrigin,
    deployId: environment.CAMPAIGN_E2E_DEPLOY_ID,
    databaseFingerprint: environment.CAMPAIGN_E2E_DATABASE_FINGERPRINT,
    clerkEnvironment: environment.CAMPAIGN_E2E_CLERK_ENV,
  };
  for (const [name, value] of Object.entries(expected)) {
    if (!value || candidate[name] !== value) {
      throw new Error(`Target ${name} does not match the explicitly approved value.`);
    }
  }
  if (expectedEnvironment === "production") {
    const confirmation = `production:${candidate.deployId}:${new URL(candidate.origin).hostname}`;
    if (environment.CAMPAIGN_E2E_ALLOW_PRODUCTION !== confirmation) {
      throw new Error("Production verification requires the exact target-attested deployment confirmation.");
    }
    if (candidate.clerkEnvironment !== "live") {
      throw new Error("Production verification requires the target to attest a live Clerk instance.");
    }
  } else if (candidate.clerkEnvironment !== "test") {
    throw new Error("Staging verification requires the target to attest a Clerk test instance.");
  }
  return candidate;
}
