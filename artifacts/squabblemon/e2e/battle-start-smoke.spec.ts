import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

const smokeSelector = 'canvas.battle-start-smoke';

async function sendFixtureAction(page: Page, action: 'update' | 'disconnect' | 'reconnect' | 'complete' | 'rematch') {
  await page.evaluate(detail => {
    window.dispatchEvent(new CustomEvent('battle-smoke-fixture', { detail }));
  }, action);
}

async function expectPlayingFullscreen(page: Page, smoke: Locator) {
  await expect(smoke).toHaveCount(1);
  await expect(smoke).toBeVisible();
  await expect(smoke).toHaveAttribute('data-source', /assets\/effects\/battle-start-smoke\.webm$/);
  await expect.poll(() => smoke.getAttribute('data-ready'), {
    message: 'the keyed smoke canvas should render a decoded frame',
    timeout: 5_000,
  }).toBe('true');
  const readAlphaRange = () => smoke.evaluate((canvas: HTMLCanvasElement) => {
      const context = canvas.getContext('2d');
      const pixels = context?.getImageData(0, 0, canvas.width, canvas.height).data;
      if (!pixels) return null;
      let min = 255;
      let max = 0;
      for (let i = 3; i < pixels.length; i += 16) {
        min = Math.min(min, pixels[i]);
        max = Math.max(max, pixels[i]);
      }
      return { min, max };
    });
  await expect.poll(async () => (await readAlphaRange())?.max ?? 0, {
      message: 'the decoded dust frame should contain keyed transparency and visible ink',
      timeout: 5_000,
    }).toBeGreaterThan(140);
  const alphaRange = await readAlphaRange();
  expect(alphaRange).not.toBeNull();
  expect(alphaRange!.min).toBeLessThan(80);
  const box = await smoke.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeCloseTo(0, 0);
  expect(box!.y).toBeCloseTo(0, 0);
  expect(box!.width).toBeCloseTo(viewport!.width, 0);
  expect(box!.height).toBeCloseTo(viewport!.height, 0);
  await expect(smoke).toHaveCSS('pointer-events', 'none');
}

async function enterOnlineBattle(page: Page, url: string) {
  await page.goto(url);
  await expect(page.getByTestId('match-arrival')).toBeVisible();
  await expect(page.locator(smokeSelector)).toHaveCount(0);
  await page.getByRole('button', { name: /step into the field/i }).click();
  await expect(page.getByTestId('match-arrival')).toHaveCount(0);
  return page.locator(smokeSelector);
}

async function captureVisibleSmoke(page: Page, testInfo: TestInfo) {
  const shot = await page.screenshot({ animations: 'allow' });
  await testInfo.attach(`pvp-smoke-${testInfo.project.name}`, { body: shot, contentType: 'image/png' });
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
});

test('mounted guest training PlayLoop plays one keyed full-viewport smoke effect', async ({ page }) => {
  await page.goto('/squabblemon/e2e/battle-start-smoke.fixture.html?flow=local');
  const smoke = page.locator(smokeSelector);
  await expectPlayingFullscreen(page, smoke);
  await expect(page.getByText(/offline training/i)).toBeVisible();
  await smoke.dispatchEvent('ended');
  await expect(smoke).toHaveCount(0);
});

test('SQUABBLE button icon removes its encoded green field', async ({ page }) => {
  await page.goto('/squabblemon/e2e/battle-start-smoke.fixture.html?flow=local');
  const smoke = page.locator(smokeSelector);
  await expect(smoke).toHaveCount(1);
  await smoke.dispatchEvent('ended');
  const icon = page.locator('canvas.battle-squabble__video');
  await expect(icon).toHaveAttribute('data-source', /assets\/combat\/squabble-button\.webm$/);
  await expect.poll(() => icon.getAttribute('data-ready'), { timeout: 5_000 }).toBe('true');
  const alphaRange = await icon.evaluate((canvas: HTMLCanvasElement) => {
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    let min = 255;
    let max = 0;
    for (let i = 3; i < pixels.length; i += 4) {
      min = Math.min(min, pixels[i]);
      max = Math.max(max, pixels[i]);
    }
    return { min, max };
  });
  expect(alphaRange.min).toBeLessThan(20);
  expect(alphaRange.max).toBeGreaterThan(220);
});

for (const kind of ['friend', 'ranked', 'bot'] as const) {
  test(`${kind} PvP starts smoke only after the arrival poster is dismissed`, async ({ page }, testInfo) => {
    const smoke = await enterOnlineBattle(
      page,
      `/squabblemon/e2e/battle-start-smoke.fixture.html?kind=${kind}&code=${kind}-${testInfo.project.name}`,
    );
    await expectPlayingFullscreen(page, smoke);
    expect(await page.locator(smokeSelector).count()).toBe(1);
    if (kind === 'ranked') await captureVisibleSmoke(page, testInfo);
  });
}

test('room updates and reconnects in the same game never replay the effect', async ({ page }, testInfo) => {
  const smoke = await enterOnlineBattle(
    page,
    `/squabblemon/e2e/battle-start-smoke.fixture.html?kind=friend&code=stable-${testInfo.project.name}`,
  );
  await expectPlayingFullscreen(page, smoke);
  await smoke.dispatchEvent('ended');
  await expect(smoke).toHaveCount(0);

  await sendFixtureAction(page, 'update');
  await expect(page.getByTestId('online-battle')).toHaveAttribute('data-revision', '4');
  await expect(smoke).toHaveCount(0);
  await sendFixtureAction(page, 'disconnect');
  await expect(page.getByTestId('online-battle')).toHaveAttribute('data-connected', 'false');
  await sendFixtureAction(page, 'reconnect');
  await expect(page.getByTestId('online-battle')).toHaveAttribute('data-connected', 'true');
  await expect(smoke).toHaveCount(0);
});

test('result and final-board review do not replay smoke', async ({ page }, testInfo) => {
  const smoke = await enterOnlineBattle(
    page,
    `/squabblemon/e2e/battle-start-smoke.fixture.html?kind=friend&code=result-${testInfo.project.name}`,
  );
  await expect(smoke).toBeVisible();
  await sendFixtureAction(page, 'complete');
  await expect(smoke).toHaveCount(0);
  await expect(page.getByTestId('park-result-dialog')).toBeVisible();
  await page.getByRole('button', { name: /inspect final board/i }).click();
  await expect(page.locator('.park-result-return')).toBeVisible();
  await expect(smoke).toHaveCount(0);
});

test('a rematch game number gets one fresh effect under the real route key', async ({ page }, testInfo) => {
  const smoke = await enterOnlineBattle(
    page,
    `/squabblemon/e2e/battle-start-smoke.fixture.html?kind=friend&code=rematch-${testInfo.project.name}`,
  );
  await smoke.dispatchEvent('ended');
  await sendFixtureAction(page, 'rematch');
  await expect(page.getByTestId('match-arrival')).toBeVisible();
  await expect(smoke).toHaveCount(0);
  await page.getByRole('button', { name: /step into the field/i }).click();
  await expectPlayingFullscreen(page, smoke);
  await expect(page.getByTestId('online-battle')).toHaveAttribute('data-round', '1');
});

test('decode error clears the keyed effect without duplication', async ({ page }, testInfo) => {
  const smoke = await enterOnlineBattle(
    page,
    `/squabblemon/e2e/battle-start-smoke.fixture.html?kind=friend&code=error-${testInfo.project.name}`,
  );
  await expect(smoke).toHaveCount(1);
  await smoke.dispatchEvent('error');
  await expect(smoke).toHaveCount(0);
  await sendFixtureAction(page, 'update');
  await expect(smoke).toHaveCount(0);
});

test('system and profile reduced motion suppress a visible effect', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/squabblemon/e2e/battle-start-smoke.fixture.html?kind=ranked&code=system-reduced-${testInfo.project.name}`);
  await expect(page.getByTestId('online-battle')).toBeVisible();
  await expect(page.locator(smokeSelector)).toHaveCount(0);
  await page.waitForTimeout(800);
  await expect(page.locator(smokeSelector)).toHaveCount(0);

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`/squabblemon/e2e/battle-start-smoke.fixture.html?kind=ranked&profileReduced=true&code=profile-reduced-${testInfo.project.name}`);
  await expect(page.getByTestId('online-battle')).toBeVisible();
  await expect(page.locator(smokeSelector)).toHaveCount(0);
  await page.waitForTimeout(800);
  await expect(page.locator(smokeSelector)).toHaveCount(0);
});