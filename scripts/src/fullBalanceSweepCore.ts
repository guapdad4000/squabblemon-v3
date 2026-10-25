import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, realpathSync } from 'node:fs';
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
  getDistrictResults, getMatchWinner, suppressMatchPresentationEvents,
  type Match, type Owner, type EffectLogEntry,
} from '@workspace/squabblemon-engine/gameEngine';
import { CARD_BALANCE_VERSION, ONLINE_RULES_VERSION, createOnlineRoom, joinOnlineRoom, applyOnlineCommand, type OnlineRoom } from '@workspace/squabblemon-engine/multiplayer';
import { authoredRankingDecks, allRankingDecks } from './all-decks-ranking-decks';

export const sweepRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { recommendedWorkshopCrews } = await import(new URL('../../artifacts/squabblemon/src/lib/deckWorkshop.ts', import.meta.url).href);
export const telemetryColumns = ['cardId','played','finalCopies','finalPower','activatedPlays','normalPlays','unknownPlays','baseEvents','baseDirectEffectEvents','baseNoObservedEffectEvents','baseNestedEffectEvents','baseNestedNoObservedEffectEvents','baseUnknownEvents','upgradeEvents','upgradeAppliedEvents'] as const;
export const telemetrySemantics = BALANCE_TELEMETRY_SEMANTICS;
export const SWEEP_POLICY_VERSION = 'online-base-shared-legal-delayed-horizon-v3';
export type SweepPolicy = 'greedy' | 'seeded-legal' | 'greedy-paid' | 'forced-deployment' | 'chain-two';
export type SweepCase = {key:string; stage:string; a:string; b:string; policy:SweepPolicy; seed:string; rotation:number; tierA:BalanceTier; tierB:BalanceTier; seat:BalanceSeat; target?:string};
export type SweepResult = {winner:Owner|'draw'; logicalWinner:'a'|'b'|'draw'; districtIds:readonly string[]; playerDistricts:number; cpuDistricts:number; laneMargins:number[]; plays:number; passes:number; effectEvents:number; investments:Record<string,number>; choices:Record<string,number>; cardsA:readonly BalanceCardObservation[]; cardsB:readonly BalanceCardObservation[]};

/** Refuse a workspace symlink that executes different sources than the manifest hashes. */
export function runtimeProvenance() {
  const root=realpathSync(sweepRoot);
  const engineSources=Object.fromEntries(['data','gameEngine','multiplayer','balanceLab'].map(name=>{
    const resolved=realpathSync(fileURLToPath(import.meta.resolve(`@workspace/squabblemon-engine/${name}`)));
    const expected=realpathSync(path.join(root,`lib/squabblemon-engine/src/${name}.ts`));
    assert.equal(resolved,expected,`Engine ${name} must resolve inside the audited worktree`);
    return [name,path.relative(root,resolved)];
  }));
  return {node:process.version,platform:process.platform,arch:process.arch,engineSources};
}

export function auditSeedNamespace(label:string|undefined) {
  assert(label&&/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(label),'Supply a unique run label (1–80 letters, digits, dots, dashes or underscores)');
  return `base-pvp-b${CARD_BALANCE_VERSION}-r${ONLINE_RULES_VERSION}-${label}`;
}

/** Stable across JSON key order, but sensitive to any schedule or provenance change. */
export function planFingerprint(plan:object):string {
  const canonical=(value:unknown):unknown=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'
    ?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,item])=>[key,canonical(item)])):value;
  const {planHash:_ignored,...payload}=plan as Record<string,unknown>;
  return createHash('sha256').update(JSON.stringify(canonical(payload))).digest('hex');
}

export function assertPlanFingerprint(plan:object&{schemaVersion?:number;planHash?:string}) {
  assert.equal(plan.schemaVersion,2,'Legacy plans must be regenerated for this harness');
  assert.equal(plan.planHash,planFingerprint(plan),'Plan changed after initialization');
}

export function assertSuccessfulSummary(plan:{planHash:string;sourceHash:string;cases:readonly unknown[];balanceVersion:number;rulesVersion:number;policyVersion:string},summary:Record<string,any>) {
  assert.equal(summary.schemaVersion,2,'Current summary schema required');
  for(const key of ['planHash','sourceHash','balanceVersion','rulesVersion','policyVersion'] as const) assert.equal(summary[key],plan[key],`Summary ${key} differs from its plan`);
  assert.equal(summary.status,'complete','Only complete successful evidence is current');
  assert(Array.isArray(summary.failures));assert.equal(summary.failures.length,0);
  for(const key of ['scheduled','completed','successful']) assert.equal(summary[key],plan.cases.length,`Summary ${key} must include every case`);
}

/** A bye becomes that deck's mirror, giving odd and even inventories equal seed exposure. */
export function competitiveSchedule(deckIds:readonly string[],namespace:string) {
  assert(deckIds.length>0,'At least one deck required');
  assert.equal(new Set(deckIds).size,deckIds.length,'Deck IDs must be unique');
  const rotating:(number|null)[]=deckIds.map((_,index)=>index);
  const odd=rotating.length%2===1;
  if(odd) rotating.push(null);
  const pairs:{a:number;b:number;round:number}[]=[];
  for(let round=0;round<rotating.length-1;round++) {
    for(let i=0;i<rotating.length/2;i++) {
      const left=rotating[i],right=rotating[rotating.length-1-i];
      const [a,b]=left===null?[right!,right!]:right===null?[left,left]:[left,right].sort((a,b)=>a-b);
      pairs.push({a,b,round});
    }
    rotating.splice(1,0,rotating.pop()!);
  }
  if(!odd) for(let a=0;a<deckIds.length;a++) pairs.push({a,b:a,round:deckIds.length-1});
  assert.equal(pairs.length,deckIds.length*(deckIds.length+1)/2);
  assert.equal(new Set(pairs.map(({a,b})=>`${a}|${b}`)).size,pairs.length,'Every unordered pair occurs once');
  const seeds=Array.from({length:deckIds.length*4},(_,i)=>`${namespace}-${i}`),cases:SweepCase[]=[];
  for(const {a,b,round} of pairs)for(let repeat=0;repeat<4;repeat++)for(const policy of ['greedy','chain-two'] as const)for(const seat of ['a-player','b-player'] as const)
    cases.push(scenario({stage:'matrix',a:deckIds[a],b:deckIds[b],policy,seed:seeds[round*4+repeat],rotation:(repeat*3+round)%10,tierA:0,tierB:0,seat}));
  const perDeck=Object.fromEntries(deckIds.map(id=>[id,new Set(cases.filter(c=>c.a===id||c.b===id).map(c=>c.seed)).size]));
  assert(Object.values(perDeck).every(count=>count===seeds.length),'Every deck sees the complete seed pool');
  return {cases,seeds,perDeck};
}

export function sourceManifest() {
  runtimeProvenance();
  const files = new Set(['package.json','pnpm-lock.yaml','tsconfig.base.json','scripts/package.json','scripts/tsconfig.json','lib/squabblemon-engine/package.json','scripts/src/all-decks-ranking-decks.ts','scripts/src/element-balance-audit-decks.ts','artifacts/squabblemon/src/lib/deckWorkshop.ts','artifacts/squabblemon/src/data.ts']);
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
  return {sha256:hash.digest('hex'),policyVersion:SWEEP_POLICY_VERSION,files:entries};
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
  const historicalRed={...authored.find(deck=>deck.id==='focused-red-set')!,cardIds:['triple-og-red','block-spinner','redside1','ganger-red','cane-corso-red','initiation','guap','folks','cognac','bustdown'],id:'historical-red-guap-folks',name:'Historical red shell with GUAP/FOLKS (diagnostic only)'};
  assertLegalDeck(historicalRed);
  const catalog=cardCatalog.filter(card=>card.kind!=='token'&&!card.hazard).map(card=>({id:card.engineId,catalogId:card.catalogId,name:card.name,kind:card.kind??'character',type:card.type,rarity:card.rarity,cost:card.cost,power:card.power,ability:card.ability,effect:card.effect}));
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

export function listLegalSweepPlays(match:Match,owner:Owner):BalancePlayOption[] {
  return listLegalBalancePlays(match,owner,true);
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

export function evaluateSweepContinuation(match:Match,owner:Owner) {
  return Math.max(evaluatePublicState(match,owner),...listLegalSweepPlays(match,owner).map(option=>evaluatePublicState(option.preview,owner)));
}

function chooseChain(match:Match,owner:Owner,options:readonly BalancePlayOption[]):BalancePlayOption|null {
  const baseline=evaluatePublicState(match,owner);
  const ranked=options.map(option=>({option,now:evaluatePublicState(option.preview,owner)})).sort((a,b)=>b.now-a.now||a.option.cardId.localeCompare(b.option.cardId)||a.option.lane-b.option.lane||Number(a.option.squabble)-Number(b.option.squabble));
  const shortlist=ranked.slice(0,4).map(item=>{
    const then=evaluateSweepContinuation(item.option.preview,owner);
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
    const options:readonly BalancePlayOption[]=listLegalSweepPlays(searchMatch,owner);
    const context={match:searchMatch,owner,legalPlays:options,actionIndex:actionIndex-1,seed:`${test.seed}:${test.rotation}:0:${test.seat}`,evaluate:evaluatePublicState};
    let chosen:BalancePlayOption|null;
    if(test.policy==='forced-deployment'&&owner===aOwner&&test.target) {
      const candidates=options.filter(option=>option.cardId===test.target);
      chosen=candidates.length?candidates[(test.rotation+actionIndex)%candidates.length]:seededLegalBalancePolicy(context);
    }else if(test.policy==='chain-two') chosen=chooseChain(searchMatch,owner,options);
    else chosen=(test.policy==='seeded-legal'||test.policy==='forced-deployment')?seededLegalBalancePolicy(context):greedyBalancePolicy(context);
    if(!chosen) {room=applyOnlineCommand(room,owner,{type:'end-turn'},actionIndex);continue;}
    assert(options.includes(chosen),'Policy selected canonical legal option');
    const investment=chosen.investment;
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
