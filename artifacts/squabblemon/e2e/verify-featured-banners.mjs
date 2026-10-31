import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:5196';
const output = process.env.BANNER_OUTPUT ?? '/tmp/squabblemon-featured-banners';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const cases = [['standard','2026-10-29',0],['inmates','2026-10-20',1],['oz','2026-10-29',1],['wonderland','2026-11-03',1],['red-blue','2026-11-10',1],['anunaki','2026-10-29',2]];
const report = [];
try {
  for (const [id, date, clicks] of cases) for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/player/packs/welcome', route => route.fulfill({ json: { available: false, serverNow: Date.parse(`${date}T12:00:00Z`) } }));
    await page.goto(`${origin}/e2e/weekly-banners.fixture.html?misses=9`);
    for (let i = 0; i < clicks; i++) await page.getByRole('button', { name: 'Next banner', exact: true }).click();
    const poster = page.locator(`.pull-feature[data-banner="${id}"]`);
    await expect(poster).toBeVisible();
    if (id !== 'standard') {
      await expect(poster.getByLabel('Featured fighter guarantee')).toContainText('10% FEATURED');
      await expect(poster.getByLabel('Featured fighter guarantee')).toContainText('NEXT PACK: FEATURED GUARANTEED');
      await page.waitForFunction(() => [...document.querySelectorAll('.pull-feature__cast img')].every(img => img.complete && img.naturalWidth > 0));
    }
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${output}/gacha-${id}-${viewport.width}.png`, fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (id === 'anunaki') {
      await expect(page.getByTestId('banner-rotation')).toContainText('Anunaki · Ends');
      await expect(page.getByTestId('banner-rotation')).toContainText('Dec 7');
      await expect(page.getByTestId('banner-rotation')).not.toContainText('This week: Oz');
    }
    await page.getByRole('button', { name: 'Drop rates', exact: true }).click();
    const rates = page.getByRole('dialog', { name: 'The odds.' });
    await expect(rates).toBeVisible();
    const textColor = await rates.locator(':scope > p').first().evaluate(element => getComputedStyle(element).color);
    assert.notEqual(textColor, 'rgb(51, 51, 51)', 'venue paragraph rules must not darken Rates text');
    const channels = textColor.match(/\d+/g).map(Number); assert(channels.slice(0, 3).every(channel => channel >= 180));
    if (id !== 'standard') {
      await expect(rates).toContainText('Slot 5 has a 10% base chance');
      await expect(rates).toContainText('Featured guaranteed within 1 pack');
      await expect(rates.locator('.pull-banner-roster li').first()).toContainText('% per pack');
      assert(await rates.locator('.pull-banner-roster li').count() > 0);
    }
    await page.screenshot({ path: `${output}/gacha-${id}-rates-${viewport.width}.png`, fullPage: true });
    await page.keyboard.press('Escape');
    await expect(rates).not.toBeVisible();
    assert.deepEqual(errors, []);
    report.push({ id, viewport, nextPackGuarantee: id !== 'standard', completeRates: true, readableRateText: true, horizontalOverflow: false, pageErrors: errors });
    await page.close();
  }
  for (const [date, misses, expected] of [['2026-11-20', 9, 'NEXT PACK: FEATURED GUARANTEED'], ['2026-10-29', 0, 'Featured within 10 packs']]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await page.route('**/api/player/packs/welcome', route => route.fulfill({ json: { available: false, serverNow: Date.parse(`${date}T12:00:00Z`) } }));
    await page.goto(`${origin}/e2e/weekly-banners.fixture.html?misses=${misses}`);
    await page.getByRole('button', { name: 'Next banner', exact: true }).click();
    await page.getByRole('button', { name: 'Next banner', exact: true }).click();
    const poster = page.locator('.pull-feature[data-banner="anunaki"]');
    await expect(poster.getByLabel('Featured fighter guarantee')).toContainText(expected);
    if (date === '2026-11-20') {
      await expect(poster.locator('.pull-feature__schedule')).toContainText('RETURNS Dec 7');
      await expect(poster.getByRole('button', { name: 'Open · 1 ticket', exact: true })).toBeDisabled();
    }
    await page.screenshot({ path: `${output}/gacha-anunaki-${misses ? 'closed-saved-progress' : 'fresh-guarantee'}-390.png`, fullPage: true });
    report.push({ id: 'anunaki', date, misses, expected, closedPurchaseDisabled: date === '2026-11-20' });
    await page.close();
  }
  await writeFile(`${output}/featured-banner-verification.json`, JSON.stringify({ evidence: 'Real local Shop, controlled fixture bootstrap and server clock; no production transaction.', cases: report }, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
