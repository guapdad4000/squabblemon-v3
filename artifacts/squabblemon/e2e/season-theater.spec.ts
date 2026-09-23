import { expect, test, type Locator, type Page } from '@playwright/test';

const fixture = '/e2e/season-theater.fixture.html';
const screenshots = 'e2e/screenshots';
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'phone-short', width: 390, height: 667 },
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

async function loadFixture(page: Page, scenario: string, viewport = viewports[0]) {
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
      await expect(page.getByRole('heading', { name: 'Squabblemon Cinema' })).toBeVisible();
      const region = page.getByRole('listbox', { name: 'Story presentations' });
      await expect(region).toBeVisible();
      const posters = region.getByRole('option');
      await expect(posters).toHaveCount(3);
      await expect(page.getByTestId('button-presentation-season-1')).toBeVisible();
      await expect(page.getByTestId('button-presentation-season-2')).toBeAttached();
      await expect(page.getByTestId('button-presentation-special-sherlock')).toBeAttached();

      if (viewport.width < 500) {
        const lastPoster = page.getByTestId('button-presentation-special-sherlock');
        await lastPoster.focus();
        await expect(lastPoster).toBeFocused();
        await expect(lastPoster).toHaveAttribute('aria-selected', 'true');
        await expect(lastPoster).toBeInViewport();
      }

      const finalAction = page.getByTestId('button-continue-story');
      await hitTestable(finalAction);
      expect(failedAssets).toEqual([]);
      const brokenImages = await page.locator('.theater-poster img').evaluateAll((images) =>
        images.filter((image) => !(image as HTMLImageElement).complete ||
          (image as HTMLImageElement).naturalWidth === 0).length);
      expect(brokenImages).toBe(0);

      const host = page.locator('.theater-host');
      const hostBox = await host.boundingBox();
      expect(hostBox?.y).toBe(0);
      const safehouse = page.getByRole('link', { name: 'Return to safehouse' });
      await hitTestable(safehouse);
      for (const curtain of await page.locator('.theater-curtain').all()) {
        const [curtainBox, hostBox] = await Promise.all([curtain.boundingBox(), host.boundingBox()]);
        expect(curtainBox).not.toBeNull();
        expect(hostBox).not.toBeNull();
        expect(curtainBox!.y).toBeGreaterThanOrEqual(hostBox!.y);
        expect(curtainBox!.y + curtainBox!.height).toBeLessThanOrEqual(hostBox!.y + hostBox!.height + 1);
      }
      await page.screenshot({
        path: `${screenshots}/season-theater-${viewport.name}.png`,
        animations: 'disabled',
      });
    });
  }

  test('mouse, keyboard and touch aiming move a bottom-center spotlight', async ({ page }) => {
    await loadFixture(page, 'theater');
    const host = page.locator('.theater-host');
    const beam = page.locator('.theater-beam');
    const hostBox = (await host.boundingBox())!;
    const beamBox = (await beam.boundingBox())!;
    expect(Math.abs((beamBox.x + beamBox.width / 2) - (hostBox.x + hostBox.width / 2))).toBeLessThan(2);
    expect(Math.abs((beamBox.y + beamBox.height) - (hostBox.y + hostBox.height))).toBeLessThan(2);

    const before = await beam.evaluate((el) => getComputedStyle(el).clipPath);
    await page.mouse.move(hostBox.x + hostBox.width * 0.2, hostBox.y + hostBox.height * 0.25);
    await expect.poll(() => beam.evaluate((el) => getComputedStyle(el).clipPath)).not.toBe(before);

    const first = page.getByTestId('button-presentation-season-1');
    await first.focus();
    await expect(first).toBeFocused();
    await page.keyboard.press('End');
    await expect(page.getByTestId('button-presentation-special-sherlock')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Home');
    await page.getByTestId('button-open-presentation').click();
    await expect(page).toHaveURL(/season=season-1/);

    await page.goto(`${fixture}?scenario=theater`, { waitUntil: 'networkidle' });
    const touchTarget = page.getByTestId('button-presentation-season-1');
    await touchTarget.dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 7 });
    await touchTarget.dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 7 });
    await touchTarget.dispatchEvent('click');
    await page.getByTestId('button-open-presentation').click();
    await expect(page).toHaveURL(/season=season-1/);
  });

  test('ordinary mouse rail controls reach every presentation', async ({ page }) => {
    for (const viewport of [viewports[0], viewports[2]]) {
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
      await expect(page.getByTestId('button-presentation-season-2')).toHaveAttribute('aria-selected', 'true');
      await clickWithMouse(next);
      await expect(page.getByTestId('button-presentation-special-sherlock')).toHaveAttribute('aria-selected', 'true');
      await expect(next).toBeDisabled();

      await clickWithMouse(previous);
      await expect(page.getByTestId('button-presentation-season-2')).toHaveAttribute('aria-selected', 'true');
      await clickWithMouse(previous);
      await expect(page.getByTestId('button-presentation-season-1')).toHaveAttribute('aria-selected', 'true');
      await expect(previous).toBeDisabled();
    }
  });

  test('locked presentations cannot open or become the continue target', async ({ page }) => {
    await loadFixture(page, 'theater');
    const locked = page.getByTestId('button-presentation-season-2');
    await expect(locked).toHaveAttribute('data-status', 'locked');
    const original = page.url();
    await locked.click();
    await expect(locked).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('button-open-presentation')).toBeDisabled();
    await page.getByTestId('button-continue-story').click();
    await expect(page).not.toHaveURL(/season=season-2/);
    await page.goBack();
    await expect(page).toHaveURL(original);
    await expect(page.getByRole('heading', { name: 'Squabblemon Cinema' })).toBeVisible();
  });

  test('existing save resumes season one and season two filters its chapter tickets', async ({ page }) => {
    await loadFixture(page, 'existing-save');
    await page.getByTestId('button-continue-story').click();
    await expect(page).toHaveURL(/node=/);
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
  });

  test('projection booth Easter egg opens and closes without a reward action', async ({ page }) => {
    await loadFixture(page, 'theater');
    await page.getByTestId('button-projection-booth').click();
    const dialog = page.getByTestId('dialog-projection-booth');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button')).toHaveCount(1);
    await page.getByTestId('button-close-projection-booth').click();
    await expect(dialog).toHaveCount(0);
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
      await expect(page.getByRole('heading', { name: 'Put the Evidence in Order' })).toBeVisible();
      const options = page.getByRole('option');
      await expect(options).toHaveCount(3);
      await page.getByRole('button', { name: /Reveal Hint 1/ }).click();
      await expect(page.getByText('Start with the earliest printed or recorded time.')).toBeVisible();

      const lastDown = page.getByRole('button', { name: 'Move Delivery order down' });
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

      const lastOption = options.nth(2);
      await lastOption.focus();
      await page.keyboard.press('ArrowUp');
      await expect(options.nth(1)).toBeFocused();
      await userScrollToAction(page, submit);
      await hitTestable(submit);
      await submit.click();
      await expect(page.getByText('Added to collection')).toBeVisible();
      await expect(page.getByText('+40 Street XP').first()).toBeVisible();
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
      await expect(page.getByRole('heading', { name: 'Put the Evidence in Order' })).toHaveCount(0);
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
    await expect(page.getByText('+40 Street XP')).toHaveCount(2);
  });
});