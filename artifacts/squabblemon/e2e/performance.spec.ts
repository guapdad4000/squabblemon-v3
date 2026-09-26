import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('squabblemon_e2e_user', 'signed-in'));
  await page.route('**/api/**', route => route.fulfill({ contentType: 'application/json', body: 'null' }));
});

test('GPU chroma preserves the existing color key and CPU fallback', async ({ page }) => {
  await page.goto('/e2e/loading.fixture.html');
  const results = await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path);
    const { createChromaRenderer } = await load('/src/lib/chromaRenderer.ts');
    const { keyChromaPixels } = await load('/src/specialMoves.ts');
    const { keyFrame } = await load('/src/components/KeyedVideo.tsx');
    const input = document.createElement('canvas'); input.width = input.height = 32;
    const context = input.getContext('2d')!;
    const image = context.createImageData(32, 32);
    for (let i = 0; i < image.data.length; i += 4) {
      image.data[i] = (i * 11) % 256; image.data[i + 1] = (i * 19 + 75) % 256;
      image.data[i + 2] = (i * 7 + 123) % 256; image.data[i + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    const results = [];
    for (const mode of ['green', 'light', 'move-green', 'move-cyan', 'move-none']) {
      const key = (pixels: Uint8ClampedArray) => mode.startsWith('move-') ? keyChromaPixels(pixels, mode.slice(5)) : keyFrame(pixels, mode);
      const expected = image.data.slice(); key(expected);
      const surface = document.createElement('canvas'); surface.width = surface.height = 32;
      const renderer = createChromaRenderer(surface, mode, key);
      renderer.draw(input);
      const gl = surface.getContext('webgl')!;
      const actual = new Uint8Array(expected.length);
      gl.readPixels(0, 0, 32, 32, gl.RGBA, gl.UNSIGNED_BYTE, actual);
      let maximumError = 0;
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32 * 4; x++) {
        maximumError = Math.max(maximumError, Math.abs(expected[y * 128 + x] - actual[(31 - y) * 128 + x]));
      }
      results.push({ mode, renderer: renderer.kind, maximumError });
      renderer.dispose(); gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    const fallback = document.createElement('canvas'); fallback.width = fallback.height = 32;
    const getContext = fallback.getContext.bind(fallback);
    Object.defineProperty(fallback, 'getContext', { value: (kind: string, options: object) => kind === 'webgl' ? null : getContext(kind as '2d', options) });
    const cpu = createChromaRenderer(fallback, 'move-none', () => {});
    cpu.draw(input);
    results.push({ mode: 'fallback', renderer: cpu.kind, maximumError: 0 });
    cpu.dispose();
    return results;
  });
  for (const result of results) {
    expect(result.renderer).toBe(result.mode === 'fallback' ? 'cpu' : 'gpu');
    expect(result.maximumError, result.mode).toBeLessThanOrEqual(1);
  }
});

test('cold collection loads its own route; hovering a destination prepares that screen', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(new URL(request.url()).pathname));
  await page.goto('/game/collection');
  await expect(page.getByTestId('collection-card-control').first()).toBeVisible();
  expect(requests.some(url => /\/(Home|Shop|Story|ChallengesHub|Multiplayer)\.tsx$/.test(url))).toBe(false);
  await page.getByRole('button', { name: 'Open game navigation', exact: true }).click();
  const shop = page.getByRole('button', { name: /^Shop ·/ });
  await shop.hover();
  await expect.poll(() => requests.some(url => url.endsWith('/Shop.tsx'))).toBe(true);
  await shop.click();
  await expect(page.locator('.gacha-stage')).toBeVisible();
  await page.getByRole('button', { name: 'Open game navigation', exact: true }).click();
  await page.getByRole('button', { name: /^Cards & gangs ·/ }).click();
  await expect(page.locator('.arsenal-paper-tabs')).toBeVisible();
  await page.getByTestId('collection-card-control').first().click();
  await expect(page.getByTestId('card-inspector')).toBeVisible();
});

test('safehouse controls remain usable after the camera settles, moves, and resizes', async ({ page }) => {
  test.slow(); // The full 3D room also runs on Chromium's software GPU in CI.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/game');
  await expect(page.locator('.safehouse-stage[data-scene-ready="true"]')).toBeVisible();
  const buttons = page.locator('.safehouse-room-markers button');
  await expect.poll(() => buttons.evaluateAll(buttons => buttons.every(button => (button as HTMLElement).dataset.anchorPositioned === 'true'))).toBe(true);
  for (const name of ['Explore the television', 'Explore the heavy bag', 'Explore your gang cards', 'Explore the phone', 'Explore the turntable']) {
    await page.getByRole('button', { name, exact: true }).click();
    await page.getByRole('button', { name: 'Back to the room', exact: true }).click();
    await expect(page.getByRole('button', { name, exact: true })).toBeFocused();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => buttons.evaluateAll(buttons => buttons.every(button => {
    const rect = button.getBoundingClientRect();
    return rect.width > 0 && rect.x >= 0 && rect.y >= 0 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1;
  }))).toBe(true);
});

test('real special-move video uses the GPU and still supports mute and skip', async ({ page }) => {
  await page.goto('/e2e/special-move-audio.fixture.html');
  const canvas = page.getByTestId('special-move-canvas');
  await expect(canvas).toHaveAttribute('data-renderer', 'gpu');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Sound on', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-muted', 'false');
  await page.getByRole('button', { name: 'Mute', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-muted', 'true');
  await canvas.evaluate((surface: HTMLCanvasElement) => surface.getContext('webgl')!.getExtension('WEBGL_lose_context')!.loseContext());
  await expect(canvas).toHaveAttribute('data-renderer', 'cpu');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await expect(canvas).toHaveCount(0);
});

test('a real battle still selects, deploys, animates, and inspects cards', async ({ page }) => {
  await page.goto('/play/guest');
  await page.getByTestId('button-start').click();
  const arena = page.getByTestId('battle-arena');
  await expect(arena).toBeVisible();
  await page.getByRole('button', { name: /^Continue past / }).click();
  await expect(arena).toHaveAttribute('data-presentation-phase', 'player-ready');
  await page.getByTestId('hand-tray').locator('[data-card-zone="hand"]:not([title])').first().click();
  await page.getByRole('button', { name: /^Deploy / }).first().click();
  await page.getByTestId('button-lock').click();
  await expect(arena).toHaveAttribute('data-presentation-phase', 'lock-in');
  await expect(arena).toHaveAttribute('data-presentation-phase', 'player-impact');
  await expect(page.locator('[data-testid^="card-board-player-"]').first()).toBeVisible();
  await expect(arena).toHaveAttribute('data-presentation-phase', 'player-ready', { timeout: 20000 });
  await page.locator('[data-testid^="card-board-player-"]').first().click();
  await expect(page.getByTestId('card-inspector')).toBeVisible();
});
