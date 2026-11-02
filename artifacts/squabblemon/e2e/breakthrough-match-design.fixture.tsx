import '../src/index.css';
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import BreakthroughArena from '../src/components/breakthrough/BreakthroughArena';
import { buildBreakthroughRoster } from '@workspace/squabblemon-engine/breakthroughCatalog';
import { createGame } from '@workspace/squabblemon-engine/breakthrough';
import { createBreakthroughRoomForSimulation, projectBreakthroughRoom, commandBreakthroughRoom, type RoomIntent } from '@workspace/squabblemon-engine/breakthroughRoom';
import { getCardImage } from '../src/data';
if (!import.meta.env.DEV) throw Error('Development-only local room simulation');
const roster = buildBreakthroughRoster(card => getCardImage(card.catalogId));
const deck = ['nabu','enki','utu','ninhursag','inanna','yakub','enlil','ereshkigal','caucus-mountaineer','anu'];
if (location.search.includes('choice')) deck[0] = 'homeless-guy';
let room = createBreakthroughRoomForSimulation({roomId:'design-room',ownerFence:1,members:{player:'design-one',opponent:'design-two'},serverTimeMs:1000,expiresAtMs:200000,game:createGame(roster,{seed:129,decks:{player:deck,opponent:deck}})});
const commands: RoomIntent[] = [];
function Fixture() {
  const [view,setView] = useState(() => projectBreakthroughRoom(room,'design-one'));
  const [message,setMessage] = useState('');
  Object.assign(window,{matchDesign:{commands,view:()=>view,setMessage}});
  return <BreakthroughArena roster={roster} playerDeck={[]} opponentDeck={[]} initialSeed={129}
    identity={{name:'YOUR CREW',avatarKey:'nabu',heroCardId:'anu',level:12}} preferredReducedMotion
    onChangeDeck={()=>{document.body.dataset.exit='lobby'}} onExit={()=>{document.body.dataset.exit='kumite'}}
    online={{view,message,receipt:null,command:(command)=>{
      commands.push(command);
      const result=commandBreakthroughRoom(room,'design-one',{commandId:`design-${commands.length}`,sequence:commands.length,command},1000);
      room=result.checkpoint;setView(projectBreakthroughRoom(room,'design-one'));
    }}} />;
}
const root=createRoot(document.getElementById('root')!);
import.meta.hot?.dispose(()=>root.unmount());
root.render(<Fixture/>);
