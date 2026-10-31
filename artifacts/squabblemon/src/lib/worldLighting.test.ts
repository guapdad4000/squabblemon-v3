import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { FadewoodSceneFrame } from '../components/world/FadewoodSceneFrame';
import { createWorldLightingStore, WORLD_LIGHTING_EVENT, WORLD_LIGHTING_STORAGE_KEY } from './worldLighting';

function device(initial?: string) {
  const values = new Map(initial ? [[WORLD_LIGHTING_STORAGE_KEY, initial]] : []);
  const bus = new EventTarget();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
  const target = Object.assign(bus, { localStorage: storage }) as unknown as Pick<Window, 'localStorage' | 'addEventListener' | 'removeEventListener' | 'dispatchEvent'>;
  const store = createWorldLightingStore(() => target);
  const storageEvent = (key: string | null, newValue: string | null, area: unknown = storage) =>
    bus.dispatchEvent(Object.assign(new Event('storage'), { key, newValue, storageArea: area }));
  return { store, target, storage, values, storageEvent };
}

test('existing Safehouse day/night values remain compatible and one device update reaches both scenes', () => {
  assert.equal(WORLD_LIGHTING_STORAGE_KEY, 'squabblemon_safehouse_lighting');
  const { store, target, values } = device('night');
  const otherScene = createWorldLightingStore(() => target);
  assert.equal(store.getSnapshot(), true);
  const changes: boolean[] = [];
  const release = otherScene.subscribe(() => changes.push(otherScene.getSnapshot()));
  store.setNight(previous => !previous);
  assert.equal(values.get(WORLD_LIGHTING_STORAGE_KEY), 'day');
  assert.equal(otherScene.getSnapshot(), false, 'same-tab updates work without browser storage events');
  store.setNight(true);
  assert.deepEqual(changes, [false, true]);
  release();
  store.setNight(false);
  assert.deepEqual(changes, [false, true], 'an unmounted scene releases its subscribers');
  assert.equal(device('invalid-old-value').store.getSnapshot(), false);
});

test('cross-tab storage updates and cleared storage apply, while other preferences or session storage are ignored', () => {
  const { store, storageEvent } = device();
  const changes: boolean[] = [];
  const release = store.subscribe(() => changes.push(store.getSnapshot()));
  storageEvent('another-preference', 'night');
  storageEvent(WORLD_LIGHTING_STORAGE_KEY, 'night', {});
  assert.deepEqual(changes, []);
  storageEvent(WORLD_LIGHTING_STORAGE_KEY, 'night');
  storageEvent(WORLD_LIGHTING_STORAGE_KEY, 'night');
  storageEvent(null, null);
  assert.deepEqual(changes, [true, false]);
  release();
});

test('quota-blocked writes keep the live same-tab preference even when readable storage is stale', () => {
  const { store, target, storage, values } = device('day');
  storage.setItem = () => { throw new Error('quota exceeded'); };
  const second = createWorldLightingStore(() => target);
  const release = second.subscribe(() => {});
  store.setNight(true);
  assert.equal(values.get(WORLD_LIGHTING_STORAGE_KEY), 'day');
  assert.equal(store.getSnapshot(), true);
  assert.equal(second.getSnapshot(), true);
  release();
  const remount = second.subscribe(() => {});
  assert.equal(second.getSnapshot(), true, 'stale storage does not overwrite an unsaved live choice on route re-entry');
  store.setNight(previous => !previous);
  assert.equal(second.getSnapshot(), false);
  remount();
});

test('storage getter denial and SSR keep entry and controls safe without retaining server choices', () => {
  const { store, target } = device();
  Object.defineProperty(target, 'localStorage', { get() { throw new Error('security denied'); } });
  assert.equal(store.getSnapshot(), false);
  const release = store.subscribe(() => {});
  assert.doesNotThrow(() => store.setNight(true));
  assert.equal(store.getSnapshot(), true);
  target.dispatchEvent(new CustomEvent(WORLD_LIGHTING_EVENT, { detail: { night: 'invalid' } }));
  assert.equal(store.getSnapshot(), true);
  release();
  const server = createWorldLightingStore(() => undefined);
  assert.equal(server.getServerSnapshot(), false);
  assert.doesNotThrow(() => server.setNight(true));
  assert.equal(server.getSnapshot(), false);
  server.subscribe(() => {})();
});

test('route re-entry refreshes a preference changed while the scene had no subscribers', () => {
  const { store, values } = device('day');
  const release = store.subscribe(() => {});
  release();
  values.set(WORLD_LIGHTING_STORAGE_KEY, 'night');
  const remount = store.subscribe(() => {});
  assert.equal(store.getSnapshot(), true);
  remount();
});

test('the real Frame initializes the current theme, resends on ready, and changes lighting without reloading or restoring the iframe', async () => {
  const names = ['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'];
  const previous = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const messages: Array<Record<string, unknown>> = [];
  const child = { postMessage: (value: Record<string, unknown>) => messages.push(value) };
  const fakeWindow = Object.assign(new EventTarget(), { location: { origin: 'http://localhost' }, setInterval, clearInterval, setTimeout, clearTimeout });
  const fakeDocument = Object.assign(new EventTarget(), { hidden: false });
  for (const [name, value] of Object.entries({ window: fakeWindow, document: fakeDocument, IS_REACT_ACT_ENVIRONMENT: true }))
    Object.defineProperty(globalThis, name, { configurable: true, value });
  let renderer: ReturnType<typeof create> | undefined;
  const statuses: string[] = [];
  const props = { mode: 'exploring' as const, reducedMotion: false, onEvent: () => {}, onStatus: (status: string) => statuses.push(status), childSrc: '/controlled-bridge.html' };
  try {
    await act(async () => { renderer = create(React.createElement(FadewoodSceneFrame, { ...props, night: true }), { createNodeMock: () => ({ contentWindow: child }) }); });
    await act(async () => { renderer!.root.findByType('iframe').props.onLoad(); });
    const init = messages.find(message => message.type === 'init')!;
    assert.equal(init.night, true, 'the saved night preference reaches initial scene setup');
    assert.equal(init.checkpoint, undefined);
    const source = renderer!.root.findByType('iframe').props.src;
    await act(async () => { renderer!.update(React.createElement(FadewoodSceneFrame, { ...props, night: false })); });
    const ready = () => fakeWindow.dispatchEvent(Object.assign(new Event('message'), { origin: 'http://localhost', source: child,
      data: { channel: 'squabblemon-fadewood', version: 1, instanceId: init.instanceId, type: 'ready' } }));
    await act(async () => { ready(); });
    assert.deepEqual(statuses, ['ready']);
    assert.deepEqual(messages.filter(message => message.type === 'lighting').map(message => message.night), [false], 'ready uses the latest setting, including a change during load');
    const initCount = messages.filter(message => message.type === 'init').length;
    await act(async () => { renderer!.update(React.createElement(FadewoodSceneFrame, { ...props, night: true })); });
    assert.equal(messages.at(-1)!.type, 'lighting');
    assert.equal(messages.at(-1)!.night, true);
    assert.equal(messages.filter(message => message.type === 'init').length, initCount, 'theme changes do not replay init/restore');
    assert.equal(messages.some(message => message.type === 'restore'), false);
    assert.equal(renderer!.root.findByType('iframe').props.src, source);
    assert.equal(messages.at(-1)!.instanceId, init.instanceId);
    await act(async () => { ready(); });
    assert.deepEqual(messages.filter(message => message.type === 'lighting').map(message => message.night), [false, true, true], 'a repeated ready handshake receives the theme again');
  } finally {
    if (renderer) await act(async () => { renderer!.unmount(); });
    for (const name of names) {
      const descriptor = previous.get(name);
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});
