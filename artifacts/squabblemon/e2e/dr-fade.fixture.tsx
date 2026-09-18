import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TutorialStep } from '../src/pages/game/Onboarding';
import { Battle } from '../src/components/Battle';
import { createMatch } from '../src/gameEngine';
import { decks } from '../src/data';
import '../src/index.css';
import '../src/styles/venue.css';
import '../src/styles/dr-fade.css';

// Local visual fixture; no account state or reward requests.
function CoachBattle() {
  const [selected, setSelected] = useState<string | null>(null);
  const [lane, setLane] = useState<number | null>(null);
  const [match] = useState(() => createMatch('vibes', 'combo'));
  return <div style={{ height: '100dvh', color: 'white' }}><Battle tutorialCoach match={match}
    deck={decks.find(d => d.id === 'vibes')} rivalDeck={decks.find(d => d.id === 'combo')}
    selectedInstanceId={selected} setSelectedInstanceId={setSelected} selectedLane={lane} setSelectedLane={setLane}
    commit={() => {}} skipSequence={() => {}} presentationPhase="player-ready" phaseMessage="Your move"
    timerSeconds={20} timerEnabled={false} squabble={false} setSquabble={() => {}} setInspect={() => {}}
    archiveMatch={() => {}} onShowRules={() => {}} feedbackPreferences={{ muted: true, reducedEffects: true, haptics: false }}
    setFeedbackPreferences={() => {}} decisionStartedAt={0} /></div>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient()}>
  {new URLSearchParams(location.search).get('view') === 'battle' ? <CoachBattle /> : <TutorialStep turnTimerEnabled={false} equippedVariants={{}} onComplete={() => {}} />}
</QueryClientProvider>);
