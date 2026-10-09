import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const out =
  process.env.REVIEW_OUTPUT ?? "../../screenshots/boss-raid-epic/entry";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  }),
  report = [];
for (const [name, w, h] of [
  ["small-phone", 360, 640],
  ["phone", 390, 844],
  ["ipad-portrait", 768, 1024],
  ["ipad-landscape", 1024, 768],
  ["desktop", 1440, 1000],
  ["ultrawide", 1920, 1080],
]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400 && r.url().includes("boss-raid/"))
      errors.push(r.url());
  });
  await page.goto("http://127.0.0.1:4231/e2e/boss-raid.fixture.html");
  await page.locator(".compact-deck-picker").waitFor();
  await page
    .locator(".raid-entry-hero-art img")
    .evaluate((img) => img.decode());
  await page.waitForTimeout(750);
  assert.equal(await page.locator("select").count(), 0);
  assert.equal(
    await page.locator(".compact-deck-picker [aria-pressed=true]").count(),
    1,
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    false,
  );
  const fight = await page
    .getByRole("button", { name: "FIGHT THE PRECINCT →" })
    .boundingBox();
  assert(fight.height >= 44);
  await page.screenshot({ path: out + `/${name}-start.png`, fullPage: true });
  await page.getByRole("button", { name: "FIGHT THE PRECINCT →" }).click();
  await page.locator(".raid-field").waitFor();
  assert.deepEqual(errors, []);
  report.push({
    name,
    errors,
    nativeDeckPicker: true,
    fightEntered: true,
    overflow: false,
  });
  await page.close();
}
await browser.close();
await writeFile(
  out + "/entry-verification.json",
  JSON.stringify(report, null, 2),
);
console.log(report);
