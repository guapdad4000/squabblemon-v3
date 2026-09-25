import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

// Follows the rookie tutorial coach with real browser clicks. Any step where a
// genuine click cannot land (hit-test interception) or lands without advancing
// the lesson is reported with the exact target and interceptor.
const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:23293';
const browser = await chromium.launch();
const sizes = [[1440, 900], [390, 844], [320, 568]];
try {
  for (const [width, height] of sizes) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/e2e/rookie-road.fixture.html');
    const spotlight = page.locator('[data-testid="fade-spotlight"]');
    await spotlight.waitFor({ timeout: 15_000 });
    const sig = () => page.locator('[data-testid="match-sig"]').textContent();
    let steps = 0;
    for (let step = 0; step < 60; step += 1) {
      if (await page.locator('[data-testid="tutorial-done"]').isVisible().catch(() => false)) break;
      const lesson = page.locator('[data-testid="mechanic-lesson"]');
      if (await lesson.isVisible().catch(() => false)) {
        await page.locator('[data-testid="button-dismiss-mechanic-lesson"]').click({ timeout: 4_000 });
        continue;
      }
      const target = await spotlight.getAttribute('data-coach-target').catch(() => null);
      assert.ok(target, `coach lost its target at ${width}x${height} after ${steps} clicks; sig=${await sig()}`);
      const before = target + '|' + await sig();
      try {
        await page.locator(target).first().click({ timeout: 4_000 });
      } catch (error) {
        throw new Error(`STUCK at ${width}x${height} after ${steps} clicks — cannot click ${target}: ${String(error.message).split('\n').slice(0, 6).join(' | ')}`);
      }
      steps += 1;
      const changed = await page.waitForFunction(
        previous => {
          const coach = document.querySelector('[data-testid="fade-spotlight"]');
          const next = (coach?.getAttribute('data-coach-target') ?? 'none') + '|' + (document.querySelector('[data-testid="match-sig"]')?.textContent ?? '');
          return next !== previous || document.querySelector('[data-testid="tutorial-done"]') || document.querySelector('[data-testid="mechanic-lesson"]');
        },
        before, { timeout: 3_000 },
      ).then(() => true).catch(() => false);
      if (!changed) {
        const rejection = await page.locator('[data-testid="commit-rejection"]').textContent();
        throw new Error(`NO PROGRESS at ${width}x${height} after clicking ${target}; sig=${await sig()} rejection=${rejection || 'none'}`);
      }
    }
    assert.ok(
      await page.locator('[data-testid="tutorial-done"]').isVisible().catch(() => false),
      `tutorial did not finish within 60 clicks at ${width}x${height}; sig=${await sig()}`,
    );
    assert.deepEqual(errors, [], `page errors at ${width}x${height}`);
    console.log(`rookie tutorial completable with ${steps} real clicks at ${width}x${height}`);
    await page.close();
  }
} finally {
  await browser.close();
}
console.log('Rookie Road tutorial: every coach step is clickable and advances on desktop and phone sizes.');
