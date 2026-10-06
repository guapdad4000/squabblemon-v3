import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DISTRICT_CATALOG } from '@workspace/squabblemon-engine/districts';
import { BattleDistrictView } from '../src/components/BattleDistrictView';
import { CardInspector } from '../src/components/CardInspector';
import { createMatch, createCardInstance, getMatchDistricts, type CardInstance, type Lane } from '../src/gameEngine';
import '../src/index.css';

const match = createMatch('block', 'combo');
const locations = [
  ...DISTRICT_CATALOG.map(district => ({ ...district, status: `Live match status: ${district.name} is ready for your next play.` })),
  ...getMatchDistricts(match),
];
match.boards = ([0, 1, 2] as Lane[]).map(lane => (['cpu', 'player'] as const).map((owner, index) => ({ ...createCardInstance(index ? 'barber' : 'hooper', owner, `lane-${lane}`, index), lane })));
const query = new URLSearchParams(location.search);
const requested = locations.findIndex(district => district.id === query.get('id'));
const issuedRule = 'Issued-match rule: Your first play here costs 2 less Motion (minimum 1).';
const issuedStrategy = 'Issued-match strategy: Save this match’s opening discount for your biggest arrival.';

function App() {
  const [selected, setSelected] = useState(requested < 0 ? 0 : requested);
  const [lane, setLane] = useState(0);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'location' | 'formation'>('location');
  const [inspect, setInspect] = useState<CardInstance | null>(null);
  const entry = locations[selected];
  const district = query.has('issued') ? { ...entry, rule: issuedRule, strategy: issuedStrategy, status: 'Issued-match status: The opening discount is still available.' } : entry;
  const districts = [district, locations[(selected + 1) % locations.length], locations[(selected + 2) % locations.length]];
  (window as any).__locationDetailsFixture = { entries: locations, issuedRule, issuedStrategy };
  return <main style={{ padding: 24, minHeight: '100dvh', background: '#101813', color: '#f5e8c6' }}>
    <h1 style={{ marginBottom: 16 }}>Location details review</h1>
    <label>Review location <select aria-label="Review location" value={selected} onChange={event => { setSelected(Number(event.target.value)); setLane(0); }} style={{ background: '#22332a', padding: 8, maxWidth: '100%' }}>
      {locations.map((location, index) => <option key={location.id} value={index}>{location.name}</option>)}
    </select></label>
    <button type="button" data-testid="location-details-opener" style={{ display: 'block', padding: 12, marginTop: 20, border: '1px solid #d7b261' }} onClick={() => { setLane(0); setMode('location'); setOpen(true); }}>Open location details</button>
    {open && <BattleDistrictView districts={districts} boards={match.boards} scores={[{ cpu: 7, player: 12 }, { cpu: 3, player: 9 }, { cpu: 6, player: 6 }]} lane={lane} onLane={setLane} mode={mode} onMode={setMode} onClose={() => setOpen(false)} onInspect={setInspect} variantFor={() => undefined} covered={() => false} />}
    {inspect && <CardInspector card={inspect} match={match} onClose={() => setInspect(null)} />}
  </main>;
}
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={queryClient}><App /></QueryClientProvider>);
