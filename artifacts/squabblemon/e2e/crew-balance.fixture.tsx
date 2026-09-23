import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Battle } from '../src/components/Battle';
import { CardInspector } from '../src/components/CardInspector';
import { buildReplayFrame, type PresentationEffect } from '../src/components/PlayLoop';
import {
  createCardInstance,
  createMatch,
  getEffectiveCardPower,
  playTurnCard,
  type CardInstance,
  type EffectLogEntry,
  type Lane,
  type Match,
} from '../src/gameEngine';
import { decks } from '../src/data';
import '../src/index.css';

type Replay = { event: EffectLogEntry; step: 'before' | 'after' };

function onBoard(id: string, owner: 'player' | 'cpu', lane: Lane, index: number) {
  const card = createCardInstance(id, owner, 'crew-balance-setup', index);
  card.lane = lane;
  card.playedRound = 1;
  return card;
}

function detectiveMatch() {
  const match = createMatch('block', 'vibes');
  match.playerMotion = 9;
  match.cpuMotion = 9;
  match.playerHand = [createCardInstance('sherlock', 'player', 'crew-balance', 0)];
  match.cpuHand = [createCardInstance('cornball', 'cpu', 'crew-balance', 1)];
  match.boards = [[], [onBoard('hooper', 'cpu', 1, 2)], [onBoard('watson', 'player', 2, 3)]];
  return match;
}

function counterMatch() {
  const match = createMatch('block', 'vibes');
  match.playerMotion = 9;
  match.playerHand = [createCardInstance('nerd', 'player', 'crew-balance', 0)];
  match.cpuHand = [];
  match.boards = [[onBoard('counter', 'player', 0, 1), onBoard('gamer', 'player', 0, 2), onBoard('hooper', 'cpu', 0, 3)], [], []];
  return match;
}

function Fixture() {
  const mode = new URLSearchParams(location.search).get('mode') === 'counter' ? 'counter' : 'detective';
  const [live, setLive] = useState<Match>(() => mode === 'counter' ? counterMatch() : detectiveMatch());
  const [visual, setVisual] = useState<Match>(live);
  const [selected, setSelected] = useState<string | null>(null);
  const [lane, setLane] = useState<Lane | null>(null);
  const [inspect, setInspect] = useState<CardInstance | null>(null);
  const [replay, setReplay] = useState<Replay | null>(null);
  const [effect, setEffect] = useState<PresentationEffect | null>(null);

  const apply = (next: Match) => {
    next.phase = 'player';
    setLive(next);
    setVisual(next);
    setSelected(null);
    setLane(null);
  };
  const play = (instanceId: string, target: Lane) =>
    apply(playTurnCard(live, 'player', instanceId, target, false));
  const triggerEntrance = () => {
    const trapLane = live.districtTraps?.find(trap => trap.kind === 'stakeout')?.lane;
    const entrant = live.cpuHand.find(card => card.cardId === 'cornball');
    if (trapLane === undefined || !entrant) return;
    apply(playTurnCard({ ...live, phase: 'cpu-reveal' }, 'cpu', entrant.instanceId, trapLane, false));
  };
  const replayStep = (event: EffectLogEntry, step: 'before' | 'after') => {
    const sourceId = event.source?.cardInstanceId ?? event.cardInstanceId;
    const targetIds = event.targets.map(target => target.cardInstanceId);
    setVisual(buildReplayFrame(live, event, step));
    setReplay({ event, step });
    setEffect({ ...event, cardInstanceId: sourceId, targetIds });
  };
  const exitReplay = () => {
    setVisual(live);
    setReplay(null);
    setEffect(null);
  };
  const sherlock = live.boards.flat().find(card => card.cardId === 'sherlock');
  const watson = live.boards.flat().find(card => card.cardId === 'watson');
  const gamer = live.boards.flat().find(card => card.cardId === 'gamer');
  const counter = live.boards.flat().find(card => card.cardId === 'counter');
  const rival = live.boards.flat().find(card => card.owner === 'cpu');
  const cancellation = [...live.effectLog].reverse().find(event => /Stakeout canceled/i.test(event.note));

  return <main style={{ height: '100dvh', color: 'white', background: '#080808' }}>
    <div style={{ position: 'fixed', zIndex: 100, top: 52, left: 8 }}>
      {mode === 'detective' && <button data-testid="trigger-rival-entrance" onClick={triggerEntrance}>Trigger rival entrance</button>}
    </div>
    <output
      data-testid="crew-balance-state"
      data-mode={mode}
      data-sherlock-power={sherlock ? getEffectiveCardPower(sherlock) : ''}
      data-watson-power={watson ? getEffectiveCardPower(watson) : ''}
      data-cancellation-targets={cancellation?.targets.map(target => target.cardInstanceId).join(',') ?? ''}
      data-gamer-power={gamer ? getEffectiveCardPower(gamer) : ''}
      data-counter-power={counter ? getEffectiveCardPower(counter) : ''}
      data-gamer-triggered={live.effectLog.some(event => /City Tour: successful disruption/i.test(event.note)) ? 'true' : 'false'}
      data-counter-triggered={live.effectLog.some(event => /Mirror: successful disruption/i.test(event.note)) ? 'true' : 'false'}
      data-counter-protected={counter?.statuses.protected ? 'true' : 'false'}
      data-rival-silenced={rival?.statuses.silenced ? 'true' : 'false'}
      style={{ position: 'fixed', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}
    />
    <Battle
      match={visual}
      deck={decks[0]}
      rivalDeck={decks[1]}
      selectedInstanceId={selected}
      setSelectedInstanceId={setSelected}
      selectedLane={lane}
      setSelectedLane={setLane}
      squabble={false}
      setSquabble={() => {}}
      onPlayCard={(instanceId: string, target: Lane) => play(instanceId, target)}
      commit={() => { if (selected && lane !== null) play(selected, lane); }}
      presentationPhase="player-ready"
      phaseMessage={mode === 'counter' ? 'Counterplay engine verification' : 'Detective engine verification'}
      timerEnabled={false}
      setInspect={setInspect}
      onShowRules={() => {}}
      authoritativeHistory={live.effectLog}
      replay={replay}
      activeEffect={effect}
      activeEffectId={effect?.source?.cardInstanceId ?? null}
      activeEffectLane={effect?.lane ?? null}
      onReplayStep={replayStep}
      onExitReplay={exitReplay}
    />
    {inspect && <CardInspector card={inspect} match={live} onClose={() => setInspect(null)} />}
  </main>;
}

const root = createRoot(document.getElementById('root')!);
root.render(<QueryClientProvider client={new QueryClient()}><Fixture /></QueryClientProvider>);
import.meta.hot?.dispose(() => root.unmount());