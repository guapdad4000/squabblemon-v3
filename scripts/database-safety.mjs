import { createHash } from "node:crypto";

export function databaseFingerprint(connectionString) {
  const url = new URL(connectionString);
  const database = url.pathname.replace(/^\//, "");
  if (!database) throw new Error("Database URL must name a database.");
  return createHash("sha256")
    .update([
      `${decodeURIComponent(url.username).toLowerCase()}@${url.hostname.toLowerCase()}:${url.port || "5432"}/${decodeURIComponent(database)}`,
      ...["schema", "search_path", "options"]
        .filter(name => url.searchParams.has(name))
        .map(name => `${name}=${url.searchParams.get(name)}`),
    ].join("|"))
    .digest("hex")
    .slice(0, 16);
}

export function assertCampaignDatabaseTarget(environment) {
  const connectionString = environment.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required; database suites never skip.");
  const url = new URL(connectionString);
  const local = ["127.0.0.1", "localhost", "::1"].includes(url.hostname.toLowerCase());
  const fingerprint = databaseFingerprint(connectionString);
  if (local) return { fingerprint, local: true, environment: "local" };
  if (environment.CAMPAIGN_DATABASE_FINGERPRINT !== fingerprint) {
    throw new Error("CAMPAIGN_DATABASE_FINGERPRINT does not match the selected database.");
  }
  if (environment.APP_ENV === "staging") {
    if (environment.ALLOW_REMOTE_CAMPAIGN_DATABASE !== `staging:${fingerprint}`) {
      throw new Error("Remote database authorization token is missing or does not match staging.");
    }
    return { fingerprint, local: false, environment: "staging" };
  }
  if (environment.APP_ENV === "production") {
    const deployId = environment.CAMPAIGN_E2E_DEPLOY_ID;
    const expected = `production:${fingerprint}:${deployId ?? ""}`;
    if (!deployId || environment.ALLOW_REMOTE_CAMPAIGN_DATABASE !== expected) {
      throw new Error("Production database access requires an exact database and deployment-scoped token.");
    }
    if (environment.CAMPAIGN_E2E_ALLOW_PRODUCTION !== `production:${deployId}:${new URL(environment.CAMPAIGN_E2E_ORIGIN).hostname}`) {
      throw new Error("Production database access requires the matching origin confirmation.");
    }
    return { fingerprint, local: false, environment: "production" };
  }
  throw new Error("Remote campaign database tests require APP_ENV=staging or an explicitly confirmed production run.");
}
export function assertOwnedPgliteReady(candidate, expectedToken) {
  if (
    !candidate ||
    candidate.type !== "pglite-ready" ||
    candidate.token !== expectedToken ||
    candidate.host !== "127.0.0.1" ||
    !Number.isInteger(candidate.port) ||
    candidate.port <= 1024 ||
    candidate.port > 65535
  ) {
    throw new Error("PGlite readiness did not come from the owned loopback child process.");
  }
  return { host: candidate.host, port: candidate.port };
}