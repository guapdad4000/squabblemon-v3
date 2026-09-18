const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const origin = 'http://localhost:4179/squabblemon/';
const roster = JSON.parse(fs.readFileSync('artifacts/deliverables/street-wave-art-outputs.json'));
roster.push({ id: 'simmy', name: 'Simmy' }, { id: 'foodz', name: 'Foodz' });
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const [size, width, height] of [['desktop', 1440, 1000], ['phone', 390, 844]]) {
      const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
      const errors = [], missing = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('response', r => { if (r.status() >= 400 && roster.some(c => r.url().includes('/characters/' + c.id + '.webp'))) missing.push(r.url()); });
      await page.addInitScript(() => localStorage.setItem('squabblemon_e2e_user', 'signed-in'));
      await page.goto(origin + 'game/collection', { waitUntil: 'domcontentloaded' });
      for (const { id, name } of roster) {
        await page.getByRole('searchbox', { name: 'Search collection' }).fill(name);
        await page.getByTestId('collection-card-control').filter({ hasText: name }).click();
        const dialog = page.getByRole('dialog', { name: name + ' card details' });
        await dialog.waitFor();
        await page.waitForFunction(() => {
          const content = document.querySelector('[role="dialog"] > .relative');
          return content && Number(getComputedStyle(content).opacity) >= 0.99;
        });
        const portrait = dialog.locator(`img[src*="/characters/${id}.webp"]`).first();
        await portrait.evaluate(img => img.decode());
        assert(await portrait.evaluate(img => img.naturalWidth >= 512), name);
        assert.match(await dialog.innerText(), /Hands/);
        if (id === 'simmy' || id === 'foodz') assert.match(await dialog.innerText(), /Mythical/i);
        if (['simmy', 'foodz', 'alchy', 'bboy'].includes(id)) await page.screenshot({ path: `screenshots/street-wave-${id}-${size}.png` });
        await page.keyboard.press('Escape');
      }
      await page.goto(origin + 'game/decks/block', { waitUntil: 'domcontentloaded' });
      await page.getByTestId('deck-roster-grid').waitFor();
      await page.getByRole('button', { name: 'Replace Cornball', exact: true }).click();
      await page.getByRole('button', { name: 'Add Foodz', exact: true }).click();
      await page.getByRole('button', { name: 'Save deck', exact: true }).click();
      await page.waitForURL(/\/game\/decks\/[a-f0-9-]{36}$/);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByTestId('deck-roster-grid').waitFor();
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('squabblemon.preview-decks.v1'))[0]);
      assert.equal(saved.cardIds.length, 10); assert(saved.cardIds.includes('foodz')); assert(saved.valid);
      await page.getByRole('button', { name: 'Save & test crew', exact: true }).click();
      await page.getByTestId('battle-arena').waitFor();
      for (const id of ['foodz', 'simmy', 'bboy', 'alchy']) {
        await page.goto(origin + 'e2e/wave3-moves.fixture.html?card=' + id, { waitUntil: 'domcontentloaded' });
        await page.getByTestId('battle-arena').waitFor();
        await page.evaluate(() => window.wave3Fixture.impact());
        await page.locator(`img[src*="/characters/${id}.webp"]`).first().evaluate(img => img.decode());
        await page.screenshot({ path: `screenshots/street-wave-battle-${id}-${size}.png` });
        await page.evaluate(() => window.wave3Fixture.ready());
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      }
      assert.deepEqual(errors, []); assert.deepEqual(missing, []);
      console.log(size + ': 21 collection cards, both Mythicals, save/reload with Foodz, battle entry and four battle effect previews passed.');
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
