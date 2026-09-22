import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import { cardCatalog } from '../src/data';
import { Decks } from '../src/pages/game/Decks';
import { FadePark } from '../src/pages/game/FadePark';
import { PlayerDeckPlay } from '../src/pages/game/PlayerDeckPlay';
import '../src/index.css';
import '../src/styles/venue.css';

const query = new URLSearchParams(location.search);
const mode = query.get('mode') ?? 'decks';
const account = query.get('account') ?? 'account-a';
const invalid = query.get('invalid') === '1';
const ids = cardCatalog.map(card => card.catalogId);
const deck = (id: string, name: string, offset: number) => ({
  id,
  name,
  cardIds: ids.slice(offset, offset + 10),
  heroCardId: ids[offset],
  recipeId: null,
  valid: true,
  issues: [],
});
const savedDecks = invalid
  ? [deck('deck-one', 'First Gang', 0)]
  : [deck('deck-one', 'First Gang', 0), deck('deck-two', 'Second Gang', 10)];

const bootstrap = {
  profile: {
    id: account,
    username: account,
    createdAt: new Date(0).toISOString(),
    softCurrency: 1000,
    hardCurrency: 0,
    onboardingStep: 'complete',
    level: 5,
    xp: 250,
    deckSlots: 4,
    cardProgression: {},
    storyProgress: {},
    inbox: [],
    packHistory: [],
    lastActiveAt: new Date(0).toISOString(),
    ownedCardIds: ids,
    discoveredCardIds: ids,
    ownedVariants: [],
    equippedVariants: {},
    unlockedCosmeticIds: [],
    unlockedCharacterIds: [],
    savedDecks,
    collectionProgress: ids.length,
    storyChapter: 1,
    storyNode: 1,
    tutorialCompleted: true,
    starterRewardClaimed: true,
    ageConfirmedAt: new Date(0).toISOString(),
    termsAcceptedAt: new Date(0).toISOString(),
    settings: { reducedMotion: true, turnTimerEnabled: false },
  },
  missions: [],
  nextAction: {
    id: 'play',
    eyebrow: 'Training',
    title: 'Choose a gang',
    description: 'Fixture',
    destination: 'play',
    rewardLabel: null,
  },
  packConfig: {
    id: 'pack',
    name: 'Pack',
    oddsVersion: '1',
    softCurrencyCost: 100,
    ticketCost: 1,
    rewardsPerPack: 5,
    pityLimit: 10,
    odds: [],
  },
  tenPullConfig: {
    id: 'ten',
    name: 'Ten',
    oddsVersion: '1',
    pullCount: 10,
    ticketCost: 10,
    softCurrencyCost: 1000,
    rewardsPerPull: 5,
    rarePityBonusPerPull: 1,
  },
  collectionRoad: [],
} as PlayerBootstrap;

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const content = mode === 'park'
  ? <FadePark bootstrap={bootstrap} />
  : mode === 'story'
    ? <PlayerDeckPlay bootstrap={bootstrap} storyNodeId="fixture-story-node" />
    : <Decks bootstrap={bootstrap} />;

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={client}>
    <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" disableTransitionOnChange>
      {content}
    </ThemeProvider>
  </QueryClientProvider>,
);