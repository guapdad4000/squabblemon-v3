import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DeckWorkbench } from '../src/components/DeckWorkbench';
import { ROOKIE_CORE_IDS, ROOKIE_DECK_ID, ROOKIE_FOUNDATION_IDS } from '../src/data';
import '../src/index.css';
import '../src/styles/venue.css';
import '../src/styles/dr-fade.css';

// The saved rookie lineup new players receive: the mentor takes hooper's slot,
// which puts Rastamon in the highlighted sixth slot the lesson asks players to tap.
const MENTOR_LINEUP = ROOKIE_CORE_IDS.map(id => (id === 'hooper' ? 'dr-fade' : id));

function WorkbenchLesson() {
  const [saved, setSaved] = useState('');
  return <div style={{ height: '100dvh', color: 'white' }}>
    {saved && <div data-testid="lesson-saved" style={{ position: 'fixed', inset: 0, zIndex: 20000, display: 'grid', placeItems: 'center', background: '#07100e' }}>{saved}</div>}
    <DeckWorkbench
      initial={{ id: ROOKIE_DECK_ID, name: 'My First Crew', cardIds: [...MENTOR_LINEUP], heroCardId: 'dr-fade' } as any}
      ownedCardIds={ROOKIE_FOUNDATION_IDS}
      equippedVariants={{}}
      lesson
      onSave={async () => { setSaved('SAVED'); }}
      onTest={async () => { setSaved('TESTED'); }}
    />
  </div>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient()}>
  <WorkbenchLesson />
</QueryClientProvider>);
