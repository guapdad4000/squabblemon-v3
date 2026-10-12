import test from 'node:test';
import assert from 'node:assert/strict';
import {cards} from '../../../lib/squabblemon-engine/src/data';
import {createMatch,createCardInstance,createAbilityUpgradeSnapshot,playTurnCard,nextRound,type Match,type Owner,type Lane,type CardInstance} from '../../../lib/squabblemon-engine/src/gameEngine';
const blank=():Match=>({...createMatch('block','block'),round:3,phase:'player',boards:[[],[],[]],playerHand:[],cpuHand:[],playerMotion:9,cpuMotion:9,playerCardIds:[],cpuCardIds:[]});
const unit=(id:string,owner:Owner,lane:Lane,index:number):CardInstance=>({...createCardInstance(id,owner,'effects',index),lane,playedRound:3});
const find=(m:Match,c:CardInstance)=>m.boards.flat().find(x=>x.instanceId===c.instanceId);
function cast(m:Match,id:string,owner:Owner,lane:Lane,index=100){const s=createCardInstance(id,owner,'effects',index);const n=playTurnCard({...m,phase:owner==='player'?'player':'cpu-reveal',[owner==='player'?'playerHand':'cpuHand']:[s]},owner,s.instanceId,lane);return {m:n,s};}
for(const owner of ['player','cpu'] as const){
 const rival:Owner=owner==='player'?'cpu':'player';
 test(`${owner}: Music route rewards require actual arrival`,()=>{
  let m=blank();const artist=unit('the-rapper',owner,1,1);m.boards[1]=[artist];let r=cast(m,'tour-van-driver',owner,0);
  assert.equal(find(r.m,artist)?.lane,0);assert.equal(find(r.m,artist)?.powerModifier,2);assert.equal(find(r.m,r.s)?.powerModifier,2);
  m=blank();const blocked={...artist,statuses:{...artist.statuses,locked:true}};m.boards[1]=[blocked];r=cast(m,'tour-van-driver',owner,0);assert.equal(find(r.m,blocked)?.powerModifier,0);assert.equal(find(r.m,r.s)?.powerModifier,0);
  m=blank();const local=unit('the-rapper',owner,0,2);m.boards[0]=[local];r=cast(m,'mixtape-cousin',owner,0);assert.notEqual(find(r.m,local)?.lane,0);assert.equal(find(r.m,local)?.powerModifier,2);
 });
 test(`${owner}: Family sharing pays three only twice per side, without recursive copy gains`,()=>{
  let m=blank();const a=unit('second-plate-cousin',owner,0,1),b=unit('second-plate-cousin',owner,0,2);m.boards[0]=[a,b];
  for(let round=0;round<3;round++){
   m.round=3+round;m.playerMotion=m.cpuMotion=9;const patient={...unit('the-favorite-grandchild',owner,0,10+round),powerModifier:-1,recoverableDamage:1};
   m.boards[0]=[find(m,a)!,find(m,b)!,patient];m=cast(m,'plate-auntie',owner,0,100+round).m;
   assert.equal((find(m,a)?.powerModifier??0)+(find(m,b)?.powerModifier??0),Math.min(2,round+1)*3);
   assert.equal(m.creativeMarks?.find(x=>x.id.endsWith('second-plate-cousin'))?.amount,Math.min(2,round+1));
  }
 });
 test(`${owner}: Grill rewards real enemy Burn damage with a two-payout cap`,()=>{
  let m=blank();const victim={...unit('cornball',rival,0,1),powerModifier:28};m.boards[0]=[victim];const r=cast(m,'grill-uncle',owner,0);m=r.m;
  for(let tick=0;tick<3;tick++){
   if(tick===1){m.playerMotion=m.cpuMotion=9;m=cast(m,'church-aunties-rival',owner,0,200).m;assert.equal(find(m,victim)?.statuses.burnStacks,1,'a real Family entrance restokes the grill');}
   m=nextRound({...m,phase:'resolved'});assert.equal(find(m,r.s)?.powerModifier,Math.min(2,tick+1)*2+(tick>0?1:0));
  }
 });
 test(`${owner}: GUAP retains global damage but keeps his five-Hand reveal cap after the weak Fire test`,()=>{
  const m=blank();for(const lane of [0,1,2] as Lane[]){m.boards[lane]=Array.from({length:lane===1?3:2},(_,i)=>unit('edgar',owner,lane,lane*10+i));m.boards[lane].push({...unit('cornball',rival,lane,50+lane),powerModifier:8});}
  const enemies=m.boards.flat().filter(c=>c.owner===rival);const r=cast(m,'guap',owner,0);
  assert.equal(find(r.m,r.s)?.powerModifier,5);assert.equal(cards.guap.power,6);assert.equal(cards.guap.cost,6);
  for(const e of enemies)assert.equal(find(r.m,e)?.powerModifier,e.powerModifier-1);
 });
 test(`${owner}: Tin Man saves Protection for movement or Oz travelers`,()=>{
  let m=blank();const tin=unit('tinman',owner,0,1);m.boards[0]=[tin];let r=cast(m,'the-manager-nice',owner,0);assert.equal(find(r.m,r.s)?.powerModifier,1);assert.equal(find(r.m,r.s)?.statuses.protected,false);
  m=blank();m.boards[0]=[tin];r=cast(m,'lion',owner,0);assert.equal(find(r.m,r.s)?.powerModifier,2);assert.equal(find(r.m,r.s)?.statuses.protected,true);
 });
 test(`${owner}: Folks keeps global Burn`,()=>{
  const m=blank();for(const lane of [0,1,2] as Lane[])m.boards[lane]=[unit('edgar',rival,lane,lane*10),unit('edgar',rival,lane,lane*10+1)];const enemies=m.boards.flat();const r=cast(m,'folks',owner,0);for(const enemy of enemies)assert.equal(find(r.m,enemy)?.statuses.burnStacks,3);
 });
 test(`${owner}: Circuit jobs pay each distinct worker once and refund only on completion`,()=>{
  let m=cast(blank(),'circuitcaptain',owner,0).m;
  const a=cast(m,'batteryback',owner,0,201);m=a.m;assert.equal(find(m,a.s)?.powerModifier,1);assert.equal(owner==='player'?m.playerMotion:m.cpuMotion,4);
  const b=cast(m,'batteryback',owner,0,202);m=b.m;assert.equal(find(m,a.s)?.powerModifier,1);assert.equal(find(m,b.s)?.powerModifier,1);assert.equal(owner==='player'?m.playerMotion:m.cpuMotion,4,'one completion refund');
  const c=cast(m,'batteryback',owner,0,203);m=c.m;assert.equal(find(m,c.s)?.powerModifier,0);assert.equal(owner==='player'?m.playerMotion:m.cpuMotion,3,'the consumed jobs cannot refund again');
 });
 test(`${owner}: Red retaliation cannot turn blocked damage into self Hands`,()=>{
  const m=blank();const foe={...unit('youngbull',rival,0,1),powerModifier:8};m.boards[0]=[foe];const covered=cast(m,'church-aunties-rival',rival,0).m;assert.equal(find(covered,foe)?.statuses.protected,true);
  const r=cast(covered,'ganger-red',owner,0);assert.equal(find(r.m,foe)?.powerModifier,9,'the enemy keeps its Hands when the attack is blocked');assert.equal(find(r.m,r.s)?.powerModifier,0,'no free self bonus from a consumed shield');
 });
 test(`${owner}: Red OG collects at most six with only three heavy enemy hits`,()=>{
  const m=blank();m.boards[2]=[...Array.from({length:3},(_,i)=>({...unit('edgar',owner,2,i),powerModifier:2})),...Array.from({length:4},(_,i)=>({...unit('edgar',rival,2,10+i),powerModifier:8}))];
  const victims=[...m.boards[2]];const r=cast(m,'triple-og-red',owner,2);assert.equal(find(r.m,r.s)?.powerModifier,6);
  for(const v of victims.filter(c=>c.owner===owner))assert.equal(find(r.m,v)?.powerModifier,v.powerModifier-1);
  const enemyLosses=victims.filter(c=>c.owner===rival).map(v=>v.powerModifier-find(r.m,v)!.powerModifier);assert.deepEqual(enemyLosses.sort(),[1,2,2,2]);
 });
}

import {RED_SET_BENCHMARK_CARD_IDS} from '../../../lib/squabblemon-engine/src/tripleOgs';
test('Red benchmark uses ten legal crew cards and excludes mixed Fire finishers',()=>{
 assert.equal(RED_SET_BENCHMARK_CARD_IDS.length,10);assert.equal(new Set(RED_SET_BENCHMARK_CARD_IDS).size,10);assert.ok(RED_SET_BENCHMARK_CARD_IDS.every(id=>cards[id]));assert.ok(!RED_SET_BENCHMARK_CARD_IDS.some(id=>['guap','folks'].includes(id)));assert.ok(RED_SET_BENCHMARK_CARD_IDS.includes('redneck-evil'));assert.ok(RED_SET_BENCHMARK_CARD_IDS.includes('redside5'));assert.equal(cards['block-spinner'].cost,1);assert.equal(cards['ganger-red'].cost,2);assert.equal(cards['triple-og-red'].power,4);
});
for(const owner of ['player','cpu'] as const)test(`${owner}: restored GUAP bond buffs every eligible Fire ally`,()=>{
 let m=blank();m.round=6;m[owner==='player'?'playerHand':'cpuHand']=[createCardInstance('guap',owner,'bond',99)];
 const allies:CardInstance[]=[];for(const lane of [0,1,2] as Lane[]){m.boards[lane]=[unit('ganger-red',owner,lane,lane*10),unit('ganger-red',owner,lane,lane*10+1)];allies.push(...m.boards[lane]);}const after=nextRound({...m,phase:'resolved'});for(const ally of allies)assert.equal(find(after,ally)?.powerModifier,1);
});

for(const owner of ['player','cpu'] as const)test(`${owner}: Ruby favors real Red characters over supports and generic allies`,()=>{
 let m=blank();const red={...unit('ganger-red',owner,1,1),powerModifier:6},ordinary=unit('edgar',owner,0,2),support=unit('cognac',owner,0,3);m.boards=[[ordinary,support],[red],[]];let r=cast(m,'redside5',owner,0);assert.equal(find(r.m,red)?.powerModifier,9);assert.equal(find(r.m,ordinary)?.powerModifier,0);assert.equal(find(r.m,support)?.powerModifier,0);
 m=blank();m.boards[1]=[ordinary];r=cast(m,'redside5',owner,0);assert.equal(find(r.m,ordinary)?.powerModifier,2);
 m=blank();const enemy=unit('edgar',owner==='player'?'cpu':'player',0,4);m.boards[0]=[support,enemy];r=cast(m,'redside5',owner,0);assert.equal(find(r.m,r.s)?.powerModifier,1);assert.equal(find(r.m,enemy)?.statuses.weakened,true);assert.equal(find(r.m,support)?.powerModifier,0);
 assert.equal(cards['triple-og-red'].cost,4);assert.equal(cards['triple-og-red'].power,4);
});

for(const owner of ['player','cpu'] as const)test(`${owner}: Corso counts as Red Set for Ruby and Initiation`,()=>{
 let m=blank();const dog=unit('cane-corso-red',owner,1,1);m.boards[1]=[dog];let r=cast(m,'redside5',owner,0);assert.equal(find(r.m,dog)?.powerModifier,3);
 m=blank();m.boards[1]=[dog];m=cast(m,'initiation',owner,1).m;r=cast(m,'edgar',owner,1,101);assert.equal(find(r.m,r.s)?.gangTag,'red');assert.equal(find(r.m,r.s)?.powerModifier,4,'recruitment +2 and Edgar cheap-ally reveal +2');
});

for(const owner of ['player','cpu'] as const)test(`${owner}: Roll Call has no free empty-board gain or overkill credit`,()=>{
 let r=cast(blank(),'triple-og-red',owner,2);assert.equal(find(r.m,r.s)?.powerModifier,0);assert.equal(find(r.m,r.s)?.power,4);
 const m=blank();const victim=unit('edgar',owner==='player'?'cpu':'player',2,1);victim.powerModifier=1-victim.basePower;m.boards[2]=[victim];r=cast(m,'triple-og-red',owner,2);assert.equal(find(r.m,victim),undefined);assert.equal(find(r.m,r.s)?.powerModifier,1,'a one-Hand victim cannot pay two');
});

for(const owner of ['player','cpu'] as const)for(const tier of [0,3])test(`${owner} tier ${tier}: wide Roll Call keeps three heavy hits and a six-Hand base payout`,()=>{
 const m=blank();m.abilityUpgradeSnapshot=createAbilityUpgradeSnapshot(['triple-og-red'],['triple-og-red'],{[owner]:{'triple-og-red':{xp:tier?4500:0,level:tier?10:1,moveTier:tier}}});
 const enemies=Array.from({length:7},(_,i)=>({...unit('edgar',owner==='player'?'cpu':'player',2,i),powerModifier:8+i}));m.boards[2]=enemies;const r=cast(m,'triple-og-red',owner,2);assert.equal(find(r.m,r.s)?.powerModifier,6+tier);assert.deepEqual(enemies.map(c=>c.powerModifier-find(r.m,c)!.powerModifier).sort(),[1,1,1,1,2,2,2]);
});
for(const owner of ['player','cpu'] as const)test(`${owner}: immovable immune victims do not pay Roll Call`,()=>{
 const m=blank();const enemy=owner==='player'?'cpu':'player';const immune=unit('blueside1',enemy,2,90);m.boards[2]=[immune];for(const lane of [0,1] as Lane[])m.boards[lane]=Array.from({length:4},(_,i)=>unit('edgar',enemy,lane,lane*10+i));const r=cast(m,'triple-og-red',owner,2);assert.equal(find(r.m,immune)?.lane,2);assert.equal(find(r.m,immune)?.powerModifier,0);assert.equal(find(r.m,r.s)?.powerModifier,0);
});
