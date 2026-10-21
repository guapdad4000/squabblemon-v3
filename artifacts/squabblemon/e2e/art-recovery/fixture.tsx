import {getBattleArtCues} from '@workspace/squabblemon-engine/battleArtwork';
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Battle } from '../../src/components/Battle';
import { CardInspector } from '../../src/components/CardInspector';
import { decks } from '../../src/data';
import { createCardInstance, type CardInstance, type Lane } from '../../src/gameEngine';
import { createArtworkReviewMatch, artworkEffectScenario } from './state';
import '../../src/index.css';
const params = new URLSearchParams(location.search);
const kind = params.get('cue');
const match = kind ? artworkEffectScenario(kind) : createArtworkReviewMatch();
if (params.has('crowded')) for (const lane of [0,1,2] as const) for (const owner of ['player','cpu'] as const) for (let i=0;i<12;i++) match.boards[lane].push({...createCardInstance('hooper',owner,`crowd-${lane}`,i),lane});
const effect = kind ? match.effectLog.findLast(e => getBattleArtCues(e).some(c => c.kind===kind)) : undefined;

const noop = () => {};
function App() {
  const [selected, setSelected] = useState<string | null>(null);
  const [lane, setLane] = useState<Lane | null>(null);
  const [inspect, setInspect] = useState<CardInstance | null>(null);
  return <div style={{ height: '100dvh', color: 'white' }}>
    <Battle match={match} deck={decks[0]} rivalDeck={decks[0]}
      selectedInstanceId={selected} setSelectedInstanceId={setSelected} selectedLane={lane} setSelectedLane={setLane}
      commit={noop} skipSequence={noop} presentationPhase={effect ? "effects" : "player-ready"} activeEffect={effect ? {...effect,targetIds:effect.targets.map(t=>t.cardInstanceId),impact:!params.has('windup')} : null} phaseMessage="Your move"
      timerSeconds={20} timerEnabled={false} impactLane={null} squabble={false} setSquabble={noop} setInspect={setInspect} onShowRules={noop} />
    {inspect && <CardInspector card={inspect} match={match} onClose={() => setInspect(null)} />}
  </div>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><App /></QueryClientProvider>);
