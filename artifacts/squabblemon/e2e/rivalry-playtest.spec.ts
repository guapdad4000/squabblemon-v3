import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function playFirstAvailable(page: Page) {
  const hand = page.locator('[data-card-zone="hand"]');
  const ids = await hand.evaluateAll(cards => cards.map(card => card.getAttribute('data-instance-id')!).filter(Boolean));
  for (const id of ids) {
    const card = page.locator(`[data-card-zone="hand"][data-instance-id="${id}"]`);
    await card.click();
    for (const lane of [0, 1, 2]) {
      await page.getByTestId(`lane-${lane}`).click();
      const play = page.getByTestId('button-lock');
      if (await play.count() && await play.isEnabled()) { await play.click(); return true; }
    }
    // Clear the unsuccessful selection before trying another card or ending turn.
    await card.click();
  }
  return false;
}
async function exportGame(page: Page) {
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export game', exact: true }).click();
  const download = await downloaded;
  const evidence = JSON.parse(await readFile((await download.path())!, 'utf8'));
  await expect(page.getByTestId('playtest-status')).toContainText('Replay verified');
  return evidence;
}

test('shared-screen game completes, exports a replay, and preserves draws on seat swap', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/e2e/rivalry-playtest.fixture.html');
  for (const tier of ['0', '1', '2', '3']) {
    await page.getByLabel('Training tier').selectOption(tier);
    await page.getByRole('button', { name: 'Start game', exact: true }).click();
    const snapshot = await exportGame(page);
    expect(snapshot.match.abilityUpgradeSnapshot.player.every((c: {moveTier: number}) => c.moveTier === Number(tier))).toBe(true);
    expect(snapshot.match.abilityUpgradeSnapshot.cpu.every((c: {moveTier: number}) => c.moveTier === Number(tier))).toBe(true);
    expect([...snapshot.match.playerCardIds, ...snapshot.match.cpuCardIds]).not.toContain('guap');
  }
  for (let turn = 0; turn < 12; turn++) {
    const status = page.getByTestId('playtest-status');
    const round = Math.floor(turn / 2) + 1;
    await expect(status).toHaveAttribute('data-round', String(round));
    const playerOpens = round % 2 === 1;
    const playerActs = (turn % 2 === 0) === playerOpens;
    await expect(status).toHaveAttribute('data-phase', playerActs ? 'player' : 'cpu-reveal');
    if (playerActs) {
      await playFirstAvailable(page);
      await page.getByTestId('button-next-round').click();
    } else {
      const controls = page.getByRole('region', { name: 'Second side controls' });
      await expect(controls).toBeVisible();
      const options = controls.getByRole('button').filter({ hasText: 'Motion' });
      if (await options.count()) await options.first().click();
      await page.getByTestId('second-pass').click();
    }
  }
  await expect(page.getByTestId('playtest-status')).toHaveAttribute('data-phase', 'complete');
  await page.getByLabel('Playtest notes').fill('Automated browser exercise; not human balance feedback.');
  const complete = await exportGame(page);
  expect(complete.completed).toBe(true);
  expect(complete.replayVerified).toBe(true);
  expect(complete.commands.some((c: {kind: string; owner: string}) => c.kind === 'play' && c.owner === 'player')).toBe(true);
  expect(complete.commands.some((c: {kind: string; owner: string}) => c.kind === 'play' && c.owner === 'cpu')).toBe(true);
  expect(complete.match.boards.flat().length).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Swap seats, same draws' }).click();
  const swapped = await exportGame(page);
  expect(swapped.match.playerCardIds).toEqual(complete.match.cpuCardIds);
  expect(swapped.match.cpuCardIds).toEqual(complete.match.playerCardIds);
  expect(swapped.commands).toEqual([]);
  expect(errors).toEqual([]);
});
