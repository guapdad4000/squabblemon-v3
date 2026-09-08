import { expect, test, type Page } from '@playwright/test';
import type { MatchCompletion, PlayerBootstrap } from '@workspace/api-client-react';

type Step = 'profile' | 'tutorial' | 'crew' | 'reward' | 'complete';

function bootstrap(step: Step, claimed = false): PlayerBootstrap {
  const complete = step === 'complete';
  return {
    profile: {
      id: 'e2e-rookie',
      displayName: 'ROOKIE',
      avatarKey: 'rookie',
      onboardingStep: step,
      starterDeckId: step === 'profile' || step === 'tutorial' ? null : 'block',
      streetRep: complete ? 5 : 0,
      xp: complete ? 100 : 0,
      level: 1,
      softCurrency: complete ? (claimed ? 350 : 250) : 0,
      packTickets: complete ? 1 : 0,
      styleShards: 0,
      packPity: 0,
      deckSlots: 3,
      cosmeticCurrency: 0,
      collectionProgress: 0,
      storyChapter: 1,
      storyNode: 0,
      tutorialCompleted: step !== 'profile' && step !== 'tutorial',
      starterRewardClaimed: complete,
      ageConfirmedAt: step === 'profile' ? null : '2026-09-08T00:00:00.000Z',
      termsAcceptedAt: step === 'profile' ? null : '2026-09-08T00:00:00.000Z',
      settings: { reducedMotion: true, turnTimerEnabled: false },
      ownedCardIds: ['rastamon', 'officer-oink', 'big-g', 'plug', 'yardie', 'mandem'],
      discoveredCardIds: [],
      ownedVariants: [],
      equippedVariants: {},
      unlockedCosmeticIds: [],
      savedDecks: [],
      storyProgress: {},
      inbox: [],
      packHistory: [],
      lastActiveAt: '2026-09-08T00:00:00.000Z',
    },
    missions: [{
      id: 'rookie-road', title: 'Rookie Road', description: 'Finish your first session',
      cadence: 'onboarding', progress: complete ? 1 : 0, goal: 1,
      status: claimed ? 'claimed' : complete ? 'claimable' : 'active',
      rewardAmount: 100, rewardCurrency: 'softCurrency', resetAt: null,
    }],
    nextAction: {
      id: complete ? 'enter-story' : `onboarding-${step}`,
      eyebrow: complete ? 'Chapter One' : 'Rookie Road',
      title: complete ? 'Enter the story' : 'Finish setup',
      description: complete ? 'Your crew is ready.' : 'Complete the next Rookie Road step.',
      destination: complete ? 'story' : 'onboarding',
      rewardLabel: null,
    },
    packConfig: {
      id: 'street-pack',
      name: 'Street Pack',
      oddsVersion: 'e2e-v1',
      softCurrencyCost: 500,
      ticketCost: 1,
      rewardsPerPack: 3,
      pityLimit: 10,
      odds: [],
    },
    collectionRoad: [],
  };
}

async function installAccountApi(page: Page) {
  let step: Step = 'profile';
  let missionClaimed = false;
  let rewardClaims = 0;

  await page.route('**/api/player/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'GET' && url.pathname.endsWith('/bootstrap')) {
      return route.fulfill({ json: bootstrap(step, missionClaimed) });
    }
    if (request.method() === 'POST' && url.pathname.endsWith('/onboarding')) {
      const action = request.postDataJSON().action;
      if (action === 'accept-terms') step = 'tutorial';
      if (action === 'choose-starter') step = 'reward';
      if (action === 'claim-reward') { step = 'complete'; rewardClaims += 1; }
      return route.fulfill({ json: bootstrap(step, missionClaimed) });
    }
    if (request.method() === 'POST' && url.pathname.endsWith('/matches')) {
      return route.fulfill({ json: { id: 'e2e-match' } });
    }
    if (request.method() === 'POST' && url.pathname.endsWith('/matches/e2e-match/complete')) {
      step = 'crew';
      const current = bootstrap(step, missionClaimed);
      const completion = {
        profile: current.profile,
        missions: current.missions,
        nextAction: current.nextAction,
        reward: {
          id: 'tutorial-complete',
          label: 'Tutorial complete',
          xp: 0,
          streetRep: 0,
          softCurrency: 0,
          packTickets: 0,
          descriptions: [],
          storyRewards: [],
        },
        alreadyCompleted: false,
        campaign: null,
        story: null,
      } satisfies MatchCompletion;
      return route.fulfill({
        json: completion,
      });
    }
    if (request.method() === 'POST' && url.pathname.includes('/missions/')) {
      missionClaimed = true;
      return route.fulfill({ json: bootstrap(step, missionClaimed) });
    }
    return route.fulfill({ status: 200, json: {} });
  });

  return {
    resetAccount: () => { step = 'profile'; missionClaimed = false; },
    rewardClaims: () => rewardClaims,
  };
}

test('Rookie Road survives refreshes, claims once, and clears account cache on sign-out', async ({ page }) => {
  const api = await installAccountApi(page);
  await page.goto('/squabblemon');
  await expect(page).toHaveURL(/\/squabblemon\/?$/);
  await page.getByRole('link', { name: 'Sign Up' }).click();
  await page.getByRole('button', { name: 'Create disposable test account' }).click();
  await expect(page.getByText('Create Profile')).toBeVisible();

  await page.getByLabel('Display Name').fill('ROOKIE');
  await page.getByLabel('I am at least 13 years old.').check();
  await page.getByLabel('I accept the Terms of Service.').check();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByRole('button', { name: 'Start Tutorial' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Start Tutorial' })).toBeVisible();

  await page.getByRole('button', { name: 'Start Tutorial' }).click();
  await page.getByRole('button', { name: 'Complete guided test match' }).click();
  await expect(page.getByText('Pick Your Crew')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Pick Your Crew')).toBeVisible();
  await page.getByRole('button', { name: /^Claim / }).click();
  await expect(page.getByText('Welcome to the Streets')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Welcome to the Streets')).toBeVisible();
  await page.getByRole('button', { name: 'Claim Rewards' }).click();
  await expect(page).toHaveURL(/\/squabblemon\/game\/story/);
  expect(api.rewardClaims()).toBe(1);
  await page.goto('/squabblemon/game');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Corner' })).toBeVisible();
  expect(api.rewardClaims()).toBe(1);

  await page.goto('/squabblemon/game/missions');
  await page.getByRole('button', { name: 'Claim Reward' }).click();
  await expect(page.getByText('Claimed')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Claimed')).toBeVisible();

  await page.goto('/squabblemon/game/settings');
  await page.getByRole('button', { name: 'Sign Out' }).click();
  await expect(page.getByRole('link', { name: 'Sign Up' })).toBeVisible();
  api.resetAccount();
  await page.evaluate(() => localStorage.setItem('squabblemon_e2e_user', 'signed-in'));
  await page.goto('/squabblemon/game');
  await expect(page.getByText('Create Profile')).toBeVisible();
});

test('account API outage offers guest practice and labels rewards as unsaved', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('squabblemon_e2e_user', 'signed-in'));
  await page.route('**/api/player/bootstrap', (route) => route.abort('failed'));
  await page.goto('/squabblemon/game');
  await expect(page.getByText('Offline', { exact: true })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Play Offline Practice' }).click();
  await expect(page).toHaveURL(/\/squabblemon\/play\/guest/);
  await expect(page.getByRole('button', { name: 'Enter the streets' })).toBeVisible();
  await expect(page.getByText('Offline practice — rewards are unsaved')).toBeVisible();
});