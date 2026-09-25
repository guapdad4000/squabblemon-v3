import { expect, test, type Locator, type Page } from '@playwright/test';

const fixture = '/e2e/season-theater.fixture.html';
const screenshots = 'e2e/screenshots';
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 1024, height: 1366 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'phone-short', width: 375, height: 667 },
] as const;

async function hitTestable(locator: Locator) {
  await expect(locator).toBeVisible();
  await expect(locator).toBeEnabled();
  expect(await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || rect.top < 0 || rect.left < 0 ||
        rect.bottom > innerHeight || rect.right > innerWidth) return false;
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return Boolean(hit && (hit === element || element.contains(hit)));
  })).toBe(true);
}

async function userScrollToAction(page: Page, locator: Locator) {
  await locator.focus();
  const box = await locator.boundingBox();
  if (box) {
    const viewportHeight = page.viewportSize()?.height ?? 900;
    await page.mouse.move(box.x + box.width / 2, Math.min(viewportHeight - 1, box.y + box.height / 2));
  }
  await page.keyboard.press('PageDown');
  await page.mouse.wheel(0, 500);
  await expect.poll(() => locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= innerHeight;
  })).toBe(true);
}

async function loadFixture(page: Page, scenario: string, viewport: { name: string; width: number; height: number } = viewports[0]) {
  await page.setViewportSize(viewport);
  const failedAssets: string[] = [];
  page.on('response', (response) => {
    if (response.url().includes('/assets/story/theater/') && !response.ok()) {
      failedAssets.push(`${response.status()} ${response.url()}`);
    }
  });
  await page.goto(`${fixture}?scenario=${scenario}`, { waitUntil: 'networkidle' });
  const bannerClose = page.getByRole('button', { name: 'Close banner' });
  if (await bannerClose.isVisible().catch(() => false)) await bannerClose.click();
  return failedAssets;
}

test.describe('season theater in the real game shell', () => {
  for (const viewport of viewports) {
    test(`${viewport.name}: all presentations and final action stay reachable`, async ({ page }) => {
      const failedAssets = await loadFixture(page, 'theater', viewport);
      await expect(page.getByRole('heading', { name: 'Squabblemon Cinema' })).toHaveCount(1);
      const region = page.locator('.theater-posters');
      await expect(region).toBeVisible();
      const posters = region.locator('.cinema-poster');
      await expect(posters).toHaveCount(3);
      await expect(page.getByTestId('button-presentation-season-1')).toBeVisible();
      await expect(page.getByTestId('button-presentation-season-2')).toBeAttached();
      await expect(page.getByTestId('button-presentation-special-sherlock')).toBeAttached();

      if (viewport.width < 500) {
        const lastPoster = page.getByTestId('button-presentation-special-sherlock');
        await lastPoster.focus();
        await expect(lastPoster).toBeFocused();
        await expect(lastPoster).toHaveAttribute('data-selected', 'true');
        await expect(lastPoster).toBeInViewport();
      }

      const finalAction = page.getByTestId('button-continue-story');
      await hitTestable(finalAction);
      const explanation = page.locator('.theater-selection > span');
      await expect(explanation).toBeVisible();
      await expect(page.locator('.theater-selection strong')).toHaveCount(0);
      const selectedPoster = page.locator('.cinema-poster[data-selected="true"]');
      const [posterBox, descriptionBox, actionBox, filmBox] = await Promise.all([
        selectedPoster.boundingBox(), explanation.boundingBox(), finalAction.boundingBox(),
        page.locator('.cinema-film-strip').boundingBox(),
      ]);
      expect(descriptionBox!.y).toBeGreaterThanOrEqual(posterBox!.y + posterBox!.height);
      expect(actionBox!.y).toBeGreaterThanOrEqual(descriptionBox!.y + descriptionBox!.height);
      expect(actionBox!.y - (posterBox!.y + posterBox!.height)).toBeLessThan(155);
      expect(filmBox!.height).toBeGreaterThanOrEqual(180);
      expect(filmBox!.y + filmBox!.height).toBeGreaterThan(viewport.height);
      for (const curtain of await page.locator('.theater-curtain').all()) {
        const box = (await curtain.boundingBox())!;
        const originalWidth = Math.min(180, Math.max(50, viewport.width * 0.12));
        expect(box.width).toBeCloseTo(originalWidth + viewport.width * 0.05, 0);
      }
      expect(failedAssets).toEqual([]);
      const brokenImages = await page.locator('.cinema-poster img').evaluateAll((images) =>
        images.filter((image) => !(image as HTMLImageElement).complete ||
          (image as HTMLImageElement).naturalWidth === 0).length);
      expect(brokenImages).toBe(0);

      const host = page.locator('.theater-host');
      const hostBox = await host.boundingBox();
      expect(hostBox?.y).toBe(0);
      const safehouse = page.getByRole('link', { name: 'Return to safehouse' });
      await hitTestable(safehouse);
      await expect(page.getByTestId('button-open-presentation')).toHaveCount(0);
      await expect(page.getByTestId('button-projection-booth')).toHaveCount(0);
      await page.screenshot({
        path: `${screenshots}/season-theater-${viewport.name}.png`,
        animations: 'disabled',
      });
    });
  }

  test('mouse and touch aim the light; keyboard and a single tap open a season', async ({ page }) => {
    await loadFixture(page, 'theater');
    const host = page.locator('.theater-host');
    const beam = page.locator('.theater-beam');
    const logo = page.locator('.cinema-logo');
    const hostBox = (await host.boundingBox())!;

    await expect.poll(() => logo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    await expect(beam).toHaveAttribute('data-motion', 'active');
    const initial = await beam.evaluate((element) => ({
      originX: Number((element as HTMLElement).dataset.originX),
      originY: Number((element as HTMLElement).dataset.originY),
      targetX: Number((element as HTMLElement).dataset.targetX),
      targetY: Number((element as HTMLElement).dataset.targetY),
    }));
    const logoBox = (await logo.boundingBox())!;
    expect(initial.originX).toBeCloseTo(logoBox.x + logoBox.width * 0.07, 0);
    expect(initial.originY).toBeCloseTo(logoBox.y + logoBox.height * 0.47, 0);
    const visibleCone = await beam.evaluate((element) => {
      const beam = element as HTMLElement;
      const style = getComputedStyle(beam);
      const [originX, originY] = style.transformOrigin.split(' ').map(Number.parseFloat);
      const transformed = new DOMPoint(-originX, beam.offsetHeight / 2 - originY)
        .matrixTransform(new DOMMatrix(style.transform));
      const parent = beam.offsetParent!.getBoundingClientRect();
      return {
        x: parent.left + beam.offsetLeft + originX + transformed.x,
        y: parent.top + beam.offsetTop + originY + transformed.y,
        layer: Number(style.zIndex),
        logoLayer: Number(getComputedStyle(document.querySelector('.cinema-logo')!).zIndex),
      };
    });
    expect(visibleCone.x).toBeCloseTo(initial.originX, 1);
    expect(visibleCone.y).toBeCloseTo(initial.originY, 1);
    expect(visibleCone.layer).toBeGreaterThan(visibleCone.logoLayer);

    await page.mouse.move(hostBox.x + hostBox.width * 0.2, hostBox.y + hostBox.height * 0.25);
    await expect.poll(() => beam.evaluate((element) => Number((element as HTMLElement).dataset.targetX))).not.toBe(initial.targetX);
    const afterMouse = await beam.evaluate((element) => ({
      originX: Number((element as HTMLElement).dataset.originX),
      originY: Number((element as HTMLElement).dataset.originY),
      targetX: Number((element as HTMLElement).dataset.targetX),
    }));
    expect(afterMouse.originX).toBeCloseTo(initial.originX, 3);
    expect(afterMouse.originY).toBeCloseTo(initial.originY, 3);

    await host.dispatchEvent('pointermove', {
      pointerType: 'touch',
      pointerId: 17,
      clientX: hostBox.x + hostBox.width * 0.75,
      clientY: hostBox.y + hostBox.height * 0.6,
    });
    await expect.poll(() => beam.evaluate((element) => Number((element as HTMLElement).dataset.targetX))).not.toBe(afterMouse.targetX);
    expect(Number(await page.getByTestId('projector-lens-anchor').getAttribute('data-x'))).toBeCloseTo(initial.originX, 3);

    await page.setViewportSize(viewports[1]);
    await page.evaluate(() => window.dispatchEvent(new Event('orientationchange')));
    await expect.poll(async () => {
      const [box, origin] = await Promise.all([
        logo.boundingBox(),
        beam.evaluate((element) => Number((element as HTMLElement).dataset.originX)),
      ]);
      return box ? Math.abs(origin - (box.x + box.width * 0.07)) : Infinity;
    }).toBeLessThan(1);

    const first = page.getByTestId('button-presentation-season-1');
    await first.focus();
    await expect(first).toBeFocused();
    await page.keyboard.press('End');
    await expect(page.getByTestId('button-presentation-special-sherlock')).toHaveAttribute('data-selected', 'true');
    await page.keyboard.press('Home');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/season=season-1/);

    await page.goto(`${fixture}?scenario=theater`, { waitUntil: 'networkidle' });
    const touchTarget = page.getByTestId('button-presentation-season-1');
    await touchTarget.dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 7 });
    await touchTarget.dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 7 });
    await touchTarget.dispatchEvent('click');
    await expect(page).toHaveURL(/season=season-1/);
  });

  test('ordinary mouse rail controls reach every presentation', async ({ page }) => {
    for (const viewport of [viewports[0], viewports[3]]) {
      await loadFixture(page, 'theater', viewport);
      const previous = page.getByRole('button', { name: 'Previous presentation' });
      const next = page.getByRole('button', { name: 'Next presentation' });
      await expect(previous).toBeDisabled();
      await hitTestable(next);

      for (const control of [previous, next]) {
        const box = await control.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }

      const clickWithMouse = async (control: Locator) => {
        await hitTestable(control);
        const box = (await control.boundingBox())!;
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      };

      await clickWithMouse(next);
      await expect(page.getByTestId('button-presentation-season-2')).toHaveAttribute('data-selected', 'true');
      await clickWithMouse(next);
      await expect(page.getByTestId('button-presentation-special-sherlock')).toHaveAttribute('data-selected', 'true');
      await expect(next).toBeDisabled();

      await clickWithMouse(previous);
      await expect(page.getByTestId('button-presentation-season-2')).toHaveAttribute('data-selected', 'true');
      await clickWithMouse(previous);
      await expect(page.getByTestId('button-presentation-season-1')).toHaveAttribute('data-selected', 'true');
      await expect(previous).toBeDisabled();
    }
  });

  test('poster buttons are direct actions while drag-scrolling never opens one', async ({ page }) => {
    await loadFixture(page, 'theater');
    const first = page.getByTestId('button-presentation-season-1');
    await expect(first).not.toHaveAttribute('role', 'option');
    await first.click();
    await expect(page).toHaveURL(/season=season-1/);

    await loadFixture(page, 'theater');
    const original = page.url();
    const poster = page.getByTestId('button-presentation-season-1');
    const box = (await poster.boundingBox())!;
    await poster.dispatchEvent('pointerdown', {
      pointerType: 'touch',
      pointerId: 31,
      clientX: box.x + box.width / 2,
      clientY: box.y + box.height / 2,
    });
    await page.locator('.theater-host').dispatchEvent('pointermove', {
      pointerType: 'touch',
      pointerId: 31,
      clientX: box.x + box.width / 2 - 80,
      clientY: box.y + box.height / 2,
    });
    await poster.dispatchEvent('pointerup', {
      pointerType: 'touch',
      pointerId: 31,
      clientX: box.x + box.width / 2 - 80,
      clientY: box.y + box.height / 2,
    });
    await poster.dispatchEvent('click');
    await expect(page).toHaveURL(original);
  });

  test('locked presentations cannot open or become the continue target', async ({ page }) => {
    await loadFixture(page, 'theater');
    const locked = page.getByTestId('button-presentation-season-2');
    await expect(locked).toHaveAttribute('data-status', 'locked');
    const original = page.url();
    await locked.click();
    await expect(locked).toHaveAttribute('data-selected', 'true');
    await expect(page).toHaveURL(original);
    await expect(page.getByTestId('status-unlock-season-2')).toContainText('Unlock');
    await locked.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(original);
    await expect(page.getByTestId('status-unlock-season-2')).toContainText('Unlock by completing Chapter Eight: The Crown.');
    await page.getByTestId('button-continue-story').click();
    await expect(page).not.toHaveURL(/season=season-2/);
    await page.goBack();
    await expect(page).toHaveURL(original);
    await expect(page.getByRole('heading', { name: 'Squabblemon Cinema' })).toHaveCount(1);
  });

  test('popcorn is bounded, nonblocking, and cleans itself up after any screen press', async ({ page }) => {
    await loadFixture(page, 'theater');
    const particles = page.getByTestId('popcorn-particles').locator('.popcorn-particle');
    const disabledPrevious = page.getByRole('button', { name: 'Previous presentation' });
    const previousBox = (await disabledPrevious.boundingBox())!;
    await page.mouse.click(previousBox.x + previousBox.width / 2, previousBox.y + previousBox.height / 2);
    await expect.poll(() => particles.count()).toBeGreaterThan(0);

    const viewport = page.viewportSize()!;
    await page.mouse.click(viewport.width / 2, 8);
    for (let index = 0; index < 12; index++) {
      await page.mouse.click(previousBox.x + previousBox.width / 2, previousBox.y + previousBox.height / 2);
    }
    expect(await particles.count()).toBeLessThanOrEqual(24);
    await expect.poll(() => particles.count(), { timeout: 3_000 }).toBe(0);
    await expect(page.getByTestId('button-continue-story')).toBeEnabled();
  });

  test('existing save resumes season one and season two filters its chapter tickets', async ({ page }) => {
    await loadFixture(page, 'existing-save');
    await page.getByTestId('button-continue-story').click();
    await expect(page).toHaveURL(/node=receipts-on-camera/);
    await expect(page.getByRole('heading', { name: 'Squabblemon Cinema' })).toHaveCount(0);
    await page.getByRole('button', { name: /Back|Fall Back/ }).first().click();
    await page.getByRole('button', { name: 'Browse presentations' }).click();

    await page.goto(`${fixture}?scenario=season-two`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/season=season-2/);
    await expect(page.getByText('Chapter Nine: The Morning After', { exact: false })).toBeVisible();
    await expect(page.getByText('Block Party', { exact: true })).toHaveCount(0);
  });

  test('a node deep link bypasses the theater and opens the right chapter', async ({ page }) => {
    await loadFixture(page, 'puzzle-dialogue');
    await expect(page.getByRole('heading', { name: 'Squabblemon Cinema' })).toHaveCount(0);
    await expect(page.locator('.story-stage')).toBeVisible();
    await expect(page.locator('.story-stage')).toContainText(/Chapter 09/);
    await expect(page.getByRole('button', { name: 'Skip scene' })).toBeVisible();
  });

  test('reduced motion removes theater transitions', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await loadFixture(page, 'theater');
    const poster = page.getByTestId('button-presentation-season-1');
    const duration = await poster.evaluate((el) =>
      Number.parseFloat(getComputedStyle(el).transitionDuration) || 0);
    expect(duration).toBeLessThanOrEqual(0.001);
    const beam = page.getByTestId('projector-beam');
    await expect(beam).toHaveAttribute('data-motion', 'reduced');
    const targetBefore = await beam.getAttribute('data-target-x');
    await page.mouse.move(20, 20);
    await expect(beam).toHaveAttribute('data-target-x', targetBefore!);
    await page.mouse.click(30, 300);
    await expect(page.getByTestId('popcorn-particles').locator('.popcorn-particle')).toHaveCount(0);
  });

  test('profile reduced motion also freezes beam targeting and popcorn', async ({ page }) => {
    await loadFixture(page, 'theater');
    await page.evaluate(() => {
      document.documentElement.dataset.reduceMotion = 'true';
    });
    const beam = page.getByTestId('projector-beam');
    await expect(beam).toHaveAttribute('data-motion', 'reduced');
    const targetBefore = await beam.getAttribute('data-target-x');
    await page.mouse.move(40, 420);
    await expect(beam).toHaveAttribute('data-target-x', targetBefore!);
    await page.mouse.click(40, 420);
    await expect(page.getByTestId('popcorn-particles').locator('.popcorn-particle')).toHaveCount(0);
  });

  test('season posters use game characters and the supplied cinema decoration', async ({ page }) => {
    await loadFixture(page, 'theater');
    for (const id of ['season-1', 'season-2', 'special-sherlock']) {
      const poster = page.getByTestId(`button-presentation-${id}`);
      expect(await poster.locator('img[src*="/assets/characters/"]').count()).toBeGreaterThan(0);
      await expect(poster.locator('img[src$="/season-one.webp"], img[src$="/season-two.webp"], img[src$="/sherlock.webp"][src*="/theater/"]')).toHaveCount(0);
    }
    for (const asset of ['cinema-logo.webp', 'cinema-curtain.webp', 'cinema-film-strip.webp', 'cinema-reel.webp']) {
      expect(await page.locator(`img[src$="/${asset}"]`).count()).toBeGreaterThan(0);
    }
    const decorations = page.locator('.cinema-logo, .theater-curtain, .cinema-film-strip, .cinema-reel-container');
    for (const decoration of await decorations.all()) {
      expect(await decoration.evaluate((element) => getComputedStyle(element).pointerEvents)).toBe('none');
    }
    for (const curtain of await page.locator('.theater-curtain').all()) {
      const source = await curtain.evaluate((image: HTMLImageElement) => ({
        width: image.naturalWidth,
        height: image.naturalHeight,
        objectFit: getComputedStyle(image).objectFit,
      }));
      expect(source.width / source.height).toBeCloseTo(523 / 1649, 4);
      expect(['contain', 'cover']).toContain(source.objectFit);
    }
    await hitTestable(page.getByTestId('button-continue-story'));
    await expect(page.getByText('Projection Booth', { exact: true })).toHaveCount(0);
  });
});

test.describe('story puzzle journey', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  for (const viewport of viewports) {
    test(`${viewport.name}: controls, error retry, reward and reload persistence`, async ({ page }) => {
      await loadFixture(page, 'puzzle', viewport);

      const puzzle = page.locator('.story-puzzle-host');
      await expect(puzzle).toBeVisible();
      const back = page.getByRole('button', { name: 'Back' });
      await hitTestable(back);
      await expect(page.getByRole('heading', { name: 'The launch was already loaded' })).toBeVisible();
      const options = page.getByRole('option');
      await expect(options).toHaveCount(5);
      await page.getByRole('button', { name: /Reveal Hint 1/ }).click();
      await expect(page.getByText('Subtract twenty minutes from both dispatch entries.')).toBeVisible();

      const lastDown = page.getByRole('button', { name: 'Move Public promise — Wednesday 20:00 down' });
      await lastDown.click();
      const submit = page.getByRole('button', { name: 'Submit evidence' });
      await userScrollToAction(page, submit);
      await hitTestable(submit);
      await page.screenshot({
        path: `${screenshots}/season-puzzle-${viewport.name}.png`,
        animations: 'disabled',
      });
      await submit.evaluate((button: HTMLButtonElement) => {
        button.click();
        button.click();
      });
      await expect(page.getByRole('alert')).toContainText('not correct yet');
      expect(await page.evaluate(() =>
        (window as typeof window & { __seasonPuzzleRequests?: number }).__seasonPuzzleRequests)).toBe(1);

      const answer = ['owner-notice', 'delivery-order', 'truck-loaded', 'livestream-promise', 'gate-scan'];
      for (let target = 0; target < answer.length; target++) {
        const order = await options.evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset.puzzlePiece));
        const current = order.indexOf(answer[target]);
        await options.nth(current).focus();
        for (let step = current; step > target; step--) {
          await page.keyboard.press('ArrowUp');
          await expect(options.nth(step - 1)).toHaveAttribute('data-puzzle-piece', answer[target]);
          await expect(options.nth(step - 1)).toBeFocused();
        }
        await expect(options.nth(target)).toHaveAttribute('data-puzzle-piece', answer[target]);
      }
      await userScrollToAction(page, submit);
      await hitTestable(submit);
      await submit.click();
      await expect(page.getByText('Added to collection')).toBeVisible();
      await expect(page.getByText(/\+40 (?:Street|Account) XP/).first()).toBeVisible();
      await expect(page.getByText('Story rewards')).toBeVisible();
      await page.screenshot({
        path: `${screenshots}/season-puzzle-reward-${viewport.name}.png`,
        animations: 'disabled',
      });
      const keepGoing = page.getByRole('button', { name: /Keep going/ });
      await hitTestable(keepGoing);
      await keepGoing.click();
      const returnToMap = page.getByRole('button', { name: 'Return to Map' });
      await userScrollToAction(page, returnToMap);
      await hitTestable(returnToMap);

      await page.goto(`${fixture}?scenario=puzzle`, { waitUntil: 'networkidle' });
      await expect(page.getByText('Location secured')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'The launch was already loaded' })).toHaveCount(0);
    });
  }

  test('explicit bypass sends skip and grants only the authored reward', async ({ page }) => {
    await loadFixture(page, 'puzzle');
    const bypass = page.getByRole('button', { name: 'Skip puzzle' });
    await hitTestable(bypass);
    await bypass.click();
    await expect(page.getByText('Added to collection')).toBeVisible();
    const puzzleBody = await page.evaluate(() =>
      (window as typeof window & { __seasonPuzzleLastBody?: Record<string, unknown> }).__seasonPuzzleLastBody);
    expect(puzzleBody).toMatchObject({ skip: true });
    expect(puzzleBody).not.toHaveProperty('order');
    await expect(page.getByText(/\+40 (?:Street|Account) XP/)).toHaveCount(2);
  });
});