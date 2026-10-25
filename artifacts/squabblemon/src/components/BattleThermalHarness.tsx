import { Profiler, useLayoutEffect, useRef, useState } from 'react';
import { LayoutGroup, MotionConfig } from 'framer-motion';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createCardInstance, createMatch, type CardInstance, type Lane } from '../gameEngine';
import { decks } from '../data';
import { Battle } from './Battle';
import { CardInspector } from './CardInspector';

const noop = () => {};
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const roster = ['hooper', 'cornball', 'barber', 'plug', 'wifey', 'snow', 'guap', 'leroy', 'shonuff', 'drfade', 'roaster', 'landlord'];

/** Production-profiling-only workload: actual battle render, synthetic repeatable board. */
export function BattleThermalHarness() {
  const [match] = useState(() => {
    const query = new URLSearchParams(location.search);
    const count = Math.max(0, Math.min(24, Number(query.get('count') ?? 10)));
    const m = createMatch('block', 'combo');
    m.round = 6;
    m.playerMotion = 20;
    m.playerHand = ['barber', 'cornball', 'snow', 'wifey', 'plug', 'hooper', 'roaster'].map((id, i) => createCardInstance(id, 'player', 'thermal-hand', i));
    m.boards = ([0, 1, 2] as Lane[]).map(lane => {
      // count=10 means 10 cards total; count=24 means 24 per lane, 72 total.
      const total = count <= 12 ? Math.floor(count / 3) + (lane < count % 3 ? 1 : 0) : count;
      return Array.from({ length: total }, (_, i) => {
        const owner = i % 2 === 0 ? 'player' : 'cpu';
        const card = { ...createCardInstance(roster[Math.floor(i / 2) % roster.length], owner, `thermal-${lane}`, i), lane };
        if (query.has('status') && i % 3 === 0) card.statuses.burnStacks = 1;
        if (query.has('status') && i % 5 === 1) card.statuses.protected = true;
        return card;
      });
    }) as typeof m.boards;
    return m;
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [lane, setLane] = useState<Lane | null>(null);
  const [squabble, setSquabble] = useState(false);
  const [inspect, setInspect] = useState<CardInstance | null>(null);
  const stats = useRef({ commits: 0, durationMs: 0 });
  useLayoutEffect(() => {
    (window as any).__battleThermal = {
      ready: true,
      stats: () => ({ ...stats.current }),
      reset: () => { stats.current = { commits: 0, durationMs: 0 }; },
      closeInspect: () => setInspect(null),
      cards: match.boards.flat().map(c => c.instanceId),
    };
  });
  return <QueryClientProvider client={queryClient}><MotionConfig reducedMotion="user"><LayoutGroup>
    <Profiler id="thermal-battle" onRender={(_id, _phase, duration) => { stats.current.commits++; stats.current.durationMs += duration; }}>
      <div data-testid="battle-thermal-harness" style={{ width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <Battle match={match} deck={decks.find(d => d.id === match.playerDeck)} rivalDeck={decks.find(d => d.id === match.cpuDeck)}
          selectedInstanceId={selected} setSelectedInstanceId={setSelected} selectedLane={lane} setSelectedLane={setLane}
          squabble={squabble} setSquabble={setSquabble} commit={noop} skipSequence={noop}
          presentationPhase="player-ready" phaseMessage="Choose a fighter" timerSeconds={20} timerEnabled={false}
          impactLane={null} stagedRival={null} stagedPlayer={null} activeEffectId={null} activeEffectLane={null} activeEffect={null}
          presentationScores={null} setInspect={setInspect} archiveMatch={noop} onShowRules={noop} feedbackPreferences={{ audioEnabled: false }} />
      </div>
      {inspect && <CardInspector card={inspect} match={match} onClose={() => setInspect(null)} />}
    </Profiler>
  </LayoutGroup></MotionConfig></QueryClientProvider>;
}
