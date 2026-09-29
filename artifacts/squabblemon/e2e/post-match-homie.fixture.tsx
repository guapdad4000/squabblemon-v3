import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createOnlineRoom, joinOnlineRoom, applyOnlineCommand, onlineRoomView } from '@workspace/squabblemon-engine/multiplayer';
import { decks } from '../src/data';
import { MultiplayerBattle } from '../src/components/MultiplayerBattle';
import { AppAuthProvider } from '../src/lib/auth';
import { SocialProvider } from '../src/lib/social';
import '../src/index.css';
import '../src/styles/multiplayer.css';

const code = 'AABBCCDDEEFF';
const now = Date.now();
const deck = decks.find(value => value.id === 'block')!;
let room = joinOnlineRoom(createOnlineRoom({ userId: 'host', name: 'Host', ready: false, deck }, 'player', now),
  { userId: 'guest', name: 'Rival', ready: false, deck }, now);
room = applyOnlineCommand(room, 'player', { type: 'ready' }, now);
room = applyOnlineCommand(room, 'cpu', { type: 'ready' }, now);
room = { ...room, status: 'complete', winner: 'cpu', reason: 'districts', deadline: null };
if (new URLSearchParams(location.search).has('bot')) room = { ...room, ranked: { queuedAt: now, heartbeatAt: now, botAfter: now, bot: true, ratings: { player: 1000, cpu: 1000 } } };
localStorage.setItem('squabblemon_e2e_user', 'signed-in');
createRoot(document.getElementById('root')!).render(
  <AppAuthProvider publishableKey="pk_test_fixture">
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SocialProvider accountId="host">
        <MultiplayerBattle room={onlineRoomView(room, code, 'host', Date.now())} busy={false} connected reducedMotion send={() => {}} onLeave={() => {}} />
      </SocialProvider>
    </QueryClientProvider>
  </AppAuthProvider>,
);