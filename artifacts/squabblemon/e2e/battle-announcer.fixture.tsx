import React, { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Battle } from '../src/components/Battle';
import { MultiplayerBattle } from '../src/components/MultiplayerBattle';
import GameSoundtrack from '../src/components/GameSoundtrack';
import { MusicControls } from '../src/components/MusicControls';
import { createMatch, createStoryMatch, type Lane } from '../src/gameEngine';
import { decks } from '../src/data';
import { rookieEncounter } from '@workspace/squabblemon-engine/rookie';
import { createOnlineRoom, joinOnlineRoom, applyOnlineCommand, onlineRoomView } from '@workspace/squabblemon-engine/multiplayer';
import { useFeedbackPreferences } from '../src/hooks/useFeedbackPreferences';
import '../src/index.css';
import '../src/styles/multiplayer.css';

const params = new URLSearchParams(location.search);
const online = params.get('mode') === 'online';
const guestSeat = params.get('seat') === 'guest';
const limit = Number(params.get('limit') ?? 6);
const deck = decks.find(d => d.id === 'block')!;
function Fixture() {
  const [phase, setPhase] = useState('versus');
  const [match, setMatch] = useState(() => limit === 6 ? createMatch('block', 'vibes') : createStoryMatch({ ...rookieEncounter(), roundLimit: limit }, deck.cards, deck.id));
  const [room, setRoom] = useState(() => {
    const now = Date.now();
    let room = joinOnlineRoom(createOnlineRoom({ userId: 'host', name: 'Host', ready: false, deck }, 'player', now), { userId: 'guest', name: 'Guest', ready: false, deck }, now);
    room = applyOnlineCommand(room, 'player', { type: 'ready' }, now);
    return applyOnlineCommand(room, 'cpu', { type: 'ready' }, now);
  });
  const [connected, setConnected] = useState(true), [busy, setBusy] = useState(false), [mounted, setMounted] = useState(true);
  const [selected, setSelected] = useState<string | null>(null), [lane, setLane] = useState<Lane | null>(null), [squabble, setSquabble] = useState(false);
  const [feedback, saveFeedback] = useFeedbackPreferences();
  const advanceOnline = () => setRoom(current => applyOnlineCommand(current, current.activeSeat, { type: 'end-turn' }, Date.now()));
  return <>
    <GameSoundtrack />
    <header style={{ position: 'relative', zIndex: 100, background: '#151515', color: 'white', padding: 8, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      <MusicControls />
      <button onClick={() => setPhase('round-intro')}>Intro</button>
      <button onClick={() => setPhase('player-ready')}>Ready</button>
      <button onClick={() => setPhase('player-reveal')}>Resolve card</button>
      <button onClick={() => { setMatch(m => ({ ...m, round: m.round + 1 })); setPhase('round-intro'); }}>Next round</button>
      <button onClick={() => { setMatch(m => ({ ...m, round: limit })); setPhase('player-ready'); }}>Final round</button>
      <button onClick={advanceOnline}>Advance online turn</button>
      <button onClick={() => setConnected(value => !value)}>Toggle connection</button>
      <button onClick={() => setBusy(value => !value)}>Toggle busy</button>
      <button onClick={() => setMounted(false)}>Leave fixture</button>
    </header>
    {mounted && (online ? <MultiplayerBattle key={`${room.gameNumber}`} room={onlineRoomView(room, 'VOICE', guestSeat ? 'guest' : 'host', Date.now())} connected={connected} busy={busy} reducedMotion send={command => { setRoom(current => applyOnlineCommand(current, guestSeat ? 'cpu' : 'player', command, Date.now())); }} onLeave={() => setMounted(false)} />
      : <main style={{ height: '85dvh', color: 'white' }}><Battle match={match} deck={deck} rivalDeck={decks.find(d => d.id === 'vibes')} selectedInstanceId={selected} setSelectedInstanceId={setSelected} selectedLane={lane} setSelectedLane={setLane} squabble={squabble} setSquabble={setSquabble} presentationPhase={phase} phaseMessage={phase} timerEnabled={false} setInspect={() => {}} onShowRules={() => {}} feedbackPreferences={feedback} setFeedbackPreferences={saveFeedback} /></main>)}
  </>;
}
const root = createRoot(document.getElementById('root')!);
root.render(<StrictMode><QueryClientProvider client={new QueryClient()}><Fixture /></QueryClientProvider></StrictMode>);
import.meta.hot?.dispose(() => root.unmount());
