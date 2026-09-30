import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { decks } from '../src/data';
import { createCardInstance, createMatch, playCard, type Match } from '../src/gameEngine';
import { Battle } from '../src/components/Battle';
import { MECHANIC_LESSONS } from '../src/components/tutorialGuidance';
import '../src/index.css';

declare global {
  interface Window { __readingFixture: { lessonDismissed: number; cueContinued: number; ready: boolean; cornballNote: string } }
}

const scenario = new URLSearchParams(location.search).get('scenario') ?? 'lesson';
window.__readingFixture = { lessonDismissed: 0, cueContinued: 0, ready: false, cornballNote: '' };

function cornballMatch() {
  const base = createMatch('block', 'combo');
  const cornball = createCardInstance('cornball', 'player', 'reading-fixture', 0);
  const played = playCard({ ...base, phase: 'player', playerMotion: 9, playerHand: [cornball, ...base.playerHand.slice(1)] } as Match, 'player', cornball.instanceId, 0);
  const event = played.effectLog.find(entry => entry.cardInstanceId === cornball.instanceId && entry.type === 'ability');
  if (!event) throw new Error('The Cornball reading fixture must contain a real ability event.');
  return { match: played, event };
}

const noop = () => {};

function Fixture() {
  const [lessonOpen, setLessonOpen] = useState(scenario === 'lesson');
  const [cueOpen, setCueOpen] = useState(scenario === 'cue');
  const { match, event } = React.useMemo(cornballMatch, []);
  window.__readingFixture.cornballNote = event.note;
  const finalMatch = { ...match, phase: 'complete' } as Match;
  const body = [
    `Cornball hit the board in district 1. ${event.note}`,
    ...Array.from({ length: 14 }, (_, i) => `Beat ${i + 1}: Dr. Fade walks the whole play back slowly so you can see who moved Hands, which district changed, and why the score shifted the way it did.`),
    'End of recap.',
  ].join('\n\n');
  const presentationPhase = scenario === 'final' ? 'match-finish' : scenario === 'cue' ? 'effects' : scenario === 'rival' ? 'rival-reveal' : 'player-ready';
  const presentedEffect = scenario === 'cue' ? { ...event, targetIds: event.targets?.map(t => t.cardInstanceId) ?? [] } : null;
  window.__readingFixture.ready = true;
  return (
    <div style={{ height: '100dvh', width: '100vw', overflow: 'hidden' }}>
      <Battle
        match={scenario === 'final' ? finalMatch : match}
        deck={decks.find(d => d.id === 'block')}
        rivalDeck={decks.find(d => d.id === 'combo')}
        tutorialCoach={scenario !== 'final'}
        selectedInstanceId={null} setSelectedInstanceId={noop} selectedLane={null} setSelectedLane={noop}
        commit={noop} skipSequence={noop}
        presentationPhase={presentationPhase}
        phaseMessage={scenario === 'final' ? 'FINAL DISTRICTS' : 'Resolving'}
        timerSeconds={20} timerEnabled={false} impactLane={null} stagedRival={null} stagedPlayer={null}
        activeEffectId={presentedEffect ? String(event.sequence) : null} activeEffectLane={presentedEffect ? event.lane : null}
        activeEffect={presentedEffect} presentationScores={null}
        squabble={false} setSquabble={noop} setInspect={noop} archiveMatch={noop} onShowRules={noop}
        mechanicLesson={lessonOpen ? MECHANIC_LESSONS.burn : null}
        onDismissMechanicLesson={() => { window.__readingFixture.lessonDismissed += 1; setLessonOpen(false); }}
        guidedReadingCue={cueOpen ? { key: 'cornball', kind: 'event', title: 'Cornball on the board', body, continueLabel: 'Got it, keep going' } : undefined}
        onContinueGuidedReading={() => { window.__readingFixture.cueContinued += 1; setCueOpen(false); }}
        reviewingFinalBoard={scenario === 'final'}
      />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient()}><Fixture /></QueryClientProvider>);
