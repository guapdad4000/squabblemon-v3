import React, { Profiler, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LayoutGroup, MotionConfig } from 'framer-motion';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Battle } from '../src/components/Battle';
import { createCardInstance, createMatch } from '../src/gameEngine';
import { decks } from '../src/data';
import '../src/index.css';

const noop = () => {};
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
let commits = 0;

function Fixture() {
  const [match, setMatch] = useState(() => createMatch('block', 'combo'));
  const [selected, setSelected] = useState<string | null>(null);
  const [lane, setLane] = useState<number | null>(null);
  const [squabble, setSquabble] = useState(false);
  // A fresh instance exercises the actual draw path, which the six-round performance
  // script does not cover when its opening hand already holds all twelve plays.
  (window as any).__battleDrawReview = {
    commits: () => commits,
    removeFirst: () => setMatch(previous => ({ ...previous, playerHand: previous.playerHand.slice(1) })),
    draw: () => setMatch(previous => ({
      ...previous,
      playerHand: [...previous.playerHand, createCardInstance('barber', 'player', 'draw-review', previous.playerHand.length)],
    })),
  };
  return <MotionConfig reducedMotion="user"><LayoutGroup><Profiler id="draw-review" onRender={() => { commits++; }}>
    <div style={{ width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <Battle match={match} deck={decks.find(deck => deck.id === match.playerDeck)} rivalDeck={decks.find(deck => deck.id === match.cpuDeck)}
        selectedInstanceId={selected} setSelectedInstanceId={setSelected} selectedLane={lane} setSelectedLane={setLane}
        squabble={squabble} setSquabble={setSquabble} commit={noop} skipSequence={noop}
        presentationPhase="player-ready" phaseMessage="Choose a fighter" timerSeconds={20} timerEnabled={false}
        impactLane={null} stagedRival={null} stagedPlayer={null} activeEffectId={null} activeEffectLane={null} activeEffect={null}
        presentationScores={null} setInspect={noop} archiveMatch={noop} onShowRules={noop} feedbackPreferences={{ audioEnabled: false }} />
    </div>
  </Profiler></LayoutGroup></MotionConfig>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={queryClient}><Fixture /></QueryClientProvider>);
