import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const port = process.env.ART_REVIEW_PORT || '4217';
const url = `http://127.0.0.1:${port}/e2e/art-recovery/fixture.html?gpuTier=low`;
const output = process.env.ART_REVIEW_CAPTURE || '/tmp/squabblemon-restored-art';
await mkdir(output, { recursive: true });
const server = spawn(process.execPath, ['../../node_modules/vite/bin/vite.js', '--config', 'vite.config.ts', '--host', '127.0.0.1', '--port', port, '--strictPort'], { env: { ...process.env, PORT: port, BASE_PATH: '/' }, stdio: 'pipe' });
let log = '';
server.stderr.on('data', data => { log += data; });
server.stdout.on('data', data => { log += data; });
let browser;
try {
  for (let i = 0; ; i++) {
    try { if ((await fetch(url)).ok) break; } catch {}
    assert.ok(i < 100, `Vite starts: ${log}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ headless: true });
  for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1280, 800]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(15000);
    const errors = [];
    const failures = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
    await page.goto(url, { waitUntil: 'networkidle' });
    const portrait = id => page.locator(`.collector-portrait[src*="/${id}.webp"]`);
    for (const id of ['buddy-bud', 'card-guard']) {
      assert.ok(await portrait(id).count() > 0, `${width}: summoned ${id} on the board`);
      assert.equal(await portrait(id).first().evaluate(image => image.complete && image.naturalWidth > 0), true);
    }
    await page.screenshot({ path: path.join(output, `board-${width}.png`) });
    await page.getByTestId('district-details-0').click();
    const dialog = page.locator('.battle-district-view[open]');
    const items = dialog.getByRole('region', { name: 'Active items' });
    assert.equal(await items.locator('li').count(), 2);
    for (const name of ['packed lunch', 'contraband']) {
      const img = items.getByAltText(name, { exact: true });
      await img.scrollIntoViewIfNeeded();
      assert.equal(await img.evaluate(image => image.complete && image.naturalWidth > 0), true);
      const dimensions = await img.boundingBox();
      assert.ok(dimensions.width >= 80 && dimensions.height >= 112, 'Full item art remains readable');
    }
    assert.match(await items.innerText(), /Yours/);
    assert.match(await items.innerText(), /Rival’s/);
    assert.equal(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, `${width}: no horizontal dialog overflow`);
    assert.equal(await dialog.locator('.battle-district-view__content').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
    await page.screenshot({ path: path.join(output, `items-${width}.png`) });
    await dialog.getByRole('button', { name: 'View fighters here' }).click();
    assert.equal(await items.locator('li').count(), 2, 'Items also appear in formation detail');
    await dialog.getByRole('navigation', { name: 'District scores' }).getByRole('button').nth(2).click();
    assert.equal(await dialog.getByRole('region', { name: 'Active items' }).count(), 0, 'Items stay in their actual district');
    await dialog.locator('.district-fighter').filter({ has: page.locator('img[src*="/card-guard.webp"]') }).locator('.collector-card').click();
    const inspector = page.getByRole('dialog', { name: 'Card Guard battle details' });
    await inspector.waitFor();
    assert.equal(await inspector.locator('.collector-portrait--inspector').evaluate(image => image.complete && image.src.includes('/card-guard.webp') && image.naturalWidth > 0), true);
    await page.waitForFunction(() => {
      const layout = document.querySelector('.card-inspector-layout');
      return layout && Number(getComputedStyle(layout).opacity) >= 0.999;
    });
    await page.screenshot({ path: path.join(output, `guard-${width}.png`) });
    await page.getByTestId('button-close-inspector').click();
    assert.deepEqual(errors, [], `${width}: no runtime errors`);
    assert.deepEqual(failures, [], `${width}: no failed art requests`);
    console.log(`PASS ${width}x${height}: actual summoned art, item ownership and district filtering, full-size item details, guard inspection, scroll and resource checks`);
    await page.close();
  }
} finally { await browser?.close(); server.kill(); }
