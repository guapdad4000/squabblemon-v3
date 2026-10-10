import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cards, cardCatalog, catalogCardByEngineId, validateSavedDeck } from '@workspace/squabblemon-engine/data';
import {
  BALANCE_TELEMETRY_SEMANTICS, evaluateBalanceState, greedyBalancePolicy, seededLegalBalancePolicy,
  listLegalBalancePlays, observeBalanceCards, seededDeckRotation,
  type BalanceDeck, type BalanceTier, type BalanceSeat, type BalancePlayOption, type BalanceCardObservation,
} from '@workspace/squabblemon-engine/balanceLab';
import {
  createAbilityUpgradeSnapshot, createMatchFromEngineCards, createDistrictSnapshot,
  getDistrictResults, getMatchWinner, playTurnCard, suppressMatchPresentationEvents,
  type Match, type Owner, type EffectLogEntry,
} from '@workspace/squabblemon-engine/gameEngine';
import { createOnlineRoom, joinOnlineRoom, applyOnlineCommand, type OnlineRoom } from '@workspace/squabblemon-engine/multiplayer';
import { authoredRankingDecks, allRankingDecks } from './all-decks-ranking-decks';

export const sweepRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { recommendedWorkshopCrews } = await import(new URL('../../artifacts/squabblemon/src/lib/deckWorkshop.ts', import.meta.url).href);
export const telemetryColumns = ['cardId','played','finalCopies','finalPower','activatedPlays','normalPlays','unknownPlays','baseEvents','baseDirectEffectEvents','baseNoObservedEffectEvents','baseNestedEffectEvents','baseNestedNoObservedEffectEvents','baseUnknownEvents','upgradeEvents','upgradeAppliedEvents'] as const;
export const telemetrySemantics = BALANCE_TELEMETRY_SEMANTICS;
export type SweepPolicy = 'greedy' | 'seeded-legal' | 'greedy-paid' | 'forced-deployment' | 'chain-two';
export type SweepCase = {key:string; stage:string; a:string; b:string; policy:SweepPolicy; seed:string; rotation:number; tierA:BalanceTier; tierB:BalanceTier; seat:BalanceSeat; target?:string};
export type SweepResult = {winner:Owner|'draw'; logicalWinner:'a'|'b'|'draw'; districtIds:readonly string[]; playerDistricts:number; cpuDistricts:number; laneMargins:number[]; plays:number; passes:number; effectEvents:number; investments:Record<string,number>; choices:Record<string,number>; cardsA:readonly BalanceCardObservation[]; cardsB:readonly BalanceCardObservation[]};

export function sourceManifest() {
  const files = new Set(['scripts/src/all-decks-ranking-decks.ts','scripts/src/element-balance-audit-decks.ts','artifacts/squabblemon/src/lib/deckWorkshop.ts','artifacts/squabblemon/src/data.ts']);
  const visit = (relative:string) => {
    for(const entry of readdirSync(path.join(sweepRoot,relative),{withFileTypes:true})) {
      const name=path.join(relative,entry.name);
      if(entry.isDirectory()) visit(name); else if(/\.[cm]?tsx?$/.test(name)) files.add(name);
    }
  };
  visit('lib/squabblemon-engine/src');
  for(const name of readdirSync(path.join(sweepRoot,'scripts/src'))) if(/^fullBalanceSweep.*\.ts$/.test(name)) files.add(`scripts/src/${name}`);
  const entries=[...files].sort().map(file=>({file,sha256:createHash('sha256').update(readFileSync(path.join(sweepRoot,file))).digest('hex')}));
  const hash=createHash('sha256');
  for(const entry of entries) hash.update(entry.file).update('\0').update(readFileSync(path.join(sweepRoot,entry.file))).update('\0');
  return {sha256:hash.digest('hex'),files:entries};
}

export function assertLegalDeck(deck:BalanceDeck) {
  assert.equal(deck.cardIds.length,10,`${deck.id}: ten cards`);
  assert.equal(new Set(deck.cardIds).size,10,`${deck.id}: one copy each`);
  assert(deck.cardIds.every(id=>cards[id]&&cards[id].kind!=='token'&&!cards[id].hazard),`${deck.id}: catalog playable cards`);
  const ids=deck.cardIds.map(id=>catalogCardByEngineId[id].catalogId);
  const hero=deck.cardIds.find(id=>(cards[id].kind??'character')==='character')!;
  assert(hero,`${deck.id}: hero`);
  assert.equal(validateSavedDeck(ids,ids,catalogCardByEngineId[hero].catalogId).valid,true,`${deck.id}: actual saved-deck legality`);
}

export function inventory() {
  const authored=authoredRankingDecks();
  const approvedRed=allRankingDecks().find(deck=>deck.id==='focused-red-set')!;
  assert(!approvedRed.cardIds.includes('guap'));
  const candidates=[...authored.map(deck=>deck.id==='focused-red-set'?approvedRed:deck),...Object.entries(recommendedWorkshopCrews).map(([id,ids])=>({id:`workshop-${id}`,name:`Workshop ${id}`,cardIds:[...ids as string[]]}))];
  const byComposition=new Map<string,BalanceDeck>();
  const aliases:Record<string,string[]>={};
  for(const deck of candidates) {
    assertLegalDeck(deck);
    const composition=[...deck.cardIds].sort().join('|'),existing=byComposition.get(composition);
    if(existing) aliases[existing.id].push(deck.id);
    else {byComposition.set(composition,deck);aliases[deck.id]=[deck.id];}
  }
  const decks=[...byComposition.values()];
  const historicalRed={...authored.find(deck=>deck.id==='focused-red-set')!,id:'historical-red-guap-folks',name:'Historical red shell with GUAP/FOLKS (diagnostic only)'};
  assertLegalDeck(historicalRed);
  const catalog=cardCatalog.filter(card=>card.kind!=='token'&&!card.hazard).map(card=>({id:card.engineId,name:card.name,kind:card.kind??'character',type:card.type,cost:card.cost}));
  const included=new Set(decks.flatMap(deck=>deck.cardIds));
  const missing=catalog.filter(card=>!included.has(card.id));
  const probes=missing.map(card=>representativeDeck(card.id,decks));
  return {candidates:candidates.length,decks,aliases,catalog,represented:included.size,missing,probes,historicalRed};
}

export function representativeDeck(cardId:string,decks:readonly BalanceDeck[]):BalanceDeck {
  const authored=decks.find(deck=>deck.cardIds.includes(cardId));
  if(authored) return authored;
  const card=cards[cardId]; assert(card);
  const ranked=[...decks].sort((a,b)=>b.cardIds.filter(id=>cards[id].type===card.type).length-a.cardIds.filter(id=>cards[id].type===card.type).length||a.id.localeCompare(b.id));
  const shell=ranked[0];
  const result={id:`probe-${cardId}`,name:`${card.name} in ${shell.name}`,orderKey:shell.orderKey??shell.id,cardIds:[cardId,...shell.cardIds.filter(id=>id!==cardId).slice(0,9)]};
  assertLegalDeck(result); return result;
}

export function scenario(values:Omit<SweepCase,'key'>):SweepCase {
  return {...values,key:[values.stage,values.a,values.b,values.policy,values.seed,values.rotation,values.tierA,values.tierB,values.seat,values.target??''].join('|')};
}
export function packedCards(observations:readonly BalanceCardObservation[]) {
  return observations.map(c=>[c.cardId,c.played,c.finalCopies,c.finalPower,c.squabbleEvidence.activatedPlays,c.squabbleEvidence.normalPlays,c.squabbleEvidence.unknownPlays,...['baseEvents','baseDirectEffectEvents','baseNoObservedEffectEvents','baseNestedEffectEvents','baseNestedNoObservedEffectEvents','baseUnknownEvents','upgradeEvents','upgradeAppliedEvents'].map(key=>c.abilityEvidence[key as keyof typeof c.abilityEvidence])]);
}

export function progression(cardIds:readonly string[],tier:BalanceTier) {
  assert.equal(tier,0,'This suite only permits base cards');
  return Object.fromEntries(cardIds.map(id=>[id,{xp:0,level:1,moveTier:0}]));
}

type PaidOption=BalancePlayOption&{investment:number};
function paidOptions(match:Match,owner:Owner,options:readonly BalancePlayOption[]):PaidOption[] {
  const result=options.map(option=>({...option,investment:0}));
  const motion=owner==='player'?match.playerMotion:match.cpuMotion;
  const opposingMotion=owner==='player'?match.cpuMotion:match.playerMotion;
  for(const option of options.filter(option=>!option.squabble&&['homelessguy','the-dice-game','the-concert'].includes(option.cardId))) {
    const max=option.cardId==='the-concert'?1:option.cardId==='the-dice-game'?3:4;
    for(let investment=1;investment<=max;investment++) {
      // Dice choice0 already means wager1. Concert's mode1 is free; all other investments spend Motion.
      if(option.cardId==='the-dice-game'&&investment===1) continue;
      if(option.cardId!=='the-concert'&&(motion<option.cost+investment||(option.cardId==='the-dice-game'&&opposingMotion<investment))) continue;
      try {result.push({...option,investment,cost:option.cardId==='the-concert'?option.cost:option.cost+investment,preview:playTurnCard(match,owner,option.instanceId,option.lane,false,investment)});}
      catch(error) {if(!(error instanceof Error)||error.message!=='Invalid extra Motion investment') throw error;}
    }
  }
  return result;
}

/** Conservative previews cannot anticipate hidden hand contents or unseen draws.
 * The selected command still resolves against the complete authoritative room. */
export function policySearchState(match:Match,owner:Owner):Match {
  return {...match,[owner==='player'?'cpuHand':'playerHand']:[],
    playerCardIds:[],cpuCardIds:[],playerDrawIndex:0,cpuDrawIndex:0};
}

export function evaluatePublicState(match:Match,owner:Owner) {
  return evaluateBalanceState({...match,[owner==='player'?'cpuHand':'playerHand']:[]},owner);
}

function chooseChain(match:Match,owner:Owner,options:readonly BalancePlayOption[]):BalancePlayOption|null {
  const baseline=evaluatePublicState(match,owner);
  const ranked=options.map(option=>({option,now:evaluatePublicState(option.preview,owner)})).sort((a,b)=>b.now-a.now||a.option.cardId.localeCompare(b.option.cardId)||a.option.lane-b.option.lane||Number(a.option.squabble)-Number(b.option.squabble));
  const shortlist=ranked.slice(0,4).map(item=>{
    const follow=listLegalBalancePlays(item.option.preview,owner,true);
    const then=Math.max(item.now,...follow.map(option=>evaluatePublicState(option.preview,owner)));
    return {...item,score:item.now+0.65*(then-item.now)};
  }).sort((a,b)=>b.score-a.score||a.option.cardId.localeCompare(b.option.cardId)||a.option.lane-b.option.lane);
  return shortlist[0]&&shortlist[0].score>baseline+0.05?shortlist[0].option:null;
}

export function simulateSweepCase(test:SweepCase,decks:ReadonlyMap<string,BalanceDeck>,observe?:(match:Readonly<Match>)=>void,compactPreviews=true):SweepResult {
  assert.equal(test.tierA,0,'PvP audit only accepts base cards');assert.equal(test.tierB,0,'PvP audit only accepts base cards');
  const deckA=decks.get(test.a)!,deckB=decks.get(test.b)!; assert(deckA&&deckB);
  const aOwner:Owner=test.seat==='a-player'?'player':'cpu',bOwner:Owner=aOwner==='player'?'cpu':'player';
  const orderA=seededDeckRotation(deckA.cardIds,`${test.seed}:a:${deckA.orderKey??deckA.id}`,test.rotation);
  const orderB=seededDeckRotation(deckB.cardIds,`${test.seed}:b:${deckB.orderKey??deckB.id}`,test.rotation);
  const playerCards=aOwner==='player'?orderA:orderB,cpuCards=aOwner==='cpu'?orderA:orderB;
  const snapshot=createAbilityUpgradeSnapshot(playerCards,cpuCards,{player:progression(playerCards,aOwner==='player'?test.tierA:test.tierB),cpu:progression(cpuCards,aOwner==='cpu'?test.tierA:test.tierB)});
  let match=createMatchFromEngineCards(aOwner==='player'?deckA.id:deckB.id,playerCards,aOwner==='cpu'?deckA.id:deckB.id,cpuCards,undefined,undefined,snapshot,createDistrictSnapshot(test.seed));
  match={...match,squabbleByOwner:{player:false,cpu:false}};
  const member=(owner:Owner)=>({userId:owner,name:owner,ready:true,deck:{id:owner,name:owner,hero:catalogCardByEngineId[(owner==='player'?playerCards:cpuCards).find(id=>(cards[id].kind??'character')==='character')!].catalogId,cards:(owner==='player'?playerCards:cpuCards).map(id=>catalogCardByEngineId[id].catalogId)}});
  let room:OnlineRoom={...joinOnlineRoom(createOnlineRoom(member('player'),'player',0),member('cpu'),1),match,status:'active',deadline:1000000};
  let actionIndex=0,plays=0;
  const investments:Record<string,number>={},choices:Record<string,number>={};
  while(room.status==='active') {
    match=room.match!;
    if(actionIndex++>256) throw new Error('PvP sweep exceeded 256 actions');
    const owner=room.activeSeat;
    const expectedFirst=match.round%2===1?room.openingSeat:room.openingSeat==='player'?'cpu':'player';
    assert.equal(owner,room.turnsEnded===0?expectedFirst:expectedFirst==='player'?'cpu':'player','Actual PvP alternates round initiative');
    const searchMatch=policySearchState(compactPreviews?suppressMatchPresentationEvents(match):match,owner);
    const legal=listLegalBalancePlays(searchMatch,owner,true);
    const options:readonly BalancePlayOption[]=paidOptions(searchMatch,owner,legal);
    const context={match:searchMatch,owner,legalPlays:options,actionIndex:actionIndex-1,seed:`${test.seed}:${test.rotation}:0:${test.seat}`,evaluate:evaluatePublicState};
    let chosen:BalancePlayOption|null;
    if(test.policy==='forced-deployment'&&owner===aOwner&&test.target) {
      const candidates=options.filter(option=>option.cardId===test.target);
      chosen=candidates.length?candidates[(test.rotation+actionIndex)%candidates.length]:seededLegalBalancePolicy(context);
    }else if(test.policy==='chain-two') chosen=chooseChain(searchMatch,owner,options);
    else chosen=(test.policy==='seeded-legal'||test.policy==='forced-deployment')?seededLegalBalancePolicy(context):greedyBalancePolicy(context);
    if(!chosen) {room=applyOnlineCommand(room,owner,{type:'end-turn'},actionIndex);continue;}
    assert(options.includes(chosen),'Policy selected canonical legal option');
    const investment=(chosen as Partial<PaidOption>).investment??0;
    if(investment) investments[chosen.cardId]=(investments[chosen.cardId]??0)+investment;
    choices[`${chosen.cardId}:${investment}`]=(choices[`${chosen.cardId}:${investment}`]??0)+1;
    room=applyOnlineCommand(room,owner,{type:'play',instanceId:chosen.instanceId,lane:chosen.lane,squabble:chosen.squabble,investment},actionIndex);plays++;
    if(plays>96) throw new Error('PvP sweep exceeded 96 plays');
  }
  match=room.match!;
  const winner=getMatchWinner(match);assert(winner);
  const logicalWinner=winner==='draw'?'draw':winner===aOwner?'a':'b';
  const districtResults=getDistrictResults(match);
  assert.equal(districtResults.filter(r=>r.winner==='player').length>=2?'player':districtResults.filter(r=>r.winner==='cpu').length>=2?'cpu':'draw',winner);
  assert.equal(room.winner,winner);
  observe?.(match);
  return {winner,logicalWinner,districtIds:match.districtSnapshot!.locations.map(location=>location.id),playerDistricts:districtResults.filter(r=>r.winner==='player').length,cpuDistricts:districtResults.filter(r=>r.winner==='cpu').length,laneMargins:districtResults.map(r=>r.player-r.cpu),plays:match.effectLog.filter(e=>e.type==='play').length,passes:match.effectLog.filter(e=>e.type==='pass').length,effectEvents:match.effectLog.length,investments,choices,cardsA:observeBalanceCards(match,aOwner,deckA),cardsB:observeBalanceCards(match,bOwner,deckB)};
}

export function eventProof(event:EffectLogEntry) {
  return {owner:event.owner,cardId:event.cardId,type:event.type,kind:event.kind,note:event.note,source:event.source,targets:event.targets,abilityMetadata:event.abilityMetadata};
}
