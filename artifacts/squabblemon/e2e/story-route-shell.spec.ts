import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page, type Route } from "@playwright/test";
import { build } from "esbuild";
// Bundle the real engine source for Node's Playwright runner. Its native TS
// loader does not add the JSON import attributes used by Vite/tsx.
const engineBundle = await build({
  entryPoints: [fileURLToPath(new URL("../../../lib/squabblemon-engine/src/story.ts", import.meta.url))],
  bundle: true, write: false, platform: "node", format: "esm", packages: "external",
});
const { storyContent } = await import(`data:text/javascript;base64,${Buffer.from(engineBundle.outputFiles![0].contents).toString("base64")}`) as typeof import("@workspace/squabblemon-engine/story");
const screenplay = JSON.parse(
  await readFile(
    new URL("../../../lib/squabblemon-engine/src/storyChapters/seasonOneRewrite.json", import.meta.url),
    "utf8",
  ),
) as {
  revisions: Record<string, string>;
  scenes: Record<string, Record<string, Array<[string, string]>>>;
};
const chapterOneNodes = [
  { id: "welcome-to-the-block", title: "Welcome to the Block", kind: "battle", optional: false, prerequisites: [], mapPosition: { x: 8, y: 76 } },
  { id: "blue-side-pressure", title: "Blue Side Pressure", kind: "battle", optional: false, prerequisites: ["welcome-to-the-block"], mapPosition: { x: 22, y: 62 } },
  { id: "receipts-on-camera", title: "Receipts on Camera", kind: "battle", optional: false, prerequisites: ["blue-side-pressure"], mapPosition: { x: 37, y: 48 } },
  { id: "red-side-retaliation", title: "Red Side Retaliation", kind: "battle", optional: false, prerequisites: ["receipts-on-camera"], mapPosition: { x: 52, y: 36 } },
  { id: "side-alley-challenge", title: "Side Alley Challenge", kind: "battle", optional: true, prerequisites: ["blue-side-pressure"], mapPosition: { x: 44, y: 70 } },
  { id: "snitch-at-the-corner", title: "Snitch at the Corner", kind: "battle", optional: false, prerequisites: ["red-side-retaliation"], mapPosition: { x: 68, y: 27 } },
  { id: "cracked-head-takes-the-block", title: "Cracked Head Takes the Block", kind: "battle", optional: false, prerequisites: ["snitch-at-the-corner"], mapPosition: { x: 82, y: 16 } },
  { id: "block-crowned", title: "Block Crowned", kind: "reward", optional: false, prerequisites: ["cracked-head-takes-the-block"], mapPosition: { x: 94, y: 5 } },
] as const;
const firstBattle = chapterOneNodes[0];
const sceneNode = chapterOneNodes.find((node) => node.id === "block-crowned")!;
const seasonOneChapterIds = [
  "block-party",
  "red-side-tapes",
  "blue-side-blues",
  "side-show",
  "old-heads-know",
  "the-function",
  "return-of-the-block",
  "the-crown",
];
const dialogueLines = (nodeId: string, section: "pre" | "post" | "main") =>
  screenplay.scenes[nodeId]?.[section] ?? [];
const dialogueTokens = (nodeId: string, section: "pre" | "post" | "main") =>
  dialogueLines(nodeId, section).map(
    (_line, index) => `${nodeId}:script-${screenplay.revisions[nodeId]}:${section}:${index}`,
  );
const sceneRewards = [
  { kind: "currency", id: "clout", amount: 250, rewardKey: "dr-fade-training:chapter-one:v1" },
  { kind: "pack-ticket", id: "street-pack-ticket", amount: 10, rewardKey: "block-crowned:direct-ticket:v1" },
  { kind: "card", id: "cracked-head", amount: 1, rewardKey: "story-card-reward:v1:block-crowned:cracked-head", duplicateShards: 0 },
];
const screenshotDir = fileURLToPath(
  new URL("./screenshots/story-route-shell/", import.meta.url),
);

function createBootstrap() {
  const timestamp = new Date(0).toISOString();
  return {
    profile: {
      id: "route-shell-test-account",
      displayName: "Route Shell QA",
      avatarKey: "cornball",
      onboardingStep: "complete",
      starterDeckId: null,
      streetRep: 0,
      xp: 0,
      level: 1,
      softCurrency: 0,
      packTickets: 0,
      styleShards: 0,
      packPity: 0,
      deckSlots: 4,
      cosmeticCurrency: 0,
      collectionProgress: 0,
      storyChapter: 0,
      storyNode: 0,
      tutorialCompleted: true,
      starterRewardClaimed: true,
      ageConfirmedAt: timestamp,
      termsAcceptedAt: timestamp,
      settings: { reducedMotion: true, turnTimerEnabled: false },
      ownedCardIds: [],
      discoveredCardIds: [],
      ownedVariants: [],
      equippedVariants: {},
      cardProgression: {},
      unlockedCosmeticIds: [],
      unlockedCharacterIds: [],
      savedDecks: [],
      storyProgress: {},
      inbox: [],
      packHistory: [],
      lastActiveAt: timestamp,
    },
    missions: [],
    nextAction: {
      id: "story",
      eyebrow: "Season One",
      title: "Continue the story",
      description: "The first scene is waiting.",
      destination: "story",
      rewardLabel: null,
    },
    packConfig: {
      id: "street-pack",
      name: "Street Pack",
      oddsVersion: "route-shell",
      softCurrencyCost: 200,
      ticketCost: 1,
      rewardsPerPack: 3,
      pityLimit: 10,
      odds: [],
    },
    tenPullConfig: {
      id: "street-ten-pull",
      name: "Street Ten Pull",
      oddsVersion: "route-shell",
      pullCount: 10,
      ticketCost: 9,
      softCurrencyCost: 1800,
      rewardsPerPull: 3,
      rarePityBonusPerPull: 1,
    },
    collectionRoad: [],
  };
}

test("Player, rear-view listening pose and Rae render in the mounted Season One route", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 375, height: 667 });
  const cases = [
    { name: "player-speaking", nodeId: "crown-community-meal", section: "main" as const, portrait: "player.webp" },
    { name: "player-listening", nodeId: "crown-community-meal", section: "main" as const, portrait: "player-rear.webp" },
    { name: "rae", nodeId: "the-booking", section: "post" as const, portrait: "rae.webp" },
  ];
  const artifactPath = new URL(String(testInfo.project.use.baseURL)).pathname.replace(/\/+$/, "");
  for (const [caseIndex, castCase] of cases.entries()) {
    const chapter = storyContent.chapters.find(chapter => chapter.nodes.some(node => node.id === castCase.nodeId))!;
    const node = chapter.nodes.find(node => node.id === castCase.nodeId)!;
    const lines = node.kind === "battle" ? node.postDialogue : node.scenes;
    const index = lines.findIndex((line, index) => castCase.name === "player-listening"
      ? index > 0 && line.speaker !== "Player" && lines[index - 1].speaker === "Player"
      : line.speaker === (castCase.name === "rae" ? "Rae" : "Player"));
    assert(index >= 0);
    await page.unrouteAll();
    const api = makeStoryApi(page);
    const base = api.campaign();
    const nodes = chapter.nodes.map(entry => ({
      ...base.nodes[0], chapterId: chapter.id, nodeId: entry.id, title: entry.title,
      kind: entry.kind, optional: entry.optional, prerequisites: entry.prerequisites,
      mapPosition: entry.mapPosition, rewards: entry.rewards,
      status: entry.id === node.id && node.kind !== "battle" ? "available" : "cleared",
      cleared: entry.id !== node.id || node.kind === "battle",
      dialogueSeen: entry.id === node.id ? dialogueTokens(node.id, castCase.section).slice(0, index) : [],
    }));
    const campaign = {
      ...base, nodes, recommendedNodeId: node.id,
      chapters: [{
        ...base.chapters[0], id: chapter.id, title: chapter.title, subtitle: chapter.subtitle,
        description: chapter.description, order: chapter.order, mapAssetId: chapter.mapAssetId,
        completedNodes: nodes.length - 1, totalNodes: nodes.length,
        completedRequiredNodes: nodes.filter(node => !node.optional && node.cleared).length,
        totalRequiredNodes: nodes.filter(node => !node.optional).length,
      }],
      seasons: [{ ...base.seasons[0], recommendedNodeId: node.id, totalNodes: nodes.length, clearedNodes: nodes.length - 1 }],
    };
    await page.route("**/api/player/story", route => route.fulfill({ contentType: "application/json", body: JSON.stringify(campaign) }));
    if (caseIndex === 0) {
      await page.goto(`${artifactPath}/sign-in`);
      await page.getByRole("button", { name: "Sign in test account", exact: true }).click();
      await expect(page).toHaveURL(/\/game(?:\?|$)/);
    }
    await page.goto(`${artifactPath}/game/story?node=${node.id}`);
    await expect(page.locator(".story-stage__speaker span")).toHaveText(lines[index].speaker, { timeout: 20_000 });
    const actor = page.locator(castCase.name === "player-listening" ? ".story-stage__actor--listener img" : ".story-stage__actor--speaker img");
    await expect(actor).toHaveAttribute("src", new RegExp(`${castCase.portrait.replace(".", "\\.")}\\?v=`));
    await expect.poll(() => actor.evaluate(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)).toBe(true);
    await page.waitForTimeout(650); // Let the authored entrance finish before photographing it.
    await page.screenshot({ path: join(screenshotDir, `${testInfo.project.name}-${castCase.name}.png`) });
    await page.getByRole("button", { name: "Transcript", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Dialogue History", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.locator(".story-stage__header button").first().click();
    await expect(page.locator(".story-stage")).toHaveCount(0);
    assert.equal(api.dialogueBodies.length, 0);
    assert.equal(api.completionBodies.length, 0, "Viewing the cast or transcript cannot clear a fight or pay rewards.");
  }
});

function makeStoryApi(page: Page) {
  const bootstrap = createBootstrap();
  const clearedIds = new Set<string>();
  const dialogueSeen = new Map<string, string[]>();
  const dialogueBodies: Array<{ nodeId: string; tokens: string[] }> = [];
  const completionBodies: Array<{ nodeId: string; tokens: string[] }> = [];
  let earnedSceneRewards = false;
  let payoutCount = 0;
  let failNextDialogue = false;

  function campaign() {
    const nodes = chapterOneNodes.map((node) => {
      const cleared = clearedIds.has(node.id);
      const available = !cleared && node.prerequisites.every((id) => clearedIds.has(id));
      return {
        chapterId: "block-party",
        nodeId: node.id,
        title: node.title,
        kind: node.kind,
        optional: node.optional,
        status: cleared ? "cleared" as const : available ? "available" as const : "locked" as const,
        mapPosition: { ...node.mapPosition },
        prerequisites: [...node.prerequisites],
        rewards: node.id === sceneNode.id ? sceneRewards : [],
        cleared,
        stars: 0,
        attempts: 0,
        wins: 0,
        lastOutcome: null,
        dialogueSeen: [...(dialogueSeen.get(node.id) ?? [])],
        bossHighestPhase: 0,
        firstClearedAt: cleared ? new Date(0).toISOString() : null,
        lastPlayedAt: cleared ? new Date(0).toISOString() : null,
      };
    });
    const requiredNodes = nodes.filter((node) => !node.optional);
    const completedRequiredNodes = requiredNodes.filter((node) => node.cleared).length;
    const status = completedRequiredNodes === requiredNodes.length
      ? "cleared" as const
      : "available" as const;
    const chapters = [{
      id: "block-party",
      title: "Chapter One: Block Party",
      subtitle: "Take the block, keep the receipts.",
      description: "A neighborhood rivalry turns into a public test of your gang.",
      order: 1,
      mapAssetId: "assets/story/chapter-one/environments/map.webp",
      status,
      completedNodes: nodes.filter((node) => node.cleared).length,
      totalNodes: nodes.length,
      completedRequiredNodes,
      totalRequiredNodes: requiredNodes.length,
      stars: 0,
      bossStatus: status,
    }];
    const recommendedNodeId = nodes.find((node) => node.status === "available")?.nodeId ?? null;
    const seasonNodes = nodes;
    return {
      contentVersion: "season-one-route-shell",
      chapters,
      nodes,
      recommendedNodeId,
      totalStars: 0,
      completedNodes: nodes.filter((node) => node.cleared).length,
      bossStatus: "in-progress",
      seasons: [{
        id: "season-1",
        kind: "season",
        title: "The Block Crown",
        subtitle: "Season One",
        description: "One neighborhood. Two brothers. A crown that cannot fix a family.",
        chapterIds: seasonOneChapterIds,
        posterAssetId: "assets/story/theater/season-one.webp",
        status: requiredNodes.every((node) => node.cleared) ? "cleared" : "available",
        recommendedNodeId,
        starsEarned: 0,
        starsAvailable: seasonNodes.filter((node) => node.kind === "battle").length * 3,
        clearedNodes: nodes.filter((node) => node.cleared).length,
        totalNodes: nodes.length,
      }],
    };
  }

  const fulfill = (route: Route, body: unknown, status = 200) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

  page.route("**/api/player/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "GET" && url.pathname.endsWith("/player/bootstrap")) {
      return fulfill(route, bootstrap);
    }
    if (request.method() === "GET" && url.pathname.endsWith("/player/story")) {
      return fulfill(route, campaign());
    }
    const dialogueMatch = url.pathname.match(/\/player\/story\/nodes\/([^/]+)\/dialogue$/);
    if (request.method() === "POST" && dialogueMatch) {
      const nodeId = decodeURIComponent(dialogueMatch[1]);
      const body = request.postDataJSON() as { dialogueSeen?: string[] };
      const tokens = body.dialogueSeen ?? [];
      assert(tokens.length <= 100, `${nodeId}: a dialogue save exceeded 100 tokens`);
      assert(tokens.every((token) => token.length <= 120), `${nodeId}: a token exceeded 120 characters`);
      if (failNextDialogue) {
        failNextDialogue = false;
        return fulfill(route, { error: "Dialogue storage is temporarily unavailable" }, 503);
      }
      dialogueBodies.push({ nodeId, tokens: [...tokens] });
      dialogueSeen.set(nodeId, [...new Set([...(dialogueSeen.get(nodeId) ?? []), ...tokens])]);
      const next = campaign();
      return fulfill(route, {
        campaign: next,
        bootstrap,
        node: next.nodes.find((node: { nodeId: string }) => node.nodeId === nodeId),
        alreadyApplied: false,
      });
    }
    const completeMatch = url.pathname.match(/\/player\/story\/nodes\/([^/]+)\/complete$/);
    if (request.method() === "POST" && completeMatch) {
      const nodeId = decodeURIComponent(completeMatch[1]);
      const body = request.postDataJSON() as { dialogueSeen?: string[] };
      const tokens = body.dialogueSeen ?? [];
      assert(tokens.length <= 100, `${nodeId}: a clear exceeded 100 dialogue tokens`);
      assert(tokens.every((token) => token.length <= 120), `${nodeId}: a token exceeded 120 characters`);
      completionBodies.push({ nodeId, tokens: [...tokens] });
      dialogueSeen.set(nodeId, [...new Set([...(dialogueSeen.get(nodeId) ?? []), ...tokens])]);
      const alreadyCompleted = clearedIds.has(nodeId);
      clearedIds.add(nodeId);
      const rewards = alreadyCompleted || earnedSceneRewards
        ? []
        : sceneRewards.map((reward, index) => ({
            ...reward,
            rewardKey: `${nodeId}:route-shell:${index}`,
          }));
      if (!alreadyCompleted && !earnedSceneRewards) {
        earnedSceneRewards = true;
        payoutCount += rewards.length;
        for (const reward of rewards) {
          if (reward.kind === "currency") bootstrap.profile.softCurrency += reward.amount;
          if (reward.kind === "pack-ticket") bootstrap.profile.packTickets += reward.amount;
        }
      }
      const next = campaign();
      return fulfill(route, {
        campaign: next,
        bootstrap,
        node: next.nodes.find((node: { nodeId: string }) => node.nodeId === nodeId),
        rewards,
        alreadyCompleted,
      });
    }
    return route.continue();
  });

  return {
    bootstrap,
    campaign,
    clearedIds,
    dialogueBodies,
    dialogueSeen,
    completionBodies,
    getEarnedSceneRewards: () => earnedSceneRewards,
    getPayoutCount: () => payoutCount,
    failNextDialogueSave: () => { failNextDialogue = true; },
    prepareReturningScene() {
      for (const node of chapterOneNodes) {
        if (!node.optional && node.id !== sceneNode.id) clearedIds.add(node.id);
      }
    },
  };
}

async function advanceCurrentLine(page: Page) {
  const next = page.locator(".story-stage__next");
  if ((await next.textContent())?.includes("Complete line")) {
    await next.click();
  }
  await expect(next).toContainText("Next");
  // Respect the production 180ms double-tap guard. This models distinct
  // reading taps, rather than bypassing it or changing the player behavior.
  await page.waitForTimeout(200);
  await next.click();
}

for (const viewport of [
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
]) {
test(`mounted story route saves, resumes, replays and retries safely at ${viewport.width}x${viewport.height}`, async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize(viewport);
  const evidenceName = `${testInfo.project.name}-${viewport.width}x${viewport.height}`;
  await mkdir(screenshotDir, { recursive: true });
  const api = makeStoryApi(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const artifactPath = new URL(String(testInfo.project.use.baseURL)).pathname.replace(/\/+$/, "");
  const visit = (path: string) => page.goto(`${artifactPath}${path}`);

  await visit("/sign-in");
  await page.getByRole("button", { name: "Sign in test account", exact: true }).click();
  await expect(page).toHaveURL(/\/game(?:\?|$)/);
  await visit("/game/story");
  await expect(page).toHaveURL(/\/game\/story(?:\?|$)/);
  await expect(page.getByText("Season One", { exact: false }).first()).toBeVisible();
  await page.screenshot({
    path: join(screenshotDir, `${evidenceName}-new-account-map.png`),
    fullPage: true,
  });

  const firstNodeUrl = `/game/story?node=${encodeURIComponent(firstBattle.id)}`;
  await visit(firstNodeUrl);
  const preLines = dialogueLines(firstBattle.id, "pre");
  const preTokens = dialogueTokens(firstBattle.id, "pre");
  await expect(page.locator(".story-stage__speaker span")).toHaveText(
    preLines[0][0],
  );
  api.failNextDialogueSave();
  await advanceCurrentLine(page);
  await expect(page.locator(".story-stage__error")).toContainText("Progress could not be saved");
  assert.equal(api.dialogueBodies.length, 0, "A failed save cannot persist a line or pay a reward.");
  assert.equal(api.getPayoutCount(), 0);
  await expect(page.locator(".story-stage__speaker span")).toHaveText(preLines[0][0]);
  await advanceCurrentLine(page);
  await expect.poll(() => api.dialogueBodies.length).toBe(1);
  assert.deepEqual(api.dialogueBodies[0], {
    nodeId: firstBattle.id,
    tokens: preTokens.slice(0, 1),
  });
  await page.screenshot({
    path: join(screenshotDir, `${evidenceName}-partial-scene.png`),
    fullPage: true,
  });

  await page.reload();
  await expect(page.locator(".story-stage__speaker span")).toHaveText(
    preLines[1][0],
  );
  assert.deepEqual(api.dialogueSeen.get(firstBattle.id), preTokens.slice(0, 1));
  const postTokens = dialogueTokens(firstBattle.id, "post");
  assert(
    postTokens.every((token) => !api.dialogueSeen.get(firstBattle.id)!.includes(token)),
    "A new battle save must not mark its post-match scene as read.",
  );

  api.prepareReturningScene();
  const sceneLines = dialogueLines(sceneNode.id, "main");
  const sceneTokens = dialogueTokens(sceneNode.id, "main");
  const staleRevisionTokens = sceneTokens.map((token) =>
    token.replace(/:script-[^:]+:main:/, ":script-v2:main:"),
  );
  api.dialogueSeen.set(sceneNode.id, staleRevisionTokens);
  await visit(`/game/story?node=${encodeURIComponent(sceneNode.id)}`);
  await expect(page.locator(".story-stage__speaker span")).toHaveText(
    sceneLines[0][0],
  );
  await advanceCurrentLine(page);
  await expect.poll(() => api.dialogueBodies.length).toBe(2);
  assert.equal(api.dialogueBodies.at(-1)?.nodeId, sceneNode.id);
  assert.deepEqual(api.dialogueBodies.at(-1)?.tokens, sceneTokens.slice(0, 1));
  assert(
    api.dialogueBodies.flatMap((save) => save.tokens).every((token) => !staleRevisionTokens.includes(token)),
    "Old-revision markers must not be resubmitted as part of a current-revision save.",
  );
  await page.reload();
  await expect(page.locator(".story-stage__speaker span")).toHaveText(
    sceneLines[1][0],
  );

  await page.getByRole("button", { name: "Skip scene", exact: true }).click();
  await expect(page.getByText("SCENE COMPLETE", { exact: true })).toBeVisible();
  await expect(page.getByTestId("button-collect-story-rewards")).toBeVisible();
  assert.equal(api.completionBodies.length, 1);
  assert.equal(api.clearedIds.has(sceneNode.id), true);
  assert(api.getPayoutCount() > 0, "The first verified scene clear should deliver its authored rewards.");
  const payoutsAfterFirstClear = api.getPayoutCount();
  assert.deepEqual(
    api.dialogueSeen.get(sceneNode.id)?.filter((token) => sceneTokens.includes(token)),
    sceneTokens,
    "The successful scene clear persists its complete current-revision dialogue markers.",
  );
  assert(staleRevisionTokens.every((token) => api.dialogueSeen.get(sceneNode.id)?.includes(token)));
  await page.screenshot({
    path: join(screenshotDir, `${evidenceName}-cleared-scene.png`),
    fullPage: true,
  });
  // The authored payout celebration opens a modal. Dismiss it through the
  // player-facing action before testing the scene's retry controls below it.
  const receipt = page.locator("dialog[open].reward-reveal--story");
  await expect(receipt).toBeVisible();
  await receipt.getByRole("button", { name: "Keep going", exact: true }).click();
  await expect(receipt).toHaveCount(0);
  await page.screenshot({
    path: join(screenshotDir, `${evidenceName}-completion-after-receipt.png`),
    fullPage: true,
  });
  // Transcript and replay use the mounted route's real actions and authored
  // first line, and must not produce another save or award.
  await page.getByRole("button", { name: "Dialogue History", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Dialogue History", exact: true })).toBeVisible();
  await expect(page.locator('.story-node-overlay .space-y-3 > div p').first()).toHaveText(sceneLines[0][1].replaceAll("*", ""));
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Replay scenes", exact: true }).click();
  await expect(page.locator(".story-stage__speaker span")).toHaveText(sceneLines[0][0]);
  await page.getByRole("button", { name: "Skip scene", exact: true }).click();
  assert.equal(api.completionBodies.length, 1, "Replay cannot clear a scene or pay its awards again.");
  assert.equal(api.getPayoutCount(), payoutsAfterFirstClear);

  const firstCurrency = api.bootstrap.profile.softCurrency;
  await page.getByTestId("button-collect-story-rewards").click();
  await expect.poll(() => api.completionBodies.length).toBe(2);
  assert.equal(api.bootstrap.profile.softCurrency, firstCurrency);
  assert.equal(api.getEarnedSceneRewards(), true);
  await expect(page.getByRole("status")).toContainText("already saved");
  await page.reload();
  await expect(page.getByTestId("button-collect-story-rewards")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("button-collect-story-rewards").click();
  await expect.poll(() => api.completionBodies.length).toBe(3);
  assert.equal(api.bootstrap.profile.softCurrency, firstCurrency);
  assert.equal(api.getPayoutCount(), payoutsAfterFirstClear);
  assert.equal(errors.length, 0, errors.join("\n"));
  await page.screenshot({
    path: join(screenshotDir, `${evidenceName}-scene-retry.png`),
    fullPage: true,
  });
});
}