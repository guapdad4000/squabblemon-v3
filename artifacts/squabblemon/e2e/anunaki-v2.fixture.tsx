import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { anunakiCards, anunakiRarities } from '@workspace/squabblemon-engine/anunakiWave';
import { CardView } from '../src/components/CardView';
import { CollectibleCard } from '../src/components/CollectibleCard';
import { CardInspector } from '../src/components/CardInspector';
import { Battle } from '../src/components/Battle';
import { createCardInstance, createMatch, playCard, playTurnCard, type CardInstance } from '../src/gameEngine';
import { cards, catalogCardById, decks } from '../src/data';
import '../src/index.css';

// Isolated rendering fixture only: these cards remain excluded from the public catalog.
for (const [id, card] of Object.entries(anunakiCards)) {
  (catalogCardById as Record<string, unknown>)[id] = { ...card, catalogId: id, artworkId: id, rarity: anunakiRarities[id], faction: 'Anunaki', crewTags: [], variantSlots: [], acquisitionSources: [] };
}
const noop = () => {};
function Fixture() {
  const [inspecting, setInspecting] = useState<CardInstance | typeof cards[string] | null>(null);
  const [mode, setMode] = useState<'cards' | 'battle'>('cards');
  const consuming = new URLSearchParams(location.search).has('consume');
  const m = createMatch('block', 'combo');
  m.playerMotion = 9;
  m.ancientTablets = [{owner:'player',lane:0},{owner:'cpu',lane:1}];
  if (new URLSearchParams(location.search).has('crowded')) {
    const kyle = createCardInstance('kyle', 'player', 'crowd', 0);
    const summoned = playCard({ ...m, playerHand: [kyle] }, 'player', kyle.instanceId, 0);
    m.boards[0] = [...summoned.boards.flat().map(card => ({ ...card, owner: 'player' as const, lane: 0 as const })), ...['yakub', 'nabu', 'utu'].map((id, index) => createCardInstance(id, 'player', `crowd-${index}`, 0))];
  }
  const inanna = createCardInstance('inanna', 'player', 'fixture', 0);
  m.playerHand = [inanna];
  const after = consuming ? playTurnCard(m, 'player', inanna.instanceId, 0) : m;
  const event = consuming ? after.effectLog.find(e => e.note === 'Consumed an Ancient Tablet.') : null;
  const effect = event ? {...event,targetIds:[],impact:true} : null;
  return <>
    <nav style={{display:'flex',gap:12,padding:12,background:'#071b1c',color:'#fff',position:'relative',zIndex:100}}><button type="button" onClick={()=>setMode('cards')}>Cards</button><button type="button" onClick={()=>setMode('battle')}>Battle</button><span>V2 fixture · collection/deck print & supplied original portraits</span></nav>
    {mode === 'cards' ? <main style={{display:'flex',flexWrap:'wrap',gap:20,padding:24,background:'#122019',minHeight:'90vh'}}>
      {[...Object.keys(anunakiCards),'cornball'].map(id=>{ const card = anunakiCards[id] ?? cards[id]; return <div key={id} style={{width:180}}><CollectibleCard card={card} fillContainer isBoard presentationOnly disableLayout/><button type="button" style={{color:'white'}} onClick={()=>setInspecting(card)}>Inspect {card.name}</button></div> })}
    </main> : <div style={{height:'calc(100dvh - 48px)'}}><Battle match={after} deck={decks[0]} rivalDeck={decks[1]} selectedInstanceId={null} setSelectedInstanceId={noop} selectedLane={null} setSelectedLane={noop} squabble={false} setSquabble={noop} onPlayCard={noop} commit={noop} endTurn={noop} skipSequence={noop} presentationPhase={consuming?'effects':'player-ready'} phaseMessage="Tablet fixture" timerSeconds={20} timerEnabled={false} impactLane={event?0:null} activeEffect={effect} activeEffectId={event?.cardInstanceId} activeEffectLane={event?0:null} presentationScores={event?.scores.after} setInspect={card=>setInspecting(card)} onShowRules={noop}/></div>}
    {inspecting && <CardInspector card={inspecting} onClose={()=>setInspecting(null)}/>}
  </>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient()}><Fixture /></QueryClientProvider>);
