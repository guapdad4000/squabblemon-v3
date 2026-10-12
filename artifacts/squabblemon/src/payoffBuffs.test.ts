import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,createCardInstance,playTurnCard,type Match,type Owner,type Lane} from './gameEngine';
const blank=():Match=>({...createMatch('block','block'),round:2,boards:[[],[],[]],playerHand:[],cpuHand:[],playerMotion:9,cpuMotion:9});
function cast(m:Match,id:string,owner:Owner,lane:Lane=0){const c=createCardInstance(id,owner,'reliability',m.nextEventSequence);return playTurnCard({...m,phase:owner==='player'?'player':'cpu-reveal',playerMotion:9,cpuMotion:9,[owner==='player'?'playerHand':'cpuHand']:[c]},owner,c.instanceId,lane);}

for(const owner of ['player','cpu'] as const){
 test(`${owner}: Ashlee rewards two or three occupied Plant districts, not one`,()=>{
  for(const lanes of [1,2,3]){
   let m=blank();
   for(let lane=1;lane<lanes;lane++)m.boards[lane]=[{...createCardInstance('sprout',owner,'ashlee-fixture',lane),lane:lane as Lane}];
   m=cast(m,'ashlee',owner);
   const ashlee=m.boards.flat().find(c=>c.cardId==='ashlee')!;
   assert.equal(ashlee.powerModifier,lanes>=2?2:0);
   for(const ally of m.boards.flat().filter(c=>c.cardId==='sprout'))assert.equal(ally.powerModifier,2);
  }
 });
 test(`${owner}: Mixtape route rewards require arrival and share a round cap`,()=>{
  let m=blank();const artist={...createCardInstance('studio-couch-yn',owner),lane:0 as Lane};m.boards[0]=[artist];
  m=cast(m,'mixtape-cousin',owner);
  const moved=m.boards.flat().find(c=>c.instanceId===artist.instanceId)!;
  assert.notEqual(moved.lane,0);assert.equal(moved.powerModifier,2);
  assert.equal(m.boards[0].find(c=>c.cardId==='mixtape-cousin')?.powerModifier,1);
  m=cast(m,'mixtape-cousin',owner,moved.lane!);
  assert.equal(m.boards.flat().find(c=>c.instanceId===artist.instanceId)?.lane,moved.lane);
  assert.equal(m.boards.flat().find(c=>c.instanceId===artist.instanceId)?.powerModifier,2);
 });
 test(`${owner}: Studio support still needs another local Music ally`,()=>{
  let m=cast(blank(),'studio-couch-yn',owner);
  assert.equal(m.boards[0][0].powerModifier,0);
  const artist={...createCardInstance('the-opening-act',owner),lane:1 as Lane};m.boards[1]=[artist];
  m=cast(m,'studio-couch-yn',owner,1);
  assert.equal(m.boards[1].find(c=>c.instanceId===artist.instanceId)?.powerModifier,3);
 });
 test(`${owner}: A Spare Gus gains tempo without inflated base Hands`,()=>{
  const c=createCardInstance('gardenwall',owner);assert.equal(c.cost,3);assert.equal(c.basePower,1);
 });
}
