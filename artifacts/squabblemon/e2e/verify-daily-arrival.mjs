import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { profileBootstrap } from './fighter-id.fixture.ts';
import { accountStatus } from './popup-test-responses.mjs';

const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:4245';
const output = process.env.REVIEW_OUTPUT ?? '/tmp/daily-arrival';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE, args: ['--enable-unsafe-swiftshader'] });
const report = [];
try {
  for (const [width, height] of (process.env.DAILY_EDGE_ONLY ? [] : [[1440, 1000], [390, 844], [320, 568], [844, 390]])) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(20000);
    await page.routeWebSocket('**', socket => socket.close());
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const bootstrap = profileBootstrap({ id: `daily-${width}`, displayName: 'HOME COURT', settings: { reducedMotion: true, turnTimerEnabled: false } });
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86400000).toISOString();
    const reward = { key: `login:${today}`, date: today, title: 'Day 7 login reward', streak: 7, softCurrency: 300, packTickets: 2, styleShards: 25 };
    let status = { ...accountStatus, date: today, streak: 7, claimedToday: false, nextResetAt: tomorrow, pending: [reward] };
    let claims = 0, committed = false;
    await page.addInitScript(({ player, block, skew }) => {
      if (skew) { const now = Date.now; Date.now = () => now() + 8 * 86400000; }
      localStorage.setItem('squabblemon_e2e_user', 'signed-in');
      localStorage.setItem(`squabblemon:starter-mythic:${player}:intro`, '1');
      localStorage.setItem(`squabblemon:starter-mythic:${player}:ready`, '1');
      localStorage.setItem('squabblemon-gpu-tier-v2', 'low');
      if (block) document.addEventListener('DOMContentLoaded', () => { const d = document.createElement('dialog'); d.id = 'arrival-blocker'; d.textContent = 'An existing invitation'; document.body.append(d); d.showModal(); });
    }, { player: bootstrap.profile.id, block: width === 1440, skew: width === 390 });
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/bootstrap')) return route.fulfill({ json: bootstrap });
      if (path.endsWith('/rewards/account/claim')) {
        claims++;
        if (claims === 1 && width === 1440) return route.fulfill({ status: 503, json: { error: 'Temporary failure' } });
        const rewards = committed ? [] : [reward];
        if (!committed) { bootstrap.profile.softCurrency += 300; bootstrap.profile.packTickets += 2; bootstrap.profile.styleShards += 25; committed = true; }
        status = { ...status, claimedToday: true, pending: [] };
        // Mobile case: server committed but the response was lost; retry must not pretend to award twice.
        if (claims === 1 && width === 390) return route.fulfill({ status: 503, json: { error: 'Response lost' } });
        return route.fulfill({ json: { rewards, status, bootstrap } });
      }
      return route.fulfill({ json: path.endsWith('/rewards/account') ? status : path.endsWith('/challenges/runs') || path.endsWith('/events/patches') ? [] : { chapters: [], nodes: [], receipts: [], pending: [], items: [], messages: [], ids: [], state: 'claimed', reward: {} } });
    });
    await page.goto(`${origin}/game?gpuTier=low`);
    await page.locator('.safehouse-stage').waitFor();
    if (width === 1440) {
      await page.waitForTimeout(2700); await expect(page.locator('.daily-arrival')).not.toHaveAttribute('open', '');
      await page.locator('#arrival-blocker').evaluate(element => element.remove());
    }
    const popup = page.locator('.daily-arrival');
    await expect(popup).toHaveAttribute('open', '');
    assert.equal(await page.locator('dialog[open]').count(), 1, 'Only one dialog at a time');
    await expect(popup).toContainText('Style Shards');
    await expect(popup).toContainText('Tickets');
    assert.equal(await popup.locator('details').count(), 0, 'Daily calendar is always visible');
    const fit = await popup.evaluate(element => { const r = element.getBoundingClientRect(); return { width: r.width, height: r.height, fits: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, noHorizontalScroll: element.scrollWidth <= element.clientWidth + 1 }; });
    assert.ok(fit.fits && fit.noHorizontalScroll, JSON.stringify(fit));
    await page.screenshot({ path: `${output}/daily-${width}x${height}.png` });
    if (width === 320) {
      await popup.getByRole('button', { name: 'Later · keep my reward', exact: true }).click();
      assert.equal(claims, 0, 'Dismissal never claims rewards');
      await page.reload(); await page.locator('.safehouse-stage').waitFor(); await page.waitForTimeout(2700);
      await expect(page.locator('.daily-arrival')).not.toHaveAttribute('open', '');
      const nextDate = tomorrow.slice(0, 10);
      status = { ...status, date: nextDate, streak: 8, nextResetAt: new Date(Date.parse(tomorrow) + 86400000).toISOString(), pending: [{ ...reward, key: `login:${nextDate}`, date: nextDate, streak: 8 }] };
      await page.reload(); await expect(page.locator('.daily-arrival')).toHaveAttribute('open', '');
      await page.locator('.daily-arrival').getByRole('button', { name: 'Later · keep my reward', exact: true }).click();
      assert.equal(claims, 0, 'A new server day can show again without auto-claiming');
    } else {
      await popup.getByRole('button', { name: 'Collect check-in', exact: true }).click();
      if (width === 1440 || width === 390) { await expect(popup.getByRole('alert')).toContainText('Couldn’t confirm'); await popup.getByRole('button', { name: 'Retry check-in', exact: true }).click(); }
      await expect(popup).toHaveAttribute('data-receipt', 'true');
      if (width === 390) await expect(popup).toContainText('Already collected');
      else { await expect(popup).toContainText('+300'); await expect(popup).toContainText('+25'); }
      assert.equal(bootstrap.profile.softCurrency, 550); assert.equal(bootstrap.profile.packTickets, 2); assert.equal(bootstrap.profile.styleShards, 325);
      await popup.getByRole('button', { name: 'Let’s play', exact: true }).click();
      await expect(popup).not.toHaveAttribute('open', '');
      await page.reload(); await page.locator('.safehouse-stage').waitFor(); await page.waitForTimeout(2700);
      await expect(page.locator('.daily-arrival')).not.toHaveAttribute('open', '');
    }
    assert.deepEqual(errors, []);
    report.push({ width, height, fit, claims, committed, errors });
    console.log(`PASS daily arrival ${width}×${height}: modal queue, rewards, responsive frame, no repeat`);
    await page.close();
  }

  for (const scenario of [
    { name: 'new-buddy', blocker: 'radix', owned: false, shardConversion: 0, returnsBuddy: true, recruit: true },
    { name: 'duplicate-known', blocker: 'custom', owned: true, shardConversion: 25, returnsBuddy: true, recruit: false },
    { name: 'duplicate-stale', owned: false, shardConversion: 25, returnsBuddy: true, recruit: false },
    { name: 'already-owned-no-shards', owned: true, shardConversion: 0, returnsBuddy: true, recruit: false },
    { name: 'missing-returned-buddy', owned: false, shardConversion: 0, returnsBuddy: false, recruit: false },
    { name: 'receipt-new-day', owned: false, shardConversion: 0, returnsBuddy: false, recruit: false, midnight: true },
  ]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const player = `daily-edge-${scenario.name}`;
    const today = '2026-10-24', nextDate = '2026-10-25';
    const login = { key: `login:${today}`, date: today, title: 'Daily reward', streak: 7, softCurrency: 300, packTickets: 2, styleShards: 25 };
    const buddy = { key: 'growth:buddy', date: today, title: 'Buddy', softCurrency: 0, packTickets: 0, styleShards: scenario.shardConversion, cardId: 'buddy' };
    let status = { ...accountStatus, date: today, streak: 7, claimedToday: false, nextResetAt: `${nextDate}T00:00:00Z`, pending: [login] };
    let claims = 0;
    const returnedBootstrap = profileBootstrap({ id: player });
    returnedBootstrap.profile.ownedCardIds = scenario.returnsBuddy ? ['buddy'] : [];
    await page.route('**/api/**', route => {
      if (new URL(route.request().url()).pathname.endsWith('/rewards/account/claim')) {
        claims++; status = { ...status, claimedToday: true, pending: [] };
        return route.fulfill({ json: { rewards: scenario.midnight ? [login] : [login, buddy], status, bootstrap: returnedBootstrap } });
      }
      return route.fulfill({ json: status });
    });
    const search = new URLSearchParams({ player, ...(scenario.owned ? { owned: '1' } : {}), ...(scenario.blocker ? { blocker: scenario.blocker } : {}) });
    await page.goto(`${origin}/e2e/daily-arrival.fixture.html?${search}`);
    const popup = page.locator('.daily-arrival');
    if (scenario.blocker) {
      await page.getByRole('button', { name: 'Close blocker' }).waitFor();
      await page.waitForTimeout(2500);
      await expect(popup).not.toHaveAttribute('open', '');
      await page.getByRole('button', { name: 'Close blocker' }).click();
    }
    await expect(popup).toHaveAttribute('open', '');
    await popup.getByRole('button', { name: 'Collect check-in', exact: true }).click();
    await expect(popup).toHaveAttribute('data-receipt', 'true');
    if (scenario.midnight) {
      status = { ...status, date: nextDate, streak: 8, claimedToday: false, nextResetAt: '2026-10-26T00:00:00Z', pending: [{ ...login, key: `login:${nextDate}`, date: nextDate, streak: 8 }] };
      await page.evaluate(next => window.__dailySetStatus(next), status);
      await expect(popup).toContainText('Day 7');
    }
    await popup.getByRole('button', { name: 'Let’s play', exact: true }).click();
    await expect(popup).not.toHaveAttribute('open', '');
    assert.equal(await page.evaluate(() => Boolean(window.__dailyReceipt())), scenario.recruit, `${scenario.name}: recruit only an actually new, nonconverted Buddy`);
    assert.equal(claims, 1);
    if (scenario.midnight) {
      assert.equal(await page.evaluate(id => localStorage.getItem(`squabblemon:daily-arrival:v1:${id}`), player), today, 'closing an old receipt only dismisses its displayed server day');
      await expect(popup).toHaveAttribute('open', '');
      await expect(popup).toHaveAttribute('data-receipt', 'false');
      await expect(popup).toContainText('Day 8');
      assert.equal(claims, 1, 'next day arrival does not auto-claim');
      await popup.getByRole('button', { name: 'Later · keep my reward', exact: true }).click();
      assert.equal(await page.evaluate(id => localStorage.getItem(`squabblemon:daily-arrival:v1:${id}`), player), nextDate);
    }
    assert.deepEqual(errors, []);
    report.push({ scenario: scenario.name, blocker: scenario.blocker, claims, recruit: scenario.recruit, errors });
    console.log(`PASS daily edge: ${scenario.name}`);
    await page.close();
  }

} finally { await browser.close(); await writeFile(`${output}/${process.env.DAILY_EDGE_ONLY ? 'daily-arrival-edges' : 'daily-arrival'}.json`, JSON.stringify(report, null, 2)); }
