import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { cards } from '@workspace/squabblemon-engine/data';
import { authoredRankingDecks } from './all-decks-ranking-decks';
import { root, sourceHash, simulateRankingCase, type RankingPlan, type RankingShard } from './all-decks-ranking';
import { aggregateRanking, validateCoverage } from './all-decks-ranking-report';
import { CARD_BALANCE_VERSION, ONLINE_RULES_VERSION } from '@workspace/squabblemon-engine/multiplayer';
const url = new URL('../../artifacts/squabblemon/src/lib/deckWorkshop.ts', import.meta.url).href;
const { recommendedWorkshopCrews } = await import(url);
const [action, dirArg, indexArg, countArg] = process.argv.slice(2);
assert(dirArg);
const directory = path.resolve(root, dirArg);
const put = (name: string, value: unknown) => writeFileSync(path.join(directory, name), JSON.stringify(value, null, 2)+'\n', {flag:'wx'});
if (action === 'init') {
  const candidates = [...authoredRankingDecks(), ...Object.entries(recommendedWorkshopCrews).map(([id, ids]) => ({id:`workshop-${id}`, name:`Workshop ${id}`, cardIds:[...(ids as string[])]}))];
  const compositions = new Map<string, typeof candidates[number]>();
  const aliases: Record<string,string[]> = {};
  for (const deck of candidates) {
    assert.equal(deck.cardIds.length,10); assert.equal(new Set(deck.cardIds).size,10);
    assert(deck.cardIds.every(id=>cards[id] && cards[id].kind!=='token' && !cards[id].hazard));
    const key=[...deck.cardIds].sort().join('|');
    const existing=compositions.get(key);
    if(existing) aliases[existing.id].push(deck.id);
    else { compositions.set(key,deck); aliases[deck.id]=[deck.id]; }
  }
  const decks=[...compositions.values()];
  assert(decks.some(d=>d.cardIds.includes('guap'))); assert(decks.some(d=>d.cardIds.includes('folks')));
  const schedule: RankingPlan['schedule']={seeds:['full-deck-sweep-a','full-deck-sweep-b'],rotations:[0],tiers:[0,3],seats:['a-player','b-player'],policies:['greedy','seeded-legal'],allowSquabble:true};
  const cases: RankingPlan['cases']=[];
  for(let a=0;a<decks.length;a++)for(let b=a+1;b<decks.length;b++)for(const policy of schedule.policies)for(const seed of schedule.seeds)for(const rotation of schedule.rotations)for(const tier of schedule.tiers)for(const seat of schedule.seats){
    cases.push({key:[decks[a].id,decks[b].id,policy,seed,rotation,tier,seat].join('|'),a:decks[a].id,b:decks[b].id,policy,seed,rotation,tier,seat});
  }
  const plan: RankingPlan={generatedAt:new Date().toISOString(),sourceHash:sourceHash(),balanceVersion:CARD_BALANCE_VERSION,rulesVersion:ONLINE_RULES_VERSION,excludedCardIds:[],decks,cases,schedule};
  validateCoverage(plan);
  const playable=Object.entries(cards).filter(([,c])=>c.kind!=='token'&&!c.hazard).map(([id,c])=>({...c,id}));
  const included=new Set(decks.flatMap(d=>d.cardIds));
  mkdirSync(directory,{recursive:true}); put('plan.json',plan);
  put('coverage.json',{candidateRecipes:candidates.length,uniqueDecks:decks.length,aliases,collectibleCards:playable.length,representedCards:included.size,unrepresentedCards:playable.filter(c=>!included.has(c.id)).map(c=>({id:c.id,name:c.name}))});
  console.log(JSON.stringify({decks:decks.length,matches:cases.length,cards:included.size,total:playable.length}));
} else {
  const plan=JSON.parse(readFileSync(path.join(directory,'plan.json'),'utf8')) as RankingPlan;
  assert.equal(sourceHash(),plan.sourceHash,'Source changed'); validateCoverage(plan);
  const count=Number(countArg ?? indexArg);
  if(action==='worker'){
    const index=Number(indexArg); assert(Number.isInteger(index)&&index>=0&&index<count);
    const started=Date.now(); const rows:RankingShard['rows']=[], failures:RankingShard['failures']=[];
    const decks=new Map(plan.decks.map(d=>[d.id,d]));
    for(let caseIndex=index;caseIndex<plan.cases.length;caseIndex+=count){
      const scenario=plan.cases[caseIndex];
      try { rows.push({caseIndex,result:simulateRankingCase(scenario,decks)}); }
      catch(error){failures.push({caseIndex,scenario,message:String(error)});}
      if((rows.length+failures.length)%128===0)console.log(`worker=${index} completed=${rows.length+failures.length} failures=${failures.length}`);
    }
    assert.equal(sourceHash(),plan.sourceHash);
    put(`worker-${index}.json`,{index,count,sourceHash:plan.sourceHash,elapsedMs:Date.now()-started,rows,failures});
    console.log(`COMPLETE worker=${index} matches=${rows.length} failures=${failures.length}`);
    if(failures.length)process.exitCode=2;
  }else if(action==='report'){
    const shards=Array.from({length:count},(_,i)=>JSON.parse(readFileSync(path.join(directory,`worker-${i}.json`),'utf8')) as RankingShard);
    const summary=aggregateRanking(plan,shards,count);
    put('summary.json',{sourceHash:plan.sourceHash,balanceVersion:plan.balanceVersion,rulesVersion:plan.rulesVersion,schedule:plan.schedule,...summary});
    console.log(JSON.stringify(summary.checks));
  }else throw Error('Invalid action');
}
