import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import {
  legendBountyStatuses,
  LEGEND_BOUNTIES,
} from "../../../lib/squabblemon-engine/src/legendBounties.ts";
// Actual Missions view with controlled account responses, never live claims.
const origin = process.env.UI_ORIGIN ?? "http://127.0.0.1:4242";
const output = process.env.QA_OUTPUT ?? "e2e/screenshots/bounty-qa";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE,
  args: ["--no-sandbox"],
});
const report = [];
try {
  for (const viewport of [
    { width: 1906, height: 929 },
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
    { width: 320, height: 740 },
  ]) {
    const page = await browser.newPage({ viewport });
    // Other QA edits must not hot-reload and reset an in-flight claim fixture.
    await page.routeWebSocket("**", (socket) => socket.close());
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/player/rewards/*", (r) =>
      r.fulfill({
        json: r.request().url().endsWith("legend-bounties")
          ? legendBountyStatuses(
              {},
              [],
              LEGEND_BOUNTIES.map((b) => b.id),
              ["starter-mythic:nothing-to-lose:v1"],
            )
          : { state: "claimed", ownsCard: true, chapters: [] },
      }),
    );
    const start = async () => {
      await page.goto(
        `${origin}/e2e/bounty-gang.fixture.html?screen=bounties&scenario=ready`,
      );
      await page.locator(".legend-seat").last().waitFor();
      await page.waitForFunction(() =>
        [...document.querySelectorAll(".legend-seat img")].every(
          (i) => i.complete && i.naturalWidth > 0,
        ),
      );
    };
    await start();
    assert.equal(await page.locator(".legend-seat").count(), 7);
    assert.equal(await page.locator(".legend-seat__nodes li").count(), 21);
    assert.equal(
      await page.getByTestId("bounty-pistol").count(),
      0,
      "No idle weapon",
    );
    const bounds = await page.evaluate(() => {
      const box = (s) => {
        const n = document.querySelector(s),
          r = n.getBoundingClientRect();
        return {
          x: r.x,
          right: r.right,
          width: r.width,
          scroll: n.scrollWidth,
          client: n.clientWidth,
        };
      };
      return {
        page: box(".bounty-hunter__scroll"),
        legends: box(".legend-bar"),
        milestones: box(".bounty-milestones"),
        starter: box(".starter-mythic-banner"),
        john: box(".john-henry-banner"),
        documentFits: document.documentElement.scrollWidth <= innerWidth,
      };
    });
    assert.ok(bounds.documentFits);
    assert.ok(bounds.page.scroll <= bounds.page.client);
    assert.ok(
      Math.abs(bounds.legends.x - bounds.milestones.x) < 1,
      "Shared outer gutter",
    );
    for (const key of ["starter", "john"]) {
      assert.ok(
        bounds[key].x >= bounds.milestones.x + 10,
        `${key} inner gutter`,
      );
      assert.ok(bounds[key].right <= bounds.milestones.right - 10);
    }
    await page
      .locator(".legend-bar")
      .evaluate((n) => n.scrollIntoView({ block: "start" }));
    await page.screenshot({
      path: `${output}/bounty-after-${viewport.width}.png`,
    });
    await page
      .locator(".legend-seat__caption")
      .first()
      .evaluate((n) => n.scrollIntoView({ block: "center" }));
    await page.screenshot({
      path: `${output}/bounty-contracts-${viewport.width}.png`,
    });
    await page
      .getByRole("button", {
        name: "Continue bounty · Block Party Titan",
        exact: true,
      })
      .click();
    await page.locator(".bounty-journey[open]").waitFor();
    assert.equal(await page.locator(".bounty-path li").count(), 3);
    await page.keyboard.press("Escape");
    await page
      .locator(".bounty-milestones")
      .evaluate((n) => n.scrollIntoView({ block: "center" }));
    await page.screenshot({
      path: `${output}/bounty-milestones-${viewport.width}.png`,
    });
    for (const kind of ["pistol", "minigun"]) {
      await start();
      let resolveClaim;
      const pending = new Promise((resolve) => {
        resolveClaim = resolve;
      });
      await page.route("**/api/player/missions/*/claim", (r) =>
        resolveClaim(r),
      );
      await page
        .getByRole("button", {
          name:
            kind === "pistol"
              ? "Claim reward for Clear the Air"
              : "Collect all · 1",
          exact: true,
        })
        .click();
      const route = await pending,
        gun = page.getByTestId("bounty-pistol");
      await gun.waitFor();
      assert.equal(await gun.getAttribute("data-weapon"), kind);
      assert.equal(await gun.getAttribute("data-phase"), "loading");
      await page.waitForFunction(() =>
        [...document.querySelectorAll(".bounty-hunter__pistol")].every(
          (i) => i.complete && i.naturalWidth > 0,
        ),
      );
      const g = await page.evaluate(() => {
        const b = document
            .querySelector(".bounty-hunter-page")
            .getBoundingClientRect(),
          w = document
            .querySelector(".bounty-hunter__pov-inner")
            .getBoundingClientRect();
        return {
          delta: Math.abs(w.x + w.width / 2 - b.x - b.width / 2),
          right: w.right,
          boardRight: b.right,
        };
      });
      assert.ok(g.delta < 1, `${kind} centered at ${viewport.width}`);
      assert.ok(g.right <= g.boardRight);
      await page.screenshot({
        path: `${output}/bounty-${kind}-${viewport.width}.png`,
      });
      const current = await page.evaluate(() =>
        window.__bountyGangFixture.cachedBootstrap(),
      );
      await route.fulfill({
        json: {
          ...current,
          profile: {
            ...current.profile,
            softCurrency: current.profile.softCurrency + 125,
          },
          missions: current.missions.map((m) =>
            m.status === "claimable" ? { ...m, status: "claimed" } : m,
          ),
        },
      });
      await gun.waitFor({ state: "detached" });
      assert.equal(
        (
          await page.evaluate(() =>
            window.__bountyGangFixture.cachedBootstrap(),
          )
        ).profile.softCurrency,
        1125,
      );
      await page.unroute("**/api/player/missions/*/claim");
    }
    assert.deepEqual(errors, []);
    report.push({
      viewport,
      bounds,
      weapons: "single and sweep centered; saved claims preserved",
      pageErrors: errors,
    });
    await page.close();
  }
  await writeFile(`${output}/bounty-qa.json`, JSON.stringify(report, null, 2));
  console.log(
    `PASS bounty QA: ${report.length} viewports, both claim weapons, contract navigation, inset banners and saved rewards.`,
  );
} finally {
  await browser.close();
}
