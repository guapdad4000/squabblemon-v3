import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  BreakthroughOnlineService,
  type BreakthroughRuntimeOptions,
} from "../artifacts/api-server/src/lib/breakthroughOnline";
import { breakthroughRouter } from "../artifacts/api-server/src/routes/breakthrough";
import { createBreakthroughRoomForSimulation } from "../lib/squabblemon-engine/src/breakthroughRoom";
import { BreakthroughRoomOwnerForSimulation } from "../lib/squabblemon-engine/src/breakthroughRoomOwner";
import { createGame } from "../lib/squabblemon-engine/src/breakthrough";
import { buildBreakthroughRoster } from "../lib/squabblemon-engine/src/breakthroughCatalog";
const require = createRequire(
  `${process.cwd()}/artifacts/squabblemon/package.json`,
);
const apiRequire = createRequire(
  `${process.cwd()}/artifacts/api-server/package.json`,
);
export async function verifyBrowser(pool: BreakthroughRuntimeOptions["pool"]) {
  const express = apiRequire("express"),
    { chromium, expect } = require("@playwright/test");
  const { createServer: createViteServer } = await import(
    require.resolve("vite")
  );
  const directory = "/tmp/breakthrough-online-browser";
  mkdirSync(directory, { recursive: true });
  const roster = buildBreakthroughRoster(),
    cards = [
      "nabu",
      "enki",
      "utu",
      "ninhursag",
      "inanna",
      "yakub",
      "enlil",
      "ereshkigal",
      "caucus-mountaineer",
      "anu",
    ];
  const errors: unknown[] = [];
  const databaseTraffic = { queries: 0, parameterBytes: 0, resultJsonBytes: 0 };
  const measure = (target: any): any =>
    new Proxy(target, {
      get(object, key) {
        if (key === "connect")
          return async () => measure(await object.connect());
        if (key === "query")
          return async (...args: any[]) => {
            databaseTraffic.queries++;
            databaseTraffic.parameterBytes += Buffer.byteLength(
              JSON.stringify(args[1] ?? []),
            );
            const result = await object.query(...args);
            databaseTraffic.resultJsonBytes += Buffer.byteLength(
              JSON.stringify(result.rows),
            );
            return result;
          };
        const value = object[key];
        return typeof value === "function" ? value.bind(object) : value;
      },
    });
  const walStart = (
    await pool.query("SELECT pg_current_wal_insert_lsn() AS lsn")
  ).rows[0].lsn;
  const service = new BreakthroughOnlineService(
    {
      pool: measure(pool),
      report: (e) => errors.push(String(e)),
      member: async (_c, userId) => ({
        userId,
        name: userId,
        avatarKey: "nabu",
        cards,
      }),
    },
    {
      admit() {},
      create: (input) =>
        createBreakthroughRoomForSimulation({
          ...input,
          game: createGame(roster, {
            seed: 129,
            durationMs: 45000,
            decks: { player: cards, opponent: cards },
          }),
        }),
      owner: (o) => new BreakthroughRoomOwnerForSimulation(o),
      roster: () => roster,
    },
  );
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    breakthroughRouter(service, (req) =>
      req.header("x-test-user")
        ? { userId: req.header("x-test-user")!, expiresAt: Date.now() + 60000 }
        : null,
    ),
  );
  process.env.PORT = "4289";
  process.env.BASE_PATH = "/squabblemon";
  process.env.VITE_E2E_AUTH = "true";
  process.env.VITE_CLERK_PUBLISHABLE_KEY = "pk_test_ZTJlLXRlc3Qk";
  const vite = await createViteServer({
    root: `${process.cwd()}/artifacts/squabblemon`,
    configFile: `${process.cwd()}/artifacts/squabblemon/vite.config.ts`,
    server: { middlewareMode: true, hmr: false },
    appType: "mpa",
  });
  app.use(vite.middlewares);
  const server = createServer(app);
  await new Promise<void>((r) => server.listen(4289, "127.0.0.1", r));
  service.start();
  const browser = await chromium.launch({ headless: true });
  const records: unknown[] = [];
  try {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 320, height: 568 },
      { width: 844, height: 390 },
      { width: 768, height: 1024 },
      { width: 1440, height: 900 },
    ]) {
      const suffix = `${viewport.width}`,
        accountA = `browser-a-${suffix}`,
        accountB = `browser-b-${suffix}`;
      const aContext = await browser.newContext({
        viewport,
        reducedMotion: viewport.width === 390 ? "no-preference" : "reduce",
        extraHTTPHeaders: { "x-test-user": accountA },
      });
      const bContext = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        reducedMotion: "reduce",
        extraHTTPHeaders: { "x-test-user": accountB },
      });
      const a = await aContext.newPage(),
        b = await bContext.newPage(),
        pageErrors: string[] = [];
      const network = await aContext.newCDPSession(a);
      await network.send("Network.enable");
      const resources = new Map<string, any>();
      network.on("Network.responseReceived", (event: any) => {
        const { requestId, type, response } = event;
        resources.set(requestId, {
          url: response.url,
          type,
          bytes: 0,
          cached: !!(response.fromDiskCache || response.fromServiceWorker),
          cacheControl: response.headers["cache-control"] ?? null,
        });
      });
      network.on("Network.loadingFinished", (event: any) => {
        const record = resources.get(event.requestId);
        if (record) record.bytes = event.encodedDataLength;
      });
      const media = () =>
        [...resources.values()].filter((r) =>
          ["Image", "Media", "Font"].includes(r.type),
        );
      a.on("pageerror", (e: Error) => pageErrors.push(e.message));
      b.on("pageerror", (e: Error) => pageErrors.push(e.message));
      const url = (account: string) =>
        `http://127.0.0.1:4289/squabblemon/e2e/breakthrough-online.fixture.html?account=${account}`;
      await Promise.all([a.goto(url(accountA)), b.goto(url(accountB))]);
      await a.getByRole("button", { name: "FIND OPPONENT →" }).click();
      await expect(a.getByText("Searching for another player…")).toBeVisible();
      await b.getByRole("button", { name: "FIND OPPONENT →" }).click();
      await expect(a.locator('[data-room-phase="active"]')).toBeVisible({
        timeout: 20000,
      });
      await expect(b.locator('[data-room-phase="active"]')).toBeVisible();
      await a.getByRole("button", { name: /^Nabu, from/ }).click();
      await a.getByRole("button", { name: "Deploy Nabu in lane 1" }).click();
      await expect(
        a.getByRole("img", { name: "Your Ancient Tablet ready in lane 1" }),
      ).toBeVisible();
      await expect(
        b.getByRole("img", { name: "Opponent Ancient Tablet ready in lane 1" }),
      ).toBeVisible();
      await b.getByRole("button", { name: /^Nabu, from/ }).click();
      await b.getByRole("button", { name: "Deploy Nabu in lane 2" }).click();
      await expect(
        b.getByRole("img", { name: "Your Ancient Tablet ready in lane 2" }),
      ).toBeVisible();
      await a.getByRole("button", { name: /^Inanna, from/ }).click();
      await a.getByRole("button", { name: "Deploy Inanna in lane 1" }).click();
      await b.locator(".bt-card:not(.bt-unaffordable)").first().click();
      await b.getByRole("button", { name: /^Deploy .+ in lane 2$/ }).click();
      await expect(
        a.getByRole("button", { name: /^Inanna, you, 7 Hands/ }),
      ).toBeVisible();
      await a.screenshot({
        path: `${directory}/${suffix}-active.png`,
        fullPage: true,
      });
      assert(
        await a.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      const firstEntryMedia = media().map((r) => ({ ...r }));
      const elapsed = Number(
        await a.locator("[data-elapsed-ms]").getAttribute("data-elapsed-ms"),
      );
      // Losing a browser connection never pauses the owner; a reload recovers membership and the board.
      await aContext.setOffline(true);
      await new Promise((r) => setTimeout(r, 700));
      await aContext.setOffline(false);
      await a.reload();
      await expect(a.locator('[data-room-phase="active"]')).toBeVisible({
        timeout: 15000,
      });
      assert(
        Number(
          await a.locator("[data-elapsed-ms]").getAttribute("data-elapsed-ms"),
        ) > elapsed,
      );
      await expect(
        a.getByRole("button", { name: /^Inanna, you,/ }),
      ).toBeVisible();
      if (viewport.width === 390) {
        await expect(a.locator('[data-room-phase="complete"]')).toBeVisible({
          timeout: 45000,
        });
        await expect(a.getByText(/TROPHIES · .* TOTAL/)).toBeVisible({
          timeout: 15000,
        });
        await expect(b.getByText(/TROPHIES · .* TOTAL/)).toBeVisible();
        await a.reload();
        await expect(a.getByText(/TROPHIES · .* TOTAL/)).toBeVisible({
          timeout: 15000,
        });
        await a.screenshot({
          path: `${directory}/390-result.png`,
          fullPage: true,
        });
      }
      assert.deepEqual(pageErrors, []);
      records.push({
        viewport,
        paired: true,
        privateSeatFlip: true,
        anunakiPlay: true,
        reconnected: true,
        resultReceipt: viewport.width === 390,
        motion: viewport.width === 390 ? "normal" : "reduced",
        firstEntryMediaBytes: firstEntryMedia.reduce(
          (sum, r) => sum + r.bytes,
          0,
        ),
        firstEntryMedia,
        totalMediaBytesIncludingReloads: media().reduce(
          (sum, r) => sum + r.bytes,
          0,
        ),
        mediaIncludingReloads: media(),
      });
      await aContext.close();
      await bContext.close();
    }
    assert.deepEqual(errors, []);
    const storage = await pool.query(`SELECT count(*)::int AS rooms,
      sum(octet_length(checkpoint::text))::bigint AS logical_checkpoint_bytes,
      sum(pg_column_size(checkpoint))::bigint AS stored_checkpoint_bytes FROM breakthrough_rooms`);
    const walBytes = (
      await pool.query(
        "SELECT pg_wal_lsn_diff(pg_current_wal_insert_lsn(),$1)::bigint AS bytes",
        [walStart],
      )
    ).rows[0].bytes;
    writeFileSync(
      `${directory}/verification.json`,
      JSON.stringify(
        {
          passed: true,
          records,
          databaseTraffic,
          walBytes,
          storage: storage.rows[0],
          limitations:
            "Local Vite fixture: media encoded response bytes include HTTP headers; excludes production JS/CSS delivery. Database counters cover service SQL parameters/results, not PostgreSQL protocol. WAL includes owned native database background work; storage includes prior native fixtures.",
          auth: "injected owned test principals; actual Clerk staging still required",
        },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify(
        { suite: "breakthrough-two-browser-native", passed: true, records },
        null,
        2,
      ),
    );
  } catch (e) {
    let n = 0;
    for (const context of browser.contexts())
      for (const page of context.pages()) {
        await page
          .screenshot({ path: `${directory}/failure-${n}.png`, fullPage: true })
          .catch(() => {});
        writeFileSync(
          `${directory}/failure-${n++}.txt`,
          await page
            .locator("body")
            .innerText()
            .catch(() => ""),
        );
      }
    throw e;
  } finally {
    await browser.close();
    await service.stop();
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
    await vite.close();
  }
}
