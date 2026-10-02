import { expect, test } from '@playwright/test';
import { loadingScenes } from '../src/lib/broadcastCatalog';

const fixture = '/e2e/loading.fixture.html';
type FixtureWindow = Window & {
  finishLoading(): void;
  startLoading(phase?: string): void;
  changeLoadingPhase(phase: string): void;
  remountLoading(): void;
};

test('real loading stages keep one scene through phase changes and adjacent remounts', async ({ page }) => {
  await page.goto(`${fixture}?phase=application`, { waitUntil: 'networkidle' });
  const loader = page.getByTestId('loading-screen');
  const scene = await loader.getAttribute('data-scene');
  expect(loadingScenes.some(item => item.id === scene)).toBe(true);
  await expect(page.getByTestId('loading-status')).toHaveText('Downloading the broadcast');
  await expect(loader.locator('video')).toHaveCount(0);
  await expect(page.getByTestId('loading-visual-progress')).toHaveText('Visual feed 2 of 2 ready');
  await page.evaluate(() => (window as FixtureWindow).changeLoadingPhase('account'));
  await expect(page.getByTestId('loading-status')).toHaveText('Checking your fighter tag');
  await page.evaluate(() => (window as FixtureWindow).remountLoading());
  await expect(loader).toHaveAttribute('data-scene', scene!);
  await page.evaluate(() => {
    (window as FixtureWindow).finishLoading();
    (window as FixtureWindow).startLoading('player');
  });
  await expect(loader).toHaveAttribute('data-scene', scene!);
  await page.evaluate(() => (window as FixtureWindow).changeLoadingPhase('player'));
  await expect(page.getByTestId('loading-status')).toHaveText('Loading your gang and rewards');
  await expect(loader.locator('.sbl-stages li[data-state="complete"]')).toHaveCount(2);
  await expect(loader.locator('.sbl-stages li[data-state="active"]')).toContainText('Profile');
  await expect(loader.locator('video source')).toHaveAttribute('src', new RegExp(loadingScenes.find(item => item.id === scene)!.video.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'));
  await page.evaluate(() => (window as FixtureWindow).finishLoading());
  await expect(page.getByText('Ready', { exact: true })).toBeVisible();
  await expect(loader).toHaveCount(0);
});

test('visits rotate without immediate repeats and eventually use all three scenes', async ({ page }) => {
  const seen = new Set<string>();
  let previous: string | null = null;
  for (let i = 0; i < 12; i += 1) {
    await page.goto(`${fixture}?phase=application`, { waitUntil: 'domcontentloaded' });
    const current = await page.getByTestId('loading-screen').getAttribute('data-scene');
    expect(current).toBeTruthy();
    if (previous) expect(current).not.toBe(previous);
    seen.add(current!);
    previous = current;
  }
  expect(seen.size).toBe(loadingScenes.length);
});

test('data saver, very slow networks and reduced motion use stills', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: localStorage.getItem('network-mode') === 'slow'
        ? { saveData: false, effectiveType: 'slow-2g' }
        : { saveData: true, effectiveType: '4g' },
    });
  });
  await page.goto(`${fixture}?phase=account`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);
  await expect(page.getByTestId('loading-screen').locator('video')).toHaveCount(0);
  await page.evaluate(() => localStorage.setItem('network-mode', 'slow'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);
  await expect(page.getByTestId('loading-screen').locator('video')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);
  await expect(page.getByTestId('loading-screen').locator('video')).toHaveCount(0);
});

test('short loads never request video; a prolonged wait exposes playback controls', async ({ page }) => {
  const videos: string[] = [];
  page.on('request', request => { if (loadingScenes.some(scene => request.url().includes(scene.video))) videos.push(request.url()); });
  await page.goto(`${fixture}?phase=scene`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => (window as FixtureWindow).finishLoading());
  await expect(page.getByText('Ready', { exact: true })).toBeVisible();
  await page.waitForTimeout(1400);
  expect(videos).toEqual([]);
  await page.evaluate(() => (window as FixtureWindow).startLoading('scene'));
  await expect(page.getByTestId('button-toggle-loading-motion')).toBeVisible();
  await page.getByTestId('button-toggle-loading-motion').click();
  await expect(page.getByTestId('button-toggle-loading-motion')).toHaveAttribute('aria-label', 'Play loading scene');
});