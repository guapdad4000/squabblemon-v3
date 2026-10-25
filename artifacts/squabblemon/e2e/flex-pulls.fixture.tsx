import React, { useEffect } from 'react';
import { installGameSurfacePolicy } from '../src/lib/gameSurfacePolicy';
import '../src/styles/game-surface.css';
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
  useEffect(installGameSurfacePolicy, []);
  const { data = initial } = useQuery({ queryKey: getGetPlayerBootstrapQueryKey(), queryFn: async () => initial, staleTime: Infinity });
  return <div className="game-shell game-shell--compact-nav" style={{height:'100dvh'}}><div className="game-shell__content" style={{marginLeft:0}}><div className="game-route-stage"><Shop bootstrap={data} /></div></div></div>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><Fixture /></QueryClientProvider>);
