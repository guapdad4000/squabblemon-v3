import { expect, test, type Page } from '@playwright/test';
import type { PlayerBootstrap } from '@workspace/api-client-react';

const ownedIds = ['riptide-bruiser', 'monsoon-anchor'];

const profile = {
  id: 'collection-filter-e2e',
  displayName: 'COLLECTOR',
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
  ownedCardIds: ownedIds,
  discoveredCardIds: [],
  ownedVariants: [],
  equippedVariants: {},
  unlockedCosmeticIds: [],
  savedDecks: [],
  cardProgression: {},
  storyProgress: {},
  inbox: [],
  packHistory: [],
  lastActiveAt: '2026-09-08T00:00:00.000Z',
};

async function enterCollection(page: Page) {
  await page.addInitScript(() => localStorage.setItem('squabblemon_e2e_user', 'signed-in'));
  await page.route('**/api/player/bootstrap', route => route.fulfill({
    json: {
      profile,
      missions: [],
      nextAction: { id: 'enter-story', eyebrow: 'Chapter One', title: 'Enter the story', description: 'Your gang is ready.', destination: 'story', rewardLabel: null },
      packConfig: { id: 'street-pack', name: 'Street Pack', oddsVersion: 'e2e-v1', softCurrencyCost: 500, ticketCost: 1, rewardsPerPack: 3, pityLimit: 10, odds: [] },
      collectionRoad: [],
    } as PlayerBootstrap,
  }));
  await page.goto('/squabblemon/game/collection');
}

test('element and bond filters reveal owned and unowned cards without losing the unowned dossier', async ({ page }) => {
  await enterCollection(page);
  const grid = page.getByTestId('collection-card-grid');
  const cards = grid.getByTestId('collection-card-control');
  const element = page.getByRole('combobox', { name: 'Element' });
  const bond = page.getByRole('checkbox', { name: 'Bond carriers only' });
  const count = page.getByRole('status');

  await expect(element).toHaveValue('');
  await expect(bond).not.toBeChecked();
  await expect(grid.locator('[data-collection-discovery-card-id="canopy-keeper"]')).toHaveAttribute('data-collection-card-state', 'undiscovered');

  await element.selectOption('Water');
  await expect(cards).toHaveCount(20);
  await expect(count).toHaveText('20 cards');
  await expect(grid.locator('[data-collection-card-state="owned"]')).toHaveCount(2);
  await expect(grid.locator('[data-collection-card-state="locked"]')).toHaveCount(18);
  await expect(grid.locator('[data-collection-discovery-card-id="riptide-bruiser"]')).toHaveAttribute('aria-label', /Riptide Bruiser.*rarity/);
  await expect(grid.locator('[data-collection-discovery-card-id="monsoon-anchor"]')).toHaveAttribute('aria-label', /Monsoon Anchor.*Water bond carrier/);
  await expect(grid.locator('[data-collection-discovery-card-id="stillwater-medic"]')).toHaveAttribute('aria-label', /Stillwater Medic.*Not owned/);

  await bond.check();
  await expect(cards).toHaveCount(3);
  await expect(count).toHaveText('3 cards');
  await expect(grid.locator('[data-collection-card-state="owned"]')).toHaveCount(1);
  await expect(grid.locator('[data-collection-card-state="locked"]')).toHaveCount(2);
  await expect(grid.locator('[data-collection-bond="true"]')).toHaveCount(3);

  await element.selectOption('Plant');
  await expect(cards).toHaveCount(3);
  await expect(count).toHaveText('3 cards');
  const target = grid.locator('[data-collection-discovery-card-id="canopy-keeper"]');
  await expect(target).toHaveAttribute('data-collection-card-state', 'locked');
  await expect(target).toHaveAttribute('aria-label', 'Canopy Keeper. Rare rarity. Plant bond carrier. Not owned');
  await target.click();

  const inspector = page.getByRole('dialog', { name: 'Canopy Keeper card details' });
  await expect(inspector).toBeVisible();
  await expect(inspector.locator('.dossier-stat').filter({ hasText: 'Rarity' }).locator('.dossier-stat__value')).toHaveText('Rare');
  await expect(inspector.getByRole('heading', { name: 'Ability Upgrades' })).toBeVisible();
  await expect(inspector.getByTestId('card-upgrades').locator('[data-testid^="card-upgrade-"]')).toHaveCount(3);
  await expect(inspector.getByTestId('card-upgrades')).toContainText('Plant Bond Practice');
  await expect(inspector.getByRole('heading', { name: 'Fight Record' })).toBeVisible();
  await expect(inspector.locator('.dossier-table__row b', { hasText: 'Street Packs' })).toBeVisible();
  await inspector.getByRole('button', { name: 'Close card details' }).click();

  await element.selectOption('Poison');
  await expect(cards).toHaveCount(0);
  await expect(count).toHaveText('0 cards');
  await bond.uncheck();
  await expect(cards).toHaveCount(8);
  await expect(count).toHaveText('8 cards');
});