import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const out =
  process.env.REVIEW_OUTPUT ?? "../../screenshots/boss-raid-design/final";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  headless: true,
});
const report = [];
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
    if (r.status() >= 400 && r.url().includes("/boss-raid/"))
      errors.push(r.url());
  });
  await page.goto(
    `${process.env.ARCADE_BASE_URL ?? "http://127.0.0.1:4231"}/e2e/boss-raid.fixture.html`,
  );
  await page.getByRole("button", { name: "FIGHT THE PRECINCT →" }).click();
  await page.locator(".raid-field").waitFor();
  const before = await page.locator(".raid-field").boundingBox();
  const beforeScroll = await page.evaluate(() => scrollY);
  const legal = await page.evaluate(() => window.__raidLegal),
    first = legal[0];
  await page.locator(`[data-instance="${first.instanceId}"]`).click();
  const choices = legal.filter((c) => c.instanceId === first.instanceId);
  for (const choice of choices) {
    await page.locator(".raid-deploy").nth(choice.lane).click();
    assert.equal(
      await page.locator(".raid-lane[data-selected=true]").count(),
      1,
    );
    assert.equal(
      await page
        .locator(".raid-deploy")
        .nth(choice.lane)
        .getAttribute("aria-pressed"),
      "true",
    );
  }
  const after = await page.locator(".raid-field").boundingBox();
  const afterScroll = await page.evaluate(() => scrollY);
  assert(
    Math.abs(before.y + beforeScroll - after.y - afterScroll) < 1,
    `selection must not push field down: ${before.y + beforeScroll} vs ${after.y + afterScroll}`,
  );
  await page.waitForTimeout(250);
  const line = await page
    .locator(".raid-target-line path")
    .last()
    .getAttribute("d");
  assert(line?.startsWith("M "));
  const origin = line.split(" ").slice(1, 3).map(Number);
  const source = await page
      .locator(`[data-instance="${first.instanceId}"]`)
      .boundingBox(),
    arena = await page.locator(".raid-arena").boundingBox();
  assert(
    Math.abs(origin[0] - (source.x + source.width / 2 - arena.x)) < 2,
    "aim starts at selected card",
  );
  assert(Math.abs(origin[1] - (source.y - arena.y)) < 2);
  const dock = await page.locator(".raid-hand-dock").boundingBox();
  assert(
    Math.abs(dock.y + dock.height - after.y - after.height) < 2,
    "field must extend to the bottom of the hand container",
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    false,
  );
  await page.screenshot({
    path: `${out}/${name}-selected.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: /PLAY CARD/ }).focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => !document.querySelector(".raid-deploy"));
  assert.equal(await page.locator(".raid-target-line").count(), 0);
  await page.evaluate(() => localStorage.clear());
  await page.goto(
    `${process.env.ARCADE_BASE_URL ?? "http://127.0.0.1:4231"}/e2e/boss-raid.fixture.html?demo=1`,
  );
  await page.locator(".raid-field").waitFor();
  await page.screenshot({ path: `${out}/${name}-arena.png`, fullPage: true });
  if (w > 600) {
    const clipped = await page.evaluate(
      () =>
        Array.from(
          document.querySelectorAll(
            ".raid-crew .collector-card,.raid-hand-card",
          ),
        ).filter((card) => {
          const bounds = card.getBoundingClientRect();
          const container = card
            .closest(".raid-crew,.raid-hand")
            .getBoundingClientRect();
          return (
            bounds.left < container.left - 1 ||
            bounds.right > container.right + 1 ||
            bounds.top < container.top - 1 ||
            bounds.bottom > container.bottom + 1
          );
        }).length,
    );
    assert.equal(
      clipped,
      0,
      "desktop/tablet cards must fit completely inside their containers",
    );
  }
  assert.deepEqual(errors, []);
  report.push({
    name,
    w,
    h,
    errors,
    fieldStable: true,
    sourceAnchored: true,
    handLayeredAboveBoard: true,
    keyboardConfirmed: true,
    horizontalOverflow: false,
  });
  await page.close();
}
await browser.close();
await writeFile(
  out + "/design-verification.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report));
