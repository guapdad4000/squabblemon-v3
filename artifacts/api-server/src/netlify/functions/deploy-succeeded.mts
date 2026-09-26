import type { Context } from "@netlify/functions";
import { runStoreSmokeCheck } from "../../lib/payments/storeSmokeCheck";

// Netlify invokes this event function after every successful deploy. It is the
// post-deploy release gate for the Corner Store: on production deploys it
// authenticates against the just-deployed origin and asserts the payment
// catalog reports checkout enabled in live mode. A failure throws — marking
// the function invocation failed in Netlify — and posts to
// STORE_CHECK_ALERT_WEBHOOK when configured, so the store can never again
// disable checkout quietly while every flag looks correct.
export default async (request: Request, context: Context) => {
  let payload: { ssl_url?: string; url?: string } = {};
  try { payload = (await request.json()) as typeof payload; } catch { /* Event payloads are JSON; proceed with env fallback. */ }
  const env = (key: string) => Netlify.env.get(key) ?? process.env[key];
  const deployContext = context.deploy?.context;
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
};
