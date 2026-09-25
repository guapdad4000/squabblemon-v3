import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGetPlayerBootstrap } from '@workspace/api-client-react';
import { AppAuthProvider } from '../src/lib/auth';
import { Settings } from '../src/pages/game/Settings';
import { MultiplayerBattle } from '../src/components/MultiplayerBattle';
import { createOnlineRoom, joinOnlineRoom, applyOnlineCommand, onlineRoomView } from '@workspace/squabblemon-engine/multiplayer';
import { decks } from '@workspace/squabblemon-engine/data';
import '../src/index.css';
import '../src/styles/venue.css';

const mode = new URLSearchParams(location.search).get('mode');
function Fixture() {
  const query = useGetPlayerBootstrap();
  if (!query.data) return <p>Loading profile</p>;
  if (mode !== 'pvp') return <div style={{height:'100dvh'}}><Settings bootstrap={query.data} /></div>;
  const member = (userId: string, avatarKey: string, index: number) => ({ userId, avatarKey, name: index ? 'ATLAS RIVAL' : query.data!.profile.displayName, ready:false, deck:decks[index] });
  let room = createOnlineRoom(member('a',query.data.profile.avatarKey,0),'player',Date.now());
  room = joinOnlineRoom(room,member('b','sticker:kyle:point',1),Date.now());
  room = applyOnlineCommand(room,'player',{type:'ready'},Date.now());
  room = applyOnlineCommand(room,'cpu',{type:'ready'},Date.now());
  return <MultiplayerBattle room={onlineRoomView(room,'AVATAR-FIXTURE','a',Date.now())} busy={false} connected reducedMotion={false} send={() => true} onLeave={() => {}} />;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient()}><AppAuthProvider publishableKey="pk_test_ZTJlLXRlc3Qk"><Fixture /></AppAuthProvider></QueryClientProvider>);
