import assert from 'node:assert/strict';
import test from 'node:test';
import { cards, decks, cardCatalog, catalogCardById, validateCardAbilityUpgrades } from './data';
import { createAbilityUpgradeSnapshot, createCardInstance, createMatch, playTurnCard, createMatchFromEngineCards, getLegalCardCost, nextRound, pass, revealCpuTurn, verifyMatchTranscript, type PlayerMove, type CardInstance, type Match, type Owner, type Lane } from './gameEngine';
import { styleSetFor } from '@workspace/squabblemon-engine/cosmetics';
const unit = (id: string, owner: Owner, lane: Lane): CardInstance => ({ ...createCardInstance(id, owner, id + lane, 1), lane });
const blank = (): Match => ({ ...createMatch('block', 'block'), round: 3, playerMotion: 9, cpuMotion: 9, playerHand: [], cpuHand: [], boards: [[], [], []] });
const find = (m: Match, c: CardInstance) => m.boards.flat().find(v => v.instanceId === c.instanceId)!;
function cast(m: Match, id: string, owner: Owner = 'player', lane: Lane = 0) {
 const source = createCardInstance(id, owner, 'cast', m.nextEventSequence);
 return { source, after: playTurnCard({ ...m, phase: owner === 'player' ? 'player' : 'cpu-reveal', [owner === 'player' ? 'playerHand' : 'cpuHand']: [source], [owner === 'player' ? 'playerMotion' : 'cpuMotion']: 9 }, owner, source.instanceId, lane) };
}
test('replacements retain collection, variant, training and purchased cosmetic identities', () => {
 assert.equal(catalogCardById.counter.name, 'Shotta');
 assert.equal(catalogCardById.concrete.name, 'Balikbayan Box Bot');
 assert.equal(cards.counter.abilityUpgrades[0].id, 'counter:upgrade:1');
 assert.equal(cards.concrete.abilityUpgrades[0].id, 'concrete:upgrade:1');
 assert(catalogCardById.counter.variantSlots.some(v => v.id === 'counter:chrome'));
 assert(styleSetFor('counter')!.stickers.every(s => s.image?.includes('characters/counter.webp')));
 for (const id of ['lola', 'repoman', 'madhatter']) {
  assert(cardCatalog.some(c => c.engineId === id && c.acquisitionSources.includes('Street Packs')));
  validateCardAbilityUpgrades({ [id]: cards[id] });
 }
});
const shield = (m: Match, c: CardInstance) => {
 c.statuses.protected=true;
 m.timedEffects.push({id:'protect:'+c.instanceId,kind:'church-protection',sourceInstanceId:c.instanceId,targetInstanceId:c.instanceId,owner:c.owner,lane:c.lane!,startsAtRound:1,expiresAtRound:7,expiration:'match-complete'});
};
const end = (m: Match) => nextRound({...m,phase:'resolved',playerHand:[],cpuHand:[]});
for (const owner of ['player', 'cpu'] as const) {
 const enemy: Owner=owner==='player'?'cpu':'player';
 test('Shotta opening shot and cross-district encores have separate bounded triggers: '+owner,()=>{
  const m=blank(), foe={...unit('og',enemy,0),basePower:10}, remote={...unit('hooper',enemy,1),basePower:20};
  m.boards=[[foe],[remote],[]];
  const {source,after}=cast(m,'counter',owner);
  assert.equal(find(after,foe).powerModifier,-2);
  let state=cast(after,'plug',owner,1).after;
  assert.equal(find(state,remote).powerModifier,-2);
  state=cast(state,'plug',owner,1).after;
  assert.equal(find(state,remote).powerModifier,-2,'same round cannot fire again');
  state=cast(end(state),'plug',owner,1).after;
  assert.equal(find(state,remote).powerModifier,-4);
  state=cast(end(state),'plug',owner,1).after;
  assert.equal(find(state,remote).powerModifier,-4,'two encores per match');
  assert.equal(find(state,source).homecomingEncores,2);
 });
 test('Shotta blocked shots consume an encore; inactive and same-district plays do not shoot: '+owner,()=>{
  for(const disabled of [false,true]) {
   const m=blank(), shotta=unit('counter',owner,0), foe={...unit('og',enemy,1),basePower:10};
   shotta.statuses.silenced=disabled; m.boards=[[shotta],[foe],[]];shield(m,foe);
   const first=cast(m,'plug',owner,1).after;
   assert.equal(find(first,foe).powerModifier,0);
   assert.equal(find(first,shotta).homecomingEncores,disabled?undefined:1);
   assert.equal(find(first,foe).statuses.protected,disabled);
   const same=cast(first,'plug',owner,0).after;
   assert.equal(find(same,shotta).homecomingEncores,disabled?undefined:1);
  }
 });
 test('Box Bot packages open once on placement, cleanse, and expire: '+owner,()=>{
  let m=cast(blank(),'concrete',owner).after;
  assert.equal(m.creativeMarks?.filter(x=>x.kind==='home-parcel').length,2);
  m=cast(m,'concrete',owner).after;
  assert.equal(m.creativeMarks?.filter(x=>x.kind==='home-parcel').length,2,'no duplicate package stacking');
  const entrant=createCardInstance('cornball',owner,'parcel',50); entrant.statuses.frozen=true;entrant.statuses.silenced=true;
  const result=playTurnCard({...m,phase:owner==='player'?'player':'cpu-reveal',[owner==='player'?'playerHand':'cpuHand']:[entrant]},owner,entrant.instanceId,1);
  assert.equal(find(result,entrant).powerModifier,1);assert.equal(find(result,entrant).statuses.frozen,false);assert.equal(find(result,entrant).statuses.silenced,false);
  assert.equal(result.creativeMarks?.filter(x=>x.kind==='home-parcel').length,1);
  const expired=end(end(result));assert.equal(expired.creativeMarks?.filter(x=>x.kind==='home-parcel').length,0);
 });
 test('Lola hosts two remote guests, cleanses them, then returns them with leftovers: '+owner,()=>{
  const m=blank(), a=unit('cornball',owner,1), b=unit('og',owner,2);
  a.statuses.frozen=true;b.statuses.silenced=true;m.boards=[[],[a],[b]];
  const after=cast(m,'lola',owner).after;
  for(const c of [a,b]) {assert.equal(find(after,c).lane,0);assert.equal(find(after,c).powerModifier,1);assert.equal(find(after,c).statuses.frozen,false);assert.equal(find(after,c).statuses.silenced,false);}
  const returned=end(JSON.parse(JSON.stringify(after)));
  for(const c of [a,b]) {assert.equal(find(returned,c).lane,c.lane);assert.equal(find(returned,c).powerModifier,2);}
  assert(!returned.creativeMarks?.some(x=>x.kind==='home-dinner'));
 });
 test('Lola respects locks and table capacity and does not reward a blocked return: '+owner,()=>{
  const m=blank(), locked=unit('cornball',owner,1), guest=unit('og',owner,2);
  locked.statuses.locked=true;m.boards=[[],[locked],[guest]];
  const after=cast(m,'lola',owner).after;assert.equal(find(after,locked).lane,1);assert.equal(find(after,guest).lane,0);
  find(after,guest).statuses.locked=true;
  const blocked=end(after);assert.equal(find(blocked,guest).lane,0);assert.equal(find(blocked,guest).powerModifier,1);
  const full=blank();full.boards=[[unit('cornball',owner,0),unit('og',owner,0),unit('plug',owner,0)],[locked],[guest]];
  const crowded=cast(full,'lola',owner).after;assert.equal(find(crowded,guest).lane,2);assert(!crowded.creativeMarks?.some(x=>x.kind==='home-dinner'));
 });
 test('Repo Man tows the most boosted enemy and redistributes only existing bonus Hands: '+owner,()=>{
  for(const bonus of [0,1,5]) {
   const m=blank(), target={...unit('og',enemy,1),powerModifier:bonus}, ally=unit('cornball',owner,0);
   m.boards=[[ally],[target],[]];const after=cast(m,'repoman',owner).after;
   assert.equal(find(after,target).lane,0);assert.equal(find(after,target).powerModifier,Math.max(0,bonus-3));
   assert.equal(find(after,ally).powerModifier,Math.min(3,bonus));assert.equal(find(after,target).recoverableDamage??0,0,'confiscating bonuses is not damage');
  }
 });
 test('Repo Man cannot steal through immunity, Protection, locks or a full enemy destination: '+owner,()=>{
  for(const defense of ['immune','protected','locked','full'] as const) {
   const m=blank(), target={...unit('og',enemy,1),powerModifier:4};m.boards=[[],[target],[]];
   if(defense==='immune')target.statuses.uncounterable=true;
   if(defense==='protected')shield(m,target);
   if(defense==='locked')target.statuses.locked=true;
   if(defense==='full')m.boards[0]=['cornball','plug','church','landlord'].map(id=>unit(id,enemy,0));
   const {after,source}=cast(m,'repoman',owner);
   assert.equal(find(after,target).lane,1);assert.equal(find(after,target).powerModifier,4);assert.equal(find(after,source).powerModifier,0);
  }
 });
  test('Mad Hatter sends the weaker guest to hand with +1 Hand and one-use −1 Motion, then seats the stronger guest: '+owner,()=>{
  const m=blank(), cheap=unit('cornball',owner,0), expensive={...unit('hooper',owner,1),powerModifier:10};
  m.boards=[[cheap],[expensive],[]];const after=cast(m,'madhatter',owner).after;
   const hand=owner==='player'?'playerHand':'cpuHand', returned=after[hand].find(c=>c.instanceId===cheap.instanceId)!;
   assert(returned);assert.equal(returned.lane,null);assert.equal(returned.powerModifier,4,
     'the weaker guest gets +1 on return and the cheaper guest still gets +3');
   assert.equal(getLegalCardCost(after,owner,returned,1),Math.max(1,cheap.cost-1));
   assert(after.discountTokens.some(t=>t.targetInstanceId===cheap.instanceId));
   assert.equal(find(after,expensive).lane,0);assert.equal(find(after,expensive).powerModifier,10);
   assert(find(after,expensive).statuses.protected);
   const replay=playTurnCard({...after,phase:owner==='player'?'player':'cpu-reveal',
     [owner==='player'?'playerMotion':'cpuMotion']:9},owner,cheap.instanceId,1);
   assert.equal(find(replay,cheap).powerModifier,4);
   assert(!replay.discountTokens.some(t=>t.targetInstanceId===cheap.instanceId));
 });
  test('Mad Hatter still returns the weaker guest if the stronger guest cannot move, and works in a crowded district: '+owner,()=>{
  const m=blank(), cheap=unit('cornball',owner,0), expensive={...unit('hooper',owner,1),powerModifier:10};
  expensive.statuses.locked=true;m.boards=[[cheap],[expensive],[]];const blocked=cast(m,'madhatter',owner).after;
   assert(blocked[owner==='player'?'playerHand':'cpuHand'].some(c=>c.instanceId===cheap.instanceId));
   assert.equal(find(blocked,expensive).lane,1);assert(!find(blocked,expensive).statuses.protected);
  expensive.statuses.locked=false;
  m.boards=[[cheap,unit('og',owner,0),unit('church',owner,0)],[expensive,unit('plug',owner,1),unit('landlord',owner,1),unit('nerd',owner,1)],[]];
   const seated=cast(m,'madhatter',owner).after;
   assert(seated[owner==='player'?'playerHand':'cpuHand'].some(c=>c.instanceId===cheap.instanceId));
   assert.equal(find(seated,expensive).lane,0);assert.equal(seated.boards[0].length,4);assert.equal(seated.boards[1].length,3);
 });
  test('Mad Hatter returns the weaker guest regardless of printed costs, and gains +2 Hands when alone: '+owner,()=>{
  const m=blank(), a=unit('cornball',owner,0), b={...unit('cornball',owner,1),powerModifier:2};m.boards=[[a],[b],[]];
  const after=cast(m,'madhatter',owner).after;
   assert.equal(after[owner==='player'?'playerHand':'cpuHand'].find(c=>c.instanceId===a.instanceId)?.powerModifier,2);
   assert.equal(find(after,b).lane,0);assert.equal(find(after,b).powerModifier,3);assert(!find(after,b).statuses.protected);
   const empty=cast(blank(),'madhatter',owner);assert.equal(find(empty.after,empty.source).powerModifier,2);
   assert.equal(cards.madhatter.cost,2);
 });
  test('Mad Hatter rewards the cheaper remote guest instead if the weaker returned guest costs more: '+owner,()=>{
    const m=blank(), local=unit('hooper',owner,0), remote=unit('cornball',owner,1);
    m.boards=[[local],[remote],[]];
    const after=cast(m,'madhatter',owner).after;
    const returned=after[owner==='player'?'playerHand':'cpuHand'].find(c=>c.instanceId===local.instanceId)!;
    assert.equal(returned.powerModifier,1);
    assert.equal(getLegalCardCost(after,owner,returned,1),Math.max(1,local.cost-1));
    assert.equal(find(after,remote).lane,0);
    assert.equal(find(after,remote).powerModifier,3);
  });
  test('Mad Hatter’s weaker return triggers Cheshire and Mr Rabbit while preserving the hand credit: '+owner,()=>{
    const m=blank(), local=unit('cornball',owner,0), rabbit=unit('mrrabbit',owner,0);
    const hatter=createCardInstance('madhatter',owner,'tea-party',1), cheshire=createCardInstance('cheshire',owner,'tea-party',2);
    m.boards[0]=[local,rabbit];
    const hand=owner==='player'?'playerHand':'cpuHand';
    m[hand]=[hatter,cheshire];
    const after=playTurnCard({...m,phase:owner==='player'?'player':'cpu-reveal'},owner,hatter.instanceId,0);
    assert.equal(after[hand].find(c=>c.instanceId===local.instanceId)?.powerModifier,1);
    assert(after.discountTokens.some(t=>t.targetInstanceId===local.instanceId));
    assert.equal(find(after,rabbit).powerModifier,1);
    assert.equal(after.boards[0].filter(c=>c.cardId==='grin').length,1);
    assert.equal(after.boards[0].find(c=>c.cardId==='grin')?.basePower,6);
  });
 test('each reworked kit awards existing training tiers after a successful base ability: '+owner,()=>{
  for(const id of ['counter','concrete','lola','repoman','madhatter']) {
   const m=blank(), remote=unit('og',owner,1), local=unit('cornball',owner,0), foe={...unit('hooper',enemy,id==='repoman'?2:0),basePower:10,powerModifier:4};
   m.boards=[[local],[remote],[]];m.boards[foe.lane!].push(foe);
   m.abilityUpgradeSnapshot=createAbilityUpgradeSnapshot(owner==='player'?[id]:[],owner==='cpu'?[id]:[],{[owner]:{[id]:{level:8,xp:2800,moveTier:3}}});
   const {after,source}=cast(m,id,owner);
   assert.equal(after.effectLog.filter(e=>e.abilityMetadata?.sourceInstanceId===source.instanceId).length,3,id+' training applies');
   const restored=JSON.parse(JSON.stringify(after)) as Match;
   const later=cast({...restored,round:4},'plug',owner,2).after;
   assert.equal(later.effectLog.filter(e=>e.abilityMetadata?.sourceInstanceId===source.instanceId).length,3,id+' never farms training');
  }
 });
 test('Lola and Hatter arrivals open Box Bot packages through the real movement pipeline: '+owner,()=>{
  const a=unit('cornball',owner,1), b=unit('hooper',owner,2), m=blank();m.boards=[[],[a],[b]];
  const parcels=cast(m,'concrete',owner).after;
  const dinner=cast(parcels,'lola',owner).after;
  const home=end(dinner);
  assert.equal(find(home,a).powerModifier,3);assert.equal(find(home,b).powerModifier,3);
  assert(!home.creativeMarks?.some(x=>x.kind==='home-parcel'));
 });
}

test('new roster survives a complete server-verifiable custom-deck battle', () => {
 const ids = ['lola', 'repoman', 'madhatter', 'counter', 'concrete', 'cornball', 'plug', 'wifey', 'snow', 'bikelife'];
 let m = createMatchFromEngineCards('homecoming', ids, 'block', [...decks.find(d => d.id === 'block')!.cards]);
 const moves: PlayerMove[] = [];
 while (m.phase !== 'complete') {
  const choice = m.playerHand.flatMap(card => ([0, 1, 2] as Lane[]).map(lane => ({ card, lane, cost: getLegalCardCost(m, 'player', card, lane) }))).find(o => o.cost <= m.playerMotion);
  if (choice) {
   moves.push({ cardInstanceId: choice.card.instanceId, lane: choice.lane, squabble: false, endTurn: false });
   m = playTurnCard(m, 'player', choice.card.instanceId, choice.lane);
  }
  moves.push({ cardInstanceId: null, lane: null, squabble: false, endTurn: true });
  m = nextRound(revealCpuTurn(pass(m, 'player')));
 }
 assert.deepEqual(verifyMatchTranscript('homecoming', 'block', moves, undefined, ids), m);
});
