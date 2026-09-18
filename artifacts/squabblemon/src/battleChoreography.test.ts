import assert from 'node:assert/strict';
import test from 'node:test';
import { battleChanges, eventIntensity } from './battleChoreography';
import { createCardInstance, createMatch, playCard, type Lane } from './gameEngine';

function cast(id: string, targetOwner: 'player' | 'cpu', targetLane: Lane) {
  let match = createMatch('block', 'combo');
  const source = createCardInstance(id, 'player', 'choreography', 0);
  const target = { ...createCardInstance('hooper', targetOwner, 'target', 0), lane: targetLane };
  match = { ...match, playerMotion: 20, playerHand: [source], boards: [[], [], []] };
  match.boards[targetLane].push(target);
  return { target, resolved: playCard(match, 'player', source.instanceId, 0) };
}

test('freeze feedback reflects effective power lost and names the actual victim', () => {
  const { target, resolved } = cast('snow', 'cpu', 0);
  const event = resolved.effectLog.find(event => event.type === 'ability' && event.targets.some(p => p.cardInstanceId === target.instanceId))!;
  const before = JSON.stringify(event);
  const change = battleChanges(event).find(change => change.cardInstanceId === target.instanceId)!;
  assert.equal(change.delta, -target.basePower);
  assert.deepEqual(change.labels, ['Frozen']);
  assert.equal(JSON.stringify(event), before, 'presentation must never modify authoritative events');
});

test('movement feedback preserves both districts and deduplicates participants', () => {
  const { target, resolved } = cast('vibe', 'player', 1);
  const event = resolved.effectLog.find(event => event.type === 'ability' && event.targets.some(p => p.cardInstanceId === target.instanceId))!;
  const changes = battleChanges(event);
  const moved = changes.find(change => change.cardInstanceId === target.instanceId)!;
  assert.equal(moved.before?.lane, 1);
  assert.equal(moved.after?.lane, 0);
  assert.equal(moved.delta, 1);
  assert.ok(moved.labels.includes('Moved'));
  assert.equal(new Set(changes.map(change => change.cardInstanceId)).size, changes.length);
});

test('a takeover needs an actual reversal; opening a tied district stays routine', () => {
  const { resolved } = cast('snow', 'cpu', 0);
  const event = resolved.effectLog[0];
  const before = [{ lane: 0 as Lane, player: 1, cpu: 4 }];
  const after = [{ lane: 0 as Lane, player: 6, cpu: 4 }];
  assert.equal(eventIntensity({ ...event, scores: { before, after } }), 'takeover');
  assert.equal(eventIntensity({ ...event, scores: { before: [{ lane: 0, player: 0, cpu: 0 }], after } }), 'routine');
  assert.equal(eventIntensity({ ...event, note: 'SQUABBLE' }), 'squabble');
});
