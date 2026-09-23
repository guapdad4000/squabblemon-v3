import { expect, test, type Locator, type Page } from '@playwright/test';
import type { PlayerBootstrap } from '@workspace/api-client-react';

const cards = [
  { catalogId: 'hair-stylist', engineId: 'hair-stylist', name: 'Hair Stylist', artId: 'hair-stylist' },
  { catalogId: 'stylist', engineId: 'stylist', name: 'Stylist', artId: 'stylist' },
  { catalogId: 'demario', engineId: 'demario', name: 'Demario', artId: 'demario' },
  { catalogId: 'luigion', engineId: 'luigion', name: 'Luigion', artId: 'luigion' },
  { catalogId: 'black-cowboy', engineId: 'black-cowboy', name: 'Black Cowboy', artId: 'black-cowboy' },
] as const;

function bootstrap(): PlayerBootstrap {
  const ownedCardIds = cards.map(card => card.catalogId);
  return {
    profile: {
      id: 'e2e-neighborhood-wave',
      displayName: 'ART REVIEWER',
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
      ownedCardIds,
      discoveredCardIds: ownedCardIds,
      ownedVariants: [],
      equippedVariants: {},
      unlockedCosmeticIds: [],
      savedDecks: [],
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
      description: 'Your gang is ready.',
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

async function authenticate(page: Page) {
  await page.addInitScript(() => localStorage.setItem('squabblemon_e2e_user', 'signed-in'));
  await page.route('**/api/player/bootstrap', route => route.fulfill({ json: bootstrap() }));
}

async function expectLoadedUserArt(card: Locator, artId: string) {
  const portrait = card.locator('img.collector-portrait');
  await expect(portrait).toBeVisible();
  await expect(portrait).toHaveAttribute('src', new RegExp(`/assets/characters/${artId}\\.webp(?:\\?|$)`));
  await expect.poll(() => portrait.evaluate((image: HTMLImageElement) => ({
    complete: image.complete,
    width: image.naturalWidth,
    height: image.naturalHeight,
  }))).toMatchObject({ complete: true });
  const dimensions = await portrait.evaluate((image: HTMLImageElement) => [image.naturalWidth, image.naturalHeight]);
  expect(dimensions[0], `${artId} should decode real artwork`).toBeGreaterThan(100);
  expect(dimensions[1], `${artId} should decode real artwork`).toBeGreaterThan(100);
}

test('real Collection cards and inspectors load all five neighborhood portraits', async ({ page }, testInfo) => {
  await authenticate(page);
  await page.goto('/squabblemon/game/collection');
  const search = page.getByPlaceholder('Find a card or ability…');

  for (const card of cards) {
    await search.fill(card.name);
    const control = page.getByTestId('collection-card-control').filter({ has: page.locator(`[data-card-id="${card.engineId}"]`) });
    await expect(control).toHaveCount(1);
    await expectLoadedUserArt(control, card.artId);
    await control.click();
    const inspector = page.getByRole('dialog', { name: `${card.name} card details` });
    await expect(inspector).toBeVisible();
    await expectLoadedUserArt(inspector.getByTestId('card-inspector'), card.artId);
    await page.getByTestId('button-close-inspector').click();
  }

  await search.fill('stylist');
  await expect(page.locator('[data-card-id="hair-stylist"]')).toBeVisible();
  await expect(page.locator('[data-card-id="stylist"]')).toBeVisible();
  await page.screenshot({
    path: `../../screenshots/neighborhood-wave-gallery-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.locator('[data-card-id="hair-stylist"]').click();
  await page.screenshot({
    path: `../../screenshots/neighborhood-wave-inspector-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test('Demario summons a Mushroom and Squabble transforms Luigion with authoritative art', async ({ page }, testInfo) => {
  await page.goto('/squabblemon/e2e/neighborhood-wave.fixture.html');

  await page.locator('[data-card-zone="hand"][data-card-id="demario"]').click();
  await page.getByTestId('lane-0').click();
  await page.getByTestId('button-lock').click();
  const mushroom = page.locator('[data-card-zone="board"][data-card-id="demario-mushroom"]');
  await expect(mushroom).toHaveCount(1);
  await expectLoadedUserArt(mushroom, 'demario-mushroom');

  await page.locator('[data-card-zone="hand"][data-card-id="luigion"]').click();
  await page.getByTestId('lane-0').click();
  await page.getByTestId('button-squabble').click();
  await page.getByTestId('button-lock').click();

  const powered = page.getByTestId('battle-arena').locator('[data-card-zone="board"][data-card-id="luigion-powered"]');
  await expect(powered).toHaveCount(1);
  await expectLoadedUserArt(powered, 'luigion-powered');
  await expect(mushroom).toHaveCount(0);
  await expect(page.getByTestId('neighborhood-wave-state')).toHaveAttribute('data-powered', 'true');
  await expect(page.getByTestId('neighborhood-wave-state')).toHaveAttribute('data-mushrooms', '0');
  await expect(page.getByTestId('neighborhood-wave-state')).toHaveAttribute('data-powered-hands', '7');

  const projected = page.getByTestId('online-powered-projection').locator('[data-card-id="luigion-powered"]');
  await expect(projected).toHaveCount(1);
  await expect(projected.locator('img.collector-portrait')).toHaveAttribute('src', /\/assets\/characters\/luigion-powered\.webp(?:\?|$)/);
  await expect(page.getByTestId('online-powered-projection')).toHaveAttribute('data-projected-name', 'Powered Luigion');
  await expect(page.getByTestId('online-powered-projection')).toHaveAttribute(
    'data-projected-effect',
    /Squabble doubled base Hands.*Consumes at most one friendly Demario Mushroom/,
  );
  await expect(projected).toContainText('Powered Luigion');

  await powered.click();
  const inspector = page.getByRole('dialog', { name: 'Powered Luigion battle details' });
  await expect(inspector).toBeVisible();
  await expect(inspector.getByText('Neighborhood Heroes faction')).toBeVisible();
  await expect(inspector.getByText('Rare', { exact: true }).first()).toBeVisible();
  await expectLoadedUserArt(inspector.getByTestId('card-inspector'), 'luigion-powered');
  await page.screenshot({
    path: `../../screenshots/neighborhood-wave-transformed-battle-${testInfo.project.name}.png`,
    fullPage: true,
  });
});