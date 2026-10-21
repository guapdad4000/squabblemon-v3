import {getBattleArtCues} from '@workspace/squabblemon-engine/battleArtwork';
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Battle } from '../../src/components/Battle';
import { CardInspector } from '../../src/components/CardInspector';
import { decks } from '../../src/data';
import { createCardInstance, getMatchDistricts, getDistrictResults, getLegalCardCost, type CardInstance, type Lane } from '../../src/gameEngine';
import { createArtworkReviewMatch, artworkEffectScenario } from './state';
import '../../src/index.css';
const params = new URLSearchParams(location.search);
const kind = params.get('cue');
const match = kind ? artworkEffectScenario(kind) : createArtworkReviewMatch();
if (params.has('spent')) match.squabbleUsed = true;
if (params.has('crowded')) for (const lane of [0,1,2] as const) for (const owner of ['player','cpu'] as const) for (let i=0;i<12;i++) match.boards[lane].push({...createCardInstance('hooper',owner,`crowd-${lane}`,i),lane});
const effect = kind ? match.effectLog.findLast(e => getBattleArtCues(e).some(c => c.kind===kind)) : undefined;

const noop = () => {};
function App() {
  const [selected, setSelected] = useState<string | null>(null);
  const [lane, setLane] = useState<Lane | null>(null);
  const [inspect, setInspect] = useState<CardInstance | null>(null);
  const [squabble, setSquabble] = useState(false);
  const [commits, setCommits] = useState(0);
  const online = params.has('pvp') ? {
    districts: getMatchDistricts(match), scores: getDistrictResults(match),
    costs: Object.fromEntries(match.playerHand.map(card => [card.instanceId, [0,1,2].map(lane => getLegalCardCost(match,'player',card,lane as Lane)) as [number,number,number]])),
    lockedLanes: [], covered: new Set<string>(), history: [], turnSeconds: 20,
    clockRunning: false, yourTurn: true, mode: 'ranked', status: 'Your move', rivalHandCount: 4,
    playerIdentity: {name:'Review Fighter',hero:'buddy'}, rivalIdentity:{name:'Assigned Rival',hero:'queen-of-hearts'},
  } : undefined;
  return <div style={{ height: '100dvh', color: 'white' }}>
    <output hidden data-testid="review-commits">{commits}</output>
    <Battle match={match} deck={decks[0]} rivalDeck={decks[0]} online={online}
      selectedInstanceId={selected} setSelectedInstanceId={setSelected} selectedLane={lane} setSelectedLane={setLane}
      commit={() => setCommits(value => value + 1)} skipSequence={noop} presentationPhase={effect ? "effects" : "player-ready"} activeEffect={effect ? {...effect,targetIds:effect.targets.map(t=>t.cardInstanceId),impact:!params.has('windup')} : null} phaseMessage="Your move"
      timerSeconds={20} timerEnabled={false} impactLane={null} squabble={squabble} setSquabble={setSquabble} setInspect={setInspect} onShowRules={noop} />
    {inspect && <CardInspector card={inspect} match={match} onClose={() => setInspect(null)} />}
  </div>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><App /></QueryClientProvider>);
