import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
const root='/home/falcon/.codex/worktrees/v2-performance-parity/New project 9';
const e=await import(pathToFileURL(root+'/lib/squabblemon-engine/src/gameEngine.ts').href);
const b=await import(pathToFileURL(root+'/lib/squabblemon-engine/src/balanceLab.ts').href);
function base(ids:string[],round=2){const m=e.createMatch('vibes','vibes');return {...m,phase:'cpu-reveal',round,cpuMotion:9,playerMotion:9,cpuHand:ids.map((id,i)=>e.createCardInstance(id,'cpu','policy-evidence',i)),squabbleByOwner:{player:false,cpu:false}};}
const placed=(id:string,owner:string,lane:number,i:number)=>({...e.createCardInstance(id,owner,'policy-board',i),lane});
const concert={...base(['the-concert']),boards:[0,1,2].map(l=>[placed('cornball','player',l,l)])};
const dice={...base(['the-dice-game']),boards:[0,1,2].map(l=>[placed('cornball','cpu',l,l),placed('homelessguy','player',l,l+3)])};
const choices=Object.fromEntries(Object.entries({concert,dice}).map(([key,m])=>[key,e.chooseCpuPlay(m,false)]));
const records=[];for(const alt of ['cornball','roaster','redside1','counter','streamer','gothkid'])for(const power of [-2,-1,0,1,2,3]){
 const m=base(['gamer',alt,'energydrink','sideofhands']);const target={...placed('homelessguy','player',0,0),powerModifier:power};const friend=placed('cornball','cpu',0,1);m.boards=[[target,friend],[],[]];
 const choice=e.chooseCpuPlay(m,false);records.push({alt,power,choice});
}
const horizon=base([],6);horizon.afterParty=true;horizon.playerMotion=1;horizon.cpuMotion=5;
const ordinary={...horizon,afterParty:false};
const evaluations={extended:b.evaluateBalanceState(horizon,'cpu'),ordinary:b.evaluateBalanceState(ordinary,'cpu')};
const timed=base(['gamer','homelessguy','the-dice-game','the-concert','kyle']);timed.boards=concert.boards;
const start=performance.now();for(let i=0;i<20;i++)e.chooseCpuPlay(timed,false);const elapsedMs=performance.now()-start;
const km=base(['kyle']);km.boards=concert.boards;const kp=e.playTurnCard(km,'cpu',km.cpuHand[0].instanceId,0);const without={...kp,boards:kp.boards.map((lane:any[])=>lane.filter(card=>!card.smileBomb))};const delayedDelta=b.evaluateBalanceState(kp,'cpu')-b.evaluateBalanceState(without,'cpu');
const report={delayedDelta,choices,gamerCases:records,evaluations,twentyMixedDecisionsMs:elapsedMs};
writeFileSync('/home/falcon/Documents/New project 9/output/battle-cpu-correctness-20261025/'+(process.argv[2]??'baseline')+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify({choices,evaluations,delayedDelta,twentyMixedDecisionsMs:elapsedMs}));
