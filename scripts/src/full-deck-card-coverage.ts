import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {cards} from '@workspace/squabblemon-engine/data';
import {simulateBalanceMatch,greedyBalancePolicy,seededLegalBalancePolicy} from '@workspace/squabblemon-engine/balanceLab';
import {root,sourceHash,type RankingPlan} from './all-decks-ranking';
const [directoryArg,indexArg,countArg]=process.argv.slice(2);
const directory=path.resolve(root,directoryArg);
const plan=JSON.parse(readFileSync(path.join(directory,'plan.json'),'utf8')) as RankingPlan;
assert.equal(sourceHash(),plan.sourceHash);
const represented=new Set(plan.decks.flatMap(d=>d.cardIds));
const remaining=Object.entries(cards).filter(([id,c])=>c.kind!=='token'&&!c.hazard&&!represented.has(id));
const index=Number(indexArg),count=Number(countArg);
const benchmarks=['focused-red-set','focused-blue-set','starter-squabblehouse-shift'].map(id=>plan.decks.find(d=>d.id===id)!);
const rows=[];
for(let n=index;n<remaining.length;n+=count){
 const [id,card]=remaining[n];
 const shell=plan.decks.filter(d=>d.id.startsWith('element-')).sort((a,b)=>b.cardIds.filter(c=>cards[c].type===card.type).length-a.cardIds.filter(c=>cards[c].type===card.type).length)[0];
 const deck={id:`probe-${id}`,name:`${card.name} coverage probe`,cardIds:[id,...shell.cardIds.slice(0,9)]};
 assert.equal(new Set(deck.cardIds).size,10);
 const results=[];
 for(const benchmark of benchmarks)for(const tier of [0,3] as const)for(const seat of ['a-player','b-player'] as const)for(const policy of [greedyBalancePolicy,seededLegalBalancePolicy]){
  const result=simulateBalanceMatch({deckA:deck,deckB:benchmark,districtSeed:'coverage-probes-v51',rotation:0,tier,seat,policy,allowSquabble:true});
  results.push({opponent:benchmark.id,tier,seat,policy:policy===greedyBalancePolicy?'greedy':'seeded-legal',winner:result.logicalWinner,cardsA:result.cardsA});
 }
 rows.push({id,name:card.name,shell: shell.id,cardIds:deck.cardIds,results});
 console.log(`PROBE ${id} complete=${rows.length}`);
}
assert.equal(sourceHash(),plan.sourceHash);
writeFileSync(path.join(directory,`coverage-worker-${index}.json`),JSON.stringify({index,count,sourceHash:plan.sourceHash,rows})+'\n',{flag:'wx'});
