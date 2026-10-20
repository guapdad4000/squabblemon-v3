import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const fixture = '/e2e/media-loading.fixture.html';
const mediaPath = '/assets/media-loading-test.mp4';
const posterPath = '/assets/media-loading-test-poster.svg';
// Use an unchanged, already-shipped clip to exercise real decoding and playback.
// No additional media downloads or new production assets are needed by this gate.
const movie = readFileSync(new URL('../src/assets/promotion/squabblehouse-openart-cinematic-v1.mp4', import.meta.url));

async function observeMedia(page: Page) {
  const requests: string[] = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname === mediaPath) requests.push(request.url());
  });
  await page.route(`**${mediaPath}`, route => route.fulfill({ body: movie, contentType: 'video/mp4' }));
  await page.route(`**${posterPath}`, route => route.fulfill({
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#252530"/></svg>',
  }));
  return requests;
}

test('chapter poster and skip do not request even movie metadata', async ({ page }) => {
  const requests = await observeMedia(page);
  await page.goto(fixture, { waitUntil: 'networkidle' });
  const video = page.locator('video');
  await expect(video).toHaveAttribute('preload', 'none');
  await expect(video).not.toHaveAttribute('src');
  await expect(video).toHaveAttribute('poster', posterPath);
  expect(requests).toEqual([]);
  await page.getByRole('button', { name: 'Continue to dialogue' }).click();
  await expect(page.getByRole('status')).toHaveText('Continued');
  expect(requests).toEqual([]);
});

test('chapter Play starts the unchanged clip and closing releases its source', async ({ page }) => {
  const requests = await observeMedia(page);
  await page.goto(fixture);
  await page.getByRole('button', { name: 'Play chapter' }).click();
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  const video = page.locator('video');
  await expect(video).toHaveAttribute('src', mediaPath);
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => !node.paused && node.currentTime > 0)).toBe(true);
  await expect(video).toHaveAttribute('controls');
  await page.evaluate(() => { (window as any).retiredVideo = document.querySelector('video'); });
  await page.getByRole('button', { name: 'Back to map' }).click();
  await expect(page.getByRole('status')).toHaveText('Closed');
  expect(await page.evaluate(() => {
    const video = (window as any).retiredVideo as HTMLVideoElement;
    return { paused: video.paused, source: video.getAttribute('src'), currentSrc: video.currentSrc };
  })).toEqual({ paused: true, source: null, currentSrc: '' });
});

test('chapter natural ending still continues into dialogue', async ({ page }) => {
  await observeMedia(page);
  await page.goto(fixture);
  await page.getByRole('button', { name: 'Play chapter' }).click();
  const video = page.locator('video');
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.readyState >= 2 && Number.isFinite(node.duration))).toBe(true);
  await video.evaluate((node: HTMLVideoElement) => { node.currentTime = Math.max(0, node.duration - 0.15); });
  await expect(page.getByRole('status')).toHaveText('Continued');
});

for (const policy of ['reduced-motion', 'in-game-reduced-motion', 'data-saver', 'slow-network', 'hidden'] as const) {
  test(`cinematic never requests a video on its first render with ${policy}`, async ({ page }) => {
    const requests = await observeMedia(page);
    if (policy === 'reduced-motion') await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(policy => {
      if (policy === 'hidden') Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      if (policy === 'in-game-reduced-motion') {
        const observer = new MutationObserver(() => {
          if (!document.documentElement) return;
          document.documentElement.dataset.reduceMotion = 'true';
          observer.disconnect();
        });
        observer.observe(document, { childList: true, subtree: true });
      }
      if (policy === 'data-saver' || policy === 'slow-network') {
        Object.defineProperty(navigator, 'connection', { configurable: true, value: {
          saveData: policy === 'data-saver', effectiveType: policy === 'slow-network' ? '3g' : '4g',
        } });
      }
    }, policy);
    await page.goto(`${fixture}?mode=cinematic`, { waitUntil: 'networkidle' });
    await expect(page.locator('video')).toHaveCount(0);
    await expect(page.locator(`img[src="${posterPath}"]`)).toBeVisible();
    expect(requests).toEqual([]);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Continued');
    expect(requests).toEqual([]);
  });
}

test('normal cinematic plays at full quality and releases media when hidden', async ({ page }) => {
  const requests = await observeMedia(page);
  await page.goto(`${fixture}?mode=cinematic`);
  const video = page.locator('video');
  await expect(video).toHaveAttribute('src', mediaPath);
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => !node.paused && node.currentTime > 0)).toBe(true);
  expect(requests.length).toBeGreaterThan(0);
  await page.evaluate(() => {
    (window as any).retiredVideo = document.querySelector('video');
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(video).toHaveCount(0);
  await expect(page.locator(`img[src="${posterPath}"]`)).toBeVisible();
  expect(await page.evaluate(() => {
    const video = (window as any).retiredVideo as HTMLVideoElement;
    return { paused: video.paused, source: video.getAttribute('src') };
  })).toEqual({ paused: true, source: null });
  // Visibility changes leave player navigation and callbacks available.
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Continued');
});
