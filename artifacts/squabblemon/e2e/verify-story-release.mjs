import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { storyContent } from "../../../lib/squabblemon-engine/src/story.ts";
const origin = process.env.UI_ORIGIN ?? "http://127.0.0.1:4198";
assert(["127.0.0.1", "localhost"].includes(new URL(origin).hostname));
const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
});
const errors = [];
try {
  for (const [name, viewport] of [
    ["desktop", { width: 1440, height: 1000 }],
    ["phone", { width: 390, height: 844 }],
  ]) {
    const page = await browser.newPage({ viewport, reducedMotion: "reduce" });
    page.on("pageerror", (error) => errors.push(`${name}: ${error.message}`));
    await page.goto(origin + "/e2e/season-theater.fixture.html");
    await page.locator(".cinema-poster").first().waitFor();
    assert.equal(await page.locator(".cinema-poster").count(), 8);
    await page.screenshot({ path: `screenshots/release/stories-${name}.png` });
    const node = storyContent.chapters
      .flatMap((chapter) => chapter.nodes)
      .find((node) => node.id === "sherlock-thirteenth-bell-clocks");
    assert(node?.puzzle);
    await page.goto(
      origin +
        "/e2e/season-theater.fixture.html?scenario=puzzle&puzzleNode=" +
        node.id,
    );
    await page
      .getByRole("heading", { name: node.puzzle.title, exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Reveal Hint 1 / 2", exact: true })
      .click();
    for (const [position, id] of node.puzzle.solution.entries()) {
      let order = await page
        .locator("[data-puzzle-piece]")
        .evaluateAll((elements) =>
          elements.map((element) => element.dataset.puzzlePiece),
        );
      while (order.indexOf(id) > position) {
        await page
          .locator(`[data-puzzle-piece="${id}"]`)
          .getByRole("button", { name: /^Move .* up$/ })
          .click();
        order = await page
          .locator("[data-puzzle-piece]")
          .evaluateAll((elements) =>
            elements.map((element) => element.dataset.puzzlePiece),
          );
      }
    }
    assert.deepEqual(
      await page
        .locator("[data-puzzle-piece]")
        .evaluateAll((elements) =>
          elements.map((element) => element.dataset.puzzlePiece),
        ),
      node.puzzle.solution,
    );
    await page.screenshot({ path: `screenshots/release/puzzle-${name}.png` });
    await page
      .getByRole("button", { name: "Submit evidence", exact: true })
      .click();
    await page.getByText(node.puzzle.solvedText, { exact: true }).waitFor();
    assert.equal(
      await page.evaluate(
        (id) => localStorage.getItem(`season-theater:puzzle:${id}`),
        node.id,
      ),
      "complete",
    );
    await page.goto(origin + "/e2e/park.fixture.html");
    const rank = page.getByRole("progressbar", {
      name: "Progress to next rank",
    });
    await rank.waitFor();
    await page.waitForFunction(
      () =>
        document
          .querySelector('[aria-label="Progress to next rank"]')
          ?.getAttribute("aria-valuenow") === "3",
    );
    assert.equal(
      await page.locator(".rank-cigarette").evaluate((el) => el.style.width),
      "97.5%",
    );
    const size = await rank.boundingBox();
    assert(size.height <= 10, "The cigarette remains thin");
    const ember = await page.locator(".rank-ember").boundingBox();
    const filter = await page.locator(".rank-filter").boundingBox();
    assert(ember.x < filter.x, "The cigarette points left");
    await page.screenshot({ path: `screenshots/release/rank-${name}.png` });
    await page.goto(origin + "/e2e/card-inspection.fixture.html");
    await page.getByRole("button", { name: "solo", exact: true }).click();
    const card = page
      .getByTestId("hand-tray")
      .locator('[data-card-id="cornball"]');
    await card.scrollIntoViewIfNeeded();
    const bounds = await card.boundingBox();
    await page.mouse.move(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    );
    await page.mouse.down();
    await page.getByRole("dialog").waitFor();
    await page.mouse.up();
    await page.locator(".dossier-paper .dr-fade-referee").waitFor();
    await page.screenshot({
      path: `screenshots/release/card-popup-${name}.png`,
    });
    await page
      .getByRole("button", { name: "Close card details", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "detached" });
    await page.goto(origin + "/how-to-play");
    await page.getByText("Stockz", { exact: false }).first().waitFor();
    assert(await page.getByText(/24 saved/).count());
    await page.close();
    console.log("PASS story and popup presentation", name);
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
