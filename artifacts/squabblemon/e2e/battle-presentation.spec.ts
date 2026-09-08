import { expect, test, type Locator, type Page } from '@playwright/test';

const phase = (arena: Locator, value: string) =>
  expect(arena).toHaveAttribute('data-presentation-phase', value);

async function enterPractice(page: Page) {
  await page.goto('/squabblemon/play/guest');
  await page.getByTestId('button-start').click();
  const arena = page.getByTestId('battle-arena');
  await expect(arena).toBeVisible();
  await page.getByRole('button', { name: /^Continue past / }).click();
  await phase(arena, 'player-ready');
  return arena;
}

async function choosePlayableCard(page: Page) {
  const playableCard = page.getByTestId('hand-tray').locator('[data-card-zone="hand"]:not([title])').first();
  await expect(playableCard).toBeVisible();
  await expect(page.getByTestId('battle-command-deck')).not.toHaveAttribute('inert');
  await playableCard.click();
  await expect(page.getByTestId('button-squabble')).toBeEnabled();
  const legalLane = page.getByRole('button', { name: /^Deploy / }).first();
  await expect(legalLane).toBeVisible();
  await legalLane.click();
}

async function expectInsideViewport(locator: Locator, page: Page) {
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);
}

test('a real practice turn presents travel, reveal, impact, and SQUABBLE in order', async ({ page }) => {
  const arena = await enterPractice(page);
  await expect(page.getByTestId('turn-timer')).toHaveAttribute('data-timer-state', 'calm');
  await choosePlayableCard(page);
  await page.getByTestId('button-squabble').click();
  await page.getByTestId('button-lock').click();

  await phase(arena, 'player-travel');
  await expect(page.locator('[data-squabble-impact="true"]')).toHaveCount(0);
  await phase(arena, 'player-reveal');
  await expect(page.locator('[data-squabble-impact="true"]')).toHaveCount(0);
  await phase(arena, 'player-impact');
  await expect(page.locator('[data-squabble-impact="true"]')).toHaveCount(1);

  const fastForward = page.getByTestId('button-fast-forward');
  await expect(fastForward).toBeVisible();
  const phaseBeforeSkip = await arena.getAttribute('data-presentation-phase');
  await fastForward.click();
  await expect.poll(() => arena.getAttribute('data-presentation-phase'), { timeout: 2_000 })
    .not.toBe(phaseBeforeSkip);
});

test('a player can choose a district before a card and keep both selections', async ({ page }) => {
  await enterPractice(page);
  await expect(page.getByTestId('motion-player')).toBeVisible();
  await expect(page.getByTestId('motion-rival')).toBeVisible();
  await page.getByRole('button', { name: /^Select .* district first$/ }).first().click();
  const selectedLane = page.locator('[data-testid^="lane-container-"].is-selected');
  await expect(selectedLane).toHaveCount(1);
  const playableCard = page.getByTestId('hand-tray').locator('[data-card-zone="hand"]:not([title])').first();
  await playableCard.click();
  await expect(selectedLane).toHaveCount(1);
  await expect(page.getByTestId('button-lock')).toBeEnabled();
  await expect(page.getByTestId('battle-guidance')).toContainText('then Lock In');
});

test('iPad portrait and landscape keep battle controls visible and tappable', async ({ page }) => {
  for (const viewport of [{ width: 768, height: 1024 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    await enterPractice(page);
    const district = page.getByRole('button', { name: /^Select .* district first$/ }).first();
    await expectInsideViewport(district, page);
    await expectInsideViewport(page.getByTestId('hand-tray'), page);
    await expectInsideViewport(page.getByTestId('button-next-round'), page);
    await district.click();
    await expect(page.locator('[data-testid^="lane-container-"].is-selected')).toHaveCount(1);
  }
});

test('timer exposes paused, calm, warning, and urgent states and battle controls stay readable', async ({ page }) => {
  await page.goto('/squabblemon/play/guest');
  await page.getByTestId('button-start').click();
  const timer = page.getByTestId('turn-timer');
  await expect(timer).toHaveAttribute('data-timer-state', 'paused');
  await page.getByRole('button', { name: /^Continue past / }).click();
  await expect(timer).toHaveAttribute('data-timer-state', 'calm');
  await expect(timer).toHaveAttribute('data-timer-state', 'warning', { timeout: 12_000 });
  await expect(timer).toHaveAttribute('data-timer-state', 'urgent', { timeout: 7_000 });

  await expectInsideViewport(page.getByTestId('battle-arena'), page);
  await expectInsideViewport(page.getByTestId('battle-guidance'), page);
  await expectInsideViewport(page.getByTestId('hand-tray'), page);
  await expectInsideViewport(page.getByTestId('button-next-round'), page);
});

test('the battle honors the browser motion preference', async ({ page }, testInfo) => {
  const arena = await enterPractice(page);
  const reduced = testInfo.project.name === 'phone';
  await expect(arena).toHaveAttribute('data-reduced-motion', String(reduced));
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(reduced);
});