import type { IncomingMessage, ServerResponse } from "node:http";
import { currentDeploymentContext } from "./runtimeDeploymentContext";

/**
 * Decides pino-http's per-request completion message.
 *
 * The Netlify adapter (webRequestAdapter/serverless-http) delivers the whole
 * request up front and serves responses through a mock socket that never sets
 * `finished`/`writableEnded`, so pino-http's default heuristic mislabels every
 * completed function response as "request aborted" — including successful
 * payment webhooks. Inside a deployment-context invocation a client
 * disconnect cannot reach the function anyway: a response whose headers were
 * flushed completed; anything else never produced a visible response.
 *
 * On the direct HTTP path (no deployment context) the real socket lifecycle
 * is intact, so keep pino-http's default aborted/completed heuristic.
 */
export function requestCompletionMessage(
  req: IncomingMessage,
  res: ServerResponse,
): string {
  if (currentDeploymentContext()) {
    return res.headersSent ? "request completed" : "request aborted";
  }
  return !req.readableAborted && res.writableEnded
    ? "request completed"
    : "request aborted";
}
