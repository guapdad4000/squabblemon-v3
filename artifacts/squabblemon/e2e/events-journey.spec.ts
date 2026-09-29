import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { profileBootstrap } from './fighter-id.fixture';

const base = '/squabblemon';
const shots = 'test-results/events/screenshots';
mkdirSync(shots, { recursive: true });
const destinations = [
  { id: 'block-party-weekend', title: 'Block Party', action: 'Enter the Fadecade', path: '/game/challenges', content: /Fadecade|Challenge/i },
  { id: 'rules-1-1-roster-pass', title: 'Rules 1.1 · Roster Pass', action: 'Open gang builder', path: '/game/decks', content: /The Lineup/i },
  { id: 'ranked-fight-night', title: 'Friday Fight Night', action: 'Open online play', path: '/game/online', content: /Friendly|Fade|room/i },
];

async function init(page: Page, seat: 'a' | 'b' = 'a', mocked = true) {
  await page.context().addCookies([{ name: 'events_test_seat', value: seat, url: `http://127.0.0.1:${process.env.EVENTS_E2E_PORT}` }]);
  await page.addInitScript(() => {
    localStorage.setItem('squabblemon_e2e_user', 'signed-in');
    localStorage.removeItem('squabblemon_safehouse_lighting');
  });
  // Vite HMR must not replace the source snapshot during the journey.
  await page.routeWebSocket('**', socket => socket.close());
  if (mocked) {
    const bootstrap = profileBootstrap({ id: 'events-mock-writer', displayName: 'Board Reader', avatarKey: 'kyle' });
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/player/bootstrap') return route.fulfill({ json: bootstrap });
      if (path.startsWith('/api/player/mail')) return route.fulfill({ json: { messages: [] } });
      if (path === '/api/events/feedback') return route.fulfill({ json: { posts: [], nextCursor: null } });
      // Other game-shell queries cannot reach a real service in mock mode.
      return route.fulfill({ status: 503, json: { error: `Not part of events mock: ${path}` } });
    });
  }
}

async function visit(page: Page, path = '/game/events') {
  await page.goto(`${base}${path}`);
  await expect(page.locator('.bulletin-shell')).toBeVisible({ timeout: 60_000 });
}
async function openBoard(page: Page) {
  await page.getByRole('button', { name: 'Explore the bulletin board' }).click();
  await page.getByRole('button', { name: 'Read the board' }).click();
  await expect(page.getByTestId('dialog-bulletin')).toBeVisible();
}
async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: `${shots}/${name}.png`, fullPage: false, animations: 'disabled' });
}
// Do not let Playwright auto-scroll a hidden element into view: prove ordinary
// user scrolling reaches it, and that the click point belongs to the control.
async function reachable(page: Page, locator: Locator, mode: 'wheel' | 'keyboard' = 'wheel') {
  await expect(locator).toBeAttached();
  for (let i = 0; i < 60; i++) {
    const geometry = await locator.evaluate(el => {
      const target = el.getBoundingClientRect();
      let owner: Element | null = el.parentElement;
      while (owner) {
        const style = getComputedStyle(owner);
        if (owner.scrollHeight > owner.clientHeight + 2 && /auto|scroll/.test(style.overflowY)) break;
        owner = owner.parentElement;
      }
      const scroller = owner?.getBoundingClientRect();
      const clipTop = Math.max(0, scroller?.top ?? 0);
      const clipBottom = Math.min(innerHeight, scroller?.bottom ?? innerHeight);
      return {
        top: target.top, bottom: target.bottom,
        clipTop, clipBottom,
        pointerX: scroller ? Math.min(innerWidth - 2, Math.max(2, scroller.left + scroller.width / 2)) : innerWidth / 2,
        pointerY: (clipTop + clipBottom) / 2,
      };
    });
    if (geometry.top >= geometry.clipTop + 2 && geometry.bottom <= geometry.clipBottom - 2) {
      const hit = await locator.evaluate(el => {
        const rect = el.getBoundingClientRect();
        const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return !!top && (el === top || el.contains(top));
      });
      if (hit) return;
    }
    if (mode === 'wheel') {
      await page.mouse.move(geometry.pointerX, geometry.pointerY);
      const direction = geometry.bottom > geometry.clipBottom - 2 ? 1 :
        geometry.top < geometry.clipTop + 2 ? -1 : 0;
      if (direction === 0) throw new Error(`Visible ${locator} is intercepted by another element`);
      await page.mouse.wheel(0, direction * Math.min(290, Math.max(70, Math.abs((geometry.top + geometry.bottom - geometry.clipTop - geometry.clipBottom) / 2))));
    } else {
      await page.keyboard.press(geometry.top < geometry.clipTop ? 'PageUp' : 'PageDown');
    }
    // Allow native smooth scroll following card expansion to settle; do not
    // accidentally reverse the wheel while the target is still moving.
    await page.waitForTimeout(100);
  }
  throw new Error(`Cannot reach or hit-test ${locator} with ${mode} scrolling`);
}

test('Safehouse marker opens corkboard, clears unread badge and restores focus on close', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await init(page);
  await page.goto(`${base}/game`);
  await expect(page.locator('.safehouse-stage')).toHaveAttribute('data-scene-ready', 'true', { timeout: 60_000 });
  const marker = page.getByRole('button', { name: 'Explore the bulletin board' });
  await expect(marker).toHaveAttribute('data-anchor-positioned', 'true');
  await expect(page.getByLabel('New bulletin posts')).toBeVisible();
  await screenshot(page, 'desktop-safehouse-marker');
  await openBoard(page);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel('New bulletin posts')).toHaveCount(0);
  await screenshot(page, 'desktop-board-top');
  await dialog.getByRole('button', { name: 'Close bulletin board' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(marker).toBeFocused();
});

for (const [index, entry] of destinations.entries()) {
  test(`popup card and expanded detail separately navigate to real ${entry.path} content`, async ({ page }) => {
    await init(page);
    // This is the Safehouse notice deep-link, not a standalone component fixture.
    await page.goto(`${base}/game?notice=events`);
    const dialog = page.getByTestId('dialog-bulletin');
    await expect(dialog).toBeVisible({ timeout: 60_000 });
    const card = dialog.getByTestId(`card-event-${entry.id}`);
    await card.getByTestId(`button-expand-${entry.id}`).click();
    await expect(card.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
    await expect(dialog.getByTestId(`detail-event-${entry.id}`)).toContainText(entry.title);
    await screenshot(page, `desktop-board-detail-${index}`);
    // Card and expanded detail are independent links to the real route.
    for (const testId of [`link-event-${entry.id}`, `link-detail-${entry.id}`]) {
      const link = dialog.getByTestId(testId);
      await expect(link).toHaveText(new RegExp(entry.action));
      await reachable(page, link);
      await link.click();
      await expect(page).toHaveURL(new RegExp(`${entry.path}$`));
      await expect(dialog).not.toBeVisible();
      if (index === 0) await expect(page.locator('main.fadecade-hub')).toBeVisible();
      else if (index === 1) await expect(page.getByRole('heading', { name: 'The Lineup' })).toBeVisible();
      else await expect(page.getByRole('main', { name: 'Fade Park ranked lobby' })).toBeVisible();
      await page.goBack();
      await expect(page).toHaveURL(/\/game\?notice=events$/);
      await expect(dialog).toBeVisible();
      await card.getByTestId(`button-expand-${entry.id}`).click();
    }
  });
}

test('both developer notes and header feedback shortcut lead to form and browser Back restores board', async ({ page }) => {
  await init(page);
  await page.goto(`${base}/game?notice=events`);
  const dialog = page.getByTestId('dialog-bulletin');
  await expect(dialog).toBeVisible({ timeout: 60_000 });
  for (const [id, action] of [['roadmap-fall-2026', 'Share a roadmap suggestion'], ['dev-note-balance', 'Send balance feedback']]) {
    const link = dialog.getByTestId(`link-note-${id}`);
    await expect(link).toHaveText(new RegExp(action));
    await reachable(page, link);
    await link.click();
    await expect(page).toHaveURL(/\/game\/events\?section=feedback$/);
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Send feedback to the devs' })).toBeVisible();
    await page.goBack();
    await expect(dialog).toBeVisible();
  }
  await reachable(page, dialog.getByTestId('link-header-feedback'));
  await dialog.getByTestId('link-header-feedback').click();
  await expect(page).toHaveURL(/\/game\/events\?section=feedback$/);
  await expect(dialog).not.toBeVisible();
  await page.goBack();
  await expect(dialog).toBeVisible();
});

test('Escape closes popup and full Events link reaches feedback form', async ({ page }) => {
  await init(page);
  await page.goto(`${base}/game?notice=events`);
  const dialog = page.getByTestId('dialog-bulletin');
  await expect(dialog).toBeVisible({ timeout: 60_000 });
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Explore the bulletin board' })).toBeFocused();
  await page.goto(`${base}/game?notice=events`);
  await expect(dialog).toBeVisible();
  await dialog.getByTestId('link-full-events').click();
  await expect(page).toHaveURL(/\/game\/events$/);
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Send feedback to the devs' })).toBeVisible();
});

test('short touch phone popup has one scrolling owner, working thumb and reachable final note', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 360, height: 480 }, hasTouch: true, isMobile: true });
  try {
    const page = await context.newPage();
    await init(page);
    await page.goto(`${base}/game`);
    await expect(page.locator('.safehouse-stage')).toHaveAttribute('data-scene-ready', 'true', { timeout: 60_000 });
    const geometry = await page.evaluate(() => {
      const rect = (el: Element | null) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
      };
      const board = document.querySelector<HTMLButtonElement>('[aria-label="Explore the bulletin board"]');
      const phone = document.querySelector<HTMLButtonElement>('[aria-label="Explore the phone"]');
      const eventsNav = document.querySelector('[aria-label="Explore the safehouse"]');
      const boardRect = board?.getBoundingClientRect();
      const center = boardRect ? { x: boardRect.x + boardRect.width / 2, y: boardRect.y + boardRect.height / 2 } : null;
      const hit = center && document.elementFromPoint(center.x, center.y);
      return {
        viewport: { width: innerWidth, height: innerHeight },
        board: rect(board), phone: rect(phone), eventsNavigation: rect(eventsNav),
        boardCenter: center,
        hit: hit ? { tag: hit.tagName, text: hit.textContent?.trim().slice(0, 80), label: hit.closest('button')?.getAttribute('aria-label'), rect: rect(hit) } : null,
        boardHit: !!board && !!hit && (board === hit || board.contains(hit)),
      };
    });
    console.log('Events touch target geometry:', JSON.stringify(geometry));
    expect(geometry.boardHit, `Bulletin marker center is intercepted: ${JSON.stringify(geometry)}`).toBe(true);
    await page.getByRole('button', { name: 'Explore the bulletin board' }).tap({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Read the board' }).tap({ timeout: 10_000 });
    const dialog = page.getByTestId('dialog-bulletin');
    await expect(dialog).toBeVisible();
    const shell = dialog.locator('.bulletin-shell');
    const metrics = await shell.evaluate(el => {
      const parent = el.parentElement!;
      return {
        ownOverflow: getComputedStyle(el).overflowY,
        dialogOverflow: getComputedStyle(parent).overflowY,
        scrolling: el.scrollHeight > el.clientHeight,
        scrollOwnerCount: [el, parent].filter(node => node.scrollHeight > node.clientHeight &&
          /auto|scroll/.test(getComputedStyle(node).overflowY)).length,
      };
    });
    expect(metrics).toMatchObject({ ownOverflow: 'auto', dialogOverflow: 'visible', scrolling: true, scrollOwnerCount: 1 });
    const cdp = await context.newCDPSession(page);
    const x = 180;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: 370 }] });
    for (const y of [335, 295, 250, 205, 160, 120]) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
      await page.waitForTimeout(25);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => shell.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    await screenshot(page, 'short-touch-popup-scroll');
    await dialog.getByTestId('link-full-events').focus();
    await page.keyboard.press('End');
    await expect.poll(() => shell.evaluate(el => el.scrollTop + el.clientHeight >= el.scrollHeight - 2)).toBe(true);
    await screenshot(page, 'short-touch-popup-last-note');
    await expect(dialog.getByTestId('link-note-dev-note-balance')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  } finally {
    await context.close();
  }
});

test('full Events page expands all cards and routes from the expanded action', async ({ page }) => {
  await init(page);
  await visit(page);
  for (const entry of destinations) {
    await page.getByTestId(`button-expand-${entry.id}`).click();
    await expect(page.getByTestId(`detail-event-${entry.id}`)).toBeVisible();
    const action = page.getByTestId(`link-detail-${entry.id}`);
    await expect(action).toContainText(entry.action);
    await reachable(page, action);
    await action.click();
    await expect(page).toHaveURL(new RegExp(`${entry.path}$`));
    if (entry.path === '/game/challenges') await expect(page.locator('main.fadecade-hub')).toBeVisible();
    else if (entry.path === '/game/decks') await expect(page.getByRole('heading', { name: 'The Lineup' })).toBeVisible();
    else await expect(page.getByRole('main', { name: 'Fade Park ranked lobby' })).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId('page-events')).toBeVisible();
  }
  await screenshot(page, 'desktop-full-events-detail');
});

for (const viewport of [
  { width: 1440, height: 900, label: 'desktop' },
  { width: 820, height: 1180, label: 'ipad' },
  { width: 1024, height: 768, label: 'tablet-landscape' },
  { width: 320, height: 568, label: 'narrow' },
  { width: 360, height: 480, label: 'short-phone' },
  { width: 667, height: 375, label: 'landscape-phone' },
]) {
  test(`board and form remain reachable with real scrolling: ${viewport.label}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await init(page);
    const longText = `Plain text stays readable: ${'A note for the dev room. '.repeat(120)}`.slice(0, 2000);
    expect(longText).toHaveLength(2000);
    const longUrl = `https://example.org/feedback/${'unbrokenword'.repeat(9)}`;
    await page.route('**/api/events/feedback**', route => route.fulfill({ json: {
      posts: [
        { id: '00000000-0000-4000-8000-000000000401', displayName: 'Board Reader', category: 'general', message: longText, createdAt: '2026-09-28T12:00:00.000Z' },
        { id: '00000000-0000-4000-8000-000000000402', displayName: 'Another Player', category: 'bug', message: `Unbroken URL in plain text: ${longUrl}`, createdAt: '2026-09-28T11:00:00.000Z' },
      ],
      nextCursor: null,
    } }));
    await visit(page);
    await expect(page.getByTestId('card-feedback-00000000-0000-4000-8000-000000000401')).toContainText(longText);
    await expect(page.getByTestId('card-feedback-00000000-0000-4000-8000-000000000402')).toContainText(longUrl);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await screenshot(page, `${viewport.label}-events-top`);
    const formSubmit = page.getByRole('button', { name: 'Submit feedback' });
    if (viewport.label === 'ipad') {
      // Tab through the actual game shell to an in-page focusable control.
      for (let index = 0; index < 30; index++) {
        if (await page.evaluate(() => !!document.activeElement?.closest('.events-page'))) break;
        await page.keyboard.press('Tab');
      }
      expect(await page.evaluate(() => !!document.activeElement?.closest('.events-page'))).toBe(true);
    }
    await reachable(page, formSubmit, viewport.label === 'ipad' ? 'keyboard' : 'wheel');
    await screenshot(page, `${viewport.label}-feedback-form`);
    await formSubmit.click();
    const category = page.getByTestId('select-feedback-category');
    await expect(page.getByRole('alert').filter({ hasText: 'Choose a category' })).toBeVisible();
    await expect(category).toBeFocused();
    await reachable(page, category, viewport.label === 'ipad' ? 'keyboard' : 'wheel');
    await category.selectOption('general');
    if (viewport.label === 'ipad') {
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await expect(formSubmit).toBeFocused();
    }
    await reachable(page, formSubmit, viewport.label === 'ipad' ? 'keyboard' : 'wheel');
    await formSubmit.click();
    const draftField = page.getByTestId('input-feedback-message');
    await expect(page.getByRole('alert').filter({ hasText: 'Write a message' })).toBeVisible();
    await expect(draftField).toBeFocused();
    await reachable(page, draftField, viewport.label === 'ipad' ? 'keyboard' : 'wheel');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const finalPost = page.getByTestId('card-feedback-00000000-0000-4000-8000-000000000402');
    if (viewport.label === 'ipad') {
      // PageDown on a focused select changes its value, and on a focused
      // textarea moves its caret. Tab naturally into the feed control first.
      await page.keyboard.press('Tab');
      await expect(formSubmit).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.getByTestId('button-feedback-refresh')).toBeFocused();
    }
    await reachable(page, finalPost, viewport.label === 'ipad' ? 'keyboard' : 'wheel');
    await screenshot(page, `${viewport.label}-feedback-feed`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
}

test('persisted writer to independent reader: real API, real PostgreSQL, reload', async ({ browser }) => {
  const writerContext: BrowserContext = await browser.newContext();
  const readerContext: BrowserContext = await browser.newContext();
  try {
    const writer = await writerContext.newPage();
    const reader = await readerContext.newPage();
    await init(writer, 'a', false);
    await init(reader, 'b', false);
    await visit(writer);
    const message = `Events cross-player browser receipt ${crypto.randomUUID()}`;
    await writer.getByRole('combobox', { name: /category/i }).selectOption('suggestion');
    await writer.getByRole('textbox', { name: /feedback|message/i }).fill(message);
    const response = writer.waitForResponse(r => r.url().includes('/api/events/feedback') && r.request().method() === 'POST');
    await writer.getByRole('button', { name: 'Submit feedback' }).click();
    const receiptResponse = await response;
    expect([200, 201]).toContain(receiptResponse.status());
    const receipt = await receiptResponse.json();
    expect(receipt).toMatchObject({
      receiptId: expect.any(String), replayed: false,
      post: { id: expect.any(String), displayName: 'Events Writer', category: 'suggestion', message },
    });
    expect(receipt.receiptId).toBe(receipt.post.id);
    expect(receipt.post.id).toMatch(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i);
    expect(Number.isNaN(Date.parse(receipt.post.createdAt))).toBe(false);
    await expect(writer.getByText(message)).toBeVisible();
    await visit(reader);
    await expect(reader.getByText(message)).toBeVisible();
    await reader.reload();
    await expect(reader.getByText(message)).toBeVisible();
    const publicResponse = await readerContext.request.get(`http://127.0.0.1:${process.env.EVENTS_E2E_PORT}/api/events/feedback?limit=50`);
    expect(publicResponse.ok()).toBe(true);
    const publicPage = await publicResponse.json();
    expect(publicPage.posts).toEqual(expect.any(Array));
    expect(publicPage.nextCursor === null || typeof publicPage.nextCursor === 'string').toBe(true);
    expect(publicPage.posts).toContainEqual(receipt.post);
    const savedCard = reader.getByTestId(`card-feedback-${receipt.post.id}`);
    await expect(savedCard.locator('.feedback-post__meta b')).toHaveText('Events Writer');
    await expect(savedCard.locator('.feedback-post__meta span')).toHaveText('Suggestion');
    await expect(savedCard.locator('p')).toHaveText(message);
    await expect(savedCard.locator('time')).toHaveAttribute('datetime', receipt.post.createdAt);
    await reachable(reader, savedCard);
    await screenshot(reader, 'real-reader-persisted-feed');
  } finally {
    await writerContext.close();
    await readerContext.close();
  }
});