import assert from 'node:assert/strict';
import test from 'node:test';
import { cards } from './data';
import { createMatch, createCardInstance, playTurnCard, getLegalCardCost, getCharacterDistrictMarks, nextRound, type Match, type Owner, type Lane } from './gameEngine';
import { PVP_SUPPORT } from '../../../lib/squabblemon-engine/src/basePvpBalance';
const blank=():Match=>({...createMatch('block','block'),round:3,boards:[[],[],[]],playerHand:[],cpuHand:[],playerMotion:9,cpuMotion:9});
const unit=(id:string,owner:Owner,lane:Lane,index=0)=>({...createCardInstance(id,owner,'v52-base',index),lane});
const live=(m:Match,id:string)=>m.boards.flat().find(c=>c.instanceId===id)!;
function cast(m:Match,id:string,owner:Owner,lane:Lane=0){
 const card=createCardInstance(id,owner,'v52-cast',m.nextEventSequence);
 return {card,after:playTurnCard({...m,phase:owner==='player'?'player':'cpu-reveal',[owner==='player'?'playerHand':'cpuHand']:[card],[owner==='player'?'playerMotion':'cpuMotion']:9},owner,card.instanceId,lane)};
}
for(const owner of ['player','cpu'] as const){
 test(`${owner}: Transfer Ticket survives a support play and pays one discounted character only`,()=>{
  let m=cast(blank(),'buspass',owner).after;
  assert(getCharacterDistrictMarks(m).some(x=>x.owner===owner&&x.text.includes('next character anywhere: −1 Motion / +2 Hands')));
  m=cast(m,'soulfood',owner).after;
  assert.equal(m.discountTokens.filter(t=>t.eligibility==='character-transfer').length,1);
  const candidate=createCardInstance('og',owner);
  assert.equal(getLegalCardCost(m,owner,candidate,2),Math.max(0,cards.og.cost-1));
  const played=cast(m,'og',owner,2);m=played.after;
  assert.equal(live(m,played.card.instanceId).powerModifier,PVP_SUPPORT.transfer);
  assert.equal(m.discountTokens.length,0);
  const next=cast(m,'og',owner,2);assert.equal(live(next.after,next.card.instanceId).powerModifier,0);
 });
 test(`${owner}: Soul Food reaches the afflicted ally and gives its full base payoff`,()=>{
  const m=blank(),sick=unit('og',owner,0),well=unit('rastamon',owner,0,1);
  sick.statuses.frozen=true;sick.statuses.silenced=true;m.boards[0]=[well,sick];
  const {after}=cast(m,'soulfood',owner);
  assert.equal(live(after,sick.instanceId).statuses.frozen,false);assert.equal(live(after,sick.instanceId).statuses.silenced,false);
  assert.equal(live(after,sick.instanceId).powerModifier,PVP_SUPPORT.soulFood);assert.equal(live(after,well.instanceId).powerModifier,0);
 });
 test(`${owner}: Oz skips the latest non-repeatable contract and finds an older legal entrance`,()=>{
  let m=cast(blank(),'barber',owner).after;m=cast(m,'hair-stylist',owner).after;
  const ally={...unit('og',owner,0,99),powerModifier:-4};m={...m,boards:[[...m.boards[0],ally],[],[]]};
  const {after,card}=cast(m,'oz',owner);
  assert.equal(live(after,ally.instanceId).powerModifier,-3);assert(live(after,card.instanceId).waveOnce?.oz);
 });
 test(`${owner}: Cheshire keeps its return identity with a bounded four-Hand Grin`,()=>{
  const m=blank(),cat={...unit('cheshire',owner,2),powerModifier:10},small=unit('cornball',owner,0);m.boards=[[small],[],[cat]];
  const {after}=cast(m,'dorothy',owner,1);
  const grin=after.boards.flat().find(c=>c.cardId==='grin');assert(grin);assert.equal(grin.basePower,4);assert.equal(grin.lane,0);
 });
 test(`${owner}: OG Calisthenics rewards a three-district setup without its old fifteen-Hand burst`,()=>{
  const m=blank();const crew=([0,1,2] as const).map(l=>unit('track-suit-auntie',owner,l,l));m.boards=crew.map(c=>[c]) as Match['boards'];
  const {after}=cast(m,'og-calisthenics',owner);
  for(const c of crew)assert.equal(live(after,c.instanceId).powerModifier,3);
 });
}
for(const owner of ['player','cpu'] as const){
 test(`${owner}: Tayaty uses a Stand-In shield for an unrepeatable contract without rearming it`,()=>{
  const setup=cast(blank(),'hair-stylist',owner).after;
  const {after,card}=cast(setup,'tayaty',owner);
  assert.equal(live(after,card.instanceId).statuses.protected,true);
  assert.equal(live(after,card.instanceId).powerModifier,1);
  assert.equal(after.creativeMarks?.filter(x=>x.kind==='blowout').length??0,0);
 });
 test(`${owner}: Wrist Check grants its base strength but only the actual shield can cash the extra reward`,()=>{
  const m=blank(),ally=unit('og',owner,0);m.boards[0]=[ally];
  const covered=cast(m,'bustdown',owner).after;
  assert.equal(live(covered,ally.instanceId).powerModifier,PVP_SUPPORT.wristCheck);
  assert.equal(live(covered,ally.instanceId).statuses.protected,true);
  const enemy=owner==='player'?'cpu':'player';
  const hit=cast(covered,'snow',enemy).after;
  assert.equal(live(hit,ally.instanceId).statuses.frozen,false);
  assert.equal(live(hit,ally.instanceId).powerModifier,PVP_SUPPORT.wristCheck+2);
 });
}
for(const owner of ['player','cpu'] as const){
 test(`${owner}: Foodz rewards actual Light recovery and feeds healthy allies evenly`,()=>{
  for(const afflicted of [false,true]) {
   const m=blank();const fire=unit('og',owner,0),light=unit('drfade',owner,1),earth=unit('stud',owner,2);
   light.statuses.silenced=afflicted;m.boards=[[fire],[light],[earth]];
   const {after}=cast(m,'foodz',owner);
   assert.equal(live(after,fire.instanceId).powerModifier,2);
   assert.equal(live(after,earth.instanceId).powerModifier,2);
   assert.equal(live(after,light.instanceId).powerModifier,afflicted?4:2);
   assert.equal(live(after,light.instanceId).statuses.silenced,false);
  }
  // Assign the ordinary meal before the separate recovery reward.
  const m=blank(), recovering=unit('drfade',owner,0), healthy={...unit('leroy',owner,0,99),powerModifier:1};
  recovering.statuses.silenced=true;m.boards[0]=[recovering,healthy];
  const {after}=cast(m,'foodz',owner,2);
  assert.equal(live(after,recovering.instanceId).powerModifier,4);
  assert.equal(live(after,healthy.instanceId).powerModifier,1,'the recovery bonus must not divert the first meal');
 });
 test(`${owner}: Stoner Sr pays one arrival four Hands and cannot pay the same token twice`,()=>{
  let m=cast(blank(),'stonersr',owner).after;
  assert(getCharacterDistrictMarks(m).some(x=>x.owner===owner&&x.text.includes('arrival: +4')));
  const first=cast(m,'og',owner);m=first.after;assert.equal(live(m,first.card.instanceId).powerModifier,4);
  const second=cast(m,'og',owner);assert.equal(live(second.after,second.card.instanceId).powerModifier,0);
 });
 test(`${owner}: Stud invests one Hand into its bond without replaying the contract`,()=>{
  const m=blank(),ally=unit('og',owner,0);m.boards[0]=[ally];
  const {after}=cast(m,'stud',owner);
  assert.equal(live(after,ally.instanceId).powerModifier,1);
  assert.equal(after.creativeMarks?.filter(x=>x.kind==='bond').length,1);
 });
}
for (const owner of ['player', 'cpu'] as const) {
 test(`${owner}: Cognac keeps its Fire specialty and does not target a stronger ally`, () => {
  for (const [id, expected] of [['og', 4], ['stud', 3]] as const) {
   const m=blank(), target={...unit(id,owner,0),powerModifier:-1}, stronger={...unit('rastamon',owner,0,99),powerModifier:20};
   m.boards[0]=[target,stronger];
   const {after}=cast(m,'cognac',owner);
   assert.equal(live(after,target.instanceId).powerModifier,expected-1);
   assert.equal(live(after,stronger.instanceId).powerModifier,20);
  }
 });
 test(`${owner}: Stoner Sr earns the smaller second pass only through an actual cleanse`, () => {
  const m=blank(), sick=unit('og',owner,0);sick.statuses.frozen=true;m.boards[0]=[sick];
  let after=cast(m,'stonersr',owner).after;
  assert.equal(live(after,sick.instanceId).statuses.frozen,false);
  const first=cast(after,'rastamon',owner);after=first.after;
  assert.equal(live(after,first.card.instanceId).powerModifier,4);
  assert(getCharacterDistrictMarks(after).some(x=>x.owner===owner&&x.text.includes('arrival: +1')));
  const second=cast(after,'og',owner);after=second.after;
  assert.equal(live(after,second.card.instanceId).powerModifier,1);
  assert(!getCharacterDistrictMarks(after).some(x=>x.owner===owner&&x.text.includes('Pass It Around')));
 });
}
for (const owner of ['player', 'cpu'] as const) {
 test(`${owner}: Hookah primes a remote unburned enemy, with Protection blocking ignition`, () => {
  const enemy=owner==='player'?'cpu':'player';
  for(const protectedTarget of [false,true]) {
   let m=blank();const local=unit('cornball',enemy,0),burning=unit('og',enemy,1,1),remote=unit('rastamon',enemy,2,2);
   burning.statuses.burnStacks=2;m.boards=[[local],[burning],[remote]];
   if(protectedTarget)m=cast(m,'bustdown',enemy,2).after;
   const {after}=cast(m,'godofhookah',owner);
   assert.equal(live(after,local.instanceId).statuses.burnStacks,0);
   assert.equal(live(after,burning.instanceId).statuses.burnStacks,2);
   assert.equal(live(after,remote.instanceId).statuses.burnStacks,protectedTarget?0:1);
   assert.equal(live(after,remote.instanceId).statuses.protected,false);
  }
 });
}

for (const owner of ['player','cpu'] as const) {
 test(`${owner}: Sushi Chef serves one weakest Water ally per district from hand`,()=>{
  const m=blank();const crew=([0,1,2] as const).map(lane=>[unit('riptidebruiser',owner,lane,lane*2),{...unit('riptidebruiser',owner,lane,lane*2+1),powerModifier:10}]);
  m.boards=crew as Match['boards'];m[owner==='player'?'playerHand':'cpuHand']=[createCardInstance('monsoonanchor',owner,'cooler',99)];
  const after=nextRound({...m,phase:'resolved'});
  for(const [weak,strong] of crew){assert.equal(live(after,weak.instanceId).powerModifier,1);assert.equal(live(after,strong.instanceId).powerModifier,10);}
 });
}

for (const owner of ['player','cpu'] as const) {
 test(`${owner}: Last Set OG pays the stronger finish only for a complete route, once per side`,()=>{
  for(const complete of [false,true]) {
   const m=blank();const crew=([0,1,2] as const).map(lane=>unit('track-suit-auntie',owner,lane,lane));m.boards=crew.map(c=>[c]) as Match['boards'];
   m.creativeMarks=[{id:`sw:${owner}:route:${crew[1].instanceId}`,kind:'sw-ledger',source:crew[1],owner,lane:1,targets:[],expires:99,seen:complete?['0','1','2']:['0','1']}];
   let after=cast(m,'last-set-og',owner,0).after;
   if(complete) {
    for(const c of crew)assert.equal(live(after,c.instanceId).powerModifier,2);
    after=cast(after,'last-set-og',owner,2).after;
    for(const c of crew)assert.equal(live(after,c.instanceId).powerModifier,2,'a repeated finisher cannot pay twice');
   } else {
    for(const c of crew)assert.equal(live(after,c.instanceId).powerModifier,0);
    assert.equal(live(after,crew[0].instanceId).statuses.protected,true);
   }
  }
 });
}

for (const owner of ['player','cpu'] as const) {
 for (const id of ['ganger-red','cane-corso-red'] as const) {
  test(`${owner}: ${id} skips Hands-immune Blue OG but respects its target's Protection`,()=>{
   const enemy=owner==='player'?'cpu':'player';
   for(const shielded of [false,true]) {
    let m=blank();const immune={...unit('triple-og-blue',enemy,0,91),powerModifier:20};
    const target=unit('rastamon',enemy,0,92);m.boards[0]=[immune,target];
    if(id==='cane-corso-red')m.boards[0].push(unit('triple-og-red',owner,0,93));
    if(shielded)m=cast(m,'bustdown',enemy).after;
    const before=live(m,target.instanceId).powerModifier;
    const {after,card}=cast(m,id,owner);
    assert.equal(live(after,immune.instanceId).powerModifier,20,'immune OG is untouched');
    assert.equal(live(after,target.instanceId).powerModifier,before+(shielded?2:id==='ganger-red'?-2:-1));
    if(shielded)assert.equal(live(after,target.instanceId).statuses.protected,false);
    if(id==='ganger-red')assert.equal(live(after,card.instanceId).powerModifier,1);
   }
  });
 }
}

for(const owner of ['player','cpu'] as const) {
 test(`${owner}: Blue Side Cover prioritizes remote crew and preserves neutral and solo fallbacks`,()=>{
  const m=blank(),blue=unit('ganger-blue',owner,1,101),neutral=unit('cornball',owner,2,102);m.boards=[[],[blue],[neutral]];
  const played=cast(m,'ganger-blue',owner,0);
  assert.equal(live(played.after,blue.instanceId).powerModifier,5);
  assert.equal(live(played.after,blue.instanceId).statuses.protected,true);
  assert.equal(live(played.after,neutral.instanceId).powerModifier,0);
  assert.equal(live(played.after,played.card.instanceId).powerModifier,1);
  m.boards=[[],[],[neutral]];const fallback=cast(m,'ganger-blue',owner,0);
  assert.equal(live(fallback.after,neutral.instanceId).powerModifier,3);
  assert.equal(live(fallback.after,fallback.card.instanceId).powerModifier,0);
  const solo=cast(blank(),'ganger-blue',owner,0);assert.equal(live(solo.after,solo.card.instanceId).powerModifier,1);
 });
 test(`${owner}: LOOK OUT's stronger backup pays once per round and keeps its district discount`,()=>{
  const m=blank(),ally=unit('blueside1',owner,1,103);m.boards[1]=[ally];
  const watch=cast(m,'look-out',owner,0);const enemy=owner==='player'?'cpu':'player';
  const first=cast(watch.after,'og',enemy,2).after;
  assert.equal(live(first,ally.instanceId).powerModifier,3);
  assert.equal(live(first,watch.card.instanceId).lookoutCalls,1);
  const candidate=createCardInstance('rastamon',owner);assert.equal(getLegalCardCost(first,owner,candidate,2),Math.max(0,cards.rastamon.cost-1));
  const second=cast(first,'og',enemy,0).after;
  assert.equal(live(second,ally.instanceId).powerModifier,3);
  assert.equal(live(second,watch.card.instanceId).lookoutCalls,1);
 });
}

for(const owner of ['player','cpu'] as const) {
 test(`${owner}: LOOK OUT's stronger support cannot exceed three round-start calls or pay while Silenced`,()=>{
  let m={...blank(),round:2,playerDrawIndex:100,cpuDrawIndex:100};const ally=unit('blue-nose-pit',owner,2,201);m.boards[2]=[ally];
  const setup=cast(m,'look-out',owner,0);m=setup.after;const enemy=owner==='player'?'cpu':'player';
  for(let call=1;call<=4;call++) {
   m=cast(m,'hooper',enemy,1).after;
   assert.equal(live(m,ally.instanceId).powerModifier,Math.min(call,3)*3);
   assert.equal(live(m,setup.card.instanceId).lookoutCalls,Math.min(call,3));
   assert.equal(live(m,setup.card.instanceId).powerModifier,0,'no upgrade payout');
   m={...m,boards:m.boards.map(l=>l.filter(c=>c.owner===owner)) as Match['boards']};
   if(call<4)m=nextRound({...m,phase:'resolved'});
  }
  let muted=setup.after;muted={...muted,boards:muted.boards.map(l=>l.map(c=>c.instanceId===setup.card.instanceId?{...c,statuses:{...c.statuses,silenced:true}}:c)) as Match['boards']};
  muted=cast(muted,'hooper',enemy,1).after;
  assert.equal(live(muted,ally.instanceId).powerModifier,0);
  assert.equal(live(muted,setup.card.instanceId).lookoutCalls??0,0);
 });
 test(`${owner}: Ganger's cover blocks one Red strike, then exposes its ally to the next`,()=>{
  const m=blank(),ally=unit('ganger-blue',owner,1,202);m.boards[1]=[ally];
  let covered=cast(m,'ganger-blue',owner,0).after;const enemy=owner==='player'?'cpu':'player';
  covered=cast(covered,'ganger-red',enemy,1).after;
  assert.equal(live(covered,ally.instanceId).powerModifier,5);
  assert.equal(live(covered,ally.instanceId).statuses.protected,false);
  covered=cast(covered,'ganger-red',enemy,1).after;
  assert.equal(live(covered,ally.instanceId).powerModifier,3);
 });
}
