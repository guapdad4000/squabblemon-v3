import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:4245';
const output = process.env.FINALE_OUTPUT ?? '/tmp/squabblemon-pack-finale';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(`${origin}/e2e/pack-finale.fixture.html?premount=1&ten=1&rarity=Mythical&skip=1`);
  await expect(page.getByRole('button', { name: 'Arm', exact: true })).toBeEnabled({ timeout: 20000 });
  await page.getByRole('button', { name: 'Arm', exact: true }).click();
  const finale = page.locator('.pack-gym-finale');
  await expect(finale).toHaveAttribute('data-active', 'false');
  await expect(finale).toHaveAttribute('data-stage', 'armed');
  await expect(finale).toHaveAttribute('aria-hidden', 'true');
  const prepared = await finale.evaluate(element => {
    window.__preparedFinale = element;
    window.__preparedFinaleImages = [...element.querySelectorAll('img')];
    window.__preparedFinaleVideos = [...element.querySelectorAll('video')];
    const layers = [...element.querySelectorAll('.pack-gym-finale__beat,.pack-gym-finale__film,.pack-gym-finale__distance,.pack-gym-finale__foreground,.pack-gym-finale__rarity')];
    return {
      inert: element.inert,
      role: element.getAttribute('role'),
      live: element.getAttribute('aria-live'),
      pointerEvents: getComputedStyle(element).pointerEvents,
      imageCount: element.querySelectorAll('img').length,
      videoCount: element.querySelectorAll('video').length,
      mediaPaused: [...element.querySelectorAll('video')].every(video => video.paused && video.currentTime === 0),
      invisible: layers.every(layer => getComputedStyle(layer).opacity === '0'),
      animationFree: layers.every(layer => getComputedStyle(layer).animationName === 'none'),
    };
  });
  assert.ok(prepared.imageCount >= 6,'The chosen posters, impact cels, and final wall are prepared');
  assert.deepEqual({...prepared,imageCount:undefined}, { inert: true, role: null, live: null, pointerEvents: 'none', imageCount: undefined, videoCount: 2, mediaPaused: true, invisible: true, animationFree: true });
  await expect(page.getByRole('button', { name: 'Skip pack animation' })).toHaveCount(0);
  // Waiting beyond the entire ten-pack deadline must not play or finish an armed presentation.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(6800);
  await expect(finale).toHaveAttribute('data-stage', 'armed');
  await expect(page.getByLabel('Completions', { exact: true })).toHaveText('0');
  await expect(page.getByLabel('Skips', { exact: true })).toHaveText('0');
  for (let hit = 0; hit < 2; hit++) {
    await page.getByRole('button', { name: 'Punch', exact: true }).click();
    await page.waitForTimeout(120);
    await expect(finale).toHaveAttribute('data-active', 'false');
  }
  await page.screenshot({ path: `${output}/armed-ten-390.png` });
  // Keep the first active frame inspectable. Uninterrupted timing is covered by the real Shop suite.
  await page.evaluate(() => {
    const observer = new MutationObserver(() => {
      if (document.querySelector('.pack-gym-finale')?.getAttribute('data-active') !== 'true') return;
      observer.disconnect();
      for (const target of [document, document.querySelector('iframe').contentDocument]) {
        Object.defineProperty(target, 'hidden', { configurable: true, value: true });
        target.dispatchEvent(new Event('visibilitychange'));
      }
    });
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-active'] });
  });
  await page.frameLocator('iframe').locator('#webgl-container').click({ position: { x: 100, y: 100 } });
  await expect(finale).toHaveAttribute('data-active', 'true');
  await expect(finale).toHaveAttribute('data-stage', 'compression');
  await expect(finale).toHaveAttribute('aria-hidden', 'false');
  await expect(finale).toHaveAttribute('data-paused', 'true');
  assert.equal(await finale.evaluate(element => element.inert), false);
  assert.equal(await finale.evaluate(element => element === window.__preparedFinale && [...element.querySelectorAll('img')].every((image, index) => image === window.__preparedFinaleImages[index]) && [...element.querySelectorAll('video')].every((video,index)=>video===window.__preparedFinaleVideos[index])), true, 'third hit reuses the prepared portal and image nodes');
  await expect(page.getByRole('button', { name: 'Skip pack animation' })).toBeFocused();
  await page.getByRole('button', { name: 'Skip pack animation' }).click();
  await expect(finale).toHaveCount(0);
  await expect(page.getByLabel('Skips', { exact: true })).toHaveText('1');
  await expect(page.getByLabel('Completions', { exact: true })).toHaveText('0');
  assert.deepEqual(errors, []);
  const report = { prepared, armedBeyondDeadline: true, firstTwoPunchesInert: true, reusedPortalAndImageNodes: true, startsAtCompressionOnThirdHit: true, skipFocusOnActivation: true, oneSkip: true, noPageErrors: true };
  await writeFile(`${output}/armed-browser.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
