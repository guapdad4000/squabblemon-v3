import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MatchArrival } from '../src/components/MatchArrival';
import { Battle } from '../src/components/Battle';
import { BattleFxImage } from '../src/components/BattleFxImage';
import { createMatch, createCardInstance, playTurnCard, type Lane } from '../src/gameEngine';
import { applyEventState, EFFECT_PRESENTATION_TIMING, type PresentationEffect } from '../src/components/PlayLoop';
import { decks } from '../src/data';
import '../src/index.css';

function initialMatch() {
  const m=createMatch('block','combo');m.round=3;m.playerMotion=16;m.cpuMotion=4;
  m.playerHand=['folks','carmeet','roaster','guap','kyle'].map((id,i)=>createCardInstance(id,'player','hand',i));
  m.boards=([0,1,2] as Lane[]).map(lane=>(['cpu','player'] as const).flatMap(owner=>
    ['hooper','plug'].map((id,i)=>({...createCardInstance(id,owner,`lane-${lane}`,i),lane,powerModifier:3})))) as typeof m.boards;
  return m;
}
const noop=()=>{};
function Review() {
  const [state,setState]=useState(()=>({match:initialMatch(),effect:null as PresentationEffect|null,impact:false,key:0}));
  const [squabble,setSquabble]=useState(false);
  const [arrival,setArrival]=useState(false);
  const [reduced,setReduced]=useState(false),[hold,setHold]=useState(false);
  const [selected,setSelected]=useState<string|null>(null),[lane,setLane]=useState<Lane|null>(null);
  const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const clear=()=>{setSquabble(false);setSelected(null);setLane(null);clearTimeout(timer.current);setState(s=>({match:initialMatch(),effect:null,impact:false,key:s.key+1}));};
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  useEffect(()=>{document.documentElement.dataset.reduceMotion=String(reduced);return()=>{delete document.documentElement.dataset.reduceMotion;};},[reduced]);
  function run(id:string) {
    setSquabble(false);setSelected(null);setLane(null);
    clearTimeout(timer.current);
    const before=initialMatch(),card=before.playerHand.find(c=>c.cardId===id)!;
    const resolved=playTurnCard(before,'player',card.instanceId,0);
    const event=resolved.effectLog.find(e=>e.sequence>=before.nextEventSequence&&e.type==='ability'&&e.cardId===id);
    if(!event)throw new Error('The review scenario must emit an authoritative ability event.');
    const effect={...event,targetIds:event.targets.map(t=>t.cardInstanceId)};
    setState(s=>({match:applyEventState(before,resolved,event,'before'),effect,impact:false,key:s.key+1}));
    timer.current=setTimeout(()=>{
      setState(s=>({...s,match:applyEventState(before,resolved,event,'after'),impact:true}));
      if(!hold)timer.current=setTimeout(()=>setState(s=>({...s,effect:null,impact:false})),EFFECT_PRESENTATION_TIMING.standard.afterMs);
    },EFFECT_PRESENTATION_TIMING.standard.beforeMs);
  }
  function showSquabble() {
    setSquabble(false);setSelected(null);setLane(null);
    clearTimeout(timer.current);
    const before=initialMatch();
    before.boards[1]=before.boards[1].filter(c=>c.owner==='cpu');
    const fighter=createCardInstance('hooper','player','hand',8);
    before.playerHand=[fighter,...before.playerHand];
    const resolved=playTurnCard(before,'player',fighter.instanceId,1,true);
    setState(s=>({match:resolved,effect:null,impact:false,key:s.key+1}));
  }
  return <><details className="fx-review-controls"><summary>Effects review</summary><div>
    <button onClick={()=>run('folks')}>Fire attack</button><button onClick={()=>run('roaster')}>Apply Burn</button><button onClick={()=>run('carmeet')}>Move</button>
    <button onClick={()=>setState(s=>({...s,match:{...s.match,playerMotion:s.match.playerMotion+1}}))}>Motion +1</button>
    <button onClick={showSquabble}>Squabbled card</button><button onClick={()=>setArrival(true)}>PvP match screen</button>
    <button onClick={clear}>Reset</button><label><input type="checkbox" checked={reduced} onChange={e=>setReduced(e.target.checked)}/>Reduced motion</label>
    <label><input type="checkbox" checked={hold} onChange={e=>setHold(e.target.checked)}/>Hold impact for inspection</label>
    <div className="fx-review-samples">{(['fire-impact','burn-flame','movement-dust','motion-orb','pvp-energy-burst','squabble-aura'] as const).map(kind=><figure key={kind}><BattleFxImage kind={kind} animated={kind!=='fire-impact'}/><figcaption>{kind}</figcaption></figure>)}</div>
  </div></details>{arrival ? <MatchArrival player={{name:'Your corner',hero:'guap',level:24,rp:1180}} rival={{name:'The challenger',hero:'kyle',level:24,rp:1180}} onContinue={()=>setArrival(false)}/> : <div data-review-held={hold && state.impact} data-review-effect={state.effect?.kind ?? 'none'} data-review-impact={state.impact} style={{height:'100dvh'}}><Battle key={state.key} match={state.match} deck={decks[0]} rivalDeck={decks[1]}
    selectedInstanceId={selected} setSelectedInstanceId={setSelected} selectedLane={lane} setSelectedLane={setLane}
    squabble={squabble} setSquabble={setSquabble} commit={noop} endTurn={noop} setInspect={noop} onShowRules={noop}
    presentationPhase={state.effect?'effects':'player-ready'} phaseMessage={state.effect?.note??'Choose a card'}
    activeEffect={state.effect?{...state.effect,impact:state.impact}:null} activeEffectId={state.effect?.cardInstanceId}
    activeEffectLane={state.effect?.lane} impactLane={state.impact?state.effect?.lane??null:null} timerEnabled={false} timerSeconds={20}/></div>}</>;
}
const query=new QueryClient({defaultOptions:{queries:{retry:false}}});
const root=createRoot(document.getElementById('root')!);
root.render(<QueryClientProvider client={query}><Review/></QueryClientProvider>);
if(import.meta.hot)import.meta.hot.dispose(()=>root.unmount());
