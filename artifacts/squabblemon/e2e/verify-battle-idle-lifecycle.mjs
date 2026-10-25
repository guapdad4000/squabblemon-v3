import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const origin = process.env.BATTLE_IDLE_ORIGIN || 'http://127.0.0.1:4339';
const output = process.env.BATTLE_IDLE_OUTPUT || '/tmp/battle-idle-lifecycle';
const basePath = process.env.BATTLE_IDLE_BASE_PATH || '/';
await mkdir(output, { recursive: true });
const results = [];
const report = () => writeFile(`${output}/results.json`, JSON.stringify({
  scope: 'Synthetic production thermal harness; CSS lifecycle, retained formations, artwork and interactions. Not a performance or physical-device measurement. Finite effect checks explicitly exercise the production CSS cascade; thermal commit is a noop.',
  origin, results,
}, null, 2));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE || process.env.CHROMIUM_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
let page, label;

// Clip against the scroll owners as well as the viewport. A bounding rectangle
// alone would incorrectly classify retained rows beneath a formation as visible.
function snapshot() {
  const visible = element => {
    const b = element.getBoundingClientRect();
    let left = Math.max(0, b.left), top = Math.max(0, b.top), right = Math.min(innerWidth, b.right), bottom = Math.min(innerHeight, b.bottom);
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent), p = parent.getBoundingClientRect();
      if (/auto|scroll|hidden|clip/.test(style.overflowX)) { left = Math.max(left, p.left); right = Math.min(right, p.right); }
      if (/auto|scroll|hidden|clip/.test(style.overflowY)) { top = Math.max(top, p.top); bottom = Math.min(bottom, p.bottom); }
    }
    return right - left > 2 && bottom - top > 2;
  };
  return [...document.querySelectorAll('.battle-card-stack > .battle-board-card')].map(card => {
    const css = getComputedStyle(card), names = css.animationName.split(',').map(value => value.trim());
    const index = names.findIndex(name => name.startsWith('idle-breathe-'));
    return { id: card.dataset.instanceId, visible: visible(card), animation: css.animationName,
      idle: index >= 0, state: css.animationPlayState.split(',')[Math.max(0, index)].trim(),
      idleState: css.getPropertyValue('--battle-idle-play-state').trim(), promotion: css.willChange };
  });
}
async function visit(count) {
  await page.goto(`${origin}${basePath}?__battle_perf=1&thermal&count=${count}`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('battle-thermal-harness').waitFor();
  await page.waitForFunction(() => window.__battleThermal?.ready, null, { polling: 100 });
  await page.waitForFunction(() => [...document.querySelectorAll('.battle-board-card')].every(card => card.style.getPropertyValue('--battle-idle-play-state')), null, { polling: 100 });
  await page.evaluate(async () => {
    await Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 3000))]);
  });
  await page.mouse.move(0, 0);
  await page.waitForTimeout(250);
}
async function retained(expected) {
  const actual = await page.evaluate(() => ({
    source: window.__battleThermal.cards,
    rendered: [...document.querySelectorAll('.battle-card-stack > .battle-board-card')].map(card => card.dataset.instanceId),
  }));
  assert.equal(actual.rendered.length, expected);
  assert.deepEqual([...actual.rendered].sort(), [...actual.source].sort(), 'every authored synthetic fighter remains mounted exactly once');
  return expected;
}
async function settledVisibility() {
  await page.waitForFunction(() => [...document.querySelectorAll('.battle-board-card')].some(card => card.style.getPropertyValue('--battle-idle-play-state') === 'running'), null, { polling: 100 });
  const cards = await page.evaluate(snapshot);
  const visible = cards.filter(card => card.visible && card.idle), clipped = cards.filter(card => !card.visible && card.idle);
  assert.ok(visible.length > 0, 'visible tied fighters retain breathing');
  assert.ok(clipped.length > 0, 'crowded retained rows exercise clipping');
  assert.ok(visible.every(card => card.state === 'running' && card.idleState === 'running'), JSON.stringify(visible));
  assert.ok(clipped.every(card => card.state === 'paused' && card.idleState === 'paused'), JSON.stringify(clipped));
  assert.ok(cards.every(card => card.promotion === 'auto'), 'settled cards retain no permanent will-change promotion');
  return { visible: visible.length, clipped: clipped.length };
}
async function geometry() {
  const bounds = await page.evaluate(() => {
    const action = document.querySelector('.battle-primary-action'), b = action.getBoundingClientRect();
    return { pageWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth, viewportHeight: innerHeight,
      action: { top: b.top, bottom: b.bottom, left: b.left, right: b.right, width: b.width, height: b.height, disabled: action.disabled } };
  });
  assert.ok(bounds.pageWidth <= bounds.viewportWidth + 1, `No horizontal page overflow: ${JSON.stringify(bounds)}`);
  assert.ok(bounds.action.top >= -1 && bounds.action.bottom <= bounds.viewportHeight + 1 && bounds.action.height >= 44, `Action stays reachable: ${JSON.stringify(bounds)}`);
  assert.ok(bounds.action.left >= -1 && bounds.action.right <= bounds.viewportWidth + 1);
  return bounds;
}
async function cssCascade() {
  const probes = await page.evaluate(() => {
    const card = [...document.querySelectorAll('.battle-board-card')].find(node => node.style.getPropertyValue('--battle-idle-play-state') === 'paused');
    const original = card.className, originalStyle = card.getAttribute('style');
    const result = [];
    try {
      for (const [name, classes] of [
        ['leading', 'is-leading'], ['trailing', 'is-trailing'],
        ['source-impact', 'effect-source beat-impact'], ['target-impact', 'effect-target beat-impact'],
        ['reveal', 'card-reveal-flip'],
      ]) {
        card.className = `${original} ${classes}`;
        card.style.setProperty('--battle-idle-play-state', 'paused');
        const css = getComputedStyle(card);
        result.push({ name, animation: css.animationName, state: css.animationPlayState, iterations: css.animationIterationCount, idleState: css.getPropertyValue('--battle-idle-play-state').trim() });
      }
    } finally {
      card.className = original;
      if (originalStyle === null) card.removeAttribute('style'); else card.setAttribute('style', originalStyle);
    }
    return result;
  });
  const expected = { leading: 'lean-into-lead', trailing: 'lean-out-of-lead', 'source-impact': 'source-settle', 'target-impact': 'target-recoil', reveal: 'reveal-front' };
  for (const probe of probes) {
    assert.equal(probe.animation, expected[probe.name], `${probe.name}: authored animation remains selected`);
    assert.equal(probe.state, 'running', `${probe.name}: idle gating must not pause finite motion`);
    assert.equal(probe.iterations, '1');
    assert.equal(probe.idleState, 'paused');
  }
  return probes;
}
async function scrollAllStacks() {
  const result = [];
  for (const owner of ['cpu', 'player']) for (let lane = 0; lane < 3; lane++) {
    const stack = page.getByTestId(`lane-${lane}-${owner}-zone`).locator('.battle-card-stack');
    await stack.scrollIntoViewIfNeeded();
    assert.equal(await stack.locator(':scope > .battle-board-card').count(), 12);
    const first = stack.locator(':scope > .battle-board-card').first(), last = stack.locator(':scope > .battle-board-card').last();
    await stack.evaluate(element => { element.scrollTop = element.scrollHeight; });
    await page.waitForFunction(id => {
      const node = [...document.querySelectorAll('.battle-board-card')].find(card => card.dataset.instanceId === id);
      return node?.style.getPropertyValue('--battle-idle-play-state') === 'running';
    }, await last.getAttribute('data-instance-id'), { polling: 100 });
    assert.equal(await first.evaluate(element => getComputedStyle(element).animationPlayState), 'paused', 'the initial row pauses once fully clipped');
    const end = await stack.evaluate(element => ({ top: element.scrollTop, max: element.scrollHeight - element.clientHeight }));
    assert.ok(end.top >= end.max - 2 && end.top > 0);
    await stack.evaluate(element => { element.scrollTop = 0; });
    await page.waitForFunction(id => {
      const node = [...document.querySelectorAll('.battle-board-card')].find(card => card.dataset.instanceId === id);
      return node?.style.getPropertyValue('--battle-idle-play-state') === 'running';
    }, await first.getAttribute('data-instance-id'), { polling: 100 });
    assert.equal(await last.evaluate(element => getComputedStyle(element).animationPlayState), 'paused');
    result.push({ lane, owner, endScrollTop: end.top, initialRowResumed: true });
  }
  return result;
}
async function inspectAndSelect() {
  const opener = page.getByTestId('lane-2-player-zone').locator('.formation-expand');
  await opener.click();
  const district = page.getByRole('dialog', { name: /district view/i });
  await district.waitFor();
  assert.equal(await district.locator('[data-card-zone="board"]').count(), 24);
  await district.locator('[data-card-zone="board"]').last().click();
  const close = page.getByTestId('button-close-inspector');
  await close.waitFor();
  const inspector = page.locator('dialog.card-inspector-shell[open]');
  assert.ok(await inspector.locator('.collector-card--inspector').isVisible());
  await page.screenshot({ path: `${output}/${label}-inspector.png`, timeout: 15000 });
  await close.click(); await close.waitFor({ state: 'hidden' });
  await page.keyboard.press('Escape'); await district.waitFor({ state: 'hidden' });
  assert.ok(await opener.evaluate(element => element === document.activeElement), 'district close restores focus');
  await retained(72);
  await page.locator('[data-card-zone="hand"]').first().click();
  await page.getByTestId('lane-0').click();
  await page.getByTestId('button-lock').waitFor();
  assert.equal(await page.getByTestId('button-lock').isDisabled(), false, 'selected fighter and lane expose the live primary action');
  await geometry();
  return { districtCards: 24, finalFighterInspected: true, focusReturned: true, selectedActionEnabled: true, commitNotExercised: 'thermal harness commit is noop' };
}

try {
  for (const [width, height] of [[390, 844], [320, 568], [844, 390], [1440, 1000]]) {
    label = `${width}x${height}`;
    page = await browser.newPage({ viewport: { width, height }, isMobile: width < 600, hasTouch: width < 900, reducedMotion: 'no-preference' });
    page.setDefaultTimeout(12000);
    await page.routeWebSocket('**', socket => socket.close());
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await visit(24);
    const count = await retained(72), bounds = await geometry(), visibility = await settledVisibility();
    const cascade = await cssCascade(), scrolling = await scrollAllStacks();
    await page.locator('.battlefield-grid').evaluate(element => { element.scrollTop = 0; });
    await page.screenshot({ path: `${output}/${label}-crowded.png`, timeout: 15000 });
    const interaction = await inspectAndSelect();
    assert.deepEqual(errors, []);
    results.push({ case: label, result: 'pass', count, bounds, visibility, cascade, scrolling, interaction, errors });
    await report(); console.log(`PASS ${label}: 72 retained, idle visibility, finite CSS, scrolling, inspection and action`);
    if (width === 390) {
      await visit(10); await retained(10);
      await page.waitForFunction(() => [...document.querySelectorAll('.battle-board-card .collector-portrait')].every(image => image.complete && image.naturalWidth > 0), null, { polling: 100 });
      const art = await page.locator('.battle-board-card').evaluateAll(cards => cards.map(card => ({
        id: card.dataset.instanceId, portrait: card.querySelector('.collector-portrait').getAttribute('src'),
        foil: !!card.querySelector('.collector-foil'), grain: !!card.querySelector('.collector-foil-grain'), glare: !!card.querySelector('.collector-glare'),
        frameClip: getComputedStyle(card.querySelector('.collector-frame')).clipPath,
      })));
      assert.ok(art.every(card => card.portrait && card.foil && card.grain && card.glare && card.frameClip.startsWith('polygon(')));
      await page.screenshot({ path: `${output}/${label}-ten-card-art.png`, timeout: 15000 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(() => [...document.querySelectorAll('.battle-board-card')].every(card => getComputedStyle(card).animationName === 'none' && card.style.getPropertyValue('--battle-idle-play-state') === 'paused'), null, { polling: 100 });
      await retained(10); await geometry();
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.waitForFunction(() => [...document.querySelectorAll('.battle-board-card')].some(card => getComputedStyle(card).animationName.startsWith('idle-breathe') && getComputedStyle(card).animationPlayState === 'running'), null, { polling: 100 });
      await page.evaluate(() => { document.documentElement.dataset.reduceMotion = 'true'; });
      await page.waitForFunction(() => [...document.querySelectorAll('.battle-board-card')].every(card => getComputedStyle(card).animationName === 'none' && card.style.getPropertyValue('--battle-idle-play-state') === 'paused'), null, { polling: 100 });
      await page.evaluate(() => { delete document.documentElement.dataset.reduceMotion; });
      await page.waitForFunction(() => [...document.querySelectorAll('.battle-board-card')].some(card => getComputedStyle(card).animationName.startsWith('idle-breathe') && getComputedStyle(card).animationPlayState === 'running'), null, { polling: 100 });
      const restored = await page.locator('.battle-board-card .collector-portrait').evaluateAll(images => images.map(image => image.getAttribute('src')));
      assert.deepEqual(restored, art.map(card => card.portrait), 'preference changes retain the same portrait assets');
      results.push({ case: '390x844-ten-card-art-and-preferences', result: 'pass', count: 10, art, osReducedAndRestored: true, appReducedAndRestored: true });
      await report(); console.log('PASS 390x844: ten-card artwork/foil, OS/app reduced motion and restoration');
    }
    await page.close(); page = undefined;
  }
} catch (error) {
  results.push({ case: label, result: 'failed', error: String(error), stack: error.stack });
  await report();
  await page?.screenshot({ path: `${output}/${label}-failure.png`, timeout: 10000 }).catch(() => {});
  throw error;
} finally { await browser.close(); }
