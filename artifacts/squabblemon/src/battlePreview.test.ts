import assert from 'node:assert/strict';
import test from 'node:test';
import { previewBattlePlay } from './battlePreview';
import { createMatch, createCardInstance, getDistrictResults, playCard } from './gameEngine';

test('known-board preview predicts a freeze and leaves the live match untouched', () => {
  const match=createMatch('block','combo');
  const snow=createCardInstance('snow','player','preview',0);
  const victim={...createCardInstance('hooper','cpu','preview',1),lane:0 as const};
  match.playerMotion=20;match.playerHand=[snow];match.boards=[[victim],[],[]];
  const before=JSON.stringify(match);
  const preview=previewBattlePlay(match,snow.instanceId,0)!;
  assert.deepEqual(preview.after,getDistrictResults(playCard(match,'player',snow.instanceId,0)));
  assert.ok(preview.targets.includes(victim.instanceId));
  assert.equal(JSON.stringify(match),before);
});

test('preview cannot disclose which private cards the rival holds', () => {
  const match=createMatch('block','combo');
  const card=match.playerHand[0];
  const first=previewBattlePlay(match,card.instanceId,0);
  const other={...match,cpuHand:[createCardInstance('wifey','cpu','secret',0)],cpuCardIds:['wifey']};
  assert.deepEqual(previewBattlePlay(other,card.instanceId,0),first);
});

test('preview respects unaffordable choices and includes the armed Squabble', () => {
  const match=createMatch('block','combo');const card=match.playerHand[0];
  assert.equal(previewBattlePlay({...match,playerMotion:0},card.instanceId,0),null);
  assert.deepEqual(previewBattlePlay(match,card.instanceId,0,true)!.after,getDistrictResults(playCard(match,'player',card.instanceId,0,true)));
});
