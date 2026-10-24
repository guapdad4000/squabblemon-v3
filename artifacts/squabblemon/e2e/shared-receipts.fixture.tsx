import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RewardReveal } from '../src/components/RewardReveal';
import { NotificationProvider, NotificationInbox } from '../src/components/Notifications';
import { rewardReceipts } from '../src/lib/rewardReceiptStore';
import { getAssetUrl } from '../src/lib/assets';
import { profileBootstrap } from './fighter-id.fixture';
import '../src/index.css';
import '../src/styles/venue.css';
import '../src/styles/studio.css';
const bootstrap = profileBootstrap({ id: 'shared-popup-review', displayName: 'Receipt review', ownedCardIds: ['dr-fade'], softCurrency: 1000, packTickets: 3 });
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function queue() {
  rewardReceipts.reset();
  rewardReceipts.show({ id: 'shared-generic', title: 'The block came through', preview: true,
    items: [{ label: 'Clout', amount: 250, glyph: 'clout' }, { label: 'Street Pack tickets', amount: 2, glyph: 'ticket' }, { label: 'Dr. Fade', image: getAssetUrl('assets/characters/dr-fade.webp') }] });
  rewardReceipts.show({ id: 'shared-story', title: 'The neighborhood remembers',
    items: [{ label: 'Clout', amount: 250, glyph: 'clout' }, ...Array.from({ length: 12 }, (_, i) => ({ label: `A neighborhood reward with a long readable name ${i + 1}`, amount: i + 1, glyph: 'ticket' as const }))],
    story: { chapterTitle: 'The Block Party', backgroundAssetId: 'assets/story/chapter-one/environments/map.webp', portraitAssetId: 'assets/characters/dr-fade.webp', cloutBalance: { from: 750, to: 1000 } } });
}
(window as any).__sharedReceipt = () => rewardReceipts.current()?.id ?? null;
function Fixture() {
  return <NotificationProvider bootstrap={bootstrap}><main style={{ minHeight: '100dvh', padding: 24 }}>
    <button onClick={queue}>Open receipt queue</button><NotificationInbox /><RewardReveal />
  </main></NotificationProvider>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><Fixture /></QueryClientProvider>);
