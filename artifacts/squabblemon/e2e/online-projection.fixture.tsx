import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router } from 'wouter';
import { applyOnlineCommand, createOnlineRoom, joinOnlineRoom, onlineRoomView } from '@workspace/squabblemon-engine/multiplayer';
import { createCardInstance, type Match } from '../src/gameEngine';
import { decks } from '../src/data';
import { MultiplayerBattle } from '../src/components/MultiplayerBattle';
import { useFriendMatch } from '../src/lib/multiplayer';
import { AppAuthProvider } from '../src/lib/auth';
import { SocialProvider } from '../src/lib/social';
import '../src/index.css';

// Local diagnostic only: real query hook and actual battle/card components;
// this response source cannot send commands, access accounts or settle a game.
const code = 'PROJECTION10';
const account = 'projection-fixture';
const now = Date.now();
const member = (userId: string) => ({ userId, name: userId, ready: false, deck: decks[0] });
let room = joinOnlineRoom(createOnlineRoom(member('host'), 'player', now), member('guest'), now);
room = applyOnlineCommand(room, 'player', { type: 'ready' }, now);
room = applyOnlineCommand(room, 'cpu', { type: 'ready' }, now);
const boards: Match['boards'] = [[], [], []];
for (let index = 0; index < 10; index++) {
  const lane = (Math.floor(index / 2) % 3) as 0 | 1 | 2;
  boards[lane].push({ ...createCardInstance('hooper', index % 2 ? 'cpu' : 'player', 'projection-fixture', index), lane });
}
room = { ...room, match: { ...room.match!, round: 2, boards }, deadline: now + 65_000 };
let view = JSON.parse(JSON.stringify(onlineRoomView(room, code, 'host', now))) as ReturnType<typeof onlineRoomView>;
const boardId = view.boards[0][0].instanceId, handId = view.hand[0].instanceId;
const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
let reads = 0, writes = 0;
const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
  if (url.pathname.includes(`/api/multiplayer/${code}`)) {
    if (url.pathname.endsWith('/reactions')) return Response.json({ revision: view.revision, serverTime: Date.now(), latest: {}, owned: [] });
    if ((init?.method ?? 'GET') !== 'GET') { writes++; return Response.json({ error: 'Diagnostic is read-only' }, { status: 405 }); }
    reads++;
    return Response.json({ ...view, serverTime: Date.now() });
  }
  if (url.pathname.startsWith('/api/social/')) return Response.json({ opponent: null });
  return nativeFetch(input, init);
};
Object.assign(window, { onlineProjectionFixture: {
  snapshot: () => ({ reads, writes, revision: view.revision, status: view.status, boardId, handId, deadline: view.deadline }),
  update: async (kind: 'deadline' | 'card' | 'private-cost' | 'status') => {
    if (kind === 'deadline') view = { ...view, deadline: Date.now() + 45_000 };
    if (kind === 'card') view = { ...view, boards: view.boards.map(lane => lane.map(card => card.instanceId === boardId ? {
      ...card, form: { name: 'Confirmed form', ability: 'Confirmed ability', effect: 'Confirmed effect' },
      statuses: { ...card.statuses, locked: true },
    } : card)) };
    if (kind === 'private-cost') view = { ...view, hand: view.hand.map(card => card.instanceId === handId ? { ...card, costs: [0, 0, 0] } : card) };
    if (kind === 'status') view = { ...view, status: 'complete', winner: 'player', reason: 'districts', deadline: null };
    await client.refetchQueries({ queryKey: ['friend-match', account, code] });
  },
} });
const noAction = async () => false;
function Fixture() {
  const { query, connected } = useFriendMatch(account, code);
  return query.data ? <MultiplayerBattle room={query.data} connected={connected} busy={false} reducedMotion={false} send={noAction} onLeave={() => {}} /> : <p>Loading local response</p>;
}
createRoot(document.getElementById('root')!).render(<Router><AppAuthProvider publishableKey="pk_test_fixture"><QueryClientProvider client={client}><SocialProvider accountId={account} enabled={false}><Fixture /></SocialProvider></QueryClientProvider></AppAuthProvider></Router>);
