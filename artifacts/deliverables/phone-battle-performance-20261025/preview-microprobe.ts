import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import { createMatch, createCardInstance, playTurnCard, type Match, type Lane } from '../../squabblemon/src/gameEngine.ts';
import { previewBattlePlay as before } from './preview-before.ts';
import { previewBattlePlay as current } from '../../squabblemon/src/battlePreview.ts';
const result=[];
for (const count of [12,36]) {
 let match=createMatch('block','combo');
 for(let i=0;i<count;i++) {
  const owner=i%2?'cpu':'player';
  const card=createCardInstance('hooper',owner,'thermal-probe',i);
  match={...match,round:4,phase:owner==='player'?'player':'cpu-reveal',[owner==='player'?'playerHand':'cpuHand']:[card],[owner==='player'?'playerMotion':'cpuMotion']:100};
  match=playTurnCard(match,owner,card.instanceId,(Math.floor(i/2)%3) as Lane);
 }
 const card=createCardInstance('snow','player','thermal-preview',100);
 match={...match,phase:'player',playerMotion:20,playerHand:[card]};
 const trial=(fn: typeof before)=>[0,1,2].map(lane=>fn(match,card.instanceId,lane as Lane));
 const a=trial(before),b=trial(current);assert.deepEqual(a,b);
 for(let i=0;i<1;i++){trial(before);trial(current);}
 const times={before:[] as number[],current:[] as number[]};
 for(let i=0;i<12;i++)for(const key of (i%2?['before','current']:['current','before']) as ('before'|'current')[]) {
  const start=performance.now();trial(key==='before'?before:current);times[key].push(performance.now()-start);
 }
 const stats=(values:number[])=>{const sorted=values.slice().sort((a,b)=>a-b);return {trials:values,medianMs:(sorted[sorted.length/2-1]+sorted[sorted.length/2])/2,maxMs:sorted[sorted.length-1]};};
 result.push({boardCards:match.boards.flat().length,events:match.effectLog.length,nextEventSequence:match.nextEventSequence,matchBytes:Buffer.byteLength(JSON.stringify(match)),threeLaneBefore:stats(times.before),threeLaneCurrent:stats(times.current)});console.error(JSON.stringify(result.at(-1)));
}
console.log(JSON.stringify({node:process.version,fixture:'synthetic populated boards, actual engine play events; 12 alternating three-lane trials after 1 warmup',result},null,2));
