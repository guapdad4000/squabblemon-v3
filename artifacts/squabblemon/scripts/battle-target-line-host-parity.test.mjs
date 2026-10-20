import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { compileFunction } from 'node:vm';
import test from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { transformSync } from 'esbuild';

const require = createRequire(import.meta.url);
const baseline = readFileSync(new URL('../src/components/__fixtures__/BattleTargetLine.baseline.tsx.txt', import.meta.url), 'utf8');
const candidate = readFileSync(new URL('../src/components/BattleTargetLine.tsx', import.meta.url), 'utf8');
function component(source) {
  const module = { exports: {} };
  const { code } = transformSync(source, { loader: 'tsx', format: 'cjs', jsx: 'automatic' });
  compileFunction(code, ['require', 'module', 'exports'])(require, module, module.exports);
  return module.exports.BattleTargetLine;
}
const Before = component(baseline), After = component(candidate);

// Actual React effects and cleanup run against deterministic DOM hosts. This is
// an operation-count/lifecycle gate, not a browser frame-time or visual claim.
async function scenario(Component, width, { missingSource = false, initiallyHidden = false } = {}) {
  let now = 0, nextFrame = 1, nextObserver = 1, hidden = initiallyHidden, svgQueries = 0, pathLists = 0;
  const trace = [], snapshots = [], pending = new Map(), observers = new Set();
  const host = {};
  const bounds = (left, top, width, height) => ({ x: left, y: top, left, top, right: left + width, bottom: top + height, width, height });
  class Node {
    constructor(name, rect) { this.name = name; this.rect = rect; this.attributes = {}; this.listeners = new Map(); this.style = {}; }
    getBoundingClientRect() { trace.push([now, 'bounds', this.name, { ...this.rect }]); return this.rect; }
    setAttribute(name, value) { this.attributes[name] = String(value); trace.push([now, 'attribute', this.name, name, String(value)]); }
    addEventListener(type, handler, capture) {
      this.listeners.set(type, handler); trace.push([now, 'listen', this.name, type, capture === true]);
    }
    removeEventListener(type, handler, capture) {
      assert.equal(this.listeners.get(type), handler, 'cleanup removes the exact callback');
      this.listeners.delete(type); trace.push([now, 'unlisten', this.name, type, capture === true]);
    }
    fire(type) { trace.push([now, 'event', this.name, type]); this.listeners.get(type)?.(); }
    closest(selector) { assert.equal(selector, '[data-testid="battle-arena"]'); return host.arena; }
    querySelector(selector) {
      if (this === host.svg) {
        svgQueries += 1;
        return { '[data-origin]': host.origin, '[data-destination]': host.destination }[selector] ?? null;
      }
      if (this === host.arena) return { '[data-testid="hand-tray"]': host.hand, '[data-testid="lane-0"]': host.lane0, '[data-testid="lane-1"]': host.lane1 }[selector] ?? null;
      if (this === host.hand) {
        assert.equal(selector, `[data-instance-id="${globalThis.CSS.escape(host.instanceId)}"]`, 'selection still resolves the current escaped instance ID');
        return missingSource ? null : host.source;
      }
      throw new Error(`Unexpected selector ${this.name}: ${selector}`);
    }
    querySelectorAll(selector) {
      assert.equal(this, host.svg); assert.equal(selector, 'path');
      svgQueries += 1; pathLists += 1;
      return [host.shadow, host.beam];
    }
  }
  function freshHosts() {
    host.arena = new Node('battle-arena', bounds(0, 0, width, 560));
    host.hand = new Node('hand-tray', bounds(width * .05, 340, width * .9, 180));
    host.source = new Node('source', bounds(width * .05 + 32, 364, 96, 130));
    host.lane0 = new Node('lane-0', bounds(width * .08, 20, width * .38, 230));
    host.lane1 = new Node('lane-1', bounds(width * .54, 20, width * .38, 230));
    host.svg = new Node('svg'); host.shadow = new Node('shadow'); host.beam = new Node('beam');
    host.origin = new Node('origin'); host.destination = new Node('destination');
  }
  freshHosts();
  const win = new Node('window'), doc = new Node('document');
  Object.defineProperty(doc, 'hidden', { get: () => hidden });
  const globals = new Map(['window', 'document', 'ResizeObserver', 'CSS', 'requestAnimationFrame', 'cancelAnimationFrame', 'IS_REACT_ACT_ENVIRONMENT'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const nowDescriptor = Object.getOwnPropertyDescriptor(performance, 'now');
  Object.assign(globalThis, {
    IS_REACT_ACT_ENVIRONMENT: true, window: win, document: doc,
    CSS: { escape: value => value.replace(/[^a-zA-Z0-9_-]/g, char => `\\${char}`) },
    requestAnimationFrame(callback) { const id = nextFrame++; pending.set(id, callback); trace.push([now, 'request', id]); return id; },
    cancelAnimationFrame(id) { pending.delete(id); trace.push([now, 'cancel', id]); },
    ResizeObserver: class {
      constructor(callback) { this.id = nextObserver++; this.callback = callback; observers.add(this); }
      observe(node) { trace.push([now, 'observe', this.id, node.name]); }
      disconnect() { observers.delete(this); trace.push([now, 'disconnect', this.id]); }
    },
  });
  Object.defineProperty(performance, 'now', { configurable: true, value: () => now });
  let renderer;
  function snapshot(name) {
    snapshots.push([now, name, JSON.parse(JSON.stringify(renderer.toJSON(), (key, value) => key === 'ref' ? undefined : value)),
      { style: { ...host.svg.style }, paths: [{ ...host.shadow.attributes }, { ...host.beam.attributes }], origin: { ...host.origin.attributes }, destination: { ...host.destination.attributes } }]);
  }
  function tick(ms = 16) {
    now += ms; const callbacks = [...pending]; pending.clear();
    for (const [id, callback] of callbacks) { trace.push([now, 'frame', id]); callback(now); }
    snapshot('frame');
  }
  function settle() { let count = 0; while (pending.size && count++ < 100) tick(); assert.equal(pending.size, 0, 'settling stops'); }
  function resize() { for (const observer of observers) { trace.push([now, 'resize-callback', observer.id]); observer.callback([]); } }
  function remaining() { return { frames: pending.size, observers: observers.size, listeners: [host.arena, host.source, win, doc].reduce((sum, node) => sum + node.listeners.size, 0) }; }
  async function mount(instanceId, lane) {
    host.instanceId = instanceId;
    await act(() => { renderer = create(React.createElement(Component, { instanceId, lane }), { createNodeMock: element => element.type === 'svg' ? host.svg : null }); });
  }
  try {
    await mount('fighter:one', 0); snapshot('mount'); settle();
    const initial = { svgQueries, pathLists, frames: snapshots.length - 1, endMs: now };
    if (!missingSource) {
      host.source.rect = bounds(host.hand.rect.left - 28.5, 359.75, 96, 130);
      host.arena.fire('scroll'); host.source.fire('pointerenter'); win.fire('resize'); resize();
      tick(); tick();
      host.source.rect = bounds(host.hand.rect.left - 120, 364, 96, 130); tick();
      host.source.rect = bounds(host.hand.rect.left + 100, 550, 96, 130); tick();
      host.source.rect = bounds(host.hand.rect.left + 100, 364, 96, 130);
      host.source.fire('pointerleave'); settle();
      host.arena.rect = bounds(0, 0, width, 580); resize(); tick();
      hidden = true; doc.fire('visibilitychange'); tick(800);
      host.arena.fire('scroll'); win.fire('resize'); resize(); tick(800);
      hidden = false; doc.fire('visibilitychange'); settle();
      host.instanceId = 'fighter:two "quoted"';
      await act(() => renderer.update(React.createElement(Component, { instanceId: host.instanceId, lane: 1 })));
      snapshot('new-selection'); tick(); host.source.fire('pointerenter'); tick();
    }
    await act(() => renderer.unmount()); snapshot('unmount'); tick(1000);
    const firstUnmount = remaining();
    freshHosts(); await mount('fresh-fighter', 0); settle();
    await act(() => renderer.unmount());
    return { trace, snapshots, initial, svgQueries, pathLists, firstUnmount, final: remaining() };
  } finally {
    if (renderer) await act(() => renderer.unmount());
    for (const [key, descriptor] of globals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
    if (nowDescriptor) Object.defineProperty(performance, 'now', nowDescriptor); else delete performance.now;
  }
}

test('target-line exact host output, geometry, events, scheduling, and cleanup match frozen reference', async t => {
  assert.equal(createHash('sha256').update(baseline).digest('hex'), '4f307ddf5a5fbb34c5e75e0c8fd082d939237446b16de275d3d9fcd10a48eaff', 'reference must remain frozen');
  for (const width of [390, 1440]) {
    const before = await scenario(Before, width), after = await scenario(After, width);
    assert.deepEqual(after.snapshots, before.snapshots, `${width}px: exact React host and SVG output at every frame`);
    assert.deepEqual(after.trace, before.trace, `${width}px: exact reads/writes/listeners/observers/frame timing and order`);
    assert.deepEqual(after.firstUnmount, { frames: 0, observers: 0, listeners: 0 });
    assert.deepEqual(after.final, after.firstUnmount);
    assert.equal(after.initial.endMs, before.initial.endMs);
    assert.equal(after.initial.frames, before.initial.frames);
    assert.equal(before.initial.svgQueries, before.initial.frames * 5);
    assert.equal(after.initial.svgQueries, 3);
    assert.equal(after.initial.pathLists, 1);
    assert.ok(after.svgQueries < before.svgQueries / 10);
    t.diagnostic(JSON.stringify({ width, initialBefore: before.initial, initialAfter: after.initial, totalQueries: { before: before.svgQueries, after: after.svgQueries }, pathNodeLists: { before: before.pathLists, after: after.pathLists }, snapshots: after.snapshots.length }));
  }
});

test('missing-source and initially-hidden lifecycles retain exact no-op/readiness behavior', async () => {
  for (const options of [{ missingSource: true }, { initiallyHidden: true }]) {
    const before = await scenario(Before, 390, options), after = await scenario(After, 390, options);
    assert.deepEqual(after.snapshots, before.snapshots);
    assert.deepEqual(after.trace, before.trace);
    assert.deepEqual(after.final, { frames: 0, observers: 0, listeners: 0 });
  }
});
