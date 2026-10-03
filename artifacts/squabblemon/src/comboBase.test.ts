import assert from 'node:assert/strict';
import test from 'node:test';
import { cards, decks } from './data';
import { createMatch, createCardInstance, createAbilityUpgradeSnapshot, playTurnCard, type Match, type Owner } from './gameEngine';

test('Who You Know has a complete cross-district engine and closer at base level', () => {
 const combo = decks.find(deck => deck.id === 'combo')!;
 assert.deepEqual(combo.cards, ['cornball','plug','streamer','gamer','techbro','bossbabe','wifey','buspass','stockz','sneaker']);
 assert.equal(new Set(combo.cards).size,10);
 assert(combo.cards.every(id => cards[id] && !['guap','folks'].includes(id)));
});
test('Compound starter invests in growth cards without restricted rivalry cards', () => {
 const compound = decks.find(deck => deck.id === 'compound')!;
 assert.deepEqual(compound.cards, ['cornball','plug','streamer','rastamon','gamer','stockz','snow','buspass','buddy','cognac']);
 assert.equal(new Set(compound.cards).size,10);
 assert(compound.cards.every(id => cards[id] && !['guap','folks'].includes(id)));
});

for (const owner of ['player','cpu'] as const) for (const tier of [0,1,2,3]) {
 test('Combo fits Streamer, Techbro and Plug into six Motion and retains the loan: '+owner+' tier '+tier, () => {
  const ids=['streamer','techbro','plug'];
  let m: Match={...createMatch('combo','block'),round:3,boards:[[],[],[]],playerMotion:6,cpuMotion:6,playerHand:[],cpuHand:[],
    abilityUpgradeSnapshot:createAbilityUpgradeSnapshot(ids,ids,{[owner]:Object.fromEntries(ids.map(id=>[id,{xp:tier?4500:0,level:tier?10:1,moveTier:tier}]))})};
  const instances=ids.map((id,i)=>createCardInstance(id,owner,'combo-budget',i));
  m={...m,[owner==='player'?'playerHand':'cpuHand']:instances};
  for (const c of instances) {
    m=playTurnCard({...m,phase:owner==='player'?'player':'cpu-reveal'},owner,c.instanceId,2);
  }
  assert.equal(owner==='player'?m.playerMotion:m.cpuMotion,2);
  assert.equal(m.boards[2].filter(c=>c.owner===owner).length,3);
  const tech=m.boards[2].find(c=>c.cardId==='techbro')!;
  assert.equal(tech.powerModifier,tier,'loan earns only the existing training bonus');
  assert.equal(m.boards[2].find(c=>c.cardId==='streamer')?.basePower,3);
 });
}
test('Combo budget buffs preserve costs and printed Hands outside the two selected values',()=>{
 assert.equal(cards.techbro.cost,3);
 assert.equal(cards.techbro.power,4);
 assert.equal(cards.streamer.cost,2);
 assert.equal(cards.streamer.power,3);
});

for (const owner of ['player','cpu'] as const) for (const tier of [0,1,2,3]) {
 for (const layout of ['spread','empty','silenced'] as const) test('City Tour supports only the weakest remote ally: '+owner+' tier '+tier+' '+layout, () => {
  const instance=(id:string,n:number,lane:0|1|2)=>({...createCardInstance(id,owner,'tour-test',n),lane});
  const weakA=instance('cornball',1,0), strongA=instance('hooper',2,0);
  const weakB=instance('plug',3,2), strongB=instance('hooper',4,2);
  const local=instance('cornball',5,1), source=createCardInstance('gamer',owner,'tour-test',6);
  source.statuses.silenced=layout==='silenced';
  const m:Match={...createMatch('combo','block'),round:3,playerMotion:9,cpuMotion:9,playerHand:[],cpuHand:[],
   boards:layout==='empty'?[[],[local],[]]:[[weakA,strongA],[local],[weakB,strongB]],
   phase:owner==='player'?'player':'cpu-reveal',
   abilityUpgradeSnapshot:createAbilityUpgradeSnapshot(['gamer'],['gamer'],{[owner]:{'gamer':{xp:tier?4500:0,level:tier?10:1,moveTier:tier}}})};
  m[owner==='player'?'playerHand':'cpuHand']=[source];
  const after=playTurnCard(m,owner,source.instanceId,1);
  const find=(id:string)=>after.boards.flat().find(c=>c.instanceId===id)!;
  assert.equal(find(local.instanceId).powerModifier,0);
  if(layout!=='empty') {
   for(const c of [weakA,weakB]) assert.equal(find(c.instanceId).powerModifier,layout==='spread'?2:0);
   for(const c of [strongA,strongB]) assert.equal(find(c.instanceId).powerModifier,0);
  }
  assert.equal(find(source.instanceId).powerModifier,layout==='silenced'?0:tier);
 });
}
