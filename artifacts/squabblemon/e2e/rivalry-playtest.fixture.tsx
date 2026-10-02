import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Battle } from '../src/components/Battle';
import { CardInspector } from '../src/components/CardInspector';
import {
  getMatchWinner, type CardInstance, type Lane,
} from '../src/gameEngine';
import { listLegalBalancePlays } from '@workspace/squabblemon-engine/balanceLab';
import { CARD_BALANCE_VERSION, ONLINE_RULES_VERSION } from '@workspace/squabblemon-engine/multiplayer';
import { decks } from '../src/data';
import '../src/index.css';

import { rivalryRecipes as recipes, createRivalryRoom, applyRivalryCommand, type RivalrySettings as Settings, type RivalryCommand as Command } from '../../../scripts/src/rivalry-online-model';
function Fixture() {
  const [settings, setSettings] = useState<Settings>({ first: 'blue', tier: 2, seed: 'human-rivalry-1' });
  const [active, setActive] = useState(settings);
  const [room, setRoom] = useState(() => createRivalryRoom(settings));
  const match = room.match!;
  const [commands, setCommands] = useState<Command[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [lane, setLane] = useState<Lane | null>(null);
  const [squabble, setSquabble] = useState(false);
  const [inspect, setInspect] = useState<CardInstance | null>(null);
  const [notes, setNotes] = useState('');
  const [exportStatus, setExportStatus] = useState('');
  const cpuOptions = useMemo(() => match.phase === 'cpu-reveal' ? listLegalBalancePlays(match, 'cpu', true) : [], [match]);
  const act = (command: Command) => {
    setRoom(applyRivalryCommand(room, command)); setCommands([...commands, command]);
    setSelected(null); setLane(null); setSquabble(false);
  };
  const start = (next: Settings) => {
    setSettings(next); setActive(next); setRoom(createRivalryRoom(next)); setCommands([]);
    setSelected(null); setLane(null); setSquabble(false); setNotes(''); setExportStatus('');
  };
  const exportGame = () => {
    const replayed = commands.reduce(applyRivalryCommand, createRivalryRoom(active));
    if (JSON.stringify(replayed) !== JSON.stringify(room)) throw new Error('Replay does not match the live game');
    const evidence = { rulesVersion: ONLINE_RULES_VERSION, balanceVersion: CARD_BALANCE_VERSION, settings: active,
      recipes, commands, completed: match.phase === 'complete', winner: getMatchWinner(match), notes, replayVerified: true, turnOrder: 'online-alternating', match };
    const url = URL.createObjectURL(new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `blood-crip-playtest-${active.first}-tier${active.tier}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); setExportStatus('Replay verified; game exported.');
  };
  const deckFor = (side: 'blue' | 'red') => ({ ...decks[0], id: side, name: side === 'blue' ? 'Crips' : 'Blood', cards: recipes[side] });
  return <main style={{ height: '100dvh', background: '#080808', color: 'white', display: 'flex', flexDirection: 'column' }}>
    <header style={{ flexShrink: 0, padding: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', background: '#171717', zIndex: 60 }}>
      <strong>Blood / Crips · shared-screen playtest</strong>
      <label>Player side <select aria-label="Player side" value={settings.first} onChange={e => setSettings({ ...settings, first: e.target.value as Settings['first'] })}><option value="blue">Crips</option><option value="red">Blood</option></select></label>
      <label>Tier <select aria-label="Training tier" value={settings.tier} onChange={e => setSettings({ ...settings, tier: Number(e.target.value) })}>{[0, 1, 2, 3].map(t => <option key={t}>{t}</option>)}</select></label>
      <label>Seed <input aria-label="Match seed" value={settings.seed} onChange={e => setSettings({ ...settings, seed: e.target.value })} style={{ width: 130 }} /></label>
      <button onClick={() => start(settings)}>Start game</button>
      <button onClick={() => start({ ...active, first: active.first === 'blue' ? 'red' : 'blue' })}>Swap seats, same draws</button>
      <button onClick={exportGame}>Export game</button>
      <input aria-label="Playtest notes" placeholder="What felt unfair or hard to answer?" value={notes} onChange={e => setNotes(e.target.value)} />
      <output data-testid="playtest-status" data-phase={match.phase} data-round={match.round} data-commands={commands.length}>{exportStatus || (match.phase === 'complete' ? `Winner: ${getMatchWinner(match)}` : `Round ${match.round} · ${match.phase === 'player' ? active.first : active.first === 'blue' ? 'red' : 'blue'} acts`)}</output>
    </header>
    {match.phase === 'cpu-reveal' && <section aria-label="Second side controls" style={{ padding: 8, maxHeight: '30vh', overflow: 'auto', background: '#252525', zIndex: 60 }}>
      <p>Second player: choose a card and district. Both players share this screen; hands are not private.</p>
      {cpuOptions.map(o => <button key={`${o.instanceId}:${o.lane}:${o.squabble}`} style={{ margin: 3, padding: 6, border: '1px solid #777' }}
        onClick={() => act({ kind: 'play', owner: 'cpu', id: o.instanceId, lane: o.lane, squabble: o.squabble })}>{o.cardId} · district {o.lane + 1} · {o.cost} Motion{o.squabble ? ' · SQUABBLE' : ''}</button>)}
      <button data-testid="second-pass" onClick={() => act({ kind: 'pass', owner: 'cpu' })}>End second side turn</button>
    </section>}
    <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
      <Battle match={match} deck={deckFor(active.first)} rivalDeck={deckFor(active.first === 'blue' ? 'red' : 'blue')}
        selectedInstanceId={selected} setSelectedInstanceId={setSelected} selectedLane={lane} setSelectedLane={setLane}
        squabble={squabble} setSquabble={setSquabble} timerEnabled={false} setInspect={setInspect} onShowRules={() => {}}
        onPlayCard={(id: string, target: Lane, useSquabble?: boolean) => act({ kind: 'play', owner: 'player', id, lane: target, squabble: !!useSquabble })}
        commit={() => selected && lane !== null ? act({ kind: 'play', owner: 'player', id: selected, lane, squabble }) : act({ kind: 'pass', owner: 'player' })}
        endTurn={() => act({ kind: 'pass', owner: 'player' })} authoritativeHistory={match.effectLog}
        presentationPhase={match.phase === 'player' ? 'player-ready' : match.phase === 'complete' ? 'player-ready' : 'rival-thinking'}
        phaseMessage="Shared-screen playtest · GUAP excluded" />
    </div>
    {inspect && <CardInspector card={inspect} match={match} onClose={() => setInspect(null)} />}
  </main>;
}
const root = createRoot(document.getElementById('root')!);
root.render(<QueryClientProvider client={new QueryClient()}><Fixture /></QueryClientProvider>);
import.meta.hot?.dispose(() => root.unmount());
