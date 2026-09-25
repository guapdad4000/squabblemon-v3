import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GuidedFirstSession } from '../src/pages/game/GuidedFirstSession';
import { ROOKIE_CORE_IDS, ROOKIE_DECK_ID, ROOKIE_FOUNDATION_IDS } from '../src/data';
import '../src/index.css';
import '../src/styles/venue.css';
import '../src/styles/dr-fade.css';

// Full first-session journey with real clicks: welcome -> home tour -> deck
// claim handoff -> Dr. Fade welcome -> guided deck workbench. The battle stage
// is covered by rookie-road.fixture; here onComplete only marks the end.
const MENTOR_LINEUP = ROOKIE_CORE_IDS.map(id => (id === 'hooper' ? 'dr-fade' : id));

function makeBootstrap(claimed: boolean): any {
  return {
    profile: {
      id: 'e2e-rookie', displayName: 'ROOKIE', avatarKey: 'rookie',
      onboardingStep: 'tutorial', starterDeckId: claimed ? 'foundation-v1' : null,
      streetRep: 0, xp: 0, level: 1, softCurrency: 0, packTickets: 0, styleShards: 0, packPity: 0,
      deckSlots: 3, cosmeticCurrency: 0, collectionProgress: 0, storyChapter: 1, storyNode: 0,
      tutorialCompleted: false, starterRewardClaimed: false,
      ageConfirmedAt: '2026-09-08T00:00:00.000Z', termsAcceptedAt: '2026-09-08T00:00:00.000Z',
      settings: { reducedMotion: true, turnTimerEnabled: false },
      ownedCardIds: [...ROOKIE_FOUNDATION_IDS],
      discoveredCardIds: [], ownedVariants: [], equippedVariants: {}, cardProgression: {},
      unlockedCosmeticIds: [],
      savedDecks: claimed
        ? [{ id: ROOKIE_DECK_ID, name: 'My First Crew', cardIds: [...MENTOR_LINEUP], heroCardId: 'dr-fade' }]
        : [],
      storyProgress: {}, inbox: [], packHistory: [], lastActiveAt: '2026-09-08T00:00:00.000Z',
    },
    missions: [{
      id: 'rookie-road', title: 'Rookie Road', description: 'Finish your first session',
      cadence: 'onboarding', progress: 0, goal: 1, status: 'active',
      rewardAmount: 100, rewardCurrency: 'softCurrency', resetAt: null,
    }],
    nextAction: {
      id: 'onboarding-tutorial', eyebrow: 'Rookie Road', title: 'Finish setup',
      description: 'Complete the next Rookie Road step.', destination: 'onboarding', rewardLabel: null,
    },
    packConfig: {
      id: 'street-pack', name: 'Street Pack', oddsVersion: 'e2e-v1', softCurrencyCost: 500,
      ticketCost: 1, rewardsPerPack: 3, pityLimit: 10, odds: [],
    },
    collectionRoad: [],
  };
}

function Journey() {
  const [claimed, setClaimed] = useState(false);
  const [done, setDone] = useState(false);
  const bootstrap = makeBootstrap(claimed);
  (window as any).__ROOKIE_BOOTSTRAP_B = makeBootstrap(true);
  if (done) return <div data-testid="journey-done" style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: '#07100e', color: 'white' }}>JOURNEY COMPLETE</div>;
  return <GuidedFirstSession bootstrap={bootstrap} onCollect={() => setClaimed(true)} onComplete={() => setDone(true)} />;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient()}>
  <Journey />
</QueryClientProvider>);
