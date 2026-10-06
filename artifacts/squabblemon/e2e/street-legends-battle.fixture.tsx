import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Battle } from '../src/components/Battle';
import { CardInspector } from '../src/components/CardInspector';
import GameSoundtrack from '../src/components/GameSoundtrack';
import { createMatch, playTurnCard, pass, revealCpuTurn, nextRound, type CardInstance, type Lane, type Match, type EffectLogEntry } from '../src/gameEngine';
import { decks } from '../src/data';
import '../src/index.css';

const music=decks.find(d=>d.id==='music-industry')!;
const fitness=decks.find(d=>d.id==='fitness-circuit')!;
function opening(): Match {
  let m=createMatch(music.id,fitness.id);
  for(const [id,lane] of [['the-opening-act',0],['the-dj',0],['the-hype-man',0]] as const) {
    const card=m.playerHand.find(c=>c.cardId===id)!;
    if(m.playerMotion<card.cost) m=nextRound(revealCpuTurn(pass(m,'player')));
    m=playTurnCard(m,'player',card.instanceId,lane);
  }
  return nextRound(revealCpuTurn(pass(m,'player')));
}
const queryClient=new QueryClient();
function Fixture() {
  const [match,setMatch]=useState(opening),[selected,setSelected]=useState<string|null>(null),[lane,setLane]=useState<Lane|null>(null);
  const [squabble,setSquabble]=useState(false),[inspect,setInspect]=useState<CardInstance|null>(null),[phase,setPhase]=useState('player-ready'),[fast,setFast]=useState(false),[effect,setEffect]=useState<EffectLogEntry|null>(null);
  useEffect(()=>{if(phase!=='effects')return; const timer=setTimeout(()=>{setPhase('player-ready');setEffect(null);},650);return()=>clearTimeout(timer);},[phase,match.nextEventSequence]);
  const play=(id:string,to:Lane,sq:boolean)=>{
    const after=playTurnCard(match,'player',id,to,sq);setMatch(after);setSelected(null);setLane(null);
    const e=after.effectLog.slice(match.effectLog.length).findLast(e=>e.type==='ability'&&!e.abilityMetadata?.upgradeId);
    setEffect(e??null);setPhase('effects');
  };
  const end=()=>{setMatch(nextRound(revealCpuTurn(pass(match,'player'))));setEffect(null);setPhase('player-ready');setSelected(null);setLane(null);};
  (window as any).__streetWaveBattle={getMatch:()=>match};
  return <><GameSoundtrack/><div style={{height:'100dvh'}}><Battle match={match} deck={music} rivalDeck={fitness}
    selectedInstanceId={selected} setSelectedInstanceId={setSelected} selectedLane={lane} setSelectedLane={setLane}
    squabble={squabble} setSquabble={setSquabble} onPlayCard={play} commit={()=>{if(selected&&lane!==null)play(selected,lane,squabble);}}
    endTurn={end} skipSequence={()=>{setPhase('player-ready');setEffect(null);}} battleSpeed={fast?1.5:1} onToggleBattleSpeed={()=>setFast(x=>!x)}
    presentationPhase={phase} phaseMessage={effect?.note??'Choose a card and district'} timerSeconds={20} timerEnabled impactLane={effect?.lane??null}
    activeEffect={effect?{...effect,targetIds:effect.targets.map(t=>t.cardInstanceId),impact:true}:null} activeEffectId={effect?.cardInstanceId}
    activeEffectLane={effect?.lane??null} setInspect={setInspect} onShowRules={()=>{}}/>
    {inspect&&<CardInspector card={inspect} match={match} onClose={()=>setInspect(null)}/>}</div></>;
}
const root=createRoot(document.getElementById('root')!);
root.render(<QueryClientProvider client={queryClient}><Fixture/></QueryClientProvider>);
import.meta.hot?.dispose(()=>root.unmount());
