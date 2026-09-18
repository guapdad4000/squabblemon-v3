import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Battle } from '../src/components/Battle';
import { buildReplayFrame } from '../src/components/PlayLoop';
import { createMatch, createCardInstance, playCard, type Match } from '../src/gameEngine';
import { decks, cards } from '../src/data';
import '../src/index.css';

const requested = new URLSearchParams(location.search).get('card') ?? 'nguyen';
const cardId = Object.hasOwn(cards, requested) ? requested : 'nguyen';
const actor = createCardInstance(cardId, 'player', 'wave3');
const base: Match = { ...createMatch('block', 'combo'), round: 4, playerMotion: 9, playerHand: [actor], boards: [
  [{ ...createCardInstance('cornball', 'player', 'other'), lane: 0 }],
  [
    { ...createCardInstance('cornball', 'player', 'ally', 0), lane: 1, ...(['firstaid', 'stonerjr', 'stonersr', 'foodz'].includes(cardId) ? { statuses: { frozen: true, silenced: true, protected: false, blocked: false } } : {}) },
    { ...createCardInstance('plug', 'player', 'ally', 1), lane: 1 },
    { ...createCardInstance('hooper', 'cpu', 'target'), lane: 1 },
  ], [],
] };
const resolved = playCard(base, 'player', actor.instanceId, 1);
const event = resolved.effectLog.find(e => e.type === 'ability' && e.cardInstanceId === actor.instanceId)!;

function Fixture() {
  const [impact, setImpact] = useState(false);
  const [ready, setReady] = useState(false);
  (window as any).wave3Fixture = { impact: () => setImpact(true), ready: () => setReady(true) };
  const match = buildReplayFrame(resolved, event, impact ? 'after' : 'before');
  return <div style={{ height: '100dvh', color: 'white' }}><Battle match={match} deck={decks[0]} rivalDeck={decks[1]}
    selectedInstanceId={null} setSelectedInstanceId={() => {}} selectedLane={null} setSelectedLane={() => {}}
    commit={() => {}} skipSequence={() => setReady(true)} presentationPhase={ready ? 'player-ready' : 'effects'}
    phaseMessage={event.note} timerSeconds={20} impactLane={ready ? null : 1}
    presentationScores={event.scores[impact ? 'after' : 'before']}
    activeEffect={ready ? null : { ...event, impact, targetIds: event.targets.map(t => t.cardInstanceId) }}
    activeEffectId={ready ? null : actor.instanceId} activeEffectLane={ready ? null : 1}
    squabble={false} setSquabble={() => {}} setInspect={() => {}} onShowRules={() => {}} />
  </div>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
