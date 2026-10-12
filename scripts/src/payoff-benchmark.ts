import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {simulateBalanceMatch,greedyBalancePolicy,seededLegalBalancePolicy} from '@workspace/squabblemon-engine/balanceLab';
const decks=JSON.parse(readFileSync('artifacts/deliverables/card-audit-deck-tier-list-20261012/plan.json','utf8')).decks;
const sourceHash=createHash('sha256').update(['selectedAbilities','selectedWave','creativeReworks','basePvpBalance','gameEngine'].map(n=>readFileSync(`lib/squabblemon-engine/src/${n}.ts`,'utf8')).join('\n')).digest('hex');
const variant=process.argv[2];
const affected:Record<string,string[]>={buffs:['plate-auntie','canopykeeper','merch-table-hustler'],'confirm-buffs':['plate-auntie','canopykeeper','merch-table-hustler'],auntie:['plate-auntie'],promise:['canopykeeper'],merch:['merch-table-hustler'],nerd:['nerd']};
const targets=decks.filter((d:any)=>['element-plant','mushroom-plant','starter-music-tour'].includes(d.id));
const opponents=(process.env.PAYOFF_OPPONENTS?.split(',')??['starter-receipts','element-water','element-fire','starter-fitness-routes','focus-earth-tax','starter-combo']).map(id=>decks.find((d:any)=>d.id===id));
const rows:any[]=[],errors:any[]=[];
const shard=Number(process.env.PATCH_SHARD??0), shards=Number(process.env.PATCH_SHARDS??1);let caseIndex=0;
for(const deck of targets)for(const opponent of opponents)for(const tier of [0,1,2,3] as const)for(const seat of ['a-player','b-player'] as const)for(const mode of ['greedy','seeded']){
 if(caseIndex++ % shards !== shard) continue;
 const seed=process.env.PATCH_SEED??'reliability-fresh-oct12-73',rotation=Number(process.env.PATCH_ROTATION??7),aOwner=seat==='a-player'?'player':'cpu',actions={player:0,cpu:0};
 try {const result=simulateBalanceMatch({deckA:deck,deckB:opponent,tier,seat,districtSeed:seed,rotation,policy:ctx=>(mode==='greedy'?greedyBalancePolicy:seededLegalBalancePolicy)({...ctx,seed:`${seed}:${tier}:${ctx.owner===aOwner?'a':'b'}`,actionIndex:actions[ctx.owner]++})});rows.push({deck:deck.id,opponent:opponent.id,tier,seat,mode,score:result.logicalWinner==='a'?1:result.logicalWinner==='draw'?.5:0});}catch(e){errors.push(String(e));}
 if((rows.length+errors.length)%128===0)console.log(variant,rows.length,errors.length);
}
const dir='artifacts/deliverables/payoff-buffs-20261012';mkdirSync(dir,{recursive:true});writeFileSync(`${dir}/${variant}${shards>1?'-'+shard:''}.json`,JSON.stringify({variant,sourceHash,seed:process.env.PATCH_SEED??'reliability-fresh-oct12-73',rotation:Number(process.env.PATCH_ROTATION??7),rows,errors}));console.log('DONE',variant,rows.length,errors.length);

if(errors.length)process.exitCode=1;
