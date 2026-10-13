import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const require = createRequire(new URL("../package.json", import.meta.url));
const { chromium, expect } = require("@playwright/test");
const origin = process.env.PLAYER_NOTES_ORIGIN ?? "http://127.0.0.1:4293";
const output = path.resolve(
  fileURLToPath(
    new URL("../../deliverables/player-notes-20261012", import.meta.url),
  ),
);
mkdirSync(path.join(output, "screenshots"), { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = [];
async function open(screen, width = 390, motion = "reduce") {
  const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1000 },
    }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.notesVideoPlayed = false;
    document.addEventListener(
      "playing",
      (event) => {
        if (event.target instanceof HTMLVideoElement)
          window.notesVideoPlayed = true;
      },
      true,
    );
  });
  await page.goto(
    `${origin}/e2e/player-notes.fixture.html?screen=${screen}&motion=${motion}`,
    { waitUntil: "domcontentloaded" },
  );
  await page.locator("#root > *").waitFor();
  return { context, page, errors };
}
try {
  for (const width of [390, 1440])
    for (const screen of [
      "friendly-record",
    "community",
      "auto",
      "journey",
      "park",
      "rank",
      "bounties",
    ]) {
      const { context, page, errors } = await open(screen, width);
      try {
        if (screen === "auto")
          await page
            .getByRole("button", { name: "Auto build", exact: true })
            .click();
        if (screen === "rank")
          await page.getByTestId("rank-promotion").waitFor();
        await page.waitForTimeout(1200);
        const bounds = await page.evaluate(() => {
          const r = document
            .querySelector("dialog[open]")
            ?.getBoundingClientRect();
          return {
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
            dialog: r
              ? {
                  x: r.x,
                  y: r.y,
                  width: r.width,
                  height: r.height,
                  centerX: Math.abs(r.x + r.width / 2 - innerWidth / 2),
                  centerY: Math.abs(r.y + r.height / 2 - innerHeight / 2),
                }
              : null,
          };
        });
        expect(bounds.overflow).toBe(false);
        if (bounds.dialog) {
          expect(bounds.dialog.centerX).toBeLessThan(2);
          expect(bounds.dialog.centerY).toBeLessThan(2);
        }
        expect(errors).toEqual([]);
        await page.screenshot({
          path: path.join(output, "screenshots", `${screen}-${width}.png`),
        });
        report.push({ screen, width, ...bounds });
      } finally {
        await context.close();
      }
    }
  const {
    context: crewContext,
    page: crewPage,
    errors: crewErrors,
  } = await open("community");
  try {
    await crewPage
      .getByRole("button", { name: "Submit your crew", exact: true })
      .click();
    await crewPage
      .getByLabel("How does it win?")
      .fill("Open cheap, spread the pressure, finish strong.");
    await crewPage
      .getByRole("button", { name: "Submit this week’s crew", exact: true })
      .click();
    await expect(
      crewPage.getByRole("button", { name: "THIS WEEK’S CREW IS IN" }),
    ).toBeDisabled();
    await crewPage.getByRole("button",{name:/CONTENDERS/}).click();
    const vote = crewPage
      .getByRole("button", { name: "GIVE RESPECT", exact: true })
      .first();
    await vote.click();
    await expect(
      crewPage.getByRole("button", { name: "RESPECT GIVEN", exact: true }),
    ).toBeDisabled();
    await crewPage
      .getByRole("button", { name: /Inspect/ })
      .first()
      .click();
    await expect(crewPage.getByRole("dialog")).toBeVisible();
    expect(crewErrors).toEqual([]);
    report.push({
      interaction: "submit, vote, tap card inspection",
      passed: true,
    });
  } finally {
    await crewContext.close();
  }
  const {
    context: autoContext,
    page: autoPage,
    errors: autoErrors,
  } = await open("auto");
  try {
    const original = await autoPage.evaluate(() => window.notesDraft.cardIds);
    await autoPage
      .getByRole("button", { name: "Auto build", exact: true })
      .click();
    await autoPage
      .getByRole("button", { name: /^Fire\d* owned|^Fire / })
      .click();
    await autoPage
      .getByRole("button", { name: "Build Fire crew", exact: true })
      .click();
    await expect(autoPage.locator("dialog[open]")).toHaveCount(0);
    const updated = await autoPage.evaluate(() => window.notesDraft.cardIds);
    expect(updated).toHaveLength(10);
    expect(updated).not.toEqual(original);
    await autoPage.getByRole("button", { name: "Undo last change" }).click();
    await expect
      .poll(() => autoPage.evaluate(() => window.notesDraft.cardIds))
      .toEqual(original);
    const placeholders = await autoPage
      .locator(".deck-workbench__card-placeholder")
      .count();
    expect(placeholders).toBeGreaterThan(200);
    expect(autoErrors).toEqual([]);
    report.push({
      interaction: "element build, undo, full collection stays bounded",
      placeholders,
      passed: true,
    });
  } finally {
    await autoContext.close();
  }
  const {
    context: bountyContext,
    page: bountyPage,
    errors: bountyErrors,
  } = await open("bounties", 390, "full");
  try {
    await expect(bountyPage.getByTestId("bounty-pistol")).toHaveCount(0);
    await bountyPage
      .getByRole("button", { name: "Claim reward for Take A Room" })
      .click();
    await bountyPage.waitForTimeout(250);
    await expect(bountyPage.getByTestId("bounty-pistol")).toBeVisible();
    await expect(bountyPage.locator(".bounty-hunter__pistol--fired")).toHaveAttribute("src", /bounty-hunter\/pistol-fired/);
    await bountyPage.waitForTimeout(1000);
    const collect = bountyPage.getByRole("button", {
      name: "Collect all · 1",
      exact: true,
    });
    await expect(collect).toBeVisible();
    expect((await collect.boundingBox()).width).toBeLessThan(230);
    await collect.click();
    await expect(bountyPage.getByTestId("bounty-pistol")).toBeVisible();
    await expect(bountyPage.locator(".bounty-hunter__pistol--fired")).toHaveAttribute("src", /minigun-fired/);
    expect(bountyErrors).toEqual([]);
    report.push({
      interaction:
        "individual claim fires original pistol; compact Collect All fires minigun",
      passed: true,
    });
  } finally {
    await bountyContext.close();
  }
  const {
    context: rankContext,
    page: rankPage,
    errors: rankErrors,
  } = await open("rank", 390, "full");
  try {
    await expect(rankPage.getByTestId("rank-promotion")).toBeVisible();
    await expect
      .poll(() => rankPage.evaluate(() => window.notesVideoPlayed), {
        timeout: 5000,
      })
      .toBe(true);
    await rankPage
      .getByRole("button", { name: "KEEP MY SPOT", exact: true })
      .click();
    await expect(rankPage.getByTestId("rank-promotion")).toHaveCount(0);
    await rankPage
      .getByRole("button", {
        name: "View saved promotion rewards →",
        exact: true,
      })
      .click();
    await expect(rankPage.getByTestId("rank-promotion")).toBeVisible();
    expect(rankErrors).toEqual([]);
    report.push({
      interaction: "promotion clip plays; saved rewards can be reviewed",
      passed: true,
    });
  } finally {
    await rankContext.close();
  }
  writeFileSync(
    path.join(output, "browser-report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(`${report.length} screen and interaction checks passed.`);
} finally {
  await browser.close();
}
