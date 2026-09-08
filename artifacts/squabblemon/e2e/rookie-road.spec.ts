import { expect, test, type Page } from '@playwright/test';
import type { MatchCompletion, PlayerBootstrap } from '@workspace/api-client-react';
import { createAbilityUpgradeSnapshot } from '@workspace/squabblemon-engine/abilityUpgrades';
import { decks } from '@workspace/squabblemon-engine/data';

type Step = 'profile' | 'tutorial' | 'crew' | 'reward' | 'complete';
const tutorialUpgradeSnapshot = createAbilityUpgradeSnapshot(
  decks.find((deck) => deck.id === 'vibes')!.cards,
  decks.find((deck) => deck.id === 'combo')!.cards,
);

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
      cardProgression: {},
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

async function installAccountApi(page: Page, initialStep: Step = 'profile') {
  let step: Step = initialStep;
  let missionClaimed = false;
  let rewardClaims = 0;
  let bootstrapRequests = 0;

  await page.route('**/api/player/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'GET' && url.pathname.endsWith('/bootstrap')) {
      bootstrapRequests += 1;
      return route.fulfill({ json: bootstrap(step, missionClaimed) });
    }
    if (request.method() === 'GET' && url.pathname.endsWith('/story')) {
      return route.fulfill({ status: 503, json: { message: 'Map unavailable in journey fixture' } });
    }
    if (request.method() === 'POST' && url.pathname.endsWith('/onboarding')) {
      const action = request.postDataJSON().action;
      if (action === 'accept-terms') step = 'tutorial';
      if (action === 'choose-starter') step = 'reward';
      if (action === 'claim-reward') { step = 'complete'; rewardClaims += 1; }
      return route.fulfill({ json: bootstrap(step, missionClaimed) });
    }
    if (request.method() === 'POST' && url.pathname.endsWith('/matches')) {
      const requestedMatch = request.postDataJSON() as {
        mode: 'practice' | 'tutorial' | 'story';
        playerDeckId: string;
        rivalDeckId: string;
      };
      const playerDeck = decks.find((deck) => deck.id === requestedMatch.playerDeckId) ?? decks[0];
      const rivalDeck = decks.find((deck) => deck.id === requestedMatch.rivalDeckId) ?? decks[1];
      return route.fulfill({ json: {
        id: 'e2e-match',
        mode: requestedMatch.mode,
        playerDeckId: playerDeck.id,
        rivalDeckId: rivalDeck.id,
        storyNodeId: null,
        contentVersion: null,
        encounterSnapshot: null,
        abilityUpgradeSnapshot: createAbilityUpgradeSnapshot(playerDeck.cards, rivalDeck.cards),
        status: 'active',
        createdAt: new Date(0).toISOString(),
      } });
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
    bootstrapRequests: () => bootstrapRequests,
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
  await expect(page.getByRole('button', { name: 'Tutorial Complete · Choose Your Crew' })).toBeVisible();
  await page.getByRole('button', { name: 'Tutorial Complete · Choose Your Crew' }).click();
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
  await expect(page.getByRole('heading', { name: 'ROOKIE' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Street Story' })).toBeVisible();
  const requestsBeforeFight = api.bootstrapRequests();
  await page.getByRole('button', { name: 'Fight' }).click();
  await expect(page).toHaveURL(/\/squabblemon\/game\/play/);
  await expect(page.getByRole('heading', { name: 'THE BLOCK IS HOT' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Training' })).toBeVisible();
  expect(api.bootstrapRequests()).toBe(requestsBeforeFight);
  await page.getByRole('button', { name: 'Start Training' }).click();
  await expect(page.getByTestId('motion-player')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('hand-tray')).toBeVisible();
  await expect(page.getByTestId('button-next-round')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'THE TOWN' })).toBeVisible();
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
  await expect(page.getByText('Block Offline', { exact: true })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Play Offline Practice' }).click();
  await expect(page).toHaveURL(/\/squabblemon\/play\/guest/);
  await expect(page.getByRole('button', { name: 'Start Training' })).toBeVisible();
  await expect(page.getByText('Offline training — rewards are unsaved')).toBeVisible();
});

test('direct game links render and sign-in returns players to their intended destination', async ({ page }) => {
  await installAccountApi(page, 'complete');

  await page.goto('/squabblemon/game/play');
  await expect(page).toHaveURL(/\/squabblemon\/sign-in/);
  await page.goto('/squabblemon/sign-up');
  await page.getByRole('button', { name: 'Create disposable test account' }).click();
  await expect(page).toHaveURL(/\/squabblemon\/game\/play/);
  await expect(page.getByRole('button', { name: 'Start Training' })).toBeVisible();

  await page.goto('/squabblemon/game/onboarding/');
  await expect(page).toHaveURL(/\/squabblemon\/game\/?$/);
  await expect(page.getByRole('heading', { name: 'ROOKIE' })).toBeVisible();

  await page.goto('/squabblemon/game');
  await expect(page.getByRole('heading', { name: 'ROOKIE' })).toBeVisible();

  const destinations = [
    ['/squabblemon/game/collection', 'Collection'],
    ['/squabblemon/game/decks', 'Decks'],
    ['/squabblemon/game/missions', 'Missions'],
    ['/squabblemon/game/shop', 'Street Shop'],
    ['/squabblemon/game/settings', 'Settings'],
  ] as const;

  for (const [path, heading] of destinations) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  }

  await page.goto('/squabblemon/game/story');
  await expect(page.getByText('Mapping territory...')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Could not load the street' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'Retry Map' })).toBeVisible();
});