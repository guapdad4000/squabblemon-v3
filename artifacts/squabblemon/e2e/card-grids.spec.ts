import { expect, test, type Locator, type Page } from '@playwright/test';
import type { PlayerBootstrap } from '@workspace/api-client-react';

const cardIds = ['rastamon', 'officer-oink', 'big-g', 'plug', 'yardie', 'mandem', 'cornball'];

function bootstrap(): PlayerBootstrap {
  return {
    profile: {
      id: 'e2e-card-grids',
      displayName: 'GRID TESTER',
      avatarKey: 'rookie',
      onboardingStep: 'complete',
      starterDeckId: 'block',
      streetRep: 5,
      xp: 100,
      level: 1,
      softCurrency: 250,
      packTickets: 1,
      styleShards: 0,
      packPity: 0,
      deckSlots: 3,
      cosmeticCurrency: 0,
      collectionProgress: 0,
      storyChapter: 1,
      storyNode: 0,
      tutorialCompleted: true,
      starterRewardClaimed: true,
      ageConfirmedAt: '2026-09-08T00:00:00.000Z',
      termsAcceptedAt: '2026-09-08T00:00:00.000Z',
      settings: { reducedMotion: true, turnTimerEnabled: false },
      ownedCardIds: cardIds,
      discoveredCardIds: [],
      ownedVariants: [],
      equippedVariants: {},
      unlockedCosmeticIds: [],
      savedDecks: [{
        id: 'grid-deck',
        name: 'Grid Crew',
        cardIds,
        heroCardId: 'rastamon',
        recipeId: null,
      }],
      cardProgression: {},
      storyProgress: {},
      inbox: [],
      packHistory: [],
      lastActiveAt: '2026-09-08T00:00:00.000Z',
    },
    missions: [],
    nextAction: {
      id: 'enter-story',
      eyebrow: 'Chapter One',
      title: 'Enter the story',
      description: 'Your crew is ready.',
      destination: 'story',
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
  } as PlayerBootstrap;
}

async function enterAuthenticatedGame(page: Page) {
  await page.addInitScript(() => localStorage.setItem('squabblemon_e2e_user', 'signed-in'));
  await page.route('**/api/player/bootstrap', route => route.fulfill({ json: bootstrap() }));
}

async function expectCardsFillCells(grid: Locator) {
  const cards = grid.locator('[data-card-id]');
  await expect(cards.first()).toBeVisible();
  const measurements = await cards.evaluateAll(elements => elements.slice(0, 8).map(card => {
    const cell = card.parentElement;
    return {
      cardWidth: card.getBoundingClientRect().width,
      cellWidth: cell?.getBoundingClientRect().width ?? 0,
    };
  }));
  expect(measurements.length).toBeGreaterThan(0);
  for (const { cardWidth, cellWidth } of measurements) {
    expect(cardWidth).toBeGreaterThan(70);
    expect(Math.abs(cardWidth - cellWidth)).toBeLessThanOrEqual(1);
  }
}

async function expectSingleFocusTarget(controls: Locator) {
  await expect(controls.first()).toBeVisible();
  for (const control of await controls.all()) {
    await expect(control.locator('button')).toHaveCount(0);
    expect(await control.locator('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])').count()).toBe(0);
  }
}

for (const viewport of [
  { name: 'compact iPad portrait', width: 768, height: 1024 },
  { name: 'compact iPad landscape', width: 1024, height: 768 },
]) {
  test(`${viewport.name} card grids fill their cells without duplicate focus targets`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await enterAuthenticatedGame(page);

    await page.goto('/squabblemon/game/collection');
    await expectCardsFillCells(page.getByTestId('collection-card-grid'));
    await expectSingleFocusTarget(page.getByTestId('collection-card-control'));

    await page.goto('/squabblemon/game/decks/grid-deck');
    await expectCardsFillCells(page.getByTestId('deck-roster-grid'));
    await expectCardsFillCells(page.getByTestId('deck-collection-grid'));
    await expectSingleFocusTarget(page.getByTestId('deck-card-control'));

    await page.goto('/squabblemon/game/decks');
    await expectSingleFocusTarget(page.getByTestId('deck-archive-control'));
  });
}