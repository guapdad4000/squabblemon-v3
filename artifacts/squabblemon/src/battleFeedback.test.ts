import assert from 'node:assert/strict';
import test from 'node:test';
import { BattleFeedback, cueForBattleEvent } from './battleFeedback';
import { createMatch, playCard } from './gameEngine';

test('structured play and reveal events map to distinct cues', () => {
  const match = createMatch('block', 'combo');
  const card = match.playerHand.find(item => item.cost <= match.playerHype)!;
  const resolved = playCard(match, 'player', card.instanceId, 0);
  assert.equal(cueForBattleEvent(resolved.effectLog[0]), 'play');
  assert.equal(cueForBattleEvent(resolved.effectLog[1]), 'reveal');
});

test('a timeline generation emits each event at most once', () => {
  const vibrations: Array<number | number[]> = [];
  const feedback = new BattleFeedback(
    { audioEnabled: false, hapticsEnabled: true },
    () => undefined,
    pattern => { vibrations.push(pattern); return true; },
  );
  const match = createMatch('block', 'combo');
  const card = match.playerHand.find(item => item.cost <= match.playerHype)!;
  const event = playCard(match, 'player', card.instanceId, 0).effectLog[0];
  feedback.emit(event, 4, false, false);
  feedback.emit(event, 4, false, false);
  assert.deepEqual(vibrations, [12]);
  feedback.emit(event, 5, false, false);
  assert.deepEqual(vibrations, [12, 12]);
});

test('reduced motion suppresses haptics and hidden presentation suppresses all cues', () => {
  let vibrations = 0;
  const feedback = new BattleFeedback(
    { audioEnabled: false, hapticsEnabled: true },
    () => undefined,
    () => { vibrations += 1; return true; },
  );
  const match = createMatch('block', 'combo');
  const card = match.playerHand.find(item => item.cost <= match.playerHype)!;
  const event = playCard(match, 'player', card.instanceId, 0).effectLog[0];
  feedback.emit(event, 1, true, false);
  feedback.emit(event, 2, false, true);
  assert.equal(vibrations, 0);
});

test('muted feedback does not create an audio context when unlocked or emitted', () => {
  let contexts = 0;
  const feedback = new BattleFeedback(
    { audioEnabled: false, hapticsEnabled: false },
    () => class { constructor() { contexts += 1; } } as unknown as typeof AudioContext,
  );
  const match = createMatch('block', 'combo');
  const card = match.playerHand.find(item => item.cost <= match.playerHype)!;
  feedback.unlockAudio();
  feedback.emit(playCard(match, 'player', card.instanceId, 0).effectLog[0], 1, false, false);
  assert.equal(contexts, 0);
});

test('a delayed audio resume cannot produce a late cue after reset', async () => {
  let resolveResume!: () => void;
  let oscillators = 0;
  const context = {
    state: 'suspended',
    currentTime: 0,
    destination: {},
    resume: () => new Promise<void>(resolve => { resolveResume = () => { context.state = 'running'; resolve(); }; }),
    createOscillator: () => { oscillators += 1; return {}; },
  };
  const feedback = new BattleFeedback(
    { audioEnabled: true, hapticsEnabled: false },
    () => class { constructor() { return context; } } as unknown as typeof AudioContext,
  );
  const match = createMatch('block', 'combo');
  const card = match.playerHand.find(item => item.cost <= match.playerHype)!;
  feedback.emit(playCard(match, 'player', card.instanceId, 0).effectLog[0], 1, false, false);
  feedback.reset();
  resolveResume();
  await Promise.resolve();
  assert.equal(oscillators, 0);
});

test('unsupported vibration implementations fail quietly', () => {
  const feedback = new BattleFeedback(
    { audioEnabled: false, hapticsEnabled: true },
    () => undefined,
    () => { throw new Error('unsupported'); },
  );
  const match = createMatch('block', 'combo');
  const card = match.playerHand.find(item => item.cost <= match.playerHype)!;
  assert.doesNotThrow(() => feedback.emit(playCard(match, 'player', card.instanceId, 0).effectLog[0], 1, false, false));
});

test('reset stops and disconnects an active audio cue and cancels vibration', () => {
  let stops = 0;
  let oscillatorDisconnects = 0;
  let gainDisconnects = 0;
  const vibrations: Array<number | number[]> = [];
  const oscillator = {
    type: 'sine',
    frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
    connect: () => gain,
    disconnect: () => { oscillatorDisconnects += 1; },
    start() {},
    stop: () => { stops += 1; },
    onended: null as (() => void) | null,
  };
  const gain = {
    gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
    connect() { return gain; },
    disconnect: () => { gainDisconnects += 1; },
  };
  const context = {
    state: 'running',
    currentTime: 0,
    destination: {},
    resume: async () => {},
    createOscillator: () => oscillator,
    createGain: () => gain,
  };
  const feedback = new BattleFeedback(
    { audioEnabled: true, hapticsEnabled: true },
    () => class { constructor() { return context; } } as unknown as typeof AudioContext,
    pattern => { vibrations.push(pattern); return true; },
  );
  const match = createMatch('block', 'combo');
  const card = match.playerHand.find(item => item.cost <= match.playerHype)!;

  feedback.emit(playCard(match, 'player', card.instanceId, 0).effectLog[0], 1, false, false);
  assert.equal(stops, 1, 'the cue schedules its normal end');
  feedback.reset();

  assert.equal(stops, 2, 'reset immediately stops the active source');
  assert.equal(oscillatorDisconnects, 1);
  assert.equal(gainDisconnects, 1);
  assert.deepEqual(vibrations, [12, 0], 'reset cancels any active vibration pattern');
});
