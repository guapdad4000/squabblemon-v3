import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, createCardInstance, playCard } from './gameEngine';
import { battleChanges } from './battleChoreography';
import { buildReplayFrame } from './components/PlayLoop';

function setup(attacker = 'roaster', power = 2) {
  const source = createCardInstance(attacker, 'player', 'destruction', 0);
  const target = { ...createCardInstance('hooper', 'cpu', 'destruction', 1), lane: 0 as const, basePower: power };
  const match = createMatch('block', 'combo');
  match.playerHand = [source]; match.playerMotion = 20; match.boards = [[target], [], []];
  return { source, target, match };
}

test('lethal damage removes a card, records destruction and restores it only in replay before impact', () => {
  const { source, target, match } = setup();
  const before = JSON.stringify(match);
  const result = playCard(match, 'player', source.instanceId, 0);
  assert.equal(result.boards.flat().some(c => c.instanceId === target.instanceId), false);
  assert.equal(JSON.stringify(match), before);
  const event = result.effectLog.find(e => e.targets.some(t => t.cardInstanceId === target.instanceId))!;
  assert.equal(event.targets.find(t => t.cardInstanceId === target.instanceId)!.after, null);
  assert.match(event.note, /destroyed/);
  assert.deepEqual(battleChanges(event).find(c => c.cardInstanceId === target.instanceId)!.labels, ['Destroyed']);
  assert.ok(buildReplayFrame(result, event, 'before').boards.flat().some(c => c.instanceId === target.instanceId));
  assert.equal(buildReplayFrame(result, event, 'after').boards.flat().some(c => c.instanceId === target.instanceId), false);
});
test('freeze is reversible and cannot destroy a card by setting effective Hands to zero', () => {
  const { source, target, match } = setup('snow');
  const result = playCard(match, 'player', source.instanceId, 0);
  assert.equal(result.boards[0].find(c => c.instanceId === target.instanceId)?.statuses.frozen, true);
});
test('covered blocks lethal damage; nonlethal damage leaves the card alive', () => {
  for (const protectedTarget of [true, false]) {
    const { source, target, match } = setup('roaster', protectedTarget ? 1 : 5);
    if (protectedTarget) match.timedEffects.push({ id:'cover', kind:'church-protection', sourceInstanceId:'church', targetInstanceId:target.instanceId, owner:'cpu', lane:0, startsAtRound:1, expiresAtRound:7, expiration:'match-complete' });
    const result = playCard(match, 'player', source.instanceId, 0);
    const survivor = result.boards[0].find(c => c.instanceId === target.instanceId)!;
    assert.ok(survivor);
    assert.equal(survivor.powerModifier, protectedTarget ? 0 : -2);
  }
});
