import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import { ROOKIE_CORE_IDS, ROOKIE_DECK_ID, ROOKIE_FOUNDATION_ID } from '../src/data';
import { RookieHandoff } from '../src/pages/game/GuidedFirstSession';
import { FirstDeckWorkshop } from '../src/pages/game/FirstDeckWorkshop';
import '../src/index.css';
import '../src/styles/venue.css';
import '../src/styles/deck-workshop.css';

// These are the real review components, with a completed saved ten-card crew.
// The constrained shell duplicates GameApp's game-shell > content > HUD > stage
// height/flex structure; no overflowing body can rescue a clipped action.
const screen = new URLSearchParams(location.search).get('screen');
const shell = new URLSearchParams(location.search).get('shell') !== 'none';
const bootstrap = {
  profile: {
    id: 'review-scroll-fixture',
    displayName: 'ROOKIE',
    avatarKey: 'rookie',
    onboardingStep: 'reward',
    starterDeckId: ROOKIE_FOUNDATION_ID,
    streetRep: 0,
    xp: 0,
    level: 1,
    softCurrency: 0,
    packTickets: 0,
    styleShards: 0,
    packPity: 0,
    deckSlots: 3,
    cosmeticCurrency: 0,
    collectionProgress: ROOKIE_CORE_IDS.length,
    storyChapter: 1,
    storyNode: 0,
    tutorialCompleted: true,
    starterRewardClaimed: false,
    ageConfirmedAt: '2026-09-08T00:00:00.000Z',
    termsAcceptedAt: '2026-09-08T00:00:00.000Z',
    settings: { reducedMotion: true, turnTimerEnabled: false },
    ownedCardIds: [...ROOKIE_CORE_IDS],
    discoveredCardIds: [...ROOKIE_CORE_IDS],
    ownedVariants: [],
    equippedVariants: {},
    cardProgression: {},
    unlockedCosmeticIds: [],
    unlockedCharacterIds: [],
    savedDecks: [{ id: ROOKIE_DECK_ID, name: 'My First Gang', cardIds: [...ROOKIE_CORE_IDS], heroCardId: 'hooper', recipeId: null, valid: true, issues: [] }],
    storyProgress: {},
    inbox: [],
    packHistory: [],
    lastActiveAt: '2026-09-08T00:00:00.000Z',
  },
  missions: [],
  nextAction: {
    id: screen === 'review' ? 'rookie-tested' : 'rookie-reward',
    eyebrow: 'Rookie Road', title: 'Choose your next step', description: 'Your saved crew is ready.',
    destination: 'onboarding', rewardLabel: null,
  },
  packConfig: {
    id: 'street-pack', name: 'Street Pack', oddsVersion: 'review-fixture-v1',
    softCurrencyCost: 500, ticketCost: 1, rewardsPerPack: 3, pityLimit: 10, odds: [],
  },
  tenPullConfig: {
    id: 'review-ten-pull', name: 'Ten Pull', oddsVersion: 'review-fixture-v1',
    pullCount: 10, ticketCost: 9, softCurrencyCost: 1800, rewardsPerPull: 3, rarePityBonusPerPull: 1,
  },
  collectionRoad: [],
} as PlayerBootstrap;

function ReviewFixture() {
  const [action, setAction] = useState('');
  const content = screen === 'handoff'
    ? <RookieHandoff onReview={() => setAction('review')} onComplete={() => setAction('complete')} />
    : <FirstDeckWorkshop bootstrap={bootstrap} onComplete={() => setAction('complete')} />;

  return <>
    {shell
      ? <div className="game-shell game-shell--compact-nav h-[100dvh]">
          <div className="game-shell__content">
            <div className="venue-hud" aria-label="Player header">ROOKIE ROAD</div>
            <div className="game-route-stage">{content}</div>
          </div>
        </div>
      : content}
    <output data-testid="rookie-review-scroll-action" hidden>{action}</output>
  </>;
}

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={new QueryClient()}><ReviewFixture /></QueryClientProvider>,
);