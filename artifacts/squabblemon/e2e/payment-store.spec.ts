import { expect, test, type Page, type Route } from '@playwright/test';

const fixturePath = '/e2e/payment-store.fixture.html';
const stripeCheckoutUrl = 'https://checkout.stripe.com/c/pay/cs_test_mock_payment_fixture';
const ORDER_ID = '1712345678901-d9428888-122b-4f4e-9f6f-9c2a3f349a11';
const REVERSED_ORDER_ID = '1712345678902-a9428888-122b-4f4e-8f6f-9c2a3f349a12';
const RETRY_ORDER_ID = '1712345678903-b9428888-122b-4f4e-af6f-9c2a3f349a13';
const OTHER_DEVICE_ORDER_ID = '1712345678904-c9428888-122b-4f4e-bf6f-9c2a3f349a14';

const catalog = {
  version: 'mock-catalog-v1',
  taxMode: 'automatic',
  mode: 'test',
  enabled: true,
  message: 'Mock HTTP catalog for browser coverage only. This is not payment evidence.',
  supportUrl: 'https://support.example.test/payments',
  refundPolicyUrl: 'https://support.example.test/refunds',
  offers: [
    { id: 'clout-pocket', name: 'Server pocket', amountMinor: 1234, currency: 'usd', clout: 500, enabled: true },
    { id: 'clout-stack', name: 'Server stack', amountMinor: 2345, currency: 'usd', clout: 1500, enabled: false },
    { id: 'clout-bag', name: 'Server bag', amountMinor: 3456, currency: 'usd', clout: 4000, enabled: true },
  ],
};

function bootstrap(softCurrency = 100) {
  const now = '2026-10-01T12:00:00.000Z';
  return {
    profile: {
      id: 'payment-fixture-player',
      displayName: 'Mock Browser Player',
      username: 'mock-browser-player',
      avatarKey: 'cornball',
      onboardingStep: 'complete',
      starterDeckId: null,
      level: 7,
      xp: 0,
      streetRep: 321,
      softCurrency,
      styleShards: 0,
      packTickets: 0,
      packPity: 0,
      deckSlots: 3,
      cosmeticCurrency: 0,
      collectionProgress: 0,
      storyChapter: 0,
      storyNode: 0,
      tutorialCompleted: true,
      starterRewardClaimed: true,
      ageConfirmedAt: now,
      termsAcceptedAt: now,
      savedDecks: [],
      ownedCardIds: [],
      cardProgression: {},
      discoveredCardIds: [],
      ownedVariants: [],
      equippedVariants: {},
      unlockedCosmeticIds: [],
      unlockedCharacterIds: [],
      storyProgress: {},
      inbox: [],
      packHistory: [],
      lastActiveAt: now,
      settings: { reducedMotion: true, turnTimerEnabled: true },
    },
    missions: [],
    nextAction: null,
    packConfig: {
      id: 'fixture-pack',
      name: 'Fixture Pack',
      oddsVersion: 'fixture',
      softCurrencyCost: 200,
      ticketCost: 1,
      rewardsPerPack: 6,
      pityLimit: 10,
      odds: [],
    },
    tenPullConfig: {
      id: 'fixture-ten-pull',
      name: 'Fixture Ten Pull',
      oddsVersion: 'fixture',
      pullCount: 10,
      ticketCost: 9,
      softCurrencyCost: 1800,
      rewardsPerPull: 6,
      rarePityBonusPerPull: 1,
    },
    collectionRoad: [],
  };
}

function order(status: string, overrides: Record<string, unknown> = {}) {
  const finalized = ['fulfilled', 'refunded', 'disputed'].includes(status);
  return {
    id: ORDER_ID,
    offerId: 'clout-pocket',
    offerName: 'Server pocket',
    mode: 'test',
    currency: 'usd',
    amountMinor: 1234,
    taxMode: 'automatic',
    taxAmountMinor: finalized ? 99 : null,
    totalAmountMinor: finalized ? 1333 : null,
    clout: 500,
    status,
    createdAt: '2026-10-01T12:00:00.000Z',
    fulfilledAt: status === 'fulfilled' ? '2026-10-01T12:01:00.000Z' : null,
    refundedAmountMinor: status === 'refunded' ? 1333 : 0,
    checkoutUrl: status === 'pending' ? stripeCheckoutUrl : null,
    ...overrides,
  };
}

async function mockBootstrap(page: Page, values: number[] = [100]) {
  let requests = 0;
  await page.route('**/api/player/bootstrap', async route => {
    // React StrictMode remounts the fixture once in development. Keep both
    // bootstrap reads on the initial value; later invalidation gets the update.
    const valueIndex = values.length > 1 ? Math.max(0, requests - 1) : requests;
    const value = values[Math.min(valueIndex, values.length - 1)];
    requests += 1;
    await json(route, bootstrap(value));
  });
  return () => requests;
}

async function mockCatalog(page: Page, value = catalog, delay = 0) {
  await page.route('**/api/player/payments/catalog', async route => {
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    await json(route, value);
  });
}

async function mockEmptyHistory(page: Page) {
  await page.route('**/api/player/payments/orders', route => json(route, { orders: [], nextCursor: null }));
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
    headers: { 'x-payment-fixture': 'mock-http-not-payment-evidence' },
  });
}

async function openStore(page: Page, suffix = '') {
  await page.goto(fixturePath + suffix, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/game\/shop\?/);
  await expect(page).toHaveURL(/[?&]view=corner(?:&|$)/);
  if (suffix.includes('order=')) {
    await expect(page.getByTestId('corner-order-status')).toBeVisible();
  } else {
    await expect(page.getByRole('heading', { name: /Fade Market/i })).toBeVisible();
  }
}

async function selectPocket(page: Page) {
  const product = page.locator('.corner-product').filter({ hasText: 'Server pocket' });
  await product.getByRole('button').click();
  await expect(page.getByRole('dialog')).toContainText('Server pocket');
  await expect(page.getByRole('button', { name: /Proceed to Checkout/i })).toBeDisabled();
  await page.getByLabel('I am at least 18 years old.').check();
  await expect(page.getByRole('button', { name: /Proceed to Checkout/i })).toBeDisabled();
  await page.getByLabel('I am located in the United States.').check();
  return page.getByRole('dialog');
}

test.beforeEach(async ({ page }) => {
  await mockEmptyHistory(page);
});

test('checkout links to public local policies when catalog URLs are unset', async ({ page }) => {
  await mockBootstrap(page);
  await mockCatalog(page, { ...catalog, supportUrl: '', refundPolicyUrl: '' });
  await openStore(page);

  const dialog = await selectPocket(page);
  await expect(dialog.getByTestId('link-corner-support')).toHaveAttribute('href', '/support');
  await expect(dialog.getByTestId('link-corner-refund-policy')).toHaveAttribute('href', '/refund-policy');
});

test('an older catalog response does not imply that tax is included', async ({ page }) => {
  await mockBootstrap(page);
  const { taxMode: _omittedTaxMode, ...olderCatalog } = catalog;
  await mockCatalog(page, olderCatalog);
  await openStore(page);

  const product = page.locator('.corner-product').filter({ hasText: 'Server pocket' });
  await expect(product.getByRole('button')).toContainText('$12.34 · final shown by Stripe');
  const dialog = await selectPocket(page);
  await expect(dialog.getByTestId('text-corner-tax-disclosure')).toContainText('Tax status is unavailable');
  await expect(dialog).not.toContainText('No additional tax');
});

test('automatic tax quote and server-confirmed order totals remain truthful', async ({ page }) => {
  await mockBootstrap(page);
  await mockCatalog(page);
  await page.unroute('**/api/player/payments/orders');
  await page.route('**/api/player/payments/orders', route => json(route, {
    orders: [
      order('fulfilled'),
      order('fulfilled', {
        id: '1712345678905-d9428888-122b-4f4e-9f6f-9c2a3f349a13',
        offerName: 'Zero-tax automatic order',
        taxAmountMinor: 0,
        totalAmountMinor: 1234,
      }),
      order('pending', {
        id: '1712345678906-d9428888-122b-4f4e-9f6f-9c2a3f349a14',
        offerName: 'Pending tax order',
      }),
      order('fulfilled', {
        id: '1712345678907-d9428888-122b-4f4e-9f6f-9c2a3f349a15',
        offerName: 'Historical no-tax order',
        taxMode: 'none',
        taxAmountMinor: null,
        totalAmountMinor: null,
      }),
    ],
    nextCursor: null,
  }));

  await openStore(page);
  const dialog = await selectPocket(page);
  await expect(dialog.getByTestId('text-corner-tax-disclosure')).toContainText('Applicable tax is calculated automatically');
  await expect(dialog).toContainText('Bundle price');
  await expect(dialog).toContainText('$12.34');
  await page.screenshot({ path: 'e2e/screenshots/payment-tax-checkout.png' });
  await dialog.getByRole('button', { name: 'Close' }).click();

  await page.getByText('Your Orders', { exact: true }).click();
  const taxed = page.getByTestId('corner-history-order').filter({ hasText: 'Server pocket' });
  await expect(taxed).toContainText('$13.33');
  await expect(taxed).toContainText('Base $12.34');
  await expect(taxed).toContainText('Tax $0.99');

  const zeroTax = page.getByTestId('corner-history-order').filter({ hasText: 'Zero-tax automatic order' });
  await expect(zeroTax).toContainText('$12.34');
  await expect(zeroTax).toContainText('Tax $0.00');

  const pending = page.getByTestId('corner-history-order').filter({ hasText: 'Pending tax order' });
  await expect(pending).toContainText('Base $12.34');
  await expect(pending).toContainText('Final total not yet confirmed');

  const historical = page.getByTestId('corner-history-order').filter({ hasText: 'Historical no-tax order' });
  await expect(historical).toContainText('$12.34');
  await expect(historical).not.toContainText('Final total not yet confirmed');
  await taxed.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'e2e/screenshots/payment-tax-history.png' });
});

test('server catalog is authoritative, including loading, unavailable, and disabled configuration', async ({ page }) => {
  await mockBootstrap(page);
  await mockCatalog(page, catalog, 500);
  await page.goto(fixturePath, { waitUntil: 'domcontentloaded' });

  const loadingOffer = page.locator('.corner-product').filter({ hasText: 'Unavailable bundle' }).first();
  await expect(loadingOffer.getByRole('button')).toBeDisabled();
  const pocket = page.locator('.corner-product').filter({ hasText: 'Server pocket' });
  await expect(pocket.getByRole('button')).toContainText('$12.34');
  const disabled = page.locator('.corner-product').filter({ hasText: 'Server stack' });
  await expect(disabled.getByRole('button')).toBeDisabled();

  await page.unroute('**/api/player/payments/catalog');
  await mockCatalog(page, {
    ...catalog,
    version: 'mock-disabled',
    enabled: false,
    message: 'Mock payment configuration missing.',
    offers: [],
  });
  await openStore(page);
  await expect(page.getByText('Mock payment configuration missing.')).toBeVisible();
  const unavailable = page.locator('.corner-product').filter({ hasText: 'Unavailable bundle' });
  await expect(unavailable).toHaveCount(3);
  await expect(unavailable.first().getByRole('button')).toBeDisabled();
  await expect(page.getByRole('button', { name: /Proceed to Checkout/i })).toHaveCount(0);
});

test('checkout sends only authoritative offer and one stable UUID across double tap and retry, then intercepts Stripe HTTPS', async ({ page }) => {
  await mockBootstrap(page);
  await mockCatalog(page);
  const requests: Array<Record<string, unknown>> = [];
  await page.route('**/api/player/payments/checkout', async route => {
    requests.push(await route.request().postDataJSON());
    if (requests.length === 1) {
      await new Promise(resolve => setTimeout(resolve, 250));
      await json(route, { message: 'mock checkout failure' }, 503);
      return;
    }
    await json(route, { order: order('pending'), checkoutUrl: stripeCheckoutUrl });
  });
  await page.route('https://checkout.stripe.com/**', route => route.fulfill({
    contentType: 'text/html; charset=utf-8',
    body: '<title>Mock Stripe interception - no charge</title><h1>Mock Stripe interception - no charge</h1>',
    headers: { 'x-payment-fixture': 'mock-http-not-payment-evidence' },
  }));

  await openStore(page);
  const dialog = await selectPocket(page);
  const checkout = dialog.getByRole('button', { name: /Proceed to Checkout/i });
  await checkout.evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  await expect(dialog.getByRole('alert')).toContainText(/checkout|connect/i);
  expect(requests).toHaveLength(1);

  await checkout.click();
  await expect(page).toHaveURL(stripeCheckoutUrl);
  await expect(page.getByRole('heading', { name: 'Mock Stripe interception - no charge' })).toBeVisible();
  expect(requests).toHaveLength(2);
  for (const body of requests) {
    expect(Object.keys(body).sort()).toEqual(['adultConfirmed', 'idempotencyKey', 'offerId', 'unitedStatesConfirmed']);
    expect(body.adultConfirmed).toBe(true);
    expect(body.unitedStatesConfirmed).toBe(true);
    expect(body.offerId).toBe('clout-pocket');
    expect(body.idempotencyKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  }
  expect(requests[1].idempotencyKey).toBe(requests[0].idempotencyKey);
});

test('pending and processing never credit, fulfilled refetches bootstrap, and modal can be cancelled', async ({ page }) => {
  const bootstrapRequests = await mockBootstrap(page, [100, 600]);
  await mockCatalog(page);
  let serverStatus = 'pending';
  await page.route(`**/api/player/payments/orders/${ORDER_ID}`, route => {
    return json(route, order(serverStatus));
  });

  await openStore(page, `?view=corner&payment=cancel&campaign=red&order=${ORDER_ID}`);
  const status = page.getByTestId('corner-order-status');
  await expect(page.getByText(/Checkout was closed/)).toBeVisible();
  await expect(status).toContainText(/pending/i);
  await expect(status).toContainText('Final total not yet confirmed');
  await expect(page.locator('.city-header__balance')).toContainText('100');
  await expect(status).not.toContainText('Added 500 Clout');
  serverStatus = 'processing';
  await expect(status).toContainText(/processing/i, { timeout: 7_000 });
  await expect(page.locator('.city-header__balance')).toContainText('100');
  await expect(status).not.toContainText('Added 500 Clout');
  serverStatus = 'fulfilled';
  await expect(status).toContainText(/fulfilled/i, { timeout: 7_000 });
  await expect(page.locator('.city-header__balance')).toContainText('600');
  expect(bootstrapRequests()).toBeGreaterThanOrEqual(3);
  await status.getByRole('button', { name: /Return to Market/i }).click();
  await expect(page).not.toHaveURL(/order=/);
  await expect(page).not.toHaveURL(/payment=/);
  await expect(page).toHaveURL(/campaign=red/);
  await expect(status).toHaveCount(0);
});

for (const reversal of ['refunded', 'disputed']) {
  test(`${reversal} is disclosed without granting another reward`, async ({ page }) => {
    await mockBootstrap(page);
    await mockCatalog(page);
    await page.route(`**/api/player/payments/orders/${REVERSED_ORDER_ID}`, route => json(route, order(reversal, {
      id: REVERSED_ORDER_ID,
      refundedAmountMinor: reversal === 'refunded' ? 1333 : 0,
    })));
    await openStore(page, `?order=${REVERSED_ORDER_ID}`);
    const status = page.getByTestId('corner-order-status');
    await expect(status).toContainText(new RegExp(reversal, 'i'));
    await expect(status).toContainText('$13.33');
    if (reversal === 'refunded') await expect(status).toContainText('Refunded $13.33');
    await expect(status).not.toContainText(/Added 500 Clout/i);
    await expect(page.locator('.city-header__balance')).toContainText('100');
  });
}

test('history refresh discovers an order completed on another device', async ({ page }) => {
  await mockBootstrap(page);
  await mockCatalog(page);
  let histories = 0;
  let showOtherDevice = false;
  await page.unroute('**/api/player/payments/orders');
  await page.route('**/api/player/payments/orders', route => {
    histories += 1;
    const orders = showOtherDevice ? [order('fulfilled', {
      id: OTHER_DEVICE_ORDER_ID,
      offerName: 'Other-device pocket',
    })] : [];
    return json(route, { orders, nextCursor: null });
  });

  await openStore(page);
  await page.getByText('Your Orders').click();
  await expect(page.getByText('NO PURCHASES FOUND')).toBeVisible();
  showOtherDevice = true;
  await page.getByRole('button', { name: 'Refresh history' }).click();
  const historyOrder = page.getByTestId('corner-history-order');
  await expect(historyOrder).toContainText('Other-device pocket');
  await expect(historyOrder.getByRole('button', { name: 'Details' })).toBeVisible();
  expect(histories).toBeGreaterThanOrEqual(2);
});

test('order 401 offers sign-in and preserves the full game return search', async ({ page }) => {
  await mockBootstrap(page);
  await mockCatalog(page);
  await page.route(`**/api/player/payments/orders/${RETRY_ORDER_ID}`, route =>
    json(route, { error: 'Mock authentication expired.' }, 401));
  await openStore(page, `?fixtureGamePath=true&view=corner&campaign=red&order=${RETRY_ORDER_ID}`);
  const status = page.getByTestId('corner-order-status');
  await expect(status).toContainText('Mock authentication expired.');
  const signIn = status.getByRole('link', { name: 'Sign in to check purchase' });
  await expect(signIn).toHaveAttribute('href', '/sign-in');
  await signIn.evaluate((link: HTMLAnchorElement) => {
    link.addEventListener('click', event => event.preventDefault(), { once: true });
    link.click();
  });
  expect(await page.evaluate(() => sessionStorage.getItem('squabblemon_after_sign_in')))
    .toBe(`/game/shop?view=corner&campaign=red&order=${RETRY_ORDER_ID}`);
});

test('order 404 has an explicit manual retry path', async ({ page }) => {
    await mockBootstrap(page);
    await mockCatalog(page);
    let attempts = 0;
    let retryRequested = false;
    await page.route(`**/api/player/payments/orders/${RETRY_ORDER_ID}`, route => {
      attempts += 1;
      return retryRequested
        ? json(route, order('failed', { id: RETRY_ORDER_ID }))
        : json(route, { error: 'Mock order not found.' }, 404);
    });
    await openStore(page, `?order=${RETRY_ORDER_ID}`);
    const dialog = page.getByTestId('corner-order-status');
    await expect(dialog).toContainText('Mock order not found.');
    retryRequested = true;
    await dialog.getByRole('button', { name: 'Check again' }).click();
    await expect(dialog).toContainText(/failed/i);
    expect(attempts).toBeGreaterThanOrEqual(2);
});

test('legacy demo tampering is ignored and unsupported showcase remains inspectable preview-only', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('squabblemon:corner-demo:v1:payment-fixture-player', JSON.stringify({
      version: 1,
      clout: 999_999_999,
      receipts: [{ id: 'forged', offerId: 'wiz-pack', at: new Date().toISOString() }],
    }));
  });
  await mockBootstrap(page);
  await mockCatalog(page);
  await openStore(page);
  await expect(page.locator('.city-header__balance')).toContainText('100');
  await expect(page.locator('body')).not.toContainText('999,999,999');

  await page.getByRole('button', { name: 'Packs', exact: true }).click();
  const emerald = page.locator('.corner-product').filter({ hasText: 'Emerald City' });
  await emerald.getByRole('button', { name: 'View' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Showcase preview only. This item is not currently for sale.');
  await expect(dialog.getByRole('button', { name: /checkout|purchase|buy/i })).toHaveCount(0);
});

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
]) {
test(`real Shop route stays wheel and keyboard reachable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
  await mockBootstrap(page);
  await mockCatalog(page);
  await page.unroute('**/api/player/payments/orders');
  const pending = order('pending', {
    id: OTHER_DEVICE_ORDER_ID,
    offerName: 'Last pending fixture order',
    createdAt: '2026-10-01T12:04:00.000Z',
  });
  await page.route('**/api/player/payments/orders', route => json(route, {
    orders: [
      order('fulfilled', { offerName: 'Earlier fulfilled order' }),
      pending,
    ],
    nextCursor: null,
  }));
  await page.route(`**/api/player/payments/orders/${OTHER_DEVICE_ORDER_ID}`, route => json(route, pending));

    await page.setViewportSize(viewport);
    await openStore(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    const stage = page.locator('.game-route-stage');
    const lastBundle = page.locator('.corner-product').filter({ hasText: 'Server bag' });
    const lastBundleButton = lastBundle.getByRole('button');
    const reachable = async (locator: typeof lastBundleButton, decorativeMargin = 0) => locator.evaluate((element, margin) => {
      const box = element.getBoundingClientRect();
      const headerBottom = document.querySelector('.city-header')?.getBoundingClientRect().bottom ?? 0;
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return box.top >= headerBottom - margin && box.bottom <= innerHeight + margin && box.left >= -margin &&
        box.right <= innerWidth + margin && (hit === element || element.contains(hit));
    }, decorativeMargin);
    const wheelTo = async (locator: typeof lastBundleButton, container = stage) => {
      await container.hover();
      for (let attempt = 0; attempt < 25 && !(await reachable(locator)); attempt += 1) {
        await page.mouse.wheel(0, Math.max(150, Math.floor(viewport.height * 0.5)));
        await page.waitForTimeout(80);
      }
      expect(await reachable(locator), `unreachable action at ${viewport.width}×${viewport.height}`).toBe(true);
    };
    await wheelTo(lastBundleButton);

    await lastBundleButton.focus();
    await page.keyboard.press('Home');
    await expect.poll(() => stage.evaluate(element => element.scrollTop)).toBe(0);
    await page.keyboard.press('End');
    await expect.poll(() => stage.evaluate(element =>
      Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop))).toBeLessThanOrEqual(1);

    const orders = page.getByText('Your Orders', { exact: true });
    expect(await reachable(orders)).toBe(true);
    await orders.click();
    const historyOrders = page.getByTestId('corner-history-order');
    await expect(historyOrders).toHaveCount(2);
    const lastPending = historyOrders.last();
    await expect(lastPending).toContainText('Last pending fixture order');
    const historyAddress = lastPending.getByRole('textbox', { name: /Stripe checkout address/i });
    await wheelTo(historyAddress);
    await expect(historyAddress).toHaveValue(stripeCheckoutUrl);
    const resume = lastPending.getByRole('button', { name: /Resume \/ details/i });
    expect(await reachable(resume)).toBe(true);
    await resume.click();

    const status = page.getByTestId('corner-order-status');
    await expect(status).toContainText(/pending/i);
    await expect(status.getByRole('textbox', { name: 'Secure checkout link' })).toHaveValue(stripeCheckoutUrl);
    const checkLater = status.getByRole('button', { name: 'Check Later' });
    // Dialogs own their own native scroll on short/landscape screens.
    await wheelTo(checkLater, status);
    await page.screenshot({ path: `e2e/screenshots/payment-order-route-${viewport.width}.png` });
    await checkLater.click();
    await expect(status).toHaveCount(0);

    const shopTabs = page.getByRole('navigation', { name: 'Shop departments' });
    await stage.hover();
    await page.mouse.wheel(0, -10000);
    await expect.poll(() => stage.evaluate(element => element.scrollTop)).toBe(0);
    await page.screenshot({ path: `e2e/screenshots/payment-store-route-${viewport.width}.png` });
    for (const name of ['Recruit', 'Training', 'Fade Market']) {
      const button = shopTabs.getByRole('button', { name });
      const geometry = await button.evaluate(element => {
        const rect = element.getBoundingClientRect();
        return {
          button: rect.toJSON(),
          header: document.querySelector('.city-header')?.getBoundingClientRect().toJSON(),
          hit: document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)?.outerHTML.slice(0, 300),
        };
      });
      // Rotated paper tabs extend 1.2px above their layout box on landscape
      // phones. Allow only that decorative edge; the center must receive hits.
      expect(await reachable(button, 2), `${name}: ${JSON.stringify(geometry)}`).toBe(true);
      await shopTabs.getByRole('button', { name }).click();
      await expect(shopTabs.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'true');
    }
    await expect(page).toHaveURL(/[?&]view=corner(?:&|$)/);

    const shelves = page.getByRole('navigation', { name: 'Fade Market shelves' });
    for (const name of ['Clout', 'Packs', 'Card styles', 'Shards']) {
      await wheelTo(shelves.getByRole('button', { name, exact: true }));
      await shelves.getByRole('button', { name, exact: true }).click();
      await expect(shelves.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
    }
});
}