import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const origin = process.env.SQUABBLEMON_ORIGIN ?? 'http://127.0.0.1:4179/squabblemon';
const output = 'screenshots/pvp-arrival-v2';
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  for (const test of [
    { name: 'phone', viewport: { width: 390, height: 844 } },
    { name: 'desktop', viewport: { width: 1440, height: 900 } },
  ]) {
    const page = await browser.newPage({ viewport: test.viewport, reducedMotion: 'no-preference' });
    const errors = [];
    page.on('console', message => message.type() === 'error' && errors.push(message.text()));
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/e2e/ui-polish.fixture.html?mode=arrival`, { waitUntil: 'networkidle' });
    await page.locator('.versus-logo-v2').waitFor();
    await page.waitForTimeout(1100);

    const stage = await page.locator('.versus-stage').evaluate(image => ({
      src: image.getAttribute('src'),
      complete: image.complete,
      width: image.naturalWidth,
      height: image.naturalHeight,
    }));
    assert(stage.src?.includes('fade-park-day.webp'));
    assert.equal(stage.complete, true);
    assert(stage.width > 1500 && stage.height > 800);
    assert.equal(await page.locator('[data-testid="match-arrival"] footer button').count(), 0);
    assert.equal(await page.locator('.versus-logo-v2').getAttribute('data-ready'), 'true');
    assert.equal(await page.locator('.fighter-card__meta').count(), 2);
    const greenSpill = await page.locator('.versus-logo-v2').evaluate(canvas => {
      const context = canvas.getContext('2d');
      let pixels;
      if (context) pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      else {
        const gl = canvas.getContext('webgl');
        pixels = new Uint8Array(canvas.width * canvas.height * 4);
        gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      }
      let green = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] > 100 && pixels[i + 1] - Math.max(pixels[i], pixels[i + 2]) > 24) green++;
      }
      return green;
    });
    assert(greenSpill < 5, `VS chroma spill: ${greenSpill} pixels`);
    await page.locator('.fighter-card__level').filter({ hasText: '24' }).waitFor();
    await page.getByText('RP 1,180', { exact: true }).waitFor();

    const arms = await page.locator('.versus-arm').evaluateAll(nodes => nodes.map(node => {
      const rect = node.getBoundingClientRect();
      return { width: rect.width, height: rect.height, ratio: rect.width / rect.height };
    }));
    assert.equal(arms.length, 2);
    for (const arm of arms) assert(arm.ratio > 1.45 && arm.ratio < 1.6, `stretched fist ratio: ${arm.ratio}`);

    await page.screenshot({ path: `${output}/${test.name}.png`, fullPage: true });
    await page.getByRole('button', { name: /Match found.*Enter battle/ }).click({ position: { x: 10, y: 10 } });
    assert.equal(await page.locator('body').getAttribute('data-action'), 'enter');
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('PASS daytime PVP arrival at phone and desktop sizes');
} finally {
  await browser.close();
}
