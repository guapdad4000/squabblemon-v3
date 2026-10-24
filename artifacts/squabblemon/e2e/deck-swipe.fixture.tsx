import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DeckCarousel } from '../src/components/DeckCarousel';
import { CompactDeckPicker } from '../src/components/CompactDeckPicker';
import { starterRecipes } from '../src/data';
import '../src/index.css';
const choices = starterRecipes.slice(0, 5).map(deck => ({ id: deck.id, name: deck.name, heroCardId: deck.hero, cardIds: deck.catalogCardIds }));
function Preview() {
  const [selected, setSelected] = useState(choices[0].id);
  const [opened, setOpened] = useState('');
  const compact = new URLSearchParams(location.search).has('compact');
  return <main style={{ minHeight: '100dvh', padding: 20, color: 'white', background: '#101711' }}>
    {compact ? <CompactDeckPicker decks={choices} selectedId={selected} onSelect={setSelected} /> :
      <DeckCarousel decks={choices} selectedId={selected} onSelect={setSelected} onOpen={setOpened} />}
    <output data-testid="selected">{selected}</output><output data-testid="opened">{opened}</output>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
