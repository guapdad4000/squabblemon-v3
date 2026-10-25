import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Router, Switch } from 'wouter';
import { applyOnlineCommand, createOnlineRoom, joinOnlineRoom, onlineRoomView, retireOnlineRoomForRulesUpdate, type OnlineRoom } from '@workspace/squabblemon-engine/multiplayer';
import { decks } from '../src/data';
import { basePath } from '../src/lib/routing';
import { Multiplayer } from '../src/pages/game/Multiplayer';
import { fadecadeBootstrap } from './fadecade.fixture';
import { guardDeckRouteNavigation } from '../src/lib/deckExitGuard';
import { AppAuthProvider } from '../src/lib/auth';
import { SocialProvider } from '../src/lib/social';
import '../src/index.css';

const params = new URLSearchParams(location.search);
const ranked = params.get('kind') === 'ranked';
const kumite = params.get('kind') === 'kumite';
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
if (kumite) room = { ...room, kumite: { tournamentId: 'rules-cup', matchId: 'rules-bracket', roundDeadline: now + 60000 } };
const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
let fail = false;
let count = 0;
let reads = 0;
let holdSurrender = false;
let releaseSurrender: (() => void) | null = null;
Object.assign(window, {
  pvpFixture: {
    basePath,
    retireForRules: async () => {
      room = retireOnlineRoomForRulesUpdate(room, Date.now());
      await client.refetchQueries({ queryKey: ['friend-match', bootstrap.profile.id, code] });
      return { status: room.status, reason: room.reason, revision: room.revision };
    },
    disconnect: () => window.dispatchEvent(new Event('offline')),
    reconnect: () => window.dispatchEvent(new Event('online')),
    fail: (value: boolean) => { fail = value; },
    complete: () => { room = { ...room, status: 'complete', winner: 'cpu', reason: 'districts', deadline: null, revision: room.revision + 1 }; },
    holdSurrender: () => { holdSurrender = true; },
    releaseSurrender: () => { holdSurrender = false; releaseSurrender?.(); releaseSurrender = null; },
    requests: () => count,
    reads: () => reads,
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
      if (command.type === 'surrender') {
        if (holdSurrender) await new Promise<void>(resolve => { releaseSurrender = resolve; });
        else await new Promise(resolve => setTimeout(resolve, 350));
      }
      room = applyOnlineCommand(room, 'player', command, Date.now());
    }
    reads++;
    return Response.json(onlineRoomView(room, code, 'host', Date.now()));
  }
  return nativeFetch(input, init);
};
// Preserve a real back entry while starting on the mounted match route.
history.replaceState({}, '', `${basePath}${kumite ? '/game/kumite?view=arena' : `/game/online${ranked ? '' : '?tab=friends'}`}`);
history.pushState({}, '', `${basePath}/game/online/${code}`);
const bootstrap = fadecadeBootstrap();
bootstrap.profile.settings.reducedMotion = params.get('motion') !== 'full';
localStorage.setItem('squabblemon_e2e_user', 'signed-in');
createRoot(document.getElementById('root')!).render(
  <AppAuthProvider publishableKey="pk_test_fixture">
  <Router base={basePath} aroundNav={guardDeckRouteNavigation}>
    <QueryClientProvider client={client}>
      <SocialProvider accountId="host" enabled={false}>
      <Switch>
        <Route path="/game/online/:code">{() => <Multiplayer bootstrap={bootstrap} code={code} />}</Route>
        <Route path="/game/online">{() => <div data-testid="pvp-hub">{ranked ? 'Fade Park' : 'Friend fades'}</div>}</Route>
      </Switch>
      </SocialProvider>
    </QueryClientProvider>
  </Router>
  </AppAuthProvider>,
);
