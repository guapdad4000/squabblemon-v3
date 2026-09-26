import { expect, test } from '@playwright/test';

const fixture = '/e2e/loading.fixture.html';

test('startup stages report real gates and only enhance with video after the app is ready', async ({ page }) => {
  await page.goto(`${fixture}?phase=application`, { waitUntil: 'networkidle' });
  const loader = page.getByTestId('loading-screen');
  await expect(loader).toHaveAttribute('data-phase', 'application');
  await expect(page.getByTestId('loading-status')).toHaveText('Downloading the broadcast');
  await expect(loader.locator('video')).toHaveCount(0);
  await expect(page.getByTestId('loading-visual-progress')).toHaveText('Visual feed 3 of 3 ready');
  await expect(loader.locator('.sbl-stages li[data-state="active"]')).toContainText('App');

  // The optional looping broadcast video intentionally keeps a media request open.
  await page.goto(`${fixture}?phase=player`, { waitUntil: 'domcontentloaded' });
  await expect(loader).toHaveAttribute('data-phase', 'player');
  await expect(page.getByTestId('loading-status')).toHaveText('Loading your gang and rewards');
  await expect(loader.locator('.sbl-stages li[data-state="complete"]')).toHaveCount(2);
  await expect(loader.locator('.sbl-stages li[data-state="active"]')).toContainText('Profile');
  await expect(loader.locator('video source')).toHaveAttribute('src', /brand\/loading-scenes\.webm$/);

  await page.evaluate(() => (window as Window & { finishLoading(): void }).finishLoading());
  await expect(page.getByText('Ready', { exact: true })).toBeVisible();
  await expect(loader).toHaveCount(0);
});

test('data saver and reduced motion do not download the optional loading video', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: { saveData: true, effectiveType: '4g' },
    });
  });
  await page.goto(`${fixture}?phase=account`, { waitUntil: 'networkidle' });
  await expect(page.getByTestId('loading-screen').locator('video')).toHaveCount(0);
});

test('short transitions finish without requesting the broadcast video', async ({ page }) => {
  const videos: string[] = [];
  page.on('request', request => { if (request.url().includes('loading-scenes.webm')) videos.push(request.url()); });
  await page.goto(`${fixture}?phase=scene`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('loading-screen')).toBeVisible();
  await page.evaluate(() => (window as Window & { finishLoading(): void }).finishLoading());
  await expect(page.getByText('Ready', { exact: true })).toBeVisible();
  await page.waitForTimeout(1400);
  expect(videos).toEqual([]);
});
