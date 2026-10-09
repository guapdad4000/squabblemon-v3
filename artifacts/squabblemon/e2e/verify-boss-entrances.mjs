import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const out =
  process.env.REVIEW_OUTPUT ?? "../../screenshots/boss-raid-police-entrances";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  }),
  page = await browser.newPage({
    viewport: {
      width: Number(process.env.VIEWPORT_WIDTH ?? 390),
      height: Number(process.env.VIEWPORT_HEIGHT ?? 844),
    },
  });
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
await page.getByRole("button", { name: /END TURN/ }).click();
await page.waitForFunction(() => window.__raid.blasts.length > 0);
let plays = await page.evaluate(() => window.__raid.blasts.at(-1).policePlays);
for (let round = 0; plays.length < 2 && round < 4; round++) {
  const old = await page.evaluate(() => window.__raid.blasts.length);
  await page.getByRole("button", { name: /END TURN/ }).click();
  await page.waitForFunction((n) => window.__raid.blasts.length > n, old);
  plays = await page.evaluate(() => window.__raid.blasts.at(-1).policePlays);
}
assert(plays.length > 0);
let seen = [];
for (const play of plays) {
  const banner = page.locator(
    `[data-testid="police-entrance-banner"][data-instance="${play.instanceId}"]`,
  );
  await banner.waitFor();
  assert((await banner.textContent()).includes(play.name));
  const art = await banner.locator(".raid-entrance-art").boundingBox();
  assert(art.height >= 160);
  await page.waitForTimeout(160);
  await page.screenshot({
    path: out + `/phone-entrance-${seen.length}.png`,
    fullPage: true,
  });
  seen.push(play.name);
}
await page
  .locator('[data-testid="police-entrance-banner"]')
  .waitFor({ state: "detached" });
assert.equal(await page.locator(".raid-opponent-hand").count(), 0);
assert.equal(
  await page.locator(".raid-damage-counter b").textContent(),
  `−${await page.evaluate(() => window.__raid.score)}`,
);
await page.screenshot({
  path: out + "/phone-after-entrances.png",
  fullPage: true,
});
await writeFile(
  out + "/police-entrance-check.json",
  JSON.stringify(
    {
      expected: plays.map((p) => p.name),
      seen,
      largeSprites: true,
      deckRowRemoved: true,
    },
    null,
    2,
  ),
);
console.log({ seen });
await browser.close();
