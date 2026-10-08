import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { cards } from '@workspace/squabblemon-engine/data';
import { FULL_ROSTER_BUFFS, FULL_ROSTER_TEMPO_BUFFS } from '../../lib/squabblemon-engine/src/fullRosterBuffs';
import { allRankingDecks } from './all-decks-ranking-decks';
import { simulateBalanceMatch, greedyBalancePolicy, seededLegalBalancePolicy } from '@workspace/squabblemon-engine/balanceLab';
const decks=allRankingDecks();
const targets=['starter-music-industry','starter-fitness-circuit','street-legends-relationships','focus-wave7-tempo','element-fire','element-dark'];
const threats=['element-water','mushroom-plant','element-air','element-light','element-dark'];
const baseline=JSON.parse(readFileSync(new URL('../../artifacts/deliverables/full-roster-buffs-2026-10-07/catalog-before.json',import.meta.url),'utf8'));
const changed=[...Object.keys(FULL_ROSTER_BUFFS),...Object.keys(FULL_ROSTER_TEMPO_BUFFS)];
const candidate=Object.fromEntries(changed.map(id=>[id,{cost:cards[id].cost,power:cards[id].power}]));
const rows=[];let index=0;
for(const a of targets)for(const b of threats)for(const tier of [0,3] as const)for(const seat of ['a-player','b-player'] as const)for(const [policyName,policy] of [['greedy',greedyBalancePolicy],['seeded',seededLegalBalancePolicy]] as const) {
 const caseIndex=index++;if(process.env.TARGET_ONLY && a!==process.env.TARGET_ONLY)continue;if(caseIndex%4!==Number(process.argv[3]))continue;
 const deckA=decks.find(d=>d.id===a)!,deckB=decks.find(d=>d.id===b)!;
 if(!deckA||!deckB)throw new Error(`Missing confirmation crew ${a}/${b}`);
 const result:any={a,b,tier,seat,policy:policyName};
 for(const arm of ['before','after']) {
  for(const id of changed) { const values=arm==='before'?baseline.find((c:any)=>c.engineId===id):candidate[id];cards[id].cost=values.cost;cards[id].power=values.power; }
  const r=simulateBalanceMatch({deckA,deckB,tier,seat,policy,rotation:5,districtSeed:'roster-buffs-confirmation-fresh-2026-10-07',allowSquabble:true});
  result[arm]={score:r.logicalWinner==='a'?1:r.logicalWinner==='draw'?.5:0,winner:r.logicalWinner};
 }
 rows.push(result);
}
mkdirSync(process.argv[2],{recursive:true});writeFileSync(`${process.argv[2]}/confirmation-${process.argv[3]}.json`,JSON.stringify(rows,null,2));
console.log(`${rows.length} paired cases complete`);
