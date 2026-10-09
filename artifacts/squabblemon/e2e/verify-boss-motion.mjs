import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const out = process.env.REVIEW_OUTPUT ?? "../../screenshots/boss-raid-v2";
const base = process.env.ARCADE_BASE_URL ?? "http://127.0.0.1:4231";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
});
const report = [];
try {
  for (let tier = 1; tier <= 5; tier++) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    let errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.status() >= 400 && r.url().includes("/boss-raid/"))
        errors.push(r.url() + ":" + r.status());
    });
    await page.goto(base + "/e2e/boss-raid.fixture.html?demo=1&tier=" + tier);
    await page.locator("[data-testid=boss-raid-stage]").waitFor();
    await page.waitForTimeout(600);
    assert.equal(
      await page.locator("main").getAttribute("data-tier"),
      String(tier),
    );
    const sprite = page.locator(".raid-boss-inspect .boss-idle-frames");
    const matrix = () => sprite.evaluate((e) => getComputedStyle(e).transform);
    const a = await matrix();
    await page.waitForTimeout(500);
    const b = await matrix();
    assert.notEqual(a, b, "idle must change frames");
    const sources = await page
      .locator(".boss-idle image")
      .evaluateAll((es) => es.map((e) => e.getAttribute("href")));
    for (const src of sources) {
      assert(src);
      const r = await page.request.get(new URL(src, page.url()).href);
      assert.equal(r.status(), 200);
    }
    await page.screenshot({
      path: out + "/tier-" + tier + "-desktop.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Inspect Officer Oink tiers" })
      .click();
    await page.getByRole("dialog").waitFor();
    assert.equal(
      await sprite.evaluate((e) => getComputedStyle(e).animationName),
      "none",
    );
    await page.locator(".raid-form-cards img").last().waitFor();
    await page.screenshot({
      path: out + "/tier-" + tier + "-cards.png",
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    await page.screenshot({
      path: out + "/tier-" + tier + "-phone.png",
      fullPage: true,
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
    );
    const title = await page.locator(".raid-boss-title").boundingBox(),
      boss = await page.locator(".raid-boss-inspect").boundingBox();
    assert(
      title.y + title.height <= boss.y + 1 ||
        title.x + title.width <= boss.x + 1 ||
        boss.x + boss.width <= title.x + 1,
      "boss head must not overlap title",
    );
    await page.evaluate(() => {
      document.body.style.minHeight = "2000px";
      scrollTo(0, 1200);
    });
    await page.waitForTimeout(500);
    assert.equal(
      await page
        .locator(".raid-boss-inspect .boss-idle")
        .getAttribute("data-motion-visible"),
      "false",
    );
    assert.equal(
      await sprite.evaluate((e) => getComputedStyle(e).animationPlayState),
      "paused",
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(
      await sprite.evaluate((e) => getComputedStyle(e).animationName),
      "none",
    );
    assert.deepEqual(errors, []);
    report.push({
      tier,
      loaded: new Set(sources).size,
      motion: [a, b],
      modalPaused: true,
      offscreenPaused: true,
      reducedStill: true,
      noTitleOverlap: true,
    });
    await page.close();
  }
  await writeFile(out + "/motion-report.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
