// Local browser smoke: VITE_E2E_AUTH=true, then UI_ORIGIN=http://127.0.0.1:4198 node --import tsx e2e/verify-character-cosmetics.mjs
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { cardCatalog } from '../../../lib/squabblemon-engine/src/data.ts';
import { CHARACTER_STYLE_SETS } from '../../../lib/squabblemon-engine/src/cosmetics.ts';

const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:4198';
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname), 'Use a local preview.');
const ids = cardCatalog.map(card => card.catalogId);
const bootstrap = {
  profile: {
    id: 'e2e-player', displayName: 'Sticker Test', avatarKey: 'guap', onboardingStep: 'complete',
    starterDeckId: null, streetRep: 0, xp: 0, level: 1, softCurrency: 500, packTickets: 3,
    styleShards: 1000, packPity: 0, deckSlots: 4, cosmeticCurrency: 0, collectionProgress: ids.length,
    storyChapter: 0, storyNode: 0, tutorialCompleted: true, starterRewardClaimed: true,
    ageConfirmedAt: new Date(0).toISOString(), termsAcceptedAt: new Date(0).toISOString(),
    settings: { reducedMotion: false, turnTimerEnabled: false }, ownedCardIds: ids,
    cardProgression: {}, discoveredCardIds: ids, ownedVariants: [], equippedVariants: {},
    unlockedCosmeticIds: [], unlockedCharacterIds: [], savedDecks: [], storyProgress: {},
    inbox: [], packHistory: [], lastActiveAt: new Date(0).toISOString(),
  },
  missions: [], collectionRoad: [],
  nextAction: { id: 'test', eyebrow: 'Test', title: 'Test', description: '', destination: 'play', rewardLabel: null },
  packConfig: { id: 'test', name: 'Test', oddsVersion: 'test', softCurrencyCost: 100, ticketCost: 1, rewardsPerPack: 1, pityLimit: 10, odds: [] },
  tenPullConfig: { id: 'test', name: 'Test', oddsVersion: 'test', pullCount: 10, ticketCost: 10, softCurrencyCost: 1000, rewardsPerPull: 1, rarePityBonusPerPull: 1 },
};
const report = { checks: [], errors: [], missingAssets: [] };
const pass = text => { report.checks.push(text); console.log('PASS', text); };
await mkdir('screenshots/character-cosmetics', { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
await context.addInitScript(() => localStorage.setItem('squabblemon_e2e_user', 'signed-in'));
await context.route('**/api/player/bootstrap', route => route.fulfill({ json: bootstrap }));
const page = await context.newPage();
page.on('pageerror', error => report.errors.push(error.message));
page.on('response', response => {
  if (response.status() >= 400 && response.url().includes('/assets/cosmetics/')) report.missingAssets.push(response.url());
});
const button = name => page.getByRole('button', { name, exact: true });
try {
  await page.goto(origin + '/game/style');
  await page.getByTestId('character-collections').waitFor();
  assert.equal(await page.locator('.style-library__card').count(), Object.keys(CHARACTER_STYLE_SETS).length);
  await page.getByRole('searchbox', { name: 'Search signature collections' }).fill('gamer');
  assert.equal(await page.locator('.style-library__card').count(), 1);
  await page.getByRole('link', { name: 'Open Gamer collection', exact: true }).click();
  await page.getByTestId('character-styles').waitFor();
  assert.equal(await page.locator('.style-sticker-sheet button').count(), 4);
  assert.equal(await button('Gamer · Portrait').isDisabled(), true);
  await button('Unlock for 100 Style Shards').click();
  await page.getByText('900', { exact: true }).waitFor();
  for (const name of ['Gamer · Portrait', 'Gamer · Action', 'Gamer · Reaction']) await button(name).click();
  assert.equal(await button('Gamer · Emblem').isDisabled(), true);
  await button('Save banner stickers').click();
  await page.getByText('Saved to your collection.', { exact: true }).waitFor();
  assert.equal(await page.locator('.character-banner__stickers img').count(), 3);
  await page.locator('.character-banner__artwork').evaluate(img => img.decode());
  await page.screenshot({ path: 'screenshots/character-cosmetics/gamer-desktop.png' });
  pass('New collection unlocks for 100 shards; three stickers equip and a fourth is disabled.');

  await page.getByRole('link', { name: '← All collections', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search signature collections' }).fill('kyle');
  await page.getByRole('link', { name: 'Open KYLE collection', exact: true }).click();
  assert.equal(await page.locator('.style-sticker-sheet button').count(), 8);
  await button('Unlock for 100 Style Shards').click();
  await page.getByText('800', { exact: true }).waitFor();
  await button('Remove Gamer · Reaction').click();
  await button('Smile bomb').click();
  await button('Save banner stickers').click();
  await page.getByText('Saved to your collection.', { exact: true }).waitFor();
  assert.equal(await page.locator('.character-banner__stickers img').count(), 2);
  assert.equal(await page.locator('.character-banner__stickers span.character-sticker').count(), 1);
  pass('Existing KYLE stickers and new Gamer stickers mix on the supplied KYLE banner.');

  await button('02 / Character banner').click();
  await button('Silver Lining · 120 shards').click();
  await button('Unlock for 120 Style Shards').click();
  await button('Equip banner').click();
  await page.getByText('Saved to your collection.', { exact: true }).waitFor();
  assert.equal(await page.locator('.character-banner').first().getAttribute('data-finish'), 'silver');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('.character-banner__sheen').first().evaluate(el => getComputedStyle(el).animationName), 'none');
  pass('Silver finish remains available and respects reduced motion.');

  for (const cardId of ['guap', 'powerhouse', 'sherlock']) {
    await page.goto(origin + '/game/style/' + cardId);
    await page.getByTestId('character-styles').waitFor();
    assert.equal(await page.locator('.style-sticker-sheet button').count(), CHARACTER_STYLE_SETS[cardId].stickers.length);
    await page.locator('.character-banner__artwork').evaluate(img => img.decode());
    await page.locator('.style-deck-cover img').scrollIntoViewIfNeeded();
    await page.locator('.style-deck-cover img').evaluate(img => img.decode());
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.getByRole('heading', { level: 1 }).scrollIntoViewIfNeeded();
      assert(await page.locator('.character-styles').evaluate(el => el.scrollWidth <= el.clientWidth + 1), cardId + ' fits mobile');
      const ratio = await page.locator('.character-banner').first().evaluate(el => el.clientWidth / el.clientHeight);
      assert(Math.abs(ratio - 3) < 0.1, 'Banner composition is preserved on mobile.');
      await page.screenshot({ path: `screenshots/character-cosmetics/${cardId}-${width}.png` });
    }
  }
  pass('GUAP, Powerhouse (three supplied stickers) and Sherlock render on 320px and 390px screens.');

  await page.setViewportSize({ width: 980, height: 900 });
  await page.goto(origin + '/e2e/deck-selection.fixture.html?mode=decks&account=cosmetics');
  await page.locator('.deck-box__face--artwork img').first().evaluate(img => img.decode());
  assert.match(await page.locator('.deck-box__face--artwork img').first().getAttribute('src'), /buddy\/deck-cover-v3\.webp$/);
  await page.screenshot({ path: 'screenshots/character-cosmetics/deck-cover.png' });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('.deck-box[data-rendered="true"]').first().waitFor();
  await page.screenshot({ path: 'screenshots/character-cosmetics/deck-cover-3d.png' });
  pass('Provided deck covers render in both the static and 3D deck box.');
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.missingAssets, []);
} finally {
  await browser.close();
  await writeFile('screenshots/character-cosmetics/report.json', JSON.stringify(report, null, 2));
}
