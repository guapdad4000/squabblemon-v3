import React from 'react';
import { createRoot } from 'react-dom/client';
import { cardCatalog } from '../src/data';
import { CardView } from '../src/components/CardView';
import '../src/index.css';

const requestedCard = new URLSearchParams(location.search).get('card');
// Local card presentation fixture; does not touch account or reward state.
createRoot(document.getElementById('root')!).render(<main style={{ background: '#171918', padding: 24, maxWidth: requestedCard ? 440 : undefined, minHeight: '100vh', color: 'white' }}>
  <h1 style={{ fontSize: 28, marginBottom: 20 }}>Around the Block · 11 Commons</h1>
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 20 }}>
    {cardCatalog.filter(card => requestedCard ? card.engineId === requestedCard : card.faction === 'Around the Block').map(card => <div key={card.id}>
      <CardView card={card} isInspector fillContainer presentationOnly disableLayout />
      <p style={{ marginTop: 8 }}>{card.name}</p>
    </div>)}
  </div>
</main>);
