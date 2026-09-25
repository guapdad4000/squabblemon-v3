import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Battle } from '../src/components/Battle';
import {
  canAffordSelection, createStoryMatch, nextRound, pass, playTurnCard, revealCpuTurn, type Lane,
} from '../src/gameEngine';
import { rookieDistricts, rookieEncounter } from '@workspace/squabblemon-engine/rookie';
import { ROOKIE_CORE_IDS, ROOKIE_DECK_ID, catalogIdsToEngineIds, decks } from '../src/data';
import { getTutorialGuidance } from '../src/components/tutorialGuidance';
import '../src/index.css';
import '../src/styles/venue.css';
import '../src/styles/dr-fade.css';

// Real-click tutorial fixture: mounts the exact rookie-road-v2 lesson and drives
// it with the same selection/commit gate PlayLoop uses, so browser tests can
// follow the coach spotlight with genuine clicks instead of synthetic calls.
function RookieRoadBattle() {
  const [match, setMatch] = useState(() => createStoryMatch(
    rookieEncounter(), catalogIdsToEngineIds(ROOKIE_CORE_IDS), ROOKIE_DECK_ID, undefined, rookieDistricts(),
  ));
  const [selected, setSelected] = useState<string | null>(null);
  const [lane, setLane] = useState<number | null>(null);
  const [squabble, setSquabble] = useState(false);
  const [playsByRound, setPlaysByRound] = useState<Record<number, number>>({});
  const [rejection, setRejection] = useState('');

  const guidance = getTutorialGuidance({
    match, selectedInstanceId: selected, selectedLane: lane, squabble,
    playsThisRound: playsByRound[match.round] ?? 0,
  });

  const commit = (endTurn = false) => {
    if (match.phase !== 'player') return;
    const legal = selected !== null && lane !== null && canAffordSelection(match, 'player', selected, lane as Lane);
    if (!endTurn && selected && !legal) { setRejection(`illegal ${selected}@${lane}`); return; }
    const gated = endTurn
      ? guidance.focus !== 'end-turn'
      : guidance.focus !== 'play' || guidance.expectedCard !== selected || guidance.expectedLane !== lane || (match.round === 4 && !squabble);
    if (gated) {
      setRejection(`gate focus=${guidance.focus} expected=${guidance.expectedCard}@${guidance.expectedLane} got=${selected}@${lane}`);
      return;
    }
    const next = endTurn
      ? nextRound(revealCpuTurn(pass(match, 'player')))
      : playTurnCard(match, 'player', selected!, lane as Lane, squabble);
    if (!endTurn) setPlaysByRound(p => ({ ...p, [match.round]: (p[match.round] ?? 0) + 1 }));
    setSquabble(false); setSelected(null); setLane(null);
    setMatch(next);
  };

  const done = match.phase === 'complete';
  return <div style={{ height: '100dvh', color: 'white' }}>
    <div data-testid="match-sig" style={{ position: 'fixed', top: 0, left: 0, zIndex: 1, fontSize: 8, opacity: 0.05, pointerEvents: 'none' }}>
      {match.round}|{match.phase}|{selected}|{lane}|{squabble ? 1 : 0}|{playsByRound[match.round] ?? 0}
    </div>
    <div data-testid="commit-rejection" style={{ position: 'fixed', top: 0, right: 0, zIndex: 1, fontSize: 8, opacity: 0.05, pointerEvents: 'none' }}>{rejection}</div>
    {done && <div data-testid="tutorial-done" style={{ position: 'fixed', inset: 0, zIndex: 20000, display: 'grid', placeItems: 'center', background: '#07100e' }}>LESSON COMPLETE</div>}
    <Battle tutorialCoach tutorialGuidance={guidance} match={match}
      deck={decks.find(d => d.id === ROOKIE_DECK_ID) ?? decks.find(d => d.id === 'vibes')} rivalDeck={decks.find(d => d.id === 'vibes')}
      selectedInstanceId={selected} setSelectedInstanceId={setSelected} selectedLane={lane} setSelectedLane={setLane}
      commit={commit} skipSequence={() => {}} presentationPhase="player-ready" phaseMessage={`ROUND ${match.round} // YOUR MOVE`}
      timerSeconds={20} timerEnabled={false} squabble={squabble} setSquabble={setSquabble} setInspect={() => {}}
      archiveMatch={() => {}} onShowRules={() => {}} feedbackPreferences={{ muted: true, reducedEffects: true, haptics: false }}
      setFeedbackPreferences={() => {}} decisionStartedAt={0} />
  </div>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient()}>
  <RookieRoadBattle />
</QueryClientProvider>);
