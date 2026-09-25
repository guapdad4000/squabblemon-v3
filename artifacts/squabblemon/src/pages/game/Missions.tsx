import { revealProfileRewards } from '../../lib/rewardReceipts';
import { GameGlyph } from '../../components/venue/GameGlyph';
import { CareerBoard } from './CareerBoard';
import {
  type PlayerBootstrap,
  useClaimPlayerMission,
  getGetPlayerBootstrapQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState, useEffect } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { Link } from 'wouter';
import { getAssetUrl } from '../../lib/assets';
import { ProgressRing } from '../../components/venue/ProgressRing';
import '../../styles/studio.css';
import '../../styles/hustle-stage.css';
import '../../styles/bounty-hunter.css';

type BountyPhase = 'idle' | 'loading' | 'firing' | 'impact';

export function Missions({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const claimMission = useClaimPlayerMission(),
    queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null),
    [tab, setTab] = useState<'bounties' | 'mastery'>(() =>
      new URLSearchParams(window.location.search).get('view') === 'mastery' ? 'mastery' : 'bounties');

  const [claimState, setClaimState] = useState<{ id: string; phase: BountyPhase } | null>(null);

  const claimLock = useRef(false);
  const timerRef = useRef<number | null>(null);
  const mountedRef = useRef(false);
  const finishRef = useRef<(() => void) | null>(null);
  const boardRef = useRef<HTMLElement>(null);
  const lastClaimRef = useRef<string | null>(null);
  const profileReducedMotion = bootstrap.profile.settings.reducedMotion;

  useEffect(() => {
    if (!error || !lastClaimRef.current) return;
    // A new error notice must not move the retry button behind the gun footer.
    boardRef.current
      ?.querySelector<HTMLElement>(`[data-mission-id="${CSS.escape(lastClaimRef.current)}"]`)
      ?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
  }, [error]);

  useEffect(() => {
    mountedRef.current = true;
    const finishWhenHidden = () => {
      if (document.hidden) finishRef.current?.();
    };
    const finishOnPageHide = () => finishRef.current?.();
    document.addEventListener('visibilitychange', finishWhenHidden);
    window.addEventListener('pagehide', finishOnPageHide);
    return () => {
      mountedRef.current = false;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      finishRef.current = null;
      document.removeEventListener('visibilitychange', finishWhenHidden);
      window.removeEventListener('pagehide', finishOnPageHide);
    };
  }, []);

  async function handleClaim(missionId: string) {
    if (claimLock.current || !bootstrap.missions.some(m => m.id === missionId && m.status === 'claimable')) return;
    claimLock.current = true;
    lastClaimRef.current = missionId;
    setError(null);
    setClaimState({ id: missionId, phase: 'loading' });
    boardRef.current
      ?.querySelector<HTMLElement>(`[data-mission-id="${CSS.escape(missionId)}"]`)
      ?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });

    try {
      const res = await claimMission.mutateAsync({ missionId });
      // The authoritative result must survive navigation during the cosmetic shot.
      queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), res);
      if (!mountedRef.current) {
        claimLock.current = false;
        return;
      }

      const doReveal = () => {
        if (!mountedRef.current || finishRef.current !== doReveal) return;
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
        timerRef.current = null;
        finishRef.current = null;
        claimLock.current = false;
        setClaimState(null);
        revealProfileRewards(bootstrap, res, missionId, 'Bounty collected');
      };
      finishRef.current = doReveal;
      const reducedMotion = profileReducedMotion
        || window.matchMedia('(prefers-reduced-motion: reduce)').matches
        || document.documentElement.dataset.reduceMotion === 'true';

      if (reducedMotion || document.hidden) {
        doReveal();
        return;
      }

      setClaimState({ id: missionId, phase: 'firing' });
      timerRef.current = window.setTimeout(() => {
        if (!mountedRef.current) return;
        setClaimState({ id: missionId, phase: 'impact' });
        timerRef.current = window.setTimeout(doReveal, 800);
      }, 220);

    } catch {
      claimLock.current = false;
      if (mountedRef.current) {
        setError('Reward claim failed. Nothing was spent; try again.');
        setClaimState(null);
      }
    }
  }

  const ready = bootstrap.missions.filter((m) => m.status === 'claimable').length;

  return (
    <section ref={boardRef} className="bounty-hunter-page world-decor-host" data-tab={tab} data-reduced-motion={profileReducedMotion} aria-label="Bounties" aria-busy={!!claimState} data-testid="bounty-board">
      {tab === 'bounties' && (
        <div className="bounty-hunter__backdrop-container">
          <img className="bounty-hunter__backdrop" src={getAssetUrl('assets/bounty-hunter/yard.webp')} alt="" />
        </div>
      )}

      <div className="bounty-hunter__scroll" data-testid="bounty-scroll">
      <header className="bounty-hunter__hero">
        <h1 className="sr-only">Bounty Hunter</h1>
        <div className="bounty-hunter__hero-content">
          <img className="bounty-hunter__logo" src={getAssetUrl('assets/bounty-hunter/hero.webp')} alt="Bounty Hunter" draggable={false} />
          {tab === 'bounties' && (
            <span className="bounty-hunter__ready">
              <GameGlyph name="mastery" />
              {ready ? `${ready} ${ready === 1 ? 'reward' : 'rewards'} ready to claim` : 'Every fade moves you forward'}
            </span>
          )}
        </div>
      </header>

      <nav className="studio-tabs" aria-label="Progression categories">
        <button aria-pressed={tab === 'bounties'} onClick={() => { if (!claimLock.current) setTab('bounties'); }} disabled={claimLock.current}>
          Bounties
          {ready > 0 && <span className="hustle-stage__count">{ready}</span>}
        </button>
        <button aria-pressed={tab === 'mastery'} onClick={() => { if (!claimLock.current) setTab('mastery'); }} disabled={claimLock.current}>
          Experiments & mastery
        </button>
      </nav>

      {tab === 'mastery' ? (
        <div style={{ marginTop: 24, position: 'relative', zIndex: 10 }}>
          <CareerBoard bootstrap={bootstrap} />
        </div>
      ) : (
        <div className="bounty-ledger-layout">
        <aside className="bounty-ledger" aria-label="Your bounty stats"><span>YOUR RECORD</span><h2>Work speaks.</h2><dl><div><dt>Collected this cycle</dt><dd>{bootstrap.missions.filter(m => m.status === 'claimed').length}</dd></div><div><dt>Ready to collect</dt><dd>{ready}</dd></div><div><dt>Street reputation</dt><dd>{bootstrap.profile.streetRep.toLocaleString()}</dd></div><div><dt>Achievements earned</dt><dd>{bootstrap.profile.unlockedCosmeticIds.filter(id => /^(badge|mastery):/.test(id)).length}</dd></div></dl></aside>
        <section className="bounty-hunter__board" aria-label="Bounty posters">
          <img className="bounty-hunter__wall" src={getAssetUrl('assets/bounty-hunter/wall.webp')} alt="" />

          <div className="bounty-hunter__posters">
            {error && (
              <div className="bounty-hunter__error-bar" role="alert">
                <p className="studio-notice" style={{ color: '#fca5a5' }}>{error}</p>
              </div>
            )}

            {!bootstrap.missions.length && (
              <div className="bounty-hunter__empty">
                <GameGlyph name="mastery" />
                <h2>The city is quiet.</h2>
                <p>
                  {bootstrap.profile.id === 'e2e-player'
                    ? 'Bounties load with your connected account. A practice fight is always open.'
                    : 'Your next set of bounties will appear here soon.'}
                </p>
                <Link className="studio-text-action" href="/game/training">
                  Hit the training circuit
                  <ArrowRight size={14} />
                </Link>
              </div>
            )}

            {bootstrap.missions.map((m) => {
              const isActive = claimState?.id === m.id;
              const hasImpact = isActive && claimState.phase === 'impact';
              // Keep the damage with the saved claim, but not before the shot lands.
              const hasBulletHole = hasImpact || (m.status === 'claimed' && !isActive);

              return (
                <article
                  className="bounty-poster"
                  key={m.id}
                  data-status={m.status}
                  data-testid="bounty-poster"
                  data-mission-id={m.id}
                >
                  {hasBulletHole && (
                    <img
                      src={getAssetUrl('assets/bounty-hunter/impact.webp')}
                      className={`bounty-impact${hasImpact ? ' bounty-impact--fresh' : ''}`}
                      alt=""
                      data-testid={hasImpact ? 'bounty-impact' : 'bounty-bullet-hole'}
                    />
                  )}
                  <div className="bounty-poster__header">
                    <div className="bounty-poster__copy">
                      <span className="studio-eyebrow">{m.cadence}</span>
                      <h2>{m.title}</h2>
                    </div>
                    <div className="bounty-poster__progress">
                      <ProgressRing value={m.progress} max={m.goal} label={`${m.title} progress`}>
                        {m.status === 'claimed' ? <Check size={21} /> : <span className="bounty-poster__progress-text">{Math.min(m.progress, m.goal)}/{m.goal}</span>}
                      </ProgressRing>
                    </div>
                  </div>

                  <p>{m.description}</p>

                  <div className="bounty-poster__reward">
                    <GameGlyph name={m.rewardCurrency === 'softCurrency' ? 'clout' : 'ticket'} />
                    <div>
                      <strong>{m.rewardAmount}</strong>
                      <div className="bounty-poster__reward-label">{m.rewardCurrency === 'softCurrency' ? 'Clout' : 'Tickets'}</div>
                    </div>
                  </div>

                  <div className="bounty-poster__action">
                    {m.status === 'claimable' ? (
                      <button
                        className="studio-action"
                        onClick={() => void handleClaim(m.id)}
                        disabled={claimLock.current}
                        aria-label={`Claim reward for ${m.title}`}
                      >
                        {isActive && claimState.phase === 'loading' ? 'Loading...' : 'Claim Bounty'}
                      </button>
                    ) : (
                      <div className="bounty-poster__status">
                        {m.status === 'claimed' ? 'Collected' : 'In Progress'}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
        </div>
      )}
      </div>
      {tab === 'bounties' && (
          <div className="bounty-hunter__pov" data-phase={claimState?.phase || 'idle'} data-testid="bounty-pistol" aria-hidden="true">
            <div className="bounty-hunter__pov-inner">
              <img
                className="bounty-hunter__pistol bounty-hunter__pistol--idle"
                src={getAssetUrl('assets/bounty-hunter/pistol-idle.webp')}
                alt=""
              />
              <img
                className="bounty-hunter__pistol bounty-hunter__pistol--fired"
                src={getAssetUrl('assets/bounty-hunter/pistol-fired.webp')}
                alt=""
              />
            </div>
          </div>
      )}
    </section>
  );
}
