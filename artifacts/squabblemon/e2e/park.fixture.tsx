import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FadePark } from '../src/pages/game/FadePark';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import { cardCatalog } from '../src/data';
import '../src/index.css';
import '../src/styles/fade-park.css';

const queryClient = new QueryClient();

const allCardIds = cardCatalog.map(c => c.catalogId);

const bootstrap: PlayerBootstrap = {
  profile: {
    id: 'fixture-player',
    username: 'Fixture Player',
    createdAt: new Date().toISOString(),
    softCurrency: 1000,
    hardCurrency: 100,
    onboardingStep: 'complete',
    level: 5,
    xp: 250,
    cardProgression: {},
    storyProgress: {},
    inbox: [],
    packHistory: [],
    lastActiveAt: new Date().toISOString(),
    ownedCardIds: allCardIds,
    discoveredCardIds: allCardIds,
    ownedVariants: [],
    equippedVariants: {},
    unlockedCosmeticIds: [],
    unlockedCharacterIds: [],
    savedDecks: [
      {
        id: 'deck-1',
        name: 'Fixture Gang',
        heroCardId: 'bodega-cat',
        cardIds: allCardIds.slice(0, 10),
        recipeId: null,
        valid: true,
        issues: [],
      },
    ],
    collectionProgress: 0,
    storyChapter: 0,
    storyNode: 0,
    tutorialCompleted: true,
    starterRewardClaimed: true,
    ageConfirmedAt: new Date().toISOString(),
    termsAcceptedAt: new Date().toISOString(),
    settings: { reducedMotion: false, turnTimerEnabled: true },
  },
  missions: [],
  nextAction: {
    id: 'play-ranked',
    eyebrow: 'Ranked',
    title: 'Fade Park',
    description: 'Find a ranked match.',
    destination: 'ranked',
    rewardLabel: null,
  },
  packConfig: { id: 'pack', name: 'Pack', oddsVersion: '1', softCurrencyCost: 100, ticketCost: 1, rewardsPerPack: 5, pityLimit: 10, odds: [] },
  tenPullConfig: { id: '10', name: '10', oddsVersion: '1', pullCount: 10, ticketCost: 10, softCurrencyCost: 1000, rewardsPerPull: 5, rarePityBonusPerPull: 1 },
  collectionRoad: [],
};

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <FadePark bootstrap={bootstrap} />
  </QueryClientProvider>
);
