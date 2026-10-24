import { chromium, expect } from '@playwright/test';
import { profileBootstrap } from './fighter-id.fixture.ts';
import { mkdir, writeFile } from 'node:fs/promises';
const out = process.env.REVIEW_OUTPUT ?? '/tmp/market-recovery-review';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE, args: ['--no-sandbox'] });
const journal = 'squabblemon.shop.pending.v1:fighter-id-player';
const requests = [], waiting = [];
let current = profileBootstrap({ softCurrency: 1250 });
const snapshot = () => structuredClone(current);
const completed = () => ({ receipt: { itemId: 'deck-slot', cardId: null, cost: 350, currency: 'softCurrency', summary: 'Gang slot 4 unlocked.' }, bootstrap: profileBootstrap({ softCurrency: 900, deckSlots: 4 }) });
try {
 const page = await browser.newPage({ baseURL: process.env.REVIEW_BASE_URL ?? 'http://127.0.0.1:4319', viewport: { width: 1440, height: 1000 } });
 await page.routeWebSocket('**', socket => socket.close());
 await page.route('**/api/player/**', async route => {
  const path = new URL(route.request().url()).pathname;
  if (path.endsWith('/bootstrap')) return route.fulfill({ json: snapshot() });
  if (path.endsWith('/mail')) return route.fulfill({ json: { messages: [] } });
  if (path.endsWith('/notifications/receipts')) return route.fulfill({ json: { ids: [] } });
  if (path.endsWith('/catalog')) return route.fulfill({ json: { enabled: true, mode: 'test', taxMode: 'none', offers: [] } });
  if (path.endsWith('/orders')) return route.fulfill({ json: { orders: [], nextCursor: null } });
  if (path.endsWith('/daily-clout')) return route.fulfill({ json: { available: false, amount: 50, date: '2026-10-24', resetsAt: '2026-10-25T00:00:00Z' } });
  if (path.endsWith('/shop/purchases')) {
   requests.push(route.request().postDataJSON());
   await new Promise(resolve => waiting.push(async result => { await route.fulfill({ json: result }); resolve(); }));
   return;
  }
  return route.fulfill({ json: {} });
 });
 await page.goto('/e2e/payment-store.fixture.html?item=deck-slot');
 const balance = page.locator('.city-header__balance:not(.city-header__shards)');
 const slot = page.getByTestId('corner-deck-slot');
 await slot.getByRole('button', { name: /Add slot/ }).click();
 await expect.poll(() => requests.length).toBe(1);
 const original = requests[0];
 await page.getByRole('navigation', { name: 'Fade Market shelves' }).getByRole('button', { name: 'Reactions', exact: true }).click();
 await expect(slot).toHaveCount(0);
 await waiting.shift()(completed());
 await page.waitForTimeout(150);
 await expect(balance).toContainText('1,250');
 expect(await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), journal)).toEqual(original);
 await page.getByRole('navigation', { name: 'Fade Market shelves' }).getByRole('button', { name: 'Clout', exact: true }).click();
 await slot.getByRole('button', { name: /Recover purchase/ }).click();
 await expect.poll(() => requests.length).toBe(2);
 expect(requests[1]).toEqual(original);
 const foreign = { itemId: 'training', cardId: 'kyle', idempotencyKey: 'f04df666-c1ab-41c6-9fbd-d1c4f83344ee' };
 await page.evaluate(({ key, value }) => sessionStorage.setItem(key, JSON.stringify(value)), { key: journal, value: foreign });
 current = profileBootstrap({ softCurrency: 1400, deckSlots: 5 });
 await waiting.shift()(completed());
 await expect(balance).toContainText('1,400');
 await expect(slot.getByRole('link', { name: /Recover pending purchase/ })).toBeVisible();
 expect(await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), journal)).toEqual(foreign);
 // Restore this account's recoverable slot, then change the actual bootstrap
 // account while its POST remains unresolved. The old reply must stay isolated.
 await page.evaluate(({ key, value }) => sessionStorage.setItem(key, JSON.stringify(value)), { key: journal, value: original });
 await page.goto('/e2e/payment-store.fixture.html?item=deck-slot');
 await slot.getByRole('button', { name: /Recover purchase/ }).click();
 await expect.poll(() => requests.length).toBe(3);
 current = profileBootstrap({ id: 'other-account', softCurrency: 7777, deckSlots: 7 });
 await page.locator('.corner-store__orders > summary').click();
 await page.getByRole('button', { name: 'Refresh history' }).click();
 await expect(balance).toContainText('7,777');
 await expect(slot).toContainText('7 / 24 unlocked');
 await waiting.shift()(completed());
 await page.waitForTimeout(150);
 await expect(balance).toContainText('7,777');
 await expect(slot).toContainText('7 / 24 unlocked');
 expect(await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), journal)).toEqual(original);
 for (const width of [390, 320]) {
  await page.setViewportSize({ width, height: 844 });
  await page.locator('.game-route-stage').evaluate(el => { el.scrollTop = 0; });
  await page.locator('.corner-store__interior').evaluate(img => img.decode());
  await page.screenshot({ path: `${out}/${width}-final-counter.png` });
  expect(await page.getByRole('navigation', { name: 'Fade Market shelves' }).getByRole('button').evaluateAll(nodes => nodes.every(node => node.scrollWidth <= node.clientWidth + 1))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 }
 await page.close();
 await writeFile(`${out}/late-response-results.json`, JSON.stringify({ passed: 3, routeUnmountPreserved: true, newerJournalPreserved: true, accountSwitchIsolated: true, sameKeyRequests: requests, mobileLabelContainment: [390, 320] }, null, 2));
 console.log('PASS: delayed reply after route unmount, newer shared journal, and account switch; mobile labels contained390/320.');
} finally { await browser.close(); }
