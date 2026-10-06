import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { allRankingDecks, excludedRankingCardIds } from './all-decks-ranking-decks';
import { sourceHash, simulateRankingCase, type RankingCase, type RankingResult } from './all-decks-ranking';
import { CARD_BALANCE_VERSION, ONLINE_RULES_VERSION } from '@workspace/squabblemon-engine/multiplayer';
import { cardCatalog, cards } from '@workspace/squabblemon-engine/data';
import { STREET_LEGENDS_WAVE } from '@workspace/squabblemon-engine/streetLegendsWave';
import { MUSIC_INDUSTRY_WAVE } from '@workspace/squabblemon-engine/musicIndustryWave';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=path.join(root,'artifacts/deliverables/street-legends-wave-2026-10-06');
const mode=process.argv[2];
const scriptHash=createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex');
if(mode==='plan') {
  const decks=allRankingDecks(), cases: RankingCase[]=[];
  for(let a=0;a<decks.length;a++)for(let b=a+1;b<decks.length;b++)for(const policy of ['greedy','seeded-legal'] as const)for(const tier of [0,3] as const)for(const seat of ['a-player','b-player'] as const) {
    const c={a:decks[a].id,b:decks[b].id,policy,tier,seat,rotation:0,seed:'street-legends-wave-fresh-2026-10-06'};
    cases.push({ ...c,key:[c.a,c.b,policy,tier,seat].join('|') });
  }
  assert.equal(cases.length,decks.length*(decks.length-1)/2*8);
  mkdirSync(out,{recursive:true});
  writeFileSync(path.join(out,'audit-plan.json'),JSON.stringify({sourceHash:sourceHash(),scriptHash,generatedAt:new Date().toISOString(),decks,cases,balanceVersion:CARD_BALANCE_VERSION,rulesVersion:ONLINE_RULES_VERSION,excludedCardIds:excludedRankingCardIds},null,2));
  console.log(`PLAN: ${decks.length} legal ten-card crews; ${cases.length} fresh games, two policies, both seats, base/mastery.`);
} else {
  const plan=JSON.parse(readFileSync(path.join(out,'audit-plan.json'),'utf8'));
  assert.equal(plan.sourceHash,sourceHash(),'Do not mix changed engine inputs');assert.equal(plan.scriptHash,scriptHash);
  if(mode==='worker') {
    const index=Number(process.argv[3]),count=Number(process.argv[4]); const decks=new Map(plan.decks.map((d:any)=>[d.id,d]));
    const rows:{caseIndex:number;result:RankingResult}[]=[]; const failures:unknown[]=[]; const started=Date.now();
    for(let i=index;i<plan.cases.length;i+=count) {
      try { rows.push({caseIndex:i,result:simulateRankingCase(plan.cases[i],decks as any)}); } catch(e) {failures.push({caseIndex:i,message:String(e)});}
      if((rows.length+failures.length)%128===0)console.log(`worker ${index}: ${rows.length} games, ${failures.length} failures, ${Math.round((Date.now()-started)/1000)}s`);
    }
    assert.equal(plan.sourceHash,sourceHash());
    writeFileSync(path.join(out,`audit-worker-${index}.json`),JSON.stringify({sourceHash:plan.sourceHash,scriptHash,index,count,elapsedMs:Date.now()-started,rows,failures}));
    console.log(`worker ${index} complete: ${rows.length} games; ${failures.length} failures`); if(failures.length)process.exitCode=1;
  } else if(mode==='summarize') {
    const shards=Array.from({length:Number(process.argv[3])},(_,i)=>JSON.parse(readFileSync(path.join(out,`audit-worker-${i}.json`),'utf8')));
    assert(shards.every(s=>s.sourceHash===plan.sourceHash&&s.scriptHash===scriptHash));assert(shards.every(s=>!s.failures.length));
    const rows=shards.flatMap(s=>s.rows).sort((a,b)=>a.caseIndex-b.caseIndex);
    assert.equal(rows.length,plan.cases.length);assert.equal(new Set(rows.map(r=>r.caseIndex)).size,rows.length);
    const records=plan.decks.map((deck:any)=>{
      const played=rows.filter(r=>r.result.deckAId===deck.id||r.result.deckBId===deck.id);
      const wins=played.filter(r=>r.result.logicalWinner===(r.result.deckAId===deck.id?'a':'b')).length;
      const draws=played.filter(r=>r.result.logicalWinner==='draw').length;
      const byPolicy=Object.fromEntries(['greedy','seeded-legal'].map(policy=>{const group=played.filter(r=>plan.cases[r.caseIndex].policy===policy); return [policy,{games:group.length,score:group.reduce((n,r)=>n+(r.result.logicalWinner==='draw'?0.5:r.result.logicalWinner===(r.result.deckAId===deck.id?'a':'b')?1:0),0)/group.length}];}));
      return {...deck,games:played.length,wins,draws,losses:played.length-wins-draws,score:(wins+draws/2)/played.length,byPolicy,motionCurve:deck.cardIds.map((id:string)=>cards[id].cost),openingAffordable:deck.cardIds.slice(0,5).filter((id:string)=>cards[id].cost<=2).length};
    }).sort((a:any,b:any)=>b.score-a.score);
    const newIds=[...STREET_LEGENDS_WAVE,...MUSIC_INDUSTRY_WAVE].map(r=>r[0]);
    const coverage=Object.fromEntries(newIds.map(id=>[id,records.filter((d:any)=>d.cardIds.includes(id)).map((d:any)=>d.id)]));assert(Object.values(coverage).every(x=>x.length));
    const counts={catalog:cardCatalog.length,characters:cardCatalog.filter(c=>(c.kind??'character')==='character').length,supports:cardCatalog.filter(c=>c.kind==='support').length,blockbusters:cardCatalog.filter(c=>c.kind==='blockbuster').length,newCharacters:newIds.length,wavePortraits:30};
    const result={generatedAt:new Date().toISOString(),sourceHash:plan.sourceHash,scriptHash,rulesVersion:ONLINE_RULES_VERSION,balanceVersion:CARD_BALANCE_VERSION,counts,games:rows.length,failures:0,crews:records,coverage,excludedCardIds:plan.excludedCardIds,limitations:'One fixed seeded district set, one draw rotation, base and fully trained tiers, two simple bot policies. Results are diagnostic bot outcomes, not human win rates or a solved balance ranking. Existing audit-only substitutions replace GUAP/Folks without changing the live recipes.'};
    writeFileSync(path.join(out,'deck-audit.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify({counts,games:rows.length,top:records.slice(0,5).map((x:any)=>[x.id,x.score]),bottom:records.slice(-8).map((x:any)=>[x.id,x.score]),wave:records.filter((x:any)=>/street-legends|music-industry|fitness-circuit/.test(x.id)).map((x:any)=>[x.id,x.score])},null,2));
  }
}
