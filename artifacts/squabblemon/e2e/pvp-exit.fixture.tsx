import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Router, Switch } from 'wouter';
import { applyOnlineCommand, createOnlineRoom, joinOnlineRoom, onlineRoomView, type OnlineRoom } from '@workspace/squabblemon-engine/multiplayer';
import { decks } from '../src/data';
import { Multiplayer } from '../src/pages/game/Multiplayer';
import { fadecadeBootstrap } from './fadecade.fixture';
import { guardDeckRouteNavigation } from '../src/lib/deckExitGuard';
import '../src/index.css';

const params = new URLSearchParams(location.search);
const ranked = params.get('kind') === 'ranked';
const code = 'AABBCCDDEEFF';
const now = Date.now();
const deck = decks.find(value => value.id === 'block')!;
let room: OnlineRoom = joinOnlineRoom(
  createOnlineRoom({ userId: 'host', name: 'Host', ready: false, deck }, 'player', now),
  { userId: 'guest', name: 'Guest', ready: false, deck }, now,
);
room = applyOnlineCommand(room, 'player', { type: 'ready' }, now);
room = applyOnlineCommand(room, 'cpu', { type: 'ready' }, now);
if (ranked) room = { ...room, ranked: { queuedAt: now - 2000, heartbeatAt: now, botAfter: now + 8000, bot: false, ratings: { player: 1000, cpu: 1000 } } };
let fail = false;
let count = 0;
Object.assign(window, {
  pvpFixture: {
    disconnect: () => window.dispatchEvent(new Event('offline')),
    reconnect: () => window.dispatchEvent(new Event('online')),
    fail: (value: boolean) => { fail = value; },
    complete: () => { room = { ...room, status: 'complete', winner: 'cpu', reason: 'districts', deadline: null, revision: room.revision + 1 }; },
    requests: () => count,
    status: () => room.status,
  },
});
const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
  if (url.pathname.includes(`/api/multiplayer/${code}`)) {
    if (url.pathname.endsWith('/reactions')) return Response.json({ revision: room.revision, serverTime: Date.now(), latest: {}, owned: [] });
    if (url.pathname.endsWith('/actions')) {
      count++;
      if (fail) return Response.json({ error: 'Surrender not confirmed' }, { status: 409 });
      const command = JSON.parse(String(init?.body)).command;
      if (command.type === 'surrender') await new Promise(resolve => setTimeout(resolve, 350));
      room = applyOnlineCommand(room, 'player', command, Date.now());
    }
    return Response.json(onlineRoomView(room, code, 'host', Date.now()));
  }
  return nativeFetch(input, init);
};
// Preserve a real back entry while starting on the mounted match route.
history.replaceState({}, '', `/squabblemon/game/online${ranked ? '' : '?tab=friends'}`);
history.pushState({}, '', `/squabblemon/game/online/${code}`);
const bootstrap = fadecadeBootstrap();
bootstrap.profile.settings.reducedMotion = params.get('motion') !== 'full';
createRoot(document.getElementById('root')!).render(
  <Router base="/squabblemon" aroundNav={guardDeckRouteNavigation}>
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <Switch>
        <Route path="/game/online/:code">{() => <Multiplayer bootstrap={bootstrap} code={code} />}</Route>
        <Route path="/game/online">{() => <div data-testid="pvp-hub">{ranked ? 'Fade Park' : 'Friend fades'}</div>}</Route>
      </Switch>
    </QueryClientProvider>
  </Router>,
);