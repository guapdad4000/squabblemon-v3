import { expect, test } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);

test('a failed competing server cannot replace React under a mounted app', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.addInitScript(() => localStorage.setItem('squabblemon_e2e_user', 'signed-in'));
  await page.route('**/api/**', route => route.fulfill({ json: {} }));
  await page.goto('/squabblemon/game/decks/missing-runtime-check');
  await expect(page.getByRole('banner', { name: 'Player and navigation' })).toBeVisible();

  // Vite starts its optimizer before trying to bind. A failed startup used to
  // overwrite the live server's shared dependency cache and split React in two.
  let competitorFailed = false;
  try {
    await exec(process.execPath, [
      fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)),
      '--config', 'vite.config.ts', '--force',
    ], {
      cwd: fileURLToPath(new URL('../', import.meta.url)),
      env: { ...process.env, PORT: '4179', BASE_PATH: '/squabblemon', VITE_BATTLE_PERF: '1' },
      timeout: 30_000,
    });
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string };
    expect(`${failure.stdout ?? ''}${failure.stderr ?? ''}`).toContain('Port 4179 is already in use');
    competitorFailed = true;
  }
  expect(competitorFailed).toBe(true);

  // Keep the original renderer mounted while the route imports its hooks.
  await page.evaluate(() => {
    history.pushState(null, '', '/squabblemon/game/decks');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.getByRole('heading', { name: 'The Lineup', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('lineup.png') });
  await page.getByRole('group').filter({ has: page.getByText(/Learning examples ·/) }).locator('summary').click();
  await page.getByRole('button', { name: /Build from example:/ }).first().click();
  const name = page.getByRole('textbox', { name: 'Deck name' });
  await expect(name).toBeVisible();
  await name.fill('Runtime Check Gang');
  await page.getByRole('button', { name: 'Test deck', exact: true }).click();
  await expect(page).toHaveURL(/\/game\/decks\/[^/]+\/test$/);
  await page.goBack();
  await expect(name).toHaveValue('Runtime Check Gang');
  await page.reload();
  await expect(name).toHaveValue('Runtime Check Gang');
  await page.screenshot({ path: testInfo.outputPath('editor.png') });
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(errors).toEqual([]);
});