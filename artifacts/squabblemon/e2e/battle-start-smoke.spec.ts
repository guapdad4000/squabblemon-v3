import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

const fixturePath = '/e2e/battle-start-smoke.fixture.html';
const smokeSelector = 'img.battle-start-smoke';

type SmokeObjectStats = {
  creations: string[];
  revocations: string[];
  webpFetches: number;
};

async function smokeObjectStats(page: Page): Promise<SmokeObjectStats> {
  return page.evaluate(() => (
    window as typeof window & { __battleSmokeObjects: SmokeObjectStats }
  ).__battleSmokeObjects);
}

async function sendFixtureAction(page: Page, action: 'update' | 'disconnect' | 'reconnect' | 'complete' | 'rematch') {
  await page.evaluate(detail => {
    window.dispatchEvent(new CustomEvent('battle-smoke-fixture', { detail }));
  }, action);
}

async function expectPlayingFullscreen(page: Page, smoke: Locator) {
  await expect(smoke).toHaveCount(1);
  await expect(smoke).toBeVisible();
  await expect(smoke).toHaveAttribute('data-source', /assets\/effects\/battle-start-smoke\.webp$/);
  await expect.poll(() => smoke.getAttribute('data-ready'), {
    message: 'the true-alpha dust image should load before playback begins',
    timeout: 5_000,
  }).toBe('true');
  await expect(smoke).toHaveAttribute('src', /^blob:/);

  const alphaRange = await smoke.evaluate((image: HTMLImageElement) => {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context?.drawImage(image, 0, 0);
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
  expect(alphaRange).not.toBeNull();
  // The opening frame is translucent cloud across the whole screen, not an
  // empty hole yet. The timed screenshot test below verifies the clearing.
  expect(alphaRange!.min).toBeLessThan(200);
  expect(alphaRange!.max).toBeGreaterThan(140);

  const box = await smoke.boundingBox();
  const viewport = page.viewportSize();
  const arena = await smoke.evaluate(image => {
    const bounds = image.parentElement!.getBoundingClientRect();
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
  });
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  // The managed preview's development banner shifts the entire game downward.
  // The effect must cover its arena, not the banner outside the application.
  expect(box!.x).toBeCloseTo(arena.x, 0);
  expect(box!.y).toBeCloseTo(arena.y, 0);
  expect(box!.width).toBeCloseTo(arena.width, 0);
  expect(box!.height).toBeCloseTo(arena.height, 0);
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
  await page.addInitScript(() => {
    const stats: SmokeObjectStats = { creations: [], revocations: [], webpFetches: 0 };
    (window as typeof window & { __battleSmokeObjects: SmokeObjectStats }).__battleSmokeObjects = stats;
    const nativeFetch = window.fetch.bind(window);
    const nativeCreateObjectURL = URL.createObjectURL.bind(URL);
    const nativeRevokeObjectURL = URL.revokeObjectURL.bind(URL);

    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('assets/effects/battle-start-smoke.webp')) stats.webpFetches += 1;
      return nativeFetch(input, init);
    }) as typeof window.fetch;
    URL.createObjectURL = (blob: Blob | MediaSource) => {
      const url = nativeCreateObjectURL(blob);
      stats.creations.push(url);
      return url;
    };
    URL.revokeObjectURL = (url: string) => {
      stats.revocations.push(url);
      nativeRevokeObjectURL(url);
    };
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
});

test('@viewport true-alpha dust fills the viewport on desktop and phones', async ({ page }) => {
  await page.goto(`${fixturePath}?flow=local`);
  await expectPlayingFullscreen(page, page.locator(smokeSelector));
});

test('mounted guest training PlayLoop clears one image effect after its real completion timeout', async ({ page }) => {
  await page.goto(`${fixturePath}?flow=local`);
  const smoke = page.locator(smokeSelector);
  await expectPlayingFullscreen(page, smoke);
  await expect(smoke).toHaveCount(0, { timeout: 9_000 });
  const stats = await smokeObjectStats(page);
  expect(stats.webpFetches).toBe(1);
  expect(stats.creations).toHaveLength(1);
  expect(stats.revocations).toEqual(stats.creations);
});

test('SQUABBLE button icon removes its encoded green field', async ({ page }) => {
  await page.goto(`${fixturePath}?flow=local`);
  const smoke = page.locator(smokeSelector);
  await expect(smoke).toHaveCount(1);
  await smoke.dispatchEvent('error');
  await expect(smoke).toHaveCount(0);
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
      `${fixturePath}?kind=${kind}&code=${kind}-${testInfo.project.name}`,
    );
    await expectPlayingFullscreen(page, smoke);
    expect(await page.locator(smokeSelector).count()).toBe(1);
    if (kind === 'ranked') await captureVisibleSmoke(page, testInfo);
  });
}

test('room updates and reconnects in the same game never replace or replay the image', async ({ page }, testInfo) => {
  const smoke = await enterOnlineBattle(
    page,
    `${fixturePath}?kind=friend&code=stable-${testInfo.project.name}`,
  );
  await expectPlayingFullscreen(page, smoke);
  const firstSrc = await smoke.getAttribute('src');
  await smoke.evaluate(image => {
    (window as typeof window & { __firstSmokeImage?: Element }).__firstSmokeImage = image;
  });

  await sendFixtureAction(page, 'update');
  await expect(page.getByTestId('online-battle')).toHaveAttribute('data-revision', '4');
  await sendFixtureAction(page, 'disconnect');
  await expect(page.getByTestId('online-battle')).toHaveAttribute('data-connected', 'false');
  await sendFixtureAction(page, 'reconnect');
  await expect(page.getByTestId('online-battle')).toHaveAttribute('data-connected', 'true');
  await expect(smoke).toHaveAttribute('src', firstSrc!);
  expect(await smoke.evaluate(image => (
    (window as typeof window & { __firstSmokeImage?: Element }).__firstSmokeImage === image
  ))).toBe(true);
  expect(await smokeObjectStats(page)).toEqual({
    creations: [firstSrc],
    revocations: [],
    webpFetches: 1,
  });

  await expect(smoke).toHaveCount(0, { timeout: 9_000 });
  await sendFixtureAction(page, 'update');
  await expect(smoke).toHaveCount(0);
  const stats = await smokeObjectStats(page);
  expect(stats.creations).toEqual([firstSrc]);
  expect(stats.revocations).toEqual([firstSrc]);
  expect(stats.webpFetches).toBe(1);
});

test('result and final-board review do not replay smoke', async ({ page }, testInfo) => {
  const smoke = await enterOnlineBattle(
    page,
    `${fixturePath}?kind=friend&code=result-${testInfo.project.name}`,
  );
  await expect(smoke).toBeVisible();
  await sendFixtureAction(page, 'complete');
  await expect(smoke).toHaveCount(0);
  await expect(page.getByTestId('park-result-dialog')).toBeVisible();
  await page.getByRole('button', { name: /inspect final board/i }).click();
  await expect(page.locator('.park-result-return')).toBeVisible();
  await expect(smoke).toHaveCount(0);
  const stats = await smokeObjectStats(page);
  expect(stats.creations).toHaveLength(1);
  expect(stats.revocations).toEqual(stats.creations);
});

test('a rematch game number gets a fresh blob URL under the real route key', async ({ page }, testInfo) => {
  const smoke = await enterOnlineBattle(
    page,
    `${fixturePath}?kind=friend&code=rematch-${testInfo.project.name}`,
  );
  await expectPlayingFullscreen(page, smoke);
  const firstSrc = await smoke.getAttribute('src');
  await smoke.dispatchEvent('error');
  await expect(smoke).toHaveCount(0);
  await sendFixtureAction(page, 'rematch');
  await expect(page.getByTestId('match-arrival')).toBeVisible();
  await page.getByRole('button', { name: /step into the field/i }).click();
  await expectPlayingFullscreen(page, smoke);
  const secondSrc = await smoke.getAttribute('src');
  expect(secondSrc).not.toBe(firstSrc);
  await expect(page.getByTestId('online-battle')).toHaveAttribute('data-round', '1');
  const stats = await smokeObjectStats(page);
  expect(stats.creations).toEqual([firstSrc, secondSrc]);
  expect(stats.revocations).toEqual([firstSrc]);
  expect(stats.webpFetches).toBe(2);
});

test('blocked WebM and rejected autoplay do not block image dust', async ({ page }, testInfo) => {
  await page.route(/\.webm(?:\?|$)/, route => route.abort('blockedbyclient'));
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('Autoplay blocked', 'NotAllowedError'));
  });
  const smoke = await enterOnlineBattle(
    page,
    `${fixturePath}?kind=friend&code=no-webm-${testInfo.project.name}`,
  );
  await expectPlayingFullscreen(page, smoke);
  expect((await smokeObjectStats(page)).webpFetches).toBe(1);
});

test('failed WebP request clears without duplication', async ({ page }, testInfo) => {
  await page.route(/battle-start-smoke\.webp(?:\?|$)/, route => route.abort('failed'));
  const smoke = await enterOnlineBattle(
    page,
    `${fixturePath}?kind=friend&code=failed-webp-${testInfo.project.name}`,
  );
  await expect(smoke).toHaveCount(0, { timeout: 3_000 });
  await sendFixtureAction(page, 'update');
  await expect(smoke).toHaveCount(0);
  expect(await smokeObjectStats(page)).toEqual({ creations: [], revocations: [], webpFetches: 1 });
});

test('stalled WebP request clears on the bounded load timeout', async ({ page }, testInfo) => {
  await page.route(/battle-start-smoke\.webp(?:\?|$)/, route => {
    setTimeout(() => void route.abort('timedout').catch(() => undefined), 5_000);
  });
  const smoke = await enterOnlineBattle(
    page,
    `${fixturePath}?kind=friend&code=stalled-webp-${testInfo.project.name}`,
  );
  const startedAt = Date.now();
  await expect(smoke).toHaveCount(0, { timeout: 4_000 });
  expect(Date.now() - startedAt).toBeLessThan(4_000);
  expect(await smokeObjectStats(page)).toEqual({ creations: [], revocations: [], webpFetches: 1 });
});

test('pagehide clears and revokes the in-flight image', async ({ page }, testInfo) => {
  const smoke = await enterOnlineBattle(
    page,
    `${fixturePath}?kind=friend&code=pagehide-${testInfo.project.name}`,
  );
  await expectPlayingFullscreen(page, smoke);
  const src = await smoke.getAttribute('src');
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  await expect(smoke).toHaveCount(0);
  const stats = await smokeObjectStats(page);
  expect(stats.creations).toEqual([src]);
  expect(stats.revocations).toEqual([src]);
});

test('becoming hidden clears and revokes the in-flight image', async ({ page }, testInfo) => {
  const smoke = await enterOnlineBattle(
    page,
    `${fixturePath}?kind=friend&code=hidden-${testInfo.project.name}`,
  );
  await expectPlayingFullscreen(page, smoke);
  const src = await smoke.getAttribute('src');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(smoke).toHaveCount(0);
  const stats = await smokeObjectStats(page);
  expect(stats.creations).toEqual([src]);
  expect(stats.revocations).toEqual([src]);
});

test('natural completion leaves no brown layer over the board', async ({ page }, testInfo) => {
  const smoke = await enterOnlineBattle(
    page,
    `${fixturePath}?kind=ranked&code=natural-${testInfo.project.name}`,
  );
  await expectPlayingFullscreen(page, smoke);
  await expect(smoke).toHaveCount(0, { timeout: 9_000 });
  await expect(page.getByTestId('battle-arena')).toBeVisible();
  await expect(page.locator(smokeSelector)).toHaveCount(0);
});

test('at four seconds the center board matches the baseline with dust hidden', async ({ page }, testInfo) => {
  const smoke = await enterOnlineBattle(
    page,
    `${fixturePath}?kind=ranked&code=pixels-${testInfo.project.name}`,
  );
  await expectPlayingFullscreen(page, smoke);
  await page.addStyleTag({ content: `
    body *:not(.battle-start-smoke) {
      animation-play-state: paused !important;
      caret-color: transparent !important;
    }
  ` });
  await page.waitForTimeout(4_000);
  await expect(smoke).toHaveCount(1);
  const viewport = page.viewportSize()!;
  const clip = {
    x: Math.floor(viewport.width * 0.4),
    y: Math.floor(viewport.height * 0.4),
    width: Math.max(48, Math.floor(viewport.width * 0.2)),
    height: Math.max(48, Math.floor(viewport.height * 0.2)),
  };
  const withDust = await page.screenshot({ clip, animations: 'allow' });
  await smoke.evaluate((image: HTMLImageElement) => {
    image.style.visibility = 'hidden';
  });
  const withoutDust = await page.screenshot({ clip, animations: 'allow' });
  await smoke.evaluate((image: HTMLImageElement) => {
    image.style.visibility = '';
  });

  const difference = await page.evaluate(async ({ foreground, baseline }) => {
    const decode = async (base64: string) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d', { willReadFrequently: true })!;
      context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, image.width, image.height).data;
    };
    const [actual, expected] = await Promise.all([decode(foreground), decode(baseline)]);
    let changed = 0;
    let totalDelta = 0;
    for (let i = 0; i < actual.length; i += 4) {
      const delta = Math.abs(actual[i] - expected[i])
        + Math.abs(actual[i + 1] - expected[i + 1])
        + Math.abs(actual[i + 2] - expected[i + 2]);
      if (delta > 18) changed += 1;
      totalDelta += delta;
    }
    return {
      changedRatio: changed / (actual.length / 4),
      meanChannelDelta: totalDelta / actual.length,
    };
  }, { foreground: withDust.toString('base64'), baseline: withoutDust.toString('base64') });
  expect(difference.changedRatio).toBeLessThan(0.01);
  expect(difference.meanChannelDelta).toBeLessThan(1);
});

test('system and profile reduced motion suppress a visible effect', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${fixturePath}?kind=ranked&code=system-reduced-${testInfo.project.name}`);
  await expect(page.getByTestId('online-battle')).toBeVisible();
  await expect(page.locator(smokeSelector)).toHaveCount(0);
  await page.waitForTimeout(800);
  await expect(page.locator(smokeSelector)).toHaveCount(0);

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${fixturePath}?kind=ranked&profileReduced=true&code=profile-reduced-${testInfo.project.name}`);
  await expect(page.getByTestId('online-battle')).toBeVisible();
  await expect(page.locator(smokeSelector)).toHaveCount(0);
  await page.waitForTimeout(800);
  await expect(page.locator(smokeSelector)).toHaveCount(0);
});