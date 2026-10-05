import React from 'react';
import { createRoot } from 'react-dom/client';
import { Battle } from '../src/components/Battle';
import { createMatch, createCardInstance, playCard, type Match } from '../src/gameEngine';
import { decks } from '../src/data';
import '../src/index.css';

const params = new URLSearchParams(location.search);
const mode = params.get('mode') ?? 'failed';
const source = createCardInstance('barber', 'player', 'outcome-browser', 0);
if (mode === 'silenced') source.statuses.silenced = true;
const ally = { ...createCardInstance('hooper', 'player', 'outcome-browser', 1), lane: 0 as const };
const enemy = { ...createCardInstance('hooper', 'cpu', 'outcome-browser', 2), lane: 0 as const };
const shielded = mode === 'shielded' || mode === 'partial';
const initial: Match = { ...createMatch('block', 'combo'), playerMotion: 20, playerHand: [source], boards: [mode === 'failed' ? [] : mode === 'shielded' ? [enemy] : mode === 'partial' ? [enemy, ally] : [ally], [], []], timedEffects: shielded ? [{ id: 'fixture-shield', kind: 'church-protection', sourceInstanceId: enemy.instanceId, targetInstanceId: enemy.instanceId, owner: 'cpu', lane: 0, startsAtRound: 1, expiresAtRound: 2, expiration: 'round-start' }] : [] };
const match = playCard(initial, 'player', source.instanceId, 0);
const event = match.effectLog.find(e => e.type === 'ability' && e.cardId === 'barber')!;
const effect = { ...event, targetIds: event.targets.map(t => t.cardInstanceId), impact: true };
const noop = () => {};
createRoot(document.getElementById('root')!).render(<div style={{ height: '100dvh' }}><Battle
  match={match} deck={decks[0]} rivalDeck={decks[1]} selectedInstanceId={null} setSelectedInstanceId={noop}
  selectedLane={null} setSelectedLane={noop} squabble={false} setSquabble={noop} commit={noop} endTurn={noop}
  skipSequence={noop} presentationPhase="effects" phaseMessage={event.note} timerSeconds={20} timerEnabled={false}
  activeEffect={effect} activeEffectId={source.instanceId} activeEffectLane={0} impactLane={0}
  presentationScores={event.scores.after} setInspect={noop} onShowRules={noop} /></div>);
