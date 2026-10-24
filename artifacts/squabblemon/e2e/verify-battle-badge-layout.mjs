import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { chromium } from 'playwright';

const origin = (process.env.UI_ORIGIN ?? 'http://127.0.0.1:4242').replace(/\/$/, '');
const output = process.env.BADGE_REPORT ?? 'screenshots/battle-performance/badge-layout.json';
const browser = await chromium.launch({ headless: true });
const results = [], errors = [];
try {
  for (const [name, viewport] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 1000 }]]) {
    const page = await browser.newPage({ viewport, reducedMotion: 'no-preference' });
    await page.routeWebSocket('**', socket => socket.close());
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const original = Element.prototype.getBoundingClientRect;
      Element.prototype.getBoundingClientRect = function () {
        if (window.__recordLayoutReads && this.matches('[data-card-zone="board"],[data-card-zone="hand"]')) window.__layoutReads.push(this.dataset.instanceId);
        return original.call(this);
      };
    });
    await page.goto(`${origin}/e2e/battle-layout-regression.fixture.html?badges`);
    await page.getByTestId('battle-arena').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(800);
    const target = await page.getByTestId('lane-0-player-zone').locator('[data-card-zone="board"]').first().getAttribute('data-instance-id');
    const snapshot = () => page.evaluate(id => {
      const card = document.querySelector(`[data-card-zone="board"][data-instance-id="${CSS.escape(id)}"]`);
      let x = 0, y = 0;
      for (let parent = card; parent; parent = parent.offsetParent) { x += parent.offsetLeft; y += parent.offsetTop; }
      return { x, y, width: card.offsetWidth, height: card.offsetHeight,
        hubHeight: document.querySelector('[data-testid="lane-container-0"] .battle-district-hub').offsetHeight,
        identities: [...document.querySelectorAll('[data-card-zone="board"]')].map(node => node.dataset.instanceId),
        dependency: window.__battleLayoutStore.get(card).getProps().layoutDependency };
    }, target);
    const change = (action, value) => page.evaluate(async ({ action, value, id }) => {
      window.__layoutReads = []; window.__recordLayoutReads = true;
      window.__battleLayoutReview[action](value);
      const transforms = [];
      for (let i = 0; i < 20; i++) {
        await new Promise(requestAnimationFrame);
        transforms.push(document.querySelector(`[data-card-zone="board"][data-instance-id="${CSS.escape(id)}"]`).style.transform);
      }
      window.__recordLayoutReads = false;
      return { reads: window.__layoutReads, transforms };
    }, { action, value, id: target });
    const before = await snapshot();
    const added = await change('badge', 1);
    await page.waitForTimeout(450);
    const withBadge = await snapshot();
    assert.deepEqual(withBadge.identities, before.identities, 'Item geometry changes without replacing or reordering fighters');
    assert.equal(withBadge.hubHeight - before.hubHeight, 44, 'The authored item strip adds exactly44px');
    assert.ok(Math.abs(withBadge.y - before.y) > 1, 'The item strip moves the retained player card');
    assert.notEqual(withBadge.dependency, before.dependency);
    assert.ok(added.reads.includes(target), 'Showing the strip captures the existing card geometry');
    assert.ok(added.transforms.some(value => value && value !== 'none'), 'Showing the strip preserves the existing card spring');
    const updated = await change('badge', 2);
    const withValue = await snapshot();
    assert.equal(withValue.dependency, withBadge.dependency, 'Changing only the item counter keeps the dependency stable');
    assert.deepEqual(updated.reads, [], 'Changing only the item counter does not measure cards');
    assert.equal(withValue.y, withBadge.y);
    const removed = await change('badge', null);
    await page.waitForTimeout(450);
    const after = await snapshot();
    assert.equal(after.hubHeight, before.hubHeight);
    assert.equal(after.y, before.y, 'Removing the strip restores the original card slot');
    assert.equal(after.dependency, before.dependency);
    assert.ok(removed.reads.includes(target), 'Removing the strip captures the retained card geometry');
    assert.ok(removed.transforms.some(value => value && value !== 'none'), 'Removing the strip keeps the return spring');
    const phases = [];
    for (const phase of ['effects', 'player-ready']) {
      const result = await change('phase', phase);
      assert.deepEqual(result.reads, [], 'Phase-only changes still perform zero board or hand geometry reads');
      phases.push({ phase, ...result });
    }
    results.push({ name, viewport, target, before, withBadge, withValue, after, added, updated, removed, phases });
    console.log(`${name}: 44px item strip, unchanged fighters, add/remove spring, stable counter and zero phase reads PASS`);
    await page.close();
  }
  assert.deepEqual(errors, []);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify({ passed: true, results }, null, 2) + '\n');
  console.log(`Evidence: ${output}`);
} finally { await browser.close(); }
