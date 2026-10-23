import type { ReactNode } from 'react';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import { cardCatalog, starterRecipes } from '../../data';
import { STREET_PACK_RULES } from '@workspace/squabblemon-engine/packRules';
import { readPreviewDecks } from '../../lib/previewDecks';

// Offline fallback bootstrap used when VITE_E2E_AUTH=true and the API server
// isn't running. Lets the entire /game shell render so QA can exercise every
// route without a live Postgres + Clerk stack. The shape mirrors the API
// contract in @workspace/api-client-react so the typed components stay happy.
export function getE2EBootstrap(): PlayerBootstrap {
  // The local preview must allow testing expansion cards as well as starter crews.
  const allCardIds = cardCatalog.map(card => card.catalogId);
  const equippedVariants: Record<string, string> = {};
  const cardProgression: Record<string, { xp: number; level: number }> = {};
  for (const cardId of allCardIds) {
    cardProgression[cardId] = { xp: 0, level: 1 };
  }
  const now = new Date().toISOString();
  return {
    profile: {
      id: 'e2e-player',
      displayName: 'Test Player',
      avatarKey: 'cornball',
      onboardingStep: 'complete',
      starterDeckId: starterRecipes[0]?.id ?? null,
      streetRep: 0,
      xp: 0,
      level: 1,
      softCurrency: 500,
      packTickets: 3,
      styleShards: 0,
      packPity: 0,
      deckSlots: 4,
      cosmeticCurrency: 0,
      collectionProgress: 0,
      storyChapter: 0,
      storyNode: 0,
      tutorialCompleted: true,
      starterRewardClaimed: true,
      ageConfirmedAt: now,
      termsAcceptedAt: now,
      settings: { reducedMotion: false, turnTimerEnabled: true },
      ownedCardIds: allCardIds,
      cardProgression,
      discoveredCardIds: allCardIds,
      ownedVariants: [],
      equippedVariants,
      unlockedCosmeticIds: [],
      unlockedCharacterIds: [],
      savedDecks: readPreviewDecks(),
      storyProgress: {},
      inbox: [],
      packHistory: [],
      lastActiveAt: now,
    },
    missions: [],
    nextAction: {
      id: 'e2e-next',
      eyebrow: 'Tonight',
      title: 'Run the block',
      description: 'Take two of three districts in an offline practice fade.',
      destination: 'play',
      rewardLabel: null,
    },
    packConfig: {
      id: 'e2e-pack',
      name: 'Practice Pack',
      oddsVersion: 'e2e',
      softCurrencyCost: STREET_PACK_RULES.single.softCurrencyCost,
      ticketCost: STREET_PACK_RULES.single.ticketCost,
      rewardsPerPack: STREET_PACK_RULES.single.rewards,
      pityLimit: STREET_PACK_RULES.pityLimit,
      odds: [],
    },
    tenPullConfig: {
      id: 'e2e-ten-pull',
      name: 'Practice Ten Pull',
      oddsVersion: 'e2e',
      pullCount: 10,
      ticketCost: STREET_PACK_RULES.ten.ticketCost,
      softCurrencyCost: STREET_PACK_RULES.ten.softCurrencyCost,
      rewardsPerPull: STREET_PACK_RULES.single.rewards,
      rarePityBonusPerPull: 1,
    },
    collectionRoad: [],
  };
}


export default function E2EGamePreview({ children }: { children: (bootstrap: PlayerBootstrap) => ReactNode }) {
  return children(getE2EBootstrap());
}
