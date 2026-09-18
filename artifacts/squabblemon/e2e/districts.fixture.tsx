import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Battle } from '../src/components/Battle';
import { decks } from '../src/data';
import { createMatch, createCardInstance, DISTRICT_CATALOG, playTurnCard, pass, revealCpuTurn, nextRound, type DistrictId, type DistrictSnapshot, type Lane } from '../src/gameEngine';
import '../src/index.css';

const sets: [DistrictId, DistrictId, DistrictId][] = [
  ['bodega', 'penthouse', 'county-jail'], ['the-trap', 'waff-l-house', 'vip-section'], ['time-square', 'magic-city', 'bodega'],
  ['the-subway', 'the-trap', 'o-block'], ['hollywood-strip', 'dive-bar', 'acorn-projects'], ['corrupt-church', 'nail-salon', 'barbershop'],
];
const params = new URLSearchParams(location.search);
const ids = sets[Number(params.get('set') ?? 0)] ?? sets[0];
const snapshot: DistrictSnapshot = { version: 1, locations: ids.map(id => DISTRICT_CATALOG.find(d => d.id === id)!) as DistrictSnapshot['locations'] };
const start = createMatch('vibes', 'block', undefined, undefined, snapshot);
start.boards[1] = [{ ...createCardInstance('hooper', 'player', 'fixture', 99), lane: 1 }];
if (params.get('round') === '4') start.round = 4;

function Fixture() {
  const [match, setMatch] = useState(start);
  const [selected, setSelected] = useState<string | null>(null);
  const [lane, setLane] = useState<Lane | null>(null);
  const [squabble, setSquabble] = useState(false);
  const clear = () => { setSelected(null); setLane(null); setSquabble(false); };
  return <div style={{ height: '100dvh', color: 'white' }}><Battle match={match} deck={decks.find(d => d.id === 'vibes')} rivalDeck={decks[0]}
    selectedInstanceId={selected} setSelectedInstanceId={setSelected} selectedLane={lane} setSelectedLane={setLane}
    onPlayCard={(instanceId: string, lane: Lane, squabble: boolean) => { setMatch(playTurnCard(match, 'player', instanceId, lane, squabble)); clear(); }}
    commit={() => { if (selected && lane !== null) { setMatch(playTurnCard(match, 'player', selected, lane, squabble)); clear(); } }}
    endTurn={() => { setMatch(nextRound(revealCpuTurn(pass(match, 'player')))); clear(); }}
    skipSequence={() => {}} presentationPhase="player-ready" phaseMessage="Read the locations. Make your move."
    timerSeconds={20} timerEnabled={false} impactLane={null} squabble={squabble} setSquabble={setSquabble}
    setInspect={() => {}} onShowRules={() => {}} /></div>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
