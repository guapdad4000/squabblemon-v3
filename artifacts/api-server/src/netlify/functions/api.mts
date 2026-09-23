import type { Config, Context } from "@netlify/functions";
import { webRequestAdapter } from "../../lib/webRequestAdapter";
import { runWithDeploymentContext } from "../../lib/runtimeDeploymentContext";

async function getHandler() {
  const { default: app } = await import("../../app");
  return webRequestAdapter(app);
}
let handler: ReturnType<typeof getHandler> | undefined;

export default async function api(request: Request, context: Context) {
  // Stripe settlement must survive player-auth configuration outages and the
  // checkout kill switch. The sole exemption still verifies a raw signature.
  const isPaymentWebhook = request.method === "POST" &&
    new URL(request.url).pathname === "/api/payments/webhook";
  if (
    !isPaymentWebhook &&
    !["CLERK_SECRET_KEY", "CLERK_PUBLISHABLE_KEY"].every(key =>
      Netlify.env.get(key),
    )
  ) {
    return Response.json(
      { error: "Account services are awaiting deployment configuration." },
      { status: 503 },
    );
  }

  const requestOrigin = new URL(request.url).origin;
  const runtime = {
    context: context.deploy.context,
    deployId: context.deploy.id,
    origin: requestOrigin,
    countryCode: context.geo?.country?.code,
  };
  // Netlify supplies deploy context and ID per invocation. AsyncLocalStorage
  // keeps this trusted identity scoped to the current request while the
  // Express adapter and its singleton app handle concurrent invocations.
  return runWithDeploymentContext(runtime, async () => {
    handler ??= getHandler().catch(error => {
      handler = undefined;
      throw error;
    });
    return (await handler)(request, context.ip);
  });
}
export const config: Config = { path: ["/api", "/api/*"] };
