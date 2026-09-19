import { readFile, rename, stat, writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import {
  ROOKIE_CORE_IDS,
  ROOKIE_DECK_ID,
  ROOKIE_FOUNDATION_ID,
  catalogIdsToEngineIds,
} from "@workspace/squabblemon-engine/data";
import { createGuidedTutorialTranscript, createStoryMatch } from "@workspace/squabblemon-engine/gameEngine";
import { storyContent, type StoryNode } from "@workspace/squabblemon-engine/story";
import { solveStoryMoves } from "../../api-server/src/lib/storyMoveSolver";

const email = process.env.CAMPAIGN_E2E_EMAIL;
const password = process.env.CAMPAIGN_E2E_PASSWORD;
const verificationCode = process.env.CAMPAIGN_E2E_VERIFICATION_CODE;
const verificationCodeFile = process.env.CAMPAIGN_E2E_VERIFICATION_CODE_FILE;
const expectedEnvironment = process.env.CAMPAIGN_E2E_EXPECT_ENVIRONMENT;
const runId = process.env.CAMPAIGN_E2E_RUN_ID;
const manifestPath = process.env.CAMPAIGN_E2E_MANIFEST;

for (const [name, value] of Object.entries({
  CAMPAIGN_E2E_EMAIL: email,
  CAMPAIGN_E2E_PASSWORD: password,
  CAMPAIGN_E2E_RUN_ID: runId,
  CAMPAIGN_E2E_MANIFEST: manifestPath,
})) {
  if (!value) throw new Error(`${name} is required.`);
}

if (expectedEnvironment !== "staging" && expectedEnvironment !== "production") {
  throw new Error("CAMPAIGN_E2E_EXPECT_ENVIRONMENT must explicitly be staging or production.");
}
if (expectedEnvironment === "production" && (!verificationCodeFile || verificationCode)) {
  throw new Error("Production Clerk signup requires only the post-Continue verification code file checkpoint.");
}
if (expectedEnvironment === "staging" && !verificationCode && !verificationCodeFile) {
  throw new Error("Staging Clerk signup requires a test code or post-Continue code file checkpoint.");
}

async function codeAfterClerkContinue(requestedAt: number): Promise<string> {
  if (expectedEnvironment === "staging" && verificationCode) return verificationCode;
  const deadline = Date.now() + 10 * 60_000;
  process.stdout.write(`Clerk sent the OTP. Write only the new code to ${verificationCodeFile}.\n`);
  while (Date.now() < deadline) {
    try {
      const metadata = await stat(verificationCodeFile!);
      if (metadata.mtimeMs >= requestedAt) {
        const code = (await readFile(verificationCodeFile!, "utf8")).trim();
        if (/^\d{4,8}$/.test(code)) return code;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await new Promise(resolve => setTimeout(resolve, 2_000));
  }
  throw new Error("Timed out waiting for a fresh post-Continue Clerk verification code.");
}
type ApiResult = { status: number; body: any; requestId: string | null };
type CleanupManifest = {
  version: 1;
  stage: "clerk-created" | "profile-created";
  environment: "staging" | "production";
  runId: string;
  origin: string;
  deployId: string;
  databaseFingerprint: string;
  clerkUserId: string;
  clerkEmail: string;
  createdAt: string;
  initialDisplayName?: string;
};

async function writeCleanupManifest(manifest: CleanupManifest): Promise<void> {
  const temporaryPath = `${manifestPath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(manifest, null, 2));
  await rename(temporaryPath, manifestPath!);
}

async function api(page: Page, path: string, body?: unknown): Promise<ApiResult> {
  return page.evaluate(async ({ path, body, runId }) => {
    const response = await fetch(`/api${path}`, {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
        "x-campaign-run-id": runId,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    return {
      status: response.status,
      body: text ? JSON.parse(text) : null,
      requestId: response.headers.get("x-request-id"),
    };
  }, { path, body, runId: runId! });
}

test("real Clerk UI signup verifies Rookie Road and every authored campaign node through deployed HTTP and database routes", async ({ page, baseURL }) => {
  await page.goto("/sign-up");
  await page.locator('input[name="emailAddress"]').fill(email!);
  const passwordInput = page.locator('input[name="password"]');
  if (await passwordInput.isVisible()) await passwordInput.fill(password!);
  let verificationRequestedAt = Date.now();
  await page.getByRole("button", { name: /continue/i }).click();
  if (await passwordInput.isVisible()) {
    await passwordInput.fill(password!);
    verificationRequestedAt = Date.now();
    await page.getByRole("button", { name: /continue/i }).click();
  }
  const codeInput = page.locator('input[name="code"]');
  await codeInput.waitFor({ state: "visible" });
  await codeInput.fill(await codeAfterClerkContinue(verificationRequestedAt));
  await page.getByRole("button", { name: /continue|verify/i }).click();
  await expect(page).toHaveURL(/\/game(?:\/|$)/);

  await page.waitForFunction(() => Boolean((window as any).Clerk?.user?.id));
  const clerkIdentity = await page.evaluate(() => {
    const user = (window as any).Clerk?.user;
    return {
      id: user?.id as string | undefined,
      email: (
        user?.primaryEmailAddress?.emailAddress ??
        user?.emailAddresses?.[0]?.emailAddress
      ) as string | undefined,
    };
  });
  expect(clerkIdentity.id).toMatch(/^user_[A-Za-z0-9]+$/);
  expect(clerkIdentity.email?.toLowerCase()).toBe(email!.toLowerCase());

  const cleanupManifest: CleanupManifest = {
    version: 1,
    stage: "clerk-created",
    environment: expectedEnvironment,
    runId: runId!,
    origin: new URL(baseURL!).origin,
    deployId: process.env.CAMPAIGN_E2E_DEPLOY_ID!,
    databaseFingerprint: process.env.CAMPAIGN_E2E_DATABASE_FINGERPRINT!,
    clerkUserId: clerkIdentity.id!,
    clerkEmail: email!,
    createdAt: new Date().toISOString(),
  };
  // Persist the Clerk identity before the first application API call can
  // provision database rows. Cleanup therefore remains possible if bootstrap
  // or any later assertion fails.
  await writeCleanupManifest(cleanupManifest);

  let result = await api(page, "/player/bootstrap");
  expect(result.status).toBe(200);
  expect(result.requestId).toMatch(/^[0-9a-f-]{36}$/);
  expect(result.body.profile.id).toBe(cleanupManifest.clerkUserId);
  cleanupManifest.stage = "profile-created";
  cleanupManifest.initialDisplayName = result.body.profile.displayName;
  await writeCleanupManifest(cleanupManifest);

  await page.getByPlaceholder(/tha_truth/i).fill(`Campaign ${runId!.slice(0, 8)}`);
  await page.getByLabel(/at least 13/i).check();
  await page.getByLabel(/terms of service/i).check();
  await page.getByRole("button", { name: "Confirm" }).click();

  result = await api(page, "/player/matches", {
    mode: "tutorial", playerDeckId: "vibes", rivalDeckId: "combo",
  });
  expect(result.status).toBe(201);
  const tutorialMoves = createGuidedTutorialTranscript(
    result.body.abilityUpgradeSnapshot,
    result.body.districtSnapshot,
  );
  expect((await api(page, `/player/matches/${result.body.id}/complete`, { moves: tutorialMoves })).status).toBe(200);
  const passes = Array.from({ length: 6 }, () => ({
    cardInstanceId: null, lane: null, squabble: false, endTurn: true,
  }));
  expect((await api(page, "/player/onboarding", { action: "complete-tutorial" })).status).toBe(200);
  expect((await api(page, "/player/onboarding", {
    action: "choose-starter", starterDeckId: ROOKIE_FOUNDATION_ID,
  })).status).toBe(200);
  result = await api(page, "/player/matches", {
    mode: "practice", playerDeckId: ROOKIE_DECK_ID, rivalDeckId: "block",
  });
  expect(result.status).toBe(201);
  expect((await api(page, `/player/matches/${result.body.id}/complete`, { moves: passes })).status).toBe(200);
  expect((await api(page, "/player/onboarding", { action: "claim-reward" })).status).toBe(200);

  let testedLoss = false;
  async function completeNode(node: StoryNode) {
    const seen = [`remote:${node.id}`];
    expect((await api(page, `/player/story/nodes/${node.id}/dialogue`, {
      idempotencyKey: `dialogue-${node.id}-${runId}`,
      dialogueSeen: seen,
    })).status).toBe(200);
    if (node.kind !== "battle") {
      const key = `complete-${node.id}-${runId}`;
      expect((await api(page, `/player/story/nodes/${node.id}/complete`, {
        idempotencyKey: key, dialogueSeen: seen,
      })).status).toBe(200);
      const retry = await api(page, `/player/story/nodes/${node.id}/complete`, {
        idempotencyKey: key, dialogueSeen: seen,
      });
      expect(retry.status).toBe(200);
      expect(retry.body.alreadyCompleted).toBe(true);
      return;
    }
    const start = async () => {
      const started = await api(page, "/player/matches", {
        mode: "story",
        playerDeckId: ROOKIE_DECK_ID,
        rivalDeckId: "block",
        storyNodeId: node.id,
      });
      expect(started.status, JSON.stringify(started.body)).toBe(201);
      return {
        response: started,
        match: createStoryMatch(
          started.body.encounterSnapshot,
          catalogIdsToEngineIds(ROOKIE_CORE_IDS),
          ROOKIE_DECK_ID,
          started.body.abilityUpgradeSnapshot,
          started.body.districtSnapshot,
        ),
      };
    };
    if (!testedLoss) {
      const attempt = await start();
      const loss = await api(page, `/player/matches/${attempt.response.body.id}/complete`, {
        moves: solveStoryMoves(attempt.match, "loss"),
      });
      expect(loss.status).toBe(200);
      expect(loss.body.story.outcome).toBe("loss");
      testedLoss = true;
    }
    const attempt = await start();
    const winningMoves = solveStoryMoves(attempt.match, "win");
    const victory = await api(page, `/player/matches/${attempt.response.body.id}/complete`, {
      moves: winningMoves,
    });
    expect(victory.status, JSON.stringify(victory.body)).toBe(200);
    expect(victory.body.story.outcome).toBe("win");
    const retry = await api(page, `/player/matches/${attempt.response.body.id}/complete`, {
      moves: winningMoves,
    });
    expect(retry.body.alreadyCompleted).toBe(true);
  }

  for (const chapter of storyContent.chapters) {
    const optional: StoryNode[] = [];
    for (const node of chapter.nodes) {
      if (node.optional) optional.push(node);
      else await completeNode(node);
    }
    for (const node of optional) await completeNode(node);
  }

  const campaign = await api(page, "/player/story");
  expect(campaign.status).toBe(200);
  expect(campaign.body.nodes).toHaveLength(storyContent.chapters.flatMap(chapter => chapter.nodes).length);
  expect(campaign.body.nodes.every((node: { status: string }) => node.status === "cleared")).toBe(true);
  expect(campaign.body.recommendedNodeId).toBeNull();
});
