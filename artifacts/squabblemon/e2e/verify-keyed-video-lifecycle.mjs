import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

// Run against a source preview, e.g. PORT=4242 BASE_PATH=/ pnpm dev.
const base = process.env.KEYED_VIDEO_BASE_URL || 'http://127.0.0.1:4242';
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [];
try {
  for (const options of [{ name: 'gpu-video-frame', cpu: false, raf: false }, { name: 'cpu-animation-frame', cpu: true, raf: true }]) {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 }, reducedMotion: 'no-preference' });
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(({ cpu, raf }) => {
      const state = window.__keyed = { videos: [], draws: [], pending: new Set(), playCalls: 0, pauseCalls: 0,
        deferNextPlay: false, deferredPlay: null, visibility: new WeakMap() };
      const NativeIntersectionObserver = window.IntersectionObserver;
      window.IntersectionObserver = class extends NativeIntersectionObserver {
        constructor(callback, options) {
          super((entries, observer) => {
            entries.forEach(entry => state.visibility.set(entry.target, entry.isIntersecting));
            callback(entries, observer);
          }, options);
        }
      };
      const create = document.createElement;
      document.createElement = function (name, options) {
        const element = create.call(this, name, options);
        if (name.toLowerCase() !== 'video') return element;
        state.videos.push(element);
        const play = element.play.bind(element), pause = element.pause.bind(element);
        element.play = () => {
          state.playCalls++;
          if (state.deferNextPlay) {
            state.deferNextPlay = false;
            // Hold the native pending-play boundary until after a pause gate has
            // closed and reopened; browsers reject that interrupted request later.
            return new Promise((resolve, reject) => { state.deferredPlay = { resolve, reject }; });
          }
          return play();
        };
        element.pause = () => { state.pauseCalls++; return pause(); };
        if (raf) Object.defineProperty(element, 'requestVideoFrameCallback', { value: undefined });
        else {
          const request = element.requestVideoFrameCallback.bind(element);
          const cancel = element.cancelVideoFrameCallback.bind(element);
          element.requestVideoFrameCallback = callback => {
            const handle = request((...args) => { state.pending.delete(handle); callback(...args); });
            state.pending.add(handle); return handle;
          };
          element.cancelVideoFrameCallback = handle => { state.pending.delete(handle); cancel(handle); };
        }
        return element;
      };
      if (cpu) {
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
          return /^webgl/.test(kind) ? null : getContext.call(this, kind, ...args);
        };
      }
      const drawImage = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function (source, ...args) {
        const result = drawImage.call(this, source, ...args);
        if (state.videos.includes(source)) state.draws.push({ time: source.currentTime, crop: args,
          width: this.canvas.width, height: this.canvas.height, sourceWidth: source.videoWidth, sourceHeight: source.videoHeight });
        return result;
      };
      // Synthetic visibilitychange exercises the same document gate deterministically;
      // offscreen and OS motion preference checks below use actual browser APIs.
      window.__setKeyedHidden = hidden => {
        if (hidden) Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        else delete document.hidden;
        document.dispatchEvent(new Event('visibilitychange'));
      };
    }, options);
    await page.goto(`${base}/e2e/keyed-video-lifecycle.fixture.html`, { waitUntil: 'networkidle' });
    const canvas = page.locator('canvas.keyed-test');
    await canvas.locator('visible=true').waitFor();
    await page.waitForFunction(() => document.querySelector('canvas')?.dataset.ready === 'true');
    assert.equal(await canvas.getAttribute('data-renderer'), options.cpu ? 'cpu' : 'gpu', options.name);
    await canvas.evaluate(element => { window.__keyedCanvas = element; });
    const snapshot = () => page.evaluate(() => {
      const state = window.__keyed, video = state.videos[0];
      return { count: state.videos.length, time: video.currentTime, paused: video.paused, draws: state.draws.length,
        last: state.draws.at(-1), pending: state.pending.size, src: video.getAttribute('src'),
        handlers: [video.onloadeddata, video.onended, video.onerror].filter(Boolean).length,
        sameCanvas: !document.querySelector('canvas') || window.__keyedCanvas === document.querySelector('canvas'),
        frames: video.getVideoPlaybackQuality().totalVideoFrames };
    });
    const assertCrop = async () => {
      const { last } = await snapshot();
      const [sx, sy, sw, sh, dx, dy, dw, dh] = last.crop;
      const targetRatio = last.width / last.height, sourceRatio = last.sourceWidth / last.sourceHeight;
      const expectedWidth = sourceRatio > targetRatio ? last.sourceHeight * targetRatio : last.sourceWidth;
      const expectedHeight = sourceRatio > targetRatio ? last.sourceHeight : last.sourceWidth / targetRatio;
      const expected = [(last.sourceWidth - expectedWidth) / 2, (last.sourceHeight - expectedHeight) / 2, expectedWidth, expectedHeight, 0, 0, last.width, last.height];
      [sx, sy, sw, sh, dx, dy, dw, dh].forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < .001, `${options.name}: centered cover crop ${index}`));
      assert.ok(last.width <= 160, 'render resolution remains bounded');
    };
    const frozen = async label => {
      await page.waitForFunction(() => window.__keyed.videos[0].paused);
      const before = await snapshot();
      await page.waitForTimeout(220);
      const after = await snapshot();
      assert.ok(Math.abs(after.time - before.time) < .001, `${options.name}: ${label} freezes media time`);
      assert.equal(after.draws, before.draws, `${options.name}: ${label} stops drawing`);
      assert.equal(after.pending, 0, `${options.name}: ${label} cancels frame callbacks`);
    };
    const moving = async label => {
      const before = await snapshot();
      await page.waitForFunction(({ time, draws }) => {
        const state = window.__keyed, video = state.videos[0];
        return !video.paused && video.currentTime !== time && state.draws.length > draws;
      }, before);
      const after = await snapshot();
      assert.equal(after.count, 1, `${options.name}: ${label} reuses detached media`);
      assert.ok(after.sameCanvas, `${options.name}: ${label} reuses canvas`);
    };
    await frozen('paused at mount');
    await assertCrop();
    const first = await snapshot();
    assert.equal(first.draws, 1, 'paused mount draws the original first frame exactly once');
    await page.evaluate(() => { for (let i = 0; i < 4; i++) window.__keyed.videos[0].dispatchEvent(new Event('loadeddata')); });
    assert.equal((await snapshot()).draws, first.draws, 'unchanged first frame is not uploaded repeatedly');
    await page.getByRole('button', { name: 'Change aspect' }).click();
    await page.waitForFunction(() => document.querySelector('canvas')?.height === 160);
    await assertCrop();
    const beforeHiddenResize = await snapshot();
    await page.evaluate(() => window.__setKeyedHidden(true));
    await page.getByRole('button', { name: 'Change aspect' }).click();
    await page.waitForFunction(() => document.querySelector('canvas')?.height === 90);
    assert.equal((await snapshot()).draws, beforeHiddenResize.draws, 'hidden resize does not upload a frame');
    await page.evaluate(() => window.__setKeyedHidden(false));
    await page.waitForFunction(draws => window.__keyed.draws.length > draws, beforeHiddenResize.draws);
    await frozen('paused still restored after hidden resize');
    await assertCrop();
    for (let cycle = 0; cycle < 2; cycle++) {
      await page.getByRole('button', { name: 'Resume', exact: true }).click(); await moving(`resume ${cycle}`);
      await page.getByRole('button', { name: 'Pause', exact: true }).click(); await frozen(`pause ${cycle}`);
    }
    for (const gate of ['paused prop', 'offscreen']) {
      await page.evaluate(() => { window.__keyed.deferNextPlay = true; });
      await page.getByRole('button', { name: 'Resume', exact: true }).click();
      await page.waitForFunction(() => window.__keyed.deferredPlay !== null);
      if (gate === 'paused prop') {
        await page.getByRole('button', { name: 'Pause', exact: true }).click();
        await page.getByRole('button', { name: 'Resume', exact: true }).click();
      } else {
        await page.getByRole('button', { name: 'Move offscreen' }).click();
        await page.waitForFunction(() => window.__keyed.visibility.get(document.querySelector('canvas')) === false);
        await page.getByRole('button', { name: 'Show', exact: true }).click();
        await page.waitForFunction(() => window.__keyed.visibility.get(document.querySelector('canvas')) === true);
      }
      await page.evaluate(() => {
        const deferred = window.__keyed.deferredPlay;
        window.__keyed.deferredPlay = null;
        deferred.reject(new DOMException('The play() request was interrupted by a call to pause().', 'AbortError'));
      });
      await moving(`${gate} reopens before interrupted play rejects`);
      assert.equal(await page.getByTestId('ended').textContent(), '0', `${options.name}: stale ${gate} rejection does not finish the effect`);
      await page.getByRole('button', { name: 'Pause', exact: true }).click(); await frozen(`after ${gate} pending-play race`);
    }
    await page.getByRole('button', { name: 'Resume', exact: true }).click(); await moving('before offscreen');
    await page.getByRole('button', { name: 'Move offscreen' }).click(); await frozen('offscreen');
    await page.getByRole('button', { name: 'Show', exact: true }).click(); await moving('back onscreen');
    await page.emulateMedia({ reducedMotion: 'reduce' }); await frozen('OS reduced motion');
    await page.emulateMedia({ reducedMotion: 'no-preference' }); await moving('OS preference restored');
    for (const attribute of ['reduceMotion', 'reducedMotion']) {
      await page.evaluate(key => { document.documentElement.dataset[key] = 'true'; }, attribute); await frozen(attribute);
      await page.evaluate(key => { delete document.documentElement.dataset[key]; }, attribute); await moving(`${attribute} cleared`);
    }
    await page.evaluate(() => window.__setKeyedHidden(true)); await frozen('document hidden');
    await page.evaluate(() => window.__setKeyedHidden(false)); await moving('document visible');
    const sampleBefore = await snapshot();
    await page.waitForTimeout(500);
    const sampleAfter = await snapshot();
    await page.getByRole('button', { name: 'Unmount', exact: true }).click();
    await canvas.waitFor({ state: 'detached' });
    const cleaned = await snapshot();
    assert.equal(cleaned.src, null, 'cleanup releases detached media source');
    assert.equal(cleaned.handlers, 0, 'cleanup removes media handlers');
    await frozen('unmounted');
    assert.equal(await page.getByTestId('ended').textContent(), '0', 'visibility and pause do not signal a completed effect');
    assert.deepEqual(errors, [], `${options.name}: no browser errors`);
    reports.push({ renderer: options.name, lifecycle: 'pass', sampleMilliseconds: 500,
      sampleDraws: sampleAfter.draws - sampleBefore.draws, sampleDecodedFrames: sampleAfter.frames - sampleBefore.frames });
    await page.close();
  }
  console.log(JSON.stringify({ result: 'PASS', reports }, null, 2));
} finally { await browser.close(); }
