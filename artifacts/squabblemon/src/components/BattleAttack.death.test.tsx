import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { BattleAttack } from './BattleAttack';
import { BattleFxImage } from './BattleFxImage';
import { isDefeatMediaReady, warmDefeatMedia } from '../lib/battleDefeatMedia';
import { completeDefeatBeat } from '../lib/battleMediaEvents';
import { cards } from '../data';
import type { PresentationEffect } from './PlayLoop';

// Fail the first attempt, then resolve decoding during an already-running fallback.
// The subsequent effect must receive authored art without changing either timer.
test('defeat media loads outside background work, retries errors, and never replaces a running fallback', async t => {
  const previous = Object.fromEntries(['Image', 'window', 'IS_REACT_ACT_ENVIRONMENT'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  class ImageStub {
    static instances: ImageStub[] = [];
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    decoding = ''; fetchPriority = ''; src = '';
    decoded!: () => void;
    constructor() { ImageStub.instances.push(this); }
    decode() { return new Promise<void>(resolve => { this.decoded = resolve; }); }
    removed = false;
    removeAttribute() { this.removed = true; }
  }
  Object.assign(globalThis, { Image: ImageStub, window: { setTimeout, clearTimeout }, IS_REACT_ACT_ENVIRONMENT: true });
  let renderer: ReturnType<typeof create> | undefined;
  t.after(async () => {
    if (renderer) await act(async () => renderer!.unmount());
    for (const [key, value] of Object.entries(previous)) value ? Object.defineProperty(globalThis, key, value) : Reflect.deleteProperty(globalThis, key);
  });
  const participant = { cardId: 'cornball', cardInstanceId: 'source', owner: 'player', before: { lane: 0, basePower: 4, powerModifier: 0, statuses: {} }, after: null };
  const effect = { sequence: 1, type: 'expiration', kind: 'damage', owner: 'player', cardId: 'cornball', cardInstanceId: 'source', note: '', scores: { before: [], after: [] }, source: participant, targets: [] } as unknown as PresentationEffect;
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const attempt = warmDefeatMedia();
  assert.equal(warmDefeatMedia(), attempt, 'simultaneous targets share two requests');
  assert.equal(ImageStub.instances.length, 2);
  assert.ok(ImageStub.instances.every(image => image.fetchPriority === 'high'));
  ImageStub.instances[0].onerror!();
  t.mock.timers.tick(8000);
  assert.equal(await attempt, false);
  assert.equal(ImageStub.instances[1].removed, true, 'a request that never loads reaches a bounded deadline');
  t.mock.timers.reset();
  await act(async () => { renderer = create(<BattleAttack card={cards.cornball} effect={effect} impact />); });
  const death = () => renderer!.root.findByProps({ 'data-testid': 'destroyed-card' });
  assert.equal(death().props['data-defeat-media'], 'fallback');
  assert.equal(renderer!.root.findByProps({ className: 'defeat-fallback-final' }).children[0], 'KO', 'finale needs no downloaded image');
  const retry = warmDefeatMedia();
  assert.equal(ImageStub.instances.length, 4, 'later combat retries a failed request');
  ImageStub.instances.slice(2).forEach(image => image.onload!());
  assert.equal(isDefeatMediaReady(), false, 'onload alone is not decoded readiness');
  ImageStub.instances.slice(2).forEach(image => image.decoded());
  assert.equal(await retry, true);
  assert.ok(ImageStub.instances.every(image => image.onload === null && image.onerror === null));
  await act(async () => renderer!.update(<BattleAttack card={cards.cornball} effect={effect} impact speed={1.5} />));
  assert.equal(death().props['data-defeat-media'], 'fallback', 'a late download or speed change cannot pop/restart the current beat');
  await act(async () => renderer!.update(<BattleAttack key="next" card={cards.cornball} effect={{ ...effect, sequence: 2 }} impact />));
  assert.equal(death().props['data-defeat-media'], 'atlas');
  assert.equal(renderer!.root.findAllByProps({ className: 'defeat-tombstone' }).length, 1);
  assert.equal(completeDefeatBeat(effect, 650), 5760, 'media availability never changes the authored queue duration');
  assert.equal(completeDefeatBeat({ ...effect, source: { ...effect.source!, departureCause: 'transformation' } }, 650), 650, 'neutral departures keep their ordinary beat');
});


test('movement keeps both authored dust placements and retires each at its parent fade endpoint', async t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, writable: true, value: true });
  let renderer: ReturnType<typeof create> | undefined;
  t.after(async () => {
    if (renderer) await act(async () => renderer!.unmount());
    if (previous) Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', previous);
    else Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
  });
  const before = { lane: 0, basePower: 4, powerModifier: 0, statuses: { burnStacks: 0 } };
  const participant = { cardId: 'cornball', cardInstanceId: 'moving', owner: 'player', before, after: { ...before, lane: 1 } };
  const effect = { sequence: 2, type: 'expiration', kind: 'move', owner: 'player', cardId: 'cornball', cardInstanceId: 'moving', note: '', scores: { before: [], after: [] }, source: participant, targets: [] } as unknown as PresentationEffect;
  await act(async () => { renderer = create(<BattleAttack card={cards.cornball} effect={effect} impact speed={1.5} />); });
  const dust = renderer!.root.findAllByType(BattleFxImage).filter(node => node.props.kind === 'movement-dust');
  assert.equal(dust.length, 2, 'both departure and arrival retain the supplied artwork');
  assert.deepEqual(dust.map(node => node.parent!.props['data-geo-role']), ['departure', 'box']);
  assert.ok(dust.every(node => node.props.retireOnParentAnimationEnd === 'supplied-dust-fade'), 'both follow the CSS endpoint, including presentation-speed changes');
});
