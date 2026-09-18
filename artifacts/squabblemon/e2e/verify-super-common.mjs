import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.JOURNEY_ORIGIN ?? 'http://127.0.0.1:5173/squabblemon';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const errors = [], failedArt = [];
page.on('pageerror', e => errors.push(e.message));
page.on('response', r => { if (r.url().includes('/assets/characters/') && r.status() >= 400) failedArt.push(r.url()); });
await page.addInitScript(() => {
  localStorage.setItem('squabblemon_e2e_user', 'signed-in');
  localStorage.setItem('squabblemon.preview-decks.v1', JSON.stringify([{
    id: 'super-common-check', name: 'Everyday Essentials', heroCardId: 'shiesty-yn', recipeId: null,
    cardIds: ['shiesty-yn', 'water-boy', 'bus-pass', 'torta', 'cognac-bottle', 'bust-down-watch', 'soul-food'],
    valid: true, issues: [],
  }]));
});
async function ready() {
  for (let i = 0; i < 200; i++) {
    if (await page.locator('[data-testid="battle-arena"][data-presentation-phase="player-ready"]').count()) return;
    const skip = page.getByTestId('button-fast-forward');
    if (await skip.count()) await skip.click({ timeout: 300 }).catch(() => {});
    await page.waitForTimeout(75);
  }
  throw new Error('Battle did not become ready');
}
try {
  await page.goto(`${origin}/game/collection`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^Filters/ }).click();
  await page.getByRole('button', { name: /^Super Common/ }).click();
  assert.equal(await page.getByTestId('collection-card-control').count(), 7);
  await page.locator('[data-testid="collection-card-grid"] .collector-portrait').evaluateAll(async images => {
    await Promise.all(images.map(img => img.decode()));
    if (images.some(img => !img.naturalWidth)) throw new Error('Missing portrait');
  });
  await page.getByRole('button', { name: /^Filters/ }).click();
  await page.screenshot({ path: '../../screenshots/super-common-collection-phone.png', fullPage: true });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Collection must fit phone width');
  await page.getByRole('button', { name: /^Filters/ }).click();
  await page.getByRole('button', { name: 'Support cards', exact: true }).click();
  assert.equal(await page.getByTestId('collection-card-control').count(), 4);
  await page.getByRole('button', { name: /^Soul Food\. Super Common/ }).click();
  await page.getByText('Full Plate', { exact: true }).first().waitFor();
  assert(await page.getByText('Support card', { exact: true }).count());

  await page.goto(`${origin}/game/decks/super-common-check/test`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('battle-arena').waitFor();
  await ready();
  for (const [id, motion] of [['shiesty-yn', 1], ['water-boy', 1], ['bus-pass', 1], ['torta', 0]]) {
    await page.getByTestId('hand-tray').locator(`[data-card-id="${id}"]`).click();
    await page.getByRole('button', { name: /^Deploy / }).first().click();
    await page.getByTestId('button-lock').click();
    await page.waitForTimeout(150);
    await ready();
    assert.equal(await page.getByLabel('Round 1 of 6').count(), 1);
    assert.equal(await page.getByLabel(`Your Motion: ${motion}`, { exact: true }).count(), 1);
    assert.equal(await page.getByTestId('hand-tray').locator(`[data-card-id="${id}"]`).count(), 0);
  }
  assert.equal(await page.getByRole('navigation', { name: 'Game navigation' }).count(), 0);
  await page.screenshot({ path: '../../screenshots/super-common-battle-phone.png' });
  await page.getByTestId('button-next-round').click();
  await page.waitForTimeout(150);
  await ready();
  assert.equal(await page.getByLabel('Round 2 of 6').count(), 1);
  assert.deepEqual(failedArt, []);
  assert.deepEqual(errors, []);
  console.log('PASS: seven cards, support filtering, artwork, mobile layout, four same-turn plays, Motion refunds/discounts, and next turn.');
} finally { await browser.close(); }
