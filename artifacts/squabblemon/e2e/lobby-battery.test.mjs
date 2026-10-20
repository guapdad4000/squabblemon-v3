import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const before = readFileSync(new URL('./fixtures/LobbyDepth.before-battery.txt', import.meta.url), 'utf8');
const after = readFileSync(new URL('../src/components/LobbyDepth.tsx', import.meta.url), 'utf8');

// Execute each complete production effect. This is a deterministic canvas-host
// trace, not a browser layout/screenshot or measured device-energy test.
function mount(source, initialQuality = 'full') {
  let quality = initialQuality, qualityListener, observer, cleanup;
  let nextFrame = 0, randomState = 71, refs = 0, width = 390, height = 844;
  let fillStyle, globalAlpha, widthReads = 0, colorWrites = 0, randomCalls = 0;
  const effects = [], frames = new Map(), windowListeners = new Map(), documentListeners = new Map();
  const trace = [], lifecycle = [];
  const context = {
    clearRect: (...args) => trace.push(['clear', ...args]),
    beginPath: () => trace.push(['begin']),
    arc: (...args) => trace.push(['arc', ...args]),
    fill: () => trace.push(['fill', fillStyle, globalAlpha]),
    set fillStyle(value) { colorWrites++; fillStyle = value; },
    set globalAlpha(value) { globalAlpha = value; },
  };
  const root = {
    get clientWidth() { widthReads++; return width; },
    get clientHeight() { return height; },
    style: { setProperty: (...args) => trace.push(['property', ...args]) },
  };
  const surface = { width: 300, height: 150, getContext: () => context };
  const document = {
    hidden: false,
    documentElement: { dataset: {} },
    addEventListener: (name, listener) => documentListeners.set(name, listener),
    removeEventListener: name => documentListeners.delete(name),
  };
  let gyro = { x: 0, y: 0 };
  const hooks = {
    useRef: () => ({ current: refs++ === 0 ? root : surface }),
    useEffect: fn => effects.push(fn),
  };
  const exports = {};
  const compiled = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  vm.runInNewContext(compiled, {
    exports,
    require(name) {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null };
      if (name === '../lib/depthQuality') return {
        currentDepthQuality: () => quality,
        currentGyro: () => gyro,
        subscribeDepthQuality: listener => { qualityListener = listener; return () => { qualityListener = null; lifecycle.push('unsubscribe'); }; },
      };
      throw new Error(`Unexpected import: ${name}`);
    },
    document, devicePixelRatio: 2, innerWidth: 390, innerHeight: 844,
    window: {
      addEventListener: (name, listener) => windowListeners.set(name, listener),
      removeEventListener: name => windowListeners.delete(name),
    },
    Math: Object.assign(Object.create(Math), { random: () => { randomCalls++; randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0; return randomState / 2 ** 32; } }),
    ResizeObserver: class {
      constructor(callback) { observer = callback; }
      observe() { lifecycle.push('observe'); }
      disconnect() { lifecycle.push('disconnect'); }
    },
    requestAnimationFrame: callback => { const id = ++nextFrame; frames.set(id, callback); lifecycle.push(['request', id]); return id; },
    cancelAnimationFrame: id => { frames.delete(id); lifecycle.push(['cancel', id]); },
  });
  exports.LobbyDepth();
  for (const effect of effects) cleanup = effect();
  return {
    trace, lifecycle,
    stats: () => ({ widthReads, colorWrites, randomCalls, pending: frames.size }),
    resetCounts() { widthReads = colorWrites = 0; },
    tick(now) { const callbacks = [...frames.values()]; frames.clear(); for (const callback of callbacks) callback(now); },
    pointer(x, y, pointerType = 'mouse') { windowListeners.get('pointermove')?.({ pointerType, clientX: x, clientY: y }); },
    quality(value) { quality = value; qualityListener?.(value); },
    visible(value) { document.hidden = !value; documentListeners.get('visibilitychange')?.(); },
    gyro(x, y) { gyro = { x, y }; document.documentElement.dataset.gyro = 'on'; },
    resize(w, h) { width = w; height = h; observer(); },
    unmount() { cleanup(); assert.equal(windowListeners.size, 0); assert.equal(documentListeners.size, 0); assert.equal(qualityListener, null); },
  };
}

function same(a, b) {
  assert.deepEqual(b.trace, a.trace, 'every geometry, fill color/alpha and CSS property output matches');
  assert.deepEqual(b.lifecycle, a.lifecycle, 'frame requests, cancellation and subscriptions match');
  assert.equal(b.stats().randomCalls, a.stats().randomCalls);
  assert.equal(b.stats().pending, a.stats().pending);
}

for (const [quality, motes, interval] of [['full', 42, 16], ['lite', 16, 40]]) {
  test(`${quality} particles preserve every drawn frame with one layout read and color assignment`, t => {
    const a = mount(before, quality), b = mount(after, quality), frames = 600;
    a.resetCounts(); b.resetCounts();
    for (let frame = 1; frame <= frames; frame++) {
      a.tick(frame * interval); b.tick(frame * interval);
    }
    same(a, b);
    assert.equal(a.stats().widthReads, frames * motes);
    assert.equal(b.stats().widthReads, frames);
    assert.equal(a.stats().colorWrites, frames * motes);
    assert.equal(b.stats().colorWrites, frames);
    t.diagnostic(`${frames} frames: clientWidth reads/color assignments ${frames * motes} -> ${frames}`);
    a.unmount(); b.unmount(); same(a, b);
  });
}

test('pointer/gyro, resize, hidden/resume, quality changes and cleanup retain the same output and scheduling', () => {
  const a = mount(before), b = mount(after);
  const act = (method, ...args) => { a[method](...args); b[method](...args); same(a, b); };
  act('tick', 16); act('tick', 20); act('pointer', 300, 90); act('tick', 32);
  act('pointer', 0, 0, 'touch'); act('tick', 48); act('gyro', -.4, .9); act('tick', 64);
  act('resize', 844, 390); act('tick', 80); act('visible', false); act('tick', 96);
  act('visible', true); act('tick', 5000); act('quality', 'lite'); act('tick', 5040);
  act('quality', 'off'); act('tick', 5080); act('quality', 'full'); act('resize', 0, 0);
  act('tick', 5100); act('resize', 320, 740); act('tick', 5200); act('unmount');
  assert.equal(b.stats().pending, 0);
});
