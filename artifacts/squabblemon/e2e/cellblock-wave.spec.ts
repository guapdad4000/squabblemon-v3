import { expect, test, type Locator, type Page } from '@playwright/test';
import type { PlayerBootstrap } from '@workspace/api-client-react';

const cards = [
  { id: 'inmate-crafty', name: 'Inmate Crafty', rarity: 'Uncommon' },
  { id: 'inmate-boyfriend', name: 'Inmate Boyfriend', rarity: 'Rare' },
  { id: 'inmate-informant', name: 'Inmate Informant', rarity: 'Rare' },
  { id: 'inmate-contraband', name: 'Inmate Contraband', rarity: 'Uncommon' },
  { id: 'lebron-james', name: 'Regular guy named LeBron James', rarity: 'Mythical' },
] as const;

function bootstrap(): PlayerBootstrap {
  const ownedCardIds = cards.map(card => card.id);
  return {
    profile: {
      id: 'e2e-cellblock-wave',
      displayName: 'CELLBLOCK REVIEWER',
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

async function expectLoadedPortrait(container: Locator, id: string) {
  const portrait = container.locator('img.collector-portrait');
  await expect(portrait).toBeVisible();
  await expect(portrait).toHaveAttribute('src', new RegExp(`/assets/characters/${id}\\.webp(?:\\?|$)`));
  await expect.poll(() => portrait.evaluate((image: HTMLImageElement) => ({
    complete: image.complete,
    width: image.naturalWidth,
    height: image.naturalHeight,
  }))).toMatchObject({ complete: true });
  const dimensions = await portrait.evaluate((image: HTMLImageElement) => [image.naturalWidth, image.naturalHeight]);
  expect(dimensions[0], `${id} should decode real artwork`).toBeGreaterThan(100);
  expect(dimensions[1], `${id} should decode real artwork`).toBeGreaterThan(100);
}

test('real Collection and detail inspectors map all five cellblock portraits and metadata', async ({ page }, testInfo) => {
  await authenticate(page);
  await page.goto('/squabblemon/game/collection');
  const search = page.getByPlaceholder('Find a card or ability…');

  for (const card of cards) {
    await search.fill(card.name);
    const control = page.getByTestId('collection-card-control').filter({
      has: page.locator(`[data-card-id="${card.id}"]`),
    });
    await expect(control).toHaveCount(1);
    await expectLoadedPortrait(control, card.id);
    await control.click();

    const inspector = page.getByRole('dialog', { name: `${card.name} card details` });
    await expect(inspector).toBeVisible();
    await expect(inspector.locator('h3.dossier-name')).toHaveText(card.name);
    await expect(inspector.getByText('Street Packs', { exact: true })).toBeVisible();
    await expect(inspector.getByText(card.rarity, { exact: true }).first()).toBeVisible();
    await expectLoadedPortrait(inspector.getByTestId('card-inspector'), card.id);
    if (card.id === 'lebron-james') {
      await expect(inspector.getByText('Mythical', { exact: true }).first()).toBeVisible();
      await expect(inspector).toContainText('fictional regular guy');
    }
    await page.getByTestId('button-close-inspector').click();
  }

  await search.fill('inmate');
  for (const card of cards.slice(0, 4)) {
    await expect(page.locator(`[data-card-id="${card.id}"]`)).toBeVisible();
  }
  await page.screenshot({
    path: `../../screenshots/cellblock-wave-gallery-${testInfo.project.name}.png`,
    fullPage: true,
  });

  await search.fill('LeBron James');
  await page.locator('[data-card-id="lebron-james"]').click();
  await page.screenshot({
    path: `../../screenshots/cellblock-wave-inspector-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test('all five cellblock cards enter a real Battle board and remain inspectable', async ({ page }, testInfo) => {
  await page.goto('/squabblemon/e2e/cellblock-wave.fixture.html');
  const lanes = [0, 0, 1, 1, 2];

  for (const [index, card] of cards.entries()) {
    await page.locator(`[data-card-zone="hand"][data-card-id="${card.id}"]`).click();
    await page.getByTestId(`lane-${lanes[index]}`).click();
    await page.getByTestId('button-lock').click();

    const played = page.getByTestId('battle-arena')
      .locator(`[data-card-zone="board"][data-card-id="${card.id}"]`);
    await expect(played).toHaveCount(1);
    await expectLoadedPortrait(played, card.id);
    await played.click();
    const inspector = page.getByRole('dialog', { name: `${card.name} battle details` });
    await expect(inspector).toBeVisible();
    await expect(inspector.getByText(card.rarity, { exact: true }).first()).toBeVisible();
    await expectLoadedPortrait(inspector.getByTestId('card-inspector'), card.id);
    await page.getByTestId('button-close-inspector').click();
  }

  await expect(page.getByTestId('cellblock-board-count')).toHaveAttribute('data-count', '5');
  await page.getByTestId('battle-arena')
    .locator('[data-card-zone="board"][data-card-id="lebron-james"]')
    .click();
  await page.screenshot({
    path: `../../screenshots/cellblock-wave-battle-${testInfo.project.name}.png`,
    fullPage: true,
  });
});