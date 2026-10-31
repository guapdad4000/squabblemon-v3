import { useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import { BagRewardArrival } from '../src/components/BagRewardArrival';
import { DailyCheckInArrival } from '../src/components/DailyCheckInArrival';
import { KumiteUnlockGate } from '../src/components/kumite/KumiteUnlockGate';
import { NotificationProvider, useNotifications } from '../src/components/Notifications';
import { rewardReceipts } from '../src/lib/rewardReceiptStore';
import { setWorldSurface, useWorldSurface } from '../src/lib/worldSurface';
import { profileBootstrap } from './fighter-id.fixture';
import '../src/index.css';

// A small presenter fixture. This does not load or stand in for the 3D world.
const params = new URLSearchParams(location.search);
const kind = params.get('kind') ?? 'bag';
const route = memoryLocation({ path: '/game/story' });
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const initial = profileBootstrap({ id: `world-overlay-${kind}`, softCurrency: 100, packTickets: 0,
  styleShards: 0, unlockedCosmeticIds: ['story-key:chapter-two'],
  settings: { reducedMotion: true, turnTimerEnabled: false } });
const saved = new Set<string>();
const realFetch = window.fetch.bind(window);
let releaseFilm: (() => void) | undefined;
const film = { id: 'world-test-film', cardId: 'kyle', name: 'Kyle' };
let filmClaimed = false;
const daily = { date: '2026-10-30', streak: 1, claimedToday: false, nextResetAt: '2026-10-31T00:00:00Z',
  pending: kind === 'daily' ? [{ key: 'login:2026-10-30', date: '2026-10-30', title: 'Daily reward', streak: 1, softCurrency: 100, packTickets: 1, styleShards: 2 }] : [] };
// Synthetic API responses belong to this fixture only. Production transports stay untouched.
window.fetch = async (input, init) => {
  const path = new URL(String(input), location.origin).pathname;
  if (!path.startsWith('/api/')) return realFetch(input, init);
  if (path.endsWith('/notifications/receipts')) {
    if (init?.method === 'POST') for (const id of JSON.parse(String(init.body)).ids) saved.add(id);
    return Response.json({ ids: [...saved] });
  }
  if (path.endsWith('/film-receipts/claim')) {
    await new Promise<void>(resolve => { releaseFilm = resolve; });
    filmClaimed = true;
    return Response.json({ receipt: film });
  }
  if (path.endsWith('/film-receipts')) return Response.json({ receipts: filmClaimed ? [] : [film] });
  if (path.endsWith('/rewards/account')) return Response.json(daily);
  if (path.includes('/boss-raid')) return Response.json({ attemptsRemaining: 0, campaign: { completed: false } });
  if (path.endsWith('/mail')) return Response.json({ messages: [] });
  if (path.endsWith('/daily-clout')) return Response.json({ available: false, attemptsRemaining: 0, date: daily.date });
  return Response.json({ state: 'locked', chapters: [], nodes: [], pending: [], items: [], messages: [] });
};
setWorldSurface('loading');

function Notices() {
  const { notices } = useNotifications();
  return <><output id="pending-bag">{notices.filter(notice => notice.bagReward).length}</output>
    <output id="pending-story">{notices.filter(notice => notice.section === 'story').length}</output></>;
}

function Fixture() {
  const [bootstrap, setBootstrap] = useState(initial);
  const [chapter, setChapter] = useState(false);
  const [otherDialog, setOtherDialog] = useState(false);
  const world = useWorldSurface();
  const receipt = useSyncExternalStore(rewardReceipts.subscribe, rewardReceipts.current, () => null);
  Object.assign(window, {
    __worldSurface: setWorldSurface,
    __worldGain: () => setBootstrap(current => ({ ...current, profile: { ...current.profile,
      softCurrency: current.profile.softCurrency + 500, packTickets: current.profile.packTickets + 2,
      styleShards: current.profile.styleShards + 15 } })),
    __worldChapter: setChapter,
    __worldOtherDialog: setOtherDialog,
  });
  return <NotificationProvider bootstrap={bootstrap}>
    <main style={{ minHeight: '100dvh', padding: 12, background: '#111d18', color: '#f6e8ba' }}>
      <button id="world-focus">World movement control</button>
      <button onClick={() => setWorldSurface('loading')}>Load world</button>
      <button onClick={() => setWorldSurface('exploring')}>Explore world</button>
      <button onClick={() => setWorldSurface('busy')}>Travel to host</button>
      <button onClick={() => setBootstrap(current => ({ ...current, profile: { ...current.profile,
        softCurrency: current.profile.softCurrency + 500, packTickets: current.profile.packTickets + 2,
        styleShards: current.profile.styleShards + 15 } }))}>Receive wallet reward</button>
      <button onClick={() => { setChapter(true); setWorldSurface('busy'); }}>Read Story chapter</button>
      <button onClick={() => { setOtherDialog(true); setWorldSurface('busy'); }}>Read mail</button>
      <button onClick={() => releaseFilm?.()}>Deliver confirmed Kumite result</button>
      <b data-wallet-resource="clout">{bootstrap.profile.softCurrency}</b>
      <output id="world-state">{world}</output><output id="world-receipt">{receipt?.id ?? ''}</output>
      <Notices />
      {kind === 'bag' && <BagRewardArrival key={bootstrap.profile.id} profile={bootstrap.profile} />}
      {kind === 'daily' && <DailyCheckInArrival key={bootstrap.profile.id} bootstrap={bootstrap} />}
      {kind === 'kumite' && <KumiteUnlockGate key={bootstrap.profile.id} bootstrap={bootstrap} />}
      {chapter && <div role="dialog" aria-modal="true" aria-label="Story chapter"><div data-story-content-active="true">Actual Story content</div><button onClick={() => { setChapter(false); setWorldSurface('exploring'); }}>Close chapter</button></div>}
      {otherDialog && <div role="dialog" aria-modal="true" aria-label="Existing mail">Mail content<button onClick={() => { setOtherDialog(false); setWorldSurface('exploring'); }}>Close mail</button></div>}
    </main>
  </NotificationProvider>;
}

createRoot(document.getElementById('root')!).render(<Router hook={route.hook}><QueryClientProvider client={client}><Fixture /></QueryClientProvider></Router>);
