import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Battle } from '../src/components/Battle';
import { MultiplayerBattle } from '../src/components/MultiplayerBattle';
import { createOnlineRoom, joinOnlineRoom, applyOnlineCommand, onlineRoomView } from '@workspace/squabblemon-engine/multiplayer';
import { createMatch, createCardInstance, playTurnCard, pass, nextRound, revealCpuTurn, DISTRICT_CATALOG, type Match, type DistrictSnapshot, type Lane } from '../src/gameEngine';
import { decks, cards } from '../src/data';
import { CardView } from '../src/components/CardView';
import { FAIRYTALE_WAVE, FAIRYTALE_ALTERNATE_ART } from '../../../lib/squabblemon-engine/src/fairytaleWave';
import '../src/index.css';
import '../src/styles/multiplayer.css';

const params = new URLSearchParams(location.search);
const locations: DistrictSnapshot = { version: 1, locations: ['bodega', 'corrupt-church', 'the-subway'].map(id => DISTRICT_CATALOG.find(d => d.id === id)!) as DistrictSnapshot['locations'] };
function waveFixture(match: Match): Match {
  if (params.has('fairytale')) {
    const dmv = { ...createCardInstance('dmvworker', 'cpu', 'fairytale', 8), lane: 0 as Lane };
    const sherlock = { ...createCardInstance('sherlock', 'cpu', 'fairytale', 9), lane: 2 as Lane };
    return { ...match, districtSnapshot: locations, round: 3, playerMotion: 9, cpuMotion: 9,
      playerHand: ['dorothy', 'powerhouse', 'alice', 'oz'].map((id, i) => ({ ...createCardInstance(id, 'player', 'fairytale', i), ...(id === 'powerhouse' ? { bankedMotion: 2 } : {}) })),
      boards: [[{ ...createCardInstance('bonnetgirl', 'player', 'fairytale', 5), lane: 0 }], [{ ...createCardInstance('hooper', 'cpu', 'fairytale', 6), lane: 1 }], [{ ...createCardInstance('cheshire', 'player', 'fairytale', 7), lane: 2 }]],
      districtTraps: [{ kind: 'dmv', owner: 'cpu', lane: 0, source: dmv, expiresAfterRound: 4 }, { kind: 'stakeout', owner: 'cpu', lane: 1, source: sherlock, expiresAfterRound: 4 }],
    };
  }
  if (!params.has('wave')) return match;
  const source = { ...createCardInstance('colognecriminal', 'cpu', 'wave', 10), lane: 1 as Lane };
  return { ...match, round: 3, playerMotion: 8, cpuMotion: 8,
    playerHand: ['homelessguy', 'fangirl', 'mailman', 'lawlessyn'].map((id, i) => createCardInstance(id, 'player', 'wave', i)),
    lingeringScents: [{ owner: 'cpu', lane: 1, source, expiresAfterRound: 4 }],
    discountTokens: [{ id: 'wave-package', owner: 'player', sourceInstanceId: 'wave-mailman', sourceLane: 1, targetLane: 0, createdOrder: 1, eligibility: 'electric-delivery' }],
  };
}
function Solo() {
  const [match, setMatch] = useState(() => {
    const match = createMatch('block', 'vibes', undefined, undefined, locations);
    match.playerHand = ['cornball', 'plug', 'roaster', 'wifey', 'hooper', 'snow', 'og'].map((id, i) => createCardInstance(id, 'player', 'drag', i));
    if (params.has('locked')) match.storyRuntime = { activePhaseIndex: -1, appliedEffectIds: [], lanePowerBonuses: [], laneLocks: [{ owner: 'player', lanes: [1] }] };
    if (params.has('locked')) match.storyEncounter = { id: 'drag-lock', enemy: { id: 'rival', name: 'Rival', portraitAssetId: '', deckId: 'vibes', cardIds: [], behaviorProfile: '' }, battlefieldAssetId: '', soundHooks: {} };
    return waveFixture(match);
  });
  const [selected, setSelected] = useState<string | null>(null), [lane, setLane] = useState<Lane | null>(null), [squabble, setSquabble] = useState(false);
  const [enabled, setEnabled] = useState(true);
  useEffect(() => {
    if (!params.has('expire')) return;
    const timer = setTimeout(() => setEnabled(false), 2200);
    return () => clearTimeout(timer);
  }, []);
  const play = (instanceId: string, target: Lane, armed: boolean, investment = 0) => {
    setMatch(m => playTurnCard(m, 'player', instanceId, target, armed, investment)); setSelected(null); setLane(null); setSquabble(false);
  };
  return <div style={{ height: '100dvh', color: 'white' }}><Battle match={match} deck={decks[0]} rivalDeck={decks[1]}
    selectedInstanceId={selected} setSelectedInstanceId={setSelected} selectedLane={lane} setSelectedLane={setLane} squabble={squabble} setSquabble={setSquabble}
    onPlayCard={play} commit={() => { if (selected && lane !== null) play(selected, lane, squabble); }}
    endTurn={() => setMatch(m => nextRound(revealCpuTurn(pass(m, 'player'))))} skipSequence={() => {}}
    presentationPhase={enabled ? 'player-ready' : 'rival-thinking'} phaseMessage="Drag to play" timerSeconds={20} timerEnabled={false} impactLane={null}
    setInspect={() => {}} onShowRules={() => {}} /></div>;
}
function Online() {
  const [room, setRoom] = useState(() => {
    const now = Date.now(), deck = decks.find(d => d.id === 'block')!;
    let room = joinOnlineRoom(createOnlineRoom({ userId: 'host', name: 'Host', ready: false, deck }, 'player', now), { userId: 'guest', name: 'Guest', ready: false, deck }, now);
    room = applyOnlineCommand(room, 'player', { type: 'ready' }, now);
    room = applyOnlineCommand(room, 'cpu', { type: 'ready' }, now);
    return { ...room, match: waveFixture(room.match!) };
  });
  return <MultiplayerBattle room={onlineRoomView(room, 'DRAG', 'host', Date.now())} busy={false} connected reducedMotion
    send={command => setRoom(room => applyOnlineCommand(room, 'player', command, Date.now()))} onLeave={() => {}} />;
}
function Gallery() {
  return <main style={{padding:24,display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))',gap:18,background:'#14212a'}}>
    {FAIRYTALE_WAVE.flatMap(([id,art]) => [
      <CardView key={id} card={cards[id]} fillContainer presentationOnly />,
      ...(FAIRYTALE_ALTERNATE_ART.some(a=>a===art) ? [<CardView key={id+'alt'} card={cards[id]} variantId={art+':alternate'} fillContainer presentationOnly />] : []),
    ])}
  </main>;
}
createRoot(document.getElementById('root')!).render(params.has('gallery') ? <Gallery /> : params.has('online') ? <Online /> : <Solo />);
