import test from 'node:test';
import {selectedMoved,selectedResolved} from '../../../lib/squabblemon-engine/src/selectedAbilities';
import type {MusicTools} from '../../../lib/squabblemon-engine/src/musicIndustryAbilities';
import assert from 'node:assert/strict';
import {cards} from './data';
import {createMatch,createCardInstance,playTurnCard,getLegalCardCost,type Match,type Owner,type Lane} from './gameEngine';
const blank=():Match=>({...createMatch('block','block'),round:2,boards:[[],[],[]],playerHand:[],cpuHand:[],playerMotion:9,cpuMotion:9});
function cast(m:Match,id:string,owner:Owner,lane:Lane=0){const c=createCardInstance(id,owner,'reliability',m.nextEventSequence);return playTurnCard({...m,phase:owner==='player'?'player':'cpu-reveal',playerMotion:9,cpuMotion:9,[owner==='player'?'playerHand':'cpuHand']:[c]},owner,c.instanceId,lane);}
for(const owner of ['player','cpu'] as const){
 test(`${owner}: Auntie reserves one plate, ignores other lanes and enemies, then pays once`,()=>{
  let m=cast(blank(),'plate-auntie',owner);
  assert.equal(m.creativeMarks?.filter(x=>x.kind==='sw-plate-pending').length,1);
  m=cast(m,'big-sister',owner,1);
  m=cast(m,'big-sister',owner==='player'?'cpu':'player');
  assert.equal(m.creativeMarks?.filter(x=>x.kind==='sw-plate-pending').length,1);
  m=cast({...m,round:3},'big-sister',owner);
  const target=m.boards[0].find(x=>x.owner===owner&&x.cardId==='big-sister')!;
  assert.equal(target.powerModifier,3);
  assert.equal(m.creativeMarks?.filter(x=>x.kind==='sw-plate-pending').length,0);
  m=cast(m,'big-sister',owner);
  assert.equal(m.boards[0].filter(x=>x.owner===owner&&x.cardId==='big-sister').reduce((n,c)=>n+c.powerModifier,0),3);
 });
 test(`${owner}: Auntie expired reservation and silenced source cannot pay`,()=>{
  for(const expired of [false,true]){let m=cast(blank(),'plate-auntie',owner);
   if(expired)m={...m,round:4};else m={...m,boards:m.boards.map(l=>l.map(c=>({...c,statuses:{...c.statuses,silenced:true}}))) as Match['boards']};
   m=cast(m,'big-sister',owner);assert.equal(m.boards[0].find(x=>x.cardId==='big-sister')?.powerModifier,0);
  }
 });
 test(`${owner}: Merch credit survives following round and then expires`,()=>{
  let m=blank();const artist={...createCardInstance('the-rapper',owner),lane:0 as Lane};m.boards[0]=[artist];
  m=cast(m,'merch-table-hustler',owner);m=cast(m,'studio-couch-yn',owner);
  assert.equal(m.discountTokens.filter(t=>t.eligibility==='selected-music').length,1);
  const c=createCardInstance('mixtape-cousin',owner);
  assert.equal(getLegalCardCost({...m,round:3},owner,c,0),1);
  assert.equal(getLegalCardCost({...m,round:3},owner,c,1),2);
  assert.equal(getLegalCardCost({...m,round:4},owner,c,0),2);
 });
 test(`${owner}: promise can resolve in second following round, still only once`,()=>{
  let m=blank();const hurt={...createCardInstance('og',owner),lane:0 as Lane,powerModifier:-2,recoverableDamage:2};m.boards[0]=[hurt];
  m=cast(m,'canopykeeper',owner);assert.equal(m.creativeMarks?.find(x=>x.kind==='promise')?.expires,4);
  m=cast({...m,round:4},'abuela',owner);
  assert.equal(m.boards[0].find(x=>x.cardId==='canopykeeper')?.powerModifier,1);
  assert(!m.creativeMarks?.some(x=>x.kind==='promise'));
  m=cast(m,'abuela',owner);assert.equal(m.boards[0].find(x=>x.cardId==='canopykeeper')?.powerModifier,1);
 });
}
test('Nerd retains his cost and silence with five printed Hands after rejecting the experimental nerf',()=>{assert.equal(cards.nerd.power,5);assert.equal(cards.nerd.cost,3);assert.match(cards.nerd.effect,/silenc/i);});

for(const owner of ['player','cpu'] as const) test(`${owner}: movement can claim a reserved plate; echo resolution cannot`,()=>{
 let m=cast(blank(),'plate-auntie',owner);
 const entrant={...createCardInstance('big-sister',owner),lane:1 as Lane};
 m={...m,boards:[m.boards[0],[entrant],[]]};
 const tools={
  buff:(state:Match,id:string,n:number)=>({...state,boards:state.boards.map(l=>l.map(c=>c.instanceId===id?{...c,powerModifier:c.powerModifier+n}:c)) as Match['boards']}),
  event:(_before:Match,after:Match)=>after,
 } as unknown as MusicTools;
 const moved={...m,boards:[[...m.boards[0],{...entrant,lane:0 as Lane}],[],[]] as Match['boards']};
 const echoed=selectedResolved(m,moved,{...entrant,lane:0},tools,true);
 assert.equal(echoed.creativeMarks?.filter(x=>x.kind==='sw-plate-pending').length,1);
 const paid=selectedMoved(m,moved,entrant.instanceId,tools);
 assert.equal(paid.boards[0].find(c=>c.instanceId===entrant.instanceId)?.powerModifier,3);
 assert.equal(paid.creativeMarks?.filter(x=>x.kind==='sw-plate-pending').length,0);
});

for(const owner of ['player','cpu'] as const){
 test(`${owner}: promise expires after its extended window`,()=>{
  let m=blank();const hurt={...createCardInstance('og',owner),lane:0 as Lane,powerModifier:-2,recoverableDamage:2};m.boards[0]=[hurt];
  m=cast(m,'canopykeeper',owner);m=cast({...m,round:5},'abuela',owner);
  assert.equal(m.boards[0].find(c=>c.cardId==='canopykeeper')?.powerModifier,0);
 });
 test(`${owner}: longer Merch credit never earns a third payout`,()=>{
  let m=blank();m.boards[0]=[{...createCardInstance('the-rapper',owner),lane:0 as Lane}];m=cast(m,'merch-table-hustler',owner);
  for(const round of [2,3,4])m=cast({...m,round},'studio-couch-yn',owner);
  assert.equal(m.creativeMarks?.find(x=>x.id.endsWith(':merch-table-hustler'))?.amount,2);
  const cheap=createCardInstance('studio-couch-yn',owner);assert.equal(getLegalCardCost(m,owner,cheap,0),1);
 });
}
for(const owner of ['player','cpu'] as const){
 test(`${owner}: reserved plate pays on arrival before a self-moving reveal`,()=>{
  let m=cast(blank(),'plate-auntie',owner);m=cast(m,'the-favorite-grandchild',owner);
  const child=m.boards.flat().find(c=>c.cardId==='the-favorite-grandchild')!;
  assert.notEqual(child.lane,0);assert.equal(child.powerModifier,3);
  assert(!m.creativeMarks?.some(x=>x.kind==='sw-plate-pending'));
 });
 test(`${owner}: canceled entrance still counts as arrival for the saved plate`,()=>{
  let m=cast(blank(),'plate-auntie',owner);
  const rival:Owner=owner==='player'?'cpu':'player';const source=createCardInstance('nerd',rival);
  m={...m,districtTraps:[{kind:'stakeout',owner:rival,lane:0,source,expiresAfterRound:3}]};
  m=cast(m,'the-favorite-grandchild',owner);
  const child=m.boards.flat().find(c=>c.cardId==='the-favorite-grandchild')!;
  assert.equal(child.lane,0);assert.equal(child.powerModifier,3);
 });
}
