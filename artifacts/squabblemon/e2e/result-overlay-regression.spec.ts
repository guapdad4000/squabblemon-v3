import { expect, test, type Locator, type Page } from '@playwright/test';

const fixtureBase = process.env.RESULT_FIXTURE_BASE ?? '/squabblemon';

type Bounds = NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>;

async function bounds(locator: Locator, label: string): Promise<Bounds> {
  await expect(locator, `${label} should be visible`).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${label} should have layout bounds`).not.toBeNull();
  return box!;
}

function overlaps(a: Bounds, b: Bounds) {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}

async function expectNoOverlap(
  overlay: Locator,
  overlayLabel: string,
  protectedRegions: Array<[Locator, string]>,
) {
  const overlayBounds = await bounds(overlay, overlayLabel);
  for (const [region, regionLabel] of protectedRegions) {
    const regionBounds = await bounds(region, regionLabel);
    expect(
      overlaps(overlayBounds, regionBounds),
      `${overlayLabel} must not cover ${regionLabel}`,
    ).toBe(false);
  }
}

async function expectInViewport(locator: Locator, label: string, page: Page) {
  const box = await bounds(locator, label);
  const viewport = page.viewportSize()!;
  expect(box.x, `${label} should not extend past the left edge`).toBeGreaterThanOrEqual(-1);
  expect(box.y, `${label} should not extend past the top edge`).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width, `${label} should not extend past the right edge`).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height, `${label} should not extend past the bottom edge`).toBeLessThanOrEqual(viewport.height + 1);
}

async function waitForStableArtwork(page: Page) {
  await page.waitForFunction(() => (
    document.fonts.status === 'loaded'
    && [...document.images].every(image => image.complete && image.naturalWidth > 0)
  ));
}

async function freezeAnimatedMarks(page: Page) {
  await page.locator('.result-immersive__mark, .park-result-outcome-mark').evaluateAll(images => {
    for (const image of images as HTMLImageElement[]) {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext('2d')?.drawImage(image, 0, 0);
      image.src = canvas.toDataURL('image/png');
    }
  });
}

const resultCases = [
  { name: 'story-victory', state: 'story', outcome: 'win', status: 'You Won The Room', action: 'Continue Chapter', story: true, markAlt: 'Victory' },
  { name: 'story-loss', state: 'story-loss', outcome: 'loss', status: 'You Got Cleared', action: 'Continue Chapter', story: true, markAlt: 'Defeat' },
  { name: 'standard-victory', state: 'win', outcome: 'win', status: 'You Won The Room', action: 'Continue the fade', story: false, markAlt: 'Victory' },
  { name: 'standard-loss', state: 'loss', outcome: 'loss', status: 'You Got Cleared', action: 'Continue the fade', story: false, markAlt: 'Defeat' },
] as const;

for (const resultCase of resultCases) {
  test(`${resultCase.name} keeps the live result mark clear of rewards, scores, and final actions`, async ({ page }) => {
    await page.goto(`${fixtureBase}/e2e/result-stage.fixture.html?state=${resultCase.state}`);
    await waitForStableArtwork(page);
    await freezeAnimatedMarks(page);

    const result = page.locator('.result-immersive');
    const mark = result.locator('.result-immersive__mark');
    const finalActions = result.locator('.result-immersive__actions');
    await expect(result).toHaveAttribute('data-result-outcome', resultCase.outcome);
    await expect(page.getByTestId('status-match-result')).toHaveText(resultCase.status);
    await expect(result.locator('.result-immersive__background img')).toHaveAttribute('src', /assets\/results\/v3\/.*\.webp$/);

    await expectNoOverlap(mark, 'result mark', [
      [result.locator('.result-immersive__plaque'), 'Battle Earnings'],
      [result.locator('.result-immersive__scores'), 'district scores'],
      [finalActions, 'result actions'],
    ]);
    await expect(result.locator('.result-stage__actions').getByRole('button', { name: resultCase.action, exact: true })).toBeVisible();
    await expect(mark).toHaveAttribute('alt', resultCase.markAlt);
    await expect(mark).toHaveAttribute('draggable', 'false');
    await expect(page.locator('.result-stage')).toHaveCSS('scrollbar-width', 'none');

    if (resultCase.story) {
      const stars = result.locator('.result-immersive__stars');
      await expect(stars).toHaveAttribute('aria-label', /^[0-3] of 3 story stars earned$/);
      await expectNoOverlap(stars, 'story stars', [
        [result.locator('.result-immersive__plaque'), 'Battle Earnings'],
        [result.locator('.result-immersive__scores'), 'district scores'],
        [finalActions, 'result actions'],
      ]);
    } else {
      await expect(result.locator('.result-immersive__stars')).toHaveCount(0);
    }

    for (const [index, button] of (await finalActions.getByRole('button').all()).entries()) {
      await expectInViewport(button, `result action ${index + 1}`, page);
    }
  });
}

for (const resultCase of [
  { name: 'story-draw', state: 'story-draw', story: true },
  { name: 'training-draw', state: 'draw', story: false },
] as const) {
  test(`${resultCase.name} presents the tie result and preserves its final actions`, async ({ page }) => {
    await page.goto(`${fixtureBase}/e2e/result-stage.fixture.html?state=${resultCase.state}`);
    await waitForStableArtwork(page);

    const result = page.locator('.result-immersive');
    await expect(result).toHaveAttribute('data-result-outcome', 'draw');
    await expect(result).toHaveAttribute('aria-label', 'Tied battle outcome artwork');
    await expect(result.locator('.result-immersive__background img')).toHaveAttribute('src', /draw-1-wide\.webp$/);
    await expect(result.locator('.result-immersive__mark')).toHaveCount(0);
    await expect(page.getByTestId('status-match-result')).toHaveText('Nobody Owns The Room');
    await expect(page.getByTestId('button-restart-match')).toBeVisible();
    if (resultCase.story) {
      await expect(page.getByText('Continue Chapter')).toBeVisible();
      await result.getByRole('button', { name: 'Details', exact: true }).click();
      const details = page.getByRole('dialog', { name: 'Match details' });
      await expect(details.getByText('Encounter tied · no side claimed the chapter.')).toBeVisible();
      await expect(page.getByTestId('button-change-deck')).toHaveCount(0);
    } else {
      await expect(page.getByTestId('button-change-deck')).toBeVisible();
      await expect(page.getByText('Home', { exact: true })).toBeVisible();
    }

    const finalActions = result.locator('.result-immersive__actions');
    for (const [index, button] of (await finalActions.getByRole('button').all()).entries()) {
      await expectInViewport(button, `tie action ${index + 1}`, page);
    }
  });
}

for (const outcome of ['win', 'loss', 'draw'] as const) {
  test(`ranked PvP ${outcome} keeps its mark clear of scores and dialog controls`, async ({ page }) => {
    await page.goto(`${fixtureBase}/e2e/ui-polish.fixture.html?mode=ranked-${outcome}`);
    await waitForStableArtwork(page);
    await freezeAnimatedMarks(page);

    const dialog = page.getByTestId('park-result-dialog');
    const mark = dialog.locator('.park-result-outcome-mark');
    await expect(dialog).toHaveCSS('scrollbar-width', 'none');
    await expect(dialog.locator('.park-result-scene > img').first()).toHaveAttribute('draggable', 'false');
    await expect(mark).toHaveAttribute('draggable', 'false');
    await expectNoOverlap(mark, 'ranked result mark', [
      [dialog.locator('.park-result-score'), 'ranked score panel'],
      [dialog.locator('.park-result-actions'), 'ranked result actions'],
      [dialog.locator('[data-park-result-close]'), 'dialog close control'],
    ]);
    await expect(dialog.locator('.park-result-actions button').first()).toBeVisible();
    await expectInViewport(dialog.locator('.park-result-actions button').first(), 'ranked final action', page);
    await expect(dialog).toHaveScreenshot(
      `ranked-${outcome}.png`,
      { animations: 'disabled', caret: 'hide', scale: 'css' },
    );
  });
}

test('phone project renders the actual full result screen with reduced motion and reachable actions', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-phone', 'Reduced motion is the phone release configuration.');

  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(`${fixtureBase}/e2e/result-stage.fixture.html?state=story`);
  await waitForStableArtwork(page);
  await expect.poll(() => page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  await expect(page.locator('.result-immersive__scores > div').first()).toHaveCSS('opacity', '1');
  await expectInViewport(page.getByRole('button', { name: 'Continue Chapter', exact: true }), 'story final action', page);

  await page.goto(`${fixtureBase}/e2e/result-stage.fixture.html?state=draw`);
  await waitForStableArtwork(page);
  await expect(page.locator('.result-immersive__scores > div').first()).toHaveCSS('opacity', '1');
  await expectInViewport(page.getByTestId('button-restart-match'), 'draw final action', page);

  await page.goto(`${fixtureBase}/e2e/ui-polish.fixture.html?mode=ranked-win`);
  await expect(page.getByTestId('ranked-result')).toBeVisible();
  await expect(page.locator('.park-result-scene > img').first()).toHaveCSS('opacity', '1');
  await expectInViewport(page.getByTestId('park-result-dialog').locator('.park-result-actions button').first(), 'ranked final action', page);
});