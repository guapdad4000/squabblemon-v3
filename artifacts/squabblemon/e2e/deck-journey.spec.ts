import { expect, test, type Page } from '@playwright/test';

const browserErrors = new WeakMap<Page, string[]>();
const missingResources = new WeakMap<Page, string[]>();

test.setTimeout(90_000);

async function enterGame(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('squabblemon_e2e_user', 'signed-in');
    if (!sessionStorage.getItem('deck-journey-initialized')) {
      localStorage.removeItem('squabblemon.preview-decks.v1');
      sessionStorage.clear();
      sessionStorage.setItem('deck-journey-initialized', 'true');
    }
  });
  // The isolated Vite server has no /api backend. Supply only the shell's
  // background reads; an unexpected API request should still fail the journey.
  const shellReads: Record<string, unknown> = {
    '/api/player/bootstrap': {},
    '/api/player/mail': { messages: [] },
    '/api/player/shop/daily-clout': {
      date: '2026-09-27', available: false, amount: 50, attemptsRemaining: 0, resetsAt: '2026-09-28T00:00:00.000Z',
    },
    '/api/player/notifications/receipts': { ids: [] },
    '/api/player/rewards/account': { date: '2026-09-27', pending: [], growth: { ready: false } },
    '/api/player/rewards/starter-mythic': { state: 'claimed' },
  };
  await page.route('**/api/player/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'GET' && Object.hasOwn(shellReads, path)) {
      return route.fulfill({ json: shellReads[path] });
    }
    return route.fulfill({ status: 501, json: { error: `Unexpected deck journey request: ${path}` } });
  });
}

async function openFirstExample(page: Page) {
  await page.goto('/squabblemon/game/decks');
  await page.getByRole('group').filter({ has: page.getByText(/Learning examples ·/) }).locator('summary').click();
  await page.getByRole('button', { name: /Build from example:/ }).first().click();
  await expect(page.getByRole('textbox', { name: 'Deck name' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('navigation', { name: 'Your cards and gangs' }).getByRole('link', { name: /Decks/ })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  const resources: string[] = [];
  browserErrors.set(page, errors);
  missingResources.set(page, resources);
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const detail = `console: ${message.text()} (${message.location().url})`;
    // HTTP failures are recorded from responses below, with the actual URL
    // and status. Browser resource messages are not JavaScript exceptions.
    if (!/^Failed to load resource:/.test(message.text())) errors.push(detail);
  });
  page.on('response', response => {
    const type = response.request().resourceType();
    const contentType = response.headers()['content-type'] ?? '';
    // Vite can return its SPA index with HTTP 200 for a nonexistent image.
    if (response.status() >= 400 || (type === 'image' && !/^image\//i.test(contentType))) {
      resources.push(`${response.status()} ${response.request().method()} ${response.url()} (${type}; content-type: ${contentType || 'missing'})`);
    }
  });
  page.on('requestfailed', request => {
    if (request.resourceType() === 'image' && request.failure()?.errorText !== 'net::ERR_ABORTED') {
      resources.push(`request failed ${request.url()} (${request.failure()?.errorText ?? 'unknown error'})`);
    }
  });
  await enterGame(page);
});

test.afterEach(async ({ page }, testInfo) => {
  const errors = browserErrors.get(page) ?? [];
  const resources = missingResources.get(page) ?? [];
  if (resources.length) await testInfo.attach('missing-resources', { body: resources.join('\n'), contentType: 'text/plain' });
  if (errors.length) await testInfo.attach('browser-errors', { body: errors.join('\n'), contentType: 'text/plain' });
  expect(errors, `Browser errors during ${testInfo.title}`).toEqual([]);
  expect(resources, `Failed resource/API responses during ${testInfo.title}`).toEqual([]);
});

test('list, editor, test, browser history, and saved-example redirects form one journey', async ({ page }) => {
  await openFirstExample(page);
  const exampleUrl = page.url();

  const name = page.getByRole('textbox', { name: 'Deck name' });
  await name.fill('Journey Gang');
  await page.getByRole('button', { name: 'Test deck', exact: true }).click();
  await expect(page).toHaveURL(/\/game\/decks\/[^/]+\/test$/);

  await page.goBack();
  await expect(page).toHaveURL(/\/game\/decks\/[^/]+$/);
  await expect(page.getByRole('textbox', { name: 'Deck name' })).toHaveValue('Journey Gang');
  expect(page.url()).not.toBe(exampleUrl);

  await page.goForward();
  await expect(page).toHaveURL(/\/game\/decks\/[^/]+\/test$/);
  await page.goBack();
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Deck name' })).toHaveValue('Journey Gang');
  await page.getByRole('navigation', { name: 'Your cards and gangs' }).getByRole('link', { name: /Decks/ }).click();
  await expect(page).toHaveURL(/\/game\/decks$/);
  await expect(page.getByRole('button', { name: /Edit deck: Journey Gang/ })).toBeVisible();
});

test('unsaved edits offer save, discard, or stay for in-app and browser exits', async ({ page }) => {
  await openFirstExample(page);
  await page.getByRole('textbox', { name: 'Deck name' }).fill('Unsaved Journey');

  const decksTab = page.getByRole('navigation', { name: 'Your cards and gangs' }).getByRole('link', { name: /Decks/ });
  await decksTab.click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('Save your deck changes?');
  await dialog.getByRole('button', { name: 'Stay here' }).click();
  await expect(page.getByRole('textbox', { name: 'Deck name' })).toHaveValue('Unsaved Journey');

  await page.getByRole('link', { name: /Test Player/ }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Stay here' }).click();
  await expect(page).toHaveURL(/\/game\/decks\/[^/]+$/);

  await page.evaluate(() => history.back());
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Discard changes' }).click();
  await expect(page).toHaveURL(/\/game\/decks$/);

  await page.getByRole('group').filter({ has: page.getByText(/Learning examples ·/) }).locator('summary').click();
  await page.getByRole('button', { name: /Build from example:/ }).first().click();
  await page.getByRole('textbox', { name: 'Deck name' }).fill('Saved While Leaving');
  await decksTab.click();
  await dialog.getByRole('button', { name: 'Save and leave' }).click();
  await expect(page).toHaveURL(/\/game\/decks$/);
  await expect(page.getByRole('button', { name: /Edit deck: Saved While Leaving/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: /Edit deck: Saved While Leaving/ })).toBeVisible();
});

test('dirty browser forward restores the editor or proceeds to the test as chosen', async ({ page }) => {
  await openFirstExample(page);
  await page.getByRole('textbox', { name: 'Deck name' }).fill('Forward Guard Gang');
  await page.getByRole('button', { name: 'Test deck', exact: true }).click();
  await expect(page).toHaveURL(/\/test$/);
  await page.goBack();
  await expect(page.getByRole('textbox', { name: 'Deck name' })).toHaveValue('Forward Guard Gang');

  await page.getByRole('textbox', { name: 'Deck name' }).fill('Changed Before Forward');
  await page.evaluate(() => history.forward());
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Stay here' }).click();
  await expect(page).toHaveURL(/\/game\/decks\/[^/]+$/);
  await expect(page.getByRole('textbox', { name: 'Deck name' })).toHaveValue('Changed Before Forward');

  await page.evaluate(() => history.forward());
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Discard changes' }).click();
  await expect(page).toHaveURL(/\/test$/);
});

test('direct, missing, and refreshed deck links recover without trapping the player', async ({ page }) => {
  await page.goto('/squabblemon/game/decks');
  await page.goto('/squabblemon/game/decks/does-not-exist');
  await expect(page.getByText('Deck not found.')).toBeVisible();
  // The missing-deck recovery control is owned by the separate exits work.
  // Browser history must still provide a route out until that UI is available.
  await page.goBack();
  await expect(page).toHaveURL(/\/game\/decks$/);

  await openFirstExample(page);
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Deck name' })).toBeVisible();
});

test('reports a broken deck image even if the server returns HTML with status 200', async ({ page }) => {
  await page.route('**/assets/deck-workshop/gang-*.webp', route => route.fulfill({
    status: 200, contentType: 'text/html', body: '<!doctype html><title>Missing image fallback</title>',
  }));
  await page.goto('/squabblemon/game/decks');
  const failedArt = page.locator('img[src*="/assets/deck-workshop/gang-"]');
  await expect(failedArt).toBeVisible();
  await expect.poll(() => failedArt.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth === 0)).toBe(true);
  const resources = missingResources.get(page)!;
  await expect.poll(() => resources.filter(detail =>
    detail.includes('/assets/deck-workshop/gang-') && detail.includes('content-type: text/html'),
  )).not.toEqual([]);
  // Remove only the deliberate failure; afterEach still checks every other request.
  for (let index = resources.length - 1; index >= 0; index--) {
    if (resources[index].includes('/assets/deck-workshop/gang-') && resources[index].includes('content-type: text/html')) {
      resources.splice(index, 1);
    }
  }
});