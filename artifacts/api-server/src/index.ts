import app, { createApp } from "./app";
import { createBreakthroughRuntime } from "./lib/breakthroughRuntime";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const breakthrough =
  process.env.BREAKTHROUGH_PVP_ENABLED === "true"
    ? createBreakthroughRuntime()
    : null;
breakthrough?.service.start();
const server = (
  breakthrough ? createApp(undefined, breakthrough.router) : app
).listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.once(signal, () => {
    server.close();
    void breakthrough?.service.stop();
  });
