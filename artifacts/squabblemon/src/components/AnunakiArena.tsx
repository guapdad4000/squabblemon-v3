import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { anunakiCards, anunakiRarities } from '@workspace/squabblemon-engine/anunakiWave';
import { catalogCardByEngineId, catalogCardById, getCardImage, type Deck, type CatalogCard } from '../data';
import { CardInspector } from './CardInspector';
import { PlayLoop } from './PlayLoop';
import './anunaki-arena.css';

// This module is imported only by Vite's development entry. These in-memory
// entries never touch the server, the public catalog, or release flags.
const opening = ['nabu', 'enki', 'utu', 'yakub', 'inanna', 'ninhursag', 'caucus-mountaineer', 'enlil', 'ereshkigal', 'anu'];
for (const id of opening) {
  const entry: CatalogCard = { ...anunakiCards[id], catalogId: id, engineId: id, artworkId: id,
    rarity: anunakiRarities[id], faction: 'Anunaki', crewTags: [], acquisitionSources: ['Local test'], variantSlots: [] };
  catalogCardById[id] = entry;
  catalogCardByEngineId[id] = entry;
}
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });

export function AnunakiArena() {
  const [order, setOrder] = useState(opening);
  const [inspected, setInspected] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [rival, setRival] = useState('combo');
  const move = (index: number, step: number) => setOrder(current => {
    const next = [...current];
    const target = index + step;
    if (target < 0 || target >= next.length) return current;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });
  const deck: Deck = { id: 'anunaki-test', name: 'Anunaki Test Crew', archetype: 'Ancient Tablets', accent: 'NORMAL', plan: 'Create and consume Ancient Tablets.', hero: 'anu', cards: order };
  return <QueryClientProvider client={queryClient}><MotionConfig reducedMotion="user">
    {playing ? <><PlayLoop mode="guest" loanerPractice hideLobby turnTimerEnabled={false} customPlayerDeck={deck} initialRivalId={rival} onExit={() => setPlaying(false)} /><button type="button" className="anunaki-arena__reset" onClick={() => setPlaying(false)}>↶ RESET / ROSTER</button></> :
      <main className="anunaki-arena" data-testid="anunaki-arena">
        <header className="anunaki-arena__header"><div><p>LOCAL TEST // NO REWARDS OR ACCOUNT CHANGES</p><h1>THE ANUNAKI<br /><em>TEST ARENA</em></h1><span>Bring the whole crew into a real practice battle. The first five fighters start in your hand; reorder to try different combinations.</span></div>
          <div className="anunaki-arena__start"><label htmlFor="anunaki-rival">CPU opponent</label><select id="anunaki-rival" value={rival} onChange={e => setRival(e.target.value)}><option value="combo">Combo crew</option><option value="block">Block crew</option><option value="sunday-dinner">Sunday Dinner crew</option></select><button type="button" onClick={() => setPlaying(true)}>ENTER THE ARENA ↗</button><small>Draft stats and abilities may change before release.</small></div>
        </header>
        <section className="anunaki-arena__roster" aria-label="Anunaki test deck"><h2>YOUR 10 FIGHTERS <span>// FIRST FIVE ARE THE OPENING HAND</span></h2><ol>
          {order.map((id, index) => <li key={id}><button type="button" className="anunaki-arena__portrait" onClick={() => setInspected(id)} aria-label={`Inspect ${anunakiCards[id].name}`}><img src={getCardImage(id)} alt="" /><span>{String(index + 1).padStart(2, '0')}</span></button><div><strong>{anunakiCards[id].name}</strong><small>{anunakiCards[id].cost} MOTION · {anunakiCards[id].power} HANDS</small><div className="anunaki-arena__moves"><button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move ${anunakiCards[id].name} earlier`}>↑</button><button type="button" onClick={() => move(index, 1)} disabled={index === order.length - 1} aria-label={`Move ${anunakiCards[id].name} later`}>↓</button><button type="button" onClick={() => setInspected(id)}>DETAILS</button></div></div></li>)}
        </ol></section>
      </main>}
    {inspected && !playing && <CardInspector card={anunakiCards[inspected]} onClose={() => setInspected(null)} />}
  </MotionConfig></QueryClientProvider>;
}
