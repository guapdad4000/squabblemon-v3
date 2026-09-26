import { chromium, expect } from '@playwright/test';
import { profileBootstrap } from './fighter-id.fixture.ts';
import { mkdir } from 'node:fs/promises';

// Visual checkout coverage uses intercepted HTTP only; no real payments.
const out = process.env.REVIEW_OUTPUT ?? '/tmp/market-shelf-review';
await mkdir(out, { recursive: true });
const ORDER_ID = '1712345678901-d9428888-122b-4f4e-9f6f-9c2a3f349a11';
const offers = [
  { id: 'clout-pocket', name: 'Pocket Clout', amountMinor: 299, currency: 'usd', clout: 500, enabled: true },
  { id: 'clout-stack', name: 'Clout Stack', amountMinor: 699, currency: 'usd', clout: 1500, enabled: true },
  { id: 'clout-bag', name: 'Big Clout Bag', amountMinor: 1499, currency: 'usd', clout: 4000, enabled: true },
];
const browser = await chromium.launch();
try {
  for (const [name, width, height] of [['desktop', 1440, 1100], ['phone', 390, 844], ['small-phone', 320, 640]]) {
    if (process.env.REVIEW_VIEWPORT && process.env.REVIEW_VIEWPORT !== name) continue;
    const page = await browser.newPage({ baseURL: process.env.REVIEW_BASE_URL ?? 'http://127.0.0.1:4319', viewport: { width, height }, hasTouch: width < 800 });
    await page.routeWebSocket('**', socket => socket.close());
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    let fulfilled = false, dailyClaimed = false, dailyClaims = 0;
    const dailyStatus = () => ({ available: !dailyClaimed, amount: 50, date: '2026-09-25', attemptsRemaining: 2, resetsAt: '2026-09-26T00:00:00Z' });
    await page.route('**/api/player/**', route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/bootstrap')) return route.fulfill({ json: profileBootstrap({ softCurrency: 1250 + (fulfilled ? 500 : 0) + (dailyClaimed ? 50 : 0) }) });
      if (path.endsWith('/catalog')) return route.fulfill({ json: { version: 'market-review', taxMode: 'automatic', mode: 'test', enabled: true, supportUrl: '', refundPolicyUrl: '', offers } });
      if (path.endsWith('/orders')) return route.fulfill({ json: { orders: [], nextCursor: null } });
      if (path.endsWith('/daily-clout')) return route.fulfill({ json: dailyStatus() });
      if (path.endsWith('/daily-clout/claim')) { dailyClaimed = true; dailyClaims++; return route.fulfill({ json: { claimed: true, amount: 50, status: dailyStatus() } }); }
      if (path.endsWith('/checkout')) {
        requests.push(route.request().postDataJSON()); fulfilled = true;
        return route.fulfill({ json: { checkoutUrl: null, order: { id: ORDER_ID, offerId: 'clout-pocket', offerName: 'Pocket Clout', status: 'fulfilled', clout: 500, amountMinor: 299, currency: 'usd', taxMode: 'automatic', taxAmountMinor: 24, totalAmountMinor: 323, refundedAmountMinor: 0, fulfilledAt: '2026-09-25T12:00:00Z' } } });
      }
      return route.fulfill({ json: {} });
    });
    await page.goto('/e2e/payment-store.fixture.html');
    await expect(page.locator('.corner-product')).toHaveCount(4);
    await expect(page.getByRole('region', { name: 'clout shelf' }).getByTestId('daily-clout-pack')).toBeVisible();
    await expect(page.locator('.daily-clout-pack')).toHaveCount(0);
    await page.locator('.corner-product__display img').first().evaluate(img => img.decode());
    await page.evaluate(() => document.fonts.load('700 27px "Market Hand"'));
    expect(await page.locator('.corner-product__label').evaluateAll(labels => labels.every(label => label.scrollWidth <= label.clientWidth + 1))).toBe(true);
    await page.locator('.game-route-stage').evaluate(el => el.scrollTop = 250);
    await page.screenshot({ path: `${out}/${name}-wood-shelves.png` });
    const boxes = await page.locator('.corner-product__display').evaluateAll(items => items.map(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
    expect(boxes.every(box => Math.abs(box.w - box.h) < 1)).toBe(true);
    expect(boxes.every(box => Math.abs(box.y - boxes[0].y) < 1)).toBe(true);
    expect(boxes[1].x).toBeGreaterThan(boxes[0].x + boxes[0].w);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width > 800) {
      await page.locator('.corner-store__products').screenshot({ path: `${out}/${name}-price-cards.png` });
      await page.locator('.corner-product__label').nth(1).screenshot({ path: `${out}/${name}-price-card-detail.png` });
    }
    await page.getByTestId('daily-clout-pack').screenshot({ path: `${out}/${name}-daily-free-pack.png` });
    await page.getByRole('button', { name: 'Claim free', exact: true }).click();
    const freeReceipt = page.getByTestId('market-purchase-success');
    await expect(page.getByRole('dialog')).toHaveAccessibleName('Daily pack claimed');
    await expect(freeReceipt).toHaveAttribute('data-receipt-kind', 'daily');
    await expect(freeReceipt).toContainText('50 Clout is in your account.');
    await expect(freeReceipt.locator('.market-receipt__seal')).toContainText('FREE');
    await expect(freeReceipt.locator('.market-receipt__record')).not.toContainText('ORDER /');
    await page.locator('.market-thank-you-bag').evaluate(img => img.decode());
    await expect.poll(() => page.locator('.market-bag-item').evaluate(el => Number(getComputedStyle(el).opacity))).toBeGreaterThan(.5);
    await page.screenshot({ path: `${out}/${name}-daily-bagging.png` });
    await expect(page.locator('.market-bag-item')).toHaveCSS('opacity', '0');
    await page.getByRole('dialog').screenshot({ path: `${out}/${name}-daily-receipt.png` });
    expect(requests).toHaveLength(0);
    await page.getByRole('button', { name: 'Keep browsing' }).click();
    await expect(page.getByRole('button', { name: 'Claimed', exact: true })).toBeDisabled();
    expect(dailyClaims).toBe(1);
    await expect(page.locator('.city-header__balance:not(.city-header__shards)')).toContainText('1,300');
    const shopTabs = page.getByRole('navigation', { name: 'Shop departments' });
    for (const tab of ['Training', 'Recruit']) {
      await shopTabs.getByRole('button', { name: tab, exact: true }).click();
      await expect(page.getByTestId('daily-clout-pack')).toHaveCount(0);
    }
    await shopTabs.getByRole('button', { name: 'Fade Market', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Claimed', exact: true })).toBeDisabled();
    if (width < 800) {
      const row = page.locator('.corner-store__products');
      await row.focus(); await page.keyboard.press('End');
      await row.evaluate(el => el.scrollTo({ left: el.scrollWidth, behavior: 'instant' }));
      await expect(page.locator('.corner-product').last()).toBeInViewport();
    }
    const labels = page.getByRole('navigation', { name: 'Fade Market shelves' });
    const styleLabel = labels.getByRole('button', { name: 'Card styles' });
    if (width < 800) await styleLabel.tap(); else await styleLabel.click();
    await expect(page.getByRole('region', { name: 'style shelf' })).toBeVisible();
    await expect(page.getByTestId('daily-clout-pack')).toHaveCount(0);
    await expect(page.locator('.corner-product--crate')).toHaveCount(2);
    await page.locator('.corner-product--crate img').first().evaluate(img => img.decode());
    await expect(page.locator('.corner-product--crate').last()).toHaveCSS('opacity', '1');
    await expect(page.getByRole('region', { name: 'style shelf' })).toHaveCSS('opacity', '1');
    if (width < 800) await page.locator('.bodega-shelf-heading').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/${name}-milk-crates.png` });
    await page.locator('.corner-product button').first().click();
    await expect(page.getByRole('dialog')).toContainText('Showcase preview');
    await expect(page.getByRole('button', { name: 'Proceed to Checkout' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    for (const label of ['Packs', 'Shards', 'Packs']) {
      await labels.getByRole('button', { name: label, exact: true }).click();
      await expect(page.getByTestId('daily-clout-pack')).toHaveCount(0);
    }
    await labels.getByRole('button', { name: 'Clout', exact: true }).click();
    await expect(page.getByRole('region', { name: 'clout shelf' })).toBeVisible();
    await expect(page.locator('.corner-product')).toHaveCount(4);
    await expect(page.getByRole('region', { name: 'clout shelf' })).toHaveCSS('opacity', '1');
    await expect(page.locator('.corner-product').last()).toHaveCSS('opacity', '1');
    if (width < 800) {
      await page.locator('.game-route-stage').evaluate(el => el.scrollTop = 490);
      await page.screenshot({ path: `${out}/${name}-shelf-detail.png` });
    }
    await page.locator('.corner-product:not(.corner-product--daily) button').first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('$2.99');
    await expect(dialog.getByRole('button', { name: 'Proceed to Checkout' })).toBeDisabled();
    await expect(dialog.getByTestId('text-corner-tax-disclosure')).toContainText('final total');
    await page.screenshot({ path: `${out}/${name}-confirmation.png` });
    const rect = await dialog.boundingBox();
    expect(rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= width + 1 && rect.y + rect.height <= height + 1).toBe(true);
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await dialog.getByLabel('I am at least 18 years old.').check();
    await dialog.getByLabel('I am located in the United States.').check();
    await dialog.getByRole('button', { name: 'Proceed to Checkout' }).click();
    await expect(page.getByTestId('market-purchase-success')).toBeVisible();
    await expect(page.getByTestId('market-purchase-success')).toContainText('500 Clout is in your account.');
    await expect(page.getByTestId('market-purchase-success')).toContainText('$3.23');
    await expect(page.getByTestId('market-purchase-success')).toContainText(ORDER_ID);
    await expect.poll(() => page.getByRole('dialog').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    await page.locator('.market-thank-you-bag').evaluate(img => img.decode());
    await expect.poll(() => page.locator('.market-bag-item').evaluate(el => Number(getComputedStyle(el).opacity))).toBeGreaterThan(.5);
    await page.screenshot({ path: `${out}/${name}-bagging.png` });
    await expect(page.locator('.market-bag-item')).toHaveCSS('opacity', '0');
    await page.screenshot({ path: `${out}/${name}-success.png` });
    if (width > 800) await page.getByRole('dialog').screenshot({ path: `${out}/${name}-receipt.png` });
    await page.getByRole('button', { name: 'Keep browsing' }).click();
    expect(requests).toHaveLength(1);
    expect(requests[0].offerId).toBe('clout-pocket');
    expect(errors).toEqual([]);
    await page.close();
    console.log(`${name}: daily pack placement and claim, shop/shelf tabs, horizontal displays, preview, confirmation and fulfilled bagging passed.`);
  }
} finally { await browser.close(); }
