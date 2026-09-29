import { expect, test, type Page } from '@playwright/test';
import type { MatchCompletion, PlayerBootstrap } from '@workspace/api-client-react';
import { createAbilityUpgradeSnapshot } from '@workspace/squabblemon-engine/abilityUpgrades';
import { rookieDistricts, rookieEncounter } from '@workspace/squabblemon-engine/rookie';
import { completedTutorialMilestones, getTutorialMilestones } from '../../api-server/src/lib/tutorialMilestones';
import { ROOKIE_DECK_ID, ROOKIE_FOUNDATION_ID, ROOKIE_FOUNDATION_IDS, ROOKIE_MENTOR_CORE_IDS, catalogIdsToEngineIds } from '../src/data';
import { getMatchWinner, verifyStoryMatchTranscript, type TranscriptMove } from '../src/gameEngine';

const encounter = rookieEncounter();
const districts = rookieDistricts();

type JourneyStep = 'tutorial' | 'reward' | 'complete';

function playerBootstrap(step: JourneyStep, savedCards = ROOKIE_MENTOR_CORE_IDS): PlayerBootstrap {
  const completed = step !== 'tutorial';
  const claimed = step === 'complete';
  const savedDeck = {
    id: ROOKIE_DECK_ID,
    name: 'My First Gang',
    cardIds: [...savedCards],
    heroCardId: savedCards.includes('dr-fade') ? 'dr-fade' : savedCards[0],
    recipeId: null,
    valid: true,
    issues: [],
  };
  return {
    profile: {
      id: 'e2e-guided-rookie',
      displayName: 'ROOKIE',
      avatarKey: 'rookie',
      onboardingStep: step,
      starterDeckId: ROOKIE_FOUNDATION_ID,
      streetRep: 0,
      xp: 0,
      level: 1,
      softCurrency: claimed ? 250 : 0,
      packTickets: claimed ? 1 : 0,
      styleShards: 0,
      packPity: 0,
      deckSlots: 3,
      cosmeticCurrency: 0,
      collectionProgress: ROOKIE_FOUNDATION_IDS.length,
      storyChapter: 1,
      storyNode: 0,
      tutorialCompleted: completed,
      starterRewardClaimed: claimed,
      ageConfirmedAt: '2026-09-08T00:00:00.000Z',
      termsAcceptedAt: '2026-09-08T00:00:00.000Z',
      settings: { reducedMotion: true, turnTimerEnabled: false },
      ownedCardIds: [...ROOKIE_FOUNDATION_IDS],
      discoveredCardIds: [...ROOKIE_FOUNDATION_IDS],
      ownedVariants: [],
      equippedVariants: {},
      cardProgression: {},
      unlockedCosmeticIds: [],
      unlockedCharacterIds: [],
      savedDecks: [savedDeck],
      storyProgress: {},
      inbox: [],
      packHistory: [],
      lastActiveAt: '2026-09-08T00:00:00.000Z',
    },
    missions: [{
      id: 'rookie-road',
      title: 'Rookie Road',
      description: 'Finish your first session',
      cadence: 'onboarding',
      progress: completed ? 1 : 0,
      goal: 1,
      status: completed ? 'claimable' : 'active',
      rewardAmount: 100,
      rewardCurrency: 'softCurrency',
      resetAt: null,
    }],
    nextAction: {
      id: step === 'complete' ? 'enter-story' : `onboarding-${step}`,
      eyebrow: step === 'complete' ? 'Chapter One' : 'Rookie Road',
      title: step === 'complete' ? 'Enter the story' : 'Finish setup',
      description: step === 'complete' ? 'Your gang is ready.' : 'Complete the next Rookie Road step.',
      destination: step === 'complete' ? 'story' : 'onboarding',
      rewardLabel: null,
    },
    packConfig: {
      id: 'street-pack',
      name: 'Street Pack',
      oddsVersion: 'e2e-guided-v1',
      softCurrencyCost: 500,
      ticketCost: 1,
      rewardsPerPack: 3,
      pityLimit: 10,
      odds: [],
    },
    tenPullConfig: {
      id: 'e2e-ten-pull',
      name: 'Practice Ten Pull',
      oddsVersion: 'e2e-guided-v1',
      pullCount: 10,
      ticketCost: 9,
      softCurrencyCost: 1800,
      rewardsPerPull: 3,
      rarePityBonusPerPull: 1,
    },
    collectionRoad: [],
  };
}

type MatchRequest = {
  mode: 'practice' | 'tutorial' | 'story';
  playerDeckId: string;
  rivalDeckId: string;
};

async function installDisposableAccountApi(page: Page) {
  let step: JourneyStep = 'tutorial';
  let deckCards = [...ROOKIE_MENTOR_CORE_IDS];
  let verifiedMatchId: string | null = null;
  let startRequest: MatchRequest | null = null;
  let completion: MatchCompletion | null = null;
  let rejectedTranscript: string | null = null;
  let movesReceived: TranscriptMove[] = [];

  const bootstrap = () => playerBootstrap(step, deckCards);
  await page.route('**/api/player/**', async route => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === 'GET' && url.pathname.endsWith('/bootstrap')) {
      return route.fulfill({ json: bootstrap() });
    }

    if (request.method() === 'PUT' && /\/decks\/[^/]+$/.test(url.pathname)) {
      const body = request.postDataJSON() as { cardIds: string[] };
      deckCards = [...body.cardIds];
      return route.fulfill({ json: bootstrap() });
    }

    if (request.method() === 'POST' && url.pathname.endsWith('/matches')) {
      startRequest = request.postDataJSON() as MatchRequest;
      if (startRequest.mode !== 'tutorial' || startRequest.playerDeckId !== ROOKIE_DECK_ID) {
        return route.fulfill({ status: 400, json: { error: 'This journey expects the saved Rookie Road deck.' } });
      }
      const playerCards = catalogIdsToEngineIds(deckCards);
      const matchUpgrades = createAbilityUpgradeSnapshot(playerCards, encounter.enemy.cardIds);
      verifiedMatchId = 'server-issued-rookie-road-v2-match';
      return route.fulfill({
        status: 201,
        json: {
          id: verifiedMatchId,
          mode: 'tutorial',
          playerDeckId: ROOKIE_DECK_ID,
          rivalDeckId: encounter.enemy.deckId,
          storyNodeId: null,
          contentVersion: null,
          encounterSnapshot: encounter,
          abilityUpgradeSnapshot: matchUpgrades,
          districtSnapshot: districts,
          status: 'active',
          createdAt: '2026-09-08T00:00:00.000Z',
        },
      });
    }

    const completeMatch = url.pathname.match(/\/matches\/([^/]+)\/complete$/);
    if (request.method() === 'POST' && completeMatch) {
      const body = request.postDataJSON() as { moves: TranscriptMove[] };
      movesReceived = body.moves;
      if (!verifiedMatchId || completeMatch[1] !== verifiedMatchId) {
        rejectedTranscript = 'The completion request did not reference the issued match.';
        return route.fulfill({ status: 404, json: { error: rejectedTranscript } });
      }

      try {
        const playerCards = catalogIdsToEngineIds(deckCards);
        const matchUpgrades = createAbilityUpgradeSnapshot(playerCards, encounter.enemy.cardIds);
        const verified = verifyStoryMatchTranscript(
          encounter,
          playerCards,
          body.moves,
          ROOKIE_DECK_ID,
          matchUpgrades,
          districts,
        );
        const milestones = getTutorialMilestones(verified);
        if (!completedTutorialMilestones(milestones)) {
          throw new Error(`Guided tutorial milestones missing: ${JSON.stringify(milestones)}`);
        }
        if (verified.round !== 4 || getMatchWinner(verified) !== 'player') {
          throw new Error(`Expected a verified four-round rookie win; got round ${verified.round}, winner ${getMatchWinner(verified)}.`);
        }

        step = 'reward';
        const current = bootstrap();
        completion = {
          profile: current.profile,
          missions: current.missions,
          nextAction: current.nextAction,
          reward: {
            id: 'rookie-road-tutorial',
            label: 'Tutorial complete',
            xp: 0,
            streetRep: 0,
            softCurrency: 0,
            packTickets: 0,
            descriptions: ['Your first guided fade is verified.'],
            storyRewards: [],
            cardXp: [],
          },
          alreadyCompleted: false,
          campaign: null,
          story: null,
        };
        return route.fulfill({ json: completion });
      } catch (error) {
        rejectedTranscript = error instanceof Error ? error.message : String(error);
        return route.fulfill({ status: 400, json: { error: rejectedTranscript } });
      }
    }

    if (request.method() === 'POST' && url.pathname.endsWith('/onboarding')) {
      const { action } = request.postDataJSON() as { action: string };
      if (action === 'complete-tutorial') {
        if (!completion) return route.fulfill({ status: 409, json: { error: 'A verified Rookie Road match is required.' } });
        step = 'reward';
      } else if (action === 'claim-reward') {
        if (step !== 'reward') return route.fulfill({ status: 409, json: { error: 'Finish the first session before claiming the reward.' } });
        step = 'complete';
      } else {
        return route.fulfill({ status: 400, json: { error: `Unexpected onboarding action: ${action}` } });
      }
      return route.fulfill({ json: bootstrap() });
    }

    return route.fulfill({
      status: 404,
      json: { error: `Unmocked player API request: ${request.method()} ${url.pathname}` },
    });
  });

  return {
    startRequest: () => startRequest,
    completion: () => completion,
    rejectedTranscript: () => rejectedTranscript,
    movesReceived: () => movesReceived,
    onboardingStep: () => step,
  };
}

async function clickCurrentCoachTarget(page: Page) {
  const spotlight = page.getByTestId('fade-spotlight');
  await expect(spotlight).toBeVisible();
  const selector = await spotlight.getAttribute('data-coach-target');
  expect(selector, 'Dr. Fade should point at a real in-game control').toBeTruthy();
  await expect(page.locator(selector!)).toBeVisible();
  await page.locator(selector!).click();
}

async function waitForDecisionOrResult(page: Page) {
  await expect.poll(async () => {
    const firstSighting = page.getByRole('button', { name: 'Back to the battle' });
    if (await firstSighting.isVisible().catch(() => false)) {
      // The modal unmounts during its click. Do not wait indefinitely for an
      // element that no longer exists while the presentation advances.
      await firstSighting.click({ noWaitAfter: true, timeout: 3000 }).catch(async error => {
        if (await firstSighting.isVisible().catch(() => false)) throw error;
      });
      return 'transitioning';
    }
    if (await page.getByTestId('button-complete-tutorial').isVisible().catch(() => false)) return 'result';
    const arena = page.getByTestId('battle-arena');
    if (await arena.isVisible().catch(() => false) && await arena.getAttribute('data-presentation-phase') === 'player-ready') return 'decision';
    return 'transitioning';
  }, { timeout: 90_000 }).not.toBe('transitioning');
}

test('real Rookie Road route issues and verifies the guided four-round fade', async ({ page }) => {
  test.setTimeout(180_000);
  const api = await installDisposableAccountApi(page);

  await page.goto('/squabblemon/sign-up');
  await page.getByRole('button', { name: 'Create disposable test account' }).click();
  await expect(page.getByTestId('dr-fade-welcome')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Build with Dr. Fade' }).click();
  await expect(page.getByTestId('deck-roster-grid')).toBeVisible();

  // Follow the real four-step deck lesson: choose a slot, plan a recruit,
  // confirm the swap, then save the lineup for the actual guided fade.
  for (let step = 0; step < 4; step += 1) await clickCurrentCoachTarget(page);
  await expect(page.getByTestId('rookie-fight-brief')).toBeVisible();
  await page.getByTestId('button-start-guided-fight').click();

  await expect.poll(() => api.startRequest()).toMatchObject({
    mode: 'tutorial',
    playerDeckId: ROOKIE_DECK_ID,
  });
  await expect(page.getByTestId('battle-arena')).toBeVisible();
  await waitForDecisionOrResult(page);

  // Rules/help is a real control during the coached turn, not a harness modal.
  await page.locator('details.battle-tools > summary').click();
  await page.getByTestId('button-rules-battle').click();
  const rules = page.getByRole('dialog');
  await expect(rules.getByRole('heading', { name: 'Know the streets.' })).toBeVisible();
  await expect(rules.getByText(/claim at least two of the three/i)).toBeVisible();
  await page.getByTestId('button-rules-modal').click();
  await page.locator('details.battle-tools > summary').click();

  const committedActions: string[] = [];
  for (let actionIndex = 0; actionIndex < 20; actionIndex += 1) {
    const completionButton = page.getByTestId('button-complete-tutorial');
    await waitForDecisionOrResult(page);
    if (await completionButton.isVisible().catch(() => false)) break;

    const arena = page.getByTestId('battle-arena');
    const focus = await arena.getAttribute('data-tutorial-focus');
    const stepMarker = page.locator('[data-testid^="tutorial-step-"]');
    const stepId = await stepMarker.getAttribute('data-testid');
    expect(stepId, 'The real tutorial step marker should identify each coached action').toBeTruthy();
    expect(['card', 'district', 'play', 'squabble', 'end-turn', 'free']).toContain(focus);

    if (focus === 'card' || focus === 'district') {
      await clickCurrentCoachTarget(page);
    } else if (focus === 'squabble') {
      await page.getByTestId('button-squabble').click();
    } else if (focus === 'play') {
      await expect(page.getByTestId('button-lock')).toBeEnabled();
      committedActions.push(stepId!);
      await page.getByTestId('button-lock').click();
    } else if (focus === 'end-turn') {
      await expect(page.getByTestId('button-next-round')).toBeEnabled();
      committedActions.push(stepId!);
      await page.getByTestId('button-next-round').click();
    } else {
      throw new Error(`Unexpected tutorial state before the four-round result: ${stepId}`);
    }
  }

  await expect(page.getByTestId('button-complete-tutorial')).toBeEnabled({ timeout: 90_000 });
  expect(api.rejectedTranscript(), 'The server-side transcript verifier must accept the actual clicks').toBeNull();
  expect(api.completion()).not.toBeNull();
  expect(api.movesReceived().filter(move => move.endTurn)).toHaveLength(4);
  expect(api.movesReceived().filter(move => !move.endTurn)).toHaveLength(3);
  expect(committedActions.filter(id => id?.endsWith('_play_card') || id?.endsWith('_play_squabble'))).toHaveLength(3);
  // The third round names its coached pass "bank Motion"; it still commits
  // through the real End Turn control and is verified as an endTurn move.
  expect(committedActions).toHaveLength(7);
  await expect(page.getByTestId('tutorial-final-debrief')).toContainText('Claims: You');
  const teachBack = page.getByTestId('rookie-teach-back');
  await teachBack.locator('summary').click();
  await expect(teachBack.locator('fieldset')).toHaveCount(5);
  // The questions check the goal, turn, score causality, end state and next step.
  for (const [index, choice] of [1, 1, 1, 0, 0].entries()) {
    await teachBack.locator('fieldset').nth(index).locator('input').nth(choice).check();
  }
  await expect(teachBack).toContainText('5 of 5 answered · 5 correct');

  await page.getByTestId('button-complete-tutorial').click();
  await expect(page.getByTestId('rookie-post-fight-handoff')).toBeVisible();
  await expect(page.getByTestId('rookie-post-fight-handoff')).toContainText('run a no-pressure practice fade, or head into Chapter One.');
  await page.getByRole('button', { name: 'See reward & next steps' }).click();
  await expect(page.getByTestId('rookie-reward-primer')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Keep going' }).click();
  await expect(page.getByTestId('rookie-reward-primer')).toContainText('no-pressure practice fade');
  await expect(page.getByTestId('button-practice-another-fade')).toBeVisible();
  await expect(page.getByTestId('button-claim-reward-enter-story')).toBeVisible();
  await page.getByTestId('button-practice-another-fade').click();
  await expect(page.getByTestId('rookie-practice-brief')).toContainText('No win is required');
  await expect(page.getByTestId('button-start-practice-fade')).toBeVisible();
  await page.getByRole('button', { name: 'Back to reward choices' }).click();
  await expect(page.getByTestId('rookie-reward-primer')).toBeVisible();
  await page.getByTestId('button-claim-reward-enter-story').click();
  await expect.poll(() => api.onboardingStep()).toBe('complete');
  await expect(page).toHaveURL(/\/game\/story(?:[/?#]|$)/);
});

test('coaching stays reachable by keyboard and does not cover targets in portrait or short landscape', async ({ page }) => {
  await page.goto('/squabblemon/e2e/rookie-road.fixture.html');
  const arena = page.getByTestId('battle-arena');
  await expect(arena).toBeVisible({ timeout: 30_000 });
  for (const size of [{ width: 350, height: 620 }, { width: 740, height: 360 }, { width: 1280, height: 760 }]) {
    await page.setViewportSize(size);
    await expect(page.getByTestId('fade-spotlight')).toBeVisible();
    const accessible = await page.locator('details.battle-tools > summary').evaluate(el => {
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return el === top || el.contains(top);
    });
    expect(accessible, `Battle menu must be clickable at ${size.width}×${size.height}`).toBe(true);
    await page.locator('details.battle-tools > summary').click();
    await expect(page.getByTestId('button-rules-battle')).toBeVisible();
    await page.locator('details.battle-tools > summary').click();
  }
  await page.getByTestId('card-plug').focus();
  await page.keyboard.press('Enter');
  await expect(arena).toHaveAttribute('data-tutorial-focus', 'district');
  await expect(page.getByRole('region', { name: 'Dr. Fade’s guide' })).toContainText('district');
  await expect(page.getByRole('button', { name: 'Reopen coach tip' }).or(page.getByRole('button', { name: 'Hide coach tip' }))).toBeVisible();
});