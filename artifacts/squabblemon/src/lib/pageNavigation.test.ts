import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, test } from 'node:test';
import { guardDeckRouteNavigation, setDeckExitGuard } from './deckExitGuard';

afterEach(() => setDeckExitGuard(null));

test('page navigation is synchronous even when native view transitions are available', () => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  let transitions = 0;
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { startViewTransition: () => { transitions += 1; } },
  });
  try {
    const calls: unknown[][] = [];
    const options = { replace: true, state: { from: '/game' } };
    guardDeckRouteNavigation((...args) => { calls.push(args); }, '/game/collection', options);
    assert.deepEqual(calls, [['/game/collection', options]]);
    assert.equal(transitions, 0);
  } finally {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});

test('instant navigation still waits for dirty-deck confirmation and respects cancellation', () => {
  const calls: string[] = [];
  let confirm = () => {};
  let cancel = () => {};
  setDeckExitGuard((proceed, stay) => { confirm = proceed; cancel = stay; });

  guardDeckRouteNavigation(to => { calls.push(to); }, '/game');
  assert.deepEqual(calls, []);
  cancel();
  assert.deepEqual(calls, []);

  guardDeckRouteNavigation(to => { calls.push(to); }, '/game/collection');
  assert.deepEqual(calls, []);
  confirm();
  assert.deepEqual(calls, ['/game/collection']);
});

test('public and game routes use the exit guard without page animation hooks', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const game = readFileSync(new URL('../pages/game/GameApp.tsx', import.meta.url), 'utf8');
  const tokens = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');
  assert.match(app, /aroundNav=\{guardDeckRouteNavigation\}/);
  assert.match(app, /<MotionConfig reducedMotion="user">/);
  assert.match(game, /className="game-route-stage" key=\{location\}/);
  assert.doesNotMatch(`${app}\n${game}\n${tokens}`, /viewTransitionNavigation|startViewTransition|sq-route-transition|::view-transition|sq-vt-/);
});