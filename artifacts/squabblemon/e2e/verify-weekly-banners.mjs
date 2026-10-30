import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:4242';
const output = process.env.BANNER_OUTPUT ?? '/tmp/squabblemon-weekly-banners';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const report = [];
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
    const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // The device is deliberately years wrong. The real Shop receives authoritative clock metadata.
    await page.clock.install({ time: new Date('2032-01-01T12:00:00Z') });
    let serverNow = Date.parse('2026-10-25T23:59:59Z');
    let includeClock = true;
    let rejectUnpaid = false;
    let interruptFirst = true;
    let charges = 0;
    const requests = [];
    const receipts = new Map();
    await page.route('**/api/player/packs/welcome', route => route.fulfill({ json: { available: false, ...(includeClock ? { serverNow } : {}) } }));
    await page.route('**/api/player/packs/open', async route => {
      const input = route.request().postDataJSON();
      requests.push(input);
      const bootstrap = await page.evaluate(() => window.__weeklyBootstrap());
      let opening = receipts.get(input.idempotencyKey);
      if (!opening) {
        if (rejectUnpaid && input.bannerId !== 'standard') return route.fulfill({ status: 400, json: { error: 'This pull banner is unavailable. Choose an active banner.' } });
        charges++;
        opening = { id: input.idempotencyKey, oddsVersion: input.bannerId === 'standard' ? 'street-pack-v7' : `street-pack-v7:banner-${input.bannerId}-v1:week-${input.bannerOccurrenceId.split(':')[1]}`, paymentMethod: input.paymentMethod, cost: 1, pullCount: 1, pityBefore: 4, pityAfter: 5, createdAt: new Date(serverNow).toISOString(), rewards: [{ kind: 'styleShards', cardId: null, variantId: null, name: 'Style Shards', rarity: null, isNew: false, amount: 5 }] };
        receipts.set(input.idempotencyKey, opening);
      }
      bootstrap.profile.packTickets = 12 - charges;
      bootstrap.profile.packHistory = [...receipts.values()];
      if (interruptFirst) { interruptFirst = false; return route.fulfill({ status: 503, json: { error: 'Response interrupted' } }); }
      return route.fulfill({ json: { opening, bootstrap, alreadyOpened: requests.length > 1 } });
    });
    await page.goto(`${origin}/e2e/weekly-banners.fixture.html`);
    const rotation = page.getByTestId('banner-rotation');
    await expect(rotation).toContainText('This week: Inmates');
    await expect(rotation).toContainText('Next: Oz');
    await expect(rotation.locator('time').first()).toHaveAttribute('datetime', '2026-10-26T00:00:00.000Z');
    await page.getByRole('button', { name: 'Next banner', exact: true }).click();
    await expect(page.locator('.pull-feature')).toHaveAttribute('data-banner', 'inmates');
    await page.getByRole('button', { name: 'Open · 1 ticket', exact: true }).click();
    await expect(page.getByRole('alert').filter({ visible: true })).toBeVisible();
    assert.equal(requests[0].bannerOccurrenceId, 'inmates:2026-10-19');
    // An already-awarded opening must retain the old art, receipt, and payment intent after rollover.
    serverNow = Date.parse('2026-10-26T00:00:00Z');
    await page.reload();
    await expect(rotation).toContainText('This week: Oz');
    await expect(page.locator('.pull-feature')).toHaveAttribute('data-banner', 'inmates');
    await expect(page.locator('.pull-feature__schedule')).toContainText('Ended');
    await page.getByRole('button', { name: 'Retry this opening', exact: true }).click();
    await expect(page.locator('dialog[open].gacha-reveal-dialog')).toBeVisible();
    assert.deepEqual(requests[1], requests[0]);
    assert.equal(charges, 1);
    await page.evaluate(() => { sessionStorage.clear(); });
    await page.reload();
    await expect(rotation).toContainText('This week: Oz');
    await expect(rotation).toContainText('Next: Wonderland');
    await page.getByRole('button', { name: 'Next banner', exact: true }).click();
    await expect(page.locator('.pull-feature')).toHaveAttribute('data-banner', 'oz');
    await page.waitForFunction(() => [...document.querySelectorAll('.pull-feature__cast img')].every(img => img.complete && img.naturalWidth > 0));
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${output}/weekly-banner-${viewport.width}.png`, fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    // No click is needed to update the next active week at the exact clock boundary.
    serverNow = Date.parse('2026-11-01T23:59:59Z');
    await page.reload();
    await expect(rotation).toContainText('This week: Oz');
    await page.clock.fastForward(1500);
    await expect(rotation).toContainText('This week: Wonderland');
    // Rolling deployment: old responses omit time metadata. Incorrect local intent fails safely,
    // clears the uncertain request, and returns to always-available Standard for recovery.
    includeClock = false;
    rejectUnpaid = true;
    await page.clock.setSystemTime(new Date('2026-10-19T12:00:00Z'));
    await page.reload();
    await expect(rotation).toContainText('This week: Inmates');
    await page.getByRole('button', { name: 'Next banner', exact: true }).click();
    await page.getByRole('button', { name: 'Open · 1 ticket', exact: true }).click();
    await expect(page.locator('.pull-feature')).toHaveAttribute('data-banner', 'standard');
    await expect(page.getByRole('alert').filter({ visible: true })).toContainText('No charge was made');
    assert.equal(charges, 1);
    assert.equal(await page.evaluate(() => sessionStorage.getItem('squabblemon:pack-request:weekly-fixture')), null);
    await page.getByRole('button', { name: 'Open · 1 ticket', exact: true }).click();
    await expect(page.locator('dialog[open].gacha-reveal-dialog')).toBeVisible();
    assert.equal(charges, 2);
    assert.equal(requests.at(-1).bannerId, 'standard');
    assert.equal(requests.at(-1).bannerOccurrenceId, undefined);
    assert.deepEqual(errors, []);
    report.push({ viewport, serverClockSkewCorrected: true, exactBoundaryUpdated: true, pendingOccurrenceRecovered: true, originalRequestRetried: true, completedRetryCharges: 1, legacyClockFallbackRejectsWithoutCharge: true, standardRecovery: true, horizontalOverflow: false, pageErrors: errors });
    await page.close();
  }
  await writeFile(`${output}/weekly-banners.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
