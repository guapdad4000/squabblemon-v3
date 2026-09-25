import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { installFadecadeApi, fadecadeBootstrap } from "./fadecade.fixture.ts";
const origin = process.env.UI_ORIGIN ?? "http://127.0.0.1:4198";
assert(["127.0.0.1", "localhost"].includes(new URL(origin).hostname));
const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
});
async function ready(page) {
  for (let n = 0; n < 300; n++) {
    const lesson = page.getByRole("button", {
      name: "Back to the battle",
      exact: true,
    });
    if (await lesson.isVisible())
      await lesson.click({ timeout: 600 }).catch(() => {});
    else if (
      await page
        .locator(
          '[data-testid="battle-arena"][data-presentation-phase="player-ready"]',
        )
        .count()
    )
      return;
    else {
      const skip = page
        .getByRole("button", { name: /Fast forward|Continue past/ })
        .first();
      if (await skip.isVisible())
        await skip.click({ timeout: 500 }).catch(() => {});
    }
    await page.waitForTimeout(75);
  }
  throw Error("Player controls did not recover");
}
async function choose(page) {
  const cards = page.locator(
    '#hand-tray [data-card-id]:not([aria-label*="Cannot play"])',
  );
  const card = cards.first();
  assert(await card.count());
  await card.click();
  const lane = page
    .locator('[data-testid^="lane-"][aria-label^="Deploy"]')
    .first();
  await lane.click();
  await page.getByRole("button", { name: /^Play card/ }).waitFor();
}
try {
  for (const [name, viewport] of [
    ["desktop", { width: 1440, height: 1000 }],
    ["phone", { width: 390, height: 844 }],
  ]) {
    const context = await browser.newContext({
      viewport,
      reducedMotion: "reduce",
    });
    await context.addInitScript(() =>
      localStorage.setItem("squabblemon_e2e_user", "signed-in"),
    );
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const api = await installFadecadeApi(page);
    let failNext = false,
      failed = false;
    const bootstrap = fadecadeBootstrap();
    bootstrap.profile.settings.turnTimerEnabled = false;
    await page.route("**/api/player/bootstrap", (r) =>
      r.fulfill({ json: bootstrap }),
    );
    await page.route(
      "**/api/player/challenges/runs/*/checkpoint",
      async (r) => {
        if (failNext && !failed) {
          failed = true;
          return r.fulfill({
            status: 503,
            json: { error: "Connection interrupted" },
          });
        }
        await r.fallback();
      },
    );
    try {
      await page.goto(origin + "/game/challenges");
      await page
        .getByRole("button", {
          name: "Open Straight to the Back road",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: "Start run · 1 entry", exact: true })
        .click();
      await ready(page);
      await choose(page);
      await page.getByRole("button", { name: /^Play card/ }).click();
      await ready(page);
      await page.getByRole("button", { name: "End Turn", exact: true }).click();
      await ready(page);
      assert.match(
        await page.locator(".battle-round").getAttribute("aria-label"),
        /^Round 2 /,
      );
      failNext = true;
      await choose(page);
      const checkpoints = api.requests.checkpoints.length;
      await page.getByRole("button", { name: /^Play card/ }).click();
      await page.waitForTimeout(200);
      await ready(page);
      assert(failed);
      assert.equal(
        api.requests.checkpoints.length,
        checkpoints,
        "Failed checkpoint must not append a move",
      );
      await page.getByRole("button", { name: /^Play card/ }).click();
      await ready(page);
      assert.equal(api.requests.checkpoints.length, checkpoints + 1);
      await page.getByRole("button", { name: "End Turn", exact: true }).click();
      await ready(page);
      assert.match(
        await page.locator(".battle-round").getAttribute("aria-label"),
        /^Round 3 /,
      );
      await page.screenshot({
        path: `screenshots/release/round-three-${name}.png`,
      });
      await page.getByLabel("Battle menu", { exact: true }).click();
      await page
        .getByRole("button", { name: "Battle rules", exact: true })
        .click();
      await page.getByRole("dialog", { name: "Know the streets." }).waitFor();
      await page.screenshot({
        path: `screenshots/release/referee-options-${name}.png`,
      });
      await page
        .getByRole("button", { name: "Close field manual", exact: true })
        .click();
      console.log(
        "PASS round-two card play, failed checkpoint retry, round three and referee rules",
        name,
      );
      assert.deepEqual(errors, []);
    } catch (e) {
      console.log((await page.locator("body").innerText()).slice(-4000));
      await page.screenshot({
        path: `screenshots/release/round-error-${name}.png`,
      });
      throw e;
    }
    await context.close();
  }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(origin + "/e2e/ui-polish.fixture.html?mode=arrival");
  await page.locator("canvas.versus-logo").waitFor();
  await page.waitForTimeout(1200);
  const alpha = await page.locator("canvas.versus-logo").evaluate((el) => {
    const p = el.getContext("2d").getImageData(0, 0, el.width, el.height).data;
    let clear = 0,
      drawn = 0,
      green = 0;
    for (let i = 0; i < p.length; i += 4) {
      if (p[i + 3] < 10) clear++;
      if (p[i + 3] > 200) {
        drawn++;
        if (p[i + 1] - Math.max(p[i], p[i + 2]) > 90) green++;
      }
    }
    return { clear, drawn, green };
  });
  assert(alpha.clear > 100);
  assert(alpha.drawn > 100);
  assert.equal(alpha.green, 0);
  await page.screenshot({ path: "screenshots/release/vs-phone.png" });
  await page.getByRole("button", { name: /Step into the field/ }).click();
  console.log("PASS mobile VS transparent background", alpha);
} finally {
  await browser.close();
}
