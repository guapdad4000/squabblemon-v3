import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { customFetch, getGetPlayerBootstrapQueryKey, type PlayerBootstrap } from '@workspace/api-client-react';
import { getAssetUrl } from '../lib/assets';
import { GameGlyph } from './venue/GameGlyph';
import '../styles/anunaki-event.css';

type MilestoneId = string;
type Reward = { kind: 'card' | 'sticker-pack' | 'player-mat' | 'deck-cover' | 'currency' | 'tickets'; id: string; label: string; artwork: string };
type Milestone = { id: MilestoneId; title: string; requirement: string; progress: number; target: number; state: 'locked' | 'ready' | 'claimed'; ownsReward: boolean; chapter: number; optional: boolean; reward: Reward };
type EventStatus = { available: boolean; reason?: string; milestones: Milestone[] };
type ClaimResult = { claimed: boolean; duplicateShards: number; status: EventStatus; bootstrap: PlayerBootstrap; receiptLabel?: string };
const art = (name: string) => getAssetUrl(`assets/anunaki-event/${name}.webp`);
// Event metadata names only bundled public assets; reject traversal or external URLs.
const rewardArt = (path: string) => /^assets\/[a-zA-Z0-9_./-]+$/.test(path) && !path.split('/').some(part => part === '..' || part === '.') ? getAssetUrl(path) : art('tablet');
const rewardKindLabel: Record<Reward['kind'], string> = { card:'CHARACTER', 'sticker-pack':'STICKER PACK', 'player-mat':'PLAYER MAT', 'deck-cover':'DECK COVER', currency:'CLOUT', tickets:'PACK TICKETS' };
function journeyPath(count: number) {
  if (!count) return '';
  let path = 'M 28 50';
  for (let index = 1; index < count; index++) {
    const from = index % 2 ? 28 : 72, to = index % 2 ? 72 : 28;
    const y = index * 100 + 50;
    path += ` C ${from} ${y - 50}, ${to} ${y - 50}, ${to} ${y}`;
  }
  return path;
}

/** A server-backed event journey. The client never grants cards or calculates eligibility. */
export function AnunakiEvent({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const client = useQueryClient();
  const key = ['anunaki-event', bootstrap.profile.id];
  const query = useQuery({ queryKey: key, queryFn: () => customFetch<EventStatus>('/api/player/rewards/anunaki-event'), retry: 1 });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<MilestoneId | null>(null);
  const [error, setError] = useState<{ id: string; text: string } | null>(null);
  const [notice, setNotice] = useState<{ id: string; text: string } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const claimLock = useRef<symbol | null>(null);
  const activePlayer = useRef(bootstrap.profile.id);
  useLayoutEffect(() => {
    activePlayer.current = bootstrap.profile.id;
    claimLock.current = null;
    setBusy(null); setOpen(false); setError(null); setNotice(null);
    return () => { activePlayer.current = ''; claimLock.current = null; };
  }, [bootstrap.profile.id]);
  useEffect(() => {
    if (open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (!dialog.current?.open) dialog.current?.showModal();
    } else {
      dialog.current?.close();
      if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
    }
  }, [open]);
  async function claim(id: MilestoneId) {
    if (claimLock.current || !query.data?.available || query.data.milestones.find(step => step.id === id)?.state !== 'ready') return;
    const request = Symbol('anunaki-claim');
    claimLock.current = request; setBusy(id); setError(null); setNotice(null);
    const player = bootstrap.profile.id;
    try {
      const result = await customFetch<ClaimResult>('/api/player/rewards/anunaki-event/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ milestoneId: id }) });
      if (activePlayer.current !== player || claimLock.current !== request) return;
      client.setQueryData(key, result.status);
      client.setQueryData(getGetPlayerBootstrapQueryKey(), result.bootstrap);
      setNotice({ id, text: result.claimed ? `${result.receiptLabel || 'Reward collected.'}${result.duplicateShards ? ` You received ${result.duplicateShards} Style Shards for your duplicate.` : ''}` : 'This reward was already collected.' });
    } catch (reason) {
      if (activePlayer.current === player && claimLock.current === request) setError({ id, text: reason instanceof Error ? reason.message : 'Could not save your reward. Please try again.' });
    } finally { if (claimLock.current === request) { claimLock.current = null; if (activePlayer.current === player) setBusy(null); } }
  }
  const data = query.data;
  return <>
    <button type="button" className="anunaki-banner" onClick={() => setOpen(true)} style={{ backgroundImage: `linear-gradient(90deg, #071d20f5, #071d20c9 52%, #071d2033), url("${art('journey')}")` }}>
      <img src={art('tablet')} alt="" />
      <span className="anunaki-banner__copy"><small>THE ANUNAKI ARRIVAL · EVENT ROADMAP</small><strong>Follow the<br />ancient text<span>.</span></strong><span>8 chapters. 24 rewards. One journey through time.</span><b>Explore the journey <span aria-hidden="true">↗</span></b></span>
    </button>
    <dialog ref={dialog} className="anunaki-event" aria-labelledby="anunaki-event-title" onCancel={() => setOpen(false)} onClose={() => setOpen(false)}>
      <button className="anunaki-event__close" type="button" onClick={() => setOpen(false)} aria-label="Close Anunaki event">×</button>
      <header className="anunaki-event__hero" style={{ backgroundImage: `linear-gradient(90deg, #061b1cf7 5%, #061b1cd9 45%, #061b1c33), url("${art('journey')}")` }}>
        <span className="anunaki-event__kicker">SQUABBLEMON PRESENTS / AN EVENT THROUGH TIME</span>
        <h2 id="anunaki-event-title">The Anunaki<br /><em>Arrival</em></h2>
        <p>A janky time machine. An ancient arrival. Follow the trail and recruit the crew.</p>
        <span className="anunaki-event__seal" aria-hidden="true">TIME<br />TRAVEL<br /><b>{data ? `01—${String(data.milestones.length).padStart(2, '0')}` : 'THE JOURNEY'}</b></span>
      </header>
      <div className="anunaki-event__body" style={{ backgroundImage: `linear-gradient(180deg, #09251fc9, #09251fd9), url("${art('journey')}")` }}>
        <div className="anunaki-event__section-head"><div><span>THE ANCIENT ROAD / REWARDS AHEAD</span><h3>Follow the<br /><em>ancient text.</em></h3></div><p>Eight chapters.<br />Three rewards each.<br /><b>Mastery is your choice.</b></p></div>
        {query.isPending ? <p className="anunaki-event__message" role="status">Checking your journey…</p> : query.isError ? <div className="anunaki-event__message" role="alert">Could not load the event. <button type="button" onClick={() => void query.refetch()}>Try again</button></div> : <>
          {!data?.available && <p className="anunaki-event__message" role="status">{data?.reason || 'This event is not available yet. Check back for the journey.'}</p>}
          <nav className="anunaki-chapter-jumps" aria-label="Jump to a roadmap chapter">{Array.from({length:8},(_,i)=><button key={i} type="button" onClick={()=>dialog.current?.querySelector(`[data-milestone-id="${data?.milestones[i*3]?.id}"]`)?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",block:"start"})}>CH {String(i+1).padStart(2,"0")}</button>)}</nav>
          <div className="anunaki-roadmap-scene">
            <svg className="anunaki-roadmap__path" viewBox={`0 0 100 ${Math.max(1, data?.milestones.length ?? 0) * 100}`} preserveAspectRatio="none" aria-hidden="true"><path d={journeyPath(data?.milestones.length ?? 0)} /></svg>
          <ol className="anunaki-roadmap" aria-label="Anunaki event rewards">
            {data?.milestones.map((step, index) => {
              const progress = Math.max(0, Math.min(step.progress, step.target));
              return <li className="anunaki-roadmap__step" key={step.id} data-milestone-id={step.id} data-state={step.state} data-reward-kind={step.reward.kind}>
                <span className="anunaki-roadmap__number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <div className="anunaki-roadmap__portrait"><span className="anunaki-roadmap__flare" aria-hidden="true" /><img className="anunaki-roadmap__reward-art" src={rewardArt(step.reward.artwork)} alt="" loading="lazy" />{(step.reward.kind === 'currency' || step.reward.kind === 'tickets') && <GameGlyph name={step.reward.kind === 'currency' ? 'cloutStack' : 'ticket'} className="anunaki-roadmap__glyph" />}</div>
                <div className="anunaki-roadmap__copy"><small>CH {String(step.chapter).padStart(2, '0')} · {step.optional ? 'OPTIONAL MASTERY' : rewardKindLabel[step.reward.kind]}</small><h4>{step.reward.label}</h4>{step.title !== step.reward.label && <p className="anunaki-roadmap__step-title">{step.title}</p>}<span className="anunaki-roadmap__badge">{step.state === 'claimed' ? '✓ COLLECTED' : step.state === 'ready' && data.available ? '✦ READY TO CLAIM' : '◆ LOCKED'}</span><p>{step.requirement}</p>
                  {data.available && <><div className="anunaki-roadmap__meter" role="progressbar" aria-label={`${step.reward.label} progress`} aria-valuemin={0} aria-valuemax={step.target} aria-valuenow={progress}><i style={{ width: `${step.target ? progress / step.target * 100 : 0}%` }} /></div><span className="anunaki-roadmap__progress">{progress} / {step.target}{step.ownsReward && step.state !== 'claimed' ? ' · Already owned' : ''}</span></>}
                  {step.state === 'ready' && data.available ? <button type="button" disabled={busy !== null} onClick={() => void claim(step.id)}>{busy === step.id ? 'Saving…' : 'Claim reward'}</button> : <span className="anunaki-roadmap__state">{step.state === 'claimed' ? '✓ Collected' : '✦ Awaiting arrival'}</span>}
                  {notice?.id === step.id && <p className="anunaki-roadmap__receipt" role="status">{notice.text}</p>}
                  {error?.id === step.id && <p className="anunaki-roadmap__receipt" role="alert">{error.text}</p>}
                </div>
              </li>;
            })}
          </ol>
          </div>
          {data?.available && <Link className="anunaki-event__story" href="/game/story?season=special-anunaki-arrival" onClick={() => setOpen(false)}>Play The Anunaki Arrival <span aria-hidden="true">→</span></Link>}
        </>}
      </div>
    </dialog>
  </>;
}
