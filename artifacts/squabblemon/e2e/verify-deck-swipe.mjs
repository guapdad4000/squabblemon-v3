import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const origin = process.env.PARITY_ORIGIN || 'http://127.0.0.1:4242';
const output = process.env.PARITY_OUTPUT || '/tmp/squabblemon-deck-swipe';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.routeWebSocket('**', socket => socket.close());
  const imageRequests = [];
  page.on('request', request => { if (request.resourceType() === 'image') imageRequests.push(request.url()); });
  let release;
  const imagesReady = new Promise(resolve => { release = resolve; });
  await page.route('**/*', async route => { if (route.request().resourceType() === 'image') await imagesReady; await route.continue(); });
  await page.goto(`${origin}/e2e/deck-swipe.fixture.html?compact`, { waitUntil: 'domcontentloaded' });
  const rail = page.locator('.compact-deck-picker__rail');
  await rail.waitFor();
  await page.evaluate(() => document.fonts.ready);
  const measure = () => rail.evaluate(element => ({ width: element.clientWidth, scrollWidth: element.scrollWidth, height: element.clientHeight, tiles: [...element.children].map(child => ({ width: child.clientWidth, height: child.clientHeight, imageWidth: child.querySelector('img').clientWidth, imageHeight: child.querySelector('img').clientHeight })) }));
  const before = await measure();
  await page.evaluate(() => { window.__coverImages = [...document.querySelectorAll('.compact-deck-picker img')]; });
  assert.ok(await rail.locator('img').evaluateAll(images => images.every(image => !image.complete && !image.draggable)), 'Delayed art has no native drag ghost');
  const initial = await page.getByTestId('selected').textContent();
  const cdp = await page.context().newCDPSession(page);
  const b = await rail.boundingBox();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x + b.width - 25, y: b.y + b.height / 2 }] });
  for (let i = 1; i <= 14; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: b.x + b.width - 25 - i * (b.width - 60) / 14, y: b.y + b.height / 2 }] });
    await page.waitForTimeout(16);
    if (i === 7) release();
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(600);
  await page.waitForFunction(() => [...document.querySelectorAll('.compact-deck-picker img')].every(image => image.complete && image.naturalWidth));
  assert.ok(await page.evaluate(() => [...document.querySelectorAll('.compact-deck-picker img')].every((image, index) => image === window.__coverImages[index])), 'Swiping retains the original cover nodes');
  assert.equal(imageRequests.length, 5);
  assert.equal(new Set(imageRequests).size, 5, 'Each retained mini cover is requested only once');
  assert.deepEqual(await measure(), before, 'Late artwork never changes rail or tile geometry');
  const scroll = await rail.evaluate(element => element.scrollLeft);
  assert.ok(scroll > 150, `Real touch gesture scrolls the mini selector: ${scroll}`);
  assert.equal(await page.getByTestId('selected').textContent(), initial, 'Swiping never selects or opens a deck');
  assert.equal(await rail.locator('.compact-deck-picker__box').evaluateAll(boxes => boxes.every(box => box.querySelectorAll('img').length === 1)), true);
  assert.equal(await page.locator('.compact-deck-picker__edge').first().evaluate(element => getComputedStyle(element).backdropFilter), 'none');
  await page.screenshot({ path: `${output}/compact-touch-delayed-art.png` });
  results.push({ case: 'compact-touch-delayed-art', geometry: before, scroll, selectionUnchanged: true, imagesPerCover: 1, retainedImageNodes: 5, imageRequests: imageRequests.length });
  await page.close();

  const showcase = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await showcase.routeWebSocket('**', socket => socket.close());
  // Exercise the real renderer on software WebGL even when GPU detection would
  // choose the static fallback for this headless environment.
  await showcase.route('**/src/lib/gpuQuality.ts', route => route.fulfill({ contentType: 'text/javascript', body: 'export async function detectGPUQuality(){return {tier:"low",pixelRatio:1,fps:30}}' }));
  await showcase.goto(`${origin}/e2e/deck-swipe.fixture.html`, { waitUntil: 'domcontentloaded' });
  await showcase.waitForFunction(() => document.querySelectorAll('.deck-box[data-rendered="true"]').length === 1);
  await showcase.evaluate(() => {
    window.__swipe = { added: 0, removed: 0, dragging: false, duringDrag: [], doubleCovers: 0, frames: 0 };
    new MutationObserver(records => {
      for (const record of records) for (const [key, nodes] of [['added', record.addedNodes], ['removed', record.removedNodes]]) for (const node of nodes) if (node instanceof HTMLCanvasElement) {
        window.__swipe[key]++;
        if (window.__swipe.dragging) window.__swipe.duringDrag.push(key);
      }
    }).observe(document.querySelector('.deck-carousel'), { childList: true, subtree: true });
    const check = () => {
      window.__swipe.frames++;
      for (const host of document.querySelectorAll('.deck-box')) {
        const print = host.querySelector('.deck-box__print'), canvas = host.querySelector('canvas');
        if (canvas && getComputedStyle(canvas).visibility === 'visible' && getComputedStyle(print).visibility === 'visible') window.__swipe.doubleCovers++;
      }
      window.__swipe.frame = requestAnimationFrame(check);
    }; check();
  });
  for (let i = 0; i < 3; i++) {
    const viewport = await showcase.locator('.deck-carousel__viewport').boundingBox();
    await showcase.mouse.move(viewport.x + viewport.width * .8, viewport.y + viewport.height * .65);
    await showcase.evaluate(() => { window.__swipe.dragging = true; });
    await showcase.mouse.down();
    await showcase.mouse.move(viewport.x + viewport.width * .2, viewport.y + viewport.height * .65, { steps: 20 });
    await showcase.mouse.up();
    await showcase.evaluate(() => { window.__swipe.dragging = false; });
    await showcase.waitForFunction(() => !!document.querySelector('.deck-carousel__slide[aria-hidden="false"] .deck-box[data-rendered="true"]'), undefined, { timeout: 15000 });
  }
  const state = await showcase.evaluate(() => {
    cancelAnimationFrame(window.__swipe.frame);
    return { ...window.__swipe, selected: document.querySelector('[data-testid="selected"]').textContent, canvases: document.querySelectorAll('.deck-box canvas').length, activeRendered: !!document.querySelector('.deck-carousel__slide[aria-hidden="false"] .deck-box[data-rendered="true"]') };
  });
  console.log('handoff sample', JSON.stringify(state));
  await showcase.screenshot({ path: `${output}/deck-handoff.png` });
  assert.deepEqual(state.duringDrag, [], 'No renderer mounts or disposals during the drag');
  assert.equal(state.doubleCovers, 0, 'Canvas and print are mutually exclusive on every sampled frame');
  assert.equal(state.canvases, 1); assert.equal(state.activeRendered, true);
  assert.equal(state.added, 3); assert.equal(state.removed, 3);
  assert.equal(await showcase.getByTestId('opened').textContent(), '', 'Swipe does not open the editor');
  // Context loss must reveal one print, never the stale canvas underneath it.
  await showcase.locator('.deck-box[data-rendered="true"] canvas').evaluate(canvas => canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
  const fallback = await showcase.locator('.deck-carousel__slide[aria-hidden="false"] .deck-box').evaluate(host => ({ print: getComputedStyle(host.querySelector('.deck-box__print')).visibility, canvas: getComputedStyle(host.querySelector('canvas')).visibility }));
  assert.deepEqual(fallback, { print: 'visible', canvas: 'hidden' });
  await showcase.screenshot({ path: `${output}/deck-settled-fallback.png` });
  results.push({ case: 'showcase-renderer-handoff', ...state, fallback });
  await showcase.locator('.deck-carousel__viewport').focus();
  await showcase.keyboard.press('Home');
  await showcase.waitForTimeout(1100);
  await showcase.locator('.deck-carousel__slide[aria-hidden="false"] [data-testid="deck-cover"]').click();
  assert.equal(await showcase.getByTestId('opened').textContent(), initial, 'Keyboard selection still opens its selected deck');
  console.log(JSON.stringify(results));
} finally { await writeFile(`${output}/deck-swipe.json`, JSON.stringify(results, null, 2)); await browser.close(); }
