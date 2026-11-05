import '../src/index.css';
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import BreakthroughArena from '../src/components/breakthrough/BreakthroughArena';
import {buildBreakthroughRoster} from '@workspace/squabblemon-engine/breakthroughCatalog';
import {createGame} from '@workspace/squabblemon-engine/breakthrough';
import {createBreakthroughRoomForSimulation,projectBreakthroughRoom} from '@workspace/squabblemon-engine/breakthroughRoom';
import {getCardImage} from '../src/data';
import {battlePortraitUrl} from '../src/lib/battlePortrait';
if(!import.meta.env.DEV)throw Error('Development-only catalog acceptance');
const roster=buildBreakthroughRoster(card=>getCardImage(card.catalogId));
function Fixture(){
 const [cardId,setCardId]=useState(roster[0].id);
 const card=roster.find(c=>c.id===cardId)!;
 const deck=[cardId,...roster.filter(c=>c.id!==cardId).slice(0,9).map(c=>c.id)];
 const game=createGame(roster,{seed:129,decks:{player:deck,opponent:deck}});
 game.players.player.hand=[cardId];game.players.player.motion=9;
 const room=createBreakthroughRoomForSimulation({roomId:'catalog-room',ownerFence:1,members:{player:'catalog-one',opponent:'catalog-two'},serverTimeMs:1000,expiresAtMs:200000,game});
 Object.assign(window,{catalogAcceptance:{cards:roster.map(c=>({id:c.id,name:c.name,description:c.description,art:battlePortraitUrl(c.art)})),show:setCardId}});
 return <BreakthroughArena key={cardId} roster={roster} playerDeck={[]} opponentDeck={[]} initialSeed={129}
 identity={{name:'YOUR CREW',avatarKey:'nabu',heroCardId:'anu',level:12}} preferredReducedMotion onChangeDeck={()=>{}} onExit={()=>{}}
 online={{view:projectBreakthroughRoom(room,'catalog-one'),message:'',receipt:null,command:()=>{}}}/>;
}
const root=createRoot(document.getElementById('root')!);import.meta.hot?.dispose(()=>root.unmount());root.render(<Fixture/>);
