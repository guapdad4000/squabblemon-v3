import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.JOURNEY_ORIGIN ?? 'http://127.0.0.1:5173/squabblemon';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const errors = [], matchRequests = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => {
  if (new URL(request.url()).pathname.includes('/api/player/matches')) matchRequests.push(request.url());
});
await page.addInitScript(() => {
  localStorage.setItem('squabblemon_e2e_user', 'signed-in');
  localStorage.setItem('squabblemon.preview-decks.v1', JSON.stringify([{
    id: 'local-practice-check', name: 'Local Test Gang', heroCardId: 'cornball', recipeId: null,
    cardIds: ['cornball', 'earthy-sugar-foot', 'plug', 'gamer', 'snow-bunny', 'wifey', 'baby-momma'],
    valid: true, issues: [],
  }]));
});

async function waitForBattleState(locator) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (await locator.count()) return;
    const skip = page.getByTestId('button-fast-forward');
    if (await skip.count()) await skip.click({ timeout: 300 }).catch(() => {});
    await page.waitForTimeout(75);
  }
  throw new Error('The battle did not reach the expected state.');
}

try {
  await page.goto(`${origin}/game/decks/local-practice-check/test`, { waitUntil: 'domcontentloaded' });
  const ready = page.locator('[data-testid="battle-arena"][data-presentation-phase="player-ready"]');
  await page.getByTestId('battle-arena').waitFor();
  await waitForBattleState(ready);
  for (const [index, card] of ['cornball', 'earthy-sugar-foot'].entries()) {
    await page.getByTestId('hand-tray').locator(`[data-card-id="${card}"]`).click();
    await page.getByRole('button', { name: /^Deploy / }).first().click();
    await page.getByTestId('button-lock').click();
    await page.waitForTimeout(150);
    await waitForBattleState(ready);
    assert.equal(await page.getByLabel('Round 1 of 6').count(), 1);
    assert.equal(await page.getByLabel(`Your Motion: ${1 - index}`, { exact: true }).count(), 1);
    assert.equal(await page.getByTestId('hand-tray').locator('.battle-hand-card').count(), 4 - index);
  }
  assert.equal(await page.getByRole('button', { name: 'End Turn', exact: true }).count(), 1);
  await page.getByTestId('button-next-round').click();
  await page.waitForTimeout(150);
  await waitForBattleState(ready);
  assert.equal(await page.getByLabel('Round 2 of 6').count(), 1);
  assert.equal(await page.getByLabel('Your Motion: 2', { exact: true }).count(), 1);

  for (const activity of ['Open training', 'Beat the freeze']) {
    await page.goto(`${origin}/game/play`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: activity, exact: true }).click();
    await page.getByRole('button', { name: 'Enter fight', exact: true }).click();
    await page.getByTestId('battle-arena').waitFor();
    assert.equal(await page.getByRole('navigation', { name: 'Game navigation' }).count(), 0);
    assert.equal(await page.getByRole('alert').count(), 0);
    if (activity === 'Open training') {
      await waitForBattleState(ready);
      await page.waitForFunction(() => {
        const label = document.querySelector('[data-testid="turn-timer"]')?.getAttribute('aria-label');
        return label && Number.parseInt(label) <= 17;
      });
      const beforePlay = Number.parseInt(await page.getByTestId('turn-timer').getAttribute('aria-label'));
      await page.getByTestId('hand-tray').locator('[data-card-id="cornball"]').click();
      await page.getByRole('button', { name: /^Deploy / }).first().click();
      await page.getByTestId('button-lock').click();
      await page.waitForTimeout(150);
      await waitForBattleState(ready);
      const afterPlay = Number.parseInt(await page.getByTestId('turn-timer').getAttribute('aria-label'));
      assert(afterPlay <= beforePlay, 'Playing another card must not restart the turn timer.');
      await page.getByTestId('hand-tray').locator('[data-card-id="earthy-sugar-foot"]').click();
      await page.getByRole('button', { name: /^Deploy / }).first().click();
      // The timer commits the affordable selection once and then ends the turn.
      await page.getByLabel('Round 2 of 6').waitFor({ timeout: 35_000 });
      await waitForBattleState(ready);
      assert.equal(await page.getByTestId('hand-tray').locator('[data-card-id="earthy-sugar-foot"]').count(), 0);
      assert.equal(await page.getByLabel('Your Motion: 2', { exact: true }).count(), 1);
      console.log('Turn timer passed: remaining time is preserved, and expiry plays the selection and ends the turn.');
    }
  }

  await page.goto(`${origin}/game/play`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Events & equal footing', exact: true }).click();
  await page.getByRole('button', { name: 'Street draft', exact: true }).click();
  for (let i = 0; i < 7; i++) await page.getByRole('button', { name: /^Draft / }).first().click();
  await page.getByRole('button', { name: 'Play this draft', exact: true }).click();
  await page.getByTestId('battle-arena').waitFor();
  for (let round = 1; round <= 6; round++) {
    await waitForBattleState(page.locator('[data-testid="battle-arena"][data-presentation-phase="player-ready"]'));
    await page.getByTestId('button-next-round').click();
    await page.waitForTimeout(150);
  }
  await waitForBattleState(page.getByTestId('status-match-result'));
  assert.equal(await page.getByRole('button', { name: 'Retry Save', exact: true }).count(), 0);
  await page.getByTestId('button-restart-match').click();
  await page.getByTestId('battle-arena').waitFor();
  assert.deepEqual(matchRequests, [], 'Local preview must not start or save API fades.');
  assert.deepEqual(errors, []);
  console.log('Local preview passed: two cards in one turn, correct Motion spending, explicit End Turn, training, draft, six rounds, and runback without fade API requests.');
} finally {
  await browser.close();
}
