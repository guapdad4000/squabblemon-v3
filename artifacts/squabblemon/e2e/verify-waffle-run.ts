import assert from "node:assert/strict";
import { assertSpriteArt } from "./motion-sprite-proof";
import { chromium } from "@playwright/test";
import {
  cardCatalog,
  ROOKIE_CORE_IDS,
  ROOKIE_MENTOR_CORE_IDS,
} from "../src/data";
import {
  STREET_PACK_DISCLOSURES,
  STREET_PACK_RULES,
} from "@workspace/squabblemon-engine/packRules";
import {
  createWaffleRun,
  applyWaffleAction,
  waffleRewards,
  waffleHopTargets,
  waffleWatchedPlate,
  type WaffleRun,
} from "@workspace/squabblemon-engine/waffleRun";
import { JOHN_HENRY_CHAPTERS } from "@workspace/squabblemon-engine/johnHenryMythic";
import { mkdir } from "node:fs/promises";
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = "1";
const origin = `${process.env.ARCADE_BASE_URL ?? "http://127.0.0.1:4195"}/game`;
async function verify(width: number, height: number) {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
  const page = await browser.newPage({ viewport: { width, height } });
  page.setDefaultTimeout(20000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let documents = 0;
  page.on("request", (req) => {
    if (req.isNavigationRequest() && req.frame() === page.mainFrame())
      documents++;
  });
  let cloutBalance = 500,
    ticketBalance = 12,
    run: WaffleRun | null = null,
    attempts = 2,
    claimed = false,
    now = Date.now(),
    failSavedAction = false;
  const used = new Set<string>();
  const owned = [...new Set([...ROOKIE_MENTOR_CORE_IDS, ...ROOKIE_CORE_IDS])];
  const duplicateCard = cardCatalog.find(
    (card) =>
      card.catalogId ===
      owned.find(
        (id) =>
          cardCatalog.find((c) => c.catalogId === id)?.rarity === "Common",
      ),
  )!;
  function bootstrap() {
    return {
      profile: {
        id: "gacha-fixture",
        displayName: "Rookie",
        avatarKey: "hooper",
        onboardingStep: "complete",
        starterDeckId: "foundation-v1",
        streetRep: 68,
        xp: 400,
        level: 3,
        softCurrency: cloutBalance,
        packTickets: ticketBalance,
        styleShards: 250,
        deckSlots: 4,
        cardProgression: {},
        ownedVariants: [],
        collectionProgress: owned.length,
        packPity: 4,
        cosmeticCurrency: 0,
        storyChapter: 1,
        storyNode: 2,
        tutorialCompleted: true,
        starterRewardClaimed: true,
        ageConfirmedAt: new Date(0).toISOString(),
        termsAcceptedAt: new Date(0).toISOString(),
        settings: { reducedMotion: false, turnTimerEnabled: false },
        ownedCardIds: owned,
        discoveredCardIds: owned,
        equippedVariants: {},
        unlockedCosmeticIds: [],
        savedDecks: [
          {
            id: "second-crew",
            name: "Second gang",
            cardIds: owned.slice(-10),
            heroCardId: owned.at(-1),
            recipeId: null,
            valid: true,
            issues: [],
          },
          {
            id: "crew",
            name: "My gang",
            cardIds: owned.slice(0, 10),
            heroCardId: owned[0],
            recipeId: null,
            valid: true,
            issues: [],
          },
        ],
        storyProgress: {},
        inbox: [],
        packHistory: [],
        lastActiveAt: new Date(0).toISOString(),
      },
      missions: [],
      collectionRoad: [],
      nextAction: {
        id: "play",
        eyebrow: "Training",
        title: "Test your idea",
        description: "Build a gang",
        destination: "play",
        rewardLabel: null,
      },
      packConfig: {
        id: "street-pack",
        name: "Street Pack",
        oddsVersion: "street-pack-v7",
        softCurrencyCost: STREET_PACK_RULES.single.softCurrencyCost,
        ticketCost: STREET_PACK_RULES.single.ticketCost,
        rewardsPerPack: STREET_PACK_RULES.single.rewards,
        pityLimit: STREET_PACK_RULES.pityLimit,
        odds: STREET_PACK_DISCLOSURES,
      },
    };
  }

  function status() {
    return {
      date: "2026-10-06",
      attemptsRemaining: attempts,
      resetsAt: "2026-10-07T00:00:00Z",
      serverNow: Date.now(),
      run,
      earned: run
        ? waffleRewards(run)
        : { softCurrency: 0, packTickets: 0, styleShards: 0 },
    };
  }
  function john() {
    return {
      state: claimed ? "claimed" : "ready",
      ownsCard: claimed,
      chapters: JOHN_HENRY_CHAPTERS.map((id) => ({
        id,
        completed: true,
        reached: true,
      })),
      reward: {
        cardId: "john-henry",
        softCurrency: 1500,
        packTickets: 5,
        duplicateShards: 50,
      },
    };
  }
  await page.addInitScript(() =>
    localStorage.setItem("squabblemon_e2e_user", "signed-in"),
  );
  await page.route("**/api/**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname;
    if (path.endsWith("/challenges/runs")) return route.fulfill({ json: [] });
    if (path.endsWith("/bootstrap"))
      return route.fulfill({ json: bootstrap() });
    if (path.endsWith("/waffle-run/start")) {
      if (!run || run.phase === "ended") {
        run = createWaffleRun(
          req.postDataJSON().requestId,
          "2026-10-06",
          17,
          Date.now() - 300,
        );
        attempts--;
      }
      return route.fulfill({ json: status() });
    }
    if (path.includes("/waffle-run/") && path.endsWith("/action")) {
      const b = req.postDataJSON();
      if (!used.has(b.actionId)) {
        assert.equal(b.revision, run!.revision);
        const prev = waffleRewards(run!);
        run = applyWaffleAction(run!, b.action, Date.now());
        used.add(b.actionId);
        const next = waffleRewards(run);
        cloutBalance += next.softCurrency - prev.softCurrency;
        ticketBalance += next.packTickets - prev.packTickets;
        if (failSavedAction) {
          failSavedAction = false;
          return route.fulfill({
            status: 503,
            json: {
              error: "Connection interrupted after saving. Retry safely.",
            },
          });
        }
      }
      return route.fulfill({ json: status() });
    }
    if (path.endsWith("/waffle-run")) return route.fulfill({ json: status() });
    if (path.endsWith("/john-henry/claim")) {
      if (!claimed) {
        claimed = true;
        cloutBalance += 1500;
        ticketBalance += 5;
      }
      return route.fulfill({
        json: {
          claimed: true,
          duplicateShards: 0,
          status: john(),
          bootstrap: bootstrap(),
        },
      });
    }
    if (path.endsWith("/john-henry")) return route.fulfill({ json: john() });
    if (path.endsWith("/social"))
      return route.fulfill({
        json: {
          homies: [],
          incomingRequests: [],
          outgoingRequests: [],
          blocked: [],
          invitations: [],
          counts: { requests: 0, invitations: 0 },
          self: { friendCode: "ME", displayName: "Rookie" },
        },
      });
    if (path.includes("/notifications/receipts"))
      return route.fulfill({ json: { ids: [] } });
    if (path.endsWith("/packs/welcome"))
      return route.fulfill({ json: { available: false } });
    if (path.endsWith("/starter-mythic"))
      return route.fulfill({
        json: { state: "claimed", chapters: [], reward: {} },
      });
    return route.fulfill({ json: { items: [], rewards: [], chapters: [] } });
  });
  await mkdir("../../screenshots/waffle-run", { recursive: true });
  async function shot(name: string) {
    if (name === "cabinet")
      await page.getByTestId("fadecade-waffle").scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.evaluate(() =>
      Promise.race([
        document.fonts.ready,
        new Promise((r) => setTimeout(r, 1200)),
      ]),
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      name + " overflow",
    );
    assert.equal(
      await page
        .locator(".waffle-run img")
        .evaluateAll((imgs) =>
          imgs.some(
            (i) =>
              !(i as HTMLImageElement).complete ||
              (i as HTMLImageElement).naturalWidth === 0,
          ),
        ),
      false,
      name + " broken art",
    );
    await assertSpriteArt(page);
    await page.screenshot({
      path: `../../screenshots/waffle-run/${name}-${width}.png`,
      fullPage: true,
    });
  }
  try {
    await page.goto(origin + "/challenges", { waitUntil: "domcontentloaded" });
    console.log("Loaded challenges");
    await page.getByTestId("fadecade-waffle").waitFor();
    await shot("cabinet");
    if (process.env.VERIFY_CABINET_ONLY === "1") {
      await page.getByTestId("fadecade-waffle").screenshot({path:`../../screenshots/waffle-run/cabinet-detail-${width}.png`});
      await page.getByTestId("fadecade-waffle").click();
      await page.getByTestId("waffle-run-screen").waitFor();
      await page.getByRole("button", {name:"SNEAK IN"}).waitFor();
      assert.deepEqual(errors, []);
      console.log(`PASS cabinet ${width}: artwork, overflow and launch`);
      return;
    }
    await page.getByTestId("fadecade-waffle").click();
    await page.getByRole("button", { name: "SNEAK IN" }).click();
    await page.locator(".wr-hop-board").waitFor();
    await shot("hopping");
    failSavedAction = true;
    await page.waitForTimeout(400);
    let plate = waffleHopTargets(run!)[0];
    await page
      .getByRole("button", { name: new RegExp(`Hop to plate ${plate + 1}`) })
      .click();
    await page.getByRole("button", { name: "RETRY SAME MOVE" }).click();
    await page.locator(".wr-save-error").waitFor({ state: "detached" });
    assert.equal(run!.hops, 1, "retry must not double apply saved action");
    while (run!.phase === "hopping") {
      await page.waitForTimeout(450);
      plate =
        waffleHopTargets(run!).find(
          (p) => p === waffleWatchedPlate(run!, Date.now()),
        ) ?? waffleHopTargets(run!)[1];
      await page
        .getByRole("button", { name: new RegExp(`Hop to plate ${plate + 1}`) })
        .click();
      await page.waitForTimeout(100);
    }
    await page.locator(".wr-learning").waitFor();
    await shot("new-move");
    await page.locator(".wr-learning button").first().click();
    await page.locator(".wr-command").waitFor();
    await shot("battle");
    while (run!.phase === "battle") {
      await page.getByRole("button", { name: /^Peck/ }).click();
      await page.waitForTimeout(150);
    }
    assert.equal(run!.wins, 1);
    const saved = run!.id;
    await page.getByRole("button", { name: "Leave Squabblehouse" }).click();
    await page.getByTestId("fadecade-waffle").click();
    await page.locator(".wr-hop-board").waitFor();
    assert.equal(run!.id, saved, "resume must retain run");
    assert.equal(attempts, 1);
    await page.getByRole("button", { name: "END RUN", exact: true }).click();
    await page
      .getByRole("dialog", { name: "End diner run" })
      .getByRole("button", { name: "END RUN", exact: true })
      .click();
    await page.locator(".wr-receipt").waitFor();
    await shot("receipt");
    await page.getByRole("button", { name: "SNEAK IN" }).click();
    await page.locator(".wr-hop-board").waitFor();
    for (let turn = 0; run!.phase !== "ended" && turn < 120; turn++) {
      if (run!.phase === "hopping") {
        await page.waitForTimeout(350);
        const target = waffleHopTargets(run!)[1];
        await page
          .getByRole("button", {
            name: new RegExp(`Hop to plate ${target + 1}`),
          })
          .click();
      } else if (run!.phase === "learning") {
        await page.locator(".wr-learning button").first().click();
      } else {
        await page.getByRole("button", { name: /^Peck/ }).click();
      }
      await page.waitForTimeout(80);
    }
    assert.equal(run!.endReason, "caught");
    assert.ok(run!.wins > 1, "progress through tougher fights");
    await shot("death");
    await page.getByRole("button", { name: "BACK AFTER RESET" }).waitFor();
    assert.equal(attempts, 0);
    assert.equal(documents, 1, "game actions must not reload page");
    await page.goto(origin + "/missions?mythic=john-henry", {
      waitUntil: "domcontentloaded",
    });
    await page.getByRole("dialog", { name: /Steel/ }).waitFor();
    await shot("john-henry");
    await page.getByRole("button", { name: "Claim John Henry" }).click();
    await page
      .getByText("John Henry joined your crew.", { exact: false })
      .waitFor();
    assert.equal(claimed, true);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("dialog[open]").count(), 0);
    assert.deepEqual(errors, []);
    console.log(
      `PASS ${width}: retry, fight, resume, two daily attempts, John claim, no automatic reload`,
    );
  } finally {
    await browser.close();
  }
}
await verify(1440, 1000);
await verify(390, 844);
