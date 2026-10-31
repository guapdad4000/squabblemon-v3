import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnunakiRaidGame } from '../src/components/fadecade/AnunakiRaidGame';
import { createAnunakiRaid, applyAnunakiRaidAction, ANUNAKI_RAID_LOANER, type AnunakiRaid } from '@workspace/squabblemon-engine/anunakiRaid';
import { starterRecipes } from '@workspace/squabblemon-engine/data';
import { createCardInstance } from '@workspace/squabblemon-engine/gameEngine';
import '../src/index.css';
const fixture = new URLSearchParams(location.search);
const difficulty = fixture.get('difficulty') === 'standard' ? 'standard' : fixture.get('difficulty') === 'ascended' ? 'ascended' : 'training';
const recipe = starterRecipes.find(deck => deck.name === 'RECEIPTS')!;
const replayDeck = [...recipe.catalogCardIds.slice(1), recipe.catalogCardIds[0]];
let run: AnunakiRaid | null = fixture.has('battle') ? createAnunakiRaid(crypto.randomUUID(), difficulty, fixture.has('replay') ? replayDeck : ANUNAKI_RAID_LOANER) : null;
if (run && fixture.has('investment')) {
 run.match.playerHand = [createCardInstance('homelessguy','player','investment',0),createCardInstance('cornball','player','investment',1)];
 run.match.playerMotion = 6;
}
if (run && fixture.has('choices')) {
 run.match.playerHand = ['the-dice-game','the-concert','cornball'].map((id,index) => createCardInstance(id,'player','choices',index));
 run.match.playerMotion = 12; run.match.cpuMotion = 12;
 run.match.boards[1] = [createCardInstance('cornball','player','concert-ally',0),{...createCardInstance('cornball','cpu','concert-enemy',0),powerModifier:6}];
}
Object.defineProperty(window,'raidState',{get:()=>run});
const recordedActions: unknown[] = [];
const recordedRequests: unknown[] = [];
const actionReceipts = new Map<string, unknown>();
let droppedResponse = false;
(window as unknown as { raidRequests: unknown[] }).raidRequests = recordedRequests;
(window as unknown as { raidActions: unknown[] }).raidActions = recordedActions;
if (run && fixture.has('replay')) {
 const plan: Array<Array<[string, 0|1|2]>> = [[['Plug',0]],[['Closet Nerd',1]],[['Snow Bunny',2],['Bus Pass',0]],[['Baby Momma',2],['Soul Food',1]],[['Hooper',0],['Cognac Bottle',0]]];
 for (const round of plan.slice(0,Math.min(5,Number(fixture.get('replay')) || 0))) {
  for (const [name,lane] of round) { const card=run.match.playerHand.find(item=>item.name===name); if(!card) throw new Error(`Replay card missing: ${name}`); run=applyAnunakiRaidAction(run,{type:'play',instanceId:card.instanceId,lane}); }
  run=applyAnunakiRaidAction(run,{type:'blast'}); if(run.status!=='active') break;
 }
}
const original = window.fetch;
window.fetch = async (input,init) => {
 const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
 if (!url.includes('/api/player/anunaki-raid')) return original(input,init);
 if (init?.method === 'POST') {
  const body = JSON.parse(String(init.body));
  if (body.action) {
   recordedRequests.push(body);
   if (actionReceipts.has(body.actionId)) return Response.json(actionReceipts.get(body.actionId));
   recordedActions.push(body.action);
  }
  if (body.action?.type === 'blast' && fixture.has('latency')) await new Promise(resolve => setTimeout(resolve,450));
  run = url.includes('/start') ? createAnunakiRaid(body.requestId,body.difficulty,body.cardIds.length ? body.cardIds : ANUNAKI_RAID_LOANER) : applyAnunakiRaidAction(run!,body.action);
  if (body.action) {
   actionReceipts.set(body.actionId, { eligibility: {training:true,standard:true,ascended:true}, run });
   if (fixture.has('retry') && !droppedResponse) { droppedResponse = true; throw new TypeError('Connection lost after save. Retry safely.'); }
  }
 }
 return Response.json({ eligibility: {training:true,standard:true,ascended:true},run });
};
const bootstrap = {profile:{id:'fixture', settings:{reducedMotion:!fixture.has('motion')}}} as any;
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient()}><AnunakiRaidGame bootstrap={bootstrap} crews={[]} onBack={()=>{}} onExit={()=>{}}/></QueryClientProvider>);
