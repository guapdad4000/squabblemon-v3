import assert from 'node:assert/strict';
import test from 'node:test';
import {
  claimResultBroadcastOnce,
  isResultBroadcastEligible,
  isTrainingCircuitActivity,
  resultBroadcastOutcome,
} from './resultBroadcastEligibility';

test('result stingers are limited to completed Story and explicit Training Circuit matches', () => {
  assert.equal(isResultBroadcastEligible({ mode: 'story', phase: 'complete' }), true);
  assert.equal(isResultBroadcastEligible({ mode: 'story', phase: 'player' }), false);
  assert.equal(isResultBroadcastEligible({ mode: 'practice', trainingCircuit: true, phase: 'complete' }), true);
  assert.equal(isResultBroadcastEligible({ mode: 'practice', phase: 'complete' }), false);
  assert.equal(isResultBroadcastEligible({ mode: 'tutorial', trainingCircuit: true, phase: 'complete' }), false);
  assert.equal(isResultBroadcastEligible({ mode: 'guest', trainingCircuit: true, phase: 'complete' }), false);
});

test('only Training Circuit activity ids establish explicit training context', () => {
  for (const activity of ['auto', 'fair', 'pressure', 'control', 'movement', 'support', 'freeze', 'cheap']) {
    assert.equal(isTrainingCircuitActivity(activity), true, activity);
  }
  for (const activity of ['draft', 'neighborhood', 'boss', 'rookie-road', undefined]) {
    assert.equal(isTrainingCircuitActivity(activity), false, String(activity));
  }
});

test('completed result presentation is once-only per match and maps winners to outcome tags', () => {
  const played = new Set<string>();
  assert.equal(claimResultBroadcastOnce(played, 'match-1'), true);
  assert.equal(claimResultBroadcastOnce(played, 'match-1'), false);
  assert.equal(claimResultBroadcastOnce(played, 'match-2'), true);
  assert.equal(resultBroadcastOutcome('player'), 'victory');
  assert.equal(resultBroadcastOutcome('cpu'), 'defeat');
  assert.equal(resultBroadcastOutcome('draw'), 'draw');
});