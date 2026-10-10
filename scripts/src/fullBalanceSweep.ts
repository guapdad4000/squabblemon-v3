import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, openSync, writeSync, closeSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { execFileSync } from 'node:child_process';
import { type BalanceDeck, type BalanceTier, type BalanceSeat } from '@workspace/squabblemon-engine/balanceLab';
import { CARD_BALANCE_VERSION, ONLINE_RULES_VERSION } from '@workspace/squabblemon-engine/multiplayer';
import { cards } from '@workspace/squabblemon-engine/data';
import { inventory, sweepRoot, sourceManifest, simulateSweepCase, scenario, packedCards, eventProof, representativeDeck, telemetryColumns, telemetrySemantics, type SweepCase, type SweepPolicy } from './fullBalanceSweepCore';

type Plan={schemaVersion:1;createdAt:string;commit:string;sourceHash:string;manifest:ReturnType<typeof sourceManifest>;balanceVersion:number;rulesVersion:number;stage:string;cases:SweepCase[];decks:BalanceDeck[];coverage:Omit<ReturnType<typeof inventory>,'decks'|'probes'|'historicalRed'>;telemetryColumns:typeof telemetryColumns;telemetrySemantics:typeof telemetrySemantics;scope:string[]};
const [action,dirArg,indexArg,countArg]=process.argv.slice(2);
assert(dirArg,'Provide evidence directory');
const directory=path.resolve(sweepRoot,dirArg);
const put=(name:string,value:unknown)=>writeFileSync(path.join(directory,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const load=(name:string)=>JSON.parse(readFileSync(path.join(directory,name),'utf8'));
const seats:BalanceSeat[]=['a-player','b-player'];
const policies:SweepPolicy[]=['greedy','seeded-legal'];
const controls=['starter-block','focused-red-set','focused-blue-set','starter-squabblehouse-shift'];
const seedPrefix='full-balance-20261009-fresh-6b6bf654';

function makePlan(stage:string,decks:BalanceDeck[],cases:SweepCase[]):Plan {
  assert.equal(new Set(cases.map(c=>c.key)).size,cases.length,'Unique case keys');
  const manifest=sourceManifest(),inv=inventory();
  return {schemaVersion:1,createdAt:new Date().toISOString(),commit:execFileSync('git',['rev-parse','HEAD'],{cwd:sweepRoot,encoding:'utf8'}).trim(),sourceHash:manifest.sha256,manifest,balanceVersion:CARD_BALANCE_VERSION,rulesVersion:ONLINE_RULES_VERSION,stage,cases,decks,coverage:{candidates:inv.candidates,aliases:inv.aliases,catalog:inv.catalog,represented:inv.represented,missing:inv.missing},telemetryColumns,telemetrySemantics,
    scope:['Real authoritative six-round engine, dynamic district snapshots (After Party may extend round count).','Ten unique collectible catalog cards with actual saved-deck legality and character hero.','Base cards only: level1, moveTier0, no purchased upgrades; PvE and upgrade outcomes excluded.','Actual applyOnlineCommand for every play and end turn, alternating initiative, both seats, all legal paid investments and SQUABBLE.','Identical policy for both participants; evaluator masks opposing hand. These are simulated PvP, not live player win rates.','Source events do not establish passive eligibility, base-ability attempt counts, or human PvP win rates.']};
}

if(action==='verify') {
  const inv=inventory(),decks=new Map(inv.decks.map(d=>[d.id,d]));
  assert.equal(inv.decks.length,46);assert.equal(inv.catalog.length,298);assert.equal(inv.missing.length,79);
  const comparisons=[];
  for(const [index,deck] of inv.decks.entries())for(const policy of policies)for(const seat of seats) {
    const test=scenario({stage:'verification',a:deck.id,b:inv.decks[(index*13+7)%inv.decks.length].id,policy,seed:'base-pvp-parity-20261009',rotation:5,tierA:0,tierB:0,seat});
    const actual=simulateSweepCase(test,decks);
    const reference=simulateSweepCase(test,decks,undefined,false);
    assert.deepEqual(actual,reference,`${deck.id}/${policy}/${seat}: compact previews must preserve full authoritative result`);
    comparisons.push({deck:deck.id,policy,seat,winner:actual.winner,plays:actual.plays});
  }
  mkdirSync(directory,{recursive:true});put('runner-verification.json',{sourceHash:sourceManifest().sha256,comparisons,checks:['184 exact full-event versus compact-preview complete PvP match comparisons','Every move and end-turn routed through actual online authority','Base cards only; both seats; correct two-district victory rule; alternating round initiative','46 legal ten-card decks; all paid choices supported; opponent hand masked for evaluation']});
  console.log('PASS 184 exact PvP match comparisons');
}else if(action==='init') {
  const inv=inventory(),cases:SweepCase[]=[];
  for(let a=0;a<inv.decks.length;a++)for(let b=a;b<inv.decks.length;b++)for(const policy of policies)for(const seed of [`${seedPrefix}-matrix-a`,`${seedPrefix}-matrix-b`])for(const rotation of [0,5])for(const tier of [0] as BalanceTier[])for(const seat of seats)cases.push(scenario({stage:'matrix',a:inv.decks[a].id,b:inv.decks[b].id,policy,seed,rotation,tierA:tier,tierB:tier,seat}));
  assert.equal(cases.length,17296);
  mkdirSync(directory,{recursive:true});put('plan.json',makePlan('matrix',inv.decks,cases));
  console.log(JSON.stringify({stage:'matrix',matches:cases.length,sourceHash:sourceManifest().sha256,decks:inv.decks.length}));
}else if(action==='init-competitive'||action==='init-competitive-fresh') {
  const inv=inventory(),cases:SweepCase[]=[];
  const validation=action==='init-competitive-fresh';
  const seeds=Array.from({length:inv.decks.length*4},(_,i)=>`base-pvp-v52-${validation?'validation':'training'}-${indexArg??'a'}-${i}`);
  // Circle tournament: every deck faces every rival once and sees the same
  // four environment/draw seeds in each round. Mirrors occupy the last round.
  const rotating=inv.decks.map((_,i)=>i);
  const pairs:{a:number;b:number;round:number}[]=[];
  for(let round=0;round<inv.decks.length-1;round++) {
    for(let i=0;i<rotating.length/2;i++) {
      const [a,b]=[rotating[i],rotating[rotating.length-1-i]].sort((a,b)=>a-b);
      pairs.push({a,b,round});
    }
    rotating.splice(1,0,rotating.pop()!);
  }
  for(let a=0;a<inv.decks.length;a++)pairs.push({a,b:a,round:inv.decks.length-1});
  assert.equal(new Set(pairs.map(p=>`${p.a}|${p.b}`)).size,inv.decks.length*(inv.decks.length+1)/2);
  for(const {a,b,round} of pairs)for(let repeat=0;repeat<4;repeat++) {
    const seed=seeds[round*4+repeat];
    for(const policy of ['greedy','chain-two'] as SweepPolicy[])for(const seat of seats)
      cases.push(scenario({stage:'matrix',a:inv.decks[a].id,b:inv.decks[b].id,policy,seed,rotation:(repeat*3+round)%10,tierA:0,tierB:0,seat}));
  }
  assert.equal(cases.length,17296);
  const perDeck=Object.fromEntries(inv.decks.map(deck=>[deck.id,new Set(cases.filter(c=>c.a===deck.id||c.b===deck.id).map(c=>c.seed)).size]));
  assert(Object.values(perDeck).every(n=>n===seeds.length),'Every deck must see the identical complete seed pool');
  const plan=makePlan(validation?'competitive-validation':'competitive-matrix',inv.decks,cases);
  plan.scope.push('Equal immediate-value and two-move planning policies. Seeded random play is diagnostic only.',
    'Circle round robin: every deck pair receives four distinct seeds, and every deck sees the same 184 environment/draw seeds. Both seats and policies share each matchup environment.');
  mkdirSync(directory,{recursive:true});put('plan.json',{...plan,scheduleDesign:{seedPool:seeds,perDeckDistinctSeeds:perDeck,validation}});
  console.log(JSON.stringify({stage:plan.stage,matches:cases.length,sourceHash:plan.sourceHash,minDeckSeeds:Math.min(...Object.values(perDeck))}));
}else if(action==='init-stress') {
  const inv=inventory(),cases:SweepCase[]=[],decks=[...inv.decks,...inv.probes,inv.historicalRed];
  for(const card of inv.missing)for(const b of controls)for(const policy of ['forced-deployment','seeded-legal'] as SweepPolicy[])for(const seedIndex of [0,1])for(const seat of seats)cases.push(scenario({stage:'catalog-probe',a:`probe-${card.id}`,b,policy,seed:`${seedPrefix}-base-probe-${seedIndex}`,rotation:seedIndex*5,tierA:0,tierB:0,seat,target:card.id}));
  for(const target of ['homelessguy','the-dice-game','the-concert']) {
    const deck=representativeDeck(target,inv.decks);if(!decks.some(d=>d.id===deck.id))decks.push(deck);
    for(const b of controls)for(const policy of ['forced-deployment','greedy-paid'] as SweepPolicy[])for(const seedIndex of [0,1,2,3])for(const seat of seats)cases.push(scenario({stage:'paid-choices',a:deck.id,b,policy,seed:`${seedPrefix}-base-paid-${seedIndex}`,rotation:seedIndex*2,tierA:0,tierB:0,seat,target}));
  }
  mkdirSync(directory,{recursive:true});put('plan.json',makePlan('stress',decks,cases));
  console.log(JSON.stringify({stage:'stress',matches:cases.length,counts:Object.fromEntries([...new Set(cases.map(c=>c.stage))].map(stage=>[stage,cases.filter(c=>c.stage===stage).length]))}));
}else if(action==='worker') {
  const plan=load('plan.json') as Plan,index=Number(indexArg),count=Number(countArg);
  assert(Number.isInteger(index)&&index>=0&&index<count);assert.equal(sourceManifest().sha256,plan.sourceHash,'Source must stay frozen');
  const filename=`worker-${index}.jsonl`;assert(!existsSync(path.join(directory,filename)),'Do not overwrite outcomes');
  const fd=openSync(path.join(directory,filename),'wx'),start=performance.now(),decks=new Map(plan.decks.map(d=>[d.id,d]));
  const failures:{caseIndex:number;scenario:SweepCase;message:string}[]=[],proofs:Record<string,unknown>={};let completed=0;
  for(let caseIndex=index;caseIndex<plan.cases.length;caseIndex+=count) {
    const test=plan.cases[caseIndex];
    try {
      const result=simulateSweepCase(test,decks,match=>{
        for(const event of match.effectLog)if(event.cardId&&cards[event.cardId]&&!proofs[event.cardId]&&event.type==='ability')proofs[event.cardId]={caseIndex,round:event.round,proof:eventProof(event)};
      });
      const {cardsA,cardsB,...outcome}=result;
      writeSync(fd,JSON.stringify({caseIndex,...outcome,cardsA:packedCards(cardsA),cardsB:packedCards(cardsB)})+'\n');
    }catch(error){const failure={caseIndex,scenario:test,message:error instanceof Error?error.stack??error.message:String(error)};failures.push(failure);writeSync(fd,JSON.stringify({caseIndex,failure:failure.message})+'\n');}
    completed++;
    if(completed%64===0){const progress={index,count,sourceHash:plan.sourceHash,completed,total:Math.ceil((plan.cases.length-index)/count),failures:failures.length,elapsedMs:Math.round(performance.now()-start)};writeFileSync(path.join(directory,`progress-${index}.json`),JSON.stringify(progress));console.log(JSON.stringify(progress));}
  }
  closeSync(fd);assert.equal(sourceManifest().sha256,plan.sourceHash,'No mixed-source outcomes');
  put(`worker-${index}.json`,{index,count,sourceHash:plan.sourceHash,completed,elapsedMs:performance.now()-start,failures,proofs,rawSha256:createHash('sha256').update(readFileSync(path.join(directory,filename))).digest('hex')});
  console.log(`COMPLETE worker=${index} cases=${completed} failures=${failures.length}`);if(failures.length)process.exitCode=2;
}else if(action==='report') {
  const plan=load('plan.json') as Plan,count=Number(indexArg);assert.equal(sourceManifest().sha256,plan.sourceHash);
  const summaries=new Map<string,{games:number;wins:number;draws:number;points:number;playerGames:number;playerPoints:number;cpuGames:number;cpuPoints:number}>();
  const matchups=new Map<string,{games:number;points:number;playerPoints:number;draws:number}>();
  const cardRows=new Map<string,Record<string,number>>(),seen=new Set<number>(),failures:unknown[]=[],workers:unknown[]=[],proofs:Record<string,unknown>={},stageCounts:Record<string,number>={},choices:Record<string,number>={},investments:Record<string,number>={};
  const foldDeck=(key:string,points:number,isPlayer:boolean)=>{const value=summaries.get(key)??{games:0,wins:0,draws:0,points:0,playerGames:0,playerPoints:0,cpuGames:0,cpuPoints:0};value.games++;value.points+=points;value.wins+=Number(points===1);value.draws+=Number(points===0.5);if(isPlayer){value.playerGames++;value.playerPoints+=points;}else{value.cpuGames++;value.cpuPoints+=points;}summaries.set(key,value);};
  for(let index=0;index<count;index++) {
    const worker=load(`worker-${index}.json`);assert.equal(worker.sourceHash,plan.sourceHash);assert.equal(worker.count,count);assert.equal(worker.index,index);
    const raw=readFileSync(path.join(directory,`worker-${index}.jsonl`));assert.equal(createHash('sha256').update(raw).digest('hex'),worker.rawSha256);
    workers.push({index,completed:worker.completed,elapsedMs:worker.elapsedMs,rawSha256:worker.rawSha256});
    Object.assign(proofs,worker.proofs);let rows=0;
    for(const line of raw.toString().trim().split('\n')) {
      if(!line)continue;const row=JSON.parse(line),caseIndex=row.caseIndex,test=plan.cases[caseIndex];assert(test);assert.equal(caseIndex%count,index);assert(!seen.has(caseIndex));seen.add(caseIndex);rows++;
      if(row.failure){failures.push({caseIndex,scenario:test,message:row.failure});continue;}
      stageCounts[test.stage]=(stageCounts[test.stage]??0)+1;
      const points=row.logicalWinner==='a'?1:row.logicalWinner==='draw'?0.5:0;
      assert.equal(row.logicalWinner,row.winner==='draw'?'draw':row.winner===(test.seat==='a-player'?'player':'cpu')?'a':'b');
      for(const [id,p,isPlayer] of [[test.a,points,test.seat==='a-player'],[test.b,1-points,test.seat==='b-player']] as const){foldDeck([test.stage,test.policy,test.tierA===test.tierB?test.tierA:`${test.tierA}-${test.tierB}`,id].join('|'),p,isPlayer);if(test.stage==='matrix')foldDeck(`matrix|all|all|${id}`,p,isPlayer);}
      const matchupKey=[test.stage,test.policy,test.a,test.b,test.tierA,test.tierB].join('|'),m=matchups.get(matchupKey)??{games:0,points:0,playerPoints:0,draws:0};m.games++;m.points+=points;m.playerPoints+=row.winner==='player'?1:row.winner==='draw'?0.5:0;m.draws+=Number(row.winner==='draw');matchups.set(matchupKey,m);
      for(const c of [...row.cardsA,...row.cardsB]){assert.equal(c.length,telemetryColumns.length);const key=`${test.stage}|${c[0]}`,value=cardRows.get(key)??{appearances:0,deployedMatches:0};value.appearances++;value.deployedMatches+=Number(c[1]>0);for(let k=1;k<c.length;k++)value[telemetryColumns[k]]=(value[telemetryColumns[k]]??0)+c[k];cardRows.set(key,value);}
      for(const [key,value] of Object.entries(row.choices))choices[key]=(choices[key]??0)+(value as number);
      for(const [key,value] of Object.entries(row.investments))investments[key]=(investments[key]??0)+(value as number);
    }
    assert.equal(rows,worker.completed);
  }
  assert.equal(seen.size,plan.cases.length,'All scheduled case indexes accounted for');
  const deckRows=[...summaries].map(([key,r])=>({key,...r,scoreRate:r.points/r.games,playerScoreRate:r.playerPoints/r.playerGames,cpuScoreRate:r.cpuPoints/r.cpuGames}));
  const ranks=deckRows.filter(r=>r.key.startsWith('matrix|all|all|')).sort((a,b)=>b.scoreRate-a.scoreRate);
  type CardSummary={key:string;appearances:number;deployedMatches:number}&Record<Exclude<typeof telemetryColumns[number],'cardId'>,number>;
  const cardsSummary=[...cardRows].map(([key,r])=>({key,...r}) as CardSummary);
  const globallyDeployed=new Set(cardsSummary.filter(r=>r.played>0).map(r=>r.key.split('|')[1]));
  const globalNoEvents=plan.coverage.catalog.filter(c=>!cardsSummary.some(r=>r.key.endsWith(`|${c.id}`)&&r.baseEvents+r.baseNestedEffectEvents+r.baseNestedNoObservedEffectEvents+r.baseUnknownEvents+r.upgradeEvents>0));
  const report={sourceHash:plan.sourceHash,stage:plan.stage,scheduled:plan.cases.length,completed:seen.size,successful:seen.size-failures.length,checks:{allCaseIndexes:true,uniqueCases:true,rawHashes:true,seatNormalization:true,sourceFreeze:true},failures,stageCounts,workers,rankings:ranks,decks:deckRows,matchups:[...matchups].map(([key,m])=>({key,...m,deckAScoreRate:m.points/m.games,playerSeatScoreRate:m.playerPoints/m.games})),cards:cardsSummary,choices,investments,unplayedCards:plan.coverage.catalog.filter(c=>!globallyDeployed.has(c.id)),cardsWithNoEmittedAbilityEvidence:globalNoEvents,proofs,telemetrySemantics};
  put('summary.json',report);console.log(JSON.stringify({sourceHash:report.sourceHash,scheduled:report.scheduled,successful:report.successful,failures:failures.length,stageCounts,unplayed:report.unplayedCards.length,noEventEvidence:globalNoEvents.length,top:ranks.slice(0,5).map(r=>({id:r.key.split('|')[3],score:r.scoreRate})),bottom:ranks.slice(-5).map(r=>({id:r.key.split('|')[3],score:r.scoreRate}))}));if(failures.length)process.exitCode=2;
}else if(action==='init-confirm') {
  const matrixDirectory=path.resolve(indexArg),summary=JSON.parse(readFileSync(path.join(matrixDirectory,'summary.json'),'utf8'));
  assert.equal(summary.sourceHash,sourceManifest().sha256);
  const inv=inventory(),cases:SweepCase[]=[],pairs=new Map<string,[string,string]>();
  const extremes=[...summary.rankings.slice(0,4),...summary.rankings.slice(-4)].map((r:{key:string})=>r.key.split('|')[3]);
  for(const [index,a] of extremes.entries()) {
    const candidates=controls.filter(b=>b!==a);
    for(const b of [candidates[index%candidates.length],candidates[(index+1)%candidates.length]]) {
      const [left,right]=[a,b].sort();pairs.set(`${left}|${right}`,[left,right]);
    }
  }
  // Include all selected extremes, even when duplicate control pairings collapse.
  const selected=[...pairs.values()];assert(selected.length>=8);
  for(const [a,b] of selected)for(const tier of [0] as BalanceTier[])for(const policy of ['greedy','chain-two'] as SweepPolicy[])for(const seedIndex of [0,1])for(const rotation of [2,7])for(const seat of seats)cases.push(scenario({stage:'independent-confirmation',a,b,policy,seed:`${seedPrefix}-holdout-${seedIndex}`,rotation,tierA:tier,tierB:tier,seat}));
  assert.equal(cases.length,selected.length*16);mkdirSync(directory,{recursive:true});put('plan.json',makePlan('confirmation',inv.decks,cases));
  put('selection.json',{exploratorySourceHash:summary.sourceHash,rankingsUsed:extremes,pairs:selected,limitations:['Outliers selected after exploratory matrix; holdout seeds/rotations are disjoint.','Two-play chain policy sees own hand and public board and considers top4 current options; it is bounded optimistic planning, not human strength.']});console.log(JSON.stringify({stage:'confirmation',matches:cases.length,pairs:selected}));
}else throw new Error(`Unknown action${action}`);
