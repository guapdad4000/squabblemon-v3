import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import { cardCatalog } from '../src/data';
import { FadePark } from '../src/pages/game/FadePark';
import '../src/index.css';

const cardIds = cardCatalog.slice(0, 10).map(card => card.catalogId);
const bootstrap = {
  profile: {
    id: 'fade-marker-account',
    username: 'Fade Marker',
    savedDecks: [{
      id: 'fade-marker-deck',
      name: 'Marker Crew',
      cardIds,
      heroCardId: cardIds[0],
    }],
    ownedCardIds: cardCatalog.map(card => card.catalogId),
    cardProgression: {},
    settings: { reducedMotion: true, turnTimerEnabled: false },
  },
} as unknown as PlayerBootstrap;

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function Fixture() {
  const [location] = useLocation();
  return location.startsWith('/game/online/')
    ? <main data-testid="active-room">Active room mounted</main>
    : <FadePark bootstrap={bootstrap} />;
}

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={client}>
    <Fixture />
  </QueryClientProvider>,
);