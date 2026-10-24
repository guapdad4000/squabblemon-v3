import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { profileBootstrap } from './fighter-id.fixture';
import { cardCatalog, isKumiteExclusiveCard } from '@workspace/squabblemon-engine/data';
import { planShopPurchase } from '@workspace/squabblemon-engine/economy';

process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
const origin = process.env.REVIEW_BASE_URL ?? 'http://127.0.0.1:4319';
const output = process.env.RECRUIT_OUTPUT ?? '/tmp/neighborhood-recruit-review';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE, args: ['--no-sandbox', '--use-angle=swiftshader'] });
const results: unknown[] = [];
try {
  for (const [name, width, height] of [['desktop', 1440, 1000], ['phone', 390, 844]] as const) {
    const initial = profileBootstrap({ softCurrency: 1000, settings: { reducedMotion: true, turnTimerEnabled: false } });
    const target = cardCatalog.find(card => card.rarity === 'Common' && !initial.profile.ownedCardIds.includes(card.catalogId) && !isKumiteExclusiveCard(card.catalogId))!;
    assert.ok(target);
    let server = initial;
    let committed: ReturnType<typeof planShopPurchase> | null = null;
    const requests: any[] = [], errors: string[] = [];
    const page = await browser.newPage({ viewport: { width, height }, baseURL: origin });
    page.setDefaultTimeout(15000);
    console.log(`Checking ${name} recruit banner`);
    await page.routeWebSocket('**', socket => socket.close());
    await page.addInitScript(() => localStorage.setItem('squabblemon-gpu-tier-v2', 'low'));
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/player/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/bootstrap')) return route.fulfill({ json: server });
      if (path.endsWith('/packs/welcome')) return route.fulfill({ json: { available: false, supportsFlexibleBatches: true } });
      if (path.endsWith('/shop/purchases')) {
        const request = route.request().postDataJSON(); requests.push(request);
        assert.equal(request.itemId, 'common-recruit'); assert.equal(request.cardId, target.catalogId);
        if (!committed) {
          committed = planShopPurchase(server.profile, request);
          server = { ...server, profile: { ...server.profile, ...committed.wallet } };
          return route.fulfill({ status: 503, json: { error: 'Lost committed receipt' } });
        }
        return route.fulfill({ json: { receipt: committed.receipt, bootstrap: server } });
      }
      if (path.endsWith('/notifications/receipts')) return route.fulfill({ json: { ids: [] } });
      if (path.endsWith('/mail')) return route.fulfill({ json: { messages: [] } });
      return route.fulfill({ json: {} });
    });
    await page.goto(`/e2e/payment-store.fixture.html?view=training&item=common-recruit&card=${target.catalogId}`);
    await expect(page).toHaveURL(new RegExp(`view=packs&banner=neighborhood&card=${target.catalogId}`));
    const recruit = page.locator('.neighborhood-recruit');
    await expect(recruit.getByRole('heading', { name: 'NEIGHBORHOOD RECRUIT' })).toBeVisible();
    await expect(recruit.getByRole('combobox')).toContainText(target.name);
    await expect(recruit.locator('.collector-card')).toHaveCount(1);
    await expect(page.getByTitle('Interactive heavy bag')).toHaveCount(0);
    await expect(recruit.getByRole('button', { name: 'Recruit · 400 Clout' })).toHaveCSS('background-color', 'rgb(231, 214, 168)');
    await expect(page.locator('.market-tabs button').first().locator('img')).toHaveAttribute('src', /fight-emblem/);
    await expect.poll(() => recruit.locator('img').evaluateAll(images => images.filter(image => image.getBoundingClientRect().width > 0).every(image => image.complete && image.naturalWidth > 0))).toBe(true);
    await expect.poll(() => page.evaluate(() => document.fonts.status)).toBe('loaded');
    // Capture the settled poster, including finite parent and card entrance animations.
    await page.evaluate(async () => {
      await Promise.allSettled(document.getAnimations().filter(animation => {
        const timing = animation.effect?.getComputedTiming();
        return timing && Number.isFinite(timing.endTime);
      }).map(animation => animation.finished));
    });
    await expect(recruit).toHaveCSS('opacity', '1');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `${output}/${name}-banner.png`, fullPage: true });
    // Native menu suppression must not consume the card's own right-click details.
    await recruit.locator('.collector-card').click({ button: 'right' });
    const details = page.getByRole('dialog', { name: `${target.name} card details` });
    await expect(details).toBeVisible();
    await details.getByRole('button', { name: 'Close card details', exact: true }).click();
    await expect(details).toHaveCount(0);
    console.log(`${name}: rendered art ready; checking rotation`);
    // The permanent sheet is in the same carousel as the original and weekly sheets.
    await page.getByRole('button', { name: 'Previous banner', exact: true }).click();
    await expect(page.locator('.neighborhood-recruit')).toHaveCount(0);
    await page.getByRole('button', { name: 'Previous banner', exact: true }).click();
    await expect(page.locator('.fight-bill__title')).toBeVisible();
    await page.getByRole('button', { name: 'Previous banner', exact: true }).click();
    await expect(recruit).toBeVisible();
    console.log(`${name}: rotation ready; checking purchase recovery`);
    await recruit.getByRole('button', { name: 'Recruit · 400 Clout' }).click();
    await expect(recruit.getByRole('button', { name: 'Recover recruit' })).toBeEnabled();
    const journal = await page.evaluate(id => JSON.parse(sessionStorage.getItem(`squabblemon.shop.pending.v1:${id}`) ?? 'null'), initial.profile.id);
    assert.equal(journal.cardId, target.catalogId);
    await recruit.getByRole('button', { name: 'Recover recruit' }).click();
    await expect.poll(() => requests.length).toBe(2);
    await expect.poll(() => page.evaluate(id => sessionStorage.getItem(`squabblemon.shop.pending.v1:${id}`), initial.profile.id)).toBe(null);
    assert.deepEqual(requests[0], requests[1]);
    assert.equal(server.profile.softCurrency, 600);
    assert.equal(server.profile.ownedCardIds.filter(id => id === target.catalogId).length, 1);
    assert.deepEqual(errors, []);
    results.push({ name, width, height, cardId: target.catalogId, requests, clout: server.profile.softCurrency, grantCount: 1, errors });
    await page.close();
  }
} finally { await browser.close(); }
await writeFile(`${output}/report.json`, JSON.stringify(results, null, 2));
console.log(`PASS ${results.length} permanent recruit banner / same-key recovery cases`);
