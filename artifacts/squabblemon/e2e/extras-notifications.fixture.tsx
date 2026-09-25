import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { profileBootstrap } from './fighter-id.fixture';
import { NotificationProvider, NotificationInbox, useNotifications } from '../src/components/Notifications';
import { CharacterCollections } from '../src/pages/game/CharacterCollections';
import { CharacterStyles } from '../src/pages/game/CharacterStyles';
import '../src/index.css';

const playerId = new URLSearchParams(location.search).get('player') ?? 'extras-review';
const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
client.setQueryData(['daily-clout', playerId], { date: '2026-09-25', available: true, amount: 50, attemptsRemaining: 0, resetsAt: '2026-09-26' });
client.setQueryData(['account-rewards', playerId], { pending: [{ key: 'keep-reward', title: 'Keep this reward' }], growth: { ready: false } });
client.setQueryData(['starter-mythic', playerId], { state: 'claimed', chapters: [] });
client.setQueryData(['player-mail', playerId], { messages: [] });
const initial = profileBootstrap({ id: playerId, ownedCardIds: ['kyle', 'stockz'], discoveredCardIds: ['kyle', 'stockz'], ownedVariants: ['kyle:tagged'], unlockedCosmeticIds: ['style:kyle:stickers', 'style:kyle:banner-finish', 'style:stockz:stickers'] });
initial.profile.settings.reducedMotion = true;
function Content({ bootstrap, unlock }: { bootstrap: typeof initial; unlock: () => void }) {
  const [path, navigate] = useLocation();
  const { notices } = useNotifications();
  return <>
    <header style={{ position: 'sticky', top: 0, zIndex: 100, background: '#111', padding: 12, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      <NotificationInbox />
      <button onClick={() => navigate('/game')}>Home</button>
      <button onClick={() => navigate('/game/style')}>The Extras</button>
      <button onClick={() => navigate('/game/style/kyle')}>Kyle Extras</button>
      <button onClick={unlock}>Grant new scene</button>
      <output data-testid="unread-notices" hidden>{JSON.stringify(notices.map(notice => notice.id))}</output>
    </header>
    {path === '/game/style' ? <CharacterCollections bootstrap={bootstrap} />
      : path.startsWith('/game/style/') ? <CharacterStyles bootstrap={bootstrap} cardId={path.split('/').at(-1)} />
      : <h1>Extras notification review</h1>}
  </>;
}
function Fixture() {
  const [bootstrap, setBootstrap] = useState(initial);
  return <NotificationProvider bootstrap={bootstrap}><Content bootstrap={bootstrap} unlock={() => setBootstrap(current => ({ ...current, profile: { ...current.profile, unlockedCosmeticIds: [...new Set([...current.profile.unlockedCosmeticIds, 'style:kyle:backdrop'])] } }))} /></NotificationProvider>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><Fixture /></QueryClientProvider>);
