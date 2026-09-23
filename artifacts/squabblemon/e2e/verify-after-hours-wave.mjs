import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import { cardCatalog, CARD_RARITY_DEFINITIONS, DECK_SIZE, starterRecipes, validateSavedDeck } from '@workspace/squabblemon-engine/data';

const cards = [
  { id: 'sugarfoot', name: 'Sugarfoot', rarity: 'Uncommon' },
  { id: 'yn-gokarter', name: 'YN Gokarter', rarity: 'Rare' },
  { id: 'yn-atv-lord', name: 'YN ATV Lord', rarity: 'Epic' },
  { id: 'janitor', name: 'Janitor', rarity: 'Uncommon' },
  { id: 'homeless-wiseman', name: 'Homeless Wiseman', rarity: 'Legendary' },
  { id: 'juneteenth-chair-guy', name: 'Juneteenth Chair Guy', rarity: 'Mythical' },
  { id: 'squabble-house-manager', name: 'Squabble House Manager', rarity: 'Rare' },
];
const allIds = cardCatalog.map(card => card.catalogId);
const crew = {
  id: 'after-hours-review', name: 'After Hours',
  cardIds: [...cards.map(card => card.id), ...starterRecipes[0].catalogCardIds.slice(0, DECK_SIZE - cards.length)],
  heroCardId: 'juneteenth-chair-guy', recipeId: null, valid: true, issues: [],
};
assert.ok(validateSavedDeck(crew.cardIds, allIds, crew.heroCardId).valid, 'New cards form a legal saved crew');
const now = new Date().toISOString();
const bootstrap = {
  profile: {
    id: 'after-hours-reviewer', displayName: 'Roster Review', avatarKey: 'cornball', onboardingStep: 'complete',
    starterDeckId: crew.id, streetRep: 0, xp: 0, level: 1, softCurrency: 500,
    packTickets: 3, styleShards: 0, packPity: 0, deckSlots: 4, cosmeticCurrency: 0,
    collectionProgress: 0, storyChapter: 0, storyNode: 0, tutorialCompleted: true, starterRewardClaimed: true,
    ageConfirmedAt: now, termsAcceptedAt: now, lastActiveAt: now,
    settings: { reducedMotion: true, turnTimerEnabled: false },
    ownedCardIds: allIds, discoveredCardIds: allIds,
    cardProgression: Object.fromEntries(allIds.map(id => [id, { xp: 0, level: 1 }])),
    ownedVariants: [], equippedVariants: {}, unlockedCosmeticIds: [], unlockedCharacterIds: [],
    savedDecks: [crew], storyProgress: {}, inbox: [], packHistory: [],
  },
  missions: [], collectionRoad: [],
  nextAction: { id: 'play', eyebrow: 'Tonight', title: 'Run the block', description: 'Play', destination: 'play', rewardLabel: null },
  packConfig: { id: 'street-pack', name: 'Street Pack', oddsVersion: 'fixture', softCurrencyCost: 200, ticketCost: 1, rewardsPerPack: 6, pityLimit: 10, odds: [] },
  tenPullConfig: { id: 'ten', name: 'Ten packs', oddsVersion: 'fixture', pullCount: 10, ticketCost: 9, softCurrencyCost: 1800, rewardsPerPull: 6, rarePityBonusPerPull: 1 },
};

// Isolate test authentication and optimized modules from the managed preview.
const port = 4196;
process.env.PORT = String(port);
process.env.BASE_PATH = '/';
process.env.VITE_E2E_AUTH = 'true';
delete process.env.REPL_ID;
const server = await createServer({
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  cacheDir: '/tmp/squabblemon-after-hours-vite',
  server: { host: '127.0.0.1', port, strictPort: true, hmr: false },
});
await server.listen();
const browser = await chromium.launch({ headless: true });
const origin = `http://127.0.0.1:${port}`;
const output = new URL('../../../screenshots/after-hours-wave/', import.meta.url);
await mkdir(output, { recursive: true });

async function loadedPortrait(container, id) {
  const image = container.locator('img.collector-portrait').first();
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute('src', new RegExp(`/assets/characters/${id}\\.webp\\?`));
  await image.scrollIntoViewIfNeeded();
  await expect.poll(() => image.evaluate(element => ({
    complete: element.complete, largeEnough: element.naturalWidth >= 512, src: new URL(element.src).pathname,
  })), { message: `${id} portrait must decode`, timeout: 10000 })
    .toMatchObject({ complete: true, largeEnough: true, src: `/assets/characters/${id}.webp` });
}

try {
  for (const [label, width, height] of [['desktop', 1280, 900], ['phone', 390, 844]]) {
    const errors = [];
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    await context.addInitScript(crew => {
      localStorage.setItem('squabblemon_e2e_user', 'signed-in');
      localStorage.setItem('squabblemon.preview-decks.v1', JSON.stringify([crew]));
    }, crew);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', route => route.fulfill({
      json: new URL(route.request().url()).pathname.endsWith('/player/bootstrap') ? bootstrap : {},
    }));
    await page.goto(`${origin}/game/collection`);
    for (const card of cards) {
      const control = page.getByTestId('collection-card-control')
        .and(page.locator(`[data-collection-discovery-card-id="${card.id}"]`));
      await loadedPortrait(control, card.id);
      await control.click();
      const inspector = page.getByRole('dialog', { name: `${card.name} card details` });
      await expect(inspector).toBeVisible();
      await expect(inspector.locator('.dossier-name')).toHaveText(card.name);
      await expect(inspector.getByText(CARD_RARITY_DEFINITIONS[card.rarity].label, { exact: true }).first()).toBeVisible();
      await expect(inspector.getByText('Street Packs', { exact: true })).toBeVisible();
      await loadedPortrait(inspector, card.id);
      if (card.id === 'sugarfoot') await expect(inspector).toContainText(/Weaken/);
      if (card.id === 'janitor') await expect(inspector).toContainText(/Ongoing:.*first.*each round.*\+2 Hands/);
      if (card.id === 'homeless-wiseman') await expect(inspector).toContainText(/predict.*district.*trap/i);
      if (card.id === 'squabble-house-manager') {
        await expect(inspector.locator('.dossier-stat').filter({ hasText: 'Motion' }).locator('.dossier-stat__value')).toHaveText('1');
      }
      assert.ok(await inspector.locator('.dossier-name').evaluate(element => element.scrollWidth <= element.clientWidth + 1),
        `${card.name}: full inspector name must fit`);
      if (['sugarfoot', 'juneteenth-chair-guy', 'squabble-house-manager'].includes(card.id)) {
        await page.screenshot({ path: fileURLToPath(new URL(`${label}-${card.id}.png`, output)) });
      }
      await page.getByTestId('button-close-inspector').click();
    }
    console.log(`${label}: all seven real Collection cards and inspectors show their artwork, names, rarity and source`);

    await page.goto(`${origin}/game/decks/${crew.id}`);
    await page.locator('.deck-workbench__actions').waitFor();
    for (const card of cards) {
      await expect(page.locator(`[data-card-id="${card.id}"]`).first()).toBeVisible();
    }
    await page.screenshot({ path: fileURLToPath(new URL(`${label}-deck.png`, output)) });
    console.log(`${label}: saved crew contains all seven new characters`);

    await page.goto(`${origin}/e2e/after-hours-wave.fixture.html`);
    const lanes = [0, 0, 0, 1, 1, 2, 2];
    for (const [index, card] of cards.entries()) {
      await page.locator(`[data-card-zone="hand"][data-card-id="${card.id}"]`).click();
      await page.getByTestId(`lane-${lanes[index]}`).click();
      await page.getByTestId('button-lock').click();
      const played = page.getByTestId('battle-arena').locator(`[data-card-zone="board"][data-card-id="${card.id}"]`);
      await expect(played).toHaveCount(1);
      await loadedPortrait(played, card.id);
      await played.click();
      const inspector = page.getByRole('dialog', { name: `${card.name} battle details` });
      await expect(inspector).toBeVisible();
      await expect(inspector.getByText(CARD_RARITY_DEFINITIONS[card.rarity].label, { exact: true }).first()).toBeVisible();
      await loadedPortrait(inspector, card.id);
      await page.getByTestId('button-close-inspector').click();
      if (card.id === 'homeless-wiseman') {
        await expect(page.locator('.character-district-mark').filter({ hasText: /Wiseman prediction/ })).toBeVisible();
      }
    }
    await expect(page.getByTestId('after-hours-board-count')).toHaveAttribute('data-count', '7');
    await page.screenshot({ path: fileURLToPath(new URL(`${label}-battle.png`, output)) });
    assert.deepEqual(errors, [], `${label}: no browser runtime errors`);
    console.log(`${label}: all seven characters play onto the real Battle board and remain inspectable`);
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}