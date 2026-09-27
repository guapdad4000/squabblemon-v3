import type { Context } from "@netlify/functions";
import { runStoreSmokeCheck } from "../../lib/payments/storeSmokeCheck";

// Use the same pool and search_path as the deployed API, not a build-time
// database URL or a separate branch lookup. Import only after deployment:
// Netlify executes native migrations before invoking deploy-succeeded.
export async function checkDeployedProfileSchema(
  query?: (statement: string, values: [string[]]) => Promise<{
    rows: Array<{ table_name: string; table_exists: boolean; attname: string | null }>;
  }>,
): Promise<void> {
  let missing: { tables: string[]; columns: string[] };
  try {
    const { checkPlayerBootstrapSchema, pool } = await import("@workspace/db");
    missing = await checkPlayerBootstrapSchema(query ?? ((statement, values) =>
      pool.query<{ table_name: string; table_exists: boolean; attname: string | null }>(statement, values)));
  } catch {
    // pg errors can contain connection details. Never forward them to logs or alerts.
    throw new Error("Post-deploy profile schema check could not inspect the API database branch.");
  }
  if (missing.tables.length || missing.columns.length) {
    throw new Error(`Post-deploy player bootstrap schema check failed: ${[
      ...(missing.tables.length ? [`missing tables: ${missing.tables.join(", ")}`] : []),
      ...(missing.columns.length ? [`missing columns: ${missing.columns.join(", ")}`] : []),
    ].join("; ")}.`);
  }
}

async function alertProfileFailure(webhook: string | undefined, message: string): Promise<void> {
  if (!webhook) return;
  if (!webhook.startsWith("https://")) {
    console.error("Post-deploy profile schema alert requires an HTTPS webhook.");
    return;
  }
  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: `RELEASE CHECK FAILED — ${message}` }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("Alert delivery failed");
  } catch {
    console.error("Post-deploy profile schema alert could not be delivered.");
  }
}

// Netlify invokes this after native migrations on every successful deploy.
// A failed check fails the event invocation and optionally alerts the release
// operator. The live-store smoke check remains production-only.
export async function runDeploySucceeded(
  request: Request,
  context: Context,
  verifyProfile: () => Promise<void> = checkDeployedProfileSchema,
): Promise<void> {
  const env = (key: string) => Netlify.env.get(key) ?? process.env[key];
  const deployContext = context.deploy?.context;
  if (!deployContext || !["production", "deploy-preview", "branch-deploy", "staging"].includes(deployContext)) {
    throw new Error("Post-deploy release check failed: deployment context is unavailable.");
  }
  try {
    await verifyProfile();
    console.log("Post-deploy API player bootstrap schema check passed.");
  } catch (error) {
    // Only our fixed message / schema-derived column names reach the operator.
    const message = error instanceof Error ? error.message : "Post-deploy profile schema check failed.";
    await alertProfileFailure(env("STORE_CHECK_ALERT_WEBHOOK"), message);
    throw error;
  }

  let payload: { ssl_url?: string; url?: string } = {};
  try { payload = (await request.json()) as typeof payload; } catch { /* Event payloads are JSON; proceed with env fallback. */ }
  const expectedMode = env("STORE_CHECK_EXPECT_MODE") ??
    (deployContext === "production" ? "live" : undefined);
  if (!expectedMode) {
    console.log(`Store smoke check skipped for ${deployContext ?? "unknown"} deploy context.`);
    return;
  }
  const origin = env("STORE_CHECK_ORIGIN") ?? env("PAYMENTS_PUBLIC_ORIGIN") ?? payload.ssl_url ?? payload.url;
  const catalog = await runStoreSmokeCheck({
    STORE_CHECK_ORIGIN: origin,
    STORE_CHECK_EXPECT_MODE: expectedMode,
    STORE_CHECK_USER_ID: env("STORE_CHECK_USER_ID"),
    STORE_CHECK_ALERT_WEBHOOK: env("STORE_CHECK_ALERT_WEBHOOK"),
    CLERK_SECRET_KEY: env("CLERK_SECRET_KEY"),
  });
  console.log(`Post-deploy store smoke check passed for ${origin}: checkout is ${catalog.mode} and enabled.`);
}

export default (request: Request, context: Context) => runDeploySucceeded(request, context);
