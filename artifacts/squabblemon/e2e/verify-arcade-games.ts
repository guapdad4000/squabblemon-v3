import assert from "node:assert/strict";
import { assertSpriteArt } from "./motion-sprite-proof";
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
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
  createArcadeRun,
  applyArcadeAction,
  arcadeRewards,
  ARCADE_RULES,
  arcadePeriod,
  arcadeReset,
  OPPOSITE,
  type ArcadeKind,
  type ArcadeRun,
  type GirlRun,
  type MarketRun,
  type BlockRun,
} from "@workspace/squabblemon-engine/arcadeGames";
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = "1";
async function verify(width: number, height: number) {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
  const page = await browser.newPage({ viewport: { width, height } });
  page.setDefaultTimeout(30000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let documents = 0;
  page.on("request", (r) => {
    if (r.isNavigationRequest() && r.frame() === page.mainFrame()) documents++;
  });
  let cloutBalance = 500,
    ticketBalance = 12,
    claimed = false,
    failSaved = false;
  const owned = [...new Set([...ROOKIE_MENTOR_CORE_IDS, ...ROOKIE_CORE_IDS])];
  const runs: Partial<Record<ArcadeKind, ArcadeRun>> = {};
  const attempts: Record<ArcadeKind, number> = {
    "girl-fade": 2,
    "fade-market": 2,
    "block-takeover": 3,
  };
  const used = new Set<string>();
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

  function status(kind: ArcadeKind) {
    return {
      kind,
      period: arcadePeriod(kind, new Date()),
      attemptsRemaining: attempts[kind],
      resetsAt: arcadeReset(kind, new Date()),
      serverNow: Date.now(),
      run: runs[kind] ?? null,
      earned: runs[kind]
        ? arcadeRewards(runs[kind]!)
        : { softCurrency: 0, packTickets: 0, styleShards: 0 },
    };
  }
  await page.addInitScript(() =>
    localStorage.setItem("squabblemon_e2e_user", "signed-in"),
  );
  await page.route("**/api/**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname;
    const match = path.match(
      /\/arcade\/(girl-fade|fade-market|block-takeover)(.*)$/,
    );
    if (match) {
      const kind = match[1] as ArcadeKind,
        tail = match[2];
      if (tail === "/start") {
        const b = req.postDataJSON();
        if (!runs[kind] || runs[kind]!.phase === "ended") {
          runs[kind] = createArcadeRun(
            kind,
            b.requestId,
            arcadePeriod(kind, new Date()),
            17,
            Date.now(),
            b.choice,
          );
          attempts[kind]--;
        }
      } else if (tail.endsWith("/action")) {
        const b = req.postDataJSON();
        if (!used.has(b.actionId)) {
          assert.equal(b.revision, runs[kind]!.revision);
          const before = arcadeRewards(runs[kind]!);
          try {
            runs[kind] = applyArcadeAction(runs[kind]!, b.action, Date.now());
          } catch (e) {
            return route.fulfill({
              status: 409,
              json: { error: (e as Error).message },
            });
          }
          used.add(b.actionId);
          const after = arcadeRewards(runs[kind]!);
          cloutBalance += after.softCurrency - before.softCurrency;
          ticketBalance += after.packTickets - before.packTickets;
          if (failSaved) {
            failSaved = false;
            return route.fulfill({
              status: 503,
              json: { error: "Saved before connection dropped. Retry safely." },
            });
          }
        }
      }
      return route.fulfill({ json: status(kind) });
    }
    if (path.endsWith("/bootstrap"))
      return route.fulfill({ json: bootstrap() });
    if (path.endsWith("/challenges/runs")) return route.fulfill({ json: [] });
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
    if (path.endsWith("/john-henry"))
      return route.fulfill({
        json: { state: "claimed", ownsCard: true, chapters: [], reward: {} },
      });
    if (path.endsWith("/waffle-run"))
      return route.fulfill({
        json: {
          attemptsRemaining: 2,
          run: null,
          earned: { softCurrency: 0, packTickets: 0, styleShards: 0 },
        },
      });
    return route.fulfill({ json: { items: [], rewards: [], chapters: [] } });
  });
  await mkdir("../../screenshots/arcade-games", { recursive: true });
  async function shot(name: string) {
    await page.waitForTimeout(100);
    await assertSpriteArt(page);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      name + " overflow",
    );
    assert.equal(
      await page
        .locator(".arcade-game img")
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
    if (
      name.startsWith("girl-") &&
      (await page.locator(".girl-fight-window").count())
    ) {
      const geometry = await page
        .locator(".girl-fight-window")
        .evaluate((window) => {
          const frame = window.getBoundingClientRect();
          const actors = Array.from(
            window.querySelectorAll(".girl-player,.girl-opponent"),
          ).map((actor) => actor.getBoundingClientRect());
          const dock = document
            .querySelector(".girl-pattern-dock")!
            .getBoundingClientRect();
          return {
            height: frame.height,
            cutsBelowFrame: actors.every(
              (actor) => actor.bottom >= frame.bottom,
            ),
            dockBelowFrame: dock.top >= frame.bottom - 1,
          };
        });
      assert.ok(
        geometry.cutsBelowFrame && geometry.dockBelowFrame,
        "torso cuts hidden and controls below the camera",
      );
      assert.equal(
        Math.round(geometry.height),
        width === 1440 ? 390 : 320,
        "stable fight camera",
      );
    }
    if (
      name.startsWith("market-") &&
      (await page.locator(".market-doctor").count())
    ) {
      const scale = await page.locator(".market-doctor").evaluate(async (doctor) => {
        const enemy = document.querySelector(".market-enemy > .motion-sprite");
        const measurements: { height: number; bottom: number }[] = [];
        for (const actor of [doctor, ...(enemy ? [enemy] : [])]) {
          const rect = actor.getBoundingClientRect();
          const sheet = actor.querySelector("image")!;
          const svg = actor.querySelector("svg")!.viewBox.baseVal;
          const image = new Image(); image.src = sheet.getAttribute("href")!; await image.decode();
          const canvas = document.createElement("canvas"); canvas.width = svg.width; canvas.height = svg.height;
          const context = canvas.getContext("2d")!;
          context.drawImage(image, 0, -Number(sheet.getAttribute("y")), svg.width, svg.height, 0, 0, svg.width, svg.height);
          const pixels = context.getImageData(0,0,canvas.width,canvas.height).data;
          let top = canvas.height, bottom = 0;
          for (let y=0;y<canvas.height;y++) for(let x=0;x<canvas.width;x++) if(pixels[(y*canvas.width+x)*4+3]>32){top=Math.min(top,y);bottom=Math.max(bottom,y);}
          const fitHeight=Math.min(rect.height,rect.width*svg.height/svg.width);
          measurements.push({height:(bottom-top+1)/svg.height*fitHeight,bottom:rect.top+(rect.height-fitHeight)/2+bottom/svg.height*fitHeight});
        }
        return {doctor:measurements[0],enemy:measurements[1]??null,controls:document.querySelector(".market-restock-controls")!.getBoundingClientRect().top};
      });
      if (scale.enemy)
        assert.ok(
          scale.doctor.height >= scale.enemy.height,
          "Dr. Fade's visible body is at least enemy scale",
        );
      assert.ok(
        scale.doctor.bottom <= scale.controls + 2,
        "hero feet above stock controls",
      );
    }
    await page.screenshot({
      path: `../../screenshots/arcade-games/${name}-${width}.png`,
      fullPage: true,
    });
  }
  async function back() {
    await page.getByRole("button", { name: "← FADECADE", exact: true }).click();
    await page
      .getByRole("button", { name: "Open Girl Fade", exact: true })
      .waitFor();
  }
  async function open(name: string) {
    await page
      .getByRole("button", { name: "Open " + name, exact: true })
      .click();
    await page.locator(".arcade-game").waitFor();
  }
  try {
    await page.goto(`${process.env.ARCADE_BASE_URL ?? "http://127.0.0.1:4195"}/game/challenges`, {
      waitUntil: "domcontentloaded",
    });
    await page
      .getByRole("button", { name: "Open Girl Fade", exact: true })
      .waitFor();
    for (const [id, name] of [
      ["fadecade-training", "girl"],
      ["fadecade-daily", "market"],
      ["fadecade-weekly", "block"],
    ]) {
      const cabinet = page.getByTestId(id);
      await cabinet.scrollIntoViewIfNeeded();
      await cabinet.screenshot({
        path: `../../screenshots/arcade-games/cabinet-${name}-${width}.png`,
      });
    }
    await open("Girl Fade");
    await shot("girl-select");
    await page
      .getByRole("button", { name: "GLOVES UP →", exact: true })
      .click();
    await page
      .getByRole("button", { name: "READ HER HANDS →", exact: true })
      .waitFor();
    await shot("girl-idle");
    await page
      .getByRole("button", { name: "READ HER HANDS →", exact: true })
      .click();
    await page.getByText("WATCH HER ATTACK", { exact: true }).waitFor();
    assert.ok(
      await page
        .getByRole("button", { name: "Box left", exact: true })
        .isDisabled(),
    );
    const girl = runs["girl-fade"] as GirlRun,
      pattern = [...girl.box.pattern];
    await page.getByText("YOUR COUNTER PATTERN", { exact: true }).waitFor();
    for (const [direction, move] of [
      ["left", "jab-left"],
      ["right", "jab-right"],
      ["up", "uppercut"],
      ["down", "duck"],
    ] as const) {
      await page
        .getByRole("button", { name: "Box " + direction, exact: true })
        .click();
      assert.ok(
        (await page.locator(".girl-player").getAttribute("data-sprite"))!.endsWith(`back-${move}`),
      );
      if (width === 1440) await shot(`girl-${move}`);
      await page.getByRole("button", { name: "UNDO", exact: true }).click();
    }
    for (const d of pattern)
      await page
        .getByRole("button", { name: "Box " + OPPOSITE[d], exact: true })
        .click();
    await shot("girl-facing");
    await page
      .getByRole("button", { name: "THROW THE PATTERN", exact: true })
      .click();
    await page.locator(".girl-impact").waitFor();
    await shot("girl-counter");
    await page
      .getByRole("button", { name: "READ HER HANDS →", exact: true })
      .waitFor();
    await page.waitForTimeout(1500);
    assert.equal((runs["girl-fade"] as GirlRun).box.wins, 1);
    const girlId = runs["girl-fade"]!.id;
    await back();
    await open("Girl Fade");
    assert.equal(runs["girl-fade"]!.id, girlId);
    await back();
    console.log("Girl Fade passed " + width);
    await open("Fade Market");
    await shot("market-select");
    await page
      .getByRole("button", { name: "OPEN THE SHIFT →", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Restock Hot sauce", exact: true })
      .click();
    await page.locator(".market-stock-flash").waitFor();
    await shot("market-power-up");
    await page.waitForTimeout(1800);
    assert.ok((runs["fade-market"] as MarketRun).market.power > 4);
    await shot("market-shift");
    assert.ok(
      (await page.locator(".market-doctor").getAttribute("data-sprite"))!.endsWith("north"),
    );
    const targetLane =
      (runs["fade-market"] as MarketRun).market.enemies[0]?.lane ?? 2;
    await page
      .getByRole("button", {
        name: `Aim Dr. Fade at aisle ${targetLane + 1}`,
        exact: true,
      })
      .click();
    await page.locator(".market-doctor.is-punching").waitFor();
    assert.ok(
      (await page.locator(".market-doctor").getAttribute("data-sprite")) === "market-punch-north",
    );
    await page.waitForTimeout(220);
    await shot("market-punch");
    await page
      .getByRole("button", { name: "PAUSE SHIFT", exact: true })
      .click();
    await page.getByText("SHIFT PAUSED", { exact: true }).waitFor();
    const ticks = (runs["fade-market"] as MarketRun).market.tick;
    const pose = await page.locator(".market-doctor image").evaluate(el => getComputedStyle(el).transform);
    await page.waitForTimeout(1500);
    assert.equal(await page.locator(".market-doctor image").evaluate(el => getComputedStyle(el).transform), pose, "paused market holds sprite pose");
    assert.equal((runs["fade-market"] as MarketRun).market.tick, ticks);
    await shot("market-paused");
    await page
      .getByRole("button", { name: "BACK TO WORK →", exact: true })
      .click();
    failSaved = true;
    await page
      .getByRole("button", { name: "RETRY SAME TURN", exact: true })
      .waitFor();
    const saved = (runs["fade-market"] as MarketRun).market.tick;
    await page
      .getByRole("button", { name: "RETRY SAME TURN", exact: true })
      .click();
    await page.locator(".arc-error").waitFor({ state: "detached" });
    assert.equal((runs["fade-market"] as MarketRun).market.tick, saved);
    const marketId = runs["fade-market"]!.id;
    await back();
    await open("Fade Market");
    assert.equal(runs["fade-market"]!.id, marketId);
    await page
      .getByRole("button", { name: "PAUSE SHIFT", exact: true })
      .click();
    await back();
    console.log("Fade Market passed " + width);
    await open("Block Takeover");
    await shot("block-select");
    await page
      .getByRole("button", { name: "TAKE THE BLOCK →", exact: true })
      .click();
    await page.locator(".block-map").waitFor();
    await page.getByRole("button", { name: /^Subway ·/ }).click();
    await page.getByRole("button", { name: /^TAKE DISTRICT/ }).click();
    await page.waitForTimeout(250);
    assert.equal((runs["block-takeover"] as BlockRun).block.captured, 1);
    await page.getByRole("button", { name: /^Safehouse ·/ }).click();
    await page.getByRole("button", { name: /^FORTIFY/ }).click();
    await page.waitForTimeout(250);
    const tokenOverlaps = await page.locator('.block-district:has(.block-crew-token)').evaluateAll(tiles => tiles.filter(tile => {
      const fighter = tile.querySelector('.block-crew-token')!.getBoundingClientRect();
      const defense = tile.querySelector('.block-flag')!.getBoundingClientRect();
      return fighter.left < defense.right && fighter.right > defense.left && fighter.top < defense.bottom && fighter.bottom > defense.top;
    }).map(tile => tile.getAttribute('aria-label')));
    assert.deepEqual(tokenOverlaps, [], 'Every crew sprite has space beside its defense marker');
    await shot("block-turf");
    await page.getByRole("button", { name: /^GET SUPPLIES/ }).click();
    await page.waitForTimeout(250);
    await page.getByRole("button", { name: /^RALLY CREW/ }).click();
    await page.waitForTimeout(250);
    await page
      .getByRole("button", { name: "How to play Block Takeover", exact: true })
      .click();
    await page.getByRole("dialog").waitFor();
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "END RUN", exact: true }).click();
    await page.getByRole("dialog", { name: "End arcade run" }).waitFor();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "END RUN", exact: true })
      .click();
    await page.getByText("CLOCKED OUT", { exact: true }).waitFor();
    await shot("block-results");
    assert.ok(cloutBalance > 500);
    assert.equal(documents, 1, "no full page reloads");
    assert.deepEqual(errors, []);
    console.log(
      "PASS arcade desktop/mobile " +
        width +
        " art, directional counters, boosts, pause, retry, resume, raids, banked results and no reloads",
    );
  } catch (error) {
    console.log("PAGE ERRORS", errors, await page.locator("body").innerText());
    await page.screenshot({
      path: `../../screenshots/arcade-games/failure-${width}.png`,
    });
    throw error;
  } finally {
    await browser.close();
  }
}
await verify(1440, 1000);
await verify(390, 844);
