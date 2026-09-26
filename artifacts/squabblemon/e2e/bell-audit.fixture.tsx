import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { profileBootstrap } from './fighter-id.fixture';
import { NotificationProvider, NotificationInbox, useNotifications, DailyCloutPack } from '../src/components/Notifications';
import { CharacterCollections } from '../src/pages/game/CharacterCollections';
import { CharacterStyles } from '../src/pages/game/CharacterStyles';
import { Missions } from '../src/pages/game/Missions';
import '../src/index.css';

const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, refetchInterval: false } } });
const initialPlayer = new URLSearchParams(location.search).get('player') ?? 'bell-audit';
function seed(player: string, date = '2026-09-25') {
  client.setQueryData(['daily-clout', player], { date, available: true, amount: 50, attemptsRemaining: 2, resetsAt: `${date}T23:59:59Z` });
  client.setQueryData(['account-rewards', player], { date, pending: [{ key: 'login:1', title: 'Your check-in reward' }], growth: { ready: true } });
  client.setQueryData(['starter-mythic', player], { state: 'ready', chapters: [] });
  client.setQueryData(['player-mail', player], { messages: [
    { id: 'unread', title: 'News from Buddy', readAt: null, claimedAt: null, gift: { softCurrency: 0, packTickets: 0, styleShards: 0 } },
    { id: 'gift', title: 'Buddy left a gift', readAt: '2026-09-25', claimedAt: null, gift: { softCurrency: 10, packTickets: 0, styleShards: 0 } },
  ] });
}
seed(initialPlayer); seed('second-player');
const initial = profileBootstrap({ id: initialPlayer, ownedCardIds: ['kyle', 'stockz', 'kyle'], discoveredCardIds: ['kyle', 'stockz'], ownedVariants: ['kyle:tagged'], packTickets: 3, unlockedCosmeticIds: ['style:kyle:stickers', 'style:kyle:banner-finish', 'style:kyle:backdrop', 'style:kyle:stickers', 'style:stockz:stickers', 'side-alley-tagged-cardback', 'block-party-crowned', 'story-key:chapter-two', 'mastery:kyle', 'badge:after-hours', 'old-event-unlock', 'style:missing:stickers'] });
initial.profile.settings.reducedMotion = true;
initial.missions = ['active', 'claimable'].map((status, index) => ({ id: `audit-${index}`, title: `Audit bounty ${index}`, description: 'Play the block', cadence: 'daily', progress: index ? 5 : 0, goal: 5, rewardCurrency: 'soft', rewardAmount: 50, status, resetAt: '2026-09-26T00:00:00Z' })) as typeof initial.missions;
function Content({ bootstrap, update }: { bootstrap: typeof initial; update: React.Dispatch<React.SetStateAction<typeof initial>> }) {
  const [path, navigate] = useLocation();
  const { notices, seen } = useNotifications();
  return <>
    <header style={{ position: 'sticky', top: 0, zIndex: 100, background: '#111', padding: 12, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      <NotificationInbox />
      <button onClick={() => navigate('/game')}>Home</button>
      <button onClick={() => navigate('/game/style')}>The Extras</button>
      <button onClick={() => navigate('/game/story')}>Story overview</button>
      <button onClick={() => navigate('/game/settings')}>Fighter ID</button>
      <button onClick={() => navigate('/game/audit-preview')}>Tall preview</button>
      <button onClick={() => seen(notices.map(n => n.id))}>Automatic receipts</button>
      <button onClick={() => update(old => ({ ...old, profile: { ...old.profile, id: old.profile.id === initialPlayer ? 'second-player' : initialPlayer } }))}>Switch player</button>
      <button onClick={() => update(old => ({ ...old, profile: { ...old.profile, softCurrency: old.profile.softCurrency + 25 } }))}>Gain Clout</button>
      <button onClick={() => update(old => ({ ...old, profile: { ...old.profile, unlockedCosmeticIds: [...old.profile.unlockedCosmeticIds, 'style:stockz:backdrop'] } }))}>New scene</button>
      <button onClick={() => update(old => ({ ...old, missions: old.missions.map(m => ({ ...m, status: 'claimable' })) }))}>Bounty ready</button>
      <button onClick={() => seed(bootstrap.profile.id, '2026-09-26')}>Next day</button>
      <button onClick={() => update(old => ({ ...old }))}>Refresh data</button>
    </header>
    <output data-testid="notices" hidden>{JSON.stringify(notices)}</output>
    <output data-testid="profile" hidden>{JSON.stringify(bootstrap.profile)}</output>
    {path === '/game/style' ? <CharacterCollections bootstrap={bootstrap} />
      : path.startsWith('/game/style/') ? <CharacterStyles bootstrap={bootstrap} cardId={path.split('/').at(-1)} />
      : path === '/game/missions' ? <Missions bootstrap={bootstrap} />
      : path === '/game/audit-preview' ? <article data-notification-id="offer:wonder-pack" style={{ height: 2200, background: '#20332b' }}>Tall notification preview</article>
      : <><h1>Bell audit</h1><DailyCloutPack playerId={bootstrap.profile.id} /></>}
  </>;
}
function Fixture() {
  const [bootstrap, update] = useState(initial);
  return <NotificationProvider bootstrap={bootstrap}><Content bootstrap={bootstrap} update={update} /></NotificationProvider>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={client}><Fixture /></QueryClientProvider></React.StrictMode>);
