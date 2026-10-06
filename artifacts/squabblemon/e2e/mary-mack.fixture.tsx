import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Battle } from '../src/components/Battle';
import { CardInspector } from '../src/components/CardInspector';
import { createMatch, createCardInstance, nextRound, playTurnCard, type CardInstance, type Lane, type Match, type EffectLogEntry } from '../src/gameEngine';
import { decks } from '../src/data';
import '../src/index.css';
const noop = () => {};
function opening(): Match {
  const match = createMatch('block','block');
  const card = (id: string, owner: 'player' | 'cpu', lane: Lane, index=0) => ({ ...createCardInstance(id,owner,'mary-preview',index), lane, playedRound: 1 });
  match.boards = [[card('ms-mary-mack','player',0),card('og','cpu',0)], [card('cornball','player',1),card('og','cpu',1,1)], [card('hooper','player',2),card('og','cpu',2,2)]];
  match.playerHand = ['cornball','mr-mc-hands','work-hubby','snow'].map((id,index)=>createCardInstance(id,'player','mary-hand',index));
  match.playerMotion = 8;
  return match;
}
function App() {
  const [match,setMatch]=useState(opening), [selected,setSelected]=useState<string|null>(null), [lane,setLane]=useState<Lane|null>(null), [inspect,setInspect]=useState<CardInstance|null>(null);
  const [squabble,setSquabble]=useState(false), [effect,setEffect]=useState<EffectLogEntry|null>(null);
  useEffect(()=>{if(!effect)return;const timer=setTimeout(()=>setEffect(null),700);return()=>clearTimeout(timer);},[effect]);
  const end=()=>{const after=nextRound({...match,phase:'resolved'});setMatch(after);setSelected(null);setLane(null);setEffect(after.effectLog.slice(match.effectLog.length).findLast(e=>e.type==='ability'&&e.cardId==='ms-mary-mack')??null);};
  const play=(id:string,to:Lane,sq:boolean)=>{setMatch(playTurnCard(match,'player',id,to,sq));setSelected(null);setLane(null);};
  return <div style={{height:'100dvh'}}><Battle match={match} deck={decks[0]} rivalDeck={decks[0]}
    selectedInstanceId={selected} setSelectedInstanceId={setSelected} selectedLane={lane} setSelectedLane={setLane} squabble={squabble} setSquabble={setSquabble}
    onPlayCard={play} commit={()=>{if(selected&&lane!==null)play(selected,lane,squabble);}} endTurn={end} skipSequence={()=>setEffect(null)}
    battleSpeed={1} onToggleBattleSpeed={noop} presentationPhase={effect?'effects':'player-ready'} phaseMessage={effect?.note??'Collect 15¢. Return as the elephant.'}
    timerSeconds={20} timerEnabled={false} impactLane={effect?.lane??null} activeEffect={effect?{...effect,targetIds:effect.targets.map(t=>t.cardInstanceId),impact:true}:null}
    activeEffectId={effect?.cardInstanceId} activeEffectLane={effect?.lane??null} setInspect={setInspect} onShowRules={noop}/>
    {inspect&&<CardInspector card={inspect} match={match} onClose={()=>setInspect(null)}/>}</div>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><App/></QueryClientProvider>);
