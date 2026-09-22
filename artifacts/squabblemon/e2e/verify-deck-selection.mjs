import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:23293';
const browser = await chromium.launch({ headless: true });

const selectedDeck = page => page.locator('[data-testid="deck-carousel"]').first().getAttribute('data-selected-deck');
async function assertCentered(page, message) {
  await page.waitForTimeout(100);
  const offset = await page.locator('[data-testid="deck-carousel"]').first().evaluate(carousel => {
    const viewport = carousel.querySelector('.deck-carousel__viewport');
    const active = carousel.querySelector('.deck-carousel__slide[aria-hidden="false"]');
    if (!viewport || !active) return Number.POSITIVE_INFINITY;
    const outer = viewport.getBoundingClientRect();
    const inner = active.getBoundingClientRect();
    return Math.abs((outer.left + outer.width / 2) - (inner.left + inner.width / 2));
  });
  assert.ok(offset < 2, `${message}: active slide was ${offset}px off center`);
}

try {
  const page = await browser.newPage({ viewport: { width: 980, height: 900 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/multiplayer/ranked', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ room: null }) }),
  );

  await page.goto(`${origin}/e2e/deck-selection.fixture.html?mode=decks&account=account-a`);
  await page.getByLabel('Jump to deck').first().selectOption('deck-two');
  await page.waitForFunction(() => document.querySelector('[data-testid="deck-carousel"]')?.getAttribute('data-selected-deck') === 'deck-two');
  assert.equal(await selectedDeck(page), 'deck-two');
  await assertCentered(page, 'manual deck-builder selection');

  await page.reload();
  assert.equal(await selectedDeck(page), 'deck-two', 'deck builder should restore after reload');
  await assertCentered(page, 'reloaded deck-builder selection');

  await page.goto(`${origin}/e2e/deck-selection.fixture.html?mode=story&account=account-a`);
  assert.equal(await selectedDeck(page), 'deck-two', 'Story launch should share the last valid deck');
  await assertCentered(page, 'Story launch selection');

  await page.goto(`${origin}/e2e/deck-selection.fixture.html?mode=park&account=account-a`);
  assert.equal(await selectedDeck(page), 'deck-two', 'Fade Park should share the last valid deck');
  await assertCentered(page, 'Fade Park selection');

  await page.goto(`${origin}/e2e/deck-selection.fixture.html?mode=story&account=account-b`);
  assert.equal(await selectedDeck(page), 'deck-one', 'another account must not inherit account-a selection');

  await page.goto(`${origin}/e2e/deck-selection.fixture.html?mode=story&account=account-a&invalid=1`);
  assert.equal(await selectedDeck(page), 'deck-one', 'a deleted remembered deck must fall back to an available deck');
  assert.deepEqual(errors, []);
  console.log('Deck selection browser proof passed: manual selection, reload, Story, Fade Park, centering, account isolation, and deleted-deck fallback.');
} finally {
  await browser.close();
}