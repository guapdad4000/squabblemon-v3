import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.ARCADE_BASE_URL ?? "http://127.0.0.1:4231",
  out = process.env.REVIEW_OUTPUT ?? "../../screenshots/boss-raid";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
});
const report = [];
try {
  for (const [name, width, height, reduced] of [
    ["desktop", 1440, 1000, false],
    ["phone", 390, 844, false],
    ["phone-short", 360, 640, true],
    ["ipad-portrait", 768, 1024, false],
    ["ipad-landscape", 1024, 768, false],
  ] as const) {
    const context = await browser.newContext({
        viewport: { width, height },
        reducedMotion: reduced ? "reduce" : "no-preference",
      }),
      page = await context.newPage(),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.status() >= 400 && r.url().includes("/assets/boss-raid/"))
        errors.push(`Missing sprite: ${r.url()}`);
    });
    await page.goto(
      `${base}/e2e/boss-raid.fixture.html${reduced ? "?reduced=1" : ""}`,
    );
    await page.getByRole("button", { name: "FIGHT THE PRECINCT →" }).click();
    await page.locator("[data-testid=boss-raid-stage]").waitFor();
    const counters = await page.evaluate(() => ({
      draw: document.querySelector('.raid-deck-counter')!.getBoundingClientRect().x,
      damage: document.querySelector('.raid-damage-counter')!.getBoundingClientRect().x,
    }));
    assert.ok(counters.draw < counters.damage, 'Draw counter must precede damage');
    const initial = await page.evaluate(() => (window as any).__raid);
    assert.equal(initial.match.round, 1);
    await page.getByRole("button", { name: "How to fight" }).click();
    await page.getByRole("dialog").waitFor();
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.waitForFunction(
      () => document.activeElement?.textContent === "How to fight ⓘ",
    );
    let actions = 0;
    for (let round = 1; round <= 6; round++) {
      while (true) {
        const legal = await page.evaluate(
          () =>
            (window as any).__raidLegal as {
              instanceId: string;
              lane: number;
            }[],
        );
        if (!legal.length) break;
        const choice = legal[0],
          old = await page.evaluate(() => (window as any).__raid.revision);
        await page.locator(`[data-instance="${choice.instanceId}"]`).click();
        assert.equal(await page.locator(".raid-deploy").count(), 3);
        await page.locator(".raid-deploy").nth(choice.lane).click();
        assert.equal(
          await page
            .locator(`.raid-lane[data-lane="${choice.lane}"]`)
            .getAttribute("data-selected"),
          "true",
        );
        await page.getByRole("button", { name: /PLAY CARD/ }).click();
        await page.waitForFunction(
          (rev) => (window as any).__raid.revision === rev + 1,
          old,
        );
        await page.waitForFunction(
          () => !document.querySelector(".raid-deploy"),
        );
        actions++;
        assert(actions < 30);
      }
      if (round === 3) {
        await page.screenshot({
          path: `${out}/${name}-battle.png`,
          fullPage: true,
        });
        const bounds = await page
          .locator(".raid-hand")
          .evaluate((e) => ({ width: e.clientWidth, scroll: e.scrollWidth }));
        assert(bounds.width <= width);
        assert((await page.locator(".raid-crew .collector-card").count()) > 0);
      }
      const fired = await page.evaluate(() => (window as any).__raid.revision);
      await page.getByRole("button", { name: /END TURN/ }).click();
      await page.waitForFunction(
        (rev) => (window as any).__raid.revision === rev + 1,
        fired,
      );
      await page.locator(".raid-blast").waitFor();
      if (round === 3) {
        if (!reduced) await page.waitForTimeout(650);
        await page.screenshot({
          path: `${out}/${name}-blast.png`,
          fullPage: true,
        });
      }
      await page.locator(".raid-blast").waitFor({ state: "hidden" });
      const state = await page.evaluate(() => (window as any).__raid);
      assert.equal(state.blasts.length, round);
      assert.equal(state.blasts.at(-1).winners.length, 3);
      if (round === 2) {
        await page.locator(".raid-npc").first().click();
        await page.locator('.card-inspector-shell').waitFor();
        await page.locator('.dossier-paper').waitFor();
        await page.screenshot({path: `${out}/${name}-police-details.png`, fullPage: true});
        await page.getByRole('button', {name: 'Close card details'}).click();
        await page.locator('.card-inspector-shell').waitFor({state: 'hidden'});
      }
      if (state.phase !== "active") break;
      await page
        .locator("[data-testid=boss-raid-stage]")
        .filter({ has: page.locator(".raid-scoreline") })
        .waitFor();
      assert.equal(
        await page
          .locator("[data-testid=boss-raid-stage]")
          .getAttribute("data-round"),
        String(round + 1),
      );
      if (round === 2) {
        const revision = state.revision;
        await page.reload();
        await page.locator("[data-testid=boss-raid-stage]").waitFor();
        assert.equal(
          await page.evaluate(() => (window as any).__raid.revision),
          revision,
        );
      }
    }
    const final = await page.evaluate(() => (window as any).__raid);
    assert.equal(final.phase, "complete");
    assert(final.score > 0);
    await page.locator(".raid-results-popup").waitFor();
    const resultBox = await page.locator(".raid-results-popup").boundingBox();
    assert(
      resultBox && Math.abs(resultBox.x + resultBox.width / 2 - width / 2) < 2,
    );
    assert(
      resultBox &&
        Math.abs(resultBox.y + resultBox.height / 2 - height / 2) < 2,
    );
    assert.equal(
      await page
        .locator(".raid-controls")
        .getByRole("button", { name: /BACK TO FADECADE/ })
        .count(),
      0,
    );
    assert.equal(
      await page
        .locator(".raid-results-popup")
        .getByRole("button", { name: /BACK TO FADECADE/ })
        .count(),
      1,
    );
    await page.screenshot({
      path: `${out}/${name}-result.png`,
      fullPage: true,
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
    );
    assert.deepEqual(errors, []);
    const broken = await page
      .locator("img")
      .evaluateAll((images) =>
        images
          .filter((i) => !i.complete || i.naturalWidth === 0)
          .map((i) => i.src),
      );
    assert.deepEqual(broken, []);
    await page.getByRole("button", { name: "BACK TO FADECADE →" }).click();
    assert.equal(
      await page.locator("body").getAttribute("data-exited"),
      "true",
    );
    report.push({
      name,
      width,
      height,
      reduced,
      actions,
      score: final.score,
      rounds: final.blasts.length,
    });
    await context.close();
  }
  const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    page = await context.newPage();
  await page.goto(base + "/e2e/boss-raid.fixture.html?retry=1");
  await page.getByRole("button", { name: "FIGHT THE PRECINCT →" }).click();
  await page.getByRole("button", { name: /END TURN/ }).click();
  await page.getByRole("button", { name: "Retry save" }).waitFor();
  assert.equal(await page.evaluate(() => (window as any).__raid.revision), 1);
  await page.getByRole("button", { name: "Retry save" }).click();
  await page.locator(".raid-blast").waitFor({ state: "hidden" });
  await page.waitForFunction(() => document.querySelector('[data-round="2"]'));
  assert.equal(await page.evaluate(() => (window as any).__raid.revision), 1);
  assert.equal(
    await page.evaluate(() => (window as any).__raid.blasts.length),
    1,
  );
  await context.close();
  await writeFile(
    out + "/journey-report.json",
    JSON.stringify(
      {
        viewports: report,
        interruptedResponse: "saved blast retried without duplicate damage",
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
