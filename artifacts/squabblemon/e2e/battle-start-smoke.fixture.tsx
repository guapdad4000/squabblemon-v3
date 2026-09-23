import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  applyOnlineCommand,
  createOnlineRoom,
  joinOnlineRoom,
  onlineRoomView,
  type OnlineRoom,
} from '@workspace/squabblemon-engine/multiplayer';
import { decks } from '../src/data';
import { MultiplayerBattle } from '../src/components/MultiplayerBattle';
import { PlayLoop } from '../src/components/PlayLoop';
import '../src/index.css';
import '../src/styles/multiplayer.css';

type FixtureAction = 'update' | 'disconnect' | 'reconnect' | 'complete' | 'rematch';

const params = new URLSearchParams(location.search);
const flow = params.get('flow') ?? 'online';
const kind = params.get('kind') ?? 'friend';
const code = params.get('code') ?? `SMOKE-${kind.toUpperCase()}`;

function activeRoom(gameNumber = 1): OnlineRoom {
  const now = Date.now();
  const deck = decks.find(candidate => candidate.id === 'block')!;
  let room = joinOnlineRoom(
    createOnlineRoom({ userId: 'host', name: 'Host', ready: false, deck }, 'player', now),
    { userId: 'guest', name: kind === 'bot' ? 'Park Bot' : 'Guest', ready: false, deck },
    now,
  );
  room = { ...room, gameNumber };
  room = applyOnlineCommand(room, 'player', { type: 'ready' }, now);
  room = applyOnlineCommand(room, 'cpu', { type: 'ready' }, now);
  if (kind === 'ranked' || kind === 'bot') {
    room = {
      ...room,
      ranked: {
        queuedAt: now - 2_000,
        heartbeatAt: now,
        botAfter: now + 8_000,
        bot: kind === 'bot',
        ratings: { player: 1_000, cpu: 1_000 },
      },
    };
  }
  return room;
}

function OnlineFixture() {
  const [room, setRoom] = useState<OnlineRoom>(() => activeRoom());
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    const handle = (event: Event) => {
      const action = (event as CustomEvent<FixtureAction>).detail;
      if (action === 'disconnect') setConnected(false);
      if (action === 'reconnect') setConnected(true);
      if (action === 'update') setRoom(current => ({ ...current, revision: current.revision + 1 }));
      if (action === 'complete') {
        setRoom(current => ({
          ...current,
          revision: current.revision + 1,
          status: 'complete',
          winner: 'player',
          reason: 'districts',
          deadline: null,
          match: current.match ? { ...current.match, phase: 'complete' } : current.match,
        }));
      }
      if (action === 'rematch') {
        setRoom(current => activeRoom(current.gameNumber + 1));
        setConnected(true);
      }
    };
    window.addEventListener('battle-smoke-fixture', handle);
    return () => window.removeEventListener('battle-smoke-fixture', handle);
  }, []);

  const now = Date.now();
  const view = onlineRoomView(room, code, 'host', now);
  return (
    <MultiplayerBattle
      key={`${view.code}:${view.gameNumber}`}
      room={view}
      busy={false}
      connected={connected}
      reducedMotion={params.get('profileReduced') === 'true'}
      send={command => setRoom(current => applyOnlineCommand(current, 'player', command, Date.now()))}
      onLeave={() => undefined}
    />
  );
}

function LocalFixture() {
  return (
    <PlayLoop
      mode="guest"
      hideLobby
      initialDeckId="block"
      initialRivalId="combo"
      onExit={() => undefined}
    />
  );
}

const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={client}>
    {flow === 'local' ? <LocalFixture /> : <OnlineFixture />}
  </QueryClientProvider>,
);