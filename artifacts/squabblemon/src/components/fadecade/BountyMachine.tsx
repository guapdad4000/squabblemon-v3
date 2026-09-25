import { ItemDot } from '../Notifications';
import { useState } from 'react';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import { useClaimPlayerMission, getGetPlayerBootstrapQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { ArcadeCabinet } from './MachineScreen';
import { FadecadeDialog } from './FadecadeDialog';
import { revealProfileRewards } from '../../lib/rewardReceipts';

export function BountyMachine({ bootstrap, cadence }: { bootstrap: PlayerBootstrap; cadence: 'daily' | 'weekly' }) {
  const claimMission = useClaimPlayerMission();
  const queryClient = useQueryClient();
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missions = bootstrap.missions.filter(m => m.cadence === cadence);

  async function handleClaim(missionId: string) {
    if (claimingId) return;
    setClaimingId(missionId);
    setError(null);
    try {
      const res = await claimMission.mutateAsync({ missionId });
      queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), res);
      setIsOpen(false);
      revealProfileRewards(bootstrap, res, missionId, 'Bounty collected');
    } catch {
      setError('The reward could not be confirmed. Try claiming again; already saved rewards cannot be paid twice.');
    } finally {
      setClaimingId(null);
    }
  }

  const artUrl = cadence === 'daily' ? 'assets/fadecade/daily.webp' : 'assets/fadecade/weekly.webp';
  const aspectRatio = cadence === 'daily' ? 1.3527 : 1.3588;
  const aperture = cadence === 'daily'
    ? { left: '16.74%', top: '28.66%', width: '68%', height: '51.7%' }
    : { left: '16.91%', top: '27.62%', width: '67.8%', height: '51.61%' };

  return (
    <div className="fadecade-machine-group">
      <ArcadeCabinet
        artUrl={artUrl}
        aspectRatio={aspectRatio}
        aperture={aperture}
        testId={`fadecade-${cadence}`}
        className="machine-small"
      >
        <div className="cabinet-ui">
          <h3 className="cabinet-title">{cadence} Bounties</h3>
          <span className="cabinet-notice">{missions.filter(m => m.status === 'claimable').length} ready to collect</span>
          <button
            className="cabinet-btn"
            onClick={() => setIsOpen(!isOpen)}
            aria-label={`${isOpen ? 'Close' : 'Open'} ${cadence} bounties`}
            aria-expanded={isOpen}
            aria-controls={`bounties-${cadence}`}
          >
            {isOpen ? 'CLOSE' : 'OPEN'}
          </button>
        </div>
      </ArcadeCabinet>

      <FadecadeDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        title={`${cadence} Bounties`}
        kind={cadence}
      >
        <div className="fadecade-panel" id={`bounties-${cadence}`} data-testid={`panel-${cadence}`}>
          {error && <p role="alert" className="fadecade-error">{error}</p>}
          {missions.length === 0 ? (
            <p className="cabinet-notice" style={{ margin: 0 }}>No bounties on the board yet. Check back after the next refresh.</p>
          ) : (
            missions.map(m => (
              <div key={m.id} className="bounty-item" data-status={m.status}>
                <span className="bounty-title" title={m.title}>{m.title}<ItemDot id={`mission:${m.id}:${m.resetAt ?? 'permanent'}`} /></span>
                <p className="fadecade-bounty-description">{m.description}</p>
                <span className="challenge-reward">{m.rewardAmount} {m.rewardCurrency === 'softCurrency' ? 'Clout' : 'Tickets'}</span>
                <div className="bounty-track" role="progressbar" aria-label={m.title} aria-valuemin={0} aria-valuemax={Math.max(1, m.goal)} aria-valuenow={Math.max(0, Math.min(m.progress, m.goal))}>
                  <div className="bounty-fill" style={{ width: `${Math.min(100, (Math.max(0, m.progress) / Math.max(1, m.goal)) * 100)}%` }} />
                </div>
                {m.status === 'claimable' ? (
                  <button
                    className="cabinet-btn cabinet-btn--outline"
                    disabled={!!claimingId}
                    onClick={() => void handleClaim(m.id)}
                    aria-label={`Claim ${m.title}`}
                  >
                    {claimingId === m.id ? 'Collecting…' : 'COLLECT REWARD'}
                  </button>
                ) : (
                  <span className="cabinet-notice" style={{ textAlign: 'left' }}>
                    {m.status === 'claimed' ? 'COLLECTED' : `${Math.min(m.progress, m.goal)} / ${m.goal}`}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </FadecadeDialog>
    </div>
  );
}
