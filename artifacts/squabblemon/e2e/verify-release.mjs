import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { fadecadeBootstrap, installFadecadeApi } from "./fadecade.fixture.ts";
import { accountRewardStatus } from "../../../lib/squabblemon-engine/src/accountRewards.ts";
const origin = process.env.UI_ORIGIN ?? "http://127.0.0.1:4198";
assert(["127.0.0.1", "localhost"].includes(new URL(origin).hostname));
const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
});
await mkdir("screenshots/release", { recursive: true });
const errors = [];
try {
  for (const [name, viewport] of [
    ["desktop", { width: 1440, height: 1000 }],
    ["phone", { width: 390, height: 844 }],
  ]) {
    const context = await browser.newContext({ viewport });
    await context.addInitScript(() =>
      localStorage.setItem("squabblemon_e2e_user", "signed-in"),
    );
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(name + ": " + e.message));
    await installFadecadeApi(page);
    let bootstrap = fadecadeBootstrap(),
      claimed = false,
      active = null,
      recent = [];
    const now = new Date(),
      created = new Date();
    await page.route("**/api/player/bootstrap", (r) =>
      r.fulfill({ json: bootstrap }),
    );
    await page.route("**/api/player/story", (r) =>
      r.fulfill({
        status: 503,
        json: { error: "Story not part of home fixture" },
      }),
    );
    await page.route("**/api/player/rewards/account", (r) =>
      r.fulfill({
        json: accountRewardStatus(
          1,
          created,
          claimed ? accountRewardStatus(1, created, [], now).pending : [],
          now,
        ),
      }),
    );
    await page.route("**/api/player/rewards/account/claim", (r) => {
      const rewards = claimed
        ? []
        : accountRewardStatus(1, created, [], now).pending;
      claimed = true;
      bootstrap = {
        ...bootstrap,
        profile: { ...bootstrap.profile, softCurrency: 1040, packTickets: 4 },
      };
      return r.fulfill({
        json: {
          rewards,
          status: accountRewardStatus(1, created, rewards, now),
          bootstrap,
        },
      });
    });
    await page.route("**/api/player/stockz**", (r) => {
      const action = new URL(r.request().url()).pathname.split("/").pop();
      if (action === "start") {
        const data = r.request().postDataJSON();
        active = {
          ...data,
          openPrice: 120,
          startedAt: now.toISOString(),
          closesAt: new Date(Date.now() + 1000).toISOString(),
          date: now.toISOString().slice(0, 10),
        };
        bootstrap.profile.softCurrency -= data.stake;
      }
      if (action === "settle") {
        recent = [{ ...active, closePrice: 129, payout: active.stake * 2 }];
        bootstrap.profile.softCurrency += active.stake * 2;
        active = null;
      }
      return r.fulfill({
        json: { roundsToday: active || recent.length ? 1 : 0, active, recent },
      });
    });
    try {
      await page.goto(origin + "/game");
      await page
        .locator('.safehouse-stage[data-scene-ready="true"]')
        .waitFor({ timeout: 30000 });
      await page.waitForTimeout(1800);
      const marker = page.getByRole("button", {
        name: "Explore the arcade machine",
        exact: true,
      });
      await marker.waitFor();
      const bounds = await marker.boundingBox();
      assert(bounds);
      await page.mouse.click(
        bounds.x + bounds.width / 2,
        bounds.y + bounds.height / 2,
      );
      await page
        .getByRole("link", {
          name: /Enter the Fadecade|Hit the arcade|Enter Fadecade/,
        })
        .waitFor();
      await page.screenshot({ path: `screenshots/release/arcade-${name}.png` });
      await page
        .getByRole("button", { name: "Back to the room", exact: true })
        .click();
      await page.getByRole("button", { name: /Daily check-in/ }).click();
      await page.getByRole("dialog", { name: "Keep the streak." }).waitFor();
      await page.screenshot({
        path: `screenshots/release/check-in-${name}.png`,
      });
      await page
        .getByRole("button", { name: "Collect rewards", exact: true })
        .click();
      await page.getByRole("dialog").waitFor();
      assert(claimed);
      await page.goto(origin + "/game/collection");
      await page
        .getByRole("navigation", { name: "Your cards and gangs" })
        .getByRole("link", { name: /Decks/ })
        .click();
      assert(new URL(page.url()).pathname === "/game/decks");
      await page.screenshot({
        path: `screenshots/release/deck-tabs-${name}.png`,
      });
      await page.goto(origin + "/game/missions");
      await page.locator(".bounty-ledger").waitFor();
      assert.equal(
        await page
          .locator(".bounty-ledger")
          .evaluate((el) => !!el.closest(".bounty-hunter__board")),
        false,
      );
      await page.screenshot({
        path: `screenshots/release/bounties-${name}.png`,
      });
      await page.goto(origin + "/game/play");
      await page
        .getByRole("dialog", { name: "Training Circuit", exact: true })
        .waitFor();
      assert(new URL(page.url()).pathname === "/game/training");
      await page.goto(origin + "/game/challenges");
      await page
        .getByRole("button", { name: "Play Stockz", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Bet 25 Clout", exact: true })
        .click();
      await page.getByText("TRADE LOCKED", { exact: true }).waitFor();
      await page.reload();
      await page
        .getByRole("button", { name: "Play Stockz", exact: true })
        .click();
      await page.getByText("TRADE LOCKED", { exact: true }).waitFor();
      await page
        .getByRole("button", { name: "Reveal closing price", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "Trade receipts", exact: true })
        .waitFor();
      await page.screenshot({ path: `screenshots/release/stockz-${name}.png` });
      assert.equal(recent.length, 1);
      assert.equal(active, null);
      assert(
        (await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        )) <= 1,
      );
      console.log("PASS release journey", name);
    } catch (e) {
      console.log("BODY", await page.locator("body").innerText());
      await page.screenshot({ path: `screenshots/release/error-${name}.png` });
      throw e;
    }
    await context.close();
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
