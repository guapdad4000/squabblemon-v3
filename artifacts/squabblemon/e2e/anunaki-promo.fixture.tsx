import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { getGetPlayerBootstrapQueryKey, type PlayerBootstrap } from '@workspace/api-client-react';
import { AppAuthProvider } from '../src/lib/auth';
import { ProfileSettings } from '../src/components/profile/ProfileSettings';
import '../src/index.css';
import '../src/styles/venue.css';
import '../src/styles/fighter-id.css';
const initial = { profile: { id: 'anunaki-promo-fixture', displayName: 'ANUNAKI BETA TESTER', ownedCardIds: [], unlockedCosmeticIds: [], styleShardBalances: {}, streetRep: 0, xp: 0, packTickets: 12, softCurrency: 2000, styleShards: 0, packPity: 7, featuredPackProgress: { anunaki: { misses: 9, packs: 9 } }, ownedVariants: [], settings: { reducedMotion: true, turnTimerEnabled: false } } } as unknown as PlayerBootstrap;
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
client.setQueryData(getGetPlayerBootstrapQueryKey(), initial);
(window as any).__promoBootstrap = () => client.getQueryData(getGetPlayerBootstrapQueryKey());
function Fixture() {
  const { data = initial } = useQuery({ queryKey: getGetPlayerBootstrapQueryKey(), queryFn: async () => initial, staleTime: Infinity });
  return <main className="fighter-id-stage"><div className="fighter-id-container"><div className="fighter-panel"><ProfileSettings bootstrap={data} /></div></div></main>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><AppAuthProvider publishableKey="pk_test_ZTJlLXRlc3Qk"><Fixture /></AppAuthProvider></QueryClientProvider>);
