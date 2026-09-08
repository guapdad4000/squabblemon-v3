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