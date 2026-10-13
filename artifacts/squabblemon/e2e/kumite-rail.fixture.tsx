import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router } from 'wouter';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import { KumiteShortcut } from '../src/components/kumite/KumiteShortcut';
import { StarterMythic } from '../src/components/StarterMythic';
import { GameNav } from '../src/components/venue/GameNav';
import { getAssetUrl } from '../src/lib/assets';
import '../src/index.css';
import '../src/styles/safehouse-stage.css';

const bootstrap = { profile: { id: 'kumite-rail-review', settings: { reducedMotion: true }, onboardingStep: 'complete' }, missions: [] } as unknown as PlayerBootstrap;
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const fixtureLocation = (): [string, (path: string) => void] => ['/game', () => {}];

// Actual shortcuts, actual fan navigation and source production CSS. The room
// is represented by its canonical static poster so this isolated layout check
// does not substitute for the native Home scene's own camera tests.
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><Router hook={fixtureLocation}>
  <div className="game-shell game-shell--fan" style={{ height: '100dvh' }}>
    <div className="game-shell__content" style={{ height: '100%' }}><div className="game-route-stage" style={{ height: '100%' }}>
      <main className="safehouse safehouse-stage" style={{ position: 'relative', width: '100%' }}>
        <img src={getAssetUrl('scenes/safehouse/concept.webp')} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
        <div className="safehouse__shade" />
        <header className="safehouse-room-header"><div className="safehouse-room-title"><span>SQUABBLEMON · SAFEHOUSE</span><h1>Home court.</h1></div></header>
        <a className="safehouse-bounty-logo" href="#bounties" aria-label="Open bounties"><img src={getAssetUrl('assets/bounty-hunter/hero.webp')} alt="" /></a>
        <StarterMythic bootstrap={bootstrap} placement="shortcut" />
        <KumiteShortcut />
      </main>
    </div></div>
    <GameNav bootstrap={bootstrap} />
  </div>
</Router></QueryClientProvider>);
