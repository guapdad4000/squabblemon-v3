import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { cardCatalog, cards, decks } from './data';
import { createCardInstance, createMatch, playTurnCard, getDistrictResults, getMatchWinner, type Match, type Lane } from './gameEngine';
import { createOnlineRoom, joinOnlineRoom, applyOnlineCommand, type OnlineRoom } from '@workspace/squabblemon-engine/multiplayer';
import { pairFixture } from '../../../scripts/src/fullBalanceInteractions';
import { evaluatePublicState, policySearchState } from '../../../scripts/src/fullBalanceSweepCore';
import { listLegalBalancePlays } from '@workspace/squabblemon-engine/balanceLab';
import { TRIPLE_OG_LANE } from '../../../lib/squabblemon-engine/src/tripleOgs';

function roomBase() {
 const member=(userId:string)=>({userId,name:userId,ready:false,deck:decks[0]});
 return joinOnlineRoom(createOnlineRoom(member('host'),'player',0),member('guest'),1);
}

test('all base cards reject malformed PvP commands without changing authority state',()=>{
 let checks=0;const base=roomBase();
 for(const card of cardCatalog)for(const owner of ['player','cpu'] as const){
  const match=pairFixture(card.engineId,'og',false,0,owner);
  const source=match[owner==='player'?'playerHand':'cpuHand'][0];
  const lane=(TRIPLE_OG_LANE[card.engineId]??0) as Lane;
  const room:OnlineRoom={...base,match,status:'active',activeSeat:owner,deadline:100000};
  const before=JSON.stringify(room);
  for(const investment of [-1,0.5,NaN,Infinity,5]){
   assert.throws(()=>applyOnlineCommand(room,owner,{type:'play',instanceId:source.instanceId,lane,squabble:false,investment},10), /Invalid extra Motion investment/);
   checks++;
  }
  assert.throws(()=>applyOnlineCommand(room,owner,{type:'play',instanceId:source.instanceId,lane:99 as Lane,squabble:false},10), /valid district/);checks++;
  assert.throws(()=>applyOnlineCommand(room,owner==='player'?'cpu':'player',{type:'end-turn'},10), /Wait for your turn/);checks++;
  const after=applyOnlineCommand(room,owner,{type:'play',instanceId:source.instanceId,lane,squabble:false},10);
  assert.throws(()=>applyOnlineCommand(after,owner,{type:'play',instanceId:source.instanceId,lane,squabble:false},11), /not in this hand/);checks++;
  assert.equal(JSON.stringify(room),before,card.engineId);
 }
 const report=process.env.FULL_BALANCE_AUTHORITY_REPORT;
 if(report){mkdirSync(report,{recursive:true});writeFileSync(path.join(report,'command-guards.json'),JSON.stringify({cards:cardCatalog.length,seats:2,rejectedCommands:checks,failures:[]},null,2));}
});

test('one district won and two tied is a draw, including either PvP seat',()=>{
 for(const owner of ['player','cpu'] as const){
  const unit={...createCardInstance('og',owner),lane:0 as Lane};
  const match:Match={...createMatch('block','block'),round:6,phase:'complete',boards:[[unit],[],[]]};
  assert.equal(getMatchWinner(match),'draw');
  assert.equal(getMatchWinner({...match,boards:[[unit],[{...unit,instanceId:unit.instanceId+'-2',lane:1}],[]]}),owner);
 }
});

// Neither previews nor their evaluator may use hidden opponent hand setup.
test('PvP policy ignores hidden opponent hand setup while preserving public district scores',()=>{
 for(const owner of ['player','cpu'] as const){
  const rival=owner==='player'?'cpu':'player';
  const streamer={...createCardInstance('streamer',rival),lane:0 as Lane,powerModifier:7};
  const m:Match={...createMatch('block','block'),round:3,boards:[[streamer],[],[]]};
  const hiddenKey=owner==='player'?'cpuHand':'playerHand';
  const cheap={...m,[hiddenKey]:[createCardInstance('baby',rival),createCardInstance('baby',rival,'hidden',1)]};
  const expensive={...m,[hiddenKey]:[createCardInstance('og',rival)]};
  const noHand={...m,[hiddenKey]:[]};
  assert.deepEqual(getDistrictResults(cheap),getDistrictResults(noHand));
  assert.equal(evaluatePublicState(cheap,owner),evaluatePublicState(expensive,owner));
  assert.equal(evaluatePublicState(cheap,owner),evaluatePublicState(noHand,owner));
  assert.equal(cheap.boards[0][0].powerModifier,7);
 }
});

test('PvP previews cannot anticipate a hidden expensive card or an unseen draw',()=>{
 for(const owner of ['player','cpu'] as const){
  const rival=owner==='player'?'cpu':'player',hand=owner==='player'?'playerHand':'cpuHand',hidden=owner==='player'?'cpuHand':'playerHand';
  const promoter=createCardInstance('promoter',owner,'blind-policy',1);
  const m:Match={...createMatch('block','block'),round:3,phase:owner==='player'?'player':'cpu-reveal',boards:[[],[],[]],playerHand:[],cpuHand:[],playerMotion:9,cpuMotion:9,[hand]:[promoter]};
  const cheap={...m,[hidden]:[createCardInstance('cornball',rival,'secret',2)]};
  const expensive={...m,[hidden]:[createCardInstance('guap',rival,'secret',2)],playerCardIds:['guap'],cpuCardIds:['oz']};
  const viewA=policySearchState(cheap,owner),viewB=policySearchState(expensive,owner);
  assert.deepEqual(viewA,viewB);
  const options=(state:Match)=>listLegalBalancePlays(state,owner,true).map(x=>({card:x.cardId,lane:x.lane,cost:x.cost,squabble:x.squabble,value:evaluatePublicState(x.preview,owner)}));
  assert.deepEqual(options(viewA),options(viewB));
  // The real action still reveals the true card and earns the actual conditional reward.
  const a=playTurnCard(cheap,owner,promoter.instanceId,0),b=playTurnCard(expensive,owner,promoter.instanceId,0);
  assert.equal(a.discountTokens.length,0);assert.equal(b.discountTokens.length,1);
  assert.equal(expensive[hidden].length,1,'building the view must not mutate authority');
 }
});
