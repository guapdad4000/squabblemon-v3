import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CardView } from '../src/components/CardView';
import { CardInspector } from '../src/components/CardInspector';
import { DeckCarousel } from '../src/components/DeckCarousel';
import { catalogCardById, engineIdsToCatalogIds, decks, type CatalogCard } from '../src/data';
import { recommendedWorkshopCrews } from '../src/lib/deckWorkshop';
import { STREET_LEGENDS_STYLE_SCENES } from '../../../lib/squabblemon-engine/src/streetLegendsStyles';
import '../src/index.css';
import './street-legends.fixture.css';

const query = new URLSearchParams(location.search);
const wave = Object.keys(STREET_LEGENDS_STYLE_SCENES).map(id => catalogCardById[id]);
const crewKeys = ['music', 'fitness', 'investigations', 'relationships', 'streetgrowth'] as const;
type Group = 'all' | 'block' | 'music' | 'fitness';
const initialGroup = ['all', 'block', 'music', 'fitness'].includes(query.get('group') ?? '') ? query.get('group') as Group : 'all';
const crewLabel = { music: 'WHO GOT THE AUX', fitness: 'ONE MORE REP', investigations: 'TAKE THE BAIT', relationships: 'RELATIONSHIP PRESSURE', streetgrowth: 'GROWTH AND ROUTES' };

function Fixture() {
  const [group, setGroup] = useState<Group>(initialGroup);
  const [inspected, setInspected] = useState<CatalogCard | null>(catalogCardById[query.get('card') ?? ''] ?? null);
  const [crew, setCrew] = useState<(typeof crewKeys)[number]>('music');
  const shown = wave.filter(card => group === 'all' || (group === 'block' ? card.faction === 'Street Legends' : group === 'music' ? card.faction === 'Music Industry' : card.faction === 'Fitness' || card.engineId === 'nail'));
  const deckItems = decks.filter(deck => ['music-industry', 'fitness-circuit'].includes(deck.id)).map(deck => ({ id: deck.id, name: deck.name, heroCardId: deck.hero, cardIds: engineIdsToCatalogIds(deck.cards), subtitle: deck.plan, valid: true }));
  const selectedDeck = crew === 'fitness' ? 'fitness-circuit' : 'music-industry';
  return <main className="street-legends-review" data-testid="street-legends-review">
    <header className="street-legends-review__header"><p>SQUABBLEMON · STREET LEGENDS</p><h1>NEW PEOPLE.<br/><em>NEW PROBLEMS.</em></h1><span>29 new fighters. Nail Tech gets a fresh look. 244 characters on the block.</span></header>
    <nav className="street-legends-review__groups" aria-label="Roster groups">{([['all', 'Full wave · 30'], ['block', 'Street Legends · 15'], ['music', 'Music Industry · 10'], ['fitness', 'Fitness · 5']] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={group === id} onClick={() => setGroup(id)}>{label}</button>)}</nav>
    <section className="street-legends-review__cards" aria-label="Street Legends fighters" data-testid="wave-roster-grid">{shown.map(card => <article key={card.catalogId} data-wave-card={card.catalogId}>
      <div className="street-legends-review__card"><CardView card={card} fillContainer presentationOnly disableLayout onClick={() => setInspected(card)} /></div>
      <div className="street-legends-review__note"><strong>{card.ability}</strong><span>{card.type} · {card.cost} Motion / {card.power} Hands</span><p>{card.effect}</p><button type="button" onClick={() => setInspected(card)} aria-label={'Inspect ' + card.name}>Full fighter dossier ↗</button></div>
    </article>)}</section>
    <section className="street-legends-review__decks" aria-label="Complete new crews">
      <p>THE LINEUP</p><h2>Every slot has a job.</h2>
      <DeckCarousel decks={deckItems} selectedId={selectedDeck} onSelect={id => setCrew(id === 'fitness-circuit' ? 'fitness' : 'music')} onOpen={id => setCrew(id === 'fitness-circuit' ? 'fitness' : 'music')} label="New complete crews" openLabel="Review crew" />
      <nav className="street-legends-review__groups" aria-label="Practice crews">{crewKeys.map(key => <button type="button" key={key} aria-pressed={crew === key} onClick={() => setCrew(key)}>{crewLabel[key]}</button>)}</nav>
      <h3>{crewLabel[crew]}</h3><div className="street-legends-review__crew" data-testid="wave-crew" data-crew={crew}>{engineIdsToCatalogIds([...recommendedWorkshopCrews[crew]]).map(id => <div key={id}><CardView card={catalogCardById[id]} fillContainer presentationOnly disableLayout onClick={() => setInspected(catalogCardById[id])}/></div>)}</div>
    </section>
    {inspected && <CardInspector card={inspected} onClose={() => setInspected(null)} />}
  </main>;
}
const queryClient = new QueryClient();
const root = createRoot(document.getElementById('root')!);
root.render(<QueryClientProvider client={queryClient}><Fixture /></QueryClientProvider>);
import.meta.hot?.dispose(() => root.unmount());
