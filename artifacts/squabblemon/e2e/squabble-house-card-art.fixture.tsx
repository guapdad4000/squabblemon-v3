import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CardView } from '../src/components/CardView';
import { cardCatalog } from '../src/data';
import '../src/index.css';

const houseIds = [
  'squabble-house-manager', 'squabbleserver', 'squabblecook', 'janitor',
  'squabblehouse-bus-boy', 'squabblehouse-cashier', 'squabblehouse-security',
  'squabblehouse-teknician', 'griddle-master', 'waffle-warlord',
];
const cards = houseIds.map(id => {
  const card = cardCatalog.find(item => item.engineId === id);
  if (!card) throw new Error(`Missing Squabble House card: ${id}`);
  return card;
});

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={new QueryClient()}>
    <main style={{ minHeight: '100vh', padding: 28, background: '#10130f', color: '#f7e7be', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 22 }}>Squabble House card art review</h1>
      <section aria-label="Squabble House cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 24, maxWidth: 1250 }}>
        {cards.map(card => <div key={card.id} style={{ maxWidth: 230 }}>
          <CardView card={card} fillContainer presentationOnly disableLayout />
          <p style={{ marginTop: 8, fontSize: 13 }}>{card.name}</p>
        </div>)}
      </section>
      <h2 style={{ fontSize: 20, fontWeight: 800, margin: '32px 0 16px' }}>Inspector framing</h2>
      <section aria-label="Squabble House inspector cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(235px, 1fr))', gap: 24, maxWidth: 1250 }}>
        {cards.map(card => <div key={card.id} style={{ maxWidth: 290 }}>
          <CardView card={card} isInspector presentationOnly disableLayout className="w-full aspect-[63/88]" />
          <p style={{ marginTop: 8, fontSize: 13 }}>{card.name}</p>
        </div>)}
      </section>
      <h2 style={{ fontSize: 20, fontWeight: 800, margin: '32px 0 16px' }}>Hand and board sizes</h2>
      <section aria-label="Squabble House battle cards" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'start', gap: 28, maxWidth: 1250 }}>
        {cards.slice(0, 4).map(card => <div key={card.id} style={{ display: 'flex', alignItems: 'start', gap: 8 }}>
          <CardView card={card} presentationOnly disableLayout />
          <CardView card={card} isBoard presentationOnly disableLayout />
        </div>)}
      </section>
    </main>
  </QueryClientProvider>,
);
