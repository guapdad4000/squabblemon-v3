import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const origin = (process.env.UI_ORIGIN ?? 'http://127.0.0.1:4242').replace(/\/$/, '');
const browser = await chromium.launch({ headless: true });
const errors = [];
const report = [];
const reportPath = process.env.LAYOUT_REPORT ?? 'screenshots/battle-performance/layout-regression.json';
const frames = (page, count = 3) => page.evaluate(async count => {
  for (let i = 0; i < count; i++) await new Promise(requestAnimationFrame);
}, count);
const mutate = (page, action, arg, target) => page.evaluate(async ({ action, arg, target }) => {
  window.__layoutReads = [];
  window.__recordLayoutReads = true;
  window.__battleLayoutReview[action](arg);
  const transforms = [];
  for (let i = 0; i < 20; i++) {
    await new Promise(requestAnimationFrame);
    if (target) transforms.push(document.querySelector(`[data-card-zone="board"][data-instance-id="${CSS.escape(target)}"]`)?.style.transform);
  }
  window.__recordLayoutReads = false;
  return { reads: window.__layoutReads, transforms };
}, { action, arg, target });
const board = (page, id) => page.locator(`[data-card-zone="board"][data-instance-id="${id}"]`);
const footprint = locator => locator.evaluate(node => {
  let x = 0, y = 0;
  for (let parent = node; parent; parent = parent.offsetParent) { x += parent.offsetLeft; y += parent.offsetTop; }
  return { x, y, width: node.offsetWidth, height: node.offsetHeight };
});
const moving = samples => samples.some(value => value && value !== 'none' && /translate|scale/.test(value));

try {
  for (const [name, viewport] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 1000 }]]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'no-preference' });
    const page = await context.newPage();
    await page.routeWebSocket('**', socket => socket.close());
    const resultRecord = { name, viewport, phases: [], inspections: [] };
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const rect = Element.prototype.getBoundingClientRect;
      Element.prototype.getBoundingClientRect = function () {
        if (window.__recordLayoutReads && this.matches('[data-card-zone="board"],[data-card-zone="hand"]')) {
          window.__layoutReads.push({ zone: this.dataset.cardZone, id: this.dataset.instanceId });
        }
        return rect.call(this);
      };
    });
    await page.goto(`${origin}/e2e/battle-layout-regression.fixture.html`);
    await page.getByTestId('battle-arena').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(800);
    const target = await page.getByTestId('lane-0-player-zone').locator('[data-card-zone="board"]').nth(2).getAttribute('data-instance-id');
    const unchanged = await footprint(board(page, target));
    for (const phase of ['effects', 'player-ready']) {
      const result = await mutate(page, 'phase', phase);
      resultRecord.phases.push({ phase, reads: result.reads });
      assert.equal(result.reads.filter(read => read.zone === 'hand').length, 0, `${name}: a phase-only board update must not measure the hand`);
      const counts = Object.values(Object.groupBy(result.reads.filter(read => read.zone === 'board'), read => read.id)).map(reads => reads.length);
      assert.ok(counts.every(count => count <= 1), `${name}: phase changes must not cascade repeated peer measurements: ${JSON.stringify(counts)}`);
    }
    assert.deepEqual(await footprint(board(page, target)), unchanged, 'Phase-only transitions preserve the exact card footprint');

    const added = await mutate(page, 'add', 'player', target);
    assert.ok(added.reads.some(read => read.id === target), 'Adding a fourth card measures the retained third card');
    assert.ok(moving(added.transforms), 'The third card keeps its spring when the centered last slot becomes a full row');
    await page.waitForTimeout(500);
    const fourSlot = await footprint(board(page, target));
    assert.ok(Math.abs(fourSlot.x - unchanged.x) > 10, 'The retained third card reaches its new CSS slot');
    assert.ok(Math.abs(fourSlot.width - unchanged.width) < 1 && Math.abs(fourSlot.height - unchanged.height) < 1, 'Reflow preserves card dimensions');
    const removed = await mutate(page, 'removeLast', null, target);
    assert.ok(moving(removed.transforms), 'Removing the fourth card preserves the return spring');
    await page.waitForTimeout(500);
    assert.ok(Math.abs((await footprint(board(page, target))).x - unchanged.x) < 1, 'The third card returns to its centered slot');
    const reordered = await mutate(page, 'reverse', null, target);
    assert.ok(reordered.reads.some(read => read.id === target) && moving(reordered.transforms), 'Same-count reorder measures and animates retained cards');
    await page.waitForTimeout(500);

    await mutate(page, 'add', 'cpu');
    const fifth = await mutate(page, 'add', 'cpu', target);
    assert.ok(fifth.reads.some(read => read.id === target), 'An opposing crowded crew also measures retained player geometry');
    assert.equal(await page.getByTestId('lane-0-cpu-zone').locator('.battle-formation-stack').getAttribute('data-inspectable'), 'true', 'The opposing fifth card exposes the existing inspector footer');

    // Real inspector outside the board group must still share the global card id.
    const inspect = async (expectSharedId, label, duringReflow = false) => {
      await board(page, target).scrollIntoViewIfNeeded();
      await page.mouse.move(0, 0);
      await frames(page, 3);
      const result = await page.evaluate(async ({ id, duringReflow }) => {
        const source = document.querySelector(`[data-card-zone="board"][data-instance-id="${CSS.escape(id)}"]`);
        const sourceVisual = window.__battleLayoutStore.get(source);
        const sourceProjection = sourceVisual.projection;
        const sourceId = sourceVisual.getProps().layoutId ?? null;
        source.click();
        if (duringReflow) window.__battleLayoutReview.reverse();
        const values = [], parentValues = [];
        let sharedStack = false;
        for (let i = 0; i < 20; i++) {
          await new Promise(requestAnimationFrame);
          const card = document.querySelector('[data-testid="card-inspector"]');
          if (card) {
            values.push(card.style.transform);
            parentValues.push(card.closest('.card-inspector-layout').style.transform);
            const projection = window.__battleLayoutStore.get(card).projection;
            sharedStack ||= projection.getStack() === sourceProjection.getStack() && projection.options.layoutId === sourceId;
          }
        }
        return { sourceId, values, parentValues, sharedStack };
      }, { id: target, duringReflow });
      await page.getByTestId('card-inspector').waitFor();
      resultRecord.inspections.push({ label, duringReflow, ...result });
      assert.equal(result.sourceId, expectSharedId ? `battle-inspect-${target}` : null, `${label}: the board retains its existing phase inspection gate`);
      if (expectSharedId) assert.equal(result.sharedStack, true, `${label}: the source and real inspector retain their shared unprefixed projection id`);
      assert.ok(moving(result.parentValues), `${label}: the real inspector keeps its authored entrance`);
      // A plain click can open outside Motion's snapshot transaction in both the
      // original and optimized board. A concurrent real reflow exercises the
      // shared morph itself rather than mistaking that baseline behavior for loss.
      if (duringReflow) assert.ok(moving(result.values), `${label}: the real inspector preserves its shared card morph during a board reflow`);
      await page.getByTestId('button-close-inspector').click();
      await page.getByTestId('card-inspector').waitFor({ state: 'detached' });
      await page.waitForTimeout(450);
      assert.ok(await board(page, target).isVisible(), `${label}: the source card remains available after closing`);
    };
    await inspect(true, `${name} ready`);
    await inspect(true, `${name} reflow`, true);
    await page.setViewportSize(name === 'phone' ? { width: 844, height: 390 } : { width: 900, height: 1280 });
    await page.waitForTimeout(400);
    await inspect(true, `${name} after resize`, true);
    await mutate(page, 'phase', 'effects');
    await inspect(false, `${name} effects`);
    await mutate(page, 'phase', 'player-ready');
    await inspect(true, `${name} ready again`, true);
    resultRecord.passed = true;
    report.push(resultRecord);
    console.log(`${name}: isolated phase measurements, reflow/removal/reorder/crowding springs and real inspector phase/resize transitions PASS`);
    await context.close();
  }
  assert.deepEqual(errors, [], 'Browser runtime errors');
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify({ passed: true, checks: report }, null, 2) + '\n');
  console.log(`Evidence: ${reportPath}`);
} finally { await browser.close(); }
