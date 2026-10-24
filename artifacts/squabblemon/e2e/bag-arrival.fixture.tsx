import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router } from 'wouter';
import { NotificationProvider, NotificationInbox, useNotifications } from '../src/components/Notifications';
import { BagRewardArrival } from '../src/components/BagRewardArrival';
import { profileBootstrap } from './fighter-id.fixture';
import { rewardReceipts } from '../src/lib/rewardReceiptStore';
import '../src/index.css';
const params = new URLSearchParams(location.search);
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const initial = profileBootstrap({ id: params.get('player') ?? 'bag-arrival-test', softCurrency: 100, packTickets: 0, styleShards: 0, settings: { reducedMotion: params.has('reduced'), turnTimerEnabled: false } });
function Notices() { const { notices, dismiss } = useNotifications(); return <><output id="pending-bag">{notices.filter(notice => notice.bagReward).length}</output><button onClick={() => dismiss(notices.filter(n => n.bagReward).map(n => n.id))}>Clear bag notices</button></>; }
function Fixture() {
  const [bootstrap, setBootstrap] = useState(initial), [home, setHome] = useState(true), [blocker, setBlocker] = useState(false);
  Object.assign(window, {
    __bagGain: () => setBootstrap(current => ({ ...current, profile: { ...current.profile, softCurrency: current.profile.softCurrency + 500, packTickets: current.profile.packTickets + 2, styleShards: current.profile.styleShards + 15 } })),
    __bagRefresh: () => setBootstrap(current => ({ ...current, profile: { ...current.profile } })),
    __bagSpend: () => setBootstrap(current => ({ ...current, profile: { ...current.profile, softCurrency: current.profile.softCurrency - 100 } })),
    __bagHome: setHome, __bagBlocker: setBlocker,
    __bagSwitchPlayer: () => setBootstrap(profileBootstrap({ ...initial.profile, id: 'other-player', softCurrency: 5000 })),
    __bagRewardQueue: (active: boolean) => active ? rewardReceipts.show({ id: `blocker-${Date.now()}`, title: 'Queued receipt', items: [{ label: 'Clout', amount: 1 }] }) : rewardReceipts.reset(),
  });
  return <NotificationProvider bootstrap={bootstrap}>
    <main style={{ minHeight: '100dvh', padding: 12, background: '#111d18', color: '#f6e8ba' }}>
      <header style={{ display: 'flex', gap: 12, alignItems: 'center' }}><button id="focus-control">Keep playing</button><b data-wallet-resource="clout">{bootstrap.profile.softCurrency}</b><b data-wallet-resource="shards">{bootstrap.profile.styleShards}</b><NotificationInbox /></header>
      <Notices />
      {blocker && <div role="dialog" aria-modal="true" aria-label="Existing receipt"><button onClick={() => setBlocker(false)}>Close receipt</button></div>}
      {home && <BagRewardArrival key={bootstrap.profile.id} profile={bootstrap.profile} />}
    </main>
  </NotificationProvider>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Router><QueryClientProvider client={client}><Fixture /></QueryClientProvider></Router></StrictMode>);
