import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createAbilityUpgradeSnapshot } from '@workspace/squabblemon-engine/abilityUpgrades';
import { createDistrictSnapshot } from '@workspace/squabblemon-engine/districts';
import { getStoryBattle } from '@workspace/squabblemon-engine/story';
import { decks } from '../src/data';
import { verifyMatchTranscript, verifyStoryMatchTranscript } from '../src/gameEngine';
import { RewardStinger } from '../src/components/RewardStinger';
import { PlayLoop } from '../src/components/PlayLoop';
import '../src/index.css';

const query = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
const params = new URLSearchParams(location.search);
const mode = params.get('mode') === 'story' ? 'story' : 'practice';
const trainingCircuit = params.get('training') === 'true';
const playerDeck = decks.find(deck => deck.id === 'block')!;
const rivalDeck = decks.find(deck => deck.id === 'combo')!;
const storyEncounter = getStoryBattle('welcome-to-the-block')!.encounter;
const districtSnapshot = createDistrictSnapshot('task-265-broadcast-proof');

function matchContract(selectedMode: 'story' | 'practice') {
  const storyMode = selectedMode === 'story';
  const rivalId = storyMode ? storyEncounter.enemy.deckId : rivalDeck.id;
  const rivalCards = storyMode ? storyEncounter.enemy.cardIds : rivalDeck.cards;
  const upgrades = createAbilityUpgradeSnapshot(playerDeck.cards, rivalCards);
  return {
    playerDeckId: playerDeck.id,
    playerCards: playerDeck.cards,
    rivalDeckId: rivalId,
    encounter: storyMode ? storyEncounter : null,
    upgrades,
    districts: districtSnapshot,
  };
}

function Fixture() {
  (window as Window & { broadcastBattle?: unknown }).broadcastBattle = {
    verified: () => document.documentElement.dataset.completionVerified === 'true',
    contract: matchContract,
    warmRewardStinger: async () => RewardStinger,
    verify: (selectedMode: 'story' | 'practice', moves: unknown[]) => {
      const contract = matchContract(selectedMode);
      const match = selectedMode === 'story'
        ? verifyStoryMatchTranscript(contract.encounter!, contract.playerDeckId, moves as never[], undefined, contract.upgrades, contract.districts)
        : verifyMatchTranscript(contract.playerDeckId, rivalDeck.id, moves as never[], contract.upgrades, contract.playerCards, contract.districts);
      return { phase: match.phase, round: match.round };
    },
  };
  return <div style={{ height: '100dvh', minHeight: 640 }}>
    <PlayLoop mode={mode} trainingCircuit={trainingCircuit} storyNodeId={mode === 'story' ? 'welcome-to-the-block' : undefined}
      initialDeckId="block" initialRivalId="combo" hideLobby turnTimerEnabled={false}
      onVerifiedComplete={() => { document.documentElement.dataset.completionVerified = 'true'; }}
      onExit={() => { document.documentElement.dataset.exit = 'true'; }} />
  </div>;
}

createRoot(document.getElementById('root')!).render(<QueryClientProvider client={query}><Fixture /></QueryClientProvider>);