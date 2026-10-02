import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Battle } from '../src/components/Battle';
import { CardInspector } from '../src/components/CardInspector';
import { createCardInstance, createMatch, nextRound, playTurnCard, type CardInstance, type EffectLogEntry, type Lane, type Match } from '../src/gameEngine';
import { decks } from '../src/data';
import '../src/index.css';

function findMatchCard(match: Match, instanceId: string) {
  return match.boards.flat().find(card => card.instanceId === instanceId);
}

function scenarioState(scenario: string) {
  const initial = createMatch('block', 'vibes');
  initial.playerMotion = 20;
  initial.cpuMotion = 20;
  const redOg = createCardInstance('triple-og-red', scenario === 'normal-dog-walk' ? 'player' : 'cpu', 'squabblehouse-proof', 70);
  redOg.lane = 2;
  const redDog = createCardInstance('cane-corso-red', scenario === 'normal-dog-walk' ? 'player' : 'cpu', 'squabblehouse-proof', 71);
  redDog.lane = scenario === 'normal-dog-walk' ? 0 : 0;
  initial.boards = [[redDog], [], [redOg]];
  if (scenario === 'normal-dog-walk') {
    initial.phase = 'resolved';
    const before = {
      ...initial,
      phase: 'resolved' as const,
      playerHand: [],
      cpuHand: [],
      playerCardIds: [],
      cpuCardIds: [],
      playerDrawIndex: 0,
      cpuDrawIndex: 0,
    };
    const match = nextRound(before);
    const event = [...match.effectLog].reverse().find(entry =>
      entry.kind === 'move' && entry.cardInstanceId === redDog.instanceId,
    )!;
    return { match, event, redDog, redOg };
  }

  const griddle = createCardInstance('griddle-master', 'player', 'squabblehouse-proof', 72);
  initial.phase = 'player';
  initial.playerHand = [griddle];
  const match = playTurnCard(initial, 'player', griddle.instanceId, 2);
  const event = [...match.effectLog].reverse().find(entry =>
    entry.type === 'ability'
    && entry.targets.some(target => target.cardInstanceId === redDog.instanceId)
    && entry.targets.some(target => target.cardInstanceId === redOg.instanceId),
  )!;
  return { match, event, redDog, redOg };
}

function Fixture() {
  const scenario = new URLSearchParams(window.location.search).get('scenario') ?? 'normal-dog-walk';
  const frame = new URLSearchParams(window.location.search).get('frame');
  const proof = scenarioState(scenario);
  const jump = scenario === 'emergency-guard'
    ? [...proof.match.effectLog].reverse().find(entry => entry.kind === 'move' && entry.cardInstanceId === proof.redDog.instanceId)
    : undefined;
  const initialMatch: Match = frame === 'guard-arrival' && jump
    ? { ...proof.match, ...JSON.parse(JSON.stringify(jump.replay.after)) }
    : proof.match;
  const [match, setMatch] = useState<Match>(initialMatch);
  const [selected, setSelected] = useState<string | null>(null);
  const [lane, setLane] = useState<Lane | null>(null);
  const [squabble, setSquabble] = useState(false);
  const [inspect, setInspect] = useState<CardInstance | null>(null);
  const event = proof.event as EffectLogEntry;
  const sourceId = event.source?.cardInstanceId ?? event.cardInstanceId;
  const targetDog = event.targets.find(target => target.cardInstanceId === proof.redDog.instanceId);
  const targetOg = event.targets.find(target => target.cardInstanceId === proof.redOg.instanceId);
  const sourceSnapshot = event.source ?? event.targets.find(target => target.cardInstanceId === sourceId);
  const frameCard = (frame: Match, id: string) => findMatchCard(frame, id);
  const proofValue = {
    scenario,
    event,
    source: sourceSnapshot,
    dog: {
      instanceId: proof.redDog.instanceId,
      before: targetDog?.before ?? frameCard(event.replay.before as Match, proof.redDog.instanceId) ?? null,
      after: targetDog?.after ?? frameCard(event.replay.after as Match, proof.redDog.instanceId) ?? null,
    },
    og: {
      instanceId: proof.redOg.instanceId,
      before: targetOg?.before ?? frameCard(event.replay.before as Match, proof.redOg.instanceId) ?? null,
      after: targetOg?.after ?? frameCard(event.replay.after as Match, proof.redOg.instanceId) ?? null,
    },
    jump,
  };
  const play = (instanceId: string, target: Lane, armed: boolean) => {
    setMatch(current => playTurnCard(current, 'player', instanceId, target, armed));
    setSelected(null);
    setLane(null);
    setSquabble(false);
  };

  return <main style={{ height: '100dvh', color: 'white', background: '#080808' }}>
    <output
      data-testid="squabblehouse-engine-proof"
      data-event={JSON.stringify(proofValue)}
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
      phaseMessage="Canonical Squabblehouse battle verification"
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