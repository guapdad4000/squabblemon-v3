import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { FAIRYTALE_WAVE, FAIRYTALE_ALTERNATE_ART } from '../../../lib/squabblemon-engine/src/fairytaleWave';
import { decks, cards, cardCatalog, catalogCardById, validateCardAbilityUpgrades } from './data';
import { createCardInstance, createMatch, playTurnCard, nextRound, getEffectiveCardPower, getLegalCardCost, getCharacterDistrictMarks,
  getCardCostExplanation, pass, revealCpuTurn, verifyMatchTranscript, type PlayerMove, createMatchFromEngineCards, createAbilityUpgradeSnapshot, type Match, type CardInstance, type Owner, type Lane } from './gameEngine';
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

for (const owner of ['player', 'cpu'] as const) test(`Squabble Cook keeps its retaliation at 3 printed Hands for ${owner}`, () => {
  const enemy = owner === 'player' ? 'cpu' : 'player';
  const m = blank(), cook = unit('squabblecook', owner, 0), victim = unit('hooper', owner, 0, 2);
  victim.powerModifier = 9;
  m.boards[0] = [cook, victim];
  const { source, after: attacked } = cast(m, 'ptang', enemy);
  assert.equal(cards.squabblecook.power, 3);
  assert.equal(find(attacked, cook).basePower, 3);
  assert.equal(find(attacked, source).powerModifier, -2, 'Hands on the Clock still retaliates against the damaging enemy ability');
});

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


test('all 22 identities, approved costs, artwork, eight alternate pairs and training integrate with acquisition', () => {
  assert.equal(FAIRYTALE_WAVE.length, 22); assert.equal(FAIRYTALE_ALTERNATE_ART.length, 8);
  assert.equal(cardCatalog.filter(c => (c.kind ?? 'character') === 'character').length, 206);
  assert.equal(catalogCardById['mr-rabbit'].faction, 'Wonderland');
  assert.equal(catalogCardById['mr-rabbit'].rarity, 'Rare');
  for (const [id, art, name, rarity, , cost, power] of FAIRYTALE_WAVE) {
    assert.equal(cards[id].name, name); assert.equal(cards[id].cost, cost); assert.equal(cards[id].power, id === 'squabbleserver' ? 2 : power);
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
    assert.equal(after.discountTokens.find(t=>t.targetInstanceId===ally.instanceId)?.bonusHandsOnUse,1);
    assert.equal(after.playerDrawIndex,m.playerDrawIndex); assert.equal(after.cpuDrawIndex,m.cpuDrawIndex);
    const played=play(after,returned);
    assert(!played.discountTokens.some(t=>t.targetInstanceId===ally.instanceId));
    assert.equal(played.boards.flat().filter(c=>c.instanceId===ally.instanceId).length,1);
    assert.equal(find(played,ally).powerModifier,1,'the discounted redeployment also gains +1 Hand');
  });
  test(`Dorothy can return a cheap ally from another district but not an enemy or token for ${owner}`, () => {
    const m=blank(), distant=unit('bonnetgirl',owner,2,101), enemy=unit('bonnetgirl',owner==='player'?'cpu':'player',0,102);
    const token={...unit('bonnetgirl',owner,0,103),kind:'token' as const};
    m.boards=[[enemy,token],[],[distant]];
    const {source,after}=cast(m,'dorothy',owner);
    assert.equal(find(after,distant).lane,null);
    assert.equal(find(after,source).lane,0);
    assert.equal(find(after,enemy).lane,0);
    assert.equal(find(after,token).lane,0);
    const returned=find(after,distant), replayed=play(after,returned,1);
    assert.equal(getLegalCardCost(after,owner,returned,1),Math.max(1,returned.cost-1));
    assert.equal(find(replayed,distant).lane,1);
    assert.equal(find(replayed,distant).powerModifier,1);
    assert.equal(replayed.discountTokens.some(t=>t.targetInstanceId===distant.instanceId),false);
    const empty=cast(blank(),'dorothy',owner);
    assert.equal(empty.after.discountTokens.length,0,'no discounted bonus appears without an eligible ally');
  });
  test(`Dorothy's returned ally receives her bonus on its next play despite competing discounts for ${owner}`, () => {
    const m=blank(), ally=unit('tinman',owner,2,105);
    m.boards[2]=[ally];
    const {after}=cast(m,'dorothy',owner);
    const returned=find(after,ally);
    assert.equal(returned.lane,null);
    const competitors: Match['discountTokens']=[
      {id:'older-any',owner,sourceInstanceId:'older',eligibility:'any',sourceLane:0,createdOrder:0},
      {id:'prediction',owner,sourceInstanceId:'wise',eligibility:'wiseman-prediction',targetLane:1,sourceLane:0,createdOrder:0,expiresAfterRound:9},
      {id:'electric',owner,sourceInstanceId:'delivery',eligibility:'electric-delivery',targetLane:1,sourceLane:0,createdOrder:0,expiresAfterRound:9},
    ];
    const withDiscounts={...after,discountTokens:[...competitors,...after.discountTokens]};
    const replayed=play(withDiscounts,returned,1);
    assert.equal(getLegalCardCost(withDiscounts,owner,returned,1),1);
    assert.equal(find(replayed,ally).powerModifier,1,'the +1 is granted on this deployment, not deferred');
    assert.deepEqual(replayed.discountTokens.map(t=>t.id).sort(),competitors.map(t=>t.id).sort());
  });
}

for (const owner of ['player', 'cpu'] as const) {
  test(`Scarecrow moves alone to the first empty legal district for ${owner}`, () => {
    const m=blank(), {source,after}=cast(m,'scarecrow',owner);
    assert.equal(find(after,source).lane,1);
    assert.equal(find(after,source).powerModifier,1);
    assert.deepEqual(cast(JSON.parse(JSON.stringify(m)),'scarecrow',owner).after,after);
  });
  test(`Scarecrow does not move without a swap ally or empty legal district for ${owner}`, () => {
    const m=blank(), enemy=owner==='player'?'cpu':'player';
    m.boards[1]=Array.from({length:4},(_,i)=>unit('hooper',enemy,1,20+i));
    m.boards[2]=Array.from({length:4},(_,i)=>unit('hooper',enemy,2,30+i));
    const {source,after}=cast(m,'scarecrow',owner);
    assert.equal(find(after,source).lane,0);
    assert.equal(find(after,source).powerModifier,0);
  });
  test(`Scarecrow keeps its ally swap, Hands and movement hooks for ${owner}`, () => {
    const m=blank(), ally=unit('bonnetgirl',owner,1), lion=unit('lion',owner,1), tin=unit('tinman',owner,1);
    m.boards[1]=[ally,lion,tin];
    const {source,after}=cast(m,'scarecrow',owner);
    assert.equal(find(after,source).lane,1); assert.equal(find(after,ally).lane,0);
    assert.equal(find(after,source).powerModifier,3); assert.equal(find(after,ally).powerModifier,1);
    assert.equal(find(after,lion).powerModifier,2); assert(find(after,source).statuses.protected);
  });
  test(`Tin Man grants a bigger first reward to a moved ally or Oz traveler for ${owner}`, () => {
    const tin=unit('tinman',owner,1), partner=unit('bonnetgirl',owner,1,202);
    const m=blank();m.boards[1]=[tin,partner];
    const {source: scarecrow,after: swapped}=cast(m,'scarecrow',owner,0);
    assert.equal(find(swapped,scarecrow).lane,1);
    assert.equal(find(swapped,scarecrow).powerModifier,3,'moved Scarecrow gets +2 from Tin Man and +1 from the swap');
    assert.equal(find(swapped,scarecrow).statuses.protected,true);
    const {source: late,after: spent}=cast(swapped,'hooper',owner,1);
    assert.equal(find(spent,late).powerModifier,0,'Tin Man still triggers once per round');
    const withTraveler=blank(), anotherTin=unit('tinman',owner,0,203);
    withTraveler.boards[0]=[anotherTin];
    const {source: dorothy,after: welcomed}=cast(withTraveler,'dorothy',owner,0);
    assert.equal(find(welcomed,dorothy).powerModifier,2,'a played Oz traveler gets +2');
    assert.equal(find(welcomed,dorothy).statuses.protected,true);
    const withOrdinary=blank();withOrdinary.boards[0]=[unit('tinman',owner,0,204)];
    const {source: ordinary,after: ordinaryArrival}=cast(withOrdinary,'hooper',owner,0);
    assert.equal(find(ordinaryArrival,ordinary).powerModifier,1,'ordinary plays retain their old reward');
    assert.equal(find(ordinaryArrival,ordinary).statuses.protected,true);
  });
  test(`Tin Man triggers once on Mad Hatter's arrival and still rewards paired movement for ${owner}`, () => {
    const swap=blank(), cheap=unit('bonnetgirl',owner,0,220);
    const expensive=unit('hooper',owner,1,221);expensive.powerModifier=9;
    swap.boards=[[cheap,unit('tinman',owner,0,222)],[expensive],[]];
    const {after: swapped}=cast(swap,'madhatter',owner,0);
    assert.equal(find(swapped,cheap).lane,null);
    assert.equal(find(swapped,cheap).powerModifier,4);
    assert.equal(find(swapped,expensive).lane,0);
    assert.equal(find(swapped,expensive).statuses.protected,true);
    assert.equal(find(swapped,expensive).powerModifier,9,'Tin Man already greeted Mad Hatter this round');
    assert(swapped.effectLog.some(event=>event.note.includes('Heart Starter') && event.note.includes('+1 Hand')));

    const paired=blank(), passenger=unit('cornball',owner,0,223);
    paired.boards=[[passenger],[unit('tinman',owner,1,224)],
      Array.from({length:4},(_,i)=>unit('bonnetgirl',owner,2,225+i))];
    const {source: driver,after: driven}=cast(paired,'yn-atv-lord',owner,0);
    assert.equal(find(driven,driver).lane,1);
    assert.equal(find(driven,passenger).lane,1);
    assert(driven.effectLog.some(event=>event.note.includes('Heart Starter') && event.note.includes('+2 Hands')));
    assert.equal(find(driven,driver).statuses.protected,true);
  });
}
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
  assert.equal(returned.boards[0].find(c=>c.cardId==='grin')?.basePower,6);
  assert.equal(getLegalCardCost(returned,'player',hand,0),1);
  assert.match(getCardCostExplanation(returned,'player',hand,0),/Drink Me \/ Eat Me/);
  const back=play(returned,hand,0);assert.equal(find(back,alice).powerModifier,3);assert(!find(back,alice).aliceReady);
  assert.equal(getLegalCardCost(back,'player',find(back,alice),0),2,'Alice’s discount is consumed on replay');
  assert.equal(find(advance(back),alice).lane,0);
  const final=blank();final.round=6;final.boards[0]=[unit('alice','player',0)];
  assert.equal(advance(final).boards[0][0].cardId,'alice');
});
for (const owner of ['player', 'cpu'] as const) {
  test(`Cheshire in ${owner}'s hand leaves one six-Hand Grin on an ally's return`, () => {
    assert.equal(cards.cheshire.cost, 2);
    assert.equal(cards.cheshire.power, 3, 'base Hands remain within the cost-plus-one budget');
    const hand = owner === 'player' ? 'playerHand' : 'cpuHand';
    const alice = unit('alice', owner, 0);
    const cheshire = createCardInstance('cheshire', owner, 'hand-grin', 2);
    const m = blank();
    m.boards[0] = [alice];
    m[hand] = [cheshire];
    m.abilityUpgradeSnapshot = createAbilityUpgradeSnapshot(owner === 'player' ? ['cheshire'] : [], owner === 'cpu' ? ['cheshire'] : [],
      { [owner]: { cheshire: { level: 8, xp: 2800, moveTier: 3 } } });
    const returned = advance(m);
    assert.equal(find(returned, alice).lane, null);
    assert.equal(returned.boards[0].filter(c => c.cardId === 'grin').length, 1);
    assert.equal(returned.boards[0].find(c => c.cardId === 'grin')?.basePower, 6);
    assert.equal(find(returned, cheshire).waveTrainingUsed, true);
    assert.equal(find(returned, cheshire).powerModifier, 3, 'a hand trigger earns its upgrade exactly once');
    assert.equal(returned.cheshireRounds?.[owner], returned.round - 1);
    const deployed = play(returned, find(returned, cheshire), 1);
    assert.equal(find(deployed, cheshire).powerModifier, 3, 'hand-earned training survives deployment');

    const disabled = blank();
    disabled.boards[0] = [alice];
    disabled[hand] = [{ ...cheshire, statuses: { ...cheshire.statuses, silenced: true } }];
    assert(!advance(disabled).boards.flat().some(c => c.cardId === 'grin'));
  });

  test(`Alice's own next-play discount works for ${owner} without Mr Rabbit`, () => {
    const alice = unit('alice', owner, 0);
    const m = blank();
    m.boards[0] = [alice];
    const returned = advance(m);
    const ready = find(returned, alice);
    assert.equal(ready.lane, null);
    assert.equal(ready.aliceReady, true);
    assert.equal(ready.rabbitReturnDiscount, false);
    assert.equal(getLegalCardCost(returned, owner, ready, 1), 1);
    assert.match(getCardCostExplanation(returned, owner, ready, 1), /Drink Me \/ Eat Me/);
    const redeployed = play(returned, ready, 1);
    assert.equal(redeployed[owner === 'player' ? 'playerMotion' : 'cpuMotion'],
      returned[owner === 'player' ? 'playerMotion' : 'cpuMotion'] - 1, 'the printed discount is actually paid');
    assert.equal(find(redeployed, alice).aliceReady, false);
    assert.equal(find(redeployed, alice).powerModifier, 3);
    const withAnotherCredit = { ...returned, discountTokens: [{
      id: 'alice-targeted-credit', owner, sourceInstanceId: 'dorothy', targetInstanceId: ready.instanceId,
      eligibility: 'homecoming' as const, sourceLane: 0 as Lane, createdOrder: 1,
    }] };
    assert.equal(getLegalCardCost(withAnotherCredit, owner, ready, 1), 1, 'stacked discounts honor the 1-Motion floor');
    assert(!play(withAnotherCredit, ready, 1).discountTokens.some(t => t.id === 'alice-targeted-credit'));

    const charged = blank();
    const initiallyDrawn = createCardInstance('alice', owner, 'initial-alice', 1);
    assert.equal(getLegalCardCost(charged, owner, initiallyDrawn, 1), 2);
    const silenced = blank();
    silenced.boards[0] = [{ ...alice, statuses: { ...alice.statuses, silenced: true } }];
    assert.equal(find(advance(silenced), alice).lane, 0, 'suppressed Alice does not return or receive a credit');
  });

  test(`Mr Rabbit in ${owner}'s hand discounts Alice's next play, even after Rabbit leaves hand`, () => {
    const hand = owner === 'player' ? 'playerHand' : 'cpuHand';
    const rabbit = createCardInstance('mrrabbit', owner, 'pocket-watch', 4);
    const alice = unit('alice', owner, 0, 5);
    const m = blank();
    m.boards[0] = [alice];
    m[hand] = [rabbit];
    const returned = advance(m);
    const aliceInHand = find(returned, alice);
    assert.equal(aliceInHand.lane, null);
    assert.equal(aliceInHand.rabbitReturnDiscount, true);
    assert.equal(getLegalCardCost(returned, owner, aliceInHand, 1), 1);
    assert.match(getCardCostExplanation(returned, owner, aliceInHand, 1), /Pocket Watch/);
    assert.match(getCardCostExplanation(returned, owner, aliceInHand, 1), /Drink Me \/ Eat Me/);
    assert(returned.effectLog.some(e => e.cardInstanceId === rabbit.instanceId && e.note.includes('Pocket Watch')));
    const withoutRabbit = { ...returned, [hand]: returned[hand].filter(c => c.instanceId !== rabbit.instanceId) };
    assert.equal(getLegalCardCost(withoutRabbit, owner, aliceInHand, 1), 1, 'the return locks in its one-use discount');
    const redeployed = play(withoutRabbit, aliceInHand, 1);
    assert.equal(find(redeployed, alice).rabbitReturnDiscount, false);
    assert.equal(find(redeployed, alice).powerModifier, 3);
    const disabled = blank();
    disabled.boards[0] = [alice];
    disabled[hand] = [{ ...rabbit, statuses: { ...rabbit.statuses, silenced: true } }];
    assert.equal(find(advance(disabled), alice).rabbitReturnDiscount, false);

    const dorothyMatch = blank();
    const ally = unit('bonnetgirl', owner, 0, 12);
    dorothyMatch.boards[0] = [ally];
    dorothyMatch[hand] = [rabbit];
    const dorothyReturn = cast(dorothyMatch, 'dorothy', owner).after;
    const traveler = find(dorothyReturn, ally);
    assert.equal(traveler.rabbitReturnDiscount, true);
    assert(dorothyReturn.discountTokens.some(t => t.eligibility === 'homecoming' && t.targetInstanceId === traveler.instanceId));
    assert.equal(getLegalCardCost(dorothyReturn, owner, traveler, 0), 1);
    const backFromDorothy = play(dorothyReturn, traveler, 0);
    assert.equal(find(backFromDorothy, ally).powerModifier, 1, 'Dorothy still gives +1 Hand on replay');
    assert.equal(find(backFromDorothy, ally).rabbitReturnDiscount, false);
  });

  test(`Mr Rabbit on ${owner}'s board gains Hands on Dorothy and Alice returns alongside Cheshire`, () => {
    const rabbit = unit('mrrabbit', owner, 0, 4);
    const ally = unit('bonnetgirl', owner, 0, 5);
    const alice = unit('alice', owner, 1, 6);
    const cheshire = unit('cheshire', owner, 2, 7);
    const m = blank();
    m.boards = [[rabbit, ally], [alice], [cheshire]];
    const dorothy = cast(m, 'dorothy', owner).after;
    assert.equal(find(dorothy, ally).lane, null);
    assert.equal(find(dorothy, rabbit).powerModifier, 1);
    assert.equal(getLegalCardCost(dorothy, owner, find(dorothy, ally), 0), 1, 'Dorothy retains her Homecoming discount');
    assert.equal(dorothy.boards.flat().filter(c => c.cardId === 'grin').length, 1);
    const next = advance(dorothy);
    assert.equal(find(next, alice).lane, null);
    assert.equal(find(next, rabbit).powerModifier, 2, 'each separate return grants +1 Hand');
    assert.equal(next.boards.flat().filter(c => c.cardId === 'grin').length, 1, 'Cheshire still caps its Grin once per round');
    assert.equal(next.effectLog.filter(e => e.cardInstanceId === rabbit.instanceId && e.note.includes('Pocket Watch')).length, 2);

    const silenced = blank();
    silenced.boards[0] = [{ ...rabbit, statuses: { ...rabbit.statuses, silenced: true } }, ally];
    assert.equal(find(cast(silenced, 'dorothy', owner).after, rabbit).powerModifier, 0);
    const rival = owner === 'player' ? 'cpu' : 'player';
    const enemyReturn = blank();
    enemyReturn.boards = [[rabbit], [unit('alice', rival, 1, 10)], []];
    assert.equal(find(advance(enemyReturn), rabbit).powerModifier, 0, 'enemy returns do not grant Hands');
  });

  test(`Mr Rabbit's return credit stacks with an existing targeted discount for ${owner}, with a 1-Motion floor`, () => {
    const m = blank();
    const pricey = { ...createCardInstance('guap', owner, 'rabbit-credit', 1), rabbitReturnDiscount: true };
    const hand = owner === 'player' ? 'playerHand' : 'cpuHand';
    m[hand] = [pricey];
    m.discountTokens = [{ id: 'homecoming-rabbit-test', owner, sourceInstanceId: 'dorothy',
      targetInstanceId: pricey.instanceId, eligibility: 'homecoming', sourceLane: 0, createdOrder: 1 }];
    assert.equal(getLegalCardCost(m, owner, pricey, 0), 4, '6 base −1 Homecoming −1 Rabbit');
    const deployed = play(m, pricey, 0);
    assert.equal(find(deployed, pricey).rabbitReturnDiscount, false);
    assert(!deployed.discountTokens.some(t => t.id === 'homecoming-rabbit-test'));
    const cheap = { ...createCardInstance('bonnetgirl', owner, 'rabbit-floor', 2), rabbitReturnDiscount: true };
    assert.equal(getLegalCardCost({ ...m, [hand]: [cheap] }, owner, cheap, 0), 1);
  });
}
test('Cheshire only leaves one Grin each round and never duplicates a district token', () => {
  let m=blank();const cat=unit('cheshire','player',2), ally=unit('bonnetgirl','player',0);m.boards=[[ally],[],[cat]];
  m=cast(m,'dorothy').after;const returned=find(m,ally);m=play(m,returned,0);m.playerMotion=9;
  m=cast(m,'dorothy').after;assert.equal(m.boards.flat().filter(c=>c.cardId==='grin').length,1);
  m=advance(m);m.playerMotion=9;m=play(m,find(m,ally),0);m=cast(m,'dorothy').after;
  assert.equal(m.boards.flat().filter(c=>c.cardId==='grin').length,1);
});
test('Queen executes only at threshold; Protection and Built Different prevent a guard', () => {
  assert.equal(cards.queenofhearts.cost, 3);
  for (const protectedTarget of [false,true]) {
    const m=blank(), target=unit('bonnetgirl','cpu',0);m.boards[0]=[target];if(protectedTarget)cover(m,target);
    const {after}=cast(m,'queenofhearts');
    assert.equal(!!find(after,target),protectedTarget);assert.equal(after.boards[0].filter(c=>c.cardId==='cardguard').length,protectedTarget?0:1);
  }
  const m=blank(), legend=unit('homelesslegend','cpu',0);legend.powerModifier=2-legend.basePower;m.boards[0]=[legend];
  const {after}=cast(m,'queenofhearts');assert(find(after,legend).legendSaved);assert(!after.boards[0].some(c=>c.cardId==='cardguard'));
  for (const [hands, executed] of [[6, true], [7, false]] as const) {
    const threshold = blank(), enemy = unit('hooper', 'cpu', 0);
    enemy.powerModifier = hands - enemy.basePower;
    threshold.boards[0] = [enemy];
    const played = cast(threshold, 'queenofhearts').after;
    assert.equal(played.boards[0].some(c => c.instanceId === enemy.instanceId), !executed);
    assert.equal(played.boards[0].filter(c => c.cardId === 'cardguard').length, executed ? 1 : 0);
  }
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
test('DMV queue replaces the surcharge, does not stack, and expires', () => {
  let m=cast(blank(),'dmvworker').after;m.playerMotion=9;m=cast(m,'dmvworker').after;
  const enemy=createCardInstance('youngbull','cpu');
  assert.equal(getLegalCardCost(m,'cpu',enemy,0),2);
  assert.equal(m.creativeMarks?.filter(x=>x.kind==='queue').length,1);
  const after=play(m,enemy);assert.equal(find(after,enemy).powerModifier,0);
  assert(after.creativeMarks?.some(x=>x.kind==='delayed'));
  assert.equal(find(advance(after),enemy).powerModifier,1);
  assert(!advance(advance(m)).creativeMarks?.some(x=>x.kind==='queue'));
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
for (const owner of ['player', 'cpu'] as const) test(`Watson pairs with an active friendly Sherlock anywhere without manufacturing healing (${owner})`, () => {
  const enemy = owner === 'player' ? 'cpu' : 'player';
  const m = blank(), sherlock = unit('sherlock', owner, 2, 11), local = unit('hooper', owner, 0, 12);
  const rival = unit('sherlock', enemy, 1, 13);
  m.boards = [[local], [rival], [sherlock]];
  const healthy = cast(m, 'watson', owner).after;
  assert.equal(find(healthy, local).powerModifier, 0);
  assert(find(healthy, local).statuses.protected, 'the unchanged local fallback still protects');
  assert.equal(find(healthy, sherlock).powerModifier, 2);
  assert(find(healthy, sherlock).statuses.protected);
  assert.equal(find(healthy, sherlock).recoverableDamage ?? 0, 0);
  assert.equal(find(healthy, rival).powerModifier, 0);
  assert(!find(healthy, rival).statuses.protected);
  assert(!healthy.effectLog.some(e => e.note.includes('cleansing gave')));
  const solo = blank(); solo.boards[0] = [local];
  assert.equal(find(cast(solo, 'watson', owner).after, local).powerModifier, 0, 'no Sherlock means no extra Hands');

  const injured = unit('hooper', owner, 0, 14);
  injured.powerModifier = -4; injured.recoverableDamage = 4;
  const damage = blank(); damage.boards = [[injured], [], [sherlock]];
  const healed = cast(damage, 'watson', owner).after;
  assert.equal(find(healed, injured).powerModifier, -1, 'only three actual damage Hands are restored');
  assert.equal(find(healed, injured).recoverableDamage, 1);
  assert(find(healed, injured).statuses.protected);
  assert.equal(find(healed, sherlock).powerModifier, 2, 'detective bonus is separate from the heal');
  assert.equal(find(healed, sherlock).recoverableDamage ?? 0, 0);
  for (const status of ['silenced', 'frozen', 'weakened'] as const) {
    const disabled = blank(), inactive = { ...sherlock, statuses: { ...sherlock.statuses, [status]: true } };
    disabled.boards[2] = [inactive];
    const result = cast(disabled, 'watson', owner).after;
    assert.equal(find(result, inactive).powerModifier, 0);
    assert(!find(result, inactive).statuses.protected);
  }
  assert.match(cards.watson.effect, /Protect a friendly Sherlock anywhere and give him \+2 Hands/);
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
for (const owner of ['player', 'cpu'] as const) test(`P. Tang pays only for landed damage whose survivor cannot be knocked back for ${owner}`, () => {
  const opponent = owner === 'player' ? 'cpu' : 'player';
  const m = blank(), tang = unit('ptang', owner, 0), victim = unit('hooper', opponent, 0);
  victim.powerModifier = 8;
  const blockers = [1, 2].flatMap(lane => Array.from({ length: 4 }, (_, i) => unit('cornball', opponent, lane as Lane, 100 + lane * 10 + i)));
  m.boards = [[victim], blockers.slice(0, 4), blockers.slice(4)];
  const { source, after } = cast(m, 'ptang', owner);
  assert.equal(find(after, victim).lane, 0, 'both enemy destinations are full');
  assert.equal(find(after, victim).powerModifier, 6, 'the damage is preserved');
  assert.equal(find(after, source).powerModifier, 1, 'surviving damage with failed knockback pays once');

  const locked = blank(), lockedVictim = unit('hooper', opponent, 0);
  lockedVictim.powerModifier = 8; lockedVictim.statuses.locked = true; locked.boards[0] = [lockedVictim];
  const lockedTang = cast(locked, 'ptang', owner);
  const blockedMove = lockedTang.after;
  assert.equal(find(blockedMove, lockedVictim).powerModifier, 6);
  assert.equal(find(blockedMove, lockedVictim).lane, 0);
  assert.equal(find(blockedMove, lockedTang.source).powerModifier, 1, 'locked survivor pays the fallback');

  const noEnemy = cast(blank(), 'ptang', owner);
  assert.equal(find(noEnemy.after, noEnemy.source).powerModifier, 0);
  const lethal = blank(), fragile = unit('bonnetgirl', opponent, 0);
  lethal.boards[0] = [fragile];
  const lethalResult = cast(lethal, 'ptang', owner).after;
  assert.equal(find(lethalResult, fragile), undefined);
  assert.equal(find(lethalResult, source).powerModifier, 0, 'lethal damage does not pay');

  const protectedMatch = blank(), shielded = unit('hooper', opponent, 0);
  shielded.powerModifier = 8; protectedMatch.boards[0] = [shielded]; cover(protectedMatch, shielded);
  const protectedResult = cast(protectedMatch, 'ptang', owner).after;
  assert.equal(find(protectedResult, shielded).powerModifier, 8);
  assert.equal(find(protectedResult, source).powerModifier, 0, 'Protection blocks damage and fallback');
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
  assert.equal(find(hit,bonnet).powerModifier,2);assert.equal(find(hit,ally).lane,0);assert(find(hit,ally).statuses.protected);assert.equal(find(hit,vamp).powerModifier,2);
  const again=cast({...hit,playerMotion:9},'powerhouse').after;assert.equal(find(again,vamp).powerModifier,2);
});
test('Protection prevents damage reactions, and opposing cooks cannot retaliate indefinitely', () => {
  const m=blank(), a=unit('squabblecook','player',0), b=unit('squabblecook','cpu',0), victim=unit('hooper','cpu',0), bonnet=unit('bonnetgirl','cpu',0);
  victim.powerModifier=8;a.powerModifier=8;b.powerModifier=8;m.boards[0]=[a,b,victim,bonnet];cover(m,victim);
  const blocked=cast(m,'ptang').after;assert.equal(find(blocked,bonnet).powerModifier,0);assert.equal(find(blocked,a).powerModifier,8);
  const hit=cast({...blocked,playerMotion:9},'ptang').after;assert(hit.effectLog.length<40);
  assert.equal(find(hit,b).waveRounds?.squabblecook,3);assert.equal(find(hit,a).waveRounds?.squabblecook,3);
});
for (const owner of ['player', 'cpu'] as const) {
  test(`Oz prefers the most recent eligible Oz traveler over a newer ordinary entrance for ${owner}`, () => {
    const m=blank(), dorothy=unit('dorothy',owner,0), saved=unit('bonnetgirl',owner,0);
    const ordinary=unit('corruptpastor',owner,1), donor=unit('hooper',owner,1);
    m.boards=[[dorothy,saved],[ordinary,donor],[]];
    m.entranceHistory=[dorothy.instanceId,ordinary.instanceId];
    const {source,after}=cast(m,'oz',owner,2);
    assert(find(after,source).waveOnce?.oz);
    assert.equal(find(after,saved).lane,null,'Dorothy is echoed instead of the newer ordinary character');
    assert.equal(find(after,donor).powerModifier,0);
    assert.deepEqual(cast(JSON.parse(JSON.stringify(m)),'oz',owner,2).after,after);
  });
  test(`Oz falls back to the most recent eligible ordinary entrance when no traveler qualifies for ${owner}`, () => {
    const m=blank(), ally=unit('corruptpastor',owner,0), donor=unit('hooper',owner,0);
    m.boards[0]=[ally,donor];m.entranceHistory=[ally.instanceId];
    const {source,after}=cast(m,'oz',owner,1);
    assert(find(after,source).waveOnce?.oz);
    assert.equal(find(after,ally).powerModifier,2);
    assert.equal(find(after,donor).powerModifier,-1);
  });
  test(`Oz refuses copying loops for ${owner}`, () => {
    const loop=blank(), echo=unit('tayaty',owner,0);loop.boards[0]=[echo];loop.entranceHistory=[echo.instanceId];
    const rejected=cast(loop,'oz',owner);assert(!find(rejected.after,rejected.source).waveOnce?.oz);
  });
}

test('Oz movement bonus uses successful current-round IDs, not persistent moved flags or one-mover history', () => {
  const ally = unit('corruptpastor', 'player', 0), later = unit('hooper', 'player', 0);
  ally.moved = true; // Historical objective flag alone must not qualify.
  let m = blank();
  m.boards[0] = [ally, later];
  m.entranceHistory = [later.instanceId, ally.instanceId];
  m.roundMovedIds = { player: [ally.instanceId, later.instanceId], cpu: [] };
  const first = cast(m, 'oz', 'player', 1).after;
  assert.equal(find(first, ally).powerModifier, 4); // entrance value + current-round movement bonus
  assert(first.roundMovedIds?.player.includes(ally.instanceId));
  assert.deepEqual(cast(JSON.parse(JSON.stringify(m)), 'oz', 'player', 1).after, first);

  const next = { ...m, round: 4, roundMovedIds: { player: [], cpu: [] } };
  const noBonus = cast(next, 'oz', 'player', 1).after;
  assert.equal(find(noBonus, ally).powerModifier, 2);
});
test('the same fairytale rules survive six-round authoritative online games for both seats', () => {
  const ids=FAIRYTALE_WAVE.slice(0,10).map(([id])=>id), other=FAIRYTALE_WAVE.slice(11,21).map(([id])=>id);
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

for (const owner of ['player', 'cpu'] as const) {
  test(`${owner}: Stakeout pays only on cancellation and snapshots both rewards at every training tier`, () => {
    const enemy = owner === 'player' ? 'cpu' : 'player';
    for (let tier = 0; tier <= 3; tier++) {
      const m = blank(), a = unit('rastamon', owner, 1, 1), b = unit('rastamon', owner, 2, 2);
      m.boards = [[], [a, unit('hooper', enemy, 1)], [b]];
      m.abilityUpgradeSnapshot = createAbilityUpgradeSnapshot(owner === 'player' ? ['sherlock'] : [], owner === 'cpu' ? ['sherlock'] : [],
        { [owner]: { sherlock: { level: [1, 2, 5, 8][tier], xp: 2800, moveTier: tier } } });
      const { source, after: set } = cast(m, 'sherlock', owner);
      assert.equal(find(set, source).powerModifier, tier);
      assert.equal(find(set, a).powerModifier, 0);
      const before = JSON.stringify(set), hit = cast(set, 'cornball', enemy, 1);
      assert.equal(JSON.stringify(set), before);
      assert.deepEqual(cast(JSON.parse(before), 'cornball', enemy, 1).after, hit.after);
      assert.equal(find(hit.after, source).powerModifier, tier + 2);
      assert.equal(find(hit.after, a).powerModifier, 2); // stable ID breaks equal-Hands tie
      assert.equal(find(hit.after, b).powerModifier, 0);
      assert.equal(find(hit.after, a).statuses.burnStacks, 0); // entrance canceled
      assert.equal(hit.after.effectLog.filter(e => e.abilityMetadata).length, tier);
      const event = hit.after.effectLog.find(e => e.note.startsWith('Stakeout canceled Cornball'))!;
      assert.deepEqual(new Set([event.source!.cardInstanceId, ...event.targets.map(t => t.cardInstanceId)]), new Set([hit.source.instanceId, source.instanceId, a.instanceId]));
      assert.equal(event.replay.before.boards.flat().find(c => c.instanceId === a.instanceId)!.powerModifier, 0);
      assert.equal(event.replay.after.boards.flat().find(c => c.instanceId === a.instanceId)!.powerModifier, 2);
      const again = cast({ ...hit.after, playerMotion: 9, cpuMotion: 9 }, 'cornball', enemy, 1).after;
      assert.equal(find(again, source).powerModifier, tier + 2);
      assert.equal(again.districtTraps?.length, 0);
    }
  });
  test(`${owner}: absent or disabled Sherlock still cancels but grants neither reward; expiry and avoidance never pay`, () => {
    const enemy = owner === 'player' ? 'cpu' : 'player';
    for (const status of ['silenced', 'frozen', 'weakened', 'absent'] as const) {
      const m = blank(), ally = unit('rastamon', owner, 2); m.boards[2] = [ally];
      const placed = cast(m, 'sherlock', owner), set = placed.after, lane = set.districtTraps![0].lane;
      set.boards[0] = status === 'absent' ? [] : set.boards[0].map(c => ({ ...c, statuses: { ...c.statuses, [status]: true } }));
      const hit = cast(set, 'cornball', enemy, lane).after;
      assert.equal(find(hit, ally).powerModifier, 0);
      assert.equal(find(hit, placed.source)?.powerModifier ?? 0, 0);
      assert.equal(hit.districtTraps?.length, 0);
    }
    const placed = cast(blank(), 'sherlock', owner), lane = placed.after.districtTraps![0].lane;
    const avoided = cast(placed.after, 'cornball', enemy, ((lane + 1) % 3) as Lane).after;
    assert.equal(find(avoided, placed.source).powerModifier, 0);
    const expired = advance(advance(avoided));
    assert(!getCharacterDistrictMarks(expired).some(mark => mark.text.includes('Stakeout')));
    assert.equal(find(expired, placed.source).powerModifier, 0);
  });
  test(`${owner}: Stakeout excludes tokens, support, hazards and enemies from its reward, and Watson retains the three-Hand heal cap`, () => {
    const enemy = owner === 'player' ? 'cpu' : 'player', m = blank();
    m.boards[2] = [
      { ...unit('bonnetgirl', owner, 2, 1), kind: 'token' },
      { ...unit('bonnetgirl', owner, 2, 2), kind: 'support' },
      { ...unit('bonnetgirl', owner, 2, 3), hazard: true },
      unit('bonnetgirl', enemy, 2, 4),
    ];
    const placed = cast(m, 'sherlock', owner);
    const after = cast(placed.after, 'cornball', enemy, placed.after.districtTraps![0].lane).after;
    assert.equal(find(after, placed.source).powerModifier, 2);
    assert(after.boards[2].every(c => c.powerModifier === 0));
    const injured = unit('hooper', owner, 0); injured.powerModifier = -4; injured.recoverableDamage = 4;
    const heal = blank(); heal.boards[0] = [injured];
    const treated = cast(heal, 'watson', owner).after;
    assert.equal(find(treated, injured).recoverableDamage, 1);
    assert.equal(find(treated, injured).powerModifier, -1);
    assert(find(treated, injured).statuses.protected);
    assert.equal(cards.watson.power, 3); assert.equal(cards.watson.cost, 2);
  });
}

for (const owner of ['player', 'cpu'] as const) test('Heart Starter gives one Hand even to a protected arrival and shares its round cap for ' + owner, () => {
  const m = blank(), tin = unit('tinman', owner, 0);
  m.boards[0] = [tin];
  const entrant = createCardInstance('cornball', owner, 'protected-arrival');
  entrant.statuses.protected = true;
  const first = play(m, entrant);
  assert.equal(find(first, entrant).powerModifier, 1);
  const second = cast(first, 'cornball', owner);
  assert.equal(find(second.after, second.source).powerModifier, 0);
  const later = cast({...second.after, round: 4, playerMotion: 9, cpuMotion: 9}, 'cornball', owner);
  assert.equal(find(later.after, later.source).powerModifier, 1);
  for (const status of ['silenced', 'frozen', 'weakened'] as const) {
    const disabled = blank(), leader = unit('tinman', owner, 0);
    leader.statuses[status] = true; disabled.boards[0] = [leader];
    const result = cast(disabled, 'cornball', owner);
    assert.equal(find(result.after, result.source).powerModifier, 0);
    assert(!find(result.after, result.source).statuses.protected);
  }
});
