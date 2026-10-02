import { expect, test, type Locator, type Page, type Route, type TestInfo } from '@playwright/test';
import type { MatchCompletion, PlayerBootstrap } from '@workspace/api-client-react';
import { createAbilityUpgradeSnapshot } from '@workspace/squabblemon-engine/abilityUpgrades';
import { createDistrictSnapshot } from '@workspace/squabblemon-engine/districts';
import { ROOKIE_DECK_ID, ROOKIE_FOUNDATION_ID, ROOKIE_FOUNDATION_IDS, ROOKIE_MENTOR_CORE_IDS, catalogIdsToEngineIds, decks } from '../src/data';
import { verifyMatchTranscript, type TranscriptMove } from '../src/gameEngine';

// A disposable account with the real saved starter lineup. No test-only game controls.
const rival = decks.find(deck => deck.id === 'combo');
if (!rival) throw new Error('The canonical combo rival deck is unavailable.');
const districts = createDistrictSnapshot('rookie-practice-review');
const matchId = 'server-issued-rookie-practice-review';

function bootstrap(tested: boolean): PlayerBootstrap {
  return {
    profile: {
      id: 'e2e-rookie-practice-review', displayName: 'ROOKIE', avatarKey: 'rookie',
      onboardingStep: 'reward', starterDeckId: ROOKIE_FOUNDATION_ID,
      streetRep: 0, xp: 0, level: 1, softCurrency: 0, packTickets: 0,
      styleShards: 0, packPity: 0, deckSlots: 3, cosmeticCurrency: 0,
      collectionProgress: ROOKIE_FOUNDATION_IDS.length, storyChapter: 1, storyNode: 0,
      tutorialCompleted: true, starterRewardClaimed: false,
      ageConfirmedAt: '2026-09-08T00:00:00.000Z', termsAcceptedAt: '2026-09-08T00:00:00.000Z',
      settings: { reducedMotion: true, turnTimerEnabled: false },
      ownedCardIds: [...ROOKIE_FOUNDATION_IDS], discoveredCardIds: [...ROOKIE_FOUNDATION_IDS],
      ownedVariants: [], equippedVariants: {}, cardProgression: {},
      unlockedCosmeticIds: [], unlockedCharacterIds: [],
      savedDecks: [{
        id: ROOKIE_DECK_ID, name: 'My First Gang', cardIds: [...ROOKIE_MENTOR_CORE_IDS],
        heroCardId: 'dr-fade', recipeId: null, valid: true, issues: [],
      }],
      storyProgress: {}, inbox: [], packHistory: [], lastActiveAt: '2026-09-08T00:00:00.000Z',
    },
    missions: [],
    nextAction: {
      id: tested ? 'rookie-tested' : 'onboarding-reward',
      eyebrow: 'Rookie Road', title: 'Finish setup', description: 'Practice your saved gang.',
      destination: 'onboarding', rewardLabel: null,
    },
    packConfig: {
      id: 'street-pack', name: 'Street Pack', oddsVersion: 'e2e-practice-v1',
      softCurrencyCost: 500, ticketCost: 1, rewardsPerPack: 3, pityLimit: 10, odds: [],
    },
    tenPullConfig: {
      id: 'e2e-ten-pull', name: 'Practice Ten Pull', oddsVersion: 'e2e-practice-v1',
      pullCount: 10, ticketCost: 9, softCurrencyCost: 1800,
      rewardsPerPull: 3, rarePityBonusPerPull: 1,
    },
    collectionRoad: [],
  };
}

async function installApi(page: Page) {
  let tested = false;
  let completionRequests = 0;
  let transcript: TranscriptMove[] = [];
  let releaseCompletion: (() => void) | undefined;
  const heldCompletion = new Promise<void>(resolve => { releaseCompletion = resolve; });
  const upgrades = createAbilityUpgradeSnapshot(
    catalogIdsToEngineIds(ROOKIE_MENTOR_CORE_IDS), rival.cards,
  );
  await page.route('**/api/player/**', async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/bootstrap')) {
      return route.fulfill({ json: bootstrap(tested) });
    }
    if (request.method() === 'POST' && path.endsWith('/matches')) {
      const body = request.postDataJSON() as { mode: string; playerDeckId: string };
      if (body.mode !== 'practice' || body.playerDeckId !== ROOKIE_DECK_ID) {
        return route.fulfill({ status: 400, json: { error: 'Expected the saved Rookie Road practice gang.' } });
      }
      return route.fulfill({ status: 201, json: {
        id: matchId, mode: 'practice', playerDeckId: ROOKIE_DECK_ID,
        rivalDeckId: rival.id, storyNodeId: null, contentVersion: null,
        encounterSnapshot: null, abilityUpgradeSnapshot: upgrades,
        districtSnapshot: districts, status: 'active', createdAt: '2026-09-08T00:00:00.000Z',
      } });
    }
    if (request.method() === 'POST' && path.endsWith(`/matches/${matchId}/complete`)) {
      completionRequests += 1;
      const body = request.postDataJSON() as { moves: TranscriptMove[] };
      transcript = body.moves;
      try {
        const verified = verifyMatchTranscript(
          ROOKIE_DECK_ID, rival.id, transcript, upgrades,
          catalogIdsToEngineIds(ROOKIE_MENTOR_CORE_IDS), districts,
        );
        if (verified.phase !== 'complete' || verified.round !== 6 || transcript.filter(move => move.endTurn).length !== 6) {
          throw new Error('Practice must finish six real rounds with six End Turn moves.');
        }
      } catch (error) {
        return route.fulfill({ status: 400, json: { error: String(error) } });
      }
      await heldCompletion;
      tested = true;
      const current = bootstrap(tested);
      const receipt: MatchCompletion = {
        profile: current.profile, missions: current.missions, nextAction: current.nextAction,
        reward: {
          id: 'rookie-practice', label: 'Practice complete', xp: 0, streetRep: 0,
          softCurrency: 0, packTickets: 0, descriptions: ['Your practice fade was saved.'],
          storyRewards: [], cardXp: [],
        },
        alreadyCompleted: false, campaign: null, story: null,
      };
      return route.fulfill({ json: receipt });
    }
    return route.fulfill({ status: 404, json: { error: `Unmocked player API: ${request.method()} ${path}` } });
  });
  return {
    release: () => releaseCompletion!(),
    count: () => completionRequests,
    moves: () => transcript,
    tested: () => tested,
  };
}

async function clickVisible(locator: Locator) {
  if (!await locator.isVisible().catch(() => false)) return false;
  try {
    await locator.click({ noWaitAfter: true, timeout: 3000 });
    return true;
  } catch (error) {
    if (await locator.isVisible().catch(() => false)) throw error;
    return false;
  }
}

async function isUnobstructed(locator: Locator) {
  return locator.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const hit = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    return Boolean(hit && (hit === element || element.contains(hit)));
  }).catch(() => false);
}

async function currentRound(page: Page) {
  const label = await page.locator('.battle-round').first().getAttribute('aria-label').catch(() => null);
  const match = label?.match(/^Round (\d+) of 6$/);
  return match ? Number(match[1]) : null;
}

async function serviceBattleHold(page: Page) {
  // A single effect can introduce more than one mechanic; acknowledge each
  // readable lesson separately before touching a skippable presentation.
  const mechanicLesson = page.getByTestId('button-dismiss-mechanic-lesson');
  if (await mechanicLesson.isVisible().catch(() => false)) {
    await expect(mechanicLesson).toHaveAccessibleName('Back to the battle');
    return clickVisible(mechanicLesson);
  }
  if (await page.getByTestId('guided-reading-cue').isVisible().catch(() => false)) {
    const continueReading = page.getByTestId('button-continue-guided-reading');
    if (await continueReading.isEnabled().catch(() => false)) await continueReading.click({ noWaitAfter: true, timeout: 3000 });
    return true;
  }
  if (await clickVisible(page.getByRole('button', { name: /^Continue past / }))) return true;
  if (await clickVisible(page.getByTestId('button-fast-forward'))) return true;
  const resolving = page.getByTestId('button-resolving');
  if (await resolving.isVisible().catch(() => false) &&
      await resolving.isEnabled().catch(() => false) &&
      await isUnobstructed(resolving)) {
    return clickVisible(resolving);
  }
  return false;
}

async function readyToEndTurn(page: Page, expectedRound: number) {
  await expect.poll(async () => {
    if (await serviceBattleHold(page)) return false;
    const arena = page.getByTestId('battle-arena');
    if (await arena.isVisible().catch(() => false) &&
        await currentRound(page) === expectedRound &&
        await arena.getAttribute('data-presentation-phase') === 'player-ready' &&
        await arena.getAttribute('data-engine-phase') === 'player' &&
        !await page.locator('[data-card-zone="hand"][aria-pressed="true"]').count() &&
        await page.getByTestId('button-next-round').isEnabled().catch(() => false)) {
      await expect(page.getByTestId('button-next-round')).toHaveText('End Turn');
      return true;
    }
    return false;
  }, { timeout: 90_000 }).toBe(true);
}

async function waitForFinalResult(page: Page) {
  await expect.poll(async () => {
    if (await page.getByTestId('battle-result-screen').isVisible().catch(() => false)) return true;
    const arena = page.getByTestId('battle-arena');
    const archive = page.getByTestId('button-archive-match');
    if (await arena.isVisible().catch(() => false) &&
        await arena.getAttribute('data-engine-phase') === 'complete' &&
        await archive.isVisible().catch(() => false) &&
        await archive.isEnabled().catch(() => false)) {
      await clickVisible(archive);
      return false;
    }
    await serviceBattleHold(page);
    return false;
  }, { timeout: 90_000 }).toBe(true);
}

async function waitForRoundAdvance(page: Page, expectedRound: number) {
  await expect.poll(async () => {
    if (await currentRound(page) === expectedRound) return true;
    await serviceBattleHold(page);
    return false;
  }, { timeout: 90_000 }).toBe(true);
}

async function attach(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' });
}

async function openBattleBreakdown(page: Page) {
  await page.getByTestId('battle-result-screen').getByRole('button', { name: 'Details', exact: true }).click();
  const details = page.getByRole('dialog', { name: 'Match details' });
  await expect(details).toBeVisible();
  const breakdown = details.locator('details.result-stage__crew-details');
  await breakdown.locator('summary').click();
  await expect(breakdown).toHaveAttribute('open', '');
  await expect(breakdown.getByText('Your captain')).toBeVisible();
  return details;
}

test('saved Rookie practice keeps result, board and card readable after a late receipt until explicit exit', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const api = await installApi(page);
  await page.goto('/squabblemon/sign-up');
  await page.getByRole('button', { name: 'Create disposable test account' }).click();
  await expect(page.getByTestId('rookie-reward-primer')).toBeVisible({ timeout: 30_000 });
  const primerVoice = page.getByRole('dialog').getByRole('button', { name: 'Keep going' });
  if (await primerVoice.isVisible().catch(() => false)) await primerVoice.click();
  await page.getByTestId('button-practice-another-fade').click();
  await expect(page.getByTestId('rookie-practice-brief')).toContainText('No win is required');
  await page.getByTestId('button-start-practice-fade').click();
  await expect(page.getByTestId('battle-arena')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('turn-timer')).toHaveCount(0);
  await readyToEndTurn(page, 1);
  await attach(page, testInfo, 'rookie-practice-board');
  for (let round = 1; round <= 6; round += 1) {
    await readyToEndTurn(page, round);
    await page.getByTestId('button-next-round').click();
    if (round < 6) await waitForRoundAdvance(page, round + 1);
  }
  await waitForFinalResult(page);
  await expect.poll(api.count, { timeout: 90_000 }).toBe(1);
  const firstDetails = await openBattleBreakdown(page);
  await attach(page, testInfo, 'rookie-practice-result');
  await firstDetails.getByRole('button', { name: 'Close match details' }).click();
  expect(api.moves().filter(move => move.endTurn)).toHaveLength(6);
  await expect(page.getByTestId('rookie-lesson-complete')).toHaveCount(0);
  await page.getByTestId('button-inspect-final-board').click();
  const board = page.getByTestId('final-board-review');
  await expect(board).toBeVisible();
  const card = page.locator('[data-card-zone="board"]').first();
  await expect(card).toBeVisible();
  await card.click({ button: 'right' });
  await expect(page.getByRole('dialog', { name: /battle details/ })).toBeVisible();
  api.release();
  await expect.poll(api.tested).toBe(true);
  // The real completion mutation refreshes the mounted bootstrap query cache.
  // Survive the old automatic transition timeout while a card is being read.
  await page.waitForTimeout(3500);
  await expect(page.getByRole('dialog', { name: /battle details/ })).toBeVisible();
  await expect(board).toBeVisible();
  await expect(page.getByTestId('claims-live')).toBeVisible();
  await expect(page.getByTestId('rookie-lesson-complete')).toHaveCount(0);
  await page.getByTestId('button-close-inspector').click();
  await page.getByRole('button', { name: 'View result' }).click();
  await expect(page.getByTestId('battle-result-screen')).toBeVisible();
  await expect(page.getByText('Saving battle earnings…')).toHaveCount(0);
  await expect(page.getByTestId('status-match-result')).toBeVisible();
  const savedDetails = await openBattleBreakdown(page);
  await expect(savedDetails.getByText('Dr. Fade · Next time')).toBeVisible();
  await savedDetails.getByRole('button', { name: 'Close match details' }).click();
  await page.getByTestId('button-inspect-final-board').click();
  await expect(board).toBeVisible();
  await page.getByRole('button', { name: 'View result' }).click();
  await expect(page.getByTestId('battle-result-screen')).toBeVisible();
  expect(api.count(), 'Viewing results and board must not submit the receipt twice').toBe(1);
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(page.getByTestId('rookie-lesson-complete')).toBeVisible();
  await attach(page, testInfo, 'rookie-practice-lesson-complete');
  expect(api.count()).toBe(1);
});