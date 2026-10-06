import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { Battle, type OnlineBattlePresentation } from '../src/components/Battle';
import { CardInspector } from '../src/components/CardInspector';
import { createMatch, createCardInstance, playCard, playTurnCard, getMatchDistricts, getDistrictResults, type CardInstance, type Lane } from '../src/gameEngine';
import { decks } from '../src/data';
import { DISTRICT_CATALOG, validateDistrictSnapshot } from '@workspace/squabblemon-engine/districts';
import '../src/index.css';
const noop = () => {};
function App() {
  const [match, setMatch] = useState(() => {
    const requestedLocations = new URLSearchParams(location.search).get('locations');
    const snapshot = requestedLocations ? validateDistrictSnapshot({ version: 1, locations: requestedLocations.split(',').map(id => DISTRICT_CATALOG.find(district => district.id === id)) }) : undefined;
    const m = createMatch('block', 'combo', undefined, undefined, snapshot);
    m.playerMotion = 20;
    m.playerHand = ['barber', 'cornball', 'snow', 'wifey', 'plug', 'hooper', 'roaster'].map((id, i) => createCardInstance(id, 'player', 'hand', i));
    m.boards = ([0, 1, 2] as Lane[]).map(lane => (['cpu', 'player'] as const).flatMap(owner =>
      ['hooper', 'cornball', 'barber', 'plug', 'wifey', 'snow'].slice(0, lane === 0 ? 4 : lane === 1 ? 1 : 6).map((id, i) => {
        const card = { ...createCardInstance(id, owner, `lane-${lane}`, i), lane };
        if (lane === 0 && i === 0) card.statuses.frozen = true;
        if (lane === 0 && i === 2) card.statuses.protected = true;
        return card;
      })));
    return m;
  });
  const [selected, setSelected] = useState<string | null>(null), [lane, setLane] = useState<Lane | null>(null);
  const [squabble, setSquabble] = useState(false), [inspect, setInspect] = useState<CardInstance | null>(null);
  const query = new URLSearchParams(location.search);
  const effectMode = query.has('effect');
  const online: OnlineBattlePresentation | undefined = query.has('pvp') ? {
    playerIdentity: { name: 'Your corner', hero: 'barber' },
    rivalIdentity: { name: 'Slide Thru', hero: 'hooper' },
    districts: getMatchDistricts(match), scores: getDistrictResults(match), costs: {},
    lockedLanes: [], covered: new Set(), history: [], turnSeconds: 20, clockRunning: true,
    yourTurn: true, mode: 'ranked', status: 'Connected', rivalHandCount: 7,
  } : undefined;
  const [phase, setPhase] = useState(query.get('phase') ?? (effectMode ? 'effects' : 'player-ready'));
  const [fast, setFast] = useState(query.has('fast'));
  (window as any).__battleHudFixture = { setPhase };
  const resolved = effectMode ? playCard(match, 'player', match.playerHand[0].instanceId, 0) : match;
  const event = effectMode ? resolved.effectLog.find(e => e.type === 'ability' && e.cardId === 'barber') : null;
  const effect = event ? { ...event, targetIds: event.targets.map(t => t.cardInstanceId), impact: true } : null;
  const play = (id: string, lane: Lane, squabble: boolean) => { setMatch(m => playTurnCard(m, 'player', id, lane, squabble)); setSelected(null); setLane(null); };
  return <div style={{ height: '100dvh' }}><Battle match={resolved} deck={decks[0]} rivalDeck={query.has('long-name') ? { ...decks[1], name: 'The Extremely Long Rival Crew Name' } : decks[1]} online={online}
    selectedInstanceId={selected} setSelectedInstanceId={setSelected} selectedLane={lane} setSelectedLane={setLane}
    squabble={squabble} setSquabble={setSquabble} onPlayCard={play} commit={() => { if (selected && lane !== null) play(selected, lane, squabble); }}
    endTurn={noop} skipSequence={() => setPhase('player-ready')} battleSpeed={fast ? 1.5 : 1} onToggleBattleSpeed={() => setFast(value => !value)} presentationPhase={phase} phaseMessage={event?.note ?? 'Choose a card and district'}
    timerSeconds={Number(query.get('timer') ?? 20)} timerEnabled={!effectMode && !query.has('no-timer')} impactLane={event ? 0 : null} activeEffect={effect} activeEffectId={event?.cardInstanceId}
    activeEffectLane={event ? 0 : null} presentationScores={event?.scores.after} setInspect={setInspect} onShowRules={noop} />
    {inspect && <CardInspector card={inspect} match={resolved} onClose={() => setInspect(null)} />}
  </div>;
}
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={queryClient}><App /></QueryClientProvider>);
