import {mkdirSync,writeFileSync} from 'node:fs';
import {decks} from '@workspace/squabblemon-engine/data';
import {simulateBalanceMatch,greedyBalancePolicy,seededLegalBalancePolicy} from '@workspace/squabblemon-engine/balanceLab';
const recipe=(id:string)=>{const d=decks.find(d=>d.id===id);if(!d)throw Error(id);return {id,name:d.name,cardIds:[...d.cards]};};
const targets=(process.env.MATCHUP_TARGETS?.split(',') ?? ['fitness-routes','music-tour','fitness-circuit']).map(recipe);
const allOpponents=[recipe('squabblehouse-shift'),{id:'focused-red-set',name:'Blood / Red',cardIds:['triple-og-red','block-spinner','redside1','ganger-red','cane-corso-red','initiation','guap','folks','cognac','bustdown']},{id:'focused-blue-set',name:'Crip / Blue',cardIds:['triple-og-blue','look-out','blueside1','ganger-blue','blue-nose-pit','initiation','waterboy','alchy','cognac','bustdown']}];
const opponents=allOpponents.filter(d=>!process.env.MATCHUP_OPPONENTS || process.env.MATCHUP_OPPONENTS.split(',').includes(d.id));
const rows:any[]=[];const samples:any[]=[];
for(const a of targets)for(const b of opponents)for(const rotation of (process.env.MATCHUP_ROTATIONS?.split(',').map(Number) ?? [0,1,2,3,5,7,8,9]))for(const tier of [0,3] as const)for(const seat of ['a-player','b-player'] as const)for(const [policyName,policy] of [['seeded',seededLegalBalancePolicy],['greedy',greedyBalancePolicy]] as const){
let settled:any;const r=simulateBalanceMatch({deckA:a,deckB:b,rotation,tier,seat,policy,districtSeed:`${process.env.MATCHUP_SEED ?? 'direct-crew'}-${rotation}`,allowSquabble:true,observeComplete:m=>settled=m});
rows.push({a:a.id,b:b.id,policy:policyName,...r});if(r.logicalWinner==='b'&&policyName==='greedy'&&!samples.some(s=>s.a===a.id&&s.b===b.id&&s.tier===tier))samples.push({a:a.id,b:b.id,tier,rotation,seat,match:settled});
if(rows.length%64===0)console.log(`${rows.length} matches completed`);
}
const summary=targets.flatMap(a=>opponents.map(b=>{const rs=rows.filter(r=>r.a===a.id&&r.b===b.id);return {deck:a.id,opponent:b.id,games:rs.length,wins:rs.filter(r=>r.logicalWinner==='a').length,draws:rs.filter(r=>r.logicalWinner==='draw').length,score:rs.reduce((s,r)=>s+(r.logicalWinner==='a'?1:r.logicalWinner==='draw'?.5:0),0)/rs.length,greedyScore:rs.filter(r=>r.policy==='greedy').reduce((s,r)=>s+(r.logicalWinner==='a'?1:r.logicalWinner==='draw'?.5:0),0)/(rs.length/2),tiers:[0,3].map(t=>{const xs=rs.filter(r=>r.tier===t);return {tier:t,score:xs.reduce((s,r)=>s+(r.logicalWinner==='a'?1:r.logicalWinner==='draw'?.5:0),0)/xs.length};})};}));
const out=process.argv[2];mkdirSync(out,{recursive:true});for(const [name,value]of Object.entries({recipes:{targets,opponents},matches:rows,summary,samples}))writeFileSync(`${out}/${name}.json`,JSON.stringify(value,null,2));console.log(JSON.stringify(summary,null,2));
