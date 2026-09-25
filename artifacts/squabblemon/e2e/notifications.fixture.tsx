import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { profileBootstrap } from './fighter-id.fixture';
import { NotificationProvider, DailyCloutPack, Attention, ItemDot, useNotifications } from '../src/components/Notifications';
import { CityHeader } from '../src/components/venue/CityHeader';
import '../src/index.css';
const bootstrap = profileBootstrap({ id: new URLSearchParams(location.search).get('player') ?? 'notice-test', displayName: 'A very long player name', ownedCardIds: ['kyle'], unlockedCosmeticIds: ['style:kyle:stickers'], softCurrency: 41500, styleShards: 56875, packTickets: 3 });
function Content() {
 const { seen } = useNotifications();
 return <><CityHeader bootstrap={bootstrap}/><DailyCloutPack playerId={bootstrap.profile.id}/><button onClick={() => seen('card:kyle')}>Inspect Kyle<ItemDot id="card:kyle"/></button><p>Cards <Attention section="cards"/></p><p>Mail <Attention section="mail"/></p></>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient()}><NotificationProvider bootstrap={bootstrap}><Content/></NotificationProvider></QueryClientProvider>);
