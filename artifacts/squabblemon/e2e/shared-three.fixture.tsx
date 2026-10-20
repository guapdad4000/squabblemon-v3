import React, { lazy, Suspense, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DeckCarousel } from '../src/components/DeckCarousel';
import { CardFoil } from '../src/components/CardFoil';
import { getCardImage } from '../src/lib/assets';
import '../src/index.css';
import '../src/components/card-finish.css';

const AlleyAvatar = lazy(() => import('../src/components/social/AlleyAvatar').then(module => ({ default: module.AlleyAvatar })));
const decks = [{ id: 'buddy', name: 'Buddy', heroCardId: 'buddy', cardIds: ['buddy'], valid: true }];
function Preview() {
  const [showDeck, setShowDeck] = useState(true);
  const [showFoil, setShowFoil] = useState(false);
  const [showAvatar, setShowAvatar] = useState(false);
  return <main style={{ width: 900, maxWidth: '100%', padding: 16 }}>
    <button onClick={() => setShowDeck(value => !value)}>Toggle deck</button>
    <button onClick={() => setShowFoil(value => !value)}>Toggle foil</button>
    <button onClick={() => setShowAvatar(value => !value)}>Toggle avatar</button>
    <style>{`.fa-avatar__canvas { width: 180px; height: 200px; } .fa-avatar__still { display: none; }`}</style>
    <section style={{ minHeight: 440 }}>{showDeck && <DeckCarousel decks={decks} selectedId="buddy" onSelect={() => {}} onOpen={() => {}} />}</section>
    {showFoil && <div data-card-id="buddy-bud" style={{ position: 'relative', width: 180, height: 240 }}>
      <img alt="Buddy Bud" src={getCardImage('buddy-bud')} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      <CardFoil tier={5} live />
    </div>}
    {showAvatar && <Suspense fallback={<span>Loading avatar</span>}><AlleyAvatar /></Suspense>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
