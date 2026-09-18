const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const origin = 'http://localhost:4179/squabblemon/';
const ids = ['rastamon', 'gamer', 'bikelife-yn', 'boss-babe', 'officer-oink', 'barber-bro', 'bottle-girl', 'sneaker-reseller', 'church-auntie', 'wifey', 'scammer', 'young-bull', 'racially-ambiguous-transplant', 'bad-lil-cousin-tayaty', 'edgar', 'nguyen', 'man-man', 'pinay-nurse', 'honest-thot', 'earthy-sugar-foot', 'abuela', 'ice-cream-truck'];

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const [name, width, height] of [['desktop', 1440, 1000], ['phone', 390, 844]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      const errors = [], missingAssets = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => { if (response.status() >= 400 && /\/assets\/(characters|special-moves)\//.test(response.url())) missingAssets.push(response.url()); });
      await page.addInitScript(() => localStorage.setItem('squabblemon_e2e_user', 'signed-in'));
      await page.goto(origin + 'game/collection', { waitUntil: 'domcontentloaded' });
      await page.getByTestId('collection-card-control').first().waitFor();
      const rosterSize = await page.evaluate(async () => (await import('/squabblemon/src/data.ts')).cardCatalog.length);
      assert.equal(await page.getByTestId('collection-card-control').count(), rosterSize);
      for (const id of ids) assert.equal(await page.locator(`[data-card-id="${id}"]`).count(), 1, `${name}: ${id} in collection`);
      const images = await page.evaluate(async () => {
        const { cardCatalog, getCardImage } = await import('/squabblemon/src/data.ts');
        return Promise.all(cardCatalog.map(async card => {
          const img = new Image(); img.src = getCardImage(card.artworkId); await img.decode();
          return { id: card.engineId, width: img.naturalWidth, height: img.naturalHeight, versioned: img.src.includes('?v=') };
        }));
      });
      assert.ok(images.every(img => img.width >= 512 && img.height >= 512 && img.versioned));
      await page.screenshot({ path: `screenshots/roster-refresh-${name}.png` });
      await page.goto(origin + 'game/decks/block', { waitUntil: 'domcontentloaded' });
      const pool = page.getByTestId('deck-collection-grid');
      await pool.waitFor();
      for (const id of ids) assert.equal(await pool.locator(`[data-card-id="${id}"]`).count(), 1, `${name}: ${id} in deck builder`);
      await page.getByRole('button', { name: 'Replace Cornball', exact: true }).click();
      await page.getByRole('button', { name: 'Add Boss Bae', exact: true }).click();
      await page.getByRole('button', { name: 'Replace All Jokes Roaster', exact: true }).click();
      await page.getByRole('button', { name: 'Add Scammer', exact: true }).click();
      await page.getByRole('button', { name: 'Save & test crew', exact: true }).click();
      await page.getByTestId('battle-arena').waitFor();
      for (const id of ['boss-babe', 'scammer']) await page.locator(`[data-card-zone="hand"][data-card-id="${id}"]`).first().waitFor();
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('squabblemon.preview-decks.v1'))[0]);
      assert(saved.cardIds.includes('boss-babe') && saved.cardIds.includes('scammer'));
      assert.equal(saved.valid, true);
      await page.goto(origin + 'moves?card=bossbabe', { waitUntil: 'domcontentloaded' });
      await page.locator('canvas[data-ready="true"]').waitFor();
      assert.equal(await page.getByLabel('Animation', { exact: true }).inputValue(), 'char16');
      await page.getByLabel('Card', { exact: true }).selectOption('scammer');
      assert.equal(await page.getByLabel('Animation', { exact: true }).inputValue(), 'char62');
      await page.locator('canvas[data-ready="true"]').waitFor();
      assert.deepEqual(missingAssets, []);
      assert.deepEqual(errors, []);
      console.log(`${name}: all 22 requested cards visible and deck-selectable, ${images.length} portraits decoded, Boss Bae and Scammer saved into a battle, both move videos verified.`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
