import '../src/index.css';
import React from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import type {PlayerBootstrap} from '@workspace/api-client-react';
import BreakthroughOnline from '../src/components/breakthrough/BreakthroughOnline';
import {createGame,deploy} from '@workspace/squabblemon-engine/breakthrough';
import {buildBreakthroughRoster} from '@workspace/squabblemon-engine/breakthroughCatalog';
import {createBreakthroughRoomForSimulation,projectBreakthroughRoom,tickBreakthroughRoom,commandBreakthroughRoom} from '@workspace/squabblemon-engine/breakthroughRoom';
import {encodeRoomStream} from '@workspace/squabblemon-engine/breakthroughRoomStream';
if (!import.meta.env.DEV) throw Error('Local synthetic transport fixture only');
const guest = new URLSearchParams(location.search).has('guest');
const own = guest ? 'opponent' : 'player';
const id = guest ? 'qa-b' : 'qa-a';
const roster = buildBreakthroughRoster();
const cards = roster.filter(c=>c.kind==='character' && c.ability==='none' && c.cost<=3).slice(0,10).map(c=>c.id);
// Keep canonical art and gameplay; the fixture chooses only plain fighters for a repeatable crossing.
const deck = cards.length===10 ? cards : roster.filter(c=>c.kind==='character' && c.cost<=3).slice(0,10).map(c=>c.id);
const now = Date.now();
let room = createBreakthroughRoomForSimulation({roomId:'f0000000-0000-4000-8000-000000000001',ownerFence:1,members:{player:'qa-a',opponent:'qa-b'},profiles:{player:{name:'Gold Gloves',avatarKey:'nabu'},opponent:{name:'Night Shift',avatarKey:'anu'}},serverTimeMs:now,expiresAtMs:now+600000,game:createGame(roster,{seed:13,decks:{player:deck,opponent:deck}})});
let search: any = null;
let started = false;
let finishing = false;
const originalFetch = window.fetch.bind(window);
window.fetch = async (input,init) => {
 const url = new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href);
 if (!url.pathname.startsWith('/api/breakthrough')) return originalFetch(input,init);
 const path = url.pathname.slice('/api/breakthrough'.length);
 const json = (data:unknown)=>new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
 if (!path) return json({search,record:{trophies:100,wins:5,losses:2,draws:0}});
 if (path==='/standings') return json({season:'fixture',total:0,updatedAt:new Date().toISOString(),leaders:[],you:null});
 if (path==='/search') { const body=JSON.parse(String(init?.body)); if(search?.requestId===body.requestId) return json(search); search={...body,status:'waiting',roomId:null};setTimeout(()=>{search={...search,status:'paired',roomId:room.roomId}},1500);return json(search); }
 if (path==='/cancel') {search={...search,status:'cancelled'};return json(search);}
 if (path.endsWith('/receipt')) return json(room.phase==='complete'?{roomId:room.roomId,policy:'breakthrough-trophies-v1',season:'breakthrough-season-1',outcome:room.game.winner===own?'win':'loss',eligible:true,exclusion:null,before:100,after:room.game.winner===own?120:94,delta:room.game.winner===own?20:-6}:null);
 if (path.endsWith('/commands')) {const result=commandBreakthroughRoom(room,id,JSON.parse(String(init?.body)),room.lastServerTimeMs);room=result.checkpoint;return json(result.ack);}
 if (path.endsWith('/stream')) {
   if (!started) {started=true;room.lastServerTimeMs=Date.now();}
   let timer: ReturnType<typeof setInterval>;
   const encoder=new TextEncoder();
   const stream=new ReadableStream({start(controller){
     let previous: ReturnType<typeof projectBreakthroughRoom>|null=null;
     const send=()=>{ const view=projectBreakthroughRoom(room,id);controller.enqueue(encoder.encode('data: '+JSON.stringify(encodeRoomStream(previous,view))+'\n\n'));previous=view; };
     send();
     timer=setInterval(()=>{
       if(room.phase!=='active') return;
       if(room.game.elapsedMs>3000 && room.game.units.length===0 && !finishing){
         for(const side of ['player','opponent'] as const){const card=room.game.players[side].hand.find(c=>roster.find(r=>r.id===c)?.kind==='character')!;room.game=deploy(room.game,side,card,side==='player'?0:2).state;}
       }
       room=tickBreakthroughRoom(room,room.lastServerTimeMs+200).checkpoint;if(room.phase==='complete' && search)search={...search,status:'complete'};send();
     },200);
     init?.signal?.addEventListener('abort',()=>{clearInterval(timer);try{controller.close()}catch{}},{once:true});
   },cancel(){clearInterval(timer)}});
   return new Response(stream,{headers:{'content-type':'text/event-stream'}});
 }
 return json(projectBreakthroughRoom(room,id));
};
const profile={id,displayName:guest?'Night Shift':'Gold Gloves',avatarKey:guest?'anu':'nabu',level:12,ownedCardIds:deck,savedDecks:[{id:'owned',name:'Corner Crew',cardIds:deck,heroCardId:deck[0]}],equippedVariants:{},settings:{reducedMotion:false}};
const root=createRoot(document.getElementById('root')!);
root.render(<QueryClientProvider client={new QueryClient()}><BreakthroughOnline bootstrap={{profile} as PlayerBootstrap}/><button style={{position:'fixed',bottom:0,left:0,zIndex:10000,fontSize:10}} onClick={e=>{
 finishing=true;
 room.game.players[own].breaches=1;
 room.game.units=room.game.units.filter(u=>u.side===own).slice(0,1);
 if(!room.game.units.length){room.game=deploy(room.game,own,room.game.players[own].hand[0],0).state;}
 room.game.units[0].position=own==='player'?0.99999:0.00001;
 (e.target as HTMLElement).style.display = 'none';
}}>QA: Finish double break</button></QueryClientProvider>);
import.meta.hot?.dispose(()=>{root.unmount();window.fetch=originalFetch;});
