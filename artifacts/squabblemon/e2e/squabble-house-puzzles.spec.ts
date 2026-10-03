import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { squabbleHouseChapters } from '../../../lib/squabblemon-engine/src/storySquabbleHouse';

const nodes = squabbleHouseChapters.flatMap(chapter => chapter.nodes).filter(node => node.puzzle);
const evidence = resolve(process.cwd(), '../deliverables/squabble-house-story-arc/puzzle-audit');
const getOrder = (page: Page) => page.locator('[data-puzzle-piece]').evaluateAll(elements => elements.map(el => (el as HTMLElement).dataset.puzzlePiece!));

async function openPuzzle(page: Page, baseURL: string | undefined, index: number) {
  await page.goto(`${baseURL}/e2e/season-theater.fixture.html?scenario=puzzle&puzzleNode=${nodes[index].id}`);
  await expect(page.getByRole('dialog', { name: nodes[index].puzzle!.title })).toBeVisible();
}

async function reorder(page: Page, solution: readonly string[], keyboard: boolean) {
  for (const [position, id] of solution.entries()) {
    while ((await getOrder(page)).indexOf(id) > position) {
      const piece = page.locator(`[data-puzzle-piece="${id}"]`);
      if (keyboard) { await piece.focus(); await piece.press('ArrowUp'); }
      else await piece.getByRole('button', { name: /^Move .* up$/ }).click();
    }
  }
  await expect.poll(() => getOrder(page)).toEqual(solution);
}

async function touchSwapFirstTwo(page: Page) {
  const before = await getOrder(page);
  const first = page.locator('[data-puzzle-piece]').nth(0);
  const second = page.locator('[data-puzzle-piece]').nth(1);
  await first.scrollIntoViewIfNeeded();
  const grip = await first.locator('.story-puzzle-drag-handle').boundingBox();
  const target = await second.boundingBox();
  expect(grip).not.toBeNull(); expect(target).not.toBeNull();
  const cdp = await page.context().newCDPSession(page);
  try {
    const x = grip!.x + grip!.width / 2, y = grip!.y + grip!.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: target!.y + target!.height / 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally { await cdp.detach(); }
  await expect.poll(() => getOrder(page)).toEqual([before[1], before[0], ...before.slice(2)]);
}

async function auditSurface(page: Page) {
  const dialog = page.getByRole('dialog');
  const loaded = await dialog.evaluate(async root => {
    const urls = new Set(Array.from(root.querySelectorAll('img')).map(img => img.src));
    for (const element of [root, ...Array.from(root.querySelectorAll('*'))]) {
      const bg = getComputedStyle(element).backgroundImage;
      for (const match of bg.matchAll(/url\(["']?([^"')]+)["']?\)/g)) urls.add(match[1]);
    }
    return Promise.all([...urls].map(url => new Promise<{ url: string; loaded: boolean }>(done => {
      const img = new Image(); img.onload = () => done({ url, loaded: img.naturalWidth > 0 }); img.onerror = () => done({ url, loaded: false }); img.src = url;
    })));
  });
  expect(loaded.length).toBeGreaterThan(0);
  expect(loaded.filter(image => !image.loaded)).toEqual([]);
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  for (const row of await page.locator('[data-puzzle-piece]').all()) {
    const clueId = await row.getAttribute('aria-describedby');
    expect(clueId).toBeTruthy();
    await expect(page.locator(`[id="${clueId}"]`)).not.toBeEmpty();
  }
  const first = dialog.locator('button:enabled').first();
  const last = dialog.locator('button:enabled').last();
  await first.focus(); await page.keyboard.press('Shift+Tab'); await expect(last).toBeFocused();
  await page.keyboard.press('Tab'); await expect(first).toBeFocused();
}

for (const surface of [
  { name: 'desktop', width: 1440, height: 1000, keyboard: false, touch: false },
  { name: 'phone', width: 390, height: 844, keyboard: false, touch: true },
  { name: 'short-phone', width: 360, height: 640, keyboard: true, touch: false },
]) {
  test(`${surface.name}: all six House puzzles render, reject wrong order, reveal hints, solve and clear`, async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    await mkdir(evidence, { recursive: true });
    await page.setViewportSize({ width: surface.width, height: surface.height });
    await page.emulateMedia({ reducedMotion: surface.name === 'desktop' ? 'no-preference' : 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    for (let index = 0; index < nodes.length; index++) {
      const puzzle = nodes[index].puzzle!;
      await openPuzzle(page, baseURL, index);
      await auditSurface(page);
      await page.getByRole('button', { name: 'Check arrangement', exact: true }).click();
      await expect(page.getByRole('alert')).toContainText('not correct yet');
      await expect(page.getByRole('button', { name: 'Check arrangement', exact: true })).toBeEnabled();
      await page.getByRole('button', { name: 'Reveal Hint 1 / 2', exact: true }).click();
      await expect(page.getByText(puzzle.hints[0], { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Reveal Hint 2 / 2', exact: true }).click();
      await expect(page.getByText(puzzle.hints[1], { exact: true })).toBeVisible();
      const errorBox = await page.getByRole('alert').boundingBox();
      const actionsBox = await page.locator('.story-puzzle-actions').boundingBox();
      expect(errorBox!.y + errorBox!.height).toBeLessThanOrEqual(actionsBox!.y + 1);
      if (surface.touch) await touchSwapFirstTwo(page);
      await reorder(page, puzzle.solution, surface.keyboard);
      await expect(page.getByRole('alert')).toHaveCount(0);
      if (puzzle.presentation?.layout === 'pass') {
        await expect(page.locator('.house-pass__timeline .is-late')).toHaveCount(0);
        if (surface.width < 400) {
          const toast = page.locator('.house-pass__timeline > div').last();
          expect((await toast.boundingBox())!.width).toBeGreaterThanOrEqual(76);
          await toast.scrollIntoViewIfNeeded();
          await page.locator('.house-pass').screenshot({ path: resolve(evidence, `${surface.name}-ch4-readable-toast.png`) });
          await page.locator('.house-pass__timeline').evaluate(el => { el.scrollLeft = 0; });
        }
      }
      if (puzzle.presentation?.layout === 'route') await expect(page.locator('.house-route line[stroke-dasharray]')).toHaveCount(0);
      await page.getByRole('dialog').evaluate(el => { el.scrollTop = 0; });
      await page.screenshot({ path: resolve(evidence, `${surface.name}-ch${index + 1}-solved.png`) });
      await page.getByRole('button', { name: 'Check arrangement', exact: true }).click();
      await expect(page.getByText(puzzle.solvedText, { exact: true })).toBeVisible();
      expect(await page.evaluate(id => localStorage.getItem(`season-theater:puzzle:${id}`), nodes[index].id)).toBe('complete');
    }
    expect(errors).toEqual([]);
  });
}

test('failed save preserves order and hints; retry keeps identity; duplicate submit is locked', async ({ page, baseURL }) => {
  await openPuzzle(page, baseURL, 0);
  const puzzle = nodes[0].puzzle!;
  await reorder(page, puzzle.solution, false);
  await page.getByRole('button', { name: 'Reveal Hint 1 / 2', exact: true }).click();
  await page.evaluate(() => {
    const original = window.fetch;
    const state = window as typeof window & { __auditBodies: unknown[] };
    state.__auditBodies = [];
    let fail = true;
    window.fetch = async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      if (request.method === 'POST' && request.url.endsWith('/story/puzzle')) {
        state.__auditBodies.push(await request.clone().json());
        await new Promise(resolve => setTimeout(resolve, 150));
        if (fail) { fail = false; return new Response(JSON.stringify({ error: 'Simulated offline save' }), { status: 503, headers: { 'content-type': 'application/json' } }); }
      }
      return original(input, init);
    };
  });
  const submit = page.getByRole('button', { name: 'Check arrangement', exact: true });
  await submit.evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  await expect(page.getByRole('alert')).toContainText('could not reach the server');
  expect(await getOrder(page)).toEqual(puzzle.solution);
  await expect(page.getByText(puzzle.hints[0], { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__auditBodies.length)).toBe(1);
  await submit.click();
  await expect(page.getByText(puzzle.solvedText, { exact: true })).toBeVisible();
  const bodies = await page.evaluate(() => (window as any).__auditBodies);
  expect(bodies).toHaveLength(2);
  expect(bodies[0].idempotencyKey).toBe(bodies[1].idempotencyKey);
});

test('Escape closes the puzzle; explicit skip is distinct from a solved arrangement', async ({ page, baseURL }) => {
  await openPuzzle(page, baseURL, 1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: nodes[1].puzzle!.title })).toHaveCount(0);
  await openPuzzle(page, baseURL, 1);
  await page.getByRole('button', { name: 'Skip puzzle', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__seasonPuzzleLastBody?.skip)).toBe(true);
  const body = await page.evaluate(() => (window as any).__seasonPuzzleLastBody);
  expect(body.skip).toBe(true);
  expect(body.order).toBeUndefined();
  await expect.poll(() => page.evaluate(id => localStorage.getItem(`season-theater:puzzle:${id}`), nodes[1].id)).toBe('complete');
});
