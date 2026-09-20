import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = process.env.ONLINE_ORIGIN ?? "http://127.0.0.1:4196";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const errors = [];
const verifyKyle = process.env.ONLINE_E2E_KYLE === "1";
let plantedBombsSeen = false, explodedBombsSeen = false;
const contexts = [],
  pages = [];
try {
  for (const [index, seat] of ["a", "b"].entries()) {
    const context = await browser.newContext({
      viewport: index
        ? { width: 390, height: 844 }
        : { width: 1280, height: 900 },
      reducedMotion: "reduce",
      ...(index ? { isMobile: true, hasTouch: true } : {}),
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
    await page.getByRole("button", { name: "Create friend fade" }).waitFor();
  }
  const [a, b] = pages;
  await b.screenshot({
    path: "screenshots/online-lobby-phone.png",
    fullPage: true,
  });
  await a.getByRole("button", { name: "Create friend fade" }).click();
  const code = await a.getByTestId("online-room-code").innerText();
  assert.match(code, /^[A-F0-9]{12}$/);
  await b.goto(`${origin}/game/online/${code}`);
  await b.getByRole("button", { name: "Join your friend" }).click();
  await b.getByTestId("online-room").waitFor();
  await Promise.all(
    pages.map((p) =>
      p.waitForFunction(
        () => !document.querySelector('[data-testid="online-ready"]')?.disabled,
      ),
    ),
  );
  await Promise.all(pages.map((p) => p.getByTestId("online-ready").click()));
  await Promise.all(pages.map((p) => p.getByTestId("online-battle").waitFor()));
  const read = async (index) => {
    const response = await contexts[index].request.get(
      `${origin}/api/multiplayer/${code}`,
    );
    assert.equal(response.status(), 200);
    return response.json();
  };
  const assertVisibleState = async () => {
    const views = await Promise.all([read(0), read(1)]);
    plantedBombsSeen ||= views[0].boards.flat().some(card => card.cardId === "smile-bomb" && card.smileBomb?.detonatesAtRound > views[0].round);
    explodedBombsSeen ||= views[0].events.some(event => /Smile Bomb hit|Smile Bomb fizzled|blocked the Smile Bomb/.test(event.note));
    assert.deepEqual(
      views[0].boards,
      views[1].boards,
      "both accounts receive the same authoritative board",
    );
    assert.deepEqual(
      views[0].scores,
      views[1].scores,
      "both accounts receive the same district scores",
    );
    assert.equal(views[0].activeSeat, views[1].activeSeat);
    for (const [index, page] of pages.entries()) {
      const snapshot = views[index];
      await page.waitForFunction(
        (revision) =>
          Number(
            document
              .querySelector('[data-testid="online-battle"]')
              ?.getAttribute("data-revision"),
          ) >= revision,
        snapshot.revision,
      );
      const actual = await page
        .locator(".online-board-card button")
        .evaluateAll((nodes) =>
          nodes
            .map((node) => ({
              id: node.dataset.instanceId,
              power: Number(node.dataset.cardPower),
              owner: node.closest("[data-owner]").dataset.owner,
              lane: Number(node.closest("[data-drop-lane]").dataset.dropLane),
            }))
            .sort((a, b) => a.id.localeCompare(b.id)),
        );
      const expected = snapshot.boards
        .flatMap((lane, index) =>
          lane.map((card) => ({
            id: card.instanceId,
            power: card.power,
            owner: card.owner,
            lane: index,
          })),
        )
        .sort((a, b) => a.id.localeCompare(b.id));
      assert.deepEqual(
        actual,
        expected,
        "every played card and Hands value renders in the right lane on both devices",
      );
      for (const [lane, score] of snapshot.scores.entries())
        for (const owner of ["player", "cpu"]) {
          assert.equal(
            Number(
              await page
                .locator(
                  `[data-drop-lane="${lane}"] [data-score-owner="${owner}"]`,
                )
                .innerText(),
            ),
            score[owner],
          );
        }
      if (snapshot.status === "active")
        assert.equal(
          await page.locator(".online-hand-card").count(),
          snapshot.hand.length,
        );
      await page.waitForFunction(() =>
        [
          ...document.querySelectorAll(".online-arena .collector-portrait"),
        ].every((img) => img.complete && img.naturalWidth > 0),
      );
      assert.equal(await page.locator("vite-error-overlay").count(), 0);
    }
  };
  const assertLayout = async (page) => {
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    const layout = await page.evaluate(() => {
      const rect = (selector) => {
        const r = document.querySelector(selector).getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      };
      return {
        viewport: innerHeight,
        width: innerWidth,
        board: rect(".online-districts"),
        hand: rect(".online-hand"),
        actions: rect(".online-actions"),
        scrollWidth: document.documentElement.scrollWidth,
        occluders: [...document.querySelectorAll(".online-actions button")].map(button => { const r=button.getBoundingClientRect(); return {button:button.textContent,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.outerHTML.slice(0,250)}; }),
        buttons: [...document.querySelectorAll(".online-actions button")].map(
          (button) => {
            const r = button.getBoundingClientRect();
            return button.contains(
              document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
            );
          },
        ),
      };
    });
    assert(
      layout.board.top >= 0 && layout.board.bottom <= layout.hand.top,
      "all three districts fit above the hand",
    );
    assert(
      layout.hand.bottom <= layout.actions.top + 1,
      "hand never overlaps the action bar",
    );
    assert(
      layout.actions.bottom <= layout.viewport + 1,
      `actions are on screen without scrolling: ${JSON.stringify(layout)}`,
    );
    assert(layout.scrollWidth <= layout.width, "no horizontal page overflow");
    assert(layout.hand.right <= layout.width && layout.actions.right <= layout.width, "hand and controls stay inside the viewport even with a long ability selected");
    if (!layout.buttons.every(Boolean)) await page.screenshot({path:"screenshots/online-input-failure.png",fullPage:true});
    assert(
      layout.buttons.every(Boolean),
      "no selected card intercepts action buttons: " + JSON.stringify(layout),
    );
  };
  await assertVisibleState();
  await Promise.all(pages.map(assertLayout));
  let view = await read(0);
  for (let turn = 0; turn < 12; turn++) {
    const index = view.activeSeat === "player" ? 0 : 1,
      page = pages[index];
    view = await read(index);
    const press = (locator) => (index ? locator.tap() : locator.click());
    await page
      .locator(
        `[data-testid="online-battle"][data-turn="you"][data-round="${view.round}"]`,
      )
      .waitFor();
    if (turn === 4) {
      // Exhaust the first GET retry after reload: polling must still recover without focus/click.
      let failed = 0;
      await page.route(`**/api/multiplayer/${code}`, (route) =>
        ++failed <= 2 ? route.abort("failed") : route.continue(),
      );
      const before = view;
      await page.reload();
      await page.getByTestId("online-battle").waitFor();
      view = await read(index);
      assert.deepEqual(view.hand, before.hand);
      assert.deepEqual(view.scores, before.scores);
      await page.unroute(`**/api/multiplayer/${code}`);
    }
    const observer = 1 - index;
    if (turn === 5) {
      await contexts[observer].setOffline(true);
      await pages[observer].waitForFunction(
        () =>
          document
            .querySelector('[data-testid="online-battle"]')
            ?.getAttribute("data-connected") === "false",
      );
    }
    let releaseStale;
    if (turn === 2) {
      let held;
      const captured = new Promise((resolve) => (held = resolve));
      const release = new Promise((resolve) => (releaseStale = resolve));
      await page.route(
        `**/api/multiplayer/${code}`,
        async (route) => {
          const response = await route.fetch();
          held();
          await release;
          await route.fulfill({ response }).catch(() => {});
        },
        { times: 1 },
      );
      await captured;
    }
    const retriedIds = [];
    if (turn === 0) {
      await page.route("**/actions", async (route) => {
        retriedIds.push(route.request().postDataJSON().requestId);
        if (retriedIds.length === 1) {
          await route.fetch();
          await route.abort("failed");
        } else await route.continue();
      });
    }
    const orderedHand = verifyKyle ? [...view.hand].sort((a,b) => Number(b.cardId === "kyle") - Number(a.cardId === "kyle")) : view.hand;
    const card = orderedHand.find((card) =>
      card.costs.some((cost) => cost <= view.motion[view.seat]),
    );
    if (card) {
      const lane = [turn % 3, (turn + 1) % 3, (turn + 2) % 3].find(
        (lane) =>
          !view.lockedLanes?.includes(lane) &&
          (card.cardId !== "kyle" || view.districts[lane].id !== "blackout-block") &&
          card.costs[lane] <= view.motion[view.seat],
      );
      await press(page.getByTestId(`online-card-${card.cardId}`));
      await press(page.getByRole("button", { name: /^Choose / }).nth(lane));
      if (!view.squabble[view.seat])
        await press(
          page.getByRole("button", { name: "SQUABBLE ×2", exact: true }),
        );
      await assertLayout(page);
      if (turn === 1) {
        await page.route(
          "**/actions",
          (route) =>
            route.fulfill({
              status: 409,
              contentType: "application/json",
              body: JSON.stringify({
                error: "The fade changed. Try your move again.",
              }),
            }),
          { times: 1 },
        );
        const rejected = page.waitForResponse((response) =>
          response.url().endsWith("/actions"),
        );
        await page.getByTestId("online-play-card").click();
        assert.equal((await rejected).status(), 409);
        await page.getByRole("alert").waitFor();
        assert.equal(
          await page
            .getByTestId(`online-card-${card.cardId}`)
            .getAttribute("aria-pressed"),
          "true",
          "rejected move keeps the card selected",
        );
      }
      const played = page.waitForResponse(
        (response) =>
          response.url().endsWith("/actions") &&
          response.request().method() === "POST",
      );
      await press(page.getByTestId("online-play-card"));
      assert.equal((await played).status(), 200);
      if (turn === 0) {
        assert.equal(retriedIds.length, 2, "lost acknowledgement retried once");
        assert.equal(
          retriedIds[0],
          retriedIds[1],
          "retry retains the idempotency key",
        );
        await page.unroute("**/actions");
        const snapshot = await read(index);
        assert.equal(
          snapshot.boards
            .flat()
            .filter((item) => item.instanceId === card.instanceId).length,
          1,
        );
      }
    }
    if (releaseStale) {
      releaseStale();
      await page.waitForTimeout(250);
    }
    if (turn === 5) {
      await contexts[observer].setOffline(false);
      await pages[observer].evaluate(() =>
        window.dispatchEvent(new Event("online")),
      );
    }
    await assertVisibleState();
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
      await assertLayout(b);
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
      await assertLayout(b);
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
    await press(page.getByTestId("online-end-turn"));
    const response = await ended;
    assert.equal(response.status(), 200);
    view = await response.json();
    await assertVisibleState();
  }
  await Promise.all(
    pages.map((page) => page.getByTestId("online-result").waitFor()),
  );
  if (verifyKyle) {
    assert(plantedBombsSeen, "KYLE planted live bombs visible to both accounts");
    assert(explodedBombsSeen, "delayed bombs resolved through the real online API");
    console.log("KYLE real API: synchronized bombs and delayed explosions verified on desktop and phone.");
  }
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
  await b.getByRole("button", { name: "Accept runback" }).click();
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
          "offline rival catches up after a move",
          "lost action acknowledgement retries without duplicate cards",
          "late old poll cannot roll back a played card",
          "rejected move keeps the selected card for retry",
          "initial poll failures recover automatically",
          "both rendered boards, Hands and images checked after every action",
          "viewport-fit board, visible hand and unobstructed buttons",
          "320px layout",
          "matching results",
          "mutual runback",
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
