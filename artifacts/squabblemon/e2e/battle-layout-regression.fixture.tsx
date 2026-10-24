import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatePresence, LayoutGroup, MotionConfig, visualElementStore } from 'framer-motion';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Battle, type OnlineBattlePresentation } from '../src/components/Battle';
import { CardInspector } from '../src/components/CardInspector';
import type { PresentationPhase } from '../src/components/PlayLoop';
import { createCardInstance, createMatch, getDistrictResults, getMatchDistricts, type CardInstance, type Match } from '../src/gameEngine';
import { decks } from '../src/data';
import '../src/index.css';

const noop = () => {};
const badgeFixture = new URLSearchParams(location.search).has('badges');
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const initialMatch = () => {
  const match = createMatch('block', 'combo');
  match.boards = [0, 1, 2].map(lane => ['player', 'cpu'].flatMap(owner =>
    ['cornball', 'barber', 'streamer'].map((id, index) => createCardInstance(id, owner as 'player' | 'cpu', `layout-${lane}`, index)),
  )) as Match['boards'];
  return match;
};

function Fixture() {
  const [match, setMatch] = useState(initialMatch);
  const [phase, setPhase] = useState<PresentationPhase>('player-ready');
  const [inspect, setInspect] = useState<CardInstance | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [lane, setLane] = useState<number | null>(null);
  const [squabble, setSquabble] = useState(false);
  const [badgeValue, setBadgeValue] = useState<number | null>(null);
  const online: OnlineBattlePresentation | undefined = badgeFixture ? {
    districts: getMatchDistricts(match), scores: getDistrictResults(match),
    costs: Object.fromEntries(match.playerHand.map(card => [card.instanceId, [card.cost, card.cost, card.cost]])),
    lockedLanes: [], covered: new Set(), history: [], turnSeconds: 20, clockRunning: false,
    yourTurn: phase === 'player-ready', mode: 'ranked', status: 'Layout review', rivalHandCount: 3,
    districtMarks: badgeValue === null ? [] : [{ owner: 'player', lane: 0, artworkId: 'seed', text: `Seed ${badgeValue}`, progress: { current: badgeValue, total: 3 } }],
  } : undefined;
  (window as any).__battleLayoutStore = visualElementStore;
  (window as any).__battleLayoutReview = {
    phase: setPhase,
    badge: setBadgeValue,
    add: (owner: 'player' | 'cpu' = 'player') => setMatch(previous => ({ ...previous,
      boards: previous.boards.map((cards, i) => i ? cards : [...cards, createCardInstance('cornball', owner, 'layout-add', cards.length)]) as Match['boards'],
    })),
    removeLast: () => setMatch(previous => ({ ...previous, boards: [previous.boards[0].slice(0, -1), ...previous.boards.slice(1)] as Match['boards'] })),
    reverse: () => setMatch(previous => ({ ...previous, boards: [[...previous.boards[0]].reverse(), ...previous.boards.slice(1)] as Match['boards'] })),
  };
  return <MotionConfig reducedMotion="user">
    <LayoutGroup><div style={{ width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <Battle online={online} match={match} deck={decks.find(deck => deck.id === match.playerDeck)} rivalDeck={decks.find(deck => deck.id === match.cpuDeck)}
        selectedInstanceId={selected} setSelectedInstanceId={setSelected} selectedLane={lane} setSelectedLane={setLane}
        squabble={squabble} setSquabble={setSquabble} commit={noop} skipSequence={noop}
        presentationPhase={phase} phaseMessage="Layout review" timerSeconds={20} timerEnabled={false}
        impactLane={null} stagedRival={null} stagedPlayer={null} activeEffectId={null} activeEffectLane={null} activeEffect={null}
        presentationScores={null} setInspect={setInspect} archiveMatch={noop} onShowRules={noop} feedbackPreferences={{ audioEnabled: false }} />
    </div></LayoutGroup>
    {/* Keep the real inspector outside the board group, exactly as PlayLoop does. */}
    <AnimatePresence>{inspect && <CardInspector card={inspect} match={match} onClose={() => setInspect(null)} />}</AnimatePresence>
  </MotionConfig>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={queryClient}><Fixture /></QueryClientProvider>);
