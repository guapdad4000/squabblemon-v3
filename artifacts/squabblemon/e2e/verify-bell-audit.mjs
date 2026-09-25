import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.TEST_BASE_URL ?? 'http://localhost:4318';
const output = '/tmp/bell-audit';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const errors = [], requests = [], results = [], devWarnings = [];
const notices = page => page.getByTestId('notices').textContent().then(JSON.parse);
const ids = async page => (await notices(page)).map(n => n.id);
const bell = page => page.getByRole('button', { name: /Notifications,/ });
async function start(width, initScript) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  context.on('page', page => {
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') {
      const text = message.text();
      if (text.startsWith('WebSocket connection to ') || text.startsWith('[vite] failed to connect to websocket.')) devWarnings.push(text);
      else errors.push(text);
    } });
  });
  if (initScript) await context.addInitScript(initScript);
  await context.route('**/api/**', route => {
    requests.push({ method: route.request().method(), path: new URL(route.request().url()).pathname });
    return route.fulfill({ json: { pending: [], growth: { ready: false }, messages: [], state: 'claimed', chapters: [] } });
  });
  const html = await (await context.request.get(`${base}/e2e/bell-audit.fixture.html`)).text();
  await context.route('**/game**', route => route.request().resourceType() === 'document' ? route.fulfill({ contentType: 'text/html', body: html }) : route.continue());
  const page = await context.newPage();
  await page.goto(`${base}/e2e/bell-audit.fixture.html`);
  await expect(bell(page)).toBeVisible();
  return { context, page };
}
try {
  for (const width of [1440, 390, 320]) {
    const { context, page } = await start(width);
    const initial = await notices(page);
    expect(new Set(initial.map(n => n.id)).size).toBe(initial.length);
    expect([...new Set(initial.map(n => n.section))].sort()).toEqual(['bag', 'cards', 'challenges', 'growth', 'mail', 'missions', 'shop', 'story', 'style']);
    expect(initial.find(n => n.id === 'style:story-key:chapter-two')).toMatchObject({ section: 'story', href: '/game/story' });
    expect(initial.find(n => n.id === 'style:block-party-crowned')).toMatchObject({ section: 'story', href: '/game/story?node=block-crowned' });
    expect(initial.find(n => n.id === 'style:mastery:kyle').title).toContain('Mastery earned');
    expect(initial.find(n => n.id === 'style:badge:after-hours').title).toContain('Badge earned');
    await bell(page).click();
    const clear = page.getByRole('button', { name: 'Clear all', exact: true });
    await expect(clear).toBeInViewport();
    await expect(page.getByRole('button', { name: /^Dismiss / })).toHaveCount(initial.length);
    await page.locator('.notification-inbox__list').evaluate(el => { el.scrollTop = el.scrollHeight; });
    await expect(clear).toBeInViewport();
    const sizes = await page.getByRole('dialog').evaluate(el => ({ width: el.clientWidth, content: el.scrollWidth }));
    expect(sizes.content).toBeLessThanOrEqual(sizes.width);
    await page.screenshot({ path: `${output}/bell-${width}.png` });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(bell(page)).toBeFocused();
    // Every source can be dismissed directly, without navigation or server writes.
    for (const item of initial) {
      await bell(page).click();
      await page.getByRole('button', { name: `Dismiss ${item.title}`, exact: true }).click();
      await expect.poll(async () => ids(page)).not.toContain(item.id);
      await expect(clear).toBeFocused();
      await page.getByRole('button', { name: 'Close notifications' }).click();
    }
    await expect(bell(page)).toHaveAttribute('aria-label', 'Notifications, 0 updates');
    await expect(page.getByRole('button', { name: 'Claim free', exact: true })).toBeEnabled();
    await page.reload();
    await expect.poll(async () => ids(page)).toEqual([]);
    // Switching accounts in the same mounted provider must not copy receipts.
    await page.getByRole('button', { name: 'Switch player' }).click();
    await expect.poll(async () => (await ids(page)).length).toBe(initial.length);
    await bell(page).click(); await page.getByRole('button', { name: 'Clear all', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('You’re all caught up.');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Switch player' }).click();
    await expect.poll(async () => ids(page)).toEqual([]);
    // A dismissed active bounty gets a fresh reward alert when it becomes claimable.
    await page.getByRole('button', { name: 'Bounty ready' }).click();
    await expect.poll(async () => ids(page)).toEqual(['mission:audit-0:2026-09-26T00:00:00Z']);
    await bell(page).click(); await clear.click(); await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Next day' }).click();
    await expect.poll(async () => ids(page)).toEqual(['growth:water', 'daily:2026-09-26', 'attempts:2026-09-26']);
    await bell(page).click(); await clear.click(); await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'New scene' }).click();
    await expect.poll(async () => ids(page)).toEqual(['style:style:stockz:backdrop']);
    await bell(page).click(); await clear.click(); await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Gain Clout' }).click();
    await expect.poll(async () => (await notices(page)).map(n => n.title)).toEqual(['+25 Clout added to your bag']);
    await bell(page).click(); await clear.click(); await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Refresh data' }).click();
    await expect.poll(async () => ids(page)).toEqual([]);
    results.push({ width, allSourcesDismissed: initial.length, pinnedClearAll: true, keyboardFocus: true, persistentReads: true, accountSwitch: true, newDay: true, bountyTransition: true, newUnlock: true, walletGain: true });
    await context.close();
  }
  // Clear-all is atomic, persists, and propagates to another open tab.
  {
    const { context, page } = await start(390);
    const second = await context.newPage();
    await second.goto(`${base}/e2e/bell-audit.fixture.html`);
    await bell(page).click();
    await page.getByRole('button', { name: 'Clear all', exact: true }).click();
    await expect.poll(async () => ids(page)).toEqual([]);
    await expect.poll(async () => ids(second)).toEqual([]);
    // A late writer cannot replace the union of receipts already held by this tab.
    await page.evaluate(() => {
      const key = 'squabblemon:seen:v1:bell-audit';
      localStorage.setItem(key, JSON.stringify(['late-receipt']));
      window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(['late-receipt']) }));
    });
    await page.keyboard.press('Escape');
    await page.reload(); await second.reload();
    await expect.poll(async () => ids(page)).toEqual([]);
    await expect.poll(async () => ids(second)).toEqual([]);
    await expect(page.getByRole('button', { name: 'Claim free', exact: true })).toBeEnabled();
    await context.close();
  }
  // Automatic receipts keep unclaimed rewards; explicit Clear all can dismiss them.
  {
    const { context, page } = await start(390);
    const sticky = (await notices(page)).filter(n => n.sticky).map(n => n.id);
    await page.getByRole('button', { name: 'Automatic receipts' }).click();
    await expect.poll(async () => ids(page)).toEqual(sticky);
    await context.close();
  }
  // Legacy unlocks and mastery without old progress cannot become trapped by a missing target.
  {
    const { context, page } = await start(390);
    for (const id of ['style:block-party-crowned', 'style:story-key:chapter-two', 'style:mastery:kyle', 'style:old-event-unlock', 'style:style:missing:stickers']) {
      const notice = (await notices(page)).find(n => n.id === id);
      // The Extras overview also acknowledges all legacy Extras when it opens.
      if (!notice) { expect(id).toBe('style:style:missing:stickers'); continue; }
      await bell(page).click();
      await page.locator(`[data-notice-id="${id}"] .notification-item`).click();
      expect(new URL(page.url()).pathname).toBe(new URL(notice.href, base).pathname);
      await expect.poll(async () => ids(page)).not.toContain(id);
      await page.getByRole('button', { name: 'Home', exact: true }).click();
    }
    await page.reload();
    for (const id of ['style:block-party-crowned', 'style:story-key:chapter-two', 'style:mastery:kyle', 'style:old-event-unlock']) expect(await ids(page)).not.toContain(id);
    await context.close();
  }
  // Tall mobile destinations resume their read timer after bell closure and foreground return.
  for (const pause of ['bell', 'background']) {
    const { context, page } = await start(390);
    if (pause === 'background') await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.getByRole('button', { name: 'Tall preview' }).click();
    if (pause === 'bell') await bell(page).click();
    await page.waitForTimeout(850);
    expect(await ids(page)).toContain('offer:wonder-pack');
    if (pause === 'bell') await page.keyboard.press('Escape');
    else await page.evaluate(() => { delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')); });
    await expect.poll(async () => ids(page)).not.toContain('offer:wonder-pack');
    await context.close();
  }
  // Bad old storage and blocked storage must not trap alerts in this session or crash the UI.
  for (const mode of ['corrupt', 'blocked']) {
    const { context, page } = await start(390, mode === 'corrupt'
      ? () => { if (location.protocol === 'http:') localStorage.setItem('squabblemon:seen:v1:bell-audit', '{bad JSON'); }
      : () => { Storage.prototype.setItem = () => { throw new DOMException('Storage blocked', 'SecurityError'); }; });
    await bell(page).click();
    await page.getByRole('button', { name: 'Clear all', exact: true }).click();
    await expect.poll(async () => ids(page)).toEqual([]);
    await context.close();
  }
  expect(requests.filter(r => r.method !== 'GET')).toEqual([]);
  expect(errors).toEqual([]);
  await writeFile(`${output}/report.json`, JSON.stringify({ results, crossTab: true, legacyNavigation: true, timerResumption: true, storageRecovery: true, noRewardMutations: true, errors, devWarnings }, null, 2));
  console.log(JSON.stringify({ results, errors }, null, 2));
} finally { await browser.close(); }
