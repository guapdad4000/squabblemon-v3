import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const origin = (process.env.UI_ORIGIN ?? 'http://127.0.0.1:4195').replace(/\/$/, '');
const browser = await chromium.launch({ headless: true });
const errors = [];
await mkdir('screenshots/battle-performance', { recursive: true });
try {
  for (const [name, viewport] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }]]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'no-preference' });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/e2e/battle-performance-regression.fixture.html`);
    await page.getByTestId('battle-arena').waitFor();
    await page.waitForTimeout(1000);
    const before = await page.evaluate(() => window.__battleDrawReview.commits());
    await page.evaluate(() => window.__battleDrawReview.draw());
    const fresh = page.locator('[data-instance-id^="player:draw-review:"]');
    await fresh.waitFor();
    const timing = await fresh.evaluate(node => ({ animation: getComputedStyle(node).animationName, duration: getComputedStyle(node).animationDuration }));
    assert.equal(timing.animation, 'draw-into-hand');
    assert.equal(timing.duration, '0.8s', 'Authored draw duration stays unchanged');
    // Draw exactly once; finishing its visual effect must not re-render the battle.
    await page.waitForTimeout(1000);
    const after = await page.evaluate(() => window.__battleDrawReview.commits());
    assert.equal(after - before, 1, 'A draw should commit once with no animation cleanup render');
    await fresh.scrollIntoViewIfNeeded();
    await fresh.click();
    assert.equal(await fresh.getAttribute('aria-pressed'), 'true', 'The finished draw stays selectable');
    assert.equal(await fresh.evaluate(node => getComputedStyle(node).rotate), 'none', 'Draw does not retain its final transform');
    await page.screenshot({ path: `screenshots/battle-performance/draw-${name}.png` });

    await page.mouse.move(2, 2);
    await page.goto(`${origin}/e2e/battle-performance-regression.fixture.html`);
    await page.getByTestId('hand-tray').waitFor();
    const hand = page.getByTestId('hand-tray').locator('[data-card-zone="hand"]');
    const removedId = await hand.first().getAttribute('data-instance-id');
    const remainingId = await hand.nth(1).getAttribute('data-instance-id');
    const beforeShift = await hand.nth(1).boundingBox();
    await page.evaluate(() => window.__battleDrawReview.removeFirst());
    await page.waitForFunction(id => !document.querySelector(`[data-instance-id="${CSS.escape(id)}"]`), removedId);
    const projectionFrames = await page.evaluate(async id => {
      const card = document.querySelector(`[data-instance-id="${CSS.escape(id)}"]`);
      const samples = [];
      for (let i = 0; i < 12; i++) { await new Promise(requestAnimationFrame); samples.push(card.style.transform); }
      return samples;
    }, remainingId);
    assert.ok(projectionFrames.some(value => value && value !== 'none'), 'Remaining hand cards keep their spring layout motion');
    await page.waitForTimeout(650);
    const remaining = page.locator(`[data-card-zone="hand"][data-instance-id="${remainingId}"]`);
    const afterShift = await remaining.boundingBox();
    assert.ok(afterShift && beforeShift && afterShift.x < beforeShift.x - 30, 'Remaining hand closes the removed slot');
    assert.ok(Math.abs(afterShift.width - beforeShift.width) < 1 && Math.abs(afterShift.height - beforeShift.height) < 1, 'Hand card size stays unchanged');
    await remaining.click();
    assert.equal(await remaining.getAttribute('aria-pressed'), 'true', 'Projected cards remain selectable');
    await page.screenshot({ path: `screenshots/battle-performance/projection-${name}.png` });

    await page.goto(`${origin}/e2e/battle-mobile.fixture.html?effect`);
    await page.getByTestId('character-attack').waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('[data-impact-target]')].some(node => node.style.display !== 'none' && node.style.left));
    const geometry = await page.evaluate(() => {
      const attack = document.querySelector('[data-testid="character-attack"]');
      return [...attack.querySelectorAll('[data-impact-target]')].filter(node => node.style.display !== 'none').map(node => {
        const card = document.querySelector(`[data-card-zone="board"][data-instance-id="${CSS.escape(node.dataset.impactTarget)}"]`);
        const arenaBounds = attack.parentElement.getBoundingClientRect();
        const cardBounds = card?.getBoundingClientRect();
        return { target: node.dataset.impactTarget, width: parseFloat(node.style.width), height: parseFloat(node.style.height),
          dx: cardBounds ? Math.abs(parseFloat(node.style.left) + parseFloat(node.style.width) / 2 - (cardBounds.x - arenaBounds.x + cardBounds.width / 2)) : null,
          dy: cardBounds ? Math.abs(parseFloat(node.style.top) + parseFloat(node.style.height) / 2 - (cardBounds.y - arenaBounds.y + cardBounds.height / 2)) : null };
      });
    });
    assert.ok(geometry.length > 0, 'Impact targets must be present');
    for (const point of geometry) {
      assert.ok(point.width > 0 && point.height > 0, 'Impact artwork has visible geometry');
      assert.ok(point.dx !== null && point.dx < 25 && point.dy !== null && point.dy < 25, `Impact remains anchored to ${point.target}`);
    }
    const effects = await page.evaluate(() => {
      const arena = document.querySelector('[data-testid="battle-arena"]');
      const grid = arena.querySelector('.battlefield-grid');
      const strength = arena.dataset.impactStrength;
      arena.dataset.impactStrength = 'takeover';
      const probe = document.createElement('div');
      probe.className = 'battle-choreography intensity-takeover is-impact';
      arena.appendChild(probe);
      const flash = getComputedStyle(probe, '::before');
      const result = { arenaStrength: strength,
        gridAnimation: getComputedStyle(grid).animationName, gridDuration: getComputedStyle(grid).animationDuration,
        flashAnimation: flash.animationName, flashDuration: flash.animationDuration };
      probe.remove();
      arena.dataset.impactStrength = strength;
      // The probe must not retime the real routine grid animation being checked.
      result.gridAnimation = getComputedStyle(grid).animationName;
      result.gridDuration = getComputedStyle(grid).animationDuration;
      return result;
    });
    assert.equal(effects.arenaStrength, 'routine', 'Routine effect state stays consistent');
    assert.equal(effects.gridAnimation, 'arcade-nudge', 'Routine impact keeps its authored nudge');
    assert.equal(effects.gridDuration, '0.2s');
    assert.equal(effects.flashAnimation, 'arcade-flash', 'Takeover keeps its authored flash');
    assert.equal(effects.flashDuration, '0.18s');
    await page.screenshot({ path: `screenshots/battle-performance/impact-${name}.png` });
    console.log(`${name}: one draw commit, 800 ms motion, spring projection, selection, exact impact timing and ${geometry.length} impact anchors PASS`);
    await context.close();
  }
  assert.deepEqual(errors, [], 'Browser runtime errors');
} finally { await browser.close(); }
