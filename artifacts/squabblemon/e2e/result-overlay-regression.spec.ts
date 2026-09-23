import { expect, test, type Locator, type Page } from '@playwright/test';

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

async function waitForStableArtwork(page: Page) {
  await page.waitForFunction(() => (
    document.fonts.status === 'loaded'
    && [...document.images].every(image => image.complete && image.naturalWidth > 0)
  ));
}

async function freezeAnimatedMarks(page: Page) {
  await page.locator('.result-art__outcome-mark, .park-result-outcome-mark').evaluateAll(images => {
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
  { name: 'story-victory', state: 'story', stars: true },
  { name: 'standard-victory', state: 'win', stars: false },
  { name: 'standard-loss', state: 'loss', stars: false },
] as const;

for (const resultCase of resultCases) {
  test(`${resultCase.name} keeps result marks clear of rewards and controls`, async ({ page }) => {
    await page.goto(`/squabblemon/e2e/result-stage.fixture.html?state=${resultCase.state}`);
    await waitForStableArtwork(page);
    await freezeAnimatedMarks(page);

    const canvas = page.locator('.result-art__canvas');
    const mark = canvas.locator('.result-art__outcome-mark');
    const protectedRegions: Array<[Locator, string]> = [
      [canvas.locator('.result-art__plaque'), 'Battle Earnings'],
      [canvas.locator('.result-art__scores'), 'district scores'],
      [canvas.locator('.result-art__toggle'), 'scene toggle'],
      [page.locator('.result-art__actions'), 'result actions'],
    ];

    await expectNoOverlap(mark, 'result mark', protectedRegions);
    await expect(page.locator('.result-stage')).toHaveCSS('scrollbar-width', 'none');
    await expect(page.locator('.result-art__image')).toHaveAttribute('draggable', 'false');

    const stars = canvas.locator('.result-art__story-stars');
    if (resultCase.stars) {
      await expect(stars).toHaveAttribute('aria-label', /^[1-3] of 3 story stars earned$/);
      await expectNoOverlap(stars, 'story stars', protectedRegions);
    } else {
      await expect(stars).toHaveCount(0);
    }

    await expect(page.locator('.result-art')).toHaveScreenshot(
      `${resultCase.name}.png`,
      { animations: 'disabled', caret: 'hide', scale: 'css' },
    );
  });
}

for (const resultCase of [
  { name: 'story-draw', state: 'story-draw', story: true },
  { name: 'training-draw', state: 'draw', story: false },
] as const) {
  test(`${resultCase.name} uses the dedicated tie scene and preserves its actions`, async ({ page }) => {
    await page.goto(`/squabblemon/e2e/result-stage.fixture.html?state=${resultCase.state}`);
    await waitForStableArtwork(page);

    const art = page.locator('.result-art');
    await expect(art).toHaveAttribute('data-result-outcome', 'draw');
    await expect(art).toHaveAttribute('aria-label', 'Tied battle outcome artwork');
    await expect(art.locator('.result-art__image')).toHaveAttribute('src', /draw-scene-wide\.webp$/);
    await expect(art.locator('.result-art__draw-mark')).toHaveAccessibleName('Tie');
    await expect(page.getByTestId('status-match-result')).toHaveText('Nobody Owns The Room');
    await expect(page.getByTestId('button-restart-match')).toBeVisible();
    if (resultCase.story) {
      await expect(page.getByText('Continue Chapter')).toBeVisible();
      await page.locator('.result-stage__receipt-drawer').evaluate((drawer: HTMLDetailsElement) => {
        drawer.open = true;
      });
      await expect(page.getByText('Encounter tied · no side claimed the chapter.')).toBeVisible();
      await expect(page.getByTestId('button-change-deck')).toHaveCount(0);
    } else {
      await expect(page.getByTestId('button-change-deck')).toBeVisible();
      await expect(page.getByText('Home', { exact: true })).toBeVisible();
    }

    await expect(art).toHaveScreenshot(
      `${resultCase.name}.png`,
      { animations: 'disabled', caret: 'hide', scale: 'css' },
    );
  });
}

for (const outcome of ['win', 'loss', 'draw'] as const) {
  test(`ranked PvP ${outcome} keeps its mark clear of scores and dialog controls`, async ({ page }) => {
    await page.goto(`/squabblemon/e2e/ui-polish.fixture.html?mode=ranked-${outcome}`);
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

    await expect(dialog).toHaveScreenshot(
      `ranked-${outcome}.png`,
      { animations: 'disabled', caret: 'hide', scale: 'css' },
    );
  });
}

test('phone project renders the overlay fixtures with reduced motion', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-phone', 'Reduced motion is the phone release configuration.');

  await page.goto('/squabblemon/e2e/result-stage.fixture.html?state=story');
  await expect.poll(() => page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  await expect(page.locator('.result-art__scores > div').first()).toHaveCSS('opacity', '1');

  await page.goto('/squabblemon/e2e/result-stage.fixture.html?state=draw');
  await waitForStableArtwork(page);
  await expect(page.locator('.result-art__draw-mark')).toBeVisible();
  await expect(page.locator('.result-art__scores > div').first()).toHaveCSS('opacity', '1');
  await expect(page.locator('.result-art')).toHaveScreenshot(
    'training-draw-phone.png',
    { animations: 'disabled', caret: 'hide', scale: 'css' },
  );

  await page.goto('/squabblemon/e2e/ui-polish.fixture.html?mode=ranked-win');
  await expect(page.getByTestId('ranked-result')).toBeVisible();
  await expect(page.locator('.park-result-scene > img').first()).toHaveCSS('opacity', '1');
});