import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import React, { Profiler } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { BattleFxImage, type BattleMediaKind } from './BattleFxImage';
import '../lib/battleMediaPlayback';

async function mount(t: TestContext, kind: BattleMediaKind = 'motion-orb', animated = true) {
  let intersect: ((entries: { target: unknown; isIntersecting: boolean }[]) => void) | undefined;
  let preferences: (() => void) | undefined;
  let observers = 0, commits = 0;
  let observed!: () => void;
  let ready = new Promise<void>(resolve => { observed = resolve; });
  const query = Object.assign(new EventTarget(), { matches: false });
  const window = Object.assign(new EventTarget(), { matchMedia: () => query });
  const document = Object.assign(new EventTarget(), { hidden: false, documentElement: { dataset: { reduceMotion: 'false' } } });
  const attributes = new Map<string, string>();
  const node = { dataset: { mediaAnimated: 'false' },
    getAttribute: (name: string) => attributes.get(name) ?? null,
    setAttribute: (name: string, value: string) => attributes.set(name, value),
  };
  const replacements: Record<string, unknown> = { window, document, IS_REACT_ACT_ENVIRONMENT: true,
    IntersectionObserver: class {
      constructor(callback: typeof intersect) { intersect = callback; }
      observe() { observers++; observed(); }
      unobserve() { observers--; }
      disconnect() {}
    },
    MutationObserver: class { constructor(callback: () => void) { preferences = callback; } observe() {} disconnect() {} },
  };
  const originals = Object.fromEntries(Object.keys(replacements).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(replacements)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  let renderer!: ReactTestRenderer;
  const render = (nextKind = kind, moving = animated) => <Profiler id="fx" onRender={() => commits++}><BattleFxImage kind={nextKind} animated={moving}/></Profiler>;
  await act(async () => {
    renderer = create(render(), { createNodeMock: element => {
      if (element.type !== 'img') return null;
      attributes.set('src', (element.props as {src:string}).src);
      return node;
    } });
  });
  if (animated && kind !== 'fire-impact') await act(async () => ready);
  t.after(async () => {
    await act(async () => renderer.unmount());
    assert.equal(observers, 0, 'unmounted artwork releases its visibility subscription');
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  return { node, document, query, renderer, get commits() { return commits; }, get observers() { return observers; },
    get src() { return attributes.get('src'); },
    visible(value: boolean) { intersect?.([{ target: node, isIntersecting: value }]); },
    preference() { preferences?.(); },
    async update(nextKind: BattleMediaKind, moving = true) {
      if (moving && nextKind !== 'fire-impact') ready = new Promise<void>(resolve => { observed = resolve; });
      await act(async () => renderer.update(render(nextKind, moving)));
      if (moving && nextKind !== 'fire-impact') await act(async () => ready);
    },
    error() { renderer.root.findByType('img').props.onError({ currentTarget: node }); },
  };
}

test('visibility, reduced motion and background changes retain the artwork without React commits', async t => {
  const view = await mount(t);
  const commits = view.commits;
  assert.match(view.src!, /motion-orb-still\.webp$/);
  await act(async () => view.visible(true));
  assert.match(view.src!, /motion-orb\.webp$/);
  assert.equal(view.node.dataset.mediaAnimated, 'true');
  view.document.hidden = true;
  await act(async () => { view.document.dispatchEvent(new Event('visibilitychange')); });
  assert.match(view.src!, /motion-orb-still\.webp$/);
  view.document.hidden = false;
  await act(async () => { view.document.dispatchEvent(new Event('visibilitychange')); });
  assert.match(view.src!, /motion-orb\.webp$/);
  view.document.documentElement.dataset.reduceMotion = 'true';
  await act(async () => view.preference());
  assert.match(view.src!, /motion-orb-still\.webp$/);
  view.document.documentElement.dataset.reduceMotion = 'false';
  view.query.matches = true;
  await act(async () => { view.query.dispatchEvent(new Event('change')); });
  assert.match(view.src!, /motion-orb-still\.webp$/);
  view.query.matches = false;
  await act(async () => { view.query.dispatchEvent(new Event('change')); });
  await act(async () => view.visible(false));
  assert.match(view.src!, /motion-orb-still\.webp$/);
  assert.equal(view.commits, commits, 'external playback gates must not rerender the battle');
});

test('failed animated art falls back once and a new kind can animate independently', async t => {
  const view = await mount(t);
  await act(async () => view.visible(true));
  await act(async () => view.error());
  assert.match(view.src!, /motion-orb-still\.webp$/);
  await act(async () => { view.visible(false); view.visible(true); });
  assert.match(view.src!, /motion-orb-still\.webp$/);
  await view.update('burn-flame');
  await act(async () => view.visible(true));
  assert.match(view.src!, /burn-flame\.webp$/);
  await view.update('burn-flame', false);
  assert.match(view.src!, /burn-flame-still\.webp$/);
  assert.equal(view.observers, 0);
});

test('one-shot fire impact keeps its static source and never starts an idle playback observer', async t => {
  const view = await mount(t, 'fire-impact');
  assert.equal(view.observers, 0);
  assert.match(view.src!, /fire-impact-still\.webp$/);
  assert.equal(view.node.dataset.mediaAnimated, 'false');
});
