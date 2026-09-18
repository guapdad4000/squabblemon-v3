const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs');
const origin = 'http://localhost:4179/squabblemon/';
const supports = [['energydrink','energy-drink','Energy Drink'], ['charger','phone-charger','Phone Charger'], ['firstaid','first-aid-kit','First Aid Kit'], ['boombox','boombox','Boombox'], ['subwaymap','subway-map','Subway Map'], ['workboots','work-boots','Work Boots']];
(async () => {
  fs.mkdirSync('screenshots', { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const [name, width, height] of [['desktop',1440,1000], ['phone',390,844]]) {
      const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
      const errors = [], missing = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('response', r => { if (r.status() >= 400 && /assets\/characters\/(energy-drink|phone-charger|first-aid-kit|boombox|subway-map|work-boots)/.test(r.url())) missing.push(r.url()); });
      await page.addInitScript(() => localStorage.setItem('squabblemon_e2e_user','signed-in'));
      await page.goto(origin+'game/decks/block', { waitUntil: 'domcontentloaded' });
      await page.getByTestId('deck-roster-grid').waitFor();
      assert.equal(await page.locator('.deck-slot').count(), 10);
      assert.match(await page.locator('.deck-workbench__count').innerText(), /10\s*\/\s*10/);
      await page.getByRole('button', { name:'Replace Cornball', exact:true }).click();
      await page.getByRole('button', { name:'Add Energy Drink', exact:true }).click();
      await page.locator('[data-testid="deck-roster-grid"] img[src*="energy-drink.webp"]').evaluate(img => img.decode());
      await page.getByRole('button', { name:'Save deck', exact:true }).click();
      await page.waitForURL(/\/game\/decks\/[a-f0-9-]{36}$/);
      const savedUrl = page.url();
      await page.reload({ waitUntil:'domcontentloaded' });
      await page.getByTestId('deck-roster-grid').waitFor();
      assert.equal(await page.locator('.deck-slot').count(), 10);
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('squabblemon.preview-decks.v1'))[0]);
      assert.equal(saved.cardIds.length, 10); assert(saved.cardIds.includes('energy-drink')); assert(saved.valid);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no page-wide overflow');
      await page.screenshot({ path: `screenshots/support-deck-${name}.png` });
      await page.getByRole('button', { name:'Save & test crew', exact:true }).click();
      await page.getByTestId('battle-arena').waitFor();
      await page.locator('[data-card-zone="hand"][data-card-id="energy-drink"]').first().waitFor();
      for (const [id, artwork, label] of supports) {
        await page.goto(origin+'e2e/wave3-moves.fixture.html?card='+id, { waitUntil:'domcontentloaded' });
        await page.getByTestId('battle-arena').waitFor();
        await page.evaluate(() => window.wave3Fixture.impact());
        const portrait = page.locator(`img[src*="/characters/${artwork}.webp"]`).first();
        await portrait.waitFor(); await portrait.evaluate(img => img.decode());
        assert(await portrait.evaluate(img => img.naturalWidth >= 512));
        if (id === 'energydrink' || id === 'charger') assert.match(await page.getByTestId('motion-player').innerText(), /^9/);
        await page.evaluate(() => window.wave3Fixture.ready());
        assert.doesNotMatch(await page.locator('body').innerText(), /\bPower\b|\bPWR\b/i);
        if (id === 'boombox') await page.screenshot({ path: `screenshots/support-battle-${name}.png` });
      }
      await page.goto(origin+'game/collection', { waitUntil:'domcontentloaded' });
      for (const [, artwork, label] of supports) {
        await page.getByRole('searchbox',{name:'Search collection'}).fill(label);
        await page.getByTestId('collection-card-control').filter({hasText:label}).click();
        const dialog = page.getByRole('dialog',{name:label+' card details'}); await dialog.waitFor();
        assert.match(await dialog.innerText(), /Hands/);
        assert.doesNotMatch(await dialog.innerText(), /\bPower\b|\bPWR\b/i);
        await page.screenshot({path:`screenshots/support-${artwork}-${name}.png`});
        await page.keyboard.press('Escape');
      }
      assert.deepEqual(errors, []); assert.deepEqual(missing, []);
      console.log(`${name}: ten slots, support replacement, save/reload, battle entry, six effect previews, Motion 9, Hands labels and six portraits passed.`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
