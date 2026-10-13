import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const origin = process.env.KUMITE_ORIGIN ?? 'http://127.0.0.1:43217';
const browser = await chromium.launch({ headless: true, args: ['--disable-gpu'], ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const report = [];
try {
  for (const missingLogo of [false, true]) {
    const page = await browser.newPage({ viewport: { width: 320, height: 568 }, reducedMotion: 'reduce' });
    const requests = { pose: 0, base: 0, logo: 0 };
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/assets/kumite/outcomes/franklin-duke-win.webp', route => { requests.pose++; return route.fulfill({ status: 404, body: '' }); });
    await page.route('**/assets/characters/franklin-duke.webp*', route => { requests.base++; return route.fulfill({ status: 404, body: '' }); });
    if (missingLogo) await page.route('**/assets/kumite/squabblemon-wordmark.webp', route => { requests.logo++; return route.fulfill({ status: 404, body: '' }); });
    await page.goto(`${origin}/e2e/kumite-battle.fixture.html?mode=win&hero=franklin-duke`, { waitUntil: 'domcontentloaded' });
    const dialog = page.getByTestId('kumite-result-dialog');
    await dialog.waitFor();
    if (missingLogo) {
      await dialog.locator('.kumite-result__scene').getByText('SQUABBLEMON', { exact: true }).waitFor();
      assert.equal(await dialog.locator('.kumite-result__fighter').count(), 0);
    } else {
      const fallback = dialog.locator('.kumite-result__fighter.kumite-logo');
      await fallback.waitFor();
      assert.ok((await fallback.getAttribute('src')).endsWith('/assets/kumite/squabblemon-wordmark.webp'));
      await fallback.evaluate(image => image.decode());
    }
    const settled = { ...requests };
    await page.waitForTimeout(400);
    assert.deepEqual(requests, settled, 'Image failures reach a terminal fallback without repeated requests');
    assert.equal(requests.pose, 1, 'Outcome pose is tried only once');
    assert.ok(requests.base <= 8, 'Base portrait requests remain bounded across the result and existing battle cards');
    assert.ok(requests.logo <= 3, 'Logo requests remain bounded across header and fallback');
    await dialog.getByRole('button', { name: 'Inspect final board', exact: true }).last().click();
    await page.getByRole('button', { name: 'View result', exact: true }).click();
    await dialog.waitFor();
    await dialog.getByRole('button', { name: 'Back to Kumite', exact: true }).click();
    await page.waitForFunction(() => document.body.dataset.reviewExit === 'kumite');
    assert.deepEqual(errors, []);
    report.push({ missingPose: true, missingBase: true, missingLogo, terminalFallback: missingLogo ? 'Live white Squabblemon text' : 'White no-crown wordmark', requests: settled, finalBoardReachable: true, backToKumiteReachable: true, errors });
    await page.close();
  }
  console.log(JSON.stringify({ passed: true, checks: report }, null, 2));
} finally { await browser.close(); }
