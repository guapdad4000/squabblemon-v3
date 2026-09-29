// Isolated browser-test host. Never imported by the application or deployment.
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
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
// Existing online harness remains single-connection. Homies requires real concurrent
// PostgreSQL sessions; never serialize the native-PG concurrency journey.
if (process.env.HOMIES_E2E !== "1") pool.options.max = 1;
const ids = {
  a: `online-browser-${randomUUID()}`,
  b: `online-browser-${randomUUID()}`,
  ...(process.env.HOMIES_E2E === "1" ? { c: `online-browser-${randomUUID()}` } : {}),
};
const identify = (req: Request) => {
  const seat = req.headers.cookie?.match(/(?:^|;\s*)online_test_seat=([abc])(?:;|$)/)?.[1];
  return seat && seat in ids ? ids[seat as keyof typeof ids] : null;
};
await db
  .insert(playerProfilesTable)
  .values(
    Object.entries(ids).map(([seat, id]) => ({
      clerkUserId: id,
      displayName: seat === "a" ? "Vicky" : seat === "b" ? "The Rival" : "Uninvited Player",
      ...(process.env.ONLINE_E2E_REACTIONS === "1" ? { softCurrency: 600, xp: seat === "a" ? 750 : 2000, level: seat === "a" ? 4 : 9 } : {}),
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
  // Keep the isolated auth test host from invalidating managed preview's Vite dep cache.
  cacheDir: resolve(import.meta.dirname, process.env.HOMIES_E2E === "1" ? "../node_modules/.vite-homies-browser-e2e" : "../node_modules/.vite-online-browser-e2e"),
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
