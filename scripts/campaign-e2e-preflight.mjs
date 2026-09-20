import { assertCampaignTarget } from "./campaign-target-attestation.mjs";

const required = [
  "CAMPAIGN_E2E_EXPECT_ENVIRONMENT",
  "CAMPAIGN_E2E_ORIGIN",
  "CAMPAIGN_E2E_DEPLOY_ID",
  "CAMPAIGN_E2E_DATABASE_FINGERPRINT",
  "CAMPAIGN_E2E_CLERK_ENV",
  "CAMPAIGN_E2E_RUN_ID",
  "CAMPAIGN_E2E_EMAIL",
  "CAMPAIGN_E2E_PASSWORD",
  "CAMPAIGN_E2E_MANIFEST",
];
for (const name of required) {
  if (!process.env[name]?.trim()) throw new Error(`${name} is required.`);
}
const origin = new URL(process.env.CAMPAIGN_E2E_ORIGIN);
if (origin.protocol !== "https:" || origin.origin !== process.env.CAMPAIGN_E2E_ORIGIN.replace(/\/$/, "")) {
  throw new Error("CAMPAIGN_E2E_ORIGIN must be an exact HTTPS origin.");
}
if (!/^[a-f0-9]{16}$/.test(process.env.CAMPAIGN_E2E_DATABASE_FINGERPRINT)) {
  throw new Error("CAMPAIGN_E2E_DATABASE_FINGERPRINT must be the 16-character database identity.");
}
if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,79}$/.test(process.env.CAMPAIGN_E2E_RUN_ID)) {
  throw new Error("CAMPAIGN_E2E_RUN_ID must be a safe 8-80 character correlation ID.");
}
if (process.env.CAMPAIGN_E2E_EXPECT_ENVIRONMENT === "production") {
  if (!process.env.CAMPAIGN_E2E_VERIFICATION_CODE_FILE?.trim()) {
    throw new Error("Production signup requires CAMPAIGN_E2E_VERIFICATION_CODE_FILE for the post-Continue OTP checkpoint.");
  }
  if (process.env.CAMPAIGN_E2E_VERIFICATION_CODE?.trim()) {
    throw new Error("Production signup cannot use a verification code supplied before Clerk sends the live OTP.");
  }
} else if (!process.env.CAMPAIGN_E2E_VERIFICATION_CODE?.trim() && !process.env.CAMPAIGN_E2E_VERIFICATION_CODE_FILE?.trim()) {
  throw new Error("Staging signup requires a Clerk test code or a post-Continue code file checkpoint.");
}

async function check(path, expected, init) {
  const response = await fetch(new URL(path, origin), {
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
    ...init,
    headers: {
      "content-type": "application/json",
      "x-campaign-run-id": process.env.CAMPAIGN_E2E_RUN_ID,
      ...(init?.headers ?? {}),
    },
  });
  if (response.status !== expected) {
    throw new Error(`Preflight ${path} returned ${response.status}; expected ${expected}.`);
  }
  return response;
}

// This read-only, target-derived attestation is the first remote request. No
// account or campaign write is attempted unless every approved identity matches.
const deployment = await check("/api/deploymentz", 200);
const identity = assertCampaignTarget(process.env, await deployment.json());
const health = await check("/api/healthz", 200);
const readiness = await check("/api/readyz", 200);
await check("/api/player/bootstrap", 401);
await check("/api/player/story", 401);
await check("/api/player/story/development/reset", 404);
if (![deployment, health, readiness].every(response => response.headers.get("x-request-id"))) {
  throw new Error("API responses must include request correlation IDs.");
}
process.stdout.write(`Campaign preflight passed for ${identity.origin} in ${identity.environment} mode.\n`);
