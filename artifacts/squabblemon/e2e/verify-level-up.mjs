import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { fadecadeBootstrap } from "./fadecade.fixture.ts";
const origin = process.env.UI_ORIGIN ?? "http://127.0.0.1:4198";
assert(["127.0.0.1", "localhost"].includes(new URL(origin).hostname));
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE ?? "/usr/bin/google-chrome",
  headless: true,
});
const errors = [];
await mkdir("screenshots/release", { recursive: true });
try {
  for (const [name, viewport, reducedMotion] of [
    ["desktop", { width: 1440, height: 1000 }, "no-preference"],
    ["phone", { width: 390, height: 844 }, "no-preference"],
    ["reduced", { width: 390, height: 844 }, "reduce"],
  ]) {
    const context = await browser.newContext({ viewport, reducedMotion });
    const bootstrap = fadecadeBootstrap();
    bootstrap.profile.level = 2;
    bootstrap.profile.xp = 250;
    await context.addInitScript((id) => {
      localStorage.setItem("squabblemon_e2e_user", "signed-in");
      localStorage.setItem(`squabblemon:level-seen:${id}`, "1");
    }, bootstrap.profile.id);
    await context.route("**/api/player/**", (route) =>
      route.fulfill({
        json: route.request().url().endsWith("/bootstrap")
          ? bootstrap
          : {
              date: "2026-09-24",
              streak: 1,
              claimedToday: false,
              pending: [],
              nextResetAt: "2026-09-25T00:00:00Z",
            },
      }),
    );
    const page = await context.newPage();
    page.on("pageerror", (error) => {
      errors.push(error.message);
      console.log("PAGE ERROR", error.message);
    });
    await page.goto(origin + "/game/collection");
    await page
      .locator(".level-moment")
      .waitFor({ timeout: 15000 })
      .catch(async (error) => {
        console.log((await page.locator("body").innerText()).slice(0, 2500));
        await page.screenshot({ path: "screenshots/release/level-error.png" });
        throw error;
      });
    await page.getByText("APPLYING PRESSURE!", { exact: true }).waitFor();
    await page.waitForTimeout(1700);
    assert.equal(
      await page.locator(".level-moment__orbit--fists img").count(),
      10,
    );
    assert.equal(
      await page.locator(".level-moment__orbit--boots img").count(),
      8,
    );
    assert(
      await page
        .locator(".level-moment__rays img")
        .evaluateAll((imgs) =>
          imgs.every((img) => img.complete && img.naturalWidth > 0),
        ),
    );
    await page.screenshot({ path: `screenshots/release/level-up-${name}.png` });
    const button = page.getByRole("button", { name: "Keep applying pressure" });
    const b = await button.boundingBox();
    assert(b && b.y >= 0 && b.y + b.height <= viewport.height);
    if (reducedMotion === "reduce")
      assert.equal(
        await page
          .locator(".level-moment__orbit--fists")
          .evaluate((el) => getComputedStyle(el).animationName),
        "none",
      );
    await button.click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    console.log("PASS level-up", name);
    await context.close();
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
