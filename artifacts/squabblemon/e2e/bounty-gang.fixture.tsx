import React, { useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import {
  getGetPlayerBootstrapQueryKey,
  type PlayerBootstrap,
} from '@workspace/api-client-react';
import { Router } from 'wouter';
import { cardCatalog } from '../src/data';
import { DeckWorkbench } from '../src/components/DeckWorkbench';
import { CityHeader } from '../src/components/venue/CityHeader';
import { RewardReveal } from '../src/components/RewardReveal';
import { rewardReceipts } from '../src/lib/rewardReceipts';
import type { DeckDraft } from '../src/lib/deckWorkshop';
import { Decks } from '../src/pages/game/Decks';
import { Missions } from '../src/pages/game/Missions';
import '../src/index.css';
import '../src/styles/venue.css';

type Screen = 'bounties' | 'decks' | 'editor';
type Scenario = 'ready' | 'empty' | 'claimed';

const params = new URLSearchParams(location.search);
const requestedScreen = params.get('screen');
const initialScreen: Screen =
  requestedScreen === 'decks' || requestedScreen === 'editor' ? requestedScreen : 'bounties';
const requestedScenario = params.get('scenario');
const scenario: Scenario =
  requestedScenario === 'empty' || requestedScenario === 'claimed' ? requestedScenario : 'ready';
const profileReducedMotion = params.get('profileMotion') === 'reduce';
const timestamp = new Date(0);
const ids = cardCatalog.map((card) => card.catalogId);
const deck = {
  id: 'fixture-gang',
  name: 'The Regression Crew',
  cardIds: ids.slice(0, 10),
  heroCardId: ids[0],
  recipeId: null,
};

function createBootstrap(claimed = scenario === 'claimed'): PlayerBootstrap {
  return {
    profile: {
      id: 'e2e-player',
      displayName: 'Bounty QA',
      avatarKey: 'cornball',
      onboardingStep: 'complete',
      starterDeckId: deck.id,
      streetRep: 18,
      xp: 240,
      level: 4,
      softCurrency: claimed ? 1_137 : 1_000,
      packTickets: 3,
      styleShards: 25,
      packPity: 0,
      deckSlots: 4,
      cosmeticCurrency: 0,
      collectionProgress: ids.length,
      storyChapter: 2,
      storyNode: 1,
      tutorialCompleted: true,
      starterRewardClaimed: true,
      ageConfirmedAt: timestamp,
      termsAcceptedAt: timestamp,
      settings: { reducedMotion: profileReducedMotion, turnTimerEnabled: false },
      ownedCardIds: ids,
      discoveredCardIds: ids,
      ownedVariants: [],
      equippedVariants: {},
      cardProgression: {},
      unlockedCosmeticIds: [],
      unlockedCharacterIds: [],
      savedDecks: [deck],
      storyProgress: {},
      inbox: [],
      packHistory: [],
      lastActiveAt: timestamp,
    },
    missions: scenario === 'empty' ? [] : [
      {
        id: 'weekly-cleanse',
        title: 'Clear the Air',
        description: 'Cleanse a friendly card in a verified practice fade.',
        cadence: 'weekly',
        progress: 1,
        goal: 1,
        status: claimed ? 'claimed' : 'claimable',
        rewardAmount: 125,
        rewardCurrency: 'softCurrency',
        resetAt: null,
      },
      {
        id: 'daily-footwork',
        title: 'Put in the Work',
        description: 'Finish three verified battles.',
        cadence: 'daily',
        progress: 1,
        goal: 3,
        status: 'active',
        rewardAmount: 1,
        rewardCurrency: 'packTickets',
        resetAt: null,
      },
      {
        id: 'claimed-first-win',
        title: 'First Win',
        description: 'Win one verified battle.',
        cadence: 'daily',
        progress: 1,
        goal: 1,
        status: 'claimed',
        rewardAmount: 50,
        rewardCurrency: 'softCurrency',
        resetAt: null,
      },
    ],
    nextAction: {
      id: 'practice',
      eyebrow: 'Training',
      title: 'Take the crew outside',
      description: 'Keep testing your gang.',
      destination: 'play',
      rewardLabel: null,
    },
    packConfig: {
      id: 'street-pack',
      name: 'Street Pack',
      oddsVersion: 'fixture',
      softCurrencyCost: 500,
      ticketCost: 1,
      rewardsPerPack: 3,
      pityLimit: 10,
      odds: [],
    },
    tenPullConfig: {
      id: 'street-ten',
      name: 'Street Ten Pull',
      oddsVersion: 'fixture',
      pullCount: 10,
      ticketCost: 9,
      softCurrencyCost: 4_500,
      rewardsPerPull: 3,
      rarePityBonusPerPull: 1,
    },
    collectionRoad: [],
  };
}

const initialBootstrap = createBootstrap();
const callbacks: { saveCalls: number; lastSaved: DeckDraft | null } = {
  saveCalls: 0,
  lastSaved: null,
};
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
});
client.setQueryData(getGetPlayerBootstrapQueryKey(), initialBootstrap);
rewardReceipts.reset();

declare global {
  interface Window {
    __bountyGangFixture: {
      setScreen(screen: Screen): void;
      cachedBootstrap(): PlayerBootstrap | undefined;
      callbacks(): { saveCalls: number; lastSaved: DeckDraft | null };
    };
  }
}

function CachedScreen({ screen }: { screen: Screen }) {
  const { data: bootstrap = initialBootstrap } = useQuery({
    queryKey: getGetPlayerBootstrapQueryKey(),
    queryFn: async () => initialBootstrap,
    initialData: initialBootstrap,
  });
  if (screen === 'decks') return <Decks bootstrap={bootstrap} />;
  if (screen === 'editor') {
    return (
      <DeckWorkbench
        initial={deck}
        ownedCardIds={bootstrap.profile.ownedCardIds}
        equippedVariants={bootstrap.profile.equippedVariants}
        onSave={async (draft) => {
          callbacks.saveCalls += 1;
          callbacks.lastSaved = { ...draft, cardIds: [...draft.cardIds] };
        }}
        onTest={async () => {}}
      />
    );
  }
  return <Missions bootstrap={bootstrap} />;
}

function Fixture() {
  const [screen, setScreen] = useState(initialScreen);
  const frameRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const fitFrameBelowPreviewChrome = () => {
      const frame = frameRef.current;
      if (!frame) return;
      const top = frame.getBoundingClientRect().top;
      frame.style.height = `${Math.max(0, window.innerHeight - top)}px`;
    };
    fitFrameBelowPreviewChrome();
    window.addEventListener('resize', fitFrameBelowPreviewChrome);
    const bodyObserver = new ResizeObserver(fitFrameBelowPreviewChrome);
    bodyObserver.observe(document.body);
    return () => {
      window.removeEventListener('resize', fitFrameBelowPreviewChrome);
      bodyObserver.disconnect();
    };
  }, []);
  window.__bountyGangFixture = {
    setScreen,
    cachedBootstrap: () => client.getQueryData<PlayerBootstrap>(getGetPlayerBootstrapQueryKey()),
    callbacks: () => callbacks,
  };
  return (
    <>
      <div
        ref={frameRef}
        className="game-shell game-shell--compact-nav h-[100dvh] bg-[#070707] text-white"
      >
        <div className="noise-overlay" />
        <div className="game-shell__content">
          <CityHeader bootstrap={client.getQueryData<PlayerBootstrap>(getGetPlayerBootstrapQueryKey()) ?? initialBootstrap} />
          <div className="game-route-stage">
            <CachedScreen screen={screen} />
          </div>
        </div>
      </div>
      <RewardReveal />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={client}>
    <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" disableTransitionOnChange>
      <Router>
        <Fixture />
      </Router>
    </ThemeProvider>
  </QueryClientProvider>,
);