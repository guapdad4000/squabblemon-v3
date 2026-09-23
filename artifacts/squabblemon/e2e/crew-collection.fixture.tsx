import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  getGetPlayerBootstrapQueryKey,
  type PlayerBootstrap,
} from '@workspace/api-client-react';
import { Collection } from '../src/pages/game/Collection';
import '../src/index.css';

const ownedCardIds = [
  'inmate-crafty',
  'inmate-boyfriend',
  'inmate-informant',
  'inmate-contraband',
  'lebron-james',
  'hair-stylist',
  'stylist',
  'demario',
  'luigion',
  'black-cowboy',
  'sherlock',
  'watson',
  'closet-nerd',
];

const bootstrap = {
  profile: {
    id: 'e2e-four-crews',
    displayName: 'CREW REVIEWER',
    avatarKey: 'rookie',
    onboardingStep: 'complete',
    starterDeckId: 'block',
    streetRep: 5,
    xp: 100,
    level: 1,
    softCurrency: 250,
    packTickets: 1,
    styleShards: 0,
    packPity: 0,
    deckSlots: 3,
    cosmeticCurrency: 0,
    collectionProgress: 0,
    storyChapter: 1,
    storyNode: 0,
    tutorialCompleted: true,
    starterRewardClaimed: true,
    ageConfirmedAt: '2026-09-08T00:00:00.000Z',
    termsAcceptedAt: '2026-09-08T00:00:00.000Z',
    settings: { reducedMotion: true, turnTimerEnabled: false },
    ownedCardIds,
    discoveredCardIds: ownedCardIds,
    ownedVariants: [],
    equippedVariants: {},
    unlockedCosmeticIds: [],
    savedDecks: [],
    cardProgression: {},
    storyProgress: {},
    inbox: [],
    packHistory: [],
    lastActiveAt: '2026-09-08T00:00:00.000Z',
  },
  missions: [],
  nextAction: {
    id: 'enter-story',
    eyebrow: 'Chapter One',
    title: 'Enter the story',
    description: 'Your gang is ready.',
    destination: 'story',
    rewardLabel: null,
  },
  packConfig: {
    id: 'street-pack',
    name: 'Street Pack',
    oddsVersion: 'e2e-v1',
    softCurrencyCost: 500,
    ticketCost: 1,
    rewardsPerPack: 3,
    pityLimit: 10,
    odds: [],
  },
  collectionRoad: [],
} as PlayerBootstrap;

const queryClient = new QueryClient();
queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), bootstrap);
const root = createRoot(document.getElementById('root')!);
root.render(
  <QueryClientProvider client={queryClient}>
    <Collection bootstrap={bootstrap} />
  </QueryClientProvider>,
);
import.meta.hot?.dispose(() => root.unmount());