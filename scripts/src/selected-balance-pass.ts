import {mkdirSync,writeFileSync} from 'node:fs';
import {cards,decks} from '@workspace/squabblemon-engine/data';
import {SELECTED_WAVE} from '../../lib/squabblemon-engine/src/selectedWave';
import {simulateBalanceMatch,greedyBalancePolicy,seededLegalBalancePolicy,type BalanceCardObservation} from '@workspace/squabblemon-engine/balanceLab';
import {allRankingDecks} from './all-decks-ranking-decks';
const pool=allRankingDecks();
const ids=['sunday-dinner','fitness-routes','music-tour','community-table'];
const targets=ids.map(id=>{const d=decks.find(d=>d.id===id)!;return {id,name:d.name,cardIds:d.cards};});
// Include the two cards absent from the four offered recipes in a legal control shell.
targets.push({id:'neighborhood-tricks',name:'Neighborhood Tricks',cardIds:['group-chat-instigator','bluetooth-unc','barbershop-heckler','booster','indian-scammer','naija-scammer','night-bus-driver','delivery-app-cyclist','black-air-fade-1s','studio-couch-yn']});
const wanted=process.env.BALANCE_TARGETS?.split(',');
if(wanted) targets.splice(0,targets.length,...targets.filter(d=>wanted.includes(d.id)));
const opponents=['starter-block','focused-red-set','focused-blue-set','element-water','mushroom-plant','element-air','element-dark'];
const out=process.argv[2];if(!out)throw Error('Output directory required');
type ComparisonRow={a:string;b:string;rotation:number;tier:0|3;seat:'a-player'|'b-player';policy:'seeded'|'greedy';score:number;margins:readonly number[];cards:readonly BalanceCardObservation[]};
const rows:ComparisonRow[]=[];
for(const a of targets)for(const bId of opponents)for(const rotation of (process.env.BALANCE_ROTATIONS?.split(',').map(Number) ?? [2,7]))for(const tier of [0,3] as const)for(const seat of ['a-player','b-player'] as const)for(const [policyName,policy] of [['seeded',seededLegalBalancePolicy],['greedy',greedyBalancePolicy]] as const){
const b=pool.find(d=>d.id===bId)!;const r=simulateBalanceMatch({deckA:a,deckB:b,tier,seat,rotation,policy,districtSeed:`${process.env.BALANCE_SEED ?? 'new-wave-balance'}-${rotation}`,allowSquabble:true});rows.push({a:a.id,b:bId,rotation,tier,seat,policy:policyName,score:r.logicalWinner==='a'?1:r.logicalWinner==='draw'?.5:0,margins:r.laneMargins,cards:r.cardsA});
if(rows.length%32===0)console.log(`${rows.length}/560`);
}
mkdirSync(out,{recursive:true});writeFileSync(`${out}/matches.json`,JSON.stringify(rows,null,2));
const summary=targets.map(d=>{const rs=rows.filter(r=>r.a===d.id);return {deck:d.id,games:rs.length,score:rs.reduce((n,r)=>n+r.score,0)/rs.length,byPolicy:['seeded','greedy'].map(p=>{const s=rs.filter(r=>r.policy===p);return {policy:p,score:s.reduce((n,r)=>n+r.score,0)/s.length};})};});
const coverage=SELECTED_WAVE.map(([id])=>{const obs=rows.flatMap(r=>r.cards.filter(c=>c.cardId===id));return {id,observations:obs.length,played:obs.reduce((n,c)=>n+c.played,0),direct:obs.reduce((n,c)=>n+c.abilityEvidence.baseDirectEffectEvents,0),noEffect:obs.reduce((n,c)=>n+c.abilityEvidence.baseNoObservedEffectEvents,0)};});
writeFileSync(`${out}/summary.json`,JSON.stringify({summary,coverage},null,2));console.log(JSON.stringify(summary));
