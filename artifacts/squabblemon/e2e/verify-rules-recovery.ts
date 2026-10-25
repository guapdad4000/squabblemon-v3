import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect, type Page } from '@playwright/test';

const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:4332';
const output = process.env.RULES_RECOVERY_OUTPUT ?? '/tmp/beta-rules-recovery';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE });
const reports: unknown[] = [];
async function ready(page: Page) {
  await expect.poll(async () => {
    for (const selector of ['button-dismiss-mechanic-lesson', 'button-continue-guided-reading']) {
      const button = page.getByTestId(selector);
      if (await button.isVisible()) { await button.click({ timeout: 700 }).catch(() => {}); return false; }
    }
    const arena = page.getByTestId('battle-arena');
    if (await arena.getAttribute('data-presentation-phase').catch(() => null) === 'player-ready') return true;
    const skip = page.getByTestId('button-fast-forward');
    if (await skip.isVisible()) await skip.click({ timeout: 700 }).catch(() => {});
    const continuePast = page.getByRole('button', { name: /^Continue past / });
    if (await continuePast.isVisible()) await continuePast.click({ timeout: 700 }).catch(() => {});
    return false;
  }, { timeout: 45000 }).toBe(true);
}
try {
  for (const scenario of ['checkpoint', 'completion'] as const) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await page.routeWebSocket('**', socket => socket.close());
    await page.addInitScript({ content: "document.addEventListener('DOMContentLoaded', () => { document.documentElement.dataset.reduceMotion = 'true'; }, { once: true });" });
    const errors: string[] = [], starts: any[] = [], completedMoves: any[][] = [];
    let checkpoints = 0, contract: any;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/matches')) {
        starts.push(route.request().postDataJSON());
        contract = await page.evaluate(() => (window as any).broadcastBattle.contract('practice'));
        return route.fulfill({ status: 201, json: { id: `rules-match-${starts.length}`, mode: 'practice', playerDeckId: contract.playerDeckId, rivalDeckId: contract.rivalDeckId, encounterSnapshot: contract.encounter, abilityUpgradeSnapshot: contract.upgrades, districtSnapshot: contract.districts, status: 'active', createdAt: new Date().toISOString() } });
      }
      if (path.endsWith('/checkpoint') || path.endsWith('/complete')) {
        if (path.endsWith('/checkpoint')) checkpoints++;
        else completedMoves.push(route.request().postDataJSON().moves);
        return route.fulfill({ status: 409, json: { code: 'rules-updated', error: 'Start a new fade. Your saved rewards are unchanged.' } });
      }
      if (path.endsWith('/bootstrap')) return route.fulfill({ json: { profile: { id: 'rules-player', softCurrency: 100 }, missions: [] } });
      throw new Error(`Unexpected recovery request: ${path}`);
    });
    await page.goto(`${origin}/e2e/broadcast-battle.fixture.html?challenge=${scenario === 'checkpoint'}`);
    for (let turn = 0; turn < (scenario === 'checkpoint' ? 1 : 6); turn++) {
      await ready(page);
      await page.getByTestId('button-next-round').click();
    }
    const heading = page.getByRole('heading', { name: 'Rules updated', exact: true });
    await expect.poll(async () => {
      if (await heading.isVisible()) return true;
      for (const id of ['button-dismiss-mechanic-lesson', 'button-continue-guided-reading', 'button-fast-forward', 'button-archive-match']) {
        const button = page.getByTestId(id); if (await button.isVisible()) await button.click({ timeout: 700 }).catch(() => {});
      }
      return false;
    }, { timeout: 45000 }).toBe(true);
    await expect(heading).toBeFocused();
    await expect(page.getByText('Retry Save', { exact: true })).toHaveCount(0);
    await expect(page.getByTestId('reward-stinger')).toHaveCount(0);
    if (scenario === 'checkpoint') {
      assert.equal(checkpoints, 1); assert.equal(completedMoves.length, 0);
      await expect(page.getByText(/Your run and entry are saved/)).toBeVisible();
    } else {
      assert.equal(completedMoves.length, 1);
      assert.equal(completedMoves[0].filter(move => move.endTurn).length, 6);
      assert.equal(await page.evaluate(moves => (window as any).broadcastBattle.verify('practice', moves).phase, completedMoves[0]), 'complete');
    }
    for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      for (const name of ['Refresh game', 'Back']) {
        const box = await page.getByRole('button', { name, exact: true }).boundingBox();
        assert(box && box.height >= 44 && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1, JSON.stringify({scenario, viewport, name, box}));
      }
      await page.screenshot({ path: `${output}/${scenario}-${viewport.width}.png` });
    }
    await Promise.all([page.waitForEvent('domcontentloaded'), page.getByRole('button', { name: 'Refresh game', exact: true }).click()]);
    assert.equal(await page.evaluate(() => (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming).type), 'reload', 'rules recovery loads fresh application code');
    await expect.poll(() => starts.length).toBe(2);
    assert.deepEqual(starts[1], starts[0], 'restart reuses the same encounter/run request without purchasing a new entry');
    if (scenario === 'checkpoint') assert.equal(starts[1].challengeRunId, 'rules-update-run');
    await expect(heading).toHaveCount(0);
    await ready(page);
    assert.deepEqual(errors, []);
    reports.push({ scenario, starts: starts.length, checkpoints, completions: completedMoves.length, passed: true, evidence: 'Real PlayLoop with intercepted HTTP; server transaction correctness is covered separately by native PostgreSQL tests.' });
    await page.close();
  }
  await writeFile(`${output}/report.json`, JSON.stringify(reports, null, 2));
  console.log(JSON.stringify(reports, null, 2));
} finally { await browser.close(); }
