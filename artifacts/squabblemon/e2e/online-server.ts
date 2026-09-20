// Isolated browser-test host. Never imported by the application or deployment.
import { randomUUID } from "node:crypto";
import { createServer } from "vite";
import { createApp } from "../../api-server/src/app";
import { db, pool, playerProfilesTable } from "../../../lib/db/src/index";
import {
  cardCatalog,
  ROOKIE_CORE_IDS,
} from "@workspace/squabblemon-engine/data";
import { createRequire } from "node:module";
const { inArray } = createRequire(new URL("../../api-server/package.json", import.meta.url))("drizzle-orm");
import type { Request } from "express";

if (
  process.env.ONLINE_E2E !== "1" ||
  !process.env.DATABASE_URL || !["127.0.0.1", "localhost"].includes(new URL(process.env.DATABASE_URL).hostname)
)
  throw new Error(
    "This test host requires a loopback database and ONLINE_E2E=1.",
  );
// PGlite has one database session: avoid interleaving independent transactions.
// Production keeps its normal PostgreSQL pool.
pool.options.max = 1;
const ids = {
  a: `online-browser-${randomUUID()}`,
  b: `online-browser-${randomUUID()}`,
};
const identify = (req: Request) =>
  req.headers.cookie?.includes("online_test_seat=a")
    ? ids.a
    : req.headers.cookie?.includes("online_test_seat=b")
      ? ids.b
      : null;
await db
  .insert(playerProfilesTable)
  .values(
    Object.entries(ids).map(([seat, id]) => ({
      clerkUserId: id,
      displayName: seat === "a" ? "Vicky" : "The Rival",
      onboardingStep: "complete",
      starterRewardClaimed: true,
      tutorialCompleted: true,
      ownedCardIds: cardCatalog.map((c) => c.catalogId),
      savedDecks: [
        {
          id: "my-online-crew",
          name: seat === "a" ? "The Home Gang" : "The Away Gang",
          heroCardId: seat === "a" ? "hooper" : "wifey",
          cardIds: process.env.ONLINE_E2E_KYLE === "1" ? ["kyle", ...ROOKIE_CORE_IDS.slice(0, 9)] : [...ROOKIE_CORE_IDS],
        },
      ],
      settings: { reducedMotion: true, turnTimerEnabled: true },
    })),
  );
const app = createApp((req, _res, next) => {
  const userId = identify(req);
  (req as unknown as { auth: unknown }).auth = Object.assign(
    () => ({
      userId,
      sessionId: userId ? "test" : null,
      tokenType: "session_token",
      isAuthenticated: !!userId,
    }),
    { [Symbol.for("@clerk/express.auth")]: true },
  );
  next();
});
const vite = await createServer({
  configFile: "artifacts/squabblemon/vite.config.ts",
  server: { middlewareMode: true, hmr: false },
  appType: "spa",
});
app.use(vite.middlewares);
const server = app.listen(4196, "127.0.0.1", () =>
  console.log("Online browser test host: http://127.0.0.1:4196/game/online"),
);
async function stop() {
  server.close();
  await vite.close();
  await db
    .delete(playerProfilesTable)
    .where(inArray(playerProfilesTable.clerkUserId, Object.values(ids)));
  await pool.end();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
