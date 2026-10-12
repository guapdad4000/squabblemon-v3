import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,createCardInstance,playTurnCard,type Match,type Owner,type Lane} from './gameEngine';
const blank=():Match=>({...createMatch('block','block'),round:2,boards:[[],[],[]],playerHand:[],cpuHand:[],playerMotion:9,cpuMotion:9});
function cast(m:Match,id:string,owner:Owner,lane:Lane=0,motion=5,silenced=false){const c=createCardInstance(id,owner,'elemental',m.nextEventSequence);c.statuses.silenced=silenced;return playTurnCard({...m,phase:owner==='player'?'player':'cpu-reveal',playerMotion:motion,cpuMotion:motion,[owner==='player'?'playerHand':'cpuHand']:[c]},owner,c.instanceId,lane);}
for(const owner of ['player','cpu'] as const){
 test(`${owner}: Matcha supports remote Plant, cleanses remote allies and has a solo fallback`,()=>{
  for(const dirty of [false,true]){
   let m=blank();const ally={...createCardInstance(dirty?'cornball':'rastamon',owner),lane:2 as Lane};ally.statuses.frozen=dirty;m.boards[2]=[ally];
   m=cast(m,'rootnurse',owner);const got=m.boards[2][0];assert.equal(got.powerModifier,3);assert.equal(got.statuses.frozen,false);
   const blocked=cast({...blank(),boards:[[],[],[ally]]},'rootnurse',owner,0,5,true);assert.equal(blocked.boards[2][0].powerModifier,0);
  }
  const solo=cast(blank(),'rootnurse',owner);assert.equal(solo.boards[0][0].powerModifier,2);
 });
 test(`${owner}: Plant promise pays once after another card helps, including after serialization`,()=>{
  let m=blank();const ally={...createCardInstance('rastamon',owner),lane:0 as Lane};ally.statuses.frozen=true;m.boards[0]=[ally];
  m=cast(m,'canopykeeper',owner);assert.equal(m.boards[0].find(x=>x.instanceId===ally.instanceId)?.powerModifier,2);
  assert.equal(m.creativeMarks?.filter(x=>x.kind==='promise').length,1);
  m=cast(JSON.parse(JSON.stringify(m)),'rootnurse',owner);
  assert.equal(m.boards[0].find(x=>x.instanceId===ally.instanceId)?.powerModifier,8);
  assert.equal(m.boards[0].find(x=>x.cardId==='canopykeeper')?.powerModifier,1);
  assert.equal(m.creativeMarks?.filter(x=>x.kind==='promise').length,0);
 });
 test(`${owner}: Model pays Air support only after a successful move`,()=>{
  for(const locked of [false,true]) {
   let m=blank();const ally={...createCardInstance('roaster',owner),lane:0 as Lane};m.boards[0]=[ally];
   const model=createCardInstance('cloudbreak',owner);model.statuses.locked=locked;
   m=playTurnCard({...m,phase:owner==='player'?'player':'cpu-reveal',[owner==='player'?'playerHand':'cpuHand']:[model]},owner,model.instanceId,0);
   const moved=m.boards.flat().find(c=>c.instanceId===model.instanceId)!;
   assert.equal(moved.powerModifier,locked?0:1);
   assert.equal(m.boards[0].find(c=>c.instanceId===ally.instanceId)?.powerModifier,locked?0:3);
  }
 });
 test(`${owner}: Dark reactions and cheaper Air route keep their printed Hands`,()=>{
  for(const [id,cost,power] of [['redpill',3,2],['shonuff',3,1],['cloudbreak',3,2]] as const){const c=createCardInstance(id,owner);assert.equal(c.cost,cost);assert.equal(c.basePower,power)}
 });
}
