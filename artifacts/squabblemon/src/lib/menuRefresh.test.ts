import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { setBattleActive } from './imageWarmup';
import { menuRefreshAllowed, useMenuRefreshAllowed } from './menuRefresh';

test('menu reads pause across nested battles and hidden tabs, resume once, and unsubscribe on unmount', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const previousAct = Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
  const document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  let adds = 0, removes = 0;
  const add = document.addEventListener.bind(document), remove = document.removeEventListener.bind(document);
  document.addEventListener = (...args) => { adds++; add(...args); };
  document.removeEventListener = (...args) => { removes++; remove(...args); };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });
  const states: boolean[] = [];
  function Probe() { const active = useMenuRefreshAllowed(); states.push(active); return null; }
  let renderer: ReturnType<typeof create>;
  try {
    await act(async () => { renderer = create(React.createElement(Probe)); });
    assert.equal(states.at(-1), true);
    await act(async () => { setBattleActive(true); }); assert.equal(states.at(-1), false);
    const pausedCommits = states.length;
    await act(async () => { setBattleActive(true); setBattleActive(false); });
    assert.equal(states.length, pausedCommits, 'nested battle owners must not wake menus');
    document.visibilityState = 'hidden';
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); setBattleActive(false); });
    assert.equal(menuRefreshAllowed(), false, 'battle exit in hidden tab must not start reads');
    await act(async () => { document.visibilityState = 'visible'; document.dispatchEvent(new Event('visibilitychange')); });
    assert.equal(states.at(-1), true);
    assert.equal(states.filter(Boolean).length, 2, 'one initial and one return refresh transition');
    await act(async () => { renderer!.unmount(); });
    assert.equal(adds, removes);
    const after = states.length;
    document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(states.length, after);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'document', previous); else Reflect.deleteProperty(globalThis, 'document');
    if (previousAct) Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', previousAct); else Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
  }
});
