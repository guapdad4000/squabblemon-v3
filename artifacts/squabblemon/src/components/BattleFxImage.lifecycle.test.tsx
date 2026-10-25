import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import React, { Profiler } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { BattleFxImage, type BattleMediaKind } from './BattleFxImage';
import '../lib/battleMediaPlayback';

async function mount(t: TestContext, kind: BattleMediaKind = 'motion-orb', animated = true, retireOnParentAnimationEnd?: string) {
  let intersect: ((entries: { target: unknown; isIntersecting: boolean }[]) => void) | undefined;
  let preferences: (() => void) | undefined;
  let observers = 0, commits = 0;
  let observed!: () => void;
  let ready = new Promise<void>(resolve => { observed = resolve; });
  const query = Object.assign(new EventTarget(), { matches: false });
  const window = Object.assign(new EventTarget(), { matchMedia: () => query });
  const document = Object.assign(new EventTarget(), { hidden: false, documentElement: { dataset: { reduceMotion: 'false' } } });
  const attributes = new Map<string, string>();
  const parent = new EventTarget();
  const node = { parentElement: parent, dataset: { mediaAnimated: 'false' },
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
  const render = (nextKind = kind, moving = animated) => <Profiler id="fx" onRender={() => commits++}><BattleFxImage kind={nextKind} animated={moving} retireOnParentAnimationEnd={retireOnParentAnimationEnd}/></Profiler>;
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
    animation(name: string, target: unknown = parent, type = 'animationend') {
      const event = Object.assign(new Event(type), { animationName: name });
      Object.defineProperty(event, 'target', { value: target });
      parent.dispatchEvent(event);
    },
    async unmount() { await act(async () => renderer.unmount()); },
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


test('finite dust retires only after its own authored fade without a React commit or later restart', async t => {
  const view = await mount(t, 'movement-dust', true, 'supplied-dust-fade');
  const commits = view.commits;
  await act(async () => view.visible(true));
  assert.match(view.src!, /movement-dust\.webp$/);
  await act(async () => {
    view.animation('unrelated-fade');
    view.animation('supplied-dust-fade', view.node);
    view.animation('supplied-dust-fade', undefined, 'animationcancel');
  });
  assert.equal(view.node.dataset.mediaAnimated, 'true', 'unrelated, descendant and cancelled animations cannot shorten the visible beat');
  assert.equal(view.observers, 1);
  await act(async () => view.animation('supplied-dust-fade'));
  assert.match(view.src!, /movement-dust-still\.webp$/);
  assert.equal(view.node.dataset.mediaAnimated, 'false');
  assert.equal(view.observers, 0, 'finished dust releases its playback subscription');
  await act(async () => {
    view.visible(false); view.visible(true);
    view.preference();
    view.document.dispatchEvent(new Event('visibilitychange'));
    view.animation('supplied-dust-fade');
  });
  assert.match(view.src!, /movement-dust-still\.webp$/);
  assert.equal(view.commits, commits);
});

test('finite media retains reduced-motion stills and resets retirement only for a new effect kind', async t => {
  const view = await mount(t, 'movement-dust', true, 'supplied-dust-fade');
  view.document.documentElement.dataset.reduceMotion = 'true';
  await act(async () => { view.visible(true); view.preference(); });
  assert.match(view.src!, /movement-dust-still\.webp$/);
  assert.equal(view.observers, 1, 'no CSS animation completion means the visible reduced-motion still remains subscribed');
  view.document.documentElement.dataset.reduceMotion = 'false';
  await act(async () => view.preference());
  assert.match(view.src!, /movement-dust\.webp$/);
  await act(async () => view.animation('supplied-dust-fade'));
  await view.update('burn-flame');
  await act(async () => view.visible(true));
  assert.match(view.src!, /burn-flame\.webp$/);
  assert.equal(view.observers, 1, 'a later effect gets its own lifecycle');
});

test('failed or unmounted finite media cannot resume from a late fade event', async t => {
  const view = await mount(t, 'movement-dust', true, 'supplied-dust-fade');
  await act(async () => { view.visible(true); view.error(); });
  assert.match(view.src!, /movement-dust-still\.webp$/);
  await act(async () => view.animation('supplied-dust-fade'));
  assert.equal(view.observers, 0);
  await view.update('burn-flame');
  await act(async () => view.visible(true));
  const src = view.src;
  await view.unmount();
  assert.equal(view.observers, 0);
  view.animation('supplied-dust-fade');
  assert.equal(view.src, src, 'unmount removes the parent listener before a late animation event');
});
