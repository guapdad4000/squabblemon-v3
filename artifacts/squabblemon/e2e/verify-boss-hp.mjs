import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const out =
  process.env.REVIEW_OUTPUT ?? "../../screenshots/boss-raid-hp-polish";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  }),
  page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://127.0.0.1:4231/e2e/boss-raid.fixture.html");
await page.getByRole("button", { name: "FIGHT THE PRECINCT →" }).click();
let moves = 0;
while (true) {
  const legal = await page.evaluate(() => window.__raidLegal);
  if (!legal.length) break;
  const c = legal[0];
  await page.locator(`[data-instance="${c.instanceId}"]`).click();
  await page.locator(".raid-deploy").nth(c.lane).click();
  await page.getByRole("button", { name: /PLAY CARD/ }).click();
  await page.waitForFunction(() => !document.querySelector(".raid-deploy"));
  assert(++moves < 20);
}
const before = Number(
  await page.getByRole("progressbar").getAttribute("aria-valuenow"),
);
await page.getByRole("button", { name: /END TURN/ }).click();
await page.waitForFunction(
  (hp) =>
    Number(
      document
        .querySelector("[role=progressbar]")
        .getAttribute("aria-valuenow"),
    ) < hp,
  before,
);
await page.waitForTimeout(220);
const widths = await page.evaluate(() => ({
  live: document.querySelector(".raid-hp-live").getBoundingClientRect().width,
  trail: document.querySelector(".raid-hp-trail").getBoundingClientRect().width,
  glint: getComputedStyle(document.querySelector(".raid-hp-glint"))
    .animationName,
}));
assert(widths.trail > widths.live, "damage trail must lag actual health");
assert.equal(widths.glint, "raid-hp-sweep");
await page.screenshot({ path: out + "/phone-hp-impact.png", fullPage: true });
await page.waitForTimeout(1700);
const after = Number(
  await page.getByRole("progressbar").getAttribute("aria-valuenow"),
);
assert.equal(after, await page.evaluate(() => window.__raid.hp));
await page.getByRole("button", { name: /How to fight/ }).click();
assert.equal(
  await page.locator(".raid-hp-wrap").getAttribute("data-animated"),
  "false",
);
await page.keyboard.press("Escape");
await page.emulateMedia({ reducedMotion: "reduce" });
assert.equal(
  await page
    .locator(".raid-hp-glint")
    .evaluate((n) => getComputedStyle(n).animationName),
  "none",
);
await writeFile(
  out + "/hp-animation-check.json",
  JSON.stringify(
    { before, after, widths, modalPaused: true, reducedMotionStill: true },
    null,
    2,
  ),
);
console.log({ before, after, widths });
await browser.close();
