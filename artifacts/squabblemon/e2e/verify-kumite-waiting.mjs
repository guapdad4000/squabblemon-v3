import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const origin = process.env.KUMITE_ORIGIN ?? 'http://127.0.0.1:43217';
const output = process.env.KUMITE_OUTPUT ?? fileURLToPath(new URL('../../deliverables/kumite-20261012/browser/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--disable-gpu'], ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const report = [];
try {
  for (const [name, width, height] of [['waiting-phone', 390, 844], ['waiting-desktop', 1440, 960], ['waiting-small-phone', 320, 568], ['waiting-landscape', 844, 390]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/e2e/kumite-waiting.fixture.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Weekly Kumite' }).waitFor();
    await page.getByTestId('kumite-versus').waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('.kumite-versus img')].every(image => image.complete && image.naturalWidth > 0));
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('.kumite-versus__portrait > img[src*="franklin-duke"]').count(), 1);
    assert.equal(await page.locator('.kumite-versus__portrait > img[src*="chonk-lee"]').count(), 1);
    const headsUncropped = await page.locator('.kumite-versus__portrait > img:not(.kumite-logo)').evaluateAll(images => images.every(image => image.getBoundingClientRect().top >= image.parentElement.getBoundingClientRect().top));
    assert.ok(headsUncropped, 'fighter head area must remain inside each portrait slot');
    assert.equal(await page.getByText('Copy invite link').count(), 0);
    assert.equal(await page.getByText('Close room', { exact: true }).count(), 0);
    assert.equal(await page.getByText('ABCDEF123456').count(), 0);
    await page.getByRole('button', { name: 'Back to Kumite', exact: true }).first().click();
    assert.deepEqual(await page.evaluate(() => ({ leaves: window.kumiteWaitingReview.leaves, commands: window.kumiteWaitingReview.commands })), { leaves: 1, commands: [] });
    await page.evaluate(() => window.kumiteWaitingReview.setConnected(false));
    await page.waitForFunction(() => document.querySelector('.kumite-button').disabled);
    await page.evaluate(() => window.kumiteWaitingReview.setConnected(true));
    const ready = page.getByRole('button', { name: 'Ready for Kumite', exact: true });
    await ready.waitFor();
    await ready.click();
    await page.waitForFunction(() => window.kumiteWaitingReview.commands.length === 1);
    assert.deepEqual(await page.evaluate(() => window.kumiteWaitingReview.commands), [{ type: 'ready' }]);
    assert.equal(await page.getByRole('button', { name: 'Ready. Waiting for your opponent…', exact: true }).isDisabled(), true);
    await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Forfeit tournament match', exact: true }).click();
    await page.getByRole('dialog', { name: 'Forfeit this tournament match?' }).waitFor();
    assert.equal(await page.evaluate(() => window.kumiteWaitingReview.commands.length), 1);
    await page.getByRole('button', { name: 'Keep my place', exact: true }).click();
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.deepEqual(await page.evaluate(() => window.kumiteWaitingReview.commands), [{ type: 'ready' }]);
    await page.getByRole('button', { name: 'Forfeit tournament match', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm forfeit', exact: true }).click();
    await page.waitForFunction(() => window.kumiteWaitingReview.commands.length === 2);
    assert.deepEqual(await page.evaluate(() => window.kumiteWaitingReview.commands), [{ type: 'ready' }, { type: 'surrender' }]);
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
    assert.ok(dimensions.document <= dimensions.viewport, `${name} should not overflow horizontally`);
    assert.ok(await page.locator('.kumite-waiting__controls').evaluate(element => getComputedStyle(element).backgroundImage.includes('panel-background.webp')), 'check-in facts retain the illustrated panel background');
    const liveLabels = await page.locator('.kumite-versus__nameplate h2, .kumite-versus__ready').allTextContents();
    assert.deepEqual(liveLabels, ['Review Fighter', 'Ready', 'Assigned Opponent', 'Not ready']);
    let whiteLogoFallback = false;
    assert.deepEqual(errors, []);
    if (name === 'waiting-phone') {
      await page.route('**/assets/characters/franklin-duke.webp*', route => route.abort());
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('.kumite-versus__fighter--player .kumite-versus__portrait[data-art-fallback="true"] > .kumite-logo').waitFor();
      assert.equal(await page.getByRole('heading', { name: 'Review Fighter', exact: true }).count(), 1);
      const fallbackDimensions = await page.getByTestId('kumite-versus').boundingBox();
      assert.ok(fallbackDimensions.height >= 300, 'missing art must retain the VS composition height');
      await page.screenshot({ path: `${output}/${name}-fallback.png`, fullPage: true });
      whiteLogoFallback = true;
    }
    report.push({ name, viewport: { width, height }, actualAssignedPortraits: true, intactHeads: headsUncropped, liveLabels, horizontalOverflow: false, whiteLogoFallback, safeBack: true, cancelDoesNotSurrender: true, confirmedSurrenderCommands: 1, readyCommands: 1, disconnectedReadyDisabled: true, alreadyReadyDisabled: true, pageErrors: errors });
    await context.close();
  }
  await writeFile(`${output}/waiting-room-report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.length, checks: report }, null, 2));
} finally { await browser.close(); }
