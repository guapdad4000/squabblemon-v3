import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = process.env.ONLINE_ORIGIN ?? "http://127.0.0.1:4196";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const errors = [];
const contexts = [],
  pages = [];
try {
  for (const [index, seat] of ["a", "b"].entries()) {
    const context = await browser.newContext({
      viewport: index
        ? { width: 390, height: 844 }
        : { width: 1280, height: 900 },
      reducedMotion: "reduce",
    });
    await context.addCookies([
      { name: "online_test_seat", value: seat, url: origin },
    ]);
    await context.addInitScript(() =>
      localStorage.setItem("squabblemon_e2e_user", "signed-in"),
    );
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    contexts.push(context);
    pages.push(page);
    await page.goto(`${origin}/game/online`);
    await page.getByRole("button", { name: "Create friend match" }).waitFor();
  }
  const [a, b] = pages;
  await b.screenshot({
    path: "screenshots/online-lobby-phone.png",
    fullPage: true,
  });
  await a.getByRole("button", { name: "Create friend match" }).click();
  const code = await a.getByTestId("online-room-code").innerText();
  assert.match(code, /^[A-F0-9]{12}$/);
  await b.goto(`${origin}/game/online/${code}`);
  await b.getByRole("button", { name: "Join your friend" }).click();
  await b.getByTestId("online-room").waitFor();
  await a.getByTestId("online-ready").waitFor();
  await a.getByTestId("online-ready").click();
  await b.waitForFunction(() =>
    document
      .querySelector(".online-room-members")
      ?.textContent.includes("READY"),
  );
  await b.getByTestId("online-ready").click();
  await Promise.all(pages.map((p) => p.getByTestId("online-battle").waitFor()));
  const read = async (index) => {
    const response = await contexts[index].request.get(
      `${origin}/api/multiplayer/${code}`,
    );
    assert.equal(response.status(), 200);
    return response.json();
  };
  let view = await read(0);
  for (let turn = 0; turn < 12; turn++) {
    const index = view.activeSeat === "player" ? 0 : 1,
      page = pages[index];
    view = await read(index);
    await page
      .locator(
        `[data-testid="online-battle"][data-turn="you"][data-round="${view.round}"]`,
      )
      .waitFor();
    if (turn === 4) {
      const before = view;
      await page.reload();
      await page.getByTestId("online-battle").waitFor();
      view = await read(index);
      assert.deepEqual(view.hand, before.hand);
      assert.deepEqual(view.scores, before.scores);
    }
    if (turn === 5) {
      await contexts[index].setOffline(true);
      await page.waitForTimeout(1800);
      await contexts[index].setOffline(false);
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await page.getByTestId("online-end-turn").waitFor();
    }
    const card = view.hand.find((card) =>
      card.costs.some((cost) => cost <= view.motion[view.seat]),
    );
    if (card) {
      const lane = card.costs.findIndex(
        (cost) => cost <= view.motion[view.seat],
      );
      await page.getByTestId(`online-card-${card.cardId}`).click();
      await page
        .getByRole("button", { name: /^Choose / })
        .nth(lane)
        .click();
      if (!view.squabble[view.seat])
        await page
          .getByRole("button", { name: "SQUABBLE ×2", exact: true })
          .click();
      const played = page.waitForResponse(
        (response) =>
          response.url().endsWith("/actions") &&
          response.request().method() === "POST",
      );
      await page.getByTestId("online-play-card").click();
      assert.equal((await played).status(), 200);
    }
    if (turn === 3) {
      await a.screenshot({
        path: "screenshots/online-battle-desktop.png",
        fullPage: true,
      });
      await b.screenshot({
        path: "screenshots/online-battle-phone.png",
        fullPage: true,
      });
      await b.setViewportSize({ width: 320, height: 740 });
      assert(
        await b.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "small phone has no horizontal page overflow",
      );
      await b.screenshot({
        path: "screenshots/online-battle-small-phone.png",
        fullPage: true,
      });
      await b.setViewportSize({ width: 390, height: 844 });
      await b.locator(".online-board-card button").first().click();
      await b.getByRole("dialog").waitFor();
      await b.keyboard.press("Escape");
      await b.getByRole("dialog").waitFor({ state: "hidden" });
      await b.getByRole("button", { name: "Surrender", exact: true }).click();
      await b.getByRole("dialog").waitFor();
      await b
        .getByRole("button", { name: "Keep playing", exact: true })
        .click();
      await b.getByRole("dialog").waitFor({ state: "hidden" });
    }
    const ended = page.waitForResponse(
      (response) =>
        response.url().endsWith("/actions") &&
        response.request().method() === "POST",
    );
    await page.getByTestId("online-end-turn").click();
    const response = await ended;
    assert.equal(response.status(), 200);
    view = await response.json();
  }
  await Promise.all(
    pages.map((page) => page.getByTestId("online-result").waitFor()),
  );
  const finalA = await read(0),
    finalB = await read(1);
  assert.deepEqual(finalA.scores, finalB.scores);
  assert.equal(finalA.winner, finalB.winner);
  assert.deepEqual(finalA.squabble, { player: true, cpu: true });
  await a.screenshot({
    path: "screenshots/online-result-desktop.png",
    fullPage: true,
  });
  await b.screenshot({
    path: "screenshots/online-result-phone.png",
    fullPage: true,
  });
  await a.getByRole("button", { name: "Run it back", exact: true }).click();
  await b.getByRole("button", { name: "Accept rematch" }).click();
  await Promise.all(
    pages.map((page) => page.getByTestId("online-room").waitFor()),
  );
  assert.equal((await read(0)).gameNumber, 2);
  await a.reload();
  await a.getByTestId("online-room").waitFor();
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        passed: true,
        code,
        checks: [
          "real API lobby and deep-link join",
          "two separate authenticated sessions",
          "twelve human turns",
          "both Squabbles",
          "refresh restores hand and scores",
          "network reconnection",
          "320px layout",
          "matching results",
          "mutual rematch",
          "no browser exceptions",
        ],
      },
      null,
      2,
    ),
  );
} catch (error) {
  for (const [index, page] of pages.entries())
    await page
      .screenshot({
        path: `screenshots/online-failure-${index}.png`,
        fullPage: true,
      })
      .catch(() => {});
  throw error;
} finally {
  await browser.close();
}
