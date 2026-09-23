import { expect, test, type Locator, type Page } from '@playwright/test';

const appPath = (path: string) => `${process.env.SQUABBLEMON_PROXY_ROOT ?? '/squabblemon'}${path}`;

async function playCard(page: Page, id: string, lane: number) {
  await page.locator(`[data-card-zone="hand"][data-card-id="${id}"]`).click();
  await page.getByTestId(`lane-${lane}`).click();
  await page.getByTestId('button-lock').click();
}

async function expectReachable(locator: Locator, page: Page) {
  await expect(locator).toBeVisible();
  const result = await locator.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return {
      withinViewport: rect.left >= 0 && rect.top >= 0
        && rect.right <= document.documentElement.clientWidth
        && rect.bottom <= document.documentElement.clientHeight,
      hit: element === hit || element.contains(hit),
    };
  });
  expect(result.withinViewport).toBe(true);
  expect(result.hit).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

test('real Collection keeps detective and Counterplay wording synchronized', async ({ page }) => {
  await page.goto(appPath('/e2e/crew-collection.fixture.html'));
  const search = page.getByPlaceholder('Find a card or ability…');
  const cases = [
    {
      name: 'Sherlock',
      effect: /he and your weakest other friendly character anywhere gain \+2 Hands each/i,
      motion: '3',
      hands: '4',
    },
    {
      name: 'Watson',
      effect: /Restore up to 3 Hands actually lost to damage/i,
      motion: '2',
      hands: '3',
    },
    {
      name: 'Closet Nerd',
      effect: /Silence the highest-Hands enemy here/i,
      motion: '4',
      hands: '3',
    },
  ] as const;
  for (const card of cases) {
    await search.fill(card.name);
    const control = page.getByTestId('collection-card-control').filter({ hasText: card.name });
    await expect(control).toHaveCount(1);
    await control.click();
    const inspector = page.getByRole('dialog', { name: `${card.name} card details` });
    await expect(inspector).toContainText(card.effect);
    const motion = inspector.locator('.dossier-stat').filter({ hasText: 'Motion' }).locator('.dossier-stat__value');
    await expect(motion).toHaveText(card.motion);
    await expect(inspector.locator('.dossier-stat').filter({ hasText: 'Hands' }).locator('.dossier-stat__value')).toHaveText(card.hands);
    await page.getByTestId('button-close-inspector').click();
  }
});

test('Sherlock cancellation rewards Watson and its complete targets survive mounted replay', async ({ page }, testInfo) => {
  if (testInfo.project.name.includes('phone')) await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(appPath('/e2e/crew-balance.fixture.html?mode=detective'));
  await playCard(page, 'sherlock', 0);
  await expect(page.getByTestId('character-mark-1')).toContainText('Stakeout');
  await page.getByTestId('trigger-rival-entrance').click();

  const state = page.getByTestId('crew-balance-state');
  await expect(state).toHaveAttribute('data-sherlock-power', '6');
  await expect(state).toHaveAttribute('data-watson-power', '5');
  await expect(state).toHaveAttribute('data-cancellation-targets', /cornball/);
  await expect(state).toHaveAttribute('data-cancellation-targets', /watson/);
  await expect(page.getByTestId('character-mark-1')).toHaveCount(0);

  await page.getByLabel('Battle menu').click();
  await page.getByTestId('button-battle-history').click();
  const cancellation = page.getByTestId('battle-history').locator('li').filter({ hasText: 'Stakeout canceled' }).first();
  await expect(cancellation).toContainText('Cornball');
  await cancellation.getByRole('button', { name: 'Replay step by step' }).click();
  await expect(page.getByTestId('replay-controls')).toBeVisible();
  await expect(page.getByTestId('effect-causality')).toContainText('Watson');
  await page.getByRole('button', { name: 'After' }).click();
  await expect(page.locator('[data-card-zone="board"][data-card-id="watson"]')).toHaveAttribute('data-card-power', '5');
  await page.getByRole('button', { name: 'Return to live battle' }).click();

  await page.locator('[data-card-zone="board"][data-card-id="sherlock"]').click();
  const sherlockInspector = page.getByRole('dialog', { name: /Sherlock battle details/ });
  await expect(sherlockInspector).toContainText('Stakeout');
  await expect(sherlockInspector).toContainText(/weakest other friendly character/i);
  await page.getByTestId('button-close-inspector').click();
  await page.locator('[data-card-zone="board"][data-card-id="watson"]').click();
  const watsonInspector = page.getByRole('dialog', { name: /Watson battle details/ });
  await expect(watsonInspector.locator('.dossier-stat').filter({ hasText: 'Hands' }).locator('.dossier-stat__value')).toHaveText('3');
  await expect(watsonInspector).toContainText('Restore up to 3 Hands');
  await page.getByTestId('button-close-inspector').click();

  await expectReachable(page.locator('.battle-actions'), page);
  await page.screenshot({ path: `../../screenshots/four-crews-detective-${testInfo.project.name}.png`, fullPage: true });
});

test('coherent Counterplay mounted battle converts Nerd silence into both leader payoffs', async ({ page }, testInfo) => {
  if (testInfo.project.name.includes('phone')) await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(appPath('/e2e/crew-balance.fixture.html?mode=counter'));
  await page.getByRole('button', { name: /Closet Nerd/ }).click();
  await page.getByTestId('lane-0').click();
  await page.getByTestId('button-lock').click();
  const state = page.getByTestId('crew-balance-state');
  await expect(state).toHaveAttribute('data-rival-silenced', 'true');
  await expect(state).toHaveAttribute('data-gamer-triggered', 'true');
  await expect(state).toHaveAttribute('data-counter-triggered', 'true');
  await expect(state).toHaveAttribute('data-counter-power', '4');
  await expect(state).toHaveAttribute('data-counter-protected', 'true');

  await page.getByRole('button', { name: /Closet Nerd/ }).click();
  const inspector = page.getByRole('dialog', { name: /Closet Nerd battle details/ });
  await expect(inspector).toContainText('Unaware');
  await expect(inspector).toContainText('Silence');
  await expectReachable(page.getByTestId('button-close-inspector'), page);
  await page.getByTestId('button-close-inspector').click();
  await expectReachable(page.locator('.battle-actions'), page);
  await page.screenshot({ path: `../../screenshots/four-crews-counterplay-${testInfo.project.name}.png`, fullPage: true });
});