import {CharacterRecruitment} from './CharacterRecruitment';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useSearch } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { customFetch, getGetPlayerBootstrapQueryKey, type PlayerBootstrap } from '@workspace/api-client-react';
import type { StarterMythicStatus } from '@workspace/squabblemon-engine/starterMythic';
import { getAssetUrl } from '../lib/assets';
import { createDeferredComponent } from '../lib/deferredComponent';
import { useDeferredPopup } from './useDeferredPopup';
import '../styles/starter-mythic.css';

const art = (name: string) => getAssetUrl(`assets/starter-mythic/${name}.webp`);
const seenThisSession = new Set<string>();
const starterDialog = createDeferredComponent('StarterMythicDialogContent', 'StarterMythicDialogContent', () => import('./StarterMythicDialogContent'));
type ClaimResult = { claimed: boolean; duplicateShards: number; status: StarterMythicStatus; bootstrap: PlayerBootstrap };

export function StarterMythic({ bootstrap, placement, autoShow = false }: { bootstrap: PlayerBootstrap; placement: 'shortcut' | 'banner'; autoShow?: boolean }) {
  const client = useQueryClient();
  const key = ['starter-mythic', bootstrap.profile.id];
  const query = useQuery({ queryKey: key, queryFn: () => customFetch<StarterMythicStatus>('/api/player/rewards/starter-mythic'), staleTime: 0, retry: 1 });
  const status = query.data;
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const { Component: DialogContent, failed: dialogFailed, preload: preloadDialog } = useDeferredPopup(starterDialog, open);
  const [celebrating, setCelebrating] = useState(false);
  const [receipt, setReceipt] = useState<ClaimResult | null>(null);
  const dialog = useRef<HTMLDialogElement>(null), opener = useRef<HTMLElement | null>(null), lock = useRef(false);
  const activePlayer = useRef(bootstrap.profile.id);
  activePlayer.current = bootstrap.profile.id;
  useEffect(() => {
    activePlayer.current = bootstrap.profile.id;
    setOpen(false); setCelebrating(false); setReceipt(null); setError('');
    return () => { activePlayer.current = ''; };
  }, [bootstrap.profile.id]);
  const search = useSearch();
  useEffect(() => { if (placement === 'banner' && new URLSearchParams(search).get('mythic') === 'open') setOpen(true); }, [search, placement]);
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
      void client.invalidateQueries({queryKey:['legend-bounties',bootstrap.profile.id]});
      setReceipt(result);
      if(result.claimed){setOpen(false);setCelebrating(true);}
    } catch (reason) {
      if (activePlayer.current === player) setError(reason instanceof Error ? reason.message : 'Could not confirm your reward. Try again.');
    } finally { lock.current = false; if (activePlayer.current === player) setBusy(false); }
  }
  const ready = status?.state === 'ready', claimed = status?.state === 'claimed';
  const stateText = claimed ? 'Collected · Permanent milestone' : ready ? 'Your Mythical is ready' : 'Reach Season 1, Chapter 5';
  const progress = status?.chapters.filter(chapter => chapter.reached).length ?? 0;
  return <>
    {celebrating && <CharacterRecruitment id="homeless-guy" returnFocus={opener.current} reduced={bootstrap.profile.settings.reducedMotion} items={[{ label: 'Clout', amount: 1000, glyph: 'cloutStack' }, { label: 'Tickets', amount: 3, glyph: 'ticket' }, ...(receipt?.duplicateShards ? [{ label: 'Style Shards', amount: receipt.duplicateShards, glyph: 'shards' as const }] : [])]} onClose={() => setCelebrating(false)} />}
    {placement === 'shortcut' ? !claimed && <button type="button" className="starter-mythic-shortcut" data-ready={ready} onPointerEnter={preloadDialog} onFocus={preloadDialog} onPointerDown={preloadDialog} onClick={() => setOpen(true)} aria-label={`Nothing to Lose · ${stateText}`}>
      <img src={art('chibi')} alt="" draggable={false} /><span>{ready ? 'CLAIM MYTHIC' : 'FREE MYTHIC'}</span>{ready && <b aria-hidden="true">!</b>}
    </button> : <button type="button" className="starter-mythic-banner" style={{ backgroundImage: `url("${art('banner')}")` }} onPointerEnter={preloadDialog} onFocus={preloadDialog} onPointerDown={preloadDialog} onClick={() => setOpen(true)}>
      <span className="starter-mythic-eyebrow">{claimed ? 'COMPLETED MILESTONE' : 'YOUR FIRST FREE MYTHICAL'}</span>
      <strong>Nothing to Lose</strong><span>{stateText}</span><small>{claimed ? 'View reward →' : `Homeless Guy + 1,000 Clout + 3 tickets · ${progress}/5 chapters reached →`}</small>
    </button>}
    <dialog ref={dialog} className="starter-mythic-dialog" aria-labelledby={`mythic-title-${placement}`} onCancel={() => setOpen(false)} onClose={() => setOpen(false)} style={DialogContent ? { '--mythic-background': `url("${art('background')}")` } as CSSProperties : undefined}>
      <button className="starter-mythic-close" type="button" onClick={() => setOpen(false)} aria-label="Close Nothing to Lose">×</button>
      {DialogContent ? <DialogContent placement={placement} status={status} isPending={query.isPending} isError={query.isError} retry={() => { void query.refetch(); }} receipt={receipt} error={error} busy={busy} claim={claim} close={() => setOpen(false)} /> : <div className="starter-mythic-content">
        <h2 id={`mythic-title-${placement}`}>Nothing to Lose</h2>
        <p role={dialogFailed ? 'alert' : 'status'}>{dialogFailed ? 'Couldn’t open the roadmap. Try again.' : 'Opening your roadmap…'}</p>
        {dialogFailed && <button type="button" onClick={preloadDialog}>Retry</button>}
      </div>}
    </dialog>
  </>;
}
