import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { rankMilestoneRewards, rankProgress, type RankedResult } from '@workspace/squabblemon-engine/ranked';
import { ParkResult } from '../src/components/ParkResult';
import { Dialog } from '../src/components/ui/dialog';
import '../src/index.css';
import '../src/pages/game/gameStyles';
import '../src/styles/venue.css';

type Scenario = { rank?: RankedResult; ranked: boolean; outcome: RankedResult['outcome'] };
function rank(before: number, after: number, outcome: RankedResult['outcome'], rewards?: RankedResult['rewards']): RankedResult {
  return { before, after, delta: after - before, tier: rankProgress(after).tier, outcome, bot: false, ...(rewards ? { rewards } : {}) };
}
// Rewards and tiers use the same engine exports as production. Catch-up grants
// intentionally prove that a positive receipt does not imply a new RP tier.
export const scenarios: Record<string, Scenario> = {
  'same-tier-win': { ranked: true, outcome: 'win', rank: rank(120, 145, 'win') },
  'catch-up-gift': { ranked: true, outcome: 'win', rank: rank(120, 145, 'win', rankMilestoneRewards(0, 145)) },
  'same-tier-loss': { ranked: true, outcome: 'loss', rank: rank(120, 105, 'loss') },
  'same-tier-draw': { ranked: true, outcome: 'draw', rank: rank(120, 125, 'draw') },
  demotion: { ranked: true, outcome: 'loss', rank: rank(100, 85, 'loss') },
  unranked: { ranked: false, outcome: 'win', rank: rank(75, 100, 'win', rankMilestoneRewards(75, 100)) },
  'missing-rank': { ranked: true, outcome: 'win' },
  'promotion-win': { ranked: true, outcome: 'win', rank: rank(75, 100, 'win', rankMilestoneRewards(75, 100)) },
  'promotion-draw': { ranked: true, outcome: 'draw', rank: rank(95, 100, 'draw', rankMilestoneRewards(95, 100)) },
  'promotion-no-gift': { ranked: true, outcome: 'win', rank: rank(75, 100, 'win', []) },
  'promotion-silver': { ranked: true, outcome: 'win', rank: rank(295, 320, 'win', rankMilestoneRewards(295, 320)) },
};
// Match payouts are server-receipt props; these fixtures deliberately include
// capped/ineligible responses and keep milestone gifts separate.
const receipt = { receiptId: 'ranked-clout:fixture-room:1:player', date: '2026-10-24', softCurrency: 50, status: 'saved' as const, dailyLimit: 5, paidMatchesToday: 3, resetsAt: '2026-10-25T00:00:00.000Z' };
scenarios['match-clout-win'] = { ranked: true, outcome: 'win', rank: { ...rank(25, 50, 'win'), matchClout: receipt } };
scenarios['match-clout-draw'] = { ranked: true, outcome: 'draw', rank: { ...rank(25, 30, 'draw'), matchClout: { ...receipt, softCurrency: 20 } } };
scenarios['match-clout-loss'] = { ranked: true, outcome: 'loss', rank: { ...rank(25, 10, 'loss'), matchClout: { ...receipt, softCurrency: 10 } } };
scenarios['match-clout-cap'] = { ranked: true, outcome: 'win', rank: { ...rank(25, 50, 'win'), matchClout: { ...receipt, status: 'daily-limit', softCurrency: 0, paidMatchesToday: 5 } } };
scenarios['match-clout-bot'] = { ranked: true, outcome: 'win', rank: { ...rank(25, 37, 'win'), bot: true, matchClout: { ...receipt, status: 'ineligible', softCurrency: 0, paidMatchesToday: undefined, exclusion: 'bot' } } };
scenarios['match-clout-promotion'] = { ...scenarios['promotion-win'], rank: { ...scenarios['promotion-win'].rank!, matchClout: receipt } };
type FixtureApi = { setScenario: (name: string, resultKey?: string) => void; remount: () => void; close: () => void; open: () => void };
declare global { interface Window { rankPromotionFixture: FixtureApi } }

function Fixture() {
  const params = new URLSearchParams(location.search);
  const [selection, setSelection] = useState({ name: params.get('case') ?? 'same-tier-win', resultKey: params.get('key') ?? 'review-room:1:player' });
  const [generation, setGeneration] = useState(0);
  const [open, setOpen] = useState(true);
  const current = scenarios[selection.name];
  const reduced = params.get('motion') === 'reduce';
  if (!current) throw new Error(`Unknown rank review scenario: ${selection.name}`);
  useEffect(() => {
    window.rankPromotionFixture = {
      setScenario(name, resultKey = selection.resultKey) { setSelection({ name, resultKey }); },
      remount() { setGeneration(value => value + 1); },
      close() { setOpen(false); }, open() { setOpen(true); },
    };
  }, [selection.resultKey]);
  return <div data-testid="rank-promotion-fixture" data-scenario={selection.name} data-result-key={selection.resultKey} style={{ minHeight: '100dvh', background: '#131b15' }}>
    <button type="button" onClick={() => setOpen(true)}>Reopen result</button>
    <Dialog open={open} onOpenChange={setOpen}>
      <ParkResult key={generation} resultKey={selection.resultKey} outcome={current.outcome} ranked={current.ranked} rank={current.rank} reducedMotion={reduced}
        description="Three districts. Six rounds." claimed={current.outcome === 'loss' ? 1 : 2} rivalClaimed={current.outcome === 'win' ? 1 : 2}>
        <button className="online-primary" onClick={() => setOpen(false)}>Back to Fade Park</button>
        <button className="online-secondary" onClick={() => setOpen(false)}>Inspect final board</button>
      </ParkResult>
    </Dialog>
  </div>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Fixture /></React.StrictMode>);
