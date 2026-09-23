import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Battle } from '../src/components/Battle';
import { CardInspector } from '../src/components/CardInspector';
import {
  createCardInstance,
  createMatch,
  playTurnCard,
  type CardInstance,
  type Lane,
} from '../src/gameEngine';
import { decks } from '../src/data';
import '../src/index.css';

const ids = [
  'inmate-crafty',
  'inmate-boyfriend',
  'inmate-informant',
  'inmate-contraband',
  'lebron-james',
];

function Fixture() {
  const [match, setMatch] = useState(() => {
    const initial = createMatch('block', 'vibes');
    initial.playerMotion = 30;
    initial.playerHand = ids.map((id, index) =>
      createCardInstance(id, 'player', 'cellblock-wave', index)
    );
    const support = createCardInstance('bustdown', 'player', 'cellblock-wave-setup', 20);
    const spreadInmate = createCardInstance('inmate-contraband', 'player', 'cellblock-wave-setup', 21);
    support.lane = 0;
    spreadInmate.lane = 1;
    initial.boards = [[support], [spreadInmate], []];
    return initial;
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [lane, setLane] = useState<Lane | null>(null);
  const [squabble, setSquabble] = useState(false);
  const [inspect, setInspect] = useState<CardInstance | null>(null);

  const play = (instanceId: string, target: Lane, armed: boolean) => {
    setMatch(current => playTurnCard(current, 'player', instanceId, target, armed));
    setSelected(null);
    setLane(null);
    setSquabble(false);
  };

  return <main style={{ height: '100dvh', color: 'white', background: '#080808' }}>
    <output
      data-testid="cellblock-board-count"
      data-count={match.boards.flat().filter(card => ids.includes(card.cardId)).length}
      style={{ position: 'fixed', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}
    />
    <output
      data-testid="cellblock-sequencing-state"
      data-crafty-power={match.boards.flat().find(card => card.cardId === 'inmate-crafty')?.powerModifier ?? ''}
      data-spread-inmate-power={match.boards[1].find(card => card.cardId === 'inmate-contraband')?.powerModifier ?? ''}
      data-boyfriend-targets={match.effectLog
        .filter(event => event.cardId === 'inmate-boyfriend' && event.type === 'ability')
        .flatMap(event => event.targets.map(target => target.cardInstanceId))
        .join(',')}
      style={{ position: 'fixed', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}
    />
    <Battle
      match={match}
      deck={decks[0]}
      rivalDeck={decks[1]}
      selectedInstanceId={selected}
      setSelectedInstanceId={setSelected}
      selectedLane={lane}
      setSelectedLane={setLane}
      squabble={squabble}
      setSquabble={setSquabble}
      onPlayCard={play}
      commit={() => { if (selected && lane !== null) play(selected, lane, squabble); }}
      presentationPhase="player-ready"
      phaseMessage="Cellblock wave engine verification"
      timerEnabled={false}
      setInspect={setInspect}
      onShowRules={() => {}}
    />
    {inspect && <CardInspector card={inspect} match={match} onClose={() => setInspect(null)} />}
  </main>;
}

const root = createRoot(document.getElementById('root')!);
root.render(<QueryClientProvider client={new QueryClient()}><Fixture /></QueryClientProvider>);
import.meta.hot?.dispose(() => root.unmount());