import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {scenario,planFingerprint,sourceManifest,runtimeProvenance} from '../../../../scripts/src/fullBalanceSweepCore.ts';
const directory=new URL('./',import.meta.url), bundle=new URL('../',directory);
const read=(stage,file)=>JSON.parse(fs.readFileSync(new URL(stage+'/'+file,bundle),'utf8'));
const matrix=read('matrix','plan.json'), stress=read('stress','plan.json');
const matrixResult=read('matrix','summary.json'), stressResult=read('stress','summary.json');
for(const [plan,result] of [[matrix,matrixResult],[stress,stressResult]]) {
  assert.equal(result.status,'complete');assert.equal(result.successful,plan.cases.length);
  assert.equal(result.planHash,plan.planHash);assert.equal(result.sourceHash,plan.sourceHash);
}
assert.equal(matrix.sourceHash,sourceManifest().sha256);
assert.deepEqual(matrix.runtime,runtimeProvenance());
const unplayed=matrixResult.unplayedCards.filter(card=>stressResult.unplayedCards.some(other=>other.id===card.id));
assert(unplayed.length>0,'No supplemental coverage required');
const seedNamespace=matrix.seedNamespace+'-completion', cases=[];
for(const card of unplayed) {
  const a=matrix.decks.find(deck=>deck.cardIds.includes(card.id));
  assert(a,'Supplemental card requires an unchanged league recipe');
  for(const b of ['starter-block','focused-red-set','focused-blue-set','starter-squabblehouse-shift'])
    for(const policy of ['forced-deployment','seeded-legal'])for(const seedIndex of [0,1])for(const seat of ['a-player','b-player'])
      cases.push(scenario({stage:'coverage-completion',a:a.id,b,policy,seed:seedNamespace+'-'+seedIndex,rotation:seedIndex*5,tierA:0,tierB:0,seat,target:card.id}));
}
const {scheduleDesign,planHash,...base}=matrix;
const plan={...base,stage:'coverage-completion',createdAt:new Date().toISOString(),seedNamespace,cases,
  selection:{matrixPlanHash:matrix.planHash,stressPlanHash:stress.planHash,unplayedCardIds:unplayed.map(card=>card.id),reason:'Selected after complete league and stress runs because no deployment was observed. Coverage diagnostic only; excluded from league rankings.'},
  scope:[...matrix.scope,'Post-run coverage completion for cards absent from observed plays. Forced policy encourages the selected card; these results do not rerank decks.']};
plan.planHash=planFingerprint(plan);
fs.writeFileSync(new URL('plan.json',directory),JSON.stringify(plan,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({stage:plan.stage,cases:cases.length,targets:plan.selection.unplayedCardIds,sourceHash:plan.sourceHash,planHash:plan.planHash}));
