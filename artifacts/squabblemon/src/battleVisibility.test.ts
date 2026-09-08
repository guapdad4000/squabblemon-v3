import assert from 'node:assert/strict';
import test from 'node:test';
import { BattleFeedback } from './battleFeedback';
import { settleHiddenBattlePresentation } from './battleVisibility';
import { createMatch, playCard } from './gameEngine';
import { PresentationTimeline, type TimerHandle } from './presentationTimeline';

test('backgrounding during an effect delay silently completes the active presentation', async () => {
  const scheduled = new Map<TimerHandle, () => void>();
  const timeline = new PresentationTimeline(
    callback => {
      const handle = scheduled.size as unknown as TimerHandle;
      scheduled.set(handle, callback);
      return handle;
    },
    handle => { scheduled.delete(handle); },
  );
  const vibrations: Array<number | number[]> = [];
  const feedback = new BattleFeedback(
    { audioEnabled: false, hapticsEnabled: true },
    () => undefined,
    pattern => { vibrations.push(pattern); return true; },
  );
  const match = createMatch('block', 'combo');
  const card = match.playerHand.find(item => item.cost <= match.playerHype)!;
  const events = playCard(match, 'player', card.instanceId, 0).effectLog;
  let fastForward = false;
  let reachedValidState = false;

  const presentation = (async () => {
    feedback.emit(events[0], timeline.id, false, false);
    if (!await timeline.wait(500)) return;
    if (!fastForward) feedback.emit(events[1], timeline.id, false, false);
    reachedValidState = true;
  })();

  assert.deepEqual(vibrations, [12]);
  assert.equal(settleHiddenBattlePresentation('effects', feedback, timeline, () => { fastForward = true; }), true);
  await presentation;
  assert.equal(reachedValidState, true);
  assert.deepEqual(vibrations, [12, 0], 'the active vibration is cancelled without a continuation cue');
  assert.equal(scheduled.size, 0);
});

test('backgrounding at the player decision does not silence the next move', () => {
  let fastForward = false;
  let completed = false;
  const feedback = { reset() {} };
  const timeline = { completeAll() { completed = true; } };

  assert.equal(settleHiddenBattlePresentation('player-ready', feedback, timeline, () => { fastForward = true; }), false);
  assert.equal(fastForward, false);
  assert.equal(completed, false);
});