import { expect, test, type Page, type Route } from '@playwright/test';
import { verifyMatchTranscript, verifyStoryMatchTranscript } from '../src/gameEngine';

const battleFixture = '/e2e/broadcast-battle.fixture.html';
const matchId = 'task-265-broadcast-proof-match';
type BattleFixtureWindow = Window & {
  broadcastBattle: {
    contract(mode: 'story' | 'practice'): {
      playerDeckId: string; playerCards: string[]; rivalDeckId: string; encounter: unknown; upgrades: unknown; districts: unknown;
    };
    warmRewardStinger(): Promise<unknown>;
    verify(mode: 'story' | 'practice', moves: unknown[]): { phase: string; round: number };
  };
};

async function installMatchApi(page: Page, mode: 'story' | 'practice', options: { failFirst?: boolean; delaySave?: boolean } = {}) {
  let completionRequests = 0;
  let startRequests = 0;
  const apiRequests: string[] = [];
  let transcript: unknown[] = [];
  let contract: ReturnType<BattleFixtureWindow['broadcastBattle']['contract']> | null = null;
  let releaseCompletion!: () => void;
  const saveGate = new Promise<void>(resolve => { releaseCompletion = resolve; });
  const delayed = options.delaySave ? saveGate : Promise.resolve();
  const storyMode = mode === 'story';
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/player/')) apiRequests.push(`${request.method()} ${url.pathname}`);
  });
  await page.route('**/api/player/**', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'GET' && url.pathname.endsWith('/bootstrap')) {
      return route.fulfill({ json: { profile: { id: 'task-265-broadcast-player', softCurrency: 125, xp: 0, level: 1, streetRep: 0 }, missions: [], nextAction: null } });
    }
    if (request.method() === 'POST' && url.pathname.endsWith('/matches')) {
      startRequests++;
      const body = request.postDataJSON() as { mode: string; playerDeckId: string; storyNodeId?: string };
      contract = await page.evaluate(selectedMode => (window as unknown as BattleFixtureWindow).broadcastBattle.contract(selectedMode), mode);
      if (body.mode !== mode || body.playerDeckId !== contract.playerDeckId ||
          (storyMode && body.storyNodeId !== 'welcome-to-the-block')) {
        return route.fulfill({ status: 400, json: { error: 'PlayLoop submitted a mismatched verified match contract.' } });
      }
      return route.fulfill({ status: 201, json: {
        id: matchId, mode: body.mode, playerDeckId: contract.playerDeckId, rivalDeckId: contract.rivalDeckId,
        storyNodeId: storyMode ? 'welcome-to-the-block' : null, contentVersion: null,
        encounterSnapshot: contract.encounter, abilityUpgradeSnapshot: contract.upgrades,
        districtSnapshot: contract.districts, status: 'active', createdAt: '2026-10-20T00:00:00.000Z',
      } });
    }
    if (request.method() === 'POST' && url.pathname.endsWith(`/matches/${matchId}/complete`)) {
      completionRequests++;
      const body = request.postDataJSON() as { moves: Array<{ cardInstanceId: string | null; lane: number | null; squabble: boolean; endTurn?: boolean }> };
      transcript = body.moves;
      if (body.moves.filter(move => move.endTurn).length !== 6) {
        return route.fulfill({ status: 400, json: { error: 'The real PlayLoop must submit all six terminal pass moves.' } });
      }
      if (options.failFirst && completionRequests === 1) return route.fulfill({ status: 503, json: { error: 'Simulated completion save outage.' } });
      await delayed;
      return route.fulfill({ json: {
        profile: { id: 'task-265-broadcast-player', softCurrency: 150, xp: 25, level: 1, streetRep: 4 },
        missions: [], nextAction: null,
        reward: { id: matchId, label: 'Broadcast test match', xp: 25, streetRep: 4, softCurrency: 25, packTickets: 0,
          descriptions: ['The verified match was saved.'], storyRewards: [], cardXp: [] },
        alreadyCompleted: false, campaign: null, story: null,
      } });
    }
    return route.fulfill({ status: 404, json: { error: `Unmocked API request ${request.method()} ${url.pathname}` } });
  });
  return {
    completionCount: () => completionRequests,
    startCount: () => startRequests,
    moves: () => transcript,
    verify: () => {
      if (!contract) throw new Error('The match must start before its transcript can be verified.');
      return mode === 'story'
        ? verifyStoryMatchTranscript(contract.encounter as never, contract.playerDeckId, transcript as never[], undefined, contract.upgrades as never, contract.districts as never)
        : verifyMatchTranscript(contract.playerDeckId, contract.rivalDeckId, transcript as never[], contract.upgrades as never, contract.playerCards, contract.districts as never);
    },
    release: () => releaseCompletion(),
    requests: () => apiRequests,
  };
}

async function readyToEndTurn(page: Page, expectedRound: number) {
  await expect.poll(async () => {
    const lesson = page.getByTestId('button-dismiss-mechanic-lesson');
    if (await lesson.isVisible().catch(() => false)) {
      await lesson.click({ timeout: 2000 }).catch(() => {});
      return false;
    }
    const readingCue = page.getByTestId('guided-reading-cue');
    if (await readingCue.isVisible().catch(() => false)) {
      await readingCue.getByTestId('button-continue-guided-reading').click({ timeout: 2000 }).catch(() => {});
      return false;
    }
    const arena = page.getByTestId('battle-arena');
    if (!await arena.isVisible().catch(() => false)) return false;
    const roundLabel = await arena.locator('.battle-round').first().getAttribute('aria-label').catch(() => null);
    const roundMatches = roundLabel === `Round ${expectedRound} of 6`;
    const presentationReady = await arena.getAttribute('data-presentation-phase') === 'player-ready';
    const engineReady = await arena.getAttribute('data-engine-phase') === 'player';
    const endTurn = page.getByTestId('button-next-round');
    if (roundMatches && presentationReady && engineReady && await endTurn.isEnabled().catch(() => false)) return true;
    if (expectedRound === 6) return false;
    const continuePast = page.getByRole('button', { name: /^Continue past / });
    if (await continuePast.isVisible().catch(() => false)) {
      await continuePast.click({ timeout: 2000 }).catch(() => {});
      return false;
    }
    const skip = page.getByTestId('button-fast-forward');
    if (await skip.isVisible().catch(() => false)) {
      await skip.click({ timeout: 2000 }).catch(() => {});
      return false;
    }
    return false;
  }, { timeout: 60_000, intervals: [100, 200, 300] }).toBe(true);
}

async function waitForTerminalBattle(page: Page, options: { skipFinal?: boolean } = {}) {
  await expect.poll(async () => {
    const lesson = page.getByTestId('button-dismiss-mechanic-lesson');
    if (await lesson.isVisible().catch(() => false)) {
      await lesson.click({ timeout: 2000 }).catch(() => {});
      return false;
    }
    const readingCue = page.getByTestId('guided-reading-cue');
    if (await readingCue.isVisible().catch(() => false)) {
      await readingCue.getByTestId('button-continue-guided-reading').click({ timeout: 2000 }).catch(() => {});
      return false;
    }
    if (await page.getByTestId('battle-result-screen').isVisible().catch(() => false) ||
        await page.getByTestId('reward-stinger').isVisible().catch(() => false)) return true;
    const arena = page.getByTestId('battle-arena');
    if (!await arena.isVisible().catch(() => false)) return false;
    if (options.skipFinal) {
      const continuePast = page.getByRole('button', { name: /^Continue past / });
      if (await continuePast.isVisible().catch(() => false)) {
        await continuePast.click({ timeout: 2000 }).catch(() => {});
        return false;
      }
      const finalSkip = page.getByTestId('button-fast-forward');
      if (await finalSkip.isVisible().catch(() => false)) {
        await finalSkip.click({ timeout: 2000 }).catch(() => {});
        return false;
      }
    }
    return await arena.getAttribute('data-engine-phase') === 'complete' &&
      await page.getByTestId('button-archive-match').isVisible().catch(() => false);
  }, { timeout: 60_000, intervals: [100, 200, 300] }).toBe(true);
}

async function waitForCompletionSubmission(page: Page, count: () => number) {
  await expect.poll(async () => {
    const lesson = page.getByTestId('button-dismiss-mechanic-lesson');
    if (await lesson.isVisible().catch(() => false)) {
      await lesson.click({ timeout: 2000 }).catch(() => {});
      return false;
    }
    const readingCue = page.getByTestId('guided-reading-cue');
    if (await readingCue.isVisible().catch(() => false)) {
      await readingCue.getByTestId('button-continue-guided-reading').click({ timeout: 2000 }).catch(() => {});
      return false;
    }
    return count();
  }, { timeout: 60_000, intervals: [50, 100] }).toBe(1);
  await expect(page.getByTestId('battle-arena')).toHaveAttribute('data-presentation-phase', 'match-finish');
}

async function dismissPreviewChrome(page: Page) {
  await page.evaluate(() => document.getElementById('replit-dev-banner')?.remove()).catch(() => {});
}

async function allowOptionalVideo(page: Page) {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    const allowMotion = () => {
      if (document.documentElement.dataset.reduceMotion !== 'false') {
        document.documentElement.dataset.reduceMotion = 'false';
      }
    };
    if (document.documentElement) allowMotion();
    else document.addEventListener('DOMContentLoaded', allowMotion, { once: true });
    const connection = Object.assign(new EventTarget(), { saveData: false, effectiveType: '4g', downlink: 10 });
    Object.defineProperty(navigator, 'connection', { configurable: true, value: connection });
  });
}

async function assertOptionalVideoAllowed(page: Page) {
  const policy = await page.evaluate(() => ({
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    reduceMotionOverride: document.documentElement.dataset.reduceMotion,
    hidden: document.hidden,
    saveData: (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData ?? false,
    effectiveType: (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType ?? '4g',
    downlink: (navigator as Navigator & { connection?: { downlink?: number } }).connection?.downlink ?? 10,
  }));
  expect(policy).toEqual({
    reducedMotion: false, reduceMotionOverride: 'false', hidden: false,
    saveData: false, effectiveType: '4g', downlink: 10,
  });
}

async function playSixPasses(page: Page, options: { finalSpeed?: 'normal' | 'fast'; skipFinal?: boolean; waitForTerminal?: boolean } = {}) {
  await expect(page.getByTestId('battle-arena')).toBeVisible({ timeout: 30_000 });
  await readyToEndTurn(page, 1);
  await expect(page.getByTestId('battle-arena')).toHaveAttribute('data-battle-speed', 'normal');
  for (let round = 1; round <= 6; round++) {
    await readyToEndTurn(page, round);
    if (round === 6 && options.finalSpeed === 'fast') {
      await page.getByTestId('button-battle-speed').click();
      await expect(page.getByTestId('battle-arena')).toHaveAttribute('data-battle-speed', 'fast');
      await readyToEndTurn(page, round);
    }
    await page.getByTestId('button-next-round').click();
    if (round < 6) await readyToEndTurn(page, round + 1);
  }
  if (options.waitForTerminal !== false) await waitForTerminalBattle(page, { skipFinal: options.skipFinal });
}

async function openFinalBoardThenReturn(page: Page) {
  await page.getByTestId('battle-result-screen').getByTestId('button-inspect-final-board').click();
  await expect(page.getByTestId('final-board-review')).toBeVisible();
  await dismissPreviewChrome(page);
  await page.locator('.result-stage__return').evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.getByTestId('battle-result-screen')).toBeVisible();
}

async function archiveCompletedBattle(page: Page) {
  if (await page.getByTestId('reward-stinger').isVisible().catch(() => false) ||
      await page.getByTestId('battle-result-screen').isVisible().catch(() => false)) return;
  const archive = page.getByTestId('button-archive-match');
  if (await archive.isVisible().catch(() => false)) await archive.click();
}

async function showResultAfterBroadcast(page: Page, speed: 1 | 1.5) {
  const stinger = page.getByTestId('reward-stinger');
  await expect(stinger).toBeVisible({ timeout: 10_000 });
  const video = stinger.locator('video');
  await expect(video).toBeVisible({ timeout: 10_000 });
  await expect(video).toHaveJSProperty('playbackRate', speed);
  await stinger.getByRole('button', { name: /Show results/ }).click();
  await expect(page.getByTestId('battle-result-screen')).toBeVisible({ timeout: 10_000 });
}

test('confirmed Story completion presents its mounted 1x cinematic once before results', async ({ page }) => {
  const api = await installMatchApi(page, 'story', { delaySave: true });
  await allowOptionalVideo(page);
  await page.goto(`${battleFixture}?mode=story`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => (window as unknown as BattleFixtureWindow).broadcastBattle.warmRewardStinger());
  await assertOptionalVideoAllowed(page);
  await dismissPreviewChrome(page);
  await playSixPasses(page, { waitForTerminal: false });
  await waitForCompletionSubmission(page, api.completionCount);
  expect(await page.getByTestId('reward-stinger').count()).toBe(0);
  const broadcast = showResultAfterBroadcast(page, 1);
  api.release();
  await broadcast;
  expect((api.moves() as Array<{ endTurn?: boolean }>).filter(move => move.endTurn)).toHaveLength(6);
  expect(api.verify()).toMatchObject({ phase: 'complete', round: 6 });
  const videoCount = await page.locator('video').count();
  await openFinalBoardThenReturn(page);
  await expect(page.getByTestId('reward-stinger')).toHaveCount(0);
  expect(await page.locator('video').count()).toBe(videoCount);
  expect(api.completionCount()).toBe(1);
  expect(api.startCount()).toBe(1);
});

test('confirmed Training Circuit completion presents its mounted 1.5x cinematic once', async ({ page }) => {
  const api = await installMatchApi(page, 'practice', { delaySave: true });
  await allowOptionalVideo(page);
  await page.goto(`${battleFixture}?mode=practice&training=true`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => (window as unknown as BattleFixtureWindow).broadcastBattle.warmRewardStinger());
  await assertOptionalVideoAllowed(page);
  await dismissPreviewChrome(page);
  await playSixPasses(page, { finalSpeed: 'fast', waitForTerminal: false });
  await waitForCompletionSubmission(page, api.completionCount);
  expect(await page.getByTestId('reward-stinger').count()).toBe(0);
  const broadcast = showResultAfterBroadcast(page, 1.5);
  api.release();
  await broadcast;
  expect((api.moves() as Array<{ endTurn?: boolean }>).filter(move => move.endTurn)).toHaveLength(6);
  expect(api.verify()).toMatchObject({ phase: 'complete', round: 6 });
  const videoCount = await page.locator('video').count();
  await openFinalBoardThenReturn(page);
  await expect(page.getByTestId('reward-stinger')).toHaveCount(0);
  expect(await page.locator('video').count()).toBe(videoCount);
  expect(api.completionCount()).toBe(1);
});

test('Story: final pass saves promptly, fails open within 1.5s, and failure/retry/review never start a stinger', async ({ page }) => {
  const videoRequests: string[] = [];
  page.on('request', request => {
    if (request.url().includes('/brand/broadcast/') && request.url().endsWith('.mp4')) videoRequests.push(request.url());
  });
  const api = await installMatchApi(page, 'story', { failFirst: true });
  await page.goto(`${battleFixture}?mode=story`, { waitUntil: 'domcontentloaded' });
  await dismissPreviewChrome(page);
  await playSixPasses(page);
  await archiveCompletedBattle(page);
  await expect.poll(api.completionCount, { timeout: 10_000, message: `Completion API not called; observed ${api.requests().join(', ')}` }).toBe(1);
  await expect(page.getByTestId('battle-result-screen')).toBeVisible({ timeout: 1500 });
  await expect(page.getByTestId('reward-stinger')).toHaveCount(0);
  expect((api.moves() as Array<{ endTurn?: boolean }>).filter(move => move.endTurn)).toHaveLength(6);
  expect(api.verify()).toMatchObject({ phase: 'complete', round: 6 });
  await expect(page.getByRole('alert').getByText('Failed to save outcome.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry Save' })).toBeVisible();
  await page.getByRole('button', { name: 'Retry Save' }).click();
  await expect.poll(api.completionCount, { timeout: 10_000, message: `Retry did not complete; observed ${api.requests().join(', ')}` }).toBe(2);
  await expect(page.getByRole('button', { name: 'Retry Save' })).toHaveCount(0);
  await expect(page.getByText('Saving your story progress and rewards…')).toHaveCount(0);
  await expect(page.getByTestId('battle-result-screen')).toBeVisible();
  await expect(page.getByTestId('reward-stinger')).toHaveCount(0);
  await openFinalBoardThenReturn(page);
  await expect(page.getByTestId('reward-stinger')).toHaveCount(0);
  expect(videoRequests).toEqual([]);
  expect(api.startCount()).toBe(1);
});

test('explicit Training Circuit: delayed save does not hold results, 1.5x applies, and review stays once-only', async ({ page }, testInfo) => {
  const videoRequests: string[] = [];
  page.on('request', request => {
    if (request.url().includes('/brand/broadcast/') && request.url().endsWith('.mp4')) videoRequests.push(request.url());
  });
  const api = await installMatchApi(page, 'practice', { delaySave: true });
  await page.goto(`${battleFixture}?mode=practice&training=true`, { waitUntil: 'domcontentloaded' });
  await dismissPreviewChrome(page);
  await playSixPasses(page, { finalSpeed: 'fast' });
  await archiveCompletedBattle(page);
  await expect.poll(api.completionCount, { timeout: 10_000, message: `Completion API not called; observed ${api.requests().join(', ')}` }).toBe(1);
  await expect(page.getByTestId('battle-result-screen')).toBeVisible({ timeout: 1500 });
  await expect(page.getByTestId('reward-stinger')).toHaveCount(0);
  // playSixPasses asserted the speed before committing round six. Results
  // correctly unmount the arena; do not require an obsolete underlying board.
  await expect(page.getByTestId('battle-arena')).toHaveCount(0);
  await expect(page.getByTestId('battle-result-screen').locator('.result-immersive__caption')).toHaveText('Saving battle earnings…');
  await testInfo.attach('training-result-before-save', { body: await page.screenshot(), contentType: 'image/png' });
  await openFinalBoardThenReturn(page);
  expect(api.completionCount()).toBe(1);
  api.release();
  await expect(page.getByTestId('battle-result-screen')).toBeVisible();
  await expect(page.getByText('Saving battle earnings…')).toHaveCount(0);
  await expect(page.getByTestId('reward-stinger')).toHaveCount(0);
  expect(videoRequests).toEqual([]);
  expect(api.completionCount()).toBe(1);
  expect((api.moves() as Array<{ endTurn?: boolean }>).filter(move => move.endTurn)).toHaveLength(6);
  expect(api.verify()).toMatchObject({ phase: 'complete', round: 6 });
});

test('ordinary practice completion is excluded from the stinger', async ({ page }) => {
  const practice = await installMatchApi(page, 'practice');
  await page.goto(`${battleFixture}?mode=practice`, { waitUntil: 'domcontentloaded' });
  await dismissPreviewChrome(page);
  await playSixPasses(page, { skipFinal: true });
  await archiveCompletedBattle(page);
  await expect.poll(practice.completionCount, { timeout: 10_000, message: `Practice completion API not called; observed ${practice.requests().join(', ')}` }).toBe(1);
  await expect(page.getByTestId('battle-result-screen')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('reward-stinger')).toHaveCount(0);
  expect(practice.verify()).toMatchObject({ phase: 'complete', round: 6 });
  await openFinalBoardThenReturn(page);
  expect(practice.completionCount()).toBe(1);
});

test('fast-forwarded Story completion saves once without requesting an optional stinger', async ({ page }) => {
  const videos: string[] = [];
  page.on('request', request => {
    if (request.url().includes('/brand/broadcast/') && request.url().endsWith('.mp4')) videos.push(request.url());
  });
  const api = await installMatchApi(page, 'story');
  await allowOptionalVideo(page);
  await page.goto(`${battleFixture}?mode=story`, { waitUntil: 'domcontentloaded' });
  await assertOptionalVideoAllowed(page);
  await dismissPreviewChrome(page);
  await playSixPasses(page, { skipFinal: true });
  await expect.poll(api.completionCount).toBe(1);
  await expect(page.getByTestId('battle-result-screen')).toBeVisible();
  await expect(page.getByTestId('reward-stinger')).toHaveCount(0);
  expect(videos).toEqual([]);
  expect(api.verify()).toMatchObject({ phase: 'complete', round: 6 });
});