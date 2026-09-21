import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { FAIRYTALE_WAVE, FAIRYTALE_ALTERNATE_ART } from '../../../lib/squabblemon-engine/src/fairytaleWave';
import { decks, cards, cardCatalog, catalogCardById, validateCardAbilityUpgrades } from './data';
import { createCardInstance, createMatch, playTurnCard, nextRound, getEffectiveCardPower, getLegalCardCost, getCharacterDistrictMarks,
  pass, revealCpuTurn, verifyMatchTranscript, type PlayerMove, createMatchFromEngineCards, createAbilityUpgradeSnapshot, type Match, type CardInstance, type Owner, type Lane } from './gameEngine';
import { createOnlineRoom, joinOnlineRoom, applyOnlineCommand, onlineRoomView } from '@workspace/squabblemon-engine/multiplayer';

const unit = (id: string, owner: Owner, lane: Lane, index = 1): CardInstance => ({ ...createCardInstance(id, owner, 'fairytale', index), lane });
const blank = (): Match => ({ ...createMatch('block', 'block'), round: 3, playerMotion: 9, cpuMotion: 9, playerHand: [], cpuHand: [], boards: [[], [], []] });
const find = (m: Match, c: CardInstance) => [...m.boards.flat(), ...m.playerHand, ...m.cpuHand].find(x => x.instanceId === c.instanceId)!;
function play(m: Match, c: CardInstance, lane: Lane = 0) {
  const hand = c.owner === 'player' ? 'playerHand' : 'cpuHand';
  return playTurnCard({ ...m, phase: c.owner === 'player' ? 'player' : 'cpu-reveal', [hand]: [...m[hand].filter(x=>x.instanceId!==c.instanceId), c] }, c.owner, c.instanceId, lane, false);
}
function cast(m: Match, id: string, owner: Owner = 'player', lane: Lane = 0) {
  const source = createCardInstance(id, owner, 'cast', m.nextEventSequence);
  return { source, after: play(m, source, lane) };
}
function cover(m: Match, c: CardInstance) {
  c.statuses.protected = true;
  m.timedEffects.push({ id: 'cover:' + c.instanceId, kind: 'church-protection', owner: c.owner,
    sourceInstanceId: c.instanceId, targetInstanceId: c.instanceId, lane: c.lane!, startsAtRound: 1, expiresAtRound: 99, expiration: 'match-complete' });
}
const advance = (m: Match) => nextRound({ ...m, phase: 'resolved' });

test('granted Protection survives its grantor returning to hand', () => {
  let m=blank();const tin=unit('tinman','player',0);m.boards[0]=[tin];
  const entrant=cast(m,'hooper'); m=entrant.after;
  const returned=cast(m,'dorothy').after;
  assert.equal(find(returned,tin).lane,null);
  assert(returned.timedEffects.some(e=>e.targetInstanceId===entrant.source.instanceId));
});
test('confiscation and donations cannot heal Homeless Legend; capped refunds cannot charge Powerhouse', () => {
  const m=blank(), legend=unit('homelesslegend','cpu',0);legend.powerModifier=5;m.boards[0]=[legend];
  const seized=cast(m,'thefeds').after;assert.equal(find(seized,legend).recoverableDamage,undefined);
  const friend={...legend,owner:'player' as const,instanceId:'friendly-legend'};m.boards[0]=[friend];
  const donated=cast(m,'corruptpastor').after;assert.equal(find(donated,friend).recoverableDamage,undefined);
  const battery=createCardInstance('powerhouse','player');m.playerHand=[battery];m.playerMotion=9;
  m.discountTokens=[{id:'free-water',owner:'player',sourceInstanceId:'plug',eligibility:'any',sourceLane:0,createdOrder:1}];
  const capped=cast(m,'waterboy').after;assert.equal(capped.playerMotion,9);assert.equal(find(capped,battery).bankedMotion,0);
});
test('damage after Fanboy interception triggers only watchers in the actual recipient district', () => {
  const m=blank(), idol=unit('hooper','cpu',0), fan=unit('grownfanboy','cpu',1), bonnet=unit('bonnetgirl','cpu',0), actualBonnet=unit('bonnetgirl','cpu',1,2);
  idol.powerModifier=9;fan.powerModifier=4;fan.idolId=idol.instanceId;m.boards=[[idol,bonnet],[fan,actualBonnet],[]];
  const {after}=cast(m,'ptang');
  assert.equal(find(after,idol).powerModifier,9);assert.equal(find(after,bonnet).powerModifier,0);assert.equal(find(after,actualBonnet).powerModifier,2);
});
test('new district state is replayed before/after and a full solo transcript verifies with Alice returns', () => {
  const trap=cast(blank(),'sherlock').after.effectLog.at(-1)!;
  assert.deepEqual(trap.replay.before.districtTraps,[]);assert.equal(trap.replay.after.districtTraps?.length,1);
  const ids=['alice','tinman','scarecrow','cheshire','dorothy','sherlock','watson','queenofhearts','oz','lion'];
  let m=createMatchFromEngineCards('fairytale',ids,'block',[...decks.find(d=>d.id==='block')!.cards]);
  const moves: PlayerMove[]=[];
  while(m.phase!=='complete') {
    const choice=m.playerHand.flatMap(c=>([0,1,2] as Lane[]).map(l=>({c,l,cost:getLegalCardCost(m,'player',c,l)}))).find(o=>o.cost<=m.playerMotion);
    if(choice) {
      moves.push({cardInstanceId:choice.c.instanceId,lane:choice.l,squabble:false,endTurn:false});
      m=playTurnCard(m,'player',choice.c.instanceId,choice.l,false);
    }
    moves.push({cardInstanceId:null,lane:null,squabble:false,endTurn:true});
    m=nextRound(revealCpuTurn(pass(m,'player')));
  }
  assert(m.effectLog.some(e=>e.note==='Alice returned to hand.'));
  assert.deepEqual(verifyMatchTranscript('fairytale','block',moves,undefined,ids),m);
});


test('all 21 identities, approved costs, artwork, eight alternate pairs and training integrate with acquisition', () => {
  assert.equal(FAIRYTALE_WAVE.length, 21); assert.equal(FAIRYTALE_ALTERNATE_ART.length, 8);
  assert.equal(cardCatalog.filter(c => c.kind !== 'support').length, 131);
  for (const [id, art, name, rarity, , cost, power] of FAIRYTALE_WAVE) {
    assert.equal(cards[id].name, name); assert.equal(cards[id].cost, cost); assert.equal(cards[id].power, power);
    assert.equal(catalogCardById[art].rarity, rarity);
    assert(catalogCardById[art].acquisitionSources.includes('Street Packs'));
    assert(existsSync(path.resolve('public/assets/characters', art + '.webp')));
    validateCardAbilityUpgrades({ [id]: cards[id] });
  }
  for (const id of FAIRYTALE_ALTERNATE_ART) {
    assert(catalogCardById[id].variantSlots.some(v => v.id === id + ':alternate'));
    assert(existsSync(path.resolve('public/assets/characters', id + '-alternate.webp')));
  }
});

for (const owner of ['player','cpu'] as const) {
  test('every new ability is deterministic and immutable for ' + owner, () => {
    for (const [id] of FAIRYTALE_WAVE) {
      const m=blank(), enemy=owner==='player'?'cpu':'player';
      const a=unit('rastamon',owner,0), b=unit('hooper',enemy,0), far=unit('tinman',owner,1);
      b.powerModifier=6; a.recoverableDamage=1; a.statuses.burnStacks=1;
      m.boards=[[a,b],[far],[]];
      const original=JSON.stringify(m), first=cast(m,id,owner).after;
      assert.equal(JSON.stringify(m),original); assert.deepEqual(cast(JSON.parse(original),id,owner).after,first);
    }
  });
  test('Dorothy returns identity, clears temporary effects and attaches a minimum-one discount for ' + owner, () => {
    const m=blank(), ally=unit('bonnetgirl',owner,0);
    ally.waveOnce={bonnetgirl:true}; ally.powerModifier=5; ally.statuses.frozen=true; m.boards[0]=[ally];
    const {after}=cast(m,'dorothy',owner), returned=find(after,ally);
    assert.equal(returned.lane,null); assert.equal(returned.powerModifier,0); assert.equal(returned.statuses.frozen,false);
    assert.equal(returned.waveOnce?.bonnetgirl,true); assert.equal(getLegalCardCost(after,owner,returned,0),1);
    assert.equal(after.playerDrawIndex,m.playerDrawIndex); assert.equal(after.cpuDrawIndex,m.cpuDrawIndex);
    const played=play(after,returned);
    assert(!played.discountTokens.some(t=>t.targetInstanceId===ally.instanceId));
    assert.equal(played.boards.flat().filter(c=>c.instanceId===ally.instanceId).length,1);
  });
}

test('Scarecrow swaps atomically; movement hooks protect arrivals and reward Lion departures', () => {
  const m=blank(), ally=unit('bonnetgirl','player',1), lion=unit('lion','player',1), tin=unit('tinman','player',1);
  m.boards[1]=[ally,lion,tin];
  const {source,after}=cast(m,'scarecrow');
  assert.equal(find(after,source).lane,1); assert.equal(find(after,ally).lane,0);
  assert.equal(find(after,source).powerModifier,1); assert.equal(find(after,ally).powerModifier,1);
  assert.equal(find(after,lion).powerModifier,2); assert(find(after,source).statuses.protected);
  const locked=blank(); const held=unit('bonnetgirl','player',1);held.statuses.locked=true;locked.boards[1]=[held];
  const fail=cast(locked,'scarecrow');
  assert.equal(find(fail.after,fail.source).lane,0);assert.equal(find(fail.after,held).lane,1);
});
test('Tin Man and Lion respect once-per-round and active-status gates', () => {
  const m=blank(), tin=unit('tinman','player',0);m.boards[0]=[tin];
  const a=cast(m,'bonnetgirl'), b=cast(a.after,'squabbleserver');
  assert(find(a.after,a.source).statuses.protected); assert(!find(b.after,b.source).statuses.protected);
  const next=cast(advance(b.after),'squabbleserver'); assert(find(next.after,next.source).statuses.protected);
  const lone=cast(blank(),'lion');assert(find(lone.after,lone.source).statuses.protected);
});
test('Alice returns once, leaves a capped Grin and receives +3 on her next deployment', () => {
  const m=blank(), alice=unit('alice','player',0), cat=unit('cheshire','player',1);m.boards=[[alice],[cat],[]];
  const returned=advance(m), hand=find(returned,alice);
  assert.equal(hand.lane,null);assert(hand.aliceReady);assert.equal(returned.boards[0].filter(c=>c.cardId==='grin').length,1);
  const back=play(returned,hand,0);assert.equal(find(back,alice).powerModifier,3);assert(!find(back,alice).aliceReady);
  assert.equal(find(advance(back),alice).lane,0);
  const final=blank();final.round=6;final.boards[0]=[unit('alice','player',0)];
  assert.equal(advance(final).boards[0][0].cardId,'alice');
});
test('Cheshire only leaves one Grin each round and never duplicates a district token', () => {
  let m=blank();const cat=unit('cheshire','player',2), ally=unit('bonnetgirl','player',0);m.boards=[[ally],[],[cat]];
  m=cast(m,'dorothy').after;const returned=find(m,ally);m=play(m,returned,0);m.playerMotion=9;
  m=cast(m,'dorothy').after;assert.equal(m.boards.flat().filter(c=>c.cardId==='grin').length,1);
  m=advance(m);m.playerMotion=9;m=play(m,find(m,ally),0);m=cast(m,'dorothy').after;
  assert.equal(m.boards.flat().filter(c=>c.cardId==='grin').length,1);
});
test('Queen executes only at threshold; Protection and Built Different prevent a guard', () => {
  for (const protectedTarget of [false,true]) {
    const m=blank(), target=unit('bonnetgirl','cpu',0);m.boards[0]=[target];if(protectedTarget)cover(m,target);
    const {after}=cast(m,'queenofhearts');
    assert.equal(!!find(after,target),protectedTarget);assert.equal(after.boards[0].filter(c=>c.cardId==='cardguard').length,protectedTarget?0:1);
  }
  const m=blank(), legend=unit('homelesslegend','cpu',0);legend.powerModifier=2-legend.basePower;m.boards[0]=[legend];
  const {after}=cast(m,'queenofhearts');assert(find(after,legend).legendSaved);assert(!after.boards[0].some(c=>c.cardId==='cardguard'));
});
test('Sherlock visibly cancels one entrance, expires, and does not erase passive abilities', () => {
  let m=cast(blank(),'sherlock').after;
  assert(getCharacterDistrictMarks(m).some(t=>t.text.includes('Stakeout')));
  const trap=m.districtTraps![0], passive=cast(m,'tinman','cpu',trap.lane);
  assert.equal(passive.after.districtTraps?.length,1);
  const reveal=cast(passive.after,'cornball','cpu',trap.lane);
  assert.equal(reveal.after.districtTraps?.length,0);assert(!find(reveal.after,passive.source).statuses.silenced);
  m=advance(advance(m));assert(!getCharacterDistrictMarks(m).some(t=>t.text.includes('Stakeout')));
});
test('DMV surcharge is shared by legal-cost validation, charges once, does not stack and expires', () => {
  let m=cast(blank(),'dmvworker').after;m.playerMotion=9;m=cast(m,'dmvworker').after;
  const enemy=createCardInstance('bonnetgirl','cpu');
  assert.equal(getLegalCardCost(m,'cpu',enemy,0),2);assert.equal(getLegalCardCost(m,'cpu',enemy,1),1);
  assert.throws(()=>play({...m,cpuMotion:1},enemy),/Motion/);
  const after=play(m,enemy);assert.equal(after.cpuMotion,7);assert.equal(getLegalCardCost(after,'cpu',enemy,0),1);
  assert.equal(getLegalCardCost(advance(advance(m)),'cpu',enemy,0),1);
});
test('Watson restores actual damage only; Fresh Pot removes Burn and Freeze without unrelated buffs', () => {
  const m=blank(), ally=unit('hooper','player',0);ally.powerModifier=6;m.boards[0]=[ally];
  const damaged=cast(m,'ptang','cpu').after, victim=find(damaged,ally);
  assert.equal(victim.recoverableDamage,2);
  const healed=cast(damaged,'watson','player',victim.lane!).after;
  assert.equal(find(healed,ally).recoverableDamage,0);assert.equal(find(healed,ally).powerModifier,6);assert(find(healed,ally).statuses.protected);
  const clean=blank(), dirty=unit('hooper','player',0);dirty.statuses={...dirty.statuses,burnStacks:3,frozen:true,boosted:true,locked:true};clean.boards[0]=[dirty];
  const served=cast(clean,'squabbleserver').after;
  assert.equal(find(served,dirty).statuses.burnStacks,0);assert(!find(served,dirty).statuses.frozen);assert(find(served,dirty).statuses.boosted);assert(find(served,dirty).statuses.locked);
});
test('Undercover waits until entrance resolves, steals once and escapes into the weakest open district', () => {
  const m=blank(), spy=unit('undercova','player',0);m.boards[0]=[spy];
  const {source,after}=cast(m,'lion','cpu');
  assert(find(after,spy).waveOnce?.undercova);assert.equal(find(after,spy).lane,1);
  // Lion is alone on his side and protects himself before Inside Man can steal.
  assert.equal(find(after,source).powerModifier,0);assert(!find(after,source).statuses.protected);assert.equal(find(after,spy).powerModifier,0);
});
test('The Feds seize bonus Hands without creating healing debt or triggering damage reactions', () => {
  const m=blank(), victim=unit('hooper','cpu',0), bonnet=unit('bonnetgirl','cpu',0);victim.powerModifier=6;m.boards[0]=[victim,bonnet];
  const {after}=cast(m,'thefeds');
  assert.equal(find(after,victim).powerModifier,2);assert(find(after,victim).statuses.locked);
  assert.equal(find(after,victim).recoverableDamage,undefined);assert.equal(find(after,bonnet).powerModifier,0);
});
test('P. Tang damage and push are one protected package; locked survivors stay put', () => {
  for(const status of ['protected','locked'] as const) {
    const m=blank(), victim=unit('hooper','cpu',0);victim.powerModifier=4;m.boards[0]=[victim];if(status==='protected')cover(m,victim);else victim.statuses.locked=true;
    const {after}=cast(m,'ptang');assert.equal(find(after,victim).lane,0);assert.equal(find(after,victim).powerModifier,status==='protected'?4:2);
  }
});
test('Pastor counts actual donations, leaves one Hand, and creates no damage reactions', () => {
  const m=blank(), small=unit('bonnetgirl','player',0), large=unit('hooper','player',0);m.boards[0]=[small,large];
  const {source,after}=cast(m,'corruptpastor');
  assert.equal(find(after,small).powerModifier,0);assert.equal(find(after,large).powerModifier,-1);assert.equal(find(after,source).powerModifier,2);
  assert.equal(find(after,large).recoverableDamage,undefined);
});
test('Powerhouse banks actual refunds in hand up to three; income and discounts never count', () => {
  const m=blank(), battery=createCardInstance('powerhouse','player'), ally=unit('hooper','player',0);m.playerHand=[battery];m.boards[0]=[ally];
  const refunded=cast(m,'waterboy').after;assert.equal(find(refunded,battery).bankedMotion,1);
  const powered=cast({...refunded,playerMotion:3},'energydrink').after;assert.equal(find(powered,battery).bankedMotion,3);
  const target=unit('hooper','cpu',0);target.powerModifier=6;powered.boards[0].push(target);powered.playerMotion=9;
  const hit=play(powered,find(powered,battery));assert.equal(find(hit,target).powerModifier,3);
  const fresh=blank();fresh.playerHand=[battery];assert.equal(find(advance(fresh),battery).bankedMotion,undefined);
  assert.equal(find(cast(fresh,'plug').after,battery).bankedMotion,undefined);
});
test('Bonnet Girl, Ronald and Trap Vamp react to actual damage with correct caps', () => {
  const m=blank(), victim=unit('hooper','cpu',0), bonnet=unit('bonnetgirl','cpu',0), ron=unit('ronald','cpu',0), ally=unit('hooper','cpu',2,2), vamp=unit('trapvamp','player',0);
  victim.powerModifier=8;m.boards=[[victim,bonnet,ron,vamp],[],[ally]];
  const hit=cast(m,'ptang').after;
  assert.equal(find(hit,bonnet).powerModifier,2);assert.equal(find(hit,ally).powerModifier,1);assert.equal(find(hit,vamp).powerModifier,2);
  const again=cast({...hit,playerMotion:9},'powerhouse').after;assert.equal(find(again,vamp).powerModifier,2);
});
test('Protection prevents damage reactions, and opposing cooks cannot retaliate indefinitely', () => {
  const m=blank(), a=unit('squabblecook','player',0), b=unit('squabblecook','cpu',0), victim=unit('hooper','cpu',0), bonnet=unit('bonnetgirl','cpu',0);
  victim.powerModifier=8;a.powerModifier=8;b.powerModifier=8;m.boards[0]=[a,b,victim,bonnet];cover(m,victim);
  const blocked=cast(m,'ptang').after;assert.equal(find(blocked,bonnet).powerModifier,0);assert.equal(find(blocked,a).powerModifier,8);
  const hit=cast({...blocked,playerMotion:9},'ptang').after;assert(hit.effectLog.length<40);
  assert.equal(find(hit,b).waveRounds?.squabblecook,3);assert.equal(find(hit,a).waveRounds?.squabblecook,3);
});
test('Oz repeats the last moved ally entrance once per match, and refuses copying loops', () => {
  const m=blank(), ally=unit('corruptpastor','player',0), donor=unit('hooper','player',0);m.boards[0]=[ally,donor];m.lastMovedAlly={player:{instanceId:ally.instanceId,round:3}};
  const {source,after}=cast(m,'oz','player',1);assert(find(after,source).waveOnce?.oz);assert.equal(find(after,ally).powerModifier,2);
  const loop=blank(), echo=unit('tayaty','player',0);loop.boards[0]=[echo];loop.lastMovedAlly={player:{instanceId:echo.instanceId,round:3}};
  const rejected=cast(loop,'oz');assert(!find(rejected.after,rejected.source).waveOnce?.oz);
});
test('the same fairytale rules survive six-round authoritative online games for both seats', () => {
  const ids=FAIRYTALE_WAVE.slice(0,10).map(([id])=>id), other=FAIRYTALE_WAVE.slice(11).map(([id])=>id);
  const member=(userId:string, list:string[])=>({userId,name:userId,ready:false,deck:{id:userId,name:userId,hero:list[0],cards:list}});
  let room=createOnlineRoom(member('a',ids),'player',1);room=joinOnlineRoom(room,member('b',other),2);
  room=applyOnlineCommand(room,'player',{type:'ready'},3);room=applyOnlineCommand(room,'cpu',{type:'ready'},4);
  let now=5, plays=0;
  while(room.status==='active' && now<100) {
    const seat=room.activeSeat, view=onlineRoomView(room,'ABC',seat==='player'?'a':'b',now), options=view.hand.flatMap(c=>([0,1,2] as Lane[]).filter(l=>!view.lockedLanes?.includes(l)&&c.costs[l]<=view.motion[seat]).map(l=>({c,l})));
    if(options.length) {room=applyOnlineCommand(room,seat,{type:'play',instanceId:options[0].c.instanceId,lane:options[0].l,squabble:false},now++);plays++;}
    else room=applyOnlineCommand(room,seat,{type:'end-turn'},now++);
  }
  assert.equal(room.status,'complete');assert(plays>=10);
  for(const [seat,user] of [['player','a'],['cpu','b']] as const) {
    const view=onlineRoomView(room,'ABC',user,now);
    assert(view.hand.every(c=>c.owner===seat));assert(!('rivalHand' in view));
    assert(view.boards.flat().every(c=>c.artworkId));
  }
});
