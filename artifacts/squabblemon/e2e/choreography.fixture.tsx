import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Battle } from '../src/components/Battle';
import { BattleVictory } from '../src/components/BattleVictory';
import { buildReplayFrame } from '../src/components/PlayLoop';
import { createMatch, createCardInstance, playCard, type Match } from '../src/gameEngine';
import { decks } from '../src/data';
import '../src/index.css';

const mode = new URLSearchParams(location.search).get('mode') ?? 'freeze';
let base: Match = createMatch('block','combo');
const actor = createCardInstance((mode === 'burn' || mode === 'destroy') ? 'roaster' : mode === 'silence' ? 'nerd' : mode === 'move' ? 'vibe' : mode === 'thaw' ? 'rastamon' : 'snow','player','fixture',0);
base.playerHand = [actor]; base.playerMotion = 20;
base.boards = [[],[],[]];
for (const owner of ['player','cpu'] as const) for(let i=0;i<(mode==='crowded'?12:6);i++) base.boards[0].push({ ...createCardInstance(['cornball','snow','rastamon','wifey','hooper','baby'][i%6],owner,'formation',i),lane:0 });
const target = {...createCardInstance('hooper',mode==='move'||mode==='thaw'?'player':'cpu','victim',0),basePower:mode==='move'?0:mode==='destroy'?2:5,lane: (mode==='move'?2:1) as 1|2};
if(mode==='thaw')target.statuses={...target.statuses,frozen:true};
base.boards[target.lane].push(target);
const resolved=playCard(base,'player',actor.instanceId,1);
const event=resolved.effectLog.find(e=>e.type==='ability'&&e.targets.some(t=>t.cardInstanceId===target.instanceId))!;
function Fixture() {
  const [impact,setImpact]=useState(false);
  const [ready,setReady]=useState(false);
  const [energy,setEnergy]=useState(0);
  const [seconds,setSeconds]=useState(20);
  const [introPhase,setIntroPhase]=useState('versus');
  (window as any).battleFixture={ impact:()=>setImpact(true), energy:()=>setEnergy(value=>value+3), seconds:setSeconds, phase:setIntroPhase, ready:()=>setReady(true), target:target.instanceId, source:actor.instanceId };
  if(mode==='victory')return <BattleVictory match={resolved} winner="player" />;
  const match=buildReplayFrame(resolved,event,impact?'after':'before');
  match.playerMotion += energy;
  return <div style={{height:'100dvh',color:'white'}}><Battle match={match} deck={decks[0]} rivalDeck={decks[1]} selectedInstanceId={null} setSelectedInstanceId={()=>{}} selectedLane={null} setSelectedLane={()=>{}} commit={()=>{}} skipSequence={()=>{}} presentationPhase={mode==='intro'?introPhase:ready?'player-ready':'effects'} phaseMessage={mode==='intro'?introPhase:event.note} timerSeconds={seconds} timerEnabled={mode==='crowded'||mode==='destroy'} impactLane={ready?null:1} presentationScores={event.scores[impact?'after':'before']} activeEffect={ready||mode==='intro'?null:{...event,impact,chain:mode==='chain'?{id:'fixture-chain',index:2,total:3,fromId:base.boards[0][0].instanceId}:undefined,targetIds:event.targets.map(t=>t.cardInstanceId)}} activeEffectId={ready?null:actor.instanceId} activeEffectLane={ready?null:1} squabble={false} setSquabble={()=>{}} setInspect={()=>{}} onShowRules={()=>{}} /></div>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
