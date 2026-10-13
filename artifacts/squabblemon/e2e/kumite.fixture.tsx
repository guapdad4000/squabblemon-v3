import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { customFetch, getGetPlayerBootstrapQueryKey, type PlayerBootstrap } from '@workspace/api-client-react';
import { cardCatalog, starterRecipes } from '../src/data';
import { Kumite } from '../src/pages/game/Kumite';
import type { KumiteCurrent } from '../src/lib/kumite';
import '../src/index.css';

// Review-only bootstrap. Tournament responses are supplied by the test through
// intercepted API requests, exactly as the production component receives them.
const savedDecks = starterRecipes.slice(0, 2).map((deck, index) => ({
  id: `kumite-review-${index}`, name: deck.name, cardIds: deck.catalogCardIds,
  heroCardId: deck.hero, recipeId: deck.id, valid: true, issues: [],
}));
const bootstrap = {
  profile: {
    id: 'kumite-browser-review', displayName: 'Review Fighter', avatarKey: savedDecks[0].heroCardId,
    settings: { reducedMotion: new URLSearchParams(location.search).get('motion') !== 'full', turnTimerEnabled: true },
    savedDecks, ownedCardIds: cardCatalog.filter(card => !['bushedo-brown', 'franklin-duke', 'chonk-lee'].includes(card.catalogId)).map(card => card.catalogId),
    cardProgression: {}, equippedVariants: {}, ownedVariants: [],
  }, missions: [],
} as unknown as PlayerBootstrap;
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const cached = (window as unknown as { kumiteReviewCachedData?: KumiteCurrent }).kumiteReviewCachedData;
if (cached) client.setQueryData(['kumite', bootstrap.profile.id], cached);
function BootstrapProbe() {
  const query = useQuery({ queryKey: getGetPlayerBootstrapQueryKey(), queryFn: () => customFetch<PlayerBootstrap>('/api/player/bootstrap'), initialData: bootstrap, staleTime: Infinity });
  useEffect(() => { (window as unknown as { kumiteReviewBootstrap?: PlayerBootstrap }).kumiteReviewBootstrap = query.data; }, [query.data]);
  return null;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><BootstrapProbe /><Kumite bootstrap={bootstrap} /></QueryClientProvider>);
