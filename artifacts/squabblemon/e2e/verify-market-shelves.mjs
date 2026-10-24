import { chromium, expect } from '@playwright/test';
import { profileBootstrap } from './fighter-id.fixture.ts';
import { mkdir, writeFile } from 'node:fs/promises';

// Real Shop/CornerStore components with intercepted HTTP. No real purchases.
const out = process.env.REVIEW_OUTPUT ?? '/tmp/market-shelf-review';
await mkdir(out, { recursive: true });
const ORDER_ID = '1712345678901-d9428888-122b-4f4e-9f6f-9c2a3f349a11';
const journal = 'squabblemon.shop.pending.v1:fighter-id-player';
const offers = [
  { id: 'clout-pocket', name: 'Pocket Clout', amountMinor: 299, currency: 'usd', clout: 500, enabled: true },
  { id: 'clout-stack', name: 'Clout Stack', amountMinor: 699, currency: 'usd', clout: 1500, enabled: true },
  { id: 'clout-bag', name: 'Big Clout Bag', amountMinor: 1499, currency: 'usd', clout: 4000, enabled: true },
];
const layoutOnly = process.env.REVIEW_LAYOUT_ONLY === '1';
const cases = layoutOnly
  ? [['320', 320, 740], ['390', 390, 844], ['430', 430, 932], ['540', 540, 960], ['768', 768, 1024], ['1024', 1024, 768], ['1440', 1440, 1000], ['1920', 1920, 1080]]
  : [['desktop', 1440, 1000], ['phone', 390, 844], ['small-phone', 320, 740]];
const results = [];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE, args: ['--no-sandbox'] });
async function imagesReady(scope) {
  await scope.locator('img').evaluateAll(images => Promise.all(images.filter(img => img.getBoundingClientRect().width > 0).map(img => img.decode().catch(() => {}))));
}
try {
  for (const [name, width, height] of cases) {
    if (process.env.REVIEW_VIEWPORT && !process.env.REVIEW_VIEWPORT.split(',').includes(name)) continue;
    const page = await browser.newPage({ baseURL: process.env.REVIEW_BASE_URL ?? 'http://127.0.0.1:4319', viewport: { width, height }, hasTouch: width < 800 });
    await page.routeWebSocket('**', socket => socket.close());
    const errors = [], cashRequests = [], slotRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    let fulfilled = false, dailyClaimed = false, dailyClaims = 0, slotGranted = false, capped = false;
    const bootstrap = () => profileBootstrap({ softCurrency: 1250 + (fulfilled ? 500 : 0) + (dailyClaimed ? 50 : 0) - (slotGranted ? 350 : 0), deckSlots: capped ? 24 : slotGranted ? 4 : 3 });
    const dailyStatus = () => ({ available: !dailyClaimed, amount: 50, date: '2026-10-24', attemptsRemaining: 2, resetsAt: '2026-10-25T00:00:00Z' });
    await page.route('**/api/player/**', route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/mail')) return route.fulfill({ json: { messages: [] } });
      if (path.endsWith('/notifications/receipts')) return route.fulfill({ json: { ids: route.request().method() === 'POST' ? route.request().postDataJSON().ids : [] } });
      if (path.endsWith('/bootstrap')) return route.fulfill({ json: bootstrap() });
      if (path.endsWith('/catalog')) return route.fulfill({ json: { version: 'market-review', taxMode: 'automatic', mode: 'test', enabled: true, supportUrl: '', refundPolicyUrl: '', offers } });
      if (path.endsWith('/orders')) return route.fulfill({ json: { orders: [], nextCursor: null } });
      if (path.endsWith('/daily-clout')) return route.fulfill({ json: dailyStatus() });
      if (path.endsWith('/daily-clout/claim')) { dailyClaimed = true; dailyClaims++; return route.fulfill({ json: { claimed: true, amount: 50, status: dailyStatus() } }); }
      if (path.endsWith('/shop/purchases')) {
        slotRequests.push(route.request().postDataJSON());
        slotGranted = true;
        // Simulate a committed purchase whose first response is lost. Recovery
        // returns that same result, rather than charging the wallet again.
        if (slotRequests.length === 1) return route.fulfill({ status: 503, json: { error: 'Lost purchase response' } });
        return route.fulfill({ json: { receipt: { itemId: 'deck-slot', cardId: null, cost: 350, currency: 'softCurrency', summary: 'Gang slot 4 unlocked.' }, bootstrap: bootstrap() } });
      }
      if (path.endsWith('/checkout')) {
        cashRequests.push(route.request().postDataJSON()); fulfilled = true;
        return route.fulfill({ json: { checkoutUrl: null, order: { id: ORDER_ID, offerId: 'clout-pocket', offerName: 'Pocket Clout', status: 'fulfilled', clout: 500, amountMinor: 299, currency: 'usd', taxMode: 'automatic', taxAmountMinor: 24, totalAmountMinor: 323, refundedAmountMinor: 0, fulfilledAt: '2026-10-24T12:00:00Z' } } });
      }
      return route.fulfill({ json: {} });
    });
    await page.goto('/e2e/payment-store.fixture.html');
    await expect(page.locator('.corner-product')).toHaveCount(4);
    const tabs = page.getByRole('navigation', { name: 'Fade Market shelves' });
    await expect(tabs.getByRole('button')).toHaveCount(3);
    await expect(tabs.getByRole('button', { name: 'Card styles', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Style Closet', exact: true })).toHaveAttribute('href', '/game/style?view=finishes');
    await imagesReady(page.locator('.corner-store'));
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByTestId('daily-clout-pack')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Claim free', exact: true })).toBeEnabled();
    expect(await page.locator('.corner-product__label').evaluateAll(labels => labels.every(label => label.scrollWidth <= label.clientWidth + 1))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `${out}/${name}-counter.png` });
    const boxes = await page.locator('.corner-product__display').evaluateAll(items => items.map(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
    expect(boxes.every(box => Math.abs(box.y - boxes[0].y) < 1)).toBe(true);
    expect(boxes.every(box => box.w / box.h > 1.1 && box.w / box.h < 1.25)).toBe(true);
    if (layoutOnly) {
      const rail = page.getByRole('region', { name: 'clout shelf' });
      const surface = await page.locator('.corner-store__counter').evaluate(node => ({ image: getComputedStyle(node).backgroundImage, color: getComputedStyle(node).backgroundColor, width: node.clientWidth }));
      expect(surface.image).toBe('none');
      expect(surface.color).toBe('rgba(0, 0, 0, 0)');
      const railMetrics = await rail.evaluate(node => ({ width: node.clientWidth, scrollWidth: node.scrollWidth, gap: parseFloat(getComputedStyle(node).columnGap) }));
      const cards = await rail.locator('.corner-product').evaluateAll(nodes => nodes.map(node => ({ width: node.getBoundingClientRect().width, labelFits: node.querySelector('.corner-product__label').scrollWidth <= node.querySelector('.corner-product__label').clientWidth + 1, actionHeight: node.querySelector('button').getBoundingClientRect().height, imageFit: getComputedStyle(node.querySelector('.corner-product__display > img')).objectFit })));
      expect(cards.every(card => card.width >= (width <= 540 ? 130 : 220) && card.width <= 400 && card.labelFits && card.actionHeight >= 44 && card.imageFit === 'contain')).toBe(true);
      if (surface.width >= 1120) expect(railMetrics.scrollWidth - railMetrics.width).toBeLessThanOrEqual(1);
      else expect(railMetrics.scrollWidth).toBeGreaterThan(railMetrics.width);
      await rail.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${out}/${name}-shelf.png` });
      for (const card of await rail.locator('.corner-product').all()) {
        await card.evaluate(node => node.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' }));
        expect(await card.evaluate(node => { const r = node.getBoundingClientRect(), parent = node.parentElement.getBoundingClientRect(); return r.x >= parent.x - 1 && r.right <= parent.right + 1; })).toBe(true);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await tabs.getByRole('button', { name: 'Showcase', exact: true }).click();
      const showcase = page.getByRole('region', { name: 'pack shelf' });
      await expect(showcase.locator('.corner-product')).toHaveCount(2);
      await expect(showcase).toHaveCSS('opacity', '1');
      await imagesReady(showcase);
      for (const card of await showcase.locator('.corner-product').all()) {
        await card.evaluate(node => node.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' }));
        expect(await card.evaluate(node => { const r = node.getBoundingClientRect(), parent = node.parentElement.getBoundingClientRect(); return r.x >= parent.x - 1 && r.right <= parent.right + 1; })).toBe(true);
      }
      await showcase.locator('.corner-product').first().getByRole('button', { name: 'View cards', exact: true }).click();
      await expect(page.getByRole('dialog')).toContainText('not currently for sale');
      await page.keyboard.press('Escape');
      expect(errors).toEqual([]);
      results.push({ name, width, height, surface, railMetrics, cards, everyProductReachable: true, noDocumentOverflow: true, errors });
      await page.close();
      console.log(`${name}: no chalk texture; dynamic shelf widths; every product reachable; preview opens; no document overflow PASS`);
      continue;
    }
    await page.getByRole('button', { name: 'Claim free', exact: true }).click();
    const freeReceipt = page.getByTestId('market-purchase-success');
    await expect(page.getByRole('dialog')).toHaveAccessibleName('Daily pack claimed');
    await expect(freeReceipt).toHaveAttribute('data-receipt-kind', 'daily');
    await expect(freeReceipt).toContainText('50 Clout is in your account.');
    await expect(freeReceipt.locator('.market-receipt__record')).not.toContainText('ORDER /');
    await imagesReady(freeReceipt);
    await expect(page.locator('.market-bag-item')).toHaveCSS('opacity', '0');
    await page.getByRole('dialog').screenshot({ path: `${out}/${name}-daily-receipt.png` });
    await page.getByRole('button', { name: 'Keep browsing', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Claimed', exact: true })).toBeDisabled();
    expect(dailyClaims).toBe(1); expect(cashRequests).toHaveLength(0);
    await tabs.getByRole('button', { name: 'Showcase', exact: true }).click();
    await expect(page.getByRole('region', { name: 'pack shelf' })).toBeVisible();
    await expect(page.locator('.corner-product')).toHaveCount(2);
    await expect(page.getByTestId('daily-clout-pack')).toHaveCount(0);
    await page.locator('.corner-product button').first().click();
    await expect(page.getByRole('dialog')).toContainText('not currently for sale');
    await expect(page.getByRole('button', { name: 'Proceed to Checkout' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await tabs.getByRole('button', { name: 'Reactions', exact: true }).click();
    await expect(page.getByTestId('shelf-reaction-starters')).toBeVisible();
    await expect(page.getByTestId('corner-deck-slot')).toHaveCount(0);
    await tabs.getByRole('button', { name: 'Clout', exact: true }).click();
    await expect(page.locator('.corner-product')).toHaveCount(4);
    if (width < 800) {
      const rail = page.getByRole('region', { name: 'clout shelf' });
      await rail.focus(); await rail.evaluate(el => el.scrollTo({ left: el.scrollWidth, behavior: 'instant' }));
      await expect(page.locator('.corner-product').last()).toBeInViewport();
    }
    await page.locator('.corner-product:not(.corner-product--daily) button').first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('500 Clout');
    await expect(dialog).toContainText('$2.99');
    await expect(dialog.getByRole('button', { name: 'Proceed to Checkout' })).toBeDisabled();
    await expect(dialog.getByTestId('text-corner-tax-disclosure')).toContainText('final total');
    await expect(dialog.getByTestId('link-corner-refund-policy')).toBeVisible();
    await page.screenshot({ path: `${out}/${name}-checkout.png` });
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await dialog.getByLabel('I am at least 18 years old.').check();
    await expect(dialog.getByRole('button', { name: 'Proceed to Checkout' })).toBeDisabled();
    await dialog.getByLabel('I am located in the United States.').check();
    await dialog.getByRole('button', { name: 'Proceed to Checkout' }).click();
    await expect(page.getByTestId('market-purchase-success')).toContainText('$3.23');
    await expect(page.getByTestId('market-purchase-success')).toContainText(ORDER_ID);
    await page.getByRole('button', { name: 'Keep browsing' }).click();
    expect(cashRequests).toHaveLength(1);
    expect(cashRequests[0]).toMatchObject({ offerId: 'clout-pocket', adultConfirmed: true, unitedStatesConfirmed: true });
    const slot = page.getByTestId('corner-deck-slot');
    await slot.getByRole('button', { name: /Add slot/ }).click();
    await expect(slot.getByRole('alert')).toContainText('Purchase not confirmed');
    const saved = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), journal);
    expect(saved).toMatchObject({ itemId: 'deck-slot' });
    await slot.getByRole('button', { name: /Recover purchase/ }).click();
    await expect(slot.getByRole('status')).toContainText('Gang slot 4 unlocked.');
    await expect(slot).toContainText('Paid 350 Clout');
    await expect(slot).toContainText('4 / 24 unlocked');
    expect(slotRequests).toHaveLength(2); expect(slotRequests[0]).toEqual(slotRequests[1]);
    expect(await page.evaluate(key => sessionStorage.getItem(key), journal)).toBeNull();
    await slot.screenshot({ path: `${out}/${name}-deck-receipt.png` });
    // A request saved by another surface after mount must still block this tag.
    const foreign = { itemId: 'training', cardId: 'kyle', idempotencyKey: '5723fdef-2993-4e55-a133-b417e0076fde' };
    await page.evaluate(({ key, value }) => sessionStorage.setItem(key, JSON.stringify(value)), { key: journal, value: foreign });
    await slot.getByRole('button', { name: /Add slot/ }).click();
    await expect(slot.getByRole('link', { name: /Recover pending purchase/ })).toHaveAttribute('href', '/game/shop?view=training&item=training&card=kyle');
    expect(await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), journal)).toEqual(foreign);
    expect(slotRequests).toHaveLength(2);
    await page.locator('.corner-store__orders > summary').click();
    await expect(page.getByText('NO PURCHASES FOUND', { exact: true })).toBeVisible();
    await page.evaluate(key => sessionStorage.removeItem(key), journal);
    capped = true;
    await page.goto('/e2e/payment-store.fixture.html?item=deck-slot');
    await expect(page.getByTestId('corner-deck-slot')).toContainText('All 24 gang slots are unlocked.');
    await expect(page.getByTestId('corner-deck-slot').getByRole('button')).toBeDisabled();
    expect(slotRequests).toHaveLength(2);
    await page.goto('/e2e/payment-store.fixture.html?shelf=shards');
    await expect(page).toHaveURL(/\/game\/style\?view=finishes/);
    expect(errors).toEqual([]);
    results.push({ name, width, height, boxes, dailyClaims, cashRequests: cashRequests.length, slotRequests, foreignPreserved: true, cappedDisabled: true, errors });
    await page.close();
    console.log(`${name}: shelf art/layout, daily receipt, showcase/reactions, tax/checkout, same-key deck recovery, foreign journal, cap and legacy Closet route PASS`);
  }
} finally { await browser.close(); await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2)); }
