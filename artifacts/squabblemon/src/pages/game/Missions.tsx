import { GameGlyph } from '../../components/venue/GameGlyph';
import { CareerBoard } from './CareerBoard';
import {
  type PlayerBootstrap,
  useClaimPlayerMission,
  getGetPlayerBootstrapQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { Link } from 'wouter';
import { getCardImage } from '../../data';
import { ProgressRing } from '../../components/venue/ProgressRing';
import '../../styles/studio.css';
import '../../styles/hustle-stage.css';

export function Missions({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const claimMission = useClaimPlayerMission(),
    queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null),
    [tab, setTab] = useState<'bounties' | 'mastery'>('bounties');
  const [claiming, setClaiming] = useState<string | null>(null);
  const claimLock = useRef(false);
  async function handleClaim(missionId: string) {
    if (claimLock.current) return;
    claimLock.current = true;
    setClaiming(missionId);
    setError(null);
    try {
      const res = await claimMission.mutateAsync({ missionId });
      queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), res);
    } catch {
      setError('Reward claim failed. Nothing was spent; try again.');
    } finally {
      claimLock.current = false;
      setClaiming(null);
    }
  }
  const ready = bootstrap.missions.filter((m) => m.status === 'claimable').length;
  return (
    <div className="studio-page hustle-stage" data-tab={tab}>
      <header className="hustle-stage__hero">
        <div>
          <span className="studio-eyebrow">The hustle · Make your name</span>
          <h1>
            Leave your
            <br />
            <em>mark.</em>
          </h1>
          <p>
            Make moves. Master your crew.
            <br />
            Collect what’s yours.
          </p>
          <span className="hustle-stage__ready">
            <GameGlyph name="mastery" />
            {ready ? `${ready} ${ready === 1 ? 'reward' : 'rewards'} ready to claim` : 'Every match moves you forward'}
          </span>
        </div>
        <img src={getCardImage('techbro-rich')} alt="" />
      </header>
      <nav className="studio-tabs" aria-label="Progression categories">
        <button aria-pressed={tab === 'bounties'} onClick={() => setTab('bounties')}>
          Bounties
          {ready > 0 && <span className="hustle-stage__count">{ready}</span>}
        </button>
        <button aria-pressed={tab === 'mastery'} onClick={() => setTab('mastery')}>
          Experiments & mastery
        </button>
      </nav>
      {tab === 'mastery' ? (
        <CareerBoard bootstrap={bootstrap} />
      ) : (
        <section className="hustle-stage__objectives" aria-label="Bounties">
          {error && (
            <p className="studio-notice" role="alert">
              {error}
            </p>
          )}
          {!bootstrap.missions.length && (
            <div className="hustle-stage__empty">
              <GameGlyph name="mastery" />
              <h2>The city is quiet. For now.</h2>
              <p>
                {bootstrap.profile.id === 'e2e-player'
                  ? 'Bounties load with your connected account. A practice fight is always open.'
                  : 'Your next set of bounties will appear here.'}
              </p>
              <Link className="studio-text-action" href="/game/play">
                Hit the training circuit
                <ArrowRight size={14} />
              </Link>
            </div>
          )}
          {bootstrap.missions.map((m) => (
            <article className="bounty-line" key={m.id} data-status={m.status}>
              <ProgressRing value={m.progress} max={m.goal} label={`${m.title} progress`}>
                {m.status === 'claimed' ? <Check size={21} /> : `${Math.min(m.progress, m.goal)}/${m.goal}`}
              </ProgressRing>
              <div className="bounty-line__copy">
                <span className="studio-eyebrow">{m.cadence}</span>
                <h2>{m.title}</h2>
                <p>{m.description}</p>
              </div>
              <div className="bounty-line__reward">
                <GameGlyph name={m.rewardCurrency === 'softCurrency' ? 'clout' : 'ticket'} />
                <strong>{m.rewardAmount}</strong>
                <span>{m.rewardCurrency === 'softCurrency' ? 'Clout' : 'Tickets'}</span>
              </div>
              {m.status === 'claimable' ? (
                <button
                  className="studio-action studio-action--gold"
                  onClick={() => void handleClaim(m.id)}
                  disabled={!!claiming}
                  aria-label={`Claim reward for ${m.title}`}
                >
                  {claiming === m.id ? 'Claiming…' : 'Claim reward'}
                  <ArrowRight size={14} />
                </button>
              ) : (
                <span className="bounty-line__status">{m.status === 'claimed' ? 'Claimed' : 'In progress'}</span>
              )}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
