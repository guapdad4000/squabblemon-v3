import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Battle } from '../../src/components/Battle';
import { CardInspector } from '../../src/components/CardInspector';
import { decks } from '../../src/data';
import { type CardInstance, type Lane } from '../../src/gameEngine';
import { createArtworkReviewMatch } from './state';
import '../../src/index.css';
const match = createArtworkReviewMatch();
const noop = () => {};
function App() {
  const [selected, setSelected] = useState<string | null>(null);
  const [lane, setLane] = useState<Lane | null>(null);
  const [inspect, setInspect] = useState<CardInstance | null>(null);
  return <div style={{ height: '100dvh', color: 'white' }}>
    <Battle match={match} deck={decks[0]} rivalDeck={decks[0]}
      selectedInstanceId={selected} setSelectedInstanceId={setSelected} selectedLane={lane} setSelectedLane={setLane}
      commit={noop} skipSequence={noop} presentationPhase="player-ready" phaseMessage="Your move"
      timerSeconds={20} timerEnabled={false} impactLane={null} squabble={false} setSquabble={noop} setInspect={setInspect} onShowRules={noop} />
    {inspect && <CardInspector card={inspect} match={match} onClose={() => setInspect(null)} />}
  </div>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><App /></QueryClientProvider>);
