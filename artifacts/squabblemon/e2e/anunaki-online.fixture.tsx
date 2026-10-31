import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { anunakiCards, anunakiRarities } from '@workspace/squabblemon-engine/anunakiWave';
import { createOnlineRoom, joinOnlineRoom, applyOnlineCommand, onlineRoomView, type OnlineRoom, type Seat } from '@workspace/squabblemon-engine/multiplayer';
import { MultiplayerBattle } from '../src/components/MultiplayerBattle';
import { createCardInstance, createMatch } from '../src/gameEngine';
import { catalogCardById, decks } from '../src/data';
import '../src/index.css';

// Fixture-only catalog entries let the real view render gated draft cards.
for (const [id, card] of Object.entries(anunakiCards))
  (catalogCardById as Record<string, unknown>)[id] = { ...card, catalogId:id, artworkId:id, rarity:anunakiRarities[id], faction:'Anunaki', crewTags:[], variantSlots:[], acquisitionSources:[] };
const now = Date.now();
const member = (userId: string) => ({userId,name:userId,ready:false,deck:decks[0]});
let initial = joinOnlineRoom(createOnlineRoom(member('seat-a'),'player',now),member('seat-b'),now);
initial = applyOnlineCommand(applyOnlineCommand(initial,'player',{type:'ready'},now+1),'cpu',{type:'ready'},now+2);
const a = createCardInstance('inanna','player','fixture-a',0);
const b = createCardInstance('inanna','cpu','fixture-b',0);
initial.match = {...createMatch('block','block'), round:3, playerMotion:9, cpuMotion:9, phase:'player', playerHand:[a],cpuHand:[b],boards:[[],[],[]], ancientTablets:[{owner:'player',lane:0},{owner:'cpu',lane:1}],yakubBuffs:[{owner:'player',sourceInstanceId:'fixture-private-record',expiresAfterRound:4}]};
initial.deadline = now + 60_000;
initial.activeSeat = 'player';
function Fixture() {
 const [room,setRoom] = useState<OnlineRoom>(initial);
 const [error,setError] = useState('');
 const views = [onlineRoomView(room,'TABLET','seat-a',Date.now()), onlineRoomView(room,'TABLET','seat-b',Date.now())];
 // Only booleans cross the fixture UI boundary; the other player's private hand remains hidden.
 const audit = views.map((view,index) => {
   const rivalHand = index === 0 ? room.match!.cpuHand : room.match!.playerHand;
   const serialized = JSON.stringify(view);
   return !serialized.includes('fixture-private-record') && !serialized.includes('yakubBuffs') && !serialized.includes('"replay"') && !rivalHand.some(card=>serialized.includes(card.instanceId));
 });
 function consume(owner: Seat) {
   try {
     let next=room;
     if (owner==='cpu' && next.activeSeat==='player') next=applyOnlineCommand(next,'player',{type:'end-turn'},Date.now());
     const card=owner==='player'?next.match!.playerHand[0]:next.match!.cpuHand[0];
     next=applyOnlineCommand(next,owner,{type:'play',instanceId:card.instanceId,lane:owner==='player'?0:1,squabble:false},Date.now());
     setRoom(next);
   } catch (e) { setError(e instanceof Error?e.message:'Fixture command failed'); }
 }
 return <>
  <div style={{position:'sticky',top:0,zIndex:500,display:'flex',gap:10,flexWrap:'wrap',padding:10,background:'#10352a',color:'white'}}><button type="button" onClick={()=>consume('player')}>Consume player tablet</button><button type="button" onClick={()=>consume('cpu')}>Consume rival tablet</button><span data-testid="privacy-a">Seat A privacy: {audit[0]?'pass':'FAIL'}</span><span data-testid="privacy-b">Seat B privacy: {audit[1]?'pass':'FAIL'}</span>{error && <span role="alert">{error}</span>}<output data-testid="public-events" style={{display:'none'}}>{JSON.stringify(views[0].events)}</output></div>
  {views.map((view,index)=><section data-testid={index===0?'seat-a':'seat-b'} key={view.seat} style={{height:'100dvh'}}><MultiplayerBattle room={view} connected busy={false} reducedMotion={!new URLSearchParams(location.search).has('motion')} send={()=>false} onLeave={()=>{}} /></section>)}
 </>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient()}><Fixture /></QueryClientProvider>);
