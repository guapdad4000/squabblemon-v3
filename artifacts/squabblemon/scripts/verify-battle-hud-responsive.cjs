const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const origin = process.env.TEST_BASE_URL || 'http://127.0.0.1:4213';
const output = process.env.REVIEW_OUTPUT || '/tmp/battle-hud-responsive-review';
const phases = ['player-ready', 'rival-thinking', 'player-reveal', 'effects', 'round-result'];
const viewports = [
  { width: 1440, height: 1000 },
  { width: 1280, height: 720 },
  { width: 844, height: 390 },
  { width: 490, height: 1000 },
  { width: 600, height: 850 },
  { width: 601, height: 850 },
  { width: 320, height: 568, touch: true },
  { width: 390, height: 844, touch: true },
];

function near(actual, expected, description, tolerance = 2) {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${description}: expected ${expected.toFixed(2)}, received ${actual.toFixed(2)}`);
}
function sameBox(actual, expected, description) {
  for (const key of ['x', 'y', 'width', 'height']) near(actual[key], expected[key], `${description} ${key}`);
}
function withinViewport(box, viewport, description) {
  assert.ok(box && box.width > 0 && box.height > 0, `${description} has a visible footprint`);
  assert.ok(box.x >= -1 && box.y >= -1 && box.x + box.width <= viewport.width + 1
    && box.y + box.height <= viewport.height + 1, `${description} remains inside the viewport: ${JSON.stringify(box)}`);
}
function separate(a, b, description) {
  assert.ok(a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1
    || a.y + a.height <= b.y + 1 || b.y + b.height <= a.y + 1, description);
}

async function load(page, query = '') {
  await page.goto(`${origin}/e2e/battle-mobile.fixture.html${query}`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('battle-arena').waitFor();
  await page.evaluate(() => Promise.race([
    Promise.all([...document.images].filter(image => image.loading !== 'lazy').map(image => image.decode().catch(() => {}))),
    new Promise(resolve => setTimeout(resolve, 2500)),
  ]));
  await page.waitForTimeout(250);
}
async function setPhase(page, phase) {
  await page.evaluate(value => window.__battleHudFixture.setPhase(value), phase);
  await page.waitForFunction(value => document.querySelector('[data-testid="battle-arena"]')?.dataset.presentationPhase === value, phase);
  // Allow broadcast exit animation and button hover movement to settle before comparing boxes.
  await page.mouse.move(0, 0);
  await page.waitForTimeout(300);
}
async function timerSnapshot(page) {
  return page.evaluate(() => {
    const top = document.querySelector('[data-testid="turn-timer"]');
    const bottom = document.querySelector('[data-testid="decision-clock"]');
    return {
      topState: top?.getAttribute('data-timer-state'),
      topValue: top?.querySelector('strong')?.textContent,
      bottomState: bottom?.getAttribute('data-state'),
      bottomValue: bottom?.querySelector('strong')?.textContent,
      progress: bottom?.querySelector('.decision-clock-track i')?.style.transform,
    };
  });
}
async function checkTimer(page, viewport, expectedState) {
  const clock = page.getByTestId('decision-clock');
  assert.ok(await clock.isVisible(), 'bottom decision timer is visible');
  const box = await clock.boundingBox();
  withinViewport(box, viewport, 'bottom decision timer');
  assert.ok(box.width > 100, 'bottom decision timer has enough width to read');
  const track = await clock.locator('.decision-clock-track').boundingBox();
  assert.ok(track && track.width > 100 && track.height > 0, 'countdown bar remains visible');
  assert.equal(await clock.getAttribute('data-state'), expectedState);
  assert.equal(await page.getByTestId('turn-timer').getAttribute('data-timer-state'), expectedState);
  return { box, track, state: await timerSnapshot(page) };
}
async function measure(page, viewport, phase) {
  const speed = page.getByTestId('button-battle-speed');
  assert.ok(await speed.isVisible(), 'battle speed control is visible');
  const speedBox = await speed.boundingBox();
  withinViewport(speedBox, viewport, 'speed control');
  assert.ok(speedBox.width <= 64, `speed pill stays compact, received ${speedBox.width}px`);
  await speed.click({ trial: true });
  const board = await page.locator('.battlefield-grid').boundingBox();
  assert.ok(board && board.width > 0 && board.height > 0, 'battlefield remains visible');
  const header = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll('.battle-rival, .battle-header .battle-round, .battle-tools > summary')]
      .map(node => node.getBoundingClientRect()).filter(box => box.width && box.height);
    return { top: Math.min(...boxes.map(box => box.top)), bottom: Math.max(...boxes.map(box => box.bottom)) };
  });
  const actionBox = await page.locator('.battle-primary-action').boundingBox();
  withinViewport(actionBox, viewport, 'primary battle action');
  const handCard = await page.locator('[data-card-zone="hand"]').first().boundingBox();
  withinViewport(handCard, viewport, 'first hand card');
  assert.ok(await page.locator('[data-card-zone="board"]').first().isVisible(), 'fighters remain visible on the battlefield');
  const skip = page.getByTestId('button-fast-forward');
  const skipVisible = await skip.isVisible();
  assert.equal(skipVisible, phase !== 'player-ready', `Skip availability in ${phase}`);
  let skipBox = null;
  if (skipVisible) {
    skipBox = await skip.boundingBox();
    withinViewport(skipBox, viewport, 'Skip control');
    separate(speedBox, skipBox, 'Skip and speed controls do not overlap');
    await skip.click({ trial: true });
  }
  // Controls must not cover district claims, clock, or the menu's touch target.
  for (const locator of [page.getByTestId('claims-live'), page.getByTestId('turn-timer'), page.locator('.battle-tools > summary')]) {
    const box = await locator.boundingBox();
    if (box && await locator.isVisible()) {
      separate(speedBox, box, 'speed does not overlap another HUD control');
      if (skipBox) separate(skipBox, box, 'Skip does not overlap another HUD control');
    }
  }
  const timer = await checkTimer(page, viewport, phase === 'player-ready' ? 'calm' : 'paused');
  return { speed: speedBox, skip: skipBox, board, header, action: actionBox, handCard, timer };
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const results = [];
  let currentPage;
  try {
    for (const viewport of viewports.filter(viewport => !process.env.TEST_WIDTHS || process.env.TEST_WIDTHS.split(',').map(Number).includes(viewport.width))) {
      const label = `${viewport.width}x${viewport.height}-${viewport.touch ? 'touch' : 'mouse'}`;
      const page = currentPage = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, isMobile: !!viewport.touch, hasTouch: !!viewport.touch });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await load(page);
      assert.ok(await page.evaluate(() => typeof window.__battleHudFixture?.setPhase === 'function'), 'fixture supports live phase transitions');
      const phaseResults = [];
      let baseline, skipBaseline;
      for (const phase of phases) {
        await setPhase(page, phase);
        const geometry = await measure(page, viewport, phase);
        baseline ??= geometry;
        sameBox(geometry.speed, baseline.speed, `speed remains stable in ${phase}`);
        if (phase === 'round-result') {
          const hudBottom = Math.max(geometry.header.bottom, geometry.speed.y + geometry.speed.height,
            geometry.skip ? geometry.skip.y + geometry.skip.height : 0);
          assert.ok(geometry.board.y >= hudBottom - 1, 'round recap remains above the battlefield and controls');
        } else {
          near(geometry.board.y, baseline.board.y, `battlefield top remains stable in ${phase}`);
        }
        near(geometry.header.top, baseline.header.top, `header top remains stable in ${phase}`);
        near(geometry.header.bottom, baseline.header.bottom, `header bottom remains stable in ${phase}`);
        if (geometry.skip) {
          skipBaseline ??= geometry.skip;
          sameBox(geometry.skip, skipBaseline, `Skip remains stable in ${phase}`);
        }
        const timerBefore = await timerSnapshot(page);
        const pressedBefore = await page.getByTestId('button-battle-speed').getAttribute('aria-pressed');
        await page.getByTestId('button-battle-speed').click();
        await page.mouse.move(0, 0);
        await page.waitForTimeout(200);
        const fast = pressedBefore !== 'true';
        assert.equal(await page.getByTestId('button-battle-speed').getAttribute('aria-pressed'), String(fast), 'speed toggles through the reachable control');
        assert.equal(await page.getByTestId('battle-arena').getAttribute('data-battle-speed'), fast ? 'fast' : 'normal');
        assert.deepEqual(await timerSnapshot(page), timerBefore, 'changing presentation speed preserves decision time');
        sameBox(await page.getByTestId('button-battle-speed').boundingBox(), geometry.speed, 'toggling speed keeps the pill footprint');
        near((await page.locator('.battlefield-grid').boundingBox()).y, geometry.board.y, 'toggling speed does not move the board');
        await page.screenshot({ path: path.join(output, `${label}-${phase}.png`) });
        phaseResults.push({ phase, ...geometry });
      }
      // Exercise an actual Skip action; the fixture returns to the decision phase.
      await setPhase(page, 'rival-thinking');
      await page.getByTestId('button-fast-forward').click();
      await page.waitForFunction(() => document.querySelector('[data-testid="battle-arena"]')?.dataset.presentationPhase === 'player-ready');
      assert.ok(await page.getByTestId('button-next-round').isVisible(), 'Skip returns to a usable player decision');
      assert.equal(await page.getByTestId('button-fast-forward').isVisible(), false);
      await load(page, '?fast&timer=5');
      assert.equal(await page.getByTestId('button-battle-speed').getAttribute('aria-pressed'), 'true', 'restored fast preference is represented');
      await checkTimer(page, viewport, 'urgent');
      const urgentBefore = await timerSnapshot(page);
      await page.getByTestId('button-battle-speed').click();
      assert.deepEqual(await timerSnapshot(page), urgentBefore, 'speed cannot reset an urgent turn clock');
      await load(page, '?timer=10');
      await checkTimer(page, viewport, 'warning');
      await load(page, '?no-timer');
      assert.equal(await page.getByTestId('turn-timer').count(), 0, 'disabled top clock is absent');
      assert.equal(await page.getByTestId('decision-clock').count(), 0, 'disabled bottom clock is absent');
      withinViewport(await page.getByTestId('button-battle-speed').boundingBox(), viewport, 'speed when the timer is disabled');
      await load(page, '?pvp');
      assert.equal(await page.getByTestId('button-battle-speed').count(), 0, 'PvP does not offer local speed control');
      assert.equal(await page.locator('.battle-command-header--organized').count(), 0, 'PvP retains its own header');
      assert.ok(await page.getByTestId('pvp-player-avatar').isVisible());
      assert.ok(await page.getByTestId('pvp-rival-avatar').isVisible());
      await checkTimer(page, viewport, 'calm');
      await page.screenshot({ path: path.join(output, `${label}-pvp.png`) });
      assert.deepEqual(errors, [], 'browser reports no runtime errors');
      results.push({ ...viewport, phases: phaseResults, skip: true, speed: true, clock: true, urgent: true, noTimer: true, pvp: true, errors });
      fs.writeFileSync(path.join(output, 'browser.json'), JSON.stringify(results, null, 2));
      console.log(`${label}: stable controls across ${phases.length} phases, timer, Skip, and PvP passed`);
      await page.close();
      currentPage = null;
    }
  } catch (error) {
    if (currentPage && !currentPage.isClosed()) await currentPage.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
    fs.writeFileSync(path.join(output, 'failure.txt'), String(error.stack || error));
    throw error;
  } finally {
    await browser.close();
  }
  console.log(`Responsive HUD evidence: ${output}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
