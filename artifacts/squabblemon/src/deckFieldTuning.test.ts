import test from 'node:test';
import assert from 'node:assert/strict';
import {cards} from '../../../lib/squabblemon-engine/src/data';
import {createMatch,createCardInstance,playTurnCard,type Match,type Owner,type Lane,type CardInstance} from '../../../lib/squabblemon-engine/src/gameEngine';
const blank=():Match=>({...createMatch('block','block'),round:3,phase:'player',boards:[[],[],[]],playerHand:[],cpuHand:[],playerMotion:9,cpuMotion:9,playerCardIds:[],cpuCardIds:[]});
const unit=(id:string,owner:Owner,lane:Lane,index:number):CardInstance=>({...createCardInstance(id,owner,'field',index),lane,playedRound:3});
const find=(m:Match,c:CardInstance)=>m.boards.flat().find(x=>x.instanceId===c.instanceId);
function cast(m:Match,id:string,owner:Owner,lane:Lane,index=100){const s=createCardInstance(id,owner,'field',index);const n=playTurnCard({...m,phase:owner==='player'?'player':'cpu-reveal',[owner==='player'?'playerHand':'cpuHand']:[...m[owner==='player'?'playerHand':'cpuHand'],s]},owner,s.instanceId,lane);return {m:n,s};}
for(const owner of ['player','cpu'] as const){
 const rival:Owner=owner==='player'?'cpu':'player';
 test(`${owner}: Sneaker retains Weaken with a three-Hand theft ceiling`,()=>{
  const m=blank(),foe=unit('guap',rival,0,1);m.boards[0]=[foe];const r=cast(m,'sneaker',owner,0);
  assert.equal(find(r.m,r.s)?.powerModifier,3);assert.equal(find(r.m,foe)?.statuses.weakened,true);
 });
 test(`${owner}: Blue remote payoff is four and still grants Protection`,()=>{
  const m=blank(),ally=unit('ganger-blue',owner,1,1);m.boards[1]=[ally];const r=cast(m,'ganger-blue',owner,0);
  assert.equal(find(r.m,ally)?.powerModifier,4);assert.equal(find(r.m,ally)?.statuses.protected,true);assert.equal(find(r.m,r.s)?.powerModifier,1);
 });
 test(`${owner}: Cellblock keeps local three but remote two`,()=>{
  const m=blank(),local=unit('inmate-crafty',owner,0,1),remote=unit('inmate-informant',owner,1,2);m.boards=[[local],[remote],[]];const r=cast(m,'inmate-boyfriend',owner,0);
  assert.equal(find(r.m,local)?.powerModifier,3);assert.equal(find(r.m,remote)?.powerModifier,2);
 });
 test(`${owner}: Cook heals bounded damage and keeps homeless Protection`,()=>{
  let m=blank();const ally={...unit('homelessguy',owner,0,1),powerModifier:-4};m.boards[0]=[ally];let r=cast(m,'community-cook',owner,0);
  assert.equal(find(r.m,ally)?.powerModifier,2);assert.equal(find(r.m,ally)?.statuses.protected,true);
  m=blank();m.boards[0]=[{...ally,powerModifier:0}];r=cast(m,'community-cook',owner,0);assert.equal(find(r.m,ally)?.powerModifier,5);
 });
 test(`${owner}: bus bonus requires arrival and pays once per driver`,()=>{
  let m=blank();const ally=unit('homelessguy',owner,1,1);m.boards[1]=[ally];let r=cast(m,'night-bus-driver',owner,0);assert.equal(find(r.m,ally)?.powerModifier,2);assert.equal(find(r.m,ally)?.lane,0);
  const bus=find(r.m,r.s)!,rider=find(r.m,ally)!,handKey=owner==='player'?'playerHand':'cpuHand';
  const returned={...r.m,boards:[[],[{...rider,lane:1 as Lane}],[]] as Match['boards'],playerMotion:9,cpuMotion:9,[handKey]:[{...bus,lane:null}],phase:owner==='player'?'player' as const:'cpu-reveal' as const};
  const replayed=playTurnCard(returned,owner,bus.instanceId,0);assert.equal(find(replayed,ally)?.lane,0);assert.equal(find(replayed,ally)?.powerModifier,2,'returning the same driver cannot repay the bonus');
  m=blank();m.boards[1]=[{...ally,statuses:{...ally.statuses,locked:true}}];r=cast(m,'night-bus-driver',owner,0);assert.equal(find(r.m,ally)?.powerModifier,0);assert.equal(find(r.m,ally)?.lane,1);
 });
 test(`${owner}: Spinback adds two to returned hand card only once per side`,()=>{
  let m=blank();const artist={...unit('studio-couch-yn',owner,0,1),powerModifier:3};m.boards[0]=[artist];let r=cast(m,'the-dj',owner,0);const key=owner==='player'?'playerHand':'cpuHand';assert.equal(r.m[key].find(c=>c.instanceId===artist.instanceId)?.powerModifier,5);
  m={...r.m,playerMotion:9,cpuMotion:9};const second=unit('studio-couch-yn',owner,0,2);m.boards[0].push(second);r=cast(m,'the-dj',owner,0,101);assert.ok(find(r.m,second));assert.equal(r.m[key].find(c=>c.instanceId===artist.instanceId)?.powerModifier,5);
 });
 test(`${owner}: Music rider grants one on actual deployment then expires`,()=>{
  let m=cast(blank(),'the-manager-nice',owner,0).m;const r=cast(m,'studio-couch-yn',owner,1,101);assert.equal(find(r.m,r.s)?.powerModifier,1);assert.equal(find(r.m,r.s)?.statuses.protected,true);
  m={...r.m,playerMotion:9,cpuMotion:9};const second=cast(m,'studio-couch-yn',owner,2,102);assert.equal(find(second.m,second.s)?.powerModifier,0);assert.equal(find(second.m,second.s)?.statuses.protected,false);
 });
 test(`${owner}: Shonuff steals actual bonus and cannot profit through Protection`,()=>{
  let m=blank();const foe={...unit('guap',rival,0,1),powerModifier:5};m.boards[0]=[foe];let r=cast(m,'shonuff',owner,0);assert.equal(find(r.m,foe)?.powerModifier,0);assert.equal(find(r.m,r.s)?.powerModifier,5);
  m=blank();m.boards[0]=[foe];m=cast(m,'church-aunties-rival',rival,0,90).m;assert.equal(find(m,foe)?.statuses.protected,true);r=cast(m,'shonuff',owner,0);assert.equal(find(r.m,foe)?.powerModifier,6);assert.equal(find(r.m,r.s)?.powerModifier,0);
 });
}
test('economy bodies receive only one-Hand trims; GUAP and FOLKS remain unchanged',()=>{assert.equal(cards.plug.power,2);assert.equal(cards.bossbabe.power,3);assert.equal(cards['work-hubby'].power,3);assert.equal(cards.guap.power,6);assert.equal(cards.folks.power,2);});

for (const owner of ['player','cpu'] as const) {
 test(`${owner}: Blue Triple OG caps free homage at three and reinforces remote crew for one`,()=>{
  const m=blank(),rival:Owner=owner==='player'?'cpu':'player';
  const foe={...unit('oink',rival,0,1),powerModifier:100};
  const crew=[unit('ganger-blue',owner,1,2),unit('blueside1',owner,1,3),unit('ganger-blue',owner,2,4),unit('blueside1',owner,2,5)];
  m.boards=[[foe],crew.slice(0,2),crew.slice(2)];
  const r=cast(m,'triple-og-blue',owner,0);
  assert.equal(find(r.m,r.s)?.powerModifier,3,'four eligible donors cannot exceed three homage');
  for(const lane of [1,2] as const) {
   const survivors=r.m.boards[lane].filter(c=>c.owner===owner);
   assert.equal(survivors.reduce((n,c)=>n+c.powerModifier,0),1,'one reinforcement Hand per remote district');
   assert.equal(survivors.filter(c=>c.statuses.protected).length,1);
   assert.ok(survivors.every(c=>c.powerModifier>=0),'Blue donors never pay Hands');
  }
  assert.equal(find(r.m,r.s)?.basePower,8,'base body is retained');
 });
}
test('Plug setup costs two Motion and retains its one-Motion remote discount',()=>{
 assert.equal(cards.plug.cost,2);assert.equal(cards.plug.power,2);
 const r=cast(blank(),'plug','player',0);
 const s=createCardInstance('oink','player','plug-followup',199);
 const m={...r.m,playerHand:[s],playerMotion:s.cost-1};
 const paid=playTurnCard(m,'player',s.instanceId,1);
 assert.ok(find(paid,s),'discount still permits the remote follow-up');
 assert.equal(paid.playerMotion,0);
});
for(const owner of ['player','cpu'] as const) {
 test(`${owner}: Roaster applies one Burn, retains fresh-entry damage, and respects Protection`,()=>{
  for(const fresh of [false,true]){
   const m=blank(),rival:Owner=owner==='player'?'cpu':'player';
   const target={...unit('hooper',rival,0,1),playedRound:fresh?3:2};m.boards[0]=[target];
   const r=cast(m,'roaster',owner,0);assert.equal(find(r.m,target)?.statuses.burnStacks,1);
   assert.equal(find(r.m,target)?.powerModifier,fresh?-2:-1);
  }
  const m=blank(),rival:Owner=owner==='player'?'cpu':'player',target=unit('hooper',rival,0,1);
  m.boards[0]=[target];
  const guarded=cast(m,'church-aunties-rival',rival,0,99).m;assert.equal(find(guarded,target)?.statuses.protected,true);
  const r=cast(guarded,'roaster',owner,0);assert.equal(find(r.m,target)?.statuses.burnStacks,0);assert.equal(find(r.m,target)?.powerModifier,find(guarded,target)?.powerModifier);
 });
}
