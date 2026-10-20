import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';

// Frozen from 6e8e9b4 (the verified sparse representation of remote 56f48cd).
// Exercise the actual before/after React components, not a reimplementation of
// their geometry or scheduler. The page is entirely offline and contains no media.
const reference = new URL('../src/components/__fixtures__/BattleTargetLine.baseline.tsx.txt', import.meta.url);
const baseline = readFileSync(reference, 'utf8');
const expectedHash = '4f307ddf5a5fbb34c5e75e0c8fd082d939237446b16de275d3d9fcd10a48eaff';
const fixtureRoot = fileURLToPath(new URL('..', import.meta.url));
const bundle = await build({
  write: false,
  bundle: true,
  format: 'iife',
  platform: 'browser',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  stdin: {
    resolveDir: fixtureRoot,
    loader: 'tsx',
    contents: `
      import { createRoot } from 'react-dom/client';
      import { flushSync } from 'react-dom';
      import { BattleTargetLine as current } from './src/components/BattleTargetLine';
      import { BattleTargetLine as reference } from 'frozen-target-line-baseline';
      let root, Component, props;
      function render() {
        return <div data-testid="battle-arena" style={{ position: 'relative', width: '100%', height: 560 }}>
          <div data-testid="lane-0" style={{ position: 'absolute', left: '8%', top: 20, width: '38%', height: 230 }} />
          <div data-testid="lane-1" style={{ position: 'absolute', left: '54%', top: 20, width: '38%', height: 230 }} />
          <div data-testid="hand-tray" style={{ position: 'absolute', left: '5%', top: 340, width: '90%', height: 180, overflow: 'hidden' }}>
            <div data-instance-id={props.instanceId} style={{ position: 'absolute', left: 32, top: 24, width: 96, height: 130 }} />
          </div>
          <Component {...props} />
        </div>;
      }
      window.targetLineFixture = {
        mount(version, initialProps) {
          Component = version === 'reference' ? reference : current;
          props = initialProps;
          root = createRoot(document.getElementById('fixture-root'));
          flushSync(() => root.render(render()));
        },
        update(nextProps) { props = nextProps; flushSync(() => root.render(render())); },
        unmount() { flushSync(() => root.unmount()); },
      };
    `,
  },
  plugins: [{
    name: 'frozen-target-line-baseline',
    setup(builder) {
      builder.onResolve({ filter: /^frozen-target-line-baseline$/ }, () => ({ path: fileURLToPath(reference), namespace: 'reference' }));
      builder.onLoad({ filter: /.*/, namespace: 'reference' }, () => ({ contents: baseline, loader: 'tsx', resolveDir: fixtureRoot }));
    },
  }],
});

async function runScenario(browser, version, viewport) {
  const page = await browser.newPage({ viewport });
  // No networking is needed or permitted by this fixture.
  await page.route('**/*', route => route.abort());
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<!doctype html><html><body style="margin:0"><div id="fixture-root"></div></body></html>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const result = await page.evaluate((version) => {
    let now = 0, nextFrame = 1, nextObserver = 1, hidden = false;
    let svgQueries = 0, pathLists = 0;
    const trace = [], frames = [], pending = new Map(), observers = new Set(), activeListeners = new Set();
    function label(target) {
      if (target === window) return 'window';
      if (target === document) return 'document';
      return target.getAttribute?.('data-testid') ?? (target.hasAttribute?.('data-instance-id') ? 'source' : null);
    }
    function tracked(target, type) {
      return (target === window && type === 'resize') || (target === document && type === 'visibilitychange')
        || (label(target) === 'battle-arena' && type === 'scroll')
        || (label(target) === 'source' && ['pointerenter', 'pointerleave'].includes(type));
    }
    const originalAdd = EventTarget.prototype.addEventListener;
    const originalRemove = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function(type, handler, options) {
      if (tracked(this, type)) {
        const key = `${label(this)}:${type}:${String(options)}`;
        activeListeners.add(key);
        trace.push([now, 'listen', key]);
      }
      return originalAdd.call(this, type, handler, options);
    };
    EventTarget.prototype.removeEventListener = function(type, handler, options) {
      if (tracked(this, type)) {
        const key = `${label(this)}:${type}:${String(options)}`;
        activeListeners.delete(key);
        trace.push([now, 'unlisten', key]);
      }
      return originalRemove.call(this, type, handler, options);
    };
    const originalRect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function() {
      const bounds = originalRect.call(this);
      if (label(this)) trace.push([now, 'bounds', label(this), bounds.toJSON()]);
      return bounds;
    };
    const originalAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function(name, value) {
      if (this instanceof SVGElement) trace.push([now, 'attribute', this.tagName, name, String(value)]);
      return originalAttribute.call(this, name, value);
    };
    const originalQuery = Element.prototype.querySelector;
    const originalQueryAll = Element.prototype.querySelectorAll;
    Element.prototype.querySelector = function(selector) {
      if (label(this) === 'battle-target-line') svgQueries += 1;
      return originalQuery.call(this, selector);
    };
    Element.prototype.querySelectorAll = function(selector) {
      if (label(this) === 'battle-target-line') { svgQueries += 1; pathLists += 1; }
      return originalQueryAll.call(this, selector);
    };
    window.requestAnimationFrame = function(callback) {
      const id = nextFrame++;
      pending.set(id, callback);
      trace.push([now, 'request', id]);
      return id;
    };
    window.cancelAnimationFrame = function(id) { pending.delete(id); trace.push([now, 'cancel', id]); };
    Object.defineProperty(performance, 'now', { value: () => now });
    Object.defineProperty(document, 'hidden', { get: () => hidden });
    window.ResizeObserver = class {
      constructor(callback) { this.id = nextObserver++; this.callback = callback; this.targets = []; observers.add(this); }
      observe(target) { this.targets.push(label(target)); trace.push([now, 'observe', this.id, label(target)]); }
      disconnect() { observers.delete(this); trace.push([now, 'disconnect', this.id]); }
    };
    function snapshot(name) {
      frames.push([now, name, document.querySelector('[data-testid="battle-target-line"]')?.outerHTML ?? null]);
    }
    function tick(ms = 16) {
      now += ms;
      const callbacks = [...pending];
      pending.clear();
      for (const [id, callback] of callbacks) { trace.push([now, 'frame', id]); callback(now); }
      snapshot('frame');
    }
    function settle() {
      let count = 0;
      while (pending.size && count < 100) { tick(); count += 1; }
      if (pending.size) throw new Error('Settling loop did not stop');
    }
    function fire(target, type) { trace.push([now, 'event', label(target), type]); target.dispatchEvent(new Event(type)); }
    function resized() { for (const observer of observers) { trace.push([now, 'resize-callback', observer.id]); observer.callback([]); } }

    window.targetLineFixture.mount(version, { instanceId: 'fighter:one', lane: 0 });
    snapshot('mount');
    settle();
    const initial = { svgQueries, pathLists, frames: frames.length - 1, endMs: now };
    const arena = document.querySelector('[data-testid="battle-arena"]');
    const source = document.querySelector('[data-instance-id]');
    // Fractional, partially clipped input geometry and a burst of coalesced events.
    source.style.left = '-28.5px';
    source.style.transform = 'translateY(-4.25px)';
    fire(arena, 'scroll'); fire(source, 'pointerenter'); fire(window, 'resize'); resized();
    tick(); tick();
    source.style.left = '-120px';
    tick(); // Fully clipped: hide the line without changing its schedule.
    source.style.left = '100px';
    source.style.top = '210px';
    tick(); // Vertically clipped too.
    source.style.top = '24px';
    fire(source, 'pointerleave');
    settle();
    arena.style.height = '580px';
    resized(); tick();
    hidden = true; fire(document, 'visibilitychange');
    tick(800); // A hidden document must not leave a live frame loop.
    fire(arena, 'scroll'); fire(window, 'resize'); resized();
    tick(800);
    hidden = false; fire(document, 'visibilitychange');
    settle();
    window.targetLineFixture.update({ instanceId: 'fighter:two "quoted"', lane: 1 });
    snapshot('new-selection'); tick();
    fire(source, 'pointerenter');
    tick();
    window.targetLineFixture.unmount();
    snapshot('unmount'); tick(1000);
    const remaining = { frames: pending.size, observers: observers.size, listeners: activeListeners.size };
    // Remount proves descendant handles and listeners belong to one lifecycle.
    window.targetLineFixture.mount(version, { instanceId: 'fresh-fighter', lane: 0 });
    settle();
    window.targetLineFixture.unmount();
    const final = { frames: pending.size, observers: observers.size, listeners: activeListeners.size };
    return { trace, frames, initial, svgQueries, pathLists, remaining, final };
  }, version);
  await page.close();
  assert.deepEqual(errors, [], `${version} emitted browser errors`);
  return result;
}

test('target-line host output, geometry, scheduling, and cleanup match the frozen reference', async t => {
  assert.equal(createHash('sha256').update(baseline).digest('hex'), expectedHash, 'the before implementation must remain frozen');
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
      const before = await runScenario(browser, 'reference', viewport);
      const after = await runScenario(browser, 'current', viewport);
      assert.deepEqual(after.frames, before.frames, `${viewport.width}px: exact SVG output at every presentation frame`);
      assert.deepEqual(after.trace, before.trace, `${viewport.width}px: exact geometry reads, writes, event and scheduling order`);
      assert.deepEqual(after.remaining, { frames: 0, observers: 0, listeners: 0 }, 'unmount leaves no pending work');
      assert.deepEqual(after.final, after.remaining, 'remount/unmount also releases everything');
      assert.equal(after.initial.endMs, before.initial.endMs);
      assert.equal(after.initial.frames, before.initial.frames);
      assert.equal(before.initial.svgQueries, before.initial.frames * 5);
      assert.equal(after.initial.svgQueries, 3);
      assert.equal(after.initial.pathLists, 1);
      assert.ok(after.svgQueries < before.svgQueries / 10, 'at least 90% fewer static descendant queries across the full lifecycle');
      t.diagnostic(JSON.stringify({ viewport, initialBefore: before.initial, initialAfter: after.initial, totalQueries: { before: before.svgQueries, after: after.svgQueries }, pathNodeLists: { before: before.pathLists, after: after.pathLists }, outputSnapshots: after.frames.length }));
    }
  } finally { await browser.close(); }
});
