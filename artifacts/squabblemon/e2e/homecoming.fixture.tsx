import React from 'react';
import { createRoot } from 'react-dom/client';
import { CardView } from '../src/components/CardView';
import { cards } from '../src/data';
import '../src/index.css';

const mode = new URLSearchParams(location.search).get('mode');

createRoot(document.getElementById('root')!).render(<main style={{ minHeight: '100vh', background: '#0b1410', padding: '40px 24px', color: '#f6d77d' }}>
  <p style={{ font: 'bold 12px monospace', letterSpacing: 3 }}>SQUABBLEMON / ROSTER ARRIVALS</p>
  <h1 style={{ fontSize: 40, fontWeight: 900, margin: '12px 0 30px' }}>Fresh faces on the block.</h1>
  <section style={{ display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'center' }}>
    {['counter', 'concrete', 'lola', 'repoman', 'madhatter'].map(id => <div key={id} style={{ width: 245 }}>
      <CardView card={cards[id]} presentationOnly disableLayout inspectable={false} isInspector={!mode} fillContainer={!mode} isBoard={mode === 'board'} />
      <p style={{ marginTop: 15, fontSize: 12 }}>{id === 'counter' ? 'Replaces Counter · ownership preserved' : id === 'concrete' ? 'Replaces Concrete · ownership preserved' : 'New character · Street Packs'}</p>
    </div>)}
  </section>
</main>);
