import React, { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import { KumiteUnlockGate } from '../src/components/kumite/KumiteUnlockGate';
import { RewardReveal } from '../src/components/RewardReveal';
import { rewardReceipts } from '../src/lib/rewardReceipts';
import { setBattleActive } from '../src/lib/imageWarmup';

const params = new URLSearchParams(location.search);
const route = memoryLocation({ path: params.has('battle') ? '/game/battle' : '/game' });
if (params.has('battle')) setBattleActive(true);
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const bootstrap = { profile: { id: 'local-film-owner', onboardingStep: 'complete' } } as PlayerBootstrap;
function Fixture() {
  const [signedIn, setSignedIn] = useState(true);
  return <QueryClientProvider client={client}><Router hook={route.hook}>
    <main><h1>Local unlock fixture</h1>
      <button onClick={() => { setBattleActive(false); route.navigate('/game'); }}>Return to Safehouse</button>
      <button onClick={() => { setBattleActive(true); route.navigate('/game/battle'); }}>Start battle</button>
      <button onClick={() => { setSignedIn(false); rewardReceipts.reset(); }}>Sign out</button>
      <button onClick={() => void client.invalidateQueries({ queryKey: ['kumite-film-receipts'] })}>Refresh receipts</button>
      <RewardReveal />{signedIn && <KumiteUnlockGate key={bootstrap.profile.id} bootstrap={bootstrap} />}
    </main>
  </Router></QueryClientProvider>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Fixture /></StrictMode>);
