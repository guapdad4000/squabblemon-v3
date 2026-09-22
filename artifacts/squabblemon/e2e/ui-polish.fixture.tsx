import { ParkResult } from '../src/components/ParkResult';
import { RankLadder } from '../src/components/RankArtwork';
import { Dialog } from '../src/components/ui/dialog';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ResultArtwork } from '../src/components/ResultArtwork';
import { MatchArrival } from '../src/components/MatchArrival';
import { DrFadeWelcome } from '../src/components/DrFadeWelcome';
import { MusicControls } from '../src/components/MusicControls';
import { NodeOverlay } from '../src/pages/game/Story';
import { Decks } from '../src/pages/game/Decks';
import { Home } from '../src/pages/game/Home';
import { ThemeProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../src/index.css';
import '../src/styles/studio.css';
import '../src/styles/result-stage.css';
import '../src/styles/story-briefing.css';
import '../src/styles/venue.css';

const queryClient = new QueryClient();

const mode = new URLSearchParams(location.search).get('mode');
const action = (name: string) => () => { document.body.dataset.action = name };

const mockBootstrap: any = {
  profile: {
    id: 'e2e-player',
    username: 'Tester',
    level: 5,
    streetRep: 100,
    clout: 50,
    deckSlots: 3,
    savedDecks: [],
    ownedCardIds: ['dorothy', 'powerhouse', 'drfade', 'snitch', 'big-boss', 'hot-streak', 'payday'],
    equippedVariants: {},
    settings: {
      reducedMotion: false,
    },
  },
  missions: [],
};

const mockCampaign: any = {
  chapters: [{ id: 'red-side-tapes', title: 'Chapter 2' }],
  recommendedNodeId: 'red-tapes-red-side-open',
  nodes: [
    {
      nodeId: 'red-tapes-red-side-open',
      chapterId: 'red-side-tapes',
      title: 'First Battle',
      kind: 'battle',
      status: 'available',
      stars: 0,
      cleared: false,
      mapPosition: { x: 50, y: 50 },
      prerequisites: [],
      optional: false,
      dialogueSeen: Array.from({length: 15}).map((_, i) => `red-tapes-red-side-open:script-v3:pre:${i}`),
    }
  ]
};

// Expose React Query context for components that need it
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" disableTransitionOnChange>
      {children}
    </ThemeProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById('root')!).render(
  <TestWrapper>
    {mode?.startsWith('ranked-') ? (
      <Dialog open>
        <ParkResult
          outcome={mode === 'ranked-loss' ? 'loss' : mode === 'ranked-draw' ? 'draw' : 'win'}
          ranked
          rank={{ before: mode === 'ranked-loss' ? 120 : 95, after: mode === 'ranked-loss' ? 105 : mode === 'ranked-draw' ? 100 : 120, delta: mode === 'ranked-loss' ? -15 : mode === 'ranked-draw' ? 5 : 25, tier: 'Bronze', outcome: mode === 'ranked-loss' ? 'loss' : mode === 'ranked-draw' ? 'draw' : 'win', bot: false }}
          claimed={mode === 'ranked-loss' ? 1 : 2}
          rivalClaimed={mode === 'ranked-loss' ? 2 : 1}
          description="Six rounds. Three districts."
        >
          <button className="venue-button" onClick={action('park')}>Back to Fade Park</button>
          <button className="venue-button venue-button--gold" onClick={action('inspect')}>Inspect final board</button>
        </ParkResult>
      </Dialog>
    ) : mode === 'arrival' ? (
      <MatchArrival player={{ name: 'GuapDad', hero: 'folks' }} rival={{ name: 'Park Bot', hero: 'big-boss' }} label="Park Bot found · ranked sparring" onContinue={action('enter')} />
    ) : mode === 'music' ? (
      <div className="h-screen w-full bg-black p-10 flex items-start justify-center">
        <MusicControls variant="dj" />
      </div>
    ) : mode === 'story-node' ? (
      <NodeOverlay nodeId="red-tapes-red-side-open" campaign={mockCampaign} onClose={action('close')} onStartBattle={action('start')} />
    ) : mode === 'decks' ? (
      <div className="h-screen"><Decks bootstrap={mockBootstrap} /></div>
    ) : mode === 'safehouse' ? (
      <div className="h-screen"><Home bootstrap={mockBootstrap} /></div>
    ) : (
      <div className="result-stage result-stage--art">
        <ResultArtwork
          victory={mode !== 'loss'}
          draw={false}
          results={[{ player: 24, cpu: 12, winner: 'player' }, { player: 8, cpu: 18, winner: 'cpu' }, { player: 30, cpu: 23, winner: 'player' }]}
          districts={[{ name: 'The Bodega' }, { name: 'The Subway' }, { name: 'Fade Park' }]}
          reward={{ softCurrency: 120, xp: 80, streetRep: 12 } as any}
          onRegroup={action('regroup')}
          onTrain={action('retry')}
          onRebuild={action('rebuild')}
          actions={
            <nav className="result-stage__actions">
              <button className="venue-button venue-button--gold" onClick={action('continue')}>Continue the fade</button>
              <button className="venue-button" onClick={action('rebuild')}>Rebuild the deck</button>
            </nav>
          }
        />
      </div>
    )}
  </TestWrapper>
);
