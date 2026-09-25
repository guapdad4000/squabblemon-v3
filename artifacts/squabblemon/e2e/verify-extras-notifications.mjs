import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.TEST_BASE_URL ?? 'http://localhost:4318';
const out = '/tmp/extras-notifications-review';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const errors = [], results = [];
const extras = ids => ids.filter(id => id.startsWith('banner:') || id.startsWith('style:style:'));
const unread = page => page.getByTestId('unread-notices').textContent().then(JSON.parse);
const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem('squabblemon:seen:v1:extras-review') ?? '[]'));
async function setup(width) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  const fixture = await (await context.request.get(`${base}/e2e/extras-notifications.fixture.html`)).text();
  await context.route('**/game**', route => route.request().resourceType() === 'document' ? route.fulfill({ contentType: 'text/html', body: fixture }) : route.continue());
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  const page = await context.newPage();
  await page.goto(`${base}/e2e/extras-notifications.fixture.html`);
  await expect.poll(async () => extras(await unread(page)).length).toBe(5);
  return { context, page };
}
try {
  for (const width of [1440, 390]) {
    const { context, page } = await setup(width);
    // A character visit clears all its Extras, including tabs the player never clicks.
    await page.getByRole('button', { name: 'Kyle Extras', exact: true }).click();
    await expect(page.getByTestId('character-styles')).toBeVisible();
    await expect.poll(async () => extras(await unread(page))).toEqual(['banner:stockz', 'style:style:stockz:stickers']);
    const kept = ['card:kyle', 'card:stockz', 'style:kyle:tagged', 'reward:keep-reward', 'daily:2026-09-25'];
    expect(await unread(page)).toEqual(expect.arrayContaining(kept));
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.reload();
    await expect.poll(async () => extras(await unread(page))).toEqual(['banner:stockz', 'style:style:stockz:stickers']);

    // Existing navigation filters cannot force the user to find each collection.
    await page.evaluate(() => sessionStorage.setItem('squabblemon:navigation:styles-search:extras-review', JSON.stringify('no such collection')));
    await page.getByRole('button', { name: 'The Extras', exact: true }).click();
    await expect(page.getByTestId('character-collections')).toBeVisible();
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.waitForTimeout(850);
    expect(extras(await unread(page))).toHaveLength(2);

    const second = await context.newPage();
    await second.goto(`${base}/e2e/extras-notifications.fixture.html`);
    await expect.poll(async () => extras(await unread(second)).length).toBe(2);
    await page.bringToFront();
    await page.getByRole('button', { name: 'The Extras', exact: true }).click();
    await expect(page.getByText('No collections match this filter.', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: /Notifications,/ }).click();
    await page.waitForTimeout(850);
    expect(extras(await unread(page))).toHaveLength(2);
    await page.getByRole('button', { name: 'Close notifications' }).click();
    await expect.poll(async () => extras(await unread(page)).length).toBe(0);
    await expect.poll(async () => extras(await unread(second)).length).toBe(0);
    await expect(page.locator('.style-library .attention-mark')).toHaveCount(0);
    expect(await unread(page)).toEqual(expect.arrayContaining(kept));
    await page.getByRole('searchbox', { name: 'Search signature collections' }).fill('');
    await page.screenshot({ path: `${out}/extras-cleared-${width}.png` });
    await second.close();

    // New unlocks still notify; background viewing does not silently consume them.
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.getByRole('button', { name: 'Grant new scene' }).click();
    await expect.poll(async () => extras(await unread(page))).toEqual(['style:style:kyle:backdrop']);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.getByRole('button', { name: 'The Extras', exact: true }).click();
    await page.waitForTimeout(850);
    expect(extras(await unread(page))).toEqual(['style:style:kyle:backdrop']);
    await page.evaluate(() => {
      delete document.visibilityState;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect.poll(async () => extras(await unread(page)).length).toBe(0);
    expect(await stored(page)).toContain('style:style:kyle:backdrop');
    await page.reload();
    await expect.poll(async () => extras(await unread(page)).length).toBe(0);
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.waitForTimeout(850);
    expect(extras(await unread(page))).toHaveLength(0);

    await page.goto(`${base}/e2e/extras-notifications.fixture.html?player=another-player`);
    await expect.poll(async () => extras(await unread(page)).length).toBe(5);
    results.push({ width, characterReceipts: true, filteredOverview: true, noClicksRequired: true, shortVisitProtection: true, dialogProtection: true, backgroundProtection: true, persistentReads: true, crossTabSync: true, newUnlocks: true, otherNoticesKept: true, playerIsolation: true });
    await context.close();
  }
  expect(errors).toEqual([]);
  await writeFile(`${out}/report.json`, JSON.stringify({ results, errors }, null, 2));
  console.log(JSON.stringify({ results, errors }, null, 2));
} finally { await browser.close(); }
