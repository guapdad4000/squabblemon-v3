import React, { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ResultScreen } from '../src/components/ResultScreen';
import { MultiplayerBattle } from '../src/components/MultiplayerBattle';
import { PlayerLevelCelebration } from '../src/components/AccountRewards';
import { RewardReveal } from '../src/components/RewardReveal';
import { createMatch, createCardInstance, type Match } from '../src/gameEngine';
import { decks, districts } from '../src/data';
import { createOnlineRoom, joinOnlineRoom, applyOnlineCommand, onlineRoomView } from '@workspace/squabblemon-engine/multiplayer';
import { getStoryBattle } from '@workspace/squabblemon-engine/story';
import { profileBootstrap } from './fighter-id.fixture';
import { playVoiceLine, stopSoundEffect } from '../src/lib/sfx';
import '../src/index.css';
import '../src/styles/multiplayer.css';

const params = new URLSearchParams(location.search);
const outcome = params.get('outcome') ?? 'win';
const flow = params.get('flow') ?? 'standard';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const makeMatch = (): Match => {
  const match = { ...createMatch('block', 'slide'), phase: 'complete' as const, round: 6 };
  if (outcome !== 'draw') match.boards = [['hooper'], ['wifey'], ['rastamon']].map((ids, lane) =>
    ids.map((id, i) => ({ ...createCardInstance(id, outcome === 'win' ? 'player' : 'cpu', 'level-up', i), lane, playedRound: 1 }))) as Match['boards'];
  if (flow === 'story') match.storyEncounter = getStoryBattle('welcome-to-the-block')!.encounter;
  return match;
};
const match = makeMatch();
const now = Date.now();
const deck = decks.find(d => d.id === 'block')!;
let room = joinOnlineRoom(createOnlineRoom({ userId: 'host', name: 'Host', ready: false, deck }, 'player', now), { userId: 'guest', name: 'Guest', ready: false, deck }, now);
room = applyOnlineCommand(applyOnlineCommand(room, 'player', { type: 'ready' }, now), 'cpu', { type: 'ready' }, now);
room = { ...room, status: 'complete', winner: outcome === 'draw' ? 'draw' : outcome === 'win' ? 'player' : 'cpu', match, reason: 'districts', deadline: null };

function Destination({ name }: { name: string }) {
  useEffect(() => {
    let audio: HTMLAudioElement | null = null;
    const timer = setTimeout(() => { audio = playVoiceLine('home-fade'); }, 0);
    return () => { clearTimeout(timer); stopSoundEffect(audio); };
  }, []);
  return <main data-testid="level-destination">{name}</main>;
}

function Fixture() {
  const [level, setLevel] = useState(1);
  const [destination, setDestination] = useState('');
  const [review, setReview] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setLevel(Number(params.get('level') ?? 2)), 120);
    return () => clearTimeout(timer);
  }, []);
  const profile = profileBootstrap({ id: 'fadecade-player', level }).profile;
  const leave = (name: string) => () => setDestination(name);
  const reward = { id: 'level-fixture', xp: 250, softCurrency: 50, streetRep: 5, packTickets: 0, cardXp: [], storyRewards: [] };
  return <>
    <RewardReveal />
    <PlayerLevelCelebration profile={profile} />
    <output data-testid="profile-level">{level}</output>
    {destination ? <Destination name={destination} /> : flow === 'online' ?
      <MultiplayerBattle room={onlineRoomView(room, 'LEVEL', 'host', now)} busy={false} connected reducedMotion={reduced}
        send={() => setDestination('Rematch')} onLeave={leave('Park')} /> : review ?
      <button onClick={() => setReview(false)}>View result</button> :
      <ResultScreen match={match} districts={districts} reward={reward} isGuest={false} challenge={flow === 'challenge'}
        storyMetadata={flow === 'story' ? { outcome, stars: 3, firstClear: true } : undefined}
        onRestart={leave('Next battle')} onGoHome={leave('Home')} onChangeDeck={leave('Decks')} onInspectBoard={() => setReview(true)} />}
  </>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Fixture /></StrictMode>);
