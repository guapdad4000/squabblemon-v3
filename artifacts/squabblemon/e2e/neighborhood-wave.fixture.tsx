import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Battle } from '../src/components/Battle';
import { CardInspector } from '../src/components/CardInspector';
import { CardView } from '../src/components/CardView';
import { asCard } from '../src/components/MultiplayerBattle';
import {
  applyOnlineCommand,
  createOnlineRoom,
  joinOnlineRoom,
  onlineRoomView,
} from '@workspace/squabblemon-engine/multiplayer';
import {
  createCardInstance,
  createMatch,
  getEffectiveCardPower,
  playTurnCard,
  type CardInstance,
  type Lane,
} from '../src/gameEngine';
import { decks } from '../src/data';
import '../src/index.css';
import '../src/styles/multiplayer.css';

function authoritativeProjection(match: ReturnType<typeof createMatch>) {
  const now = Date.now();
  const deck = decks[0];
  let room = joinOnlineRoom(
    createOnlineRoom({ userId: 'host', name: 'Host', ready: false, deck }, 'player', now),
    { userId: 'guest', name: 'Guest', ready: false, deck },
    now,
  );
  room = applyOnlineCommand(room, 'player', { type: 'ready' }, now);
  room = applyOnlineCommand(room, 'cpu', { type: 'ready' }, now);
  room = { ...room, match };
  const publicPowered = onlineRoomView(room, 'WAVE', 'host', now).boards
    .flat()
    .find(card => card.cardId === 'luigion');
  return publicPowered ? asCard(publicPowered) : null;
}

function Fixture() {
  const [match, setMatch] = useState(() => {
    const initial = createMatch('block', 'vibes');
    initial.playerMotion = 12;
    initial.playerHand = ['demario', 'luigion'].map((id, index) =>
      createCardInstance(id, 'player', 'neighborhood-wave', index)
    );
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
  const powered = match.boards.flat().find(card => card.cardId === 'luigion' && card.id === 'luigion-powered');
  const mushroomCount = match.boards.flat().filter(card => card.cardId === 'demario-mushroom').length;
  const projected = powered ? authoritativeProjection(match) : null;

  return <main style={{ height: '100dvh', color: 'white', background: '#080808' }}>
    <output
      data-testid="neighborhood-wave-state"
      data-powered={powered ? 'true' : 'false'}
      data-powered-hands={powered ? getEffectiveCardPower(powered) : ''}
      data-mushrooms={mushroomCount}
      style={{ position: 'fixed', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}
    >
      {powered ? 'Powered Luigion projected' : 'Awaiting Power-Up'}
    </output>
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
      phaseMessage="Neighborhood wave engine verification"
      timerEnabled={false}
      setInspect={setInspect}
      onShowRules={() => {}}
    />
    {projected && <aside
      data-testid="online-powered-projection"
      data-projected-name={projected.name}
      data-projected-effect={projected.effect}
      hidden
    >
      <CardView card={projected} isBoard presentationOnly />
    </aside>}
    {inspect && <CardInspector card={inspect} match={match} onClose={() => setInspect(null)} />}
  </main>;
}

const root = createRoot(document.getElementById('root')!);
root.render(<QueryClientProvider client={new QueryClient()}><Fixture /></QueryClientProvider>);
import.meta.hot?.dispose(() => root.unmount());