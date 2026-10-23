import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DeckCarousel } from '../src/components/DeckCarousel';
import { CardView } from '../src/components/CardView';
import { StreetSelect } from '../src/components/ui/street-select';
import { AnimatedNumber } from '../src/components/AnimatedNumber';
import { createCardInstance } from '../src/gameEngine';
import { decks, catalogCardByEngineId } from '../src/data';
import '../src/index.css';
import './blzee-type.fixture.css';

const lineup = decks.slice(0, 4).map(d => ({ id: d.id, name: d.name, heroCardId: d.hero, cardIds: d.cards.map(id => catalogCardByEngineId[id].catalogId) }));
const cards = ['folks', 'guap', 'transplant', 'roaster'];
function Preview() {
  const [deck, setDeck] = useState(lineup[0].id);
  const [names, setNames] = useState(true);
  const [sign, setSign] = useState('district');
  const [score, setScore] = useState(14);
  return <main className="blzee-preview" data-card-lettering={names ? 'blzee' : 'classic'}>
    <header><div><p className="preview-label">SQUABBLEMON / LETTERING</p><h1>BLZEE</h1></div><a href="./supplied-battle-fx.fixture.html">Open battle ↗</a></header>
    <div className="preview-signs">
      <StreetSelect aria-label="Street sign sample" value={sign} onValueChange={setSign}><option value="district">PICK DISTRICT</option><option value="turn">END TURN</option><option value="waiting">RIVAL'S TURN</option></StreetSelect>
      <div className="preview-counter"><span className="preview-label">HANDS</span><AnimatedNumber value={score}/><button onClick={() => setScore(s => s + 1)} aria-label="Add one Hand">+1</button></div>
      <label className="preview-toggle"><input type="checkbox" checked={names} onChange={e => setNames(e.target.checked)}/>Blzee card names</label>
    </div>
    <DeckCarousel decks={lineup} selectedId={deck} onSelect={setDeck} onOpen={setDeck} openLabel="View deck"/>
    <section className="preview-cards" aria-label="Card titles and original bold stats">{cards.map((id, i) => <div key={id}><CardView card={createCardInstance(id, 'player', 'hand', i)} presentationOnly disableLayout/></div>)}</section>
    <p className="preview-caption">Painted signs, battlefield values and titles. Bold card stats.</p>
  </main>;
}
const root = createRoot(document.getElementById('root')!);
const query = new QueryClient({defaultOptions:{queries:{retry:false}}});
root.render(<QueryClientProvider client={query}><Preview/></QueryClientProvider>);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
