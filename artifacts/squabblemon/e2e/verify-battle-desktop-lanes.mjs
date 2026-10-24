import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const origin = process.env.PARITY_ORIGIN || 'http://127.0.0.1:4242';
const output = process.env.PARITY_OUTPUT || '/tmp/squabblemon-desktop-lanes';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const results = [];
try {
  for (const [width, height] of [[1440, 1000], [1280, 720], [390, 844], [1024, 768], [844, 390]]) {
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 1200 });
    await page.routeWebSocket('**', socket => socket.close());
    await page.goto(`${origin}/e2e/battle-parity.fixture.html?no-timer&counts=4,1,8`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('battle-arena').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);
    const measure = () => page.evaluate(() => {
      const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom }; };
      return { field: rect('.battlefield-grid'), lane: rect('.district-lane'), hand: rect('#hand-tray'), stack: rect('[data-testid="lane-2-player-zone"] .battle-card-stack'), card: rect('[data-card-zone="board"]'), handCard: rect('[data-card-zone="hand"]'), action: rect('.battle-primary-action'), pageWidth: document.documentElement.scrollWidth };
    });
    const current = await measure();
    const baselineStyle = await page.addStyleTag({ content: '.battle-arena.battle-hud .battle-command-deck{margin-top:0!important}' });
    await page.waitForTimeout(100);
    const previous = await measure();
    await baselineStyle.evaluate(element => element.remove());
    await page.waitForTimeout(100);
    const desktop = width >= 1200 && height >= 700;
    assert.ok(Math.abs(current.field.height - previous.field.height - (desktop ? 48 : 0)) < 1, 'Only broad desktop gains48px of usable field');
    const formationGain = (current.lane.height - previous.lane.height) / 2;
    assert.ok(Math.abs(current.stack.height - previous.stack.height - formationGain) < 1, 'Additional lane height goes equally to both formation viewports');
    assert.ok(formationGain >= 0 && formationGain <= 24);
    if (width === 1440) assert.equal(formationGain, 24);
    assert.deepEqual(current.hand, previous.hand, 'Hand keeps its position and footprint');
    assert.equal(current.card.width, previous.card.width); assert.equal(current.card.height, previous.card.height);
    assert.ok(current.action.bottom <= height + 1 && current.action.height >= 44);
    assert.ok(current.pageWidth <= width);
    const inspect = page.getByTestId('lane-2-player-zone').locator('.battle-formation-inspect');
    await page.locator('.battlefield-grid').evaluate(element => { element.scrollTop = element.scrollHeight; });
    await page.waitForTimeout(100);
    const control = await inspect.evaluate(element => {
      const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
      return { height: rect.height, width: rect.width, radius: style.borderRadius, label: element.getAttribute('aria-label'), reachable: element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)) };
    });
    assert.ok(control.reachable, 'The small lane control stays above the hand and receives pointer input');
    assert.equal(control.radius, '20px'); assert.match(control.label, /Inspect all 8 cards/);
    assert.ok(control.height >= (width < 1200 ? 44 : 32));
    const stack = page.getByTestId('lane-2-player-zone').locator('.battle-card-stack');
    await stack.evaluate(element => { element.scrollTop = element.scrollHeight; });
    await page.waitForTimeout(350);
    const finalCard = await stack.locator(':scope > [data-card-zone="board"]').last().evaluate(element => {
      const r = element.getBoundingClientRect();
      return { reachable: element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)), top: r.top, bottom: r.bottom };
    });
    assert.ok(finalCard.reachable, 'The last crowded fighter remains pointer-accessible after scrolling');
    await inspect.click();
    const district = page.getByRole('dialog', { name: /district view/i }); await district.waitFor();
    assert.equal(await district.locator('[data-card-zone="board"]').count(), 16);
    await page.keyboard.press('Escape'); await district.waitFor({ state: 'hidden' });
    assert.ok(await inspect.evaluate(element => element === document.activeElement));
    await stack.evaluate(element => { element.scrollTop = 0; });
    await page.locator('.battlefield-grid').evaluate(element => { element.scrollTop = 0; });
    await page.mouse.move(0,0);
    await page.screenshot({ path: `${output}/battle-after-${width}.png` });
    let interactive = null;
    if (width === 1440) {
      await page.locator('[data-card-zone="hand"]').first().click();
      await page.getByTestId('lane-0').click();
      await page.mouse.move(0, 0); await page.waitForTimeout(600);
      const target = await page.evaluate(() => {
        const values = document.querySelector('.battle-target-line__beam').getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number);
        const arena = document.querySelector('[data-testid="battle-arena"]').getBoundingClientRect();
        const hub = document.querySelector('[data-testid="lane-0"]').getBoundingClientRect();
        const hand = document.querySelector('#hand-tray').getBoundingClientRect();
        return { endX: values.at(-2) + arena.x, endY: values.at(-1) + arena.y, hubX: hub.x + hub.width / 2, hubBottom: hub.bottom, handTop: hand.top };
      });
      assert.ok(Math.abs(target.endX - target.hubX) < 2 && Math.abs(target.endY - target.hubBottom) < 2);
      assert.ok(target.endY < target.handTop - 100, 'Selection arrow terminates at the visible hub, safely above the hand');
      await page.screenshot({ path: `${output}/battle-desktop-selected-target.png` });
      await page.getByTestId('button-lock').click();
      await page.waitForFunction(() => document.querySelectorAll('[data-card-zone="hand"]').length === 6);
      assert.equal(await page.locator('[data-card-zone="board"]').count(), 27);
      await page.goto(`${origin}/e2e/battle-parity.fixture.html?no-timer&counts=4,1,8`, { waitUntil: 'domcontentloaded' });
      const source = page.locator('[data-battle-draggable="true"][data-card-id="cornball"]');
      await source.waitFor(); await page.waitForTimeout(300);
      const start = await source.boundingBox(), end = await page.getByTestId('lane-1').boundingBox();
      await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
      await page.mouse.down();
      await page.mouse.move(start.x + start.width / 2, start.y - 25, { steps: 4 });
      await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 12 });
      await page.getByTestId('battle-drag-preview').waitFor();
      assert.match(await page.getByTestId('battle-drag-preview').innerText(), /Release to play/);
      await page.screenshot({ path: `${output}/battle-desktop-drag-target.png` });
      await page.mouse.up();
      await page.waitForFunction(() => document.querySelectorAll('[data-card-zone="hand"]').length === 6);
      assert.equal(await page.locator('[data-card-zone="board"]').count(), 27);
      interactive = { target, selectAndPlay: true, dragAndPlay: true };
    }
    results.push({ width, height, geometry: current, fieldGain: current.field.height - previous.field.height, formationGain: current.stack.height - previous.stack.height, control, finalCard, interactive });
    await page.close();
  }
  console.log(JSON.stringify(results));
} finally { await writeFile(`${output}/desktop-lanes.json`, JSON.stringify(results, null, 2)); await browser.close(); }
