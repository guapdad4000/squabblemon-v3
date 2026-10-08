import { mkdirSync, writeFileSync } from 'node:fs';
import { allRankingDecks } from './all-decks-ranking-decks';
import { simulateBalanceMatch, greedyBalancePolicy, seededLegalBalancePolicy } from '@workspace/squabblemon-engine/balanceLab';
const decks=allRankingDecks();
const targets=['starter-fitness-circuit','element-fire','focus-wave7-tempo'];
const threats=['element-water','mushroom-plant','element-air','element-light','element-dark'];
const rows=[];
for(const seed of [0,1,2]) for(const a of targets) for(const b of threats) for(const tier of [0,3] as const) for(const seat of ['a-player','b-player'] as const) for(const [policyName,policy] of [['greedy',greedyBalancePolicy],['seeded',seededLegalBalancePolicy]] as const) {
 const result=simulateBalanceMatch({deckA:decks.find(d=>d.id===a)!,deckB:decks.find(d=>d.id===b)!,tier,seat,policy,rotation:[1,4,8][seed],districtSeed:`synergy-followup-2026-10-07-${seed}`,allowSquabble:true});
 rows.push({seed,a,b,tier,seat,policy:policyName,score:result.logicalWinner==='a'?1:result.logicalWinner==='draw'?.5:0,winner:result.logicalWinner});
}
mkdirSync(process.argv[2],{recursive:true});writeFileSync(`${process.argv[2]}/matches.json`,JSON.stringify(rows,null,2));
console.log(`${rows.length} matches complete`);
