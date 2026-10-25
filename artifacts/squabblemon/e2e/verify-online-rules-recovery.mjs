import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

// Run against the standard Vite config with BASE_PATH=/squabblemon/ and
// VITE_E2E_AUTH=true. The actual Multiplayer/provider fixture owns the UI;
// only its final destination document is intercepted to avoid an auth claim.
const origin = process.env.ONLINE_RULES_ORIGIN ?? 'http://127.0.0.1:4337';
const prefix = (process.env.ONLINE_RULES_BASE_PATH ?? '/squabblemon').replace(/\/$/, '');
const output = process.env.ONLINE_RULES_OUTPUT ?? '/tmp/online-rules-recovery';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE });
const report = [];
function luminance(color) {
  const channels = color.match(/[\d.]+/g)?.map(Number);
  assert(channels && channels.length >= 3, `Expected RGB color: ${color}`);
  assert(channels.length < 4 || channels[3] === 1, `Expected opaque action color: ${color}`);
  return channels.slice(0, 3).map(value => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
}
try {
  for (const [kind, width, height, route, label] of [
    ['friend', 320, 568, '/game/online?tab=friends', 'Back to Friendly Fades'],
    ['friend', 844, 390, '/game/online?tab=friends', 'Back to Friendly Fades'],
    ['ranked', 1440, 900, '/game/online', 'Back to Fade Park'],
    ['kumite', 390, 844, '/game/kumite?view=arena', 'Back to Kumite'],
  ]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(20000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.routeWebSocket('**', socket => socket.close());
      await page.goto(`${origin}${prefix}/e2e/pvp-exit.fixture.html?kind=${kind}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('online-battle')).toBeVisible();
      assert.equal(await page.evaluate(() => window.pvpFixture.basePath), prefix, 'actual Vite base matches the tested deployment prefix');
      assert.equal(await page.evaluate(() => window.pvpFixture.status()), 'active');
      const retired = await page.evaluate(() => window.pvpFixture.retireForRules());
      assert.equal(retired.status, 'closed');
      assert.equal(retired.reason, 'rules-updated');
      const heading = page.getByRole('heading', { name: 'The rules have updated.', exact: true });
      const exit = page.getByRole('button', { name: label, exact: true });
      await expect(heading).toBeVisible();
      await expect(heading).toBeFocused();
      await expect(page.getByTestId('online-battle')).toHaveCount(0);
      await expect(page.getByText('Your saved results, rank, and rewards are unchanged.', { exact: true })).toBeVisible();
      await exit.focus();
      const beforeReads = await page.evaluate(() => window.pvpFixture.reads());
      const repeated = await page.evaluate(() => window.pvpFixture.retireForRules());
      assert(await page.evaluate(() => window.pvpFixture.reads()) > beforeReads, 'repeat actually refetches the closed snapshot');
      assert.deepEqual(repeated, retired, 'authoritative retirement is idempotent');
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await expect(exit).toBeFocused();
      assert.equal(await page.evaluate(() => window.pvpFixture.requests()), 0, 'retirement/exit does not surrender or settle a game');
      const box = await exit.boundingBox();
      assert(box && box.height >= 44 && box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1, JSON.stringify({ kind, box }));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const actionColors = await exit.evaluate(element => {
        const style = getComputedStyle(element);
        return { color: style.color, background: style.backgroundColor };
      });
      const foreground = luminance(actionColors.color), background = luminance(actionColors.background);
      const contrast = (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
      assert(contrast >= 4.5, JSON.stringify({ kind, actionColors, contrast }));
      await page.screenshot({ path: `${output}/${kind}-${width}.png` });
      const destination = `${origin}${prefix}${route}`;
      const documentRequests = [];
      await page.route(destination, async intercepted => {
        const request = intercepted.request();
        assert.equal(request.isNavigationRequest(), true);
        assert.equal(request.resourceType(), 'document');
        documentRequests.push(request.url());
        await intercepted.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><title>Recovery destination</title></head><body>Navigation received</body></html>' });
      });
      await page.evaluate(() => { window.rulesRecoveryOldDocument = true; });
      await Promise.all([page.waitForEvent('domcontentloaded'), exit.click()]);
      assert.equal(page.url(), destination);
      assert.deepEqual(documentRequests, [destination], 'exit performs exactly one full document navigation');
      const documentState = await page.evaluate(() => ({ oldMarker: window.rulesRecoveryOldDocument === true, oldFixture: !!window.pvpFixture, navigation: performance.getEntriesByType('navigation')[0]?.type }));
      assert.deepEqual(documentState, { oldMarker: false, oldFixture: false, navigation: 'navigate' });
      assert.deepEqual(errors, []);
      report.push({ kind, viewport: { width, height }, passed: true, retired, actionColors, contrast, headingFocused: true, repeatedStatusKeepsButtonFocus: true, destination, documentRequests, documentState, evidence: 'Actual Multiplayer with app/auth/query/social providers and authoritative in-memory retirement; intercepted destination document, no live API or authenticated destination claim.' });
      console.log(`${kind}: focused retirement, repeat-safe focus, prefixed full navigation passed`);
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
}
