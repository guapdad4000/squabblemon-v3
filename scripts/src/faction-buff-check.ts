import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {cards} from '@workspace/squabblemon-engine/data';
import {sourceHash,root,simulateRankingCase,type RankingPlan} from './all-decks-ranking';
const [action,dirArg,indexArg,countArg]=process.argv.slice(2);const dir=path.resolve(root,dirArg);
const ids=['focused-blue-set','focus-cellblock','focus-cellblock-classic','cellblock-pressure','starter-community-table','focus-wonderland'];
if(action==='init'){
 const original=JSON.parse(readFileSync(path.join(root,'artifacts/deliverables/full-deck-sweep-v51/plan.json'),'utf8')) as RankingPlan;
 const baselineRows=Array.from({length:8},(_,i)=>JSON.parse(readFileSync(path.join(root,`artifacts/deliverables/full-deck-sweep-v51/worker-${i}.json`),'utf8')).rows).flat();
 const cases=original.cases.map((scenario,originalIndex)=>({scenario,originalIndex})).filter(({scenario})=>ids.includes(scenario.a)||ids.includes(scenario.b));
 mkdirSync(dir,{recursive:true});writeFileSync(path.join(dir,'plan.json'),JSON.stringify({sourceHash:sourceHash(),baselineHash:original.sourceHash,decks:original.decks,ids,cases,baselineRows:baselineRows.filter((r:any)=>cases.some(c=>c.originalIndex===r.caseIndex))}));
 console.log(cases.length);
}else if(action==='snapshot'){
 writeFileSync(path.join(dir,'before-cards.json'),JSON.stringify(cards,null,2));
}else {
 const plan=JSON.parse(readFileSync(path.join(dir,'plan.json'),'utf8'));assert.equal(sourceHash(),plan.sourceHash);
 const index=Number(indexArg),count=Number(countArg);const decks=new Map<string,any>(plan.decks.map((d:any)=>[d.id,d]));const rows=[];
 for(let i=index;i<plan.cases.length;i+=count){const c=plan.cases[i];rows.push({caseIndex:c.originalIndex,result:simulateRankingCase(c.scenario,decks)});if(rows.length%128===0)console.log(`worker=${index} done=${rows.length}`);}
 assert.equal(sourceHash(),plan.sourceHash);writeFileSync(path.join(dir,`worker-${index}.json`),JSON.stringify({index,count,sourceHash:plan.sourceHash,rows}),{flag:'wx'});console.log('COMPLETE',index,rows.length);
}
