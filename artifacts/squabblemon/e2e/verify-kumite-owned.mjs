import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const base = process.env.KUMITE_FILMS_ORIGIN ?? 'http://127.0.0.1:4207';
const output = process.env.KUMITE_FILMS_OUTPUT ?? '/tmp/kumite-release-browser';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  for (const [width, height] of [[390,844], [768,1024], [1440,900]]) for (const locked of [false, true]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    const errors = [], media = [];
    page.on('pageerror', error => errors.push(error.stack));
    page.on('request', request => { if (request.url().includes('/films/v1/')) media.push(request.url()); });
    await page.goto(`${base}/e2e/kumite-owned.fixture.html${locked ? '?locked' : ''}`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('.kumite-roadmap__node').count(), 9);
    await page.getByRole('button', { name: 'Open Collection inspector' }).click();
    const inspector = page.locator('.card-inspector-shell'); await inspector.waitFor();
    const replay = inspector.getByRole('button', { name: 'Watch Undercova Brotha Kumite film', exact: true });
    assert.equal(await replay.count(), locked ? 0 : 1);
    assert.equal(media.length, 0, 'Inspecting a card does not preload film media');
    if (!locked) {
      await replay.click(); await page.locator('dialog.kumite-film[open]').waitFor();
      await page.getByRole('button', { name: 'Skip / close', exact: true }).click();
      await inspector.waitFor();
      assert.equal(await replay.evaluate(button => document.activeElement === button), true);
    }
    await page.getByRole('button', { name: 'Close card details', exact: true }).click();
    await page.getByRole('button', { name: 'Inspect Undercova Brotha dossier', exact: true }).click();
    const dossier = page.getByRole('complementary', { name: 'Undercova Brotha fighter dossier' });
    const dossierReplay = dossier.getByRole('button', { name: 'Watch Undercova Brotha Kumite film', exact: true });
    assert.equal(await dossierReplay.count(), locked ? 0 : 1);
    if (!locked) {
      await dossierReplay.click(); await page.getByRole('button', { name: 'Skip / close', exact: true }).click();
      await dossier.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${output}/dossier-${width}.png` });
    }
    assert.deepEqual(errors, []); await page.close(); console.log(`${width} ${locked ? 'locked' : 'owned'} passed`);
  }
} finally { await browser.close(); }
