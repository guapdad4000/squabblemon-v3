import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { customFetch, getGetPlayerBootstrapQueryKey, type PlayerBootstrap } from '@workspace/api-client-react';
import { STARTER_MYTHIC, type StarterMythicStatus } from '@workspace/squabblemon-engine/starterMythic';
import { getAssetUrl } from '../lib/assets';
import { GameGlyph } from './venue/GameGlyph';
import '../styles/starter-mythic.css';

const art = (name: string) => getAssetUrl(`assets/starter-mythic/${name}.webp`);
const seenThisSession = new Set<string>();
type ClaimResult = { claimed: boolean; duplicateShards: number; status: StarterMythicStatus; bootstrap: PlayerBootstrap };

export function StarterMythic({ bootstrap, placement, autoShow = false }: { bootstrap: PlayerBootstrap; placement: 'shortcut' | 'banner'; autoShow?: boolean }) {
  const client = useQueryClient();
  const key = ['starter-mythic', bootstrap.profile.id];
  const query = useQuery({ queryKey: key, queryFn: () => customFetch<StarterMythicStatus>('/api/player/rewards/starter-mythic'), staleTime: 0, retry: 1 });
  const status = query.data;
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [receipt, setReceipt] = useState<ClaimResult | null>(null);
  const dialog = useRef<HTMLDialogElement>(null), opener = useRef<HTMLElement | null>(null), lock = useRef(false);
  const activePlayer = useRef(bootstrap.profile.id);
  activePlayer.current = bootstrap.profile.id;
  useEffect(() => {
    activePlayer.current = bootstrap.profile.id;
    setOpen(false); setReceipt(null); setError('');
    return () => { activePlayer.current = ''; };
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
  useEffect(() => {
    if (!autoShow || !status || status.state === 'claimed' || bootstrap.profile.onboardingStep !== 'complete') return;
    const seenKey = `squabblemon:starter-mythic:${bootstrap.profile.id}:${status.state === 'ready' ? 'ready' : 'intro'}`;
    const timer = window.setTimeout(() => {
      if (document.querySelector('dialog[open], [role="dialog"]') || seenThisSession.has(seenKey)) return;
      try { if (localStorage.getItem(seenKey)) return; } catch { /* Optional presentation history. */ }
      seenThisSession.add(seenKey);
      try { localStorage.setItem(seenKey, '1'); } catch { /* The saved claim still comes from the server. */ }
      setOpen(true);
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [autoShow, status?.state, bootstrap.profile.id, bootstrap.profile.onboardingStep]);

  async function claim() {
    if (lock.current || status?.state !== 'ready') return;
    lock.current = true; setBusy(true); setError('');
    const player = bootstrap.profile.id;
    try {
      const result = await customFetch<ClaimResult>('/api/player/rewards/starter-mythic/claim', { method: 'POST' });
      if (activePlayer.current !== player) return;
      client.setQueryData(getGetPlayerBootstrapQueryKey(), result.bootstrap);
      client.setQueryData(key, result.status);
      setReceipt(result);
    } catch (reason) {
      if (activePlayer.current === player) setError(reason instanceof Error ? reason.message : 'Could not confirm your reward. Try again.');
    } finally { lock.current = false; if (activePlayer.current === player) setBusy(false); }
  }
  const ready = status?.state === 'ready', claimed = status?.state === 'claimed';
  const stateText = claimed ? 'Collected · Permanent milestone' : ready ? 'Your Mythical is ready' : 'Reach Season 1, Chapter 5';
  const progress = status?.chapters.filter(chapter => chapter.reached).length ?? 0;
  return <>
    {placement === 'shortcut' ? !claimed && <button type="button" className="starter-mythic-shortcut" data-ready={ready} onClick={() => setOpen(true)} aria-label={`Nothing to Lose · ${stateText}`}>
      <img src={art('chibi')} alt="" draggable={false} /><span>{ready ? 'CLAIM MYTHIC' : 'FREE MYTHIC'}</span>{ready && <b aria-hidden="true">!</b>}
    </button> : <button type="button" className="starter-mythic-banner" style={{ backgroundImage: `url("${art('banner')}")` }} onClick={() => setOpen(true)}>
      <span className="starter-mythic-eyebrow">{claimed ? 'COMPLETED MILESTONE' : 'YOUR FIRST FREE MYTHICAL'}</span>
      <strong>Nothing to Lose</strong><span>{stateText}</span><small>{claimed ? 'View reward →' : `Homeless Guy + 1,000 Clout + 3 tickets · ${progress}/5 chapters reached →`}</small>
    </button>}
    <dialog ref={dialog} className="starter-mythic-dialog" aria-labelledby={`mythic-title-${placement}`} onCancel={() => setOpen(false)} onClose={() => setOpen(false)} style={{ '--mythic-background': `url("${art('background')}")` } as CSSProperties}>
      <button className="starter-mythic-close" type="button" onClick={() => setOpen(false)} aria-label="Close Nothing to Lose">×</button>
      <div className="starter-mythic-art"><img src={art('chibi')} alt="Homeless Guy seated on his milk-crate throne" /><span>MYTHICAL · HOMELESS GUY</span></div>
      <div className="starter-mythic-content">
        <span className="starter-mythic-eyebrow">{claimed ? 'HE’S WITH YOU NOW' : 'A LEGEND HIDING IN PLAIN SIGHT'}</span>
        <h2 id={`mythic-title-${placement}`}>Nothing{' '}<br />to Lose<span>.</span></h2>
        <p>Everybody walked past him. You’re about to build a whole team around him.</p>
        <p className="starter-mythic-rule">Reach <b>Season 1, Chapter 5</b>. Homeless Guy joins your crew. No timer. No login streak.</p>
        {query.isPending ? <p role="status">Checking your story progress…</p> : query.isError ? <div role="alert"><p>Could not load your reward.</p><button type="button" onClick={() => void query.refetch()}>Try again</button></div> : <>
          <ol className="starter-mythic-chapters" aria-label="Chapters reached">
            {status?.chapters.map((chapter, i) => <li key={chapter.id} data-reached={chapter.reached} aria-label={`Chapter ${i + 1}: ${chapter.completed ? 'completed' : chapter.reached ? 'reached' : 'locked'}`}><span>{chapter.completed ? '✓' : i + 1}</span><small>CH. {i + 1}</small></li>)}
          </ol>
          <div className="starter-mythic-rewards">
            <div><img src={art('chibi')} alt="" /><b>{status?.ownsCard && !claimed ? `${STARTER_MYTHIC.duplicateShards} Shards` : 'Homeless Guy'}</b><small>{status?.ownsCard && !claimed ? 'Already in your crew' : 'Mythical character'}</small></div>
            <div><GameGlyph name="cloutStack" /><b>1,000</b><small>Clout</small></div>
            <div><GameGlyph name="ticket" /><b>3</b><small>Pack tickets</small></div>
          </div>
          {receipt && <p role="status" className="starter-mythic-success">{receipt.claimed ? receipt.duplicateShards ? `Collected: 1,000 Clout, 3 tickets, and ${receipt.duplicateShards} Style Shards for your duplicate.` : 'Homeless Guy joined your crew. 1,000 Clout and 3 tickets are in your bag.' : 'Already collected. Your saved reward is safe.'}</p>}
          {error && <p role="alert">{error}</p>}
          {claimed ? <Link className="starter-mythic-cta" href="/game/collection" onClick={() => setOpen(false)}>Meet your crew →</Link> : ready ? <button type="button" className="starter-mythic-cta" disabled={busy} onClick={() => void claim()}>{busy ? 'Saving your reward…' : 'Claim your Mythic →'}</button> : <Link className="starter-mythic-cta" href="/game/story" onClick={() => setOpen(false)}>Continue story →</Link>}
          <small className="starter-mythic-footnote">{claimed ? 'Collected once. Yours for good.' : 'Free once per account. Unlock Chapter 5 by finishing Chapter 4.'}</small>
        </>}
      </div>
    </dialog>
  </>;
}
