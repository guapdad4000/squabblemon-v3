import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { getGetPlayerBootstrapQueryKey, type PlayerBootstrap } from '@workspace/api-client-react';
import { Shop } from '../src/pages/game/Shop';
import { STREET_PACK_DISCLOSURES, STREET_PACK_RULES } from '@workspace/squabblemon-engine/packRules';
import '../src/index.css';
import '../src/styles/venue.css';
const initial = {
  profile: { id: 'flex-fixture', packHistory: [], packTickets: Number(new URLSearchParams(location.search).get('tickets') ?? 7), softCurrency: Number(new URLSearchParams(location.search).get('clout') ?? 750), styleShards: 0, packPity: 4, ownedCardIds: ['dr-fade'], ownedVariants: [], equippedVariants: {}, settings: { reducedMotion: true, turnTimerEnabled: false } },
  packConfig: { id: 'street-pack', name: 'Street Pack', ticketCost: STREET_PACK_RULES.single.ticketCost, softCurrencyCost: STREET_PACK_RULES.single.softCurrencyCost, rewardsPerPack: 6, oddsVersion: 'street-pack-v7', pityLimit: STREET_PACK_RULES.pityLimit, odds: STREET_PACK_DISCLOSURES },
} as unknown as PlayerBootstrap;
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
client.setQueryData(getGetPlayerBootstrapQueryKey(), initial);
(window as any).__flexBootstrap = () => client.getQueryData(getGetPlayerBootstrapQueryKey());
function Fixture() {
  const { data = initial } = useQuery({ queryKey: getGetPlayerBootstrapQueryKey(), queryFn: async () => initial, staleTime: Infinity });
  return <div style={{ minHeight: '100dvh' }}><Shop bootstrap={data} /></div>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><Fixture /></QueryClientProvider>);
