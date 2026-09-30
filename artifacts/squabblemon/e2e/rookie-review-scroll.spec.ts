import { expect, test, type CDPSession, type Locator, type Page } from '@playwright/test';

const sizes = [
  { width: 1280, height: 500 },
  { width: 390, height: 650 },
  { width: 740, height: 360 },
];

async function inViewportAndClickable(locator: Locator, page: Page) {
  const bounds = await locator.evaluate(el => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      left: r.left, top: r.top, right: r.right, bottom: r.bottom,
      hit: hit === el || el.contains(hit),
    };
  });
  const viewport = page.viewportSize()!;
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(viewport.width);
  expect(bounds.bottom).toBeLessThanOrEqual(viewport.height);
  expect(bounds.hit).toBe(true);
}

async function proveScroll(page: Page, region: Locator, finalAction: Locator, lastItem?: Locator) {
  await expect(region).toBeVisible();
  await expect(finalAction).toBeVisible();
  await region.evaluate(el => { el.scrollTop = 0; });
  const capacity = await region.evaluate(el => el.scrollHeight - el.clientHeight);
  expect(capacity, 'The expanded review must overflow the constrained screen').toBeGreaterThan(0);
  const box = await region.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + Math.min(box!.height / 2, 130));
  await page.mouse.wheel(0, 175);
  await expect.poll(() => region.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  const stage = page.locator('.game-route-stage');
  if (await stage.count()) {
    expect(await stage.evaluate(el => el.scrollHeight - el.clientHeight), 'The shell must not become a second scroll owner').toBeLessThanOrEqual(2);
    expect(await stage.evaluate(el => el.scrollTop)).toBe(0);
  }
  await region.evaluate(el => { el.scrollTop = 0; });
  await region.focus();
  await page.keyboard.press('End');
  await expect.poll(() => region.evaluate(el => el.scrollTop)).toBeGreaterThanOrEqual(capacity - 2);
  await inViewportAndClickable(finalAction, page);
  if (lastItem) await inViewportAndClickable(lastItem, page);
}

test('Rookie Road reviews and handoff really scroll inside the constrained shell', async ({ page }) => {
  for (const size of sizes) {
    await page.setViewportSize(size);
    for (const screen of ['review', 'reward', 'handoff'] as const) {
      await page.goto(`/squabblemon/e2e/rookie-review-scroll.fixture.html?screen=${screen}`);
      const region = page.getByRole('region', { name: ({
        review: 'Lesson complete review', reward: 'Welcome reward review', handoff: 'Rookie Road handoff',
      })[screen] });
      const action = screen === 'handoff'
        ? region.getByRole('button', { name: 'See reward & next steps' })
        : region.getByTestId('button-claim-reward-enter-story');
      if (screen !== 'handoff') {
        await region.locator('.rookie-progression-primer summary').click();
        await expect(region.locator('.rookie-progression-primer')).toHaveAttribute('open', '');
      }
      await proveScroll(page, region, action);
      if (screen !== 'handoff') {
        // Reward explanations must remain reachable, not only the action row.
        const fieldGuide = region.getByRole('link', { name: 'Read the full Field Guide' });
        await region.evaluate(el => { el.scrollTop = 0; });
        const box = await region.boundingBox();
        await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
        await page.mouse.wheel(0, 250);
        await expect.poll(() => region.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
        await fieldGuide.focus();
        await inViewportAndClickable(fieldGuide, page);
      }
      await region.focus();
      await page.keyboard.press('End');
      await expect.poll(() => region.evaluate(el => el.scrollTop)).toBeGreaterThanOrEqual(
        await region.evaluate(el => el.scrollHeight - el.clientHeight - 2),
      );
      await inViewportAndClickable(action, page);
      await action.click();
      await expect(page.getByTestId('rookie-review-scroll-action')).toHaveText('complete');
    }
  }
});

test('Practice brief and unwrapped onboarding review keep the final action reachable', async ({ page }) => {
  for (const size of sizes) {
    await page.setViewportSize(size);
    await page.goto('/squabblemon/e2e/rookie-review-scroll.fixture.html?screen=reward&shell=none');
    const primer = page.getByTestId('rookie-reward-primer');
    await primer.locator('.rookie-progression-primer summary').click();
    await proveScroll(page, primer, primer.getByTestId('button-claim-reward-enter-story'));
    await primer.getByTestId('button-practice-another-fade').click();
    const brief = page.getByTestId('rookie-practice-brief');
    await proveScroll(page, brief, brief.getByTestId('button-start-practice-fade'));
  }
});

async function swipeUp(client: CDPSession, page: Page, region: Locator) {
  const box = await region.boundingBox();
  expect(box).not.toBeNull();
  const x = Math.round(box!.x + box!.width * 0.85);
  const start = Math.round(box!.y + box!.height * 0.78);
  const end = Math.round(box!.y + box!.height * 0.2);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: start, id: 1 }] });
  for (let step = 1; step <= 8; step += 1) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [{ x, y: Math.round(start + (end - start) * step / 8), id: 1 }],
    });
    // Allow Chromium to render each trusted touchMove, as a physical gesture would.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test.describe('Rookie Road native touch scrolling', () => {
  test.use({ hasTouch: true, isMobile: true });

  test('a real touch swipe reaches and taps review and handoff actions in portrait and landscape', async ({ page, browserName }) => {
    expect(browserName).toBe('chromium');
    const client = await page.context().newCDPSession(page);
    for (const size of [{ width: 390, height: 650 }, { width: 740, height: 360 }]) {
      await page.setViewportSize(size);
      for (const screen of ['review', 'handoff'] as const) {
        await page.goto(`/squabblemon/e2e/rookie-review-scroll.fixture.html?screen=${screen}`);
        const region = page.getByRole('region', { name: screen === 'review' ? 'Lesson complete review' : 'Rookie Road handoff' });
        const action = screen === 'review'
          ? region.getByTestId('button-claim-reward-enter-story')
          : region.getByRole('button', { name: 'See reward & next steps' });
        await expect(region).toBeVisible();
        if (screen === 'review') {
          await region.locator('.rookie-progression-primer summary').click();
          await expect(region.locator('.rookie-progression-primer')).toHaveAttribute('open', '');
        }
        // Return to the beginning by keyboard for setup; only trusted touch input
        // is counted as the proof that this region can move toward its last action.
        await region.focus();
        await page.keyboard.press('Home');
        await expect.poll(() => region.evaluate(el => el.scrollTop)).toBe(0);
        const capacity = await region.evaluate(el => el.scrollHeight - el.clientHeight);
        expect(capacity).toBeGreaterThan(0);
        const before = await region.evaluate(el => el.scrollTop);
        await swipeUp(client, page, region);
        await expect.poll(() => region.evaluate(el => el.scrollTop)).toBeGreaterThan(before);
        for (let swipe = 0; swipe < 12 && await region.evaluate(el => el.scrollTop < el.scrollHeight - el.clientHeight - 2); swipe += 1) {
          await swipeUp(client, page, region);
        }
        await expect.poll(() => region.evaluate(el => el.scrollTop)).toBeGreaterThanOrEqual(capacity - 2);
        const stage = page.locator('.game-route-stage');
        expect(await stage.evaluate(el => el.scrollHeight - el.clientHeight), 'Only the review should scroll').toBeLessThanOrEqual(2);
        expect(await stage.evaluate(el => el.scrollTop)).toBe(0);
        await inViewportAndClickable(action, page);
        const screenshot = await page.screenshot({
          path: `test-results/touch-proof-${screen}-${size.width}x${size.height}-${test.info().project.name}.png`,
        });
        await test.info().attach(`touch-${screen}-${size.width}x${size.height}`, {
          body: screenshot, contentType: 'image/png',
        });
        const button = await action.boundingBox();
        expect(button).not.toBeNull();
        const x = Math.round(button!.x + button!.width / 2);
        const y = Math.round(button!.y + button!.height / 2);
        await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 2 }] });
        await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await expect(page.getByTestId('rookie-review-scroll-action')).toHaveText('complete');
      }
    }
  });
});