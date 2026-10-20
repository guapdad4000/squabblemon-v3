import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

// Isolated hook fixture: no accounts, real matches, or database writes.
const root = fileURLToPath(new URL("..", import.meta.url));
const server = await createServer({
  configFile: false, root, logLevel: "error", cacheDir: `node_modules/.vite-polling-${process.pid}`,
  server: { host: "127.0.0.1", port: 0 },
});
await server.listen();
const origin = server.resolvedUrls.local[0];
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext();
  await context.addInitScript(() => {
    let hidden = false, online = true;
    Object.defineProperty(document, "hidden", { get: () => hidden, configurable: true });
    Object.defineProperty(document, "visibilityState", { get: () => hidden ? "hidden" : "visible", configurable: true });
    Object.defineProperty(navigator, "onLine", { get: () => online, configurable: true });
    window.setPollingVisibility = value => {
      hidden = !value;
      document.dispatchEvent(new Event("visibilitychange"));
    };
    window.setPollingOnline = value => {
      online = value;
      window.dispatchEvent(new Event(value ? "online" : "offline"));
    };
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  let revision = 1, status = "active", reads = 0, writes = 0;
  let holdRead = null, holdWrite = null, readFailure = false;
  const payload = () => ({ code: "ABCDEF123456", revision, status, gameNumber: 1 });
  await page.route("**/api/multiplayer/**", async route => {
    let snapshot;
    if (route.request().method() === "POST") {
      writes++;
      const input = route.request().postDataJSON();
      assert.equal(input.requestId, "stable-polling-test-id");
      assert.equal(input.expectedRevision, revision);
      revision++;
      snapshot = payload();
      if (holdWrite) await holdWrite;
    } else {
      reads++;
      snapshot = payload();
      if (holdRead) await holdRead;
      if (readFailure) {
        await route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"Unavailable"}' });
        return;
      }
    }
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(snapshot) });
  });
  await page.goto(new URL("e2e/multiplayer-polling.fixture.html", origin).href);
  await page.waitForFunction(() => document.querySelector('[data-testid="connected"]')?.textContent === "true");
  const beforeActive = reads;
  await page.waitForTimeout(1800);
  assert.ok(reads >= beforeActive + 2, "active turns still poll every 800ms");

  let releaseOldRead;
  holdRead = new Promise(resolve => { releaseOldRead = resolve; });
  const beforeHeldRead = reads;
  for (let attempt = 0; attempt < 100 && reads === beforeHeldRead; attempt++) await page.waitForTimeout(50);
  assert.ok(reads > beforeHeldRead, "the pre-hide GET is in flight");
  await page.evaluate(() => window.setPollingVisibility(false));
  await page.waitForTimeout(100);
  const beforeHidden = reads;
  await page.waitForTimeout(2400);
  assert.equal(reads, beforeHidden, "hidden tab does not keep polling");
  revision = 3;
  let releaseRead;
  holdRead = new Promise(resolve => { releaseRead = resolve; });
  await page.evaluate(() => window.setPollingVisibility(true));
  await page.waitForTimeout(100);
  releaseOldRead();
  await page.waitForTimeout(100);
  assert.ok(reads > beforeHidden, "foreground immediately resynchronizes");
  assert.equal(await page.getByTestId("connected").textContent(), "false", "old board cannot issue a turn during resync");
  assert.equal(await page.getByRole("button", { name: "End turn" }).isDisabled(), true);
  holdRead = null;
  releaseRead();
  await page.waitForFunction(() => document.querySelector('[data-testid="revision"]')?.textContent === "3" &&
    document.querySelector('[data-testid="connected"]')?.textContent === "true");

  await page.evaluate(() => window.setPollingOnline(false));
  await page.waitForTimeout(100);
  const beforeOffline = reads;
  await page.waitForTimeout(1700);
  assert.equal(reads, beforeOffline, "offline periods do not generate polls");
  await page.evaluate(() => window.setPollingOnline(true));
  await page.waitForFunction(() => document.querySelector('[data-testid="connected"]')?.textContent === "true");
  assert.ok(reads > beforeOffline);

  let releaseWrite;
  holdWrite = new Promise(resolve => { releaseWrite = resolve; });
  await page.getByRole("button", { name: "End turn" }).click();
  await page.waitForFunction(() => document.querySelector('[data-testid="mutation"]')?.textContent === "pending");
  await page.evaluate(() => window.setPollingVisibility(false));
  holdRead = new Promise(resolve => { releaseRead = resolve; });
  await page.evaluate(() => window.setPollingVisibility(true));
  await page.waitForTimeout(100);
  holdWrite = null;
  releaseWrite();
  await page.waitForFunction(() => document.querySelector('[data-testid="mutation"]')?.textContent === "success");
  assert.equal(writes, 1, "hiding never cancels or duplicates the committed turn");
  assert.equal(await page.getByTestId("revision").textContent(), "4");
  assert.equal(await page.getByTestId("connected").textContent(), "false", "a delayed write acknowledgement cannot substitute for a post-resume GET");
  holdRead = null;
  releaseRead();
  await page.waitForFunction(() => document.querySelector('[data-testid="connected"]')?.textContent === "true");
  await page.evaluate(() => window.setPollingVisibility(false));
  await page.waitForTimeout(100);
  const afterWrite = reads;
  await page.waitForTimeout(1700);
  assert.equal(reads, afterWrite, "write acknowledgement does not restart hidden polling");

  readFailure = true;
  await page.evaluate(() => window.setPollingVisibility(true));
  await page.waitForTimeout(500);
  assert.equal(await page.getByTestId("connected").textContent(), "false", "failed resume cannot enable an old cached board");
  readFailure = false;
  status = "complete";
  revision = 5;
  await page.waitForFunction(() => document.querySelector('[data-testid="status"]')?.textContent === "complete" &&
    document.querySelector('[data-testid="connected"]')?.textContent === "true");
  status = "active";
  revision = 6;
  await page.waitForFunction(() => document.querySelector('[data-testid="revision"]')?.textContent === "6");
  status = "closed";
  revision = 7;
  await page.waitForFunction(() => document.querySelector('[data-testid="status"]')?.textContent === "closed");
  const closedReads = reads;
  await page.waitForTimeout(2200);
  assert.equal(reads, closedReads, "closed rooms stop polling; completed rooms can still observe rematches");
  assert.deepEqual(errors, []);
  console.log("PASS multiplayer: active cadence, hidden/offline pause, authoritative foreground resync, in-flight turn acknowledgement, error recovery, rematch and closed-room polling");
} finally {
  await browser?.close();
  await server.close();
}
