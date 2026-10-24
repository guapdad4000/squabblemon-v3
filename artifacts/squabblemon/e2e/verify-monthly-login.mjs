import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const origin = process.env.GROWTH_ORIGIN ?? 'http://127.0.0.1:4245';
const output = process.env.MONTHLY_LOGIN_OUTPUT ?? 'screenshots/monthly-login';
await mkdir(output, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {});
const report = [];
try {
  for (const [width, height] of [[1440,960],[390,844],[320,740],[844,390]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    const errors = [];page.on('pageerror', error => errors.push(error.message));
    await page.routeWebSocket('**', socket => socket.close());
    await page.goto(`${origin}/e2e/growth-lab.fixture.html?checkins=4&date=2026-10-20&plants=2&tasks=0&motion=reduce&id=monthly-${width}-${Date.now()}`, { waitUntil: 'domcontentloaded' });
    const track = page.getByRole('region', { name: 'October free card rewards' });
    await expect(track).toBeVisible();await page.evaluate(() => document.fonts.ready);
    assert.equal(await track.locator('li').count(), 7);assert.equal(await track.locator('.monthly-login-track__days i').count(), 30);
    await expect(track).toContainText('4 / 30 check-ins');await expect(track).toContainText('Resets Nov 1 · UTC');
    await expect(track).toContainText('Super Rare');assert.equal(await page.locator('.account-check-in-calendar li').count(), 7);
    assert.equal(await page.locator('.growth-tasks li').count(), 3);assert.equal(await page.locator('.growth-next-reward').count(), 1);
    const layout = await page.locator('.growth-dialog').evaluate(dialog => {
      const rect = dialog.getBoundingClientRect();
      const cells = [...dialog.querySelectorAll('.monthly-login-track li')].map(cell => {
        const r = cell.getBoundingClientRect();return { width: r.width, fits: cell.scrollWidth <= cell.clientWidth + 1 && r.left >= rect.left && r.right <= rect.right + 1 };
      });
      return { width: rect.width, height: rect.height, scrollHeight: dialog.scrollHeight, fits: rect.left >= 0 && rect.right <= innerWidth + 1 && rect.top >= 0 && rect.bottom <= innerHeight + 1, horizontalOverflow: dialog.scrollWidth > dialog.clientWidth + 1, cells };
    });
    assert.ok(layout.fits);assert.equal(layout.horizontalOverflow, false);assert.ok(layout.cells.every(cell => cell.fits), JSON.stringify(layout));
    if (height >= 740) assert.ok(layout.scrollHeight <= height * 1.25, `Keep a compact care sheet with the added full monthly roadmap: ${JSON.stringify(layout)}`);
    await track.scrollIntoViewIfNeeded();await page.screenshot({ path: join(output, `monthly-${width}-before.png`) });
    await page.getByRole('button', { name: 'Check in', exact: true }).click();
    await expect(track).toContainText('5 / 30 check-ins');
    assert.equal(await track.locator('li[data-collected=true]').count(), 2);
    const saved = await page.evaluate(() => window.growthFixture.snapshot());
    const cards = saved.receipts.filter(reward => reward.key.startsWith('monthly-login:'));
    assert.equal(saved.claimCalls, 1);assert.equal(cards.length, 2);assert.deepEqual(cards.map(card => card.cardRarity), ['SuperCommon','Common']);
    assert.ok(cards.every(card => saved.bootstrap.profile.ownedCardIds.includes(card.cardId)));
    assert.equal(saved.waterCalls, 0, 'Monthly rewards do not bypass the three garden tasks');
    await expect(page.locator('.growth-live')).toContainText('joined your collection');
    await track.scrollIntoViewIfNeeded();await page.screenshot({ path: join(output, `monthly-${width}-saved.png`) });
    await page.reload({ waitUntil: 'domcontentloaded' });await expect(track).toContainText('5 / 30 check-ins');
    const recovered = await page.evaluate(() => window.growthFixture.snapshot());
    assert.equal(recovered.claimCalls, 0);assert.equal(recovered.waterCalls, 0);
    assert.deepEqual(recovered.receipts.filter(reward => reward.key.startsWith('monthly-login:')), cards);
    assert.ok(cards.every(card => recovered.bootstrap.profile.ownedCardIds.includes(card.cardId)));
    assert.deepEqual(errors, []);report.push({ width, height, layout, cardTiers: cards.map(card => card.cardRarity), singleClaim: true, savedAcrossReload: true, errors });
    await page.close();console.log(`${width}×${height}: monthly track, weekly track, claim and saved identity passed.`);
  }
  const page = await browser.newPage({ viewport: { width: 320, height: 740 }, reducedMotion: 'reduce' });
  await page.routeWebSocket('**', socket => socket.close());
  await page.goto(`${origin}/e2e/growth-lab.fixture.html?checkins=28&date=2028-02-29&tasks=0&motion=reduce&id=monthly-feb-${Date.now()}`, { waitUntil: 'domcontentloaded' });
  const track = page.getByRole('region', { name: 'February free card rewards' });
  await expect(track).toBeVisible();assert.equal(await track.locator('.monthly-login-track__days i').count(), 29);
  await expect(track).toContainText('Mythical arrives on check-in 29');await expect(track).toContainText('Resets Mar 1 · UTC');
  await page.getByRole('button', { name: 'Check in', exact: true }).click();await expect(track).toContainText('29 / 29 check-ins');
  assert.equal(await track.locator('li[data-collected=true]').count(), 7);
  const result = await page.evaluate(() => window.growthFixture.snapshot());
  assert.equal(result.receipts.filter(reward => reward.key.startsWith('monthly-login:')).length, 7);
  await track.scrollIntoViewIfNeeded();await page.screenshot({ path: join(output, 'monthly-february.png') });
  report.push({ shortMonth: '29 days, all seven tiers saved', claimCalls: result.claimCalls });await page.close();
} finally { await browser.close();await writeFile(join(output, 'verification.json'), JSON.stringify(report, null, 2)); }
