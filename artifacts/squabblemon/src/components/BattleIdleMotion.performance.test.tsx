import assert from 'node:assert/strict';
import test from 'node:test';
import React, { Profiler } from 'react';
import { act, create } from 'react-test-renderer';
import { CardView } from './CardView';
import { cards } from '../data';

const idleProperty = '--battle-idle-play-state';
function browser() {
  const document = Object.assign(new EventTarget(), { hidden: false, documentElement: { dataset: {} as Record<string, string> } });
  const preference = Object.assign(new EventTarget(), { matches: false });
  const observers: Visibility[] = [];
  let preferenceChanged: (() => void) | undefined;
  let preferencesDisconnected = 0;
  let frames = 0;
  class Visibility {
    observed = new Set<object>();
    disconnected = false;
    constructor(private callback: (entries: { target: object; isIntersecting: boolean }[]) => void) { observers.push(this); }
    observe(node: object) { this.observed.add(node); }
    unobserve(node: object) { this.observed.delete(node); }
    disconnect() { this.disconnected = true; this.observed.clear(); }
    visible(node: object, visible: boolean) { this.callback([{ target: node, isIntersecting: visible }]); }
  }
  const values = {
    document,
    window: { matchMedia: () => preference },
    IntersectionObserver: Visibility,
    MutationObserver: class {
      constructor(callback: () => void) { preferenceChanged = callback; }
      observe() {}
      disconnect() { preferencesDisconnected++; }
    },
    requestAnimationFrame: () => { frames++; throw new Error('Idle visibility must not schedule frames'); },
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  return {
    document, preference, observers, preferenceChanged: () => preferenceChanged?.(),
    frames: () => frames, preferencesDisconnected: () => preferencesDisconnected,
    restore() {
      for (const [key, descriptor] of Object.entries(previous)) descriptor
        ? Object.defineProperty(globalThis, key, descriptor) : Reflect.deleteProperty(globalThis, key);
    },
  };
}
function host() {
  const properties = new Map<string, string>();
  const writes: string[] = [];
  return {
    properties, writes,
    getBoundingClientRect() { throw new Error('Idle visibility must not read layout'); },
    style: {
      setProperty(key: string, value: string) { writes.push(`${key}:${value}`); properties.set(key, value); },
      removeProperty(key: string) { properties.delete(key); },
    },
  };
}

// The static shell uses the actual CardView root/effect without invoking Motion's
// renderer. Parent browser traces cover computed CSS and production projection.
const board = (key = 'one') => <CardView key={key} card={cards.buddy} isBoard boardPresentation="combat" scoreStance="tied" presentationOnly disableLayout />;

test('actual board faces pause only idle state on clipping, background and preferences without React commits or layout work', async t => {
  const env = browser(), node = host();
  let renderer: ReturnType<typeof create> | undefined, commits = 0;
  t.after(async () => { if (renderer) await act(async () => renderer!.unmount()); env.restore(); });
  await act(async () => { renderer = create(<Profiler id="idle" onRender={() => commits++}>{board()}</Profiler>, {
    createNodeMock: element => (element.props as Record<string, unknown>)['data-card-id'] ? node : null,
  }); });
  assert.equal(env.observers.length, 1);
  assert.equal(node.properties.get(idleProperty), 'paused', 'a new card waits for its visibility result');
  const markup = JSON.stringify(renderer!.toJSON(), (key, value) => key === 'ref' ? undefined : value);
  assert.match(markup, /battle-board-card/);
  assert.match(markup, /is-alive-owner/);
  assert.match(markup, /collector-foil/);
  assert.match(markup, /collector-portrait/);
  await act(async () => { env.observers[0].visible(node, true); });
  assert.equal(node.properties.get(idleProperty), 'running');
  const visibleWrites = node.writes.length;
  await act(async () => { env.observers[0].visible(node, true); });
  assert.equal(node.writes.length, visibleWrites, 'unchanged visibility does not dirty style');
  await act(async () => { env.observers[0].visible(node, false); });
  assert.equal(node.properties.get(idleProperty), 'paused', 'fully clipped/offscreen cards stop idle work');
  await act(async () => { env.observers[0].visible(node, true); env.document.hidden = true; env.document.dispatchEvent(new Event('visibilitychange')); });
  assert.equal(node.properties.get(idleProperty), 'paused');
  await act(async () => { env.document.hidden = false; env.document.dispatchEvent(new Event('visibilitychange')); });
  assert.equal(node.properties.get(idleProperty), 'running');
  await act(async () => { env.preference.matches = true; env.preference.dispatchEvent(new Event('change')); });
  assert.equal(node.properties.get(idleProperty), 'paused');
  await act(async () => { env.preference.matches = false; env.preference.dispatchEvent(new Event('change')); });
  assert.equal(node.properties.get(idleProperty), 'running');
  await act(async () => { env.document.documentElement.dataset.reduceMotion = 'true'; env.preferenceChanged(); });
  assert.equal(node.properties.get(idleProperty), 'paused');
  await act(async () => { delete env.document.documentElement.dataset.reduceMotion; env.preferenceChanged(); });
  assert.equal(node.properties.get(idleProperty), 'running');
  assert.equal(JSON.stringify(renderer!.toJSON(), (key, value) => key === 'ref' ? undefined : value), markup, 'artwork, status, classes and layout survive every visibility change');
  assert.equal(commits, 1, 'visibility never re-renders a card');
  assert.equal(env.frames(), 0);
  await act(async () => { renderer!.unmount(); renderer = undefined; });
  assert.equal(node.properties.has(idleProperty), false);
  assert.equal(env.observers[0].observed.size, 0);
  assert.equal(env.observers[0].disconnected, true);
  assert.equal(env.preferencesDisconnected(), 1);
  const endedWrites = node.writes.length;
  env.document.dispatchEvent(new Event('visibilitychange'));
  env.observers[0].visible(node, true);
  assert.equal(node.writes.length, endedWrites, 'late callbacks cannot mutate an unmounted card');
});

test('72 retained board faces share one observer and release subscriptions when removed', async t => {
  const env = browser();
  const nodes: ReturnType<typeof host>[] = [];
  let renderer: ReturnType<typeof create> | undefined;
  t.after(async () => { if (renderer) await act(async () => renderer!.unmount()); env.restore(); });
  await act(async () => { renderer = create(<>{Array.from({ length: 72 }, (_, index) => board(String(index)))}</>, {
    createNodeMock: element => { if (!(element.props as Record<string, unknown>)['data-card-id']) return null; const node = host(); nodes.push(node); return node; },
  }); });
  assert.equal(nodes.length, 72);
  assert.equal(env.observers.length, 1, 'no per-card observer');
  assert.equal(env.observers[0].observed.size, 72);
  await act(async () => { nodes.forEach((node, index) => env.observers[0].visible(node, index < 12)); });
  assert.equal(nodes.filter(node => node.properties.get(idleProperty) === 'running').length, 12);
  assert.equal((renderer!.toJSON() as unknown[]).length, 72, 'offscreen cards remain retained');
  await act(async () => { renderer!.unmount(); renderer = undefined; });
  assert.equal(env.observers[0].observed.size, 0);
  assert.equal(env.preferencesDisconnected(), 1);
  assert.ok(nodes.every(node => !node.properties.has(idleProperty)));
  assert.equal(env.frames(), 0);
});

test('changing a board root to full inspection size releases idle observation, and reentry resumes it', async t => {
  const env = browser(), node = host();
  let renderer: ReturnType<typeof create> | undefined;
  t.after(async () => { if (renderer) await act(async () => renderer!.unmount()); env.restore(); });
  const render = (fillContainer: boolean) => <CardView card={cards.buddy} isBoard fillContainer={fillContainer} presentationOnly disableLayout />;
  await act(async () => { renderer = create(render(false), { createNodeMock: element => (element.props as Record<string, unknown>)['data-card-id'] ? node : null }); });
  await act(async () => { env.observers[0].visible(node, true); });
  assert.equal(node.properties.get(idleProperty), 'running');
  await act(async () => { renderer!.update(render(true)); });
  assert.equal(env.observers[0].disconnected, true);
  assert.equal(node.properties.has(idleProperty), false);
  assert.doesNotMatch(JSON.stringify(renderer!.toJSON(), (key, value) => key === 'ref' ? undefined : value), /battle-board-card/);
  await act(async () => { renderer!.update(render(false)); });
  assert.equal(env.observers.length, 2);
  await act(async () => { env.observers[1].visible(node, true); });
  assert.equal(node.properties.get(idleProperty), 'running');
});


test('unsupported intersection observation preserves visible idle animation and still stops in a hidden tab', async t => {
  const env = browser(), node = host();
  Object.defineProperty(globalThis, 'IntersectionObserver', { configurable: true, writable: true, value: undefined });
  let renderer: ReturnType<typeof create> | undefined;
  t.after(async () => { if (renderer) await act(async () => renderer!.unmount()); env.restore(); });
  await act(async () => { renderer = create(board(), { createNodeMock: element => (element.props as Record<string, unknown>)['data-card-id'] ? node : null }); });
  assert.equal(node.properties.get(idleProperty), 'running');
  assert.equal(env.observers.length, 0);
  await act(async () => { env.document.hidden = true; env.document.dispatchEvent(new Event('visibilitychange')); });
  assert.equal(node.properties.get(idleProperty), 'paused');
  await act(async () => { env.document.hidden = false; env.document.dispatchEvent(new Event('visibilitychange')); });
  assert.equal(node.properties.get(idleProperty), 'running');
});
