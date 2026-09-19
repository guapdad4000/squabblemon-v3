import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const readyToken = process.env.PGLITE_READY_TOKEN;
const requestedPort = Number(process.env.PGLITE_PORT ?? "0");
if (!readyToken || !/^[0-9a-f-]{36}$/.test(readyToken)) {
  throw new Error("PGLITE_READY_TOKEN is required.");
}
if (!Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65535) {
  throw new Error("PGLITE_PORT must be 0 or a valid TCP port.");
}

const db = await PGlite.create();
const server = new PGLiteSocketServer({
  db,
  port: requestedPort,
  host: "127.0.0.1",
  maxConnections: 10,
});
await server.start();
const port = Number(server.getServerConn().split(":").at(-1));
if (!Number.isInteger(port) || port <= 0) {
  throw new Error("PGlite did not report its assigned port.");
}
process.stdout.write(
  JSON.stringify({ type: "pglite-ready", token: readyToken, host: "127.0.0.1", port }) + "\n",
);

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await server.stop();
  await db.close();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);