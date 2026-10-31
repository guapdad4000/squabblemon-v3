import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import {
  getWorldSurface, isWorldArrivalRoute, isWorldAutoPresentationAllowed,
  setWorldSurface, storyOverviewReceiptAllowed, subscribeWorldSurface,
  useWorldAutoPresentationAllowed, useWorldSurface, type WorldSurface,
} from './worldSurface';

test('arrival eligibility survives world dialogs while presentation waits for exploration', () => {
  const states: WorldSurface[] = ['inactive', 'loading', 'exploring', 'busy'];
  for (const state of states) {
    setWorldSurface(state);
    assert.equal(isWorldArrivalRoute('/game/story?host=oz', state), state !== 'inactive', 'world presenters stay mounted during loading and dialogs');
    assert.equal(isWorldArrivalRoute('/game/story/play/chapter-one', state), false, 'battle routes never inherit world arrivals');
    assert.equal(isWorldArrivalRoute('/game/shop', state), false);
    assert.equal(isWorldAutoPresentationAllowed(), state === 'inactive' || state === 'exploring');
    assert.equal(storyOverviewReceiptAllowed(state, false), false, 'roaming or slow lazy loading must not read the Story archive');
    assert.equal(storyOverviewReceiptAllowed(state, true), state !== 'loading', 'only visible Story content can acknowledge Story notices');
  }
  setWorldSurface('inactive');
});

test('the world lifecycle notifies once per actual transition and unsubscribes cleanly', () => {
  setWorldSurface('inactive');
  const updates: WorldSurface[] = [];
  const unsubscribe = subscribeWorldSurface(() => updates.push(getWorldSurface()));
  setWorldSurface('loading');
  setWorldSurface('loading');
  setWorldSurface('exploring');
  setWorldSurface('busy');
  setWorldSurface('exploring');
  assert.deepEqual(updates, ['loading', 'exploring', 'busy', 'exploring']);
  unsubscribe();
  setWorldSurface('inactive');
  assert.equal(updates.length, 4, 'leaving a route releases its listeners');
});

test('real React subscribers pause automatic arrivals and resume without remounting', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });
  setWorldSurface('loading');
  let rendered: { state: WorldSurface; allowed: boolean } | undefined;
  function Presenter() {
    rendered = { state: useWorldSurface(), allowed: useWorldAutoPresentationAllowed() };
    return null;
  }
  let renderer: ReturnType<typeof create> | undefined;
  try {
    await act(async () => { renderer = create(React.createElement(Presenter)); });
    assert.deepEqual(rendered, { state: 'loading', allowed: false });
    await act(async () => { setWorldSurface('exploring'); });
    assert.deepEqual(rendered, { state: 'exploring', allowed: true });
    await act(async () => { setWorldSurface('busy'); });
    assert.deepEqual(rendered, { state: 'busy', allowed: false });
    await act(async () => { setWorldSurface('exploring'); });
    assert.deepEqual(rendered, { state: 'exploring', allowed: true });
    await act(async () => { renderer!.unmount(); });
    renderer = undefined;
    setWorldSurface('inactive');
    assert.deepEqual(rendered, { state: 'exploring', allowed: true }, 'unmounted presenters do no further work');
  } finally {
    if (renderer) await act(async () => { renderer!.unmount(); });
    setWorldSurface('inactive');
    if (descriptor) Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', descriptor);
    else Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
  }
});
