import { expect, test } from '@playwright/test';

const fixture = '/squabblemon/e2e/diner-counter.fixture.html';

test('the mounted battle shows current Open Tab receipt states locally and in replay', async ({ page }) => {
  await page.goto(fixture);
  const marker = page.getByTestId('character-mark-0');
  const cashier = page.getByTestId('card-board-player-0-squabblehouse-cashier-0');
  const rival = page.getByTestId('card-board-rival-0-griddle-master-0');

  await expect(marker).toBeVisible();
  await expect(marker).toContainText('Open Tab');
  await expect(marker).toContainText('ready');
  await expect(marker).toContainText('through R2');
  await expect(cashier).toHaveCount(1);
  await expect(cashier.locator('[data-card-status="movement-locked"]')).toHaveCount(0);
  await expect(rival).toHaveCount(1);
  await expect(rival.locator('[data-card-status="movement-locked"]')).toHaveCount(0);

  await page.getByTestId('select-receipt-state').selectOption('spent');
  await expect(marker).toContainText('spent this round');
  await expect(marker).toContainText('through R2');

  await page.getByTestId('select-receipt-state').selectOption('ready');
  await page.getByTestId('toggle-replay').check();
  await expect(marker).toContainText('Open Tab');
  await expect(marker).toContainText('ready');

  await page.getByTestId('select-receipt-state').selectOption('expired');
  await page.getByTestId('toggle-replay').uncheck();
  await expect(page.getByTestId('character-mark-0')).toHaveCount(0);
  await page.getByTestId('toggle-replay').check();
  await expect(page.getByTestId('character-mark-0')).toHaveCount(0);
});

test('the online room projection flips Open Tab ownership and removes expired receipts from current and replay views', async ({ page }) => {
  await page.goto(fixture);
  await page.getByTestId('select-perspective').selectOption('guest');
  const marker = page.getByTestId('character-mark-0');
  await expect(marker).toBeVisible();
  await expect(marker).toContainText('Rival Open Tab');
  await expect(marker).not.toContainText('Your Open Tab');

  await page.getByTestId('toggle-replay').check();
  await expect(marker).toContainText('Rival Open Tab');
  await page.getByTestId('select-receipt-state').selectOption('spent');
  await expect(marker).toContainText('spent this round');
  await expect(marker).toContainText('through R2');
  await page.getByTestId('select-perspective').selectOption('player');
  await expect(marker).toContainText('Your Open Tab');
  await expect(marker).toContainText('spent this round');
  await page.getByTestId('select-receipt-state').selectOption('expired');
  await expect(page.getByTestId('character-mark-0')).toHaveCount(0);
  await page.getByTestId('select-perspective').selectOption('guest');
  await page.getByTestId('toggle-replay').uncheck();
  await expect(page.getByTestId('character-mark-0')).toHaveCount(0);
  await page.getByTestId('toggle-replay').check();
  await expect(page.getByTestId('character-mark-0')).toHaveCount(0);
});

test('the mounted Janitor marker shows independent round charges, replay history, legacy state, and refresh', async ({ page }) => {
  await page.goto(fixture);
  const marker = page.getByTestId('character-mark-2').filter({ hasText: 'Turn It Around' });
  const states = [
    { state: 'ready', harm: 'harm ready', staff: 'staff ready' },
    { state: 'harm-spent', harm: 'harm spent', staff: 'staff ready' },
    { state: 'staff-spent', harm: 'harm ready', staff: 'staff spent' },
    { state: 'both-spent', harm: 'harm spent', staff: 'staff spent' },
    { state: 'legacy', harm: 'harm spent', staff: 'staff spent' },
    { state: 'next-round', harm: 'harm ready', staff: 'staff ready' },
  ] as const;

  for (const charge of states) {
    await page.getByTestId('select-janitor-state').selectOption(charge.state);
    await expect(marker).toContainText(charge.harm);
    await expect(marker).toContainText(charge.staff);
    await page.getByTestId('toggle-replay').check();
    await expect(marker).toContainText(charge.harm);
    await expect(marker).toContainText(charge.staff);
    await page.getByTestId('toggle-replay').uncheck();
  }
});

test('the public guest sees rival-owned Janitor charge categories in current and replay views', async ({ page }) => {
  await page.goto(fixture);
  await page.getByTestId('select-perspective').selectOption('guest');
  const marker = page.getByTestId('character-mark-2').filter({ hasText: 'Turn It Around' });
  const states = [
    { state: 'harm-spent', harm: 'harm spent', staff: 'staff ready' },
    { state: 'staff-spent', harm: 'harm ready', staff: 'staff spent' },
    { state: 'both-spent', harm: 'harm spent', staff: 'staff spent' },
    { state: 'legacy', harm: 'harm spent', staff: 'staff spent' },
    { state: 'next-round', harm: 'harm ready', staff: 'staff ready' },
  ] as const;

  for (const charge of states) {
    await page.getByTestId('select-janitor-state').selectOption(charge.state);
    await expect(marker).toContainText('Rival Turn It Around');
    await expect(marker).toContainText(charge.harm);
    await expect(marker).toContainText(charge.staff);
    await page.getByTestId('toggle-replay').check();
    await expect(marker).toContainText('Rival Turn It Around');
    await expect(marker).toContainText(charge.harm);
    await expect(marker).toContainText(charge.staff);
    await page.getByTestId('toggle-replay').uncheck();
  }
});

test('the real Manager and Bus Boy shift shows numeric aura, Clear the Table, and one adjacent patrol', async ({ page }) => {
  await page.goto(`${fixture}?scenario=on-shift`);

  const manager = page.locator('[data-card-id="squabble-house-manager"][data-card-zone="board"]');
  const worker = page.locator('[data-card-id="squabble-house-female"][data-card-zone="board"]');
  const busBoy = page.locator('[data-card-id="squabblehouse-bus-boy"][data-card-zone="board"]');

  await expect(manager).toHaveCount(1);
  await expect(page.getByTestId('lane-0-player-zone').locator('[data-card-id="squabblehouse-security"]')).toHaveCount(1);
  await expect(worker).toHaveCount(1);
  await expect(worker).toHaveAttribute('data-card-power', '3');
  await expect(worker).toHaveAttribute('aria-label', /Weakened/);
  await expect(page.getByTestId('lane-1-player-zone').locator('[data-card-id="squabble-house-female"]')).toHaveCount(1);
  await expect(page.getByTestId('lane-2-player-zone').locator('[data-card-id="squabblehouse-bus-boy"]')).toHaveCount(1);

  // Manager's printed +1, +3 ongoing staff Hands, and 6 total remain distinct in CardView.
  await expect(manager).toHaveAttribute('data-card-power', '6');
  await expect(manager.locator('[data-testid="card-ongoing-hands"]')).toHaveText('+3 ongoing');
  await expect(manager.locator('.card-stat-pair')).toContainText('+1');

  await page.getByTestId('toggle-replay').check();
  await expect(manager).toHaveAttribute('data-card-power', '6');
  await expect(manager.locator('[data-testid="card-ongoing-hands"]')).toHaveText('+3 ongoing');
  await expect(worker).toHaveAttribute('data-card-power', '4');
  await expect(worker).not.toHaveAttribute('aria-label', /Weakened/);
  await expect(page.getByTestId('lane-1-player-zone').locator('[data-card-id="squabblehouse-bus-boy"]')).toHaveCount(1);
  await expect(page.getByTestId('lane-2-player-zone').locator('[data-card-id="squabblehouse-bus-boy"]')).toHaveCount(0);
});

test('a departed Bus Boy loses the live Manager bonus while the patrol replay retains its cached aura', async ({ page }) => {
  await page.goto(`${fixture}?scenario=source-killed`);

  const manager = page.locator('[data-card-id="squabble-house-manager"][data-card-zone="board"]');
  const busBoy = page.locator('[data-card-id="squabblehouse-bus-boy"][data-card-zone="board"]');
  const worker = page.locator('[data-card-id="squabble-house-female"][data-card-zone="board"]');

  // P. Tang moves the cleansed worker away; Queen of Hearts then executes the lone Bus Boy.
  await expect(page.getByRole('button', { name: 'Queen of Hearts. Legendary rarity.', exact: true })).toHaveCount(1);
  await expect(busBoy).toHaveCount(0);
  await expect(worker).toHaveCount(1);
  await expect(manager).toHaveAttribute('data-card-power', '5');
  await expect(manager.locator('[data-testid="card-ongoing-hands"]')).toHaveText('+2 ongoing');

  await page.getByTestId('toggle-replay').check();
  await expect(busBoy).toHaveCount(1);
  const replayWorker = page.getByTestId('lane-1-player-zone').locator('[data-card-id="squabble-house-female"]');
  await expect(page.getByTestId('lane-1-player-zone').locator('[data-card-id="squabblehouse-bus-boy"]')).toHaveCount(1);
  await expect(replayWorker).toHaveAttribute('data-card-power', '4');
  await expect(replayWorker).not.toHaveAttribute('aria-label', /Weakened/);
  await expect(manager).toHaveAttribute('data-card-power', '6');
  await expect(manager.locator('[data-testid="card-ongoing-hands"]')).toHaveText('+3 ongoing');
});
