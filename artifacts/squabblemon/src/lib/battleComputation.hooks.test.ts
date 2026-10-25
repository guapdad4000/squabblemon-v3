import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { createMatch } from '../gameEngine';
import { useBattlePreviews } from './useBattleComputation';
import { type PreviewInput } from './battleComputation';
import { BattleWorkerClient, type WorkerPort } from './battleWorkerClient';

test('preview hook clears stale forecasts immediately, accepts latest selection, and cancels ownership on unmount', async () => {
  const priorWorker = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  const priorAct = Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
  const ports: Fake[] = [];
  class Fake implements WorkerPort {
    onmessage: WorkerPort['onmessage'] = null;
    onerror: WorkerPort['onerror'] = null;
    onmessageerror: WorkerPort['onmessageerror'] = null;
    posted: { id: number }[] = [];
    terminated = false;
    constructor() { ports.push(this); }
    postMessage(value: { id: number }) { this.posted.push(value); }
    terminate() { this.terminated = true; }
    reply(index: number, result: unknown) { this.onmessage?.({ data: { id: this.posted[index].id, result } } as MessageEvent); }
  }
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: Fake });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });
  const match = createMatch('block', 'combo');
  const first: PreviewInput = { match, instanceId: match.playerHand[0].instanceId, squabble: false, lane: null, investment: 0 };
  const second = { ...first, lane: 1 };
  let shown: unknown;
  function Probe({ input }: { input: PreviewInput | null }) { shown = useBattlePreviews(input); return null; }
  let renderer: ReturnType<typeof create>;
  try {
    await act(async () => { renderer = create(React.createElement(Probe, { input: first })); });
    assert.equal(ports.length, 1);
    await act(async () => { renderer!.update(React.createElement(Probe, { input: second })); });
    await act(async () => { ports[0].reply(0, ['old']); });
    assert.deepEqual(shown, [], 'old forecast must never reappear after selection changes');
    await act(async () => { ports[0].reply(1, ['latest']); });
    assert.deepEqual(shown, ['latest']);
    await act(async () => { renderer!.update(React.createElement(Probe, { input: null })); });
    assert.deepEqual(shown, []);
    await act(async () => { renderer!.unmount(); });
    assert.ok(ports[0].terminated);
  } finally {
    if (priorWorker) Object.defineProperty(globalThis, 'Worker', priorWorker); else Reflect.deleteProperty(globalThis, 'Worker');
    if (priorAct) Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', priorAct); else Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
  }
});

test('silent worker eviction recovers at watchdog; cancellation disposes old work and warms replacement', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let terminated = 0;
  const client = new BattleWorkerClient(() => ({ onmessage: null, onerror: null, onmessageerror: null, postMessage() {}, terminate() { terminated++; } }));
  const job = { kind: 'previews' as const, input: { match: createMatch('block', 'combo'), instanceId: 'none', squabble: false, lane: null, investment: 0 } };
  const result = client.request(job);
  t.mock.timers.tick(15000);
  assert.deepEqual(await result, [null, null, null]); assert.equal(terminated, 1);
  client.dispose();
  const cancellable = new BattleWorkerClient(() => ({ onmessage: null, onerror: null, onmessageerror: null, postMessage() {}, terminate() { terminated++; } }));
  const cancelled = cancellable.request(job).catch(error => error.name);
  cancellable.cancel(); assert.equal(await cancelled, 'AbortError');
  cancellable.dispose(); assert.equal(terminated, 3);
});
