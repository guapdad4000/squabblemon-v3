import { expect, test, type Locator, type Page } from '@playwright/test';

declare global { interface Window { pvpFixture: { disconnect: () => void; reconnect: () => void; fail: (value: boolean) => void; complete: () => void; requests: () => number; status: () => string } } }

async function hit(locator: Locator, page: Page) {
  await expect(locator).toBeVisible();
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
  expect(await locator.evaluate(element => {
    const r = element.getBoundingClientRect();
    const target = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return target === element || element.contains(target);
  })).toBe(true);
}

async function openBattleExit(page: Page) {
  const arrivalExit = page.getByTestId('pvp-exit');
  if (await arrivalExit.isVisible()) { await arrivalExit.tap(); return; }
  const tools = page.locator('.battle-tools');
  if (!(await tools.evaluate(element => element.hasAttribute('open')))) await page.getByLabel('Battle menu').tap();
  const exit = tools.getByRole('button', { name: 'Leave battle', exact: true });
  await hit(exit, page);
  await exit.tap();
}

for (const kind of ['ranked', 'friend'] as const) {
  for (const viewport of [{ width: 390, height: 844 }, { width: 667, height: 375 }]) {
    test(`${kind} exit at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(`/squabblemon/e2e/pvp-exit.fixture.html?kind=${kind}`);
      const battle = page.getByTestId('online-battle');
      await expect(battle).toBeVisible();
      const exit = page.getByTestId('pvp-exit');
      await hit(exit, page); // arrival remains mounted during this tap
      await page.screenshot({ path: `test-results/pvp-exit/${kind}-${viewport.width}-arrival.png` });
      await openBattleExit(page);
      const dialog = page.getByRole('dialog', { name: 'Leave this fade?' });
      await expect(dialog).toContainText(kind === 'ranked' ? 'ranked loss' : 'gives The Opps the win');
      await expect(dialog.getByRole('button', { name: 'Keep playing' })).toBeFocused();
      await hit(dialog.getByRole('button', { name: 'Keep playing' }), page);
      await dialog.getByRole('button', { name: 'Keep playing' }).tap();
      await expect(dialog).toBeHidden();
      await expect(battle).toBeVisible();
      await expect(page.getByTestId('match-arrival')).toBeHidden();

      const menu = page.getByLabel('Battle menu');
      await hit(menu, page);
      const header = await page.locator('.battle-command-header').boundingBox();
      expect(header!.height).toBe(viewport.width <= 600 ? 106 : 94);
      const round = await page.locator('.battle-round > span').boundingBox();
      const clock = await page.getByTestId('turn-timer').boundingBox();
      expect(clock!.y).toBeGreaterThanOrEqual(round!.y + round!.height);
      expect(clock!.y + clock!.height).toBeLessThanOrEqual(header!.y + (viewport.width <= 600 ? 54 : 50));
      await expect(page.getByTestId('pvp-exit')).toBeHidden();
      if (!(await page.locator('.battle-tools').evaluate(element => element.hasAttribute('open')))) await menu.tap();
      await hit(page.getByRole('button', { name: 'Music controls', exact: true }), page);
      const react = page.getByRole('button', { name: 'Choose a reaction', exact: true });
      await hit(react, page);
      await react.tap();
      await expect(page.getByRole('region', { name: 'Your reaction collection' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('region', { name: 'Your reaction collection' })).toBeHidden();
      await expect(react).toBeFocused();
      const menuExit = page.getByRole('button', { name: 'Leave battle', exact: true }).last();
      await hit(menuExit, page);
      await menuExit.tap();
      await expect(dialog).toBeVisible();
      await page.screenshot({ path: `test-results/pvp-exit/${kind}-${viewport.width}-confirmation.png` });
      await dialog.getByRole('button', { name: 'Keep playing' }).tap();

      // Browser back must restore the match and ask rather than navigating away.
      await page.goBack();
      await expect(dialog).toBeVisible();
      await expect(battle).toBeVisible();
      await dialog.getByRole('button', { name: 'Keep playing' }).tap();
      await expect(battle).toBeVisible();

      await openBattleExit(page);
      await page.evaluate(() => window.pvpFixture.fail(true));
      await dialog.getByRole('button', { name: 'Surrender', exact: true }).tap();
      await expect(dialog.getByText('Surrender could not be confirmed.', { exact: false })).toBeVisible();
      await expect.poll(() => page.evaluate(() => window.pvpFixture.status())).toBe('active');
      await hit(dialog.getByRole('button', { name: /Return to .* without surrender confirmation/ }), page);
      await dialog.getByRole('button', { name: /Return to .* without surrender confirmation/ }).tap();
      await expect(page.getByTestId('pvp-hub')).toBeVisible();
      await expect(page).toHaveURL(kind === 'ranked' ? /\/game\/online$/ : /\/game\/online\?tab=friends$/);
    });
  }
}

test('offline return is explicit; reconnect and surrender settle once; completed menu leaves', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/squabblemon/e2e/pvp-exit.fixture.html?kind=ranked');
  await expect(page.getByTestId('online-battle')).toBeVisible();
  await openBattleExit(page);
  const dialog = page.getByRole('dialog', { name: 'Leave this fade?' });
  await page.evaluate(() => window.pvpFixture.disconnect());
  await expect(dialog.getByText(/Connection lost/)).toBeVisible();
  await expect(dialog).toContainText('ranked loss is still possible');
  await expect(dialog.getByRole('button', { name: 'Surrender', exact: true })).toBeDisabled();
  await hit(dialog.getByRole('button', { name: /Return to Fade Park without surrender confirmation/ }), page);
  await page.evaluate(() => window.pvpFixture.reconnect());
  await expect(dialog.getByRole('button', { name: 'Surrender', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Surrender', exact: true }).tap();
  await dialog.getByRole('button', { name: 'Surrendering…' }).evaluate(button => (button as HTMLButtonElement).click());
  await expect.poll(() => page.evaluate(() => window.pvpFixture.requests())).toBe(1);
  await expect.poll(() => page.evaluate(() => window.pvpFixture.status())).toBe('complete');
  await expect(page.getByTestId('park-result-dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Inspect final board' }).tap();
  await openBattleExit(page);
  await expect(page.getByTestId('pvp-hub')).toBeVisible();
});

test('offline friend return does not submit a surrender', async ({ page }) => {
  await page.goto('/squabblemon/e2e/pvp-exit.fixture.html?kind=friend');
  await expect(page.getByTestId('online-battle')).toBeVisible();
  await page.evaluate(() => window.pvpFixture.disconnect());
  await openBattleExit(page);
  const dialog = page.getByRole('dialog', { name: 'Leave this fade?' });
  await expect(dialog).toContainText('server clock keeps running');
  const returnButton = dialog.getByRole('button', { name: /Return to friend fades without surrender confirmation/ });
  await hit(returnButton, page);
  await returnButton.tap();
  await expect(page.getByTestId('pvp-hub')).toBeVisible();
  expect(await page.evaluate(() => window.pvpFixture.requests())).toBe(0);
});

test('arrival poster offers a reachable exit before presentation clears', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/squabblemon/e2e/pvp-exit.fixture.html?kind=friend&motion=full', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('match-arrival')).toBeVisible();
  const exit = page.getByTestId('pvp-exit');
  await hit(exit, page);
  await page.screenshot({ path: 'test-results/pvp-exit/friend-arrival-poster.png' });
  await exit.tap();
  const dialog = page.getByRole('dialog', { name: 'Leave this fade?' });
  await hit(dialog.getByRole('button', { name: 'Keep playing' }), page);
  await dialog.getByRole('button', { name: 'Keep playing' }).tap();
  await expect(page.getByTestId('online-battle')).toBeVisible();
});

test('completed friend match can leave its room through the result action', async ({ page }) => {
  await page.goto('/squabblemon/e2e/pvp-exit.fixture.html?kind=friend');
  await expect(page.getByTestId('online-battle')).toBeVisible();
  await page.evaluate(() => {
    window.pvpFixture.complete();
    window.dispatchEvent(new Event('online'));
  });
  const result = page.getByTestId('park-result-dialog');
  await expect(result).toBeVisible();
  const returnButton = result.getByRole('button', { name: 'Leave this room' });
  await hit(returnButton, page);
  await returnButton.tap();
  await expect(page.getByTestId('pvp-hub')).toBeVisible();
  expect(await page.evaluate(() => window.pvpFixture.requests())).toBe(1);
});
