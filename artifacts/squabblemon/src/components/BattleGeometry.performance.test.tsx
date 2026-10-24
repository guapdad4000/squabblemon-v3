import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { frame } from 'framer-motion';
import { BattleFormation } from './BattleFormation';
import { BattleAttack } from './BattleAttack';
import { cards } from '../data';
import type { PresentationEffect } from './PlayLoop';
import { battleBoardLayoutDependency, battleItemStripPresence } from './BattleBoardCard';

function globals(values: Record<string, unknown>) {
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  return () => { for (const [key, value] of Object.entries(previous)) value ? Object.defineProperty(globalThis, key, value) : Reflect.deleteProperty(globalThis, key); };
}

test('formation batches reads, caches scroll geometry, and invalidates on direct card resizing', async t => {
  const reads = new Set<() => void>(), writes = new Set<() => void>();
  t.mock.method(frame, 'read', (callback: () => void) => { reads.add(callback); return callback; });
  t.mock.method(frame, 'update', (callback: () => void) => { writes.add(callback); return callback; });
  const flush = async () => { await act(async () => { const batch = [...reads]; reads.clear(); batch.forEach(callback => callback()); const paint = [...writes]; writes.clear(); paint.forEach(callback => callback()); }); };
  let offsetReads = 0, resized: (() => void) | undefined, mutated: (() => void) | undefined;
  const observed = new Set<object>();
  class Tile {
    constructor(public top: number, public height = 90) {}
    matches() { return true; }
    get offsetTop() { offsetReads++; return this.top; }
    get offsetHeight() { offsetReads++; return this.height; }
  }
  const stack = Object.assign(new EventTarget(), {
    children: Array.from({ length: 6 }, (_, index) => new Tile(Math.floor(index / 2) * 100)),
    clientHeight: 150, scrollHeight: 290, scrollTop: 0,
    dataset: { crowded: 'true' }, closest: () => null,
    scrollTo: ({ top }: { top: number }) => { stack.scrollTop = top; },
  });
  const restore = globals({ HTMLElement: Tile, IS_REACT_ACT_ENVIRONMENT: true, window: new EventTarget(),
    ResizeObserver: class { constructor(callback: () => void) { resized = callback; } observe(node: object) { observed.add(node); } unobserve(node: object) { observed.delete(node); } disconnect() { observed.clear(); } },
    MutationObserver: class { constructor(callback: () => void) { mutated = callback; } observe() {} disconnect() {} },
  });
  let renderer!: ReturnType<typeof create>;
  t.after(async () => { await act(async () => renderer.unmount()); restore(); });
  await act(async () => { renderer = create(<BattleFormation count={6} label="Test gang" onInspect={() => {}} testId="formation">{null}</BattleFormation>, { createNodeMock: node => (node.props as { 'data-testid'?: string })['data-testid'] === 'formation' ? stack : null }); });
  assert.equal(offsetReads, 0, 'React effects schedule, rather than force, layout');
  await flush();
  assert.equal(offsetReads, 12, 'each card offset and height is read once');
  assert.equal(observed.size, 7, 'observe the viewport plus all direct cards');
  const continuation = () => renderer.root.find(node => node.props.className === 'battle-formation-continuation');
  assert.match(continuation().props['aria-label'], /4 more cards below/);
  stack.scrollTop = 100;
  stack.dispatchEvent(new Event('scroll'));
  stack.dispatchEvent(new Event('scroll'));
  assert.equal(reads.size, 1, 'one read for repeated events in the same frame');
  await flush();
  assert.equal(offsetReads, 12, 'smooth scroll reuses stable card row geometry');
  assert.match(continuation().props['aria-label'], /2 more cards below/);
  stack.children[4].height = 20;
  stack.children[5].height = 20;
  resized?.();
  await flush();
  assert.equal(offsetReads, 24, 'card-only resize refreshes the cached geometry');
  assert.match(continuation().props['aria-label'], /Return to the first row/);
  const removed = stack.children.pop()!;
  mutated?.();
  await flush();
  assert(!observed.has(removed), 'removed cards release resize observation');
  const group = renderer.root.find(node => node.props['data-testid'] === 'formation');
  const keyboard = { target: stack, currentTarget: stack, key: 'Home', preventDefault() {} };
  group.props.onKeyDown(keyboard);
  assert.equal(stack.scrollTop, 0, 'keyboard access keeps the first row reachable');
});

test('attack geometry reads before writing, preserves exact anchors, and ignores stale frames', async t => {
  const reads = new Set<() => void>(), paints = new Set<() => void>();
  t.mock.method(frame, 'read', (callback: () => void) => { reads.add(callback); return callback; });
  t.mock.method(frame, 'render', (callback: () => void) => { paints.add(callback); return callback; });
  let layoutReads = 0;
  const box = (x: number, y: number, width: number, height: number) => ({ x, y, left: x, top: y, right: x + width, bottom: y + height, width, height });
  const cardNode = (id: string, x: number) => ({ dataset: { instanceId: id }, closest: () => null, getBoundingClientRect: () => { layoutReads++; return box(x, 100, 100, 140); } });
  const source = cardNode('source', 100), target = cardNode('target', 300);
  const path = { value: '', setAttribute(_name: string, value: string) { this.value = value; } };
  class Group { dataset = { attackTarget: 'target' }; style = { display: 'none' }; querySelectorAll() { return [path]; } }
  const group = new Group();
  const arena = { querySelectorAll: () => [source, target], getBoundingClientRect: () => { layoutReads++; return box(0, 0, 500, 600); } };
  const overlay = { parentElement: arena, querySelector: () => ({}), querySelectorAll: (selector: string) => selector === '[data-attack-target]' ? [group] : [] };
  const restore = globals({ IS_REACT_ACT_ENVIRONMENT: true, SVGElement: Group,
    ResizeObserver: class { observe() {} disconnect() {} },
  });
  let renderer!: ReturnType<typeof create>;
  t.after(async () => { if (renderer) await act(async () => renderer.unmount()); restore(); });
  const effect = { sequence: 1, type: 'expiration', kind: 'expired', owner: 'player', cardId: 'cornball', cardInstanceId: 'source', note: '', scores: { before: [], after: [] }, source: { cardInstanceId: 'source', before: null, after: null }, targets: [{ cardInstanceId: 'target', before: null, after: null }] } as unknown as PresentationEffect;
  await act(async () => { renderer = create(<BattleAttack card={cards.cornball} effect={effect} impact={false} />, { createNodeMock: node => (node.props as { 'data-testid'?: string })['data-testid'] === 'character-attack' ? overlay : null }); });
  assert.equal(layoutReads, 0);
  assert.equal(group.style.display, 'none', 'unmeasured geometry stays hidden');
  await act(async () => { const batch = [...reads]; reads.clear(); batch.forEach(callback => callback()); });
  assert.equal(layoutReads, 3, 'one arena read and one read per participating card');
  assert.equal(path.value, '', 'the read phase does not write overlay geometry');
  await act(async () => { const batch = [...paints]; paints.clear(); batch.forEach(callback => callback()); });
  assert.equal(group.style.display, '');
  assert.equal(path.value, 'M 150 170 Q 285 170 350 170');
  await act(async () => renderer.update(<BattleAttack card={cards.cornball} effect={effect} impact={true} />));
  await act(async () => renderer.unmount());
  const before = layoutReads;
  [...reads].forEach(callback => callback());
  assert.equal(layoutReads, before, 'unmount prevents any queued stale geometry work');
});

test('self-only defeat captures the original card before impact removes it', async t => {
  const reads = new Set<() => void>(), paints = new Set<() => void>();
  t.mock.method(frame, 'read', (callback: () => void) => { reads.add(callback); return callback; });
  t.mock.method(frame, 'render', (callback: () => void) => { paints.add(callback); return callback; });
  const flush = async () => { await act(async () => { const batch = [...reads]; reads.clear(); batch.forEach(callback => callback()); const paint = [...paints]; paints.clear(); paint.forEach(callback => callback()); }); };
  let impacted = false, cardReads = 0;
  const bounds = { x: 0, y: 0, left: 0, top: 0, width: 500, height: 600, right: 500, bottom: 600 };
  const card = { dataset: { instanceId: 'source' }, closest: () => null, getBoundingClientRect: () => { cardReads++; return { ...bounds, x: 100, y: 100, left: 100, top: 100, width: 100, height: 140, right: 200, bottom: 240 }; } };
  const node = { dataset: { geoChange: 'source', geoRole: 'box' }, style: { display: 'none', left: '', top: '', width: '', height: '' } };
  const zone = { getBoundingClientRect: () => bounds };
  const arena = { querySelectorAll: () => impacted ? [] : [card], querySelector: () => zone, getBoundingClientRect: () => bounds };
  const overlay = { parentElement: arena, querySelector: () => impacted ? node : null, querySelectorAll: (selector: string) => impacted && selector === '[data-geo-change]' ? [node] : [] };
  const restore = globals({ IS_REACT_ACT_ENVIRONMENT: true, window: { setTimeout, clearTimeout }, SVGElement: class {}, ResizeObserver: class { observe() {} disconnect() {} } });
  let renderer!: ReturnType<typeof create>;
  t.after(async () => { await act(async () => renderer.unmount()); restore(); });
  const participant = { cardId: 'cornball', cardInstanceId: 'source', owner: 'player', before: { lane: 0, basePower: 4, powerModifier: 0, statuses: {} }, after: null };
  const effect = { sequence: 2, type: 'expiration', kind: 'damage', owner: 'player', cardId: 'cornball', cardInstanceId: 'source', note: '', scores: { before: [], after: [] }, source: participant, targets: [] } as unknown as PresentationEffect;
  const render = () => <BattleAttack card={cards.cornball} effect={effect} impact={impacted} />;
  await act(async () => { renderer = create(render(), { createNodeMock: candidate => (candidate.props as { 'data-testid'?: string })['data-testid'] === 'character-attack' ? overlay : null }); });
  await flush();
  assert.equal(cardReads, 1, 'capture before removal even without a visible beam');
  impacted = true;
  await act(async () => renderer.update(render()));
  await flush();
  assert.deepEqual(node.style, { display: '', left: '150px', top: '170px', width: '100px', height: '140px' }, 'the defeat remains at the original card, not the zone fallback');
});


test('board layout tracks all shared slot changes while ignoring card stat updates', () => {
  const a = { instanceId: 'a', owner: 'player' as const, powerModifier: 0 };
  const b = { instanceId: 'b', owner: 'cpu' as const, powerModifier: 0 };
  const boards = [[a, b], [], []];
  const key = battleBoardLayoutDependency(boards, null, 'live');
  const strengthened = { ...a, powerModifier: 4 };
  assert.equal(battleBoardLayoutDependency([[strengthened, b], [], []], null, 'live'), key);
  for (const changed of [
    [[b, a], [], []], // Reordering preserves counts but changes slots.
    [[a], [b], []], // Moving between locations.
    [[a, { ...b, owner: 'player' as const }], [], []], // Capture changes formations.
    [[a, b, ...[2, 3, 4, 5].map(i => ({ ...b, instanceId: `cpu-${i}` }))], [], []], // Opposing footer changes the shared grid.
    [[a], [], []], // Defeat/removal.
  ]) assert.notEqual(battleBoardLayoutDependency(changed, null, 'live'), key);
  const staged = { instanceId: 'staged', owner: 'player' as const, lane: 0 };
  assert.notEqual(battleBoardLayoutDependency(boards, staged, 'live'), key);
  assert.notEqual(battleBoardLayoutDependency(boards, { ...staged, lane: 1 }, 'live'), battleBoardLayoutDependency(boards, staged, 'live'));
  assert.notEqual(battleBoardLayoutDependency(boards, null, 'review'), key);
});


test('board layout follows item strip presence without measuring item value or count changes', () => {
  const item = { lane: 0 as const, artworkId: 'seed', text: 'One seed', progress: { current: 1, total: 3 } };
  const changedValue = { ...item, text: 'Growing', progress: { current: 2, total: 3 } };
  const anotherItem = { ...item, artworkId: 'packed-lunch' };
  const plainMark = { lane: 1 as const, text: 'No artwork' };
  const boards = [[{ instanceId: 'same-card', owner: 'player' as const }], [], []];
  const dependency = (marks: Parameters<typeof battleItemStripPresence>[0]) =>
    battleBoardLayoutDependency(boards, null, JSON.stringify(['live', battleItemStripPresence(marks, 3)]));
  assert.deepEqual(battleItemStripPresence([item, plainMark], 3), [true, false, false]);
  assert.equal(dependency([changedValue]), dependency([item]), 'counters and text keep the same slot geometry');
  assert.equal(dependency([item, anotherItem, plainMark]), dependency([item]), 'extra badges in the same strip and text-only marks do not change its height');
  assert.notEqual(dependency([]), dependency([item]), 'adding or removing the strip changes geometry despite unchanged cards');
  const movedItem = { ...item, lane: 1 as const };
  assert.notEqual(dependency([movedItem]), dependency([item]), 'moving the strip to another lane changes that layout');
});
