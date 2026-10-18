import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import { KUMITE_CARD_REWARDS } from '@workspace/squabblemon-engine/data';
import { CardInspector } from '../src/components/CardInspector';
import { KumiteRewards } from '../src/components/kumite/KumiteRewards';
import { cards, catalogCardById } from '../src/data';
import '../src/index.css';
import '../src/styles/kumite.css';

const locked = new URLSearchParams(location.search).has('locked');
const profile = { id: 'film-fixture', ownedCardIds: locked ? [] : ['undercova-brotha'],
  ownedVariants: [], equippedVariants: {}, cardProgression: {}, styleShards: 0, softCurrency: 0,
  unlockedCosmeticIds: [], settings: { reducedMotion: true }, savedDecks: [] };
const bootstrap = { profile, missions: [] } as unknown as PlayerBootstrap;
const progression = { completedMatches: 5, matchWins: 5, championships: 0,
  rewards: KUMITE_CARD_REWARDS.map(reward => ({ ...reward, progress: 5,
    name: catalogCardById[reward.cardId].name, claimed: !locked && reward.cardId === 'undercova-brotha',
    owned: profile.ownedCardIds.includes(reward.cardId) })) };
const client = new QueryClient();
function Fixture() {
  const [inspect, setInspect] = useState(false);
  return <QueryClientProvider client={client}><main className="kumite-page">
    <button onClick={() => setInspect(true)}>Open Collection inspector</button>
    {inspect && <CardInspector card={cards[catalogCardById['undercova-brotha'].engineId]} bootstrap={bootstrap} onClose={() => setInspect(false)} />}
    <KumiteRewards progression={progression} />
  </main></QueryClientProvider>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
