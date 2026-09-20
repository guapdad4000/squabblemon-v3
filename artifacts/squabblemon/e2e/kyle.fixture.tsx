import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MultiplayerBattle } from '../src/components/MultiplayerBattle';
import { createCardInstance } from '../src/gameEngine';
import { decks } from '../src/data';
import { createOnlineRoom, joinOnlineRoom, applyOnlineCommand, onlineRoomView, type OnlineRoom, type Seat } from '@workspace/squabblemon-engine/multiplayer';
import '../src/index.css';
import '../src/styles/multiplayer.css';
const now = Date.now();
const seat: Seat = new URLSearchParams(location.search).get('seat') === 'cpu' ? 'cpu' : 'player';
function fixture(): OnlineRoom {
  const member=(userId:string)=>({userId,name:userId==='a'?'KYLE gang':'Rival gang',ready:false,deck:{...decks[0],cards:['kyle',...decks[0].cards.slice(0,9)]}});
  let room=createOnlineRoom(member('a'),'player',now);room=joinOnlineRoom(room,member('b'),now);
  room=applyOnlineCommand(room,'player',{type:'ready'},now);room=applyOnlineCommand(room,'cpu',{type:'ready'},now);
  const actor=createCardInstance('kyle','player','preview',0);
  room.match={...room.match!,round:3,playerMotion:9,playerHand:[actor],boards:[0,1,2].map(lane=>[1,2].map(i=>({...createCardInstance('edgar','cpu','preview',lane*2+i),lane,basePower:1}))) as NonNullable<OnlineRoom['match']>['boards']};
  return applyOnlineCommand(room,'player',{type:'play',instanceId:actor.instanceId,lane:1,squabble:false},now);
}
function Fixture(){
  const [room,setRoom]=useState(fixture);
  (window as any).kyleFixture={room,advance:()=>setRoom(current=>{
    let next=applyOnlineCommand(current,current.activeSeat,{type:'end-turn'},Date.now());
    return applyOnlineCommand(next,next.activeSeat,{type:'end-turn'},Date.now());
  }),reset:()=>setRoom(fixture())};
  return <MultiplayerBattle room={onlineRoomView(room,'KYLE',seat==='player'?'a':'b',Date.now())} busy={false} connected reducedMotion send={command=>{setRoom(current=>applyOnlineCommand(current,seat,command,Date.now()));}} onLeave={()=>{}} />;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
