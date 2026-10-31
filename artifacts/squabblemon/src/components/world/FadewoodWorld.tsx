import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { ArrowRight, BookOpen, Mail, Menu, Moon, Navigation, RotateCcw, Sun, X } from 'lucide-react';
import { useLocation, useSearch } from 'wouter';
import type { PlayerBootstrap, StoryCampaign } from '@workspace/api-client-react';
import { SafehouseMail, useSafehouseMail } from '../SafehouseMail';
import { GameGlyph } from '../venue/GameGlyph';
import { GamePopupClose, GamePopupCopy, GamePopupFrame, GamePopupLabel, GamePopupSecondary, GamePopupTitle, RewardFileAction, RewardFilePaper } from '../ui/game-popup';
import { rewardReceipts } from '../../lib/rewardReceiptStore';
import { setWorldSurface } from '../../lib/worldSurface';
import { getAssetUrl } from '../../lib/assets';
import { FADEWOOD_ARCS, getActiveCharacterId, getArcForChapter, getHostName, isMemorialSource, resolveContinue, resolveWorldIntent, type FadewoodArc } from '../../lib/fadewood/registry';
import { readWorldCheckpoint, saveStoryResume, saveWorldCheckpoint } from '../../lib/fadewood/journey';
import { mailAttentionIdentity } from '../../lib/fadewood/mail-attention';
import { useWorldLighting } from '../../lib/worldLighting';
import type { WorldCheckpoint, WorldEvent } from '../../lib/fadewood/contracts';
import { FadewoodSceneFrame, type FadewoodFrameStatus, type FadewoodSceneHandle } from './FadewoodSceneFrame';
import { FadewoodMarkers, type FadewoodMarkersHandle } from './FadewoodMarkers';
import { FadewoodExpressMenu } from './FadewoodExpressMenu';
import { FadewoodCharacterPanel } from './FadewoodCharacterPanel';
import { FadewoodBulletinPanel } from './FadewoodBulletinPanel';
import rippedPaper from '../../assets/paper/ripped-strip.webp';
import './fadewood-world.css';

type SourcePanel = { kind: 'source'; sourceId: string; screenId?: string };
type Panel = { kind: 'navigation' } | SourcePanel | { kind: 'help' };
type PendingTravel = { requestId: string; destinationId: string; label: string; arcId?: string; nodeId?: string };
type FocusTarget = { kind: 'panel'; panel: SourcePanel } | { kind: 'mail' };
type PendingFocus = { requestId: string; sourceId: string; target: FocusTarget };
type NearbySource = { id: string; name: string; kind: 'character' | 'portal' };
export interface FadewoodWorldProps {
  campaign: StoryCampaign;
  bootstrap: PlayerBootstrap;
  onOpenNode: (nodeId: string) => void;
  onOpenArchive: () => void;
  blocked?: boolean;
}

/** The account app owns actions; the scene frames the subject before a popup opens. */
export function FadewoodWorld({ campaign, bootstrap, onOpenNode, onOpenArchive, blocked = false }: FadewoodWorldProps) {
  const accountId = bootstrap.profile.id;
  const [, navigate] = useLocation();
  const search = useSearch();
  const seenDeepLink = useRef('');
  const root = useRef<HTMLElement>(null);
  const frame = useRef<FadewoodSceneHandle>(null);
  const markerLayer = useRef<FadewoodMarkersHandle>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const pendingTravel = useRef<PendingTravel | null>(null);
  const pendingFocus = useRef<PendingFocus | null>(null);
  const heldFocus = useRef<string | null>(null);
  const [travel, setTravel] = useState<PendingTravel | null>(null);
  const [framing, setFraming] = useState<PendingFocus | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [mailOpen, setMailOpen] = useState(false);
  const [externalDialog, setExternalDialog] = useState(false);
  const [status, setStatus] = useState<FadewoodFrameStatus>('loading');
  const [failure, setFailure] = useState('');
  const [progress, setProgress] = useState(0);
  const [retry, setRetry] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const [nearest, setNearest] = useState<NearbySource | null>(null);
  const [systemReduced, setSystemReduced] = useState(false);
  const [night, setNight] = useWorldLighting();
  const [lightingStatus, setLightingStatus] = useState<'loading' | 'ready' | 'error'>('ready');
  const [appliedNight, setAppliedNight] = useState(night);
  const checkpoint = useMemo(() => readWorldCheckpoint(accountId), [accountId, retry]);
  const latestCheckpoint = useRef<WorldCheckpoint | null>(checkpoint);
  const lastCheckpointWrite = useRef(0);
  const queuedReward = useSyncExternalStore(rewardReceipts.subscribe, rewardReceipts.current, () => null);
  const mail = useSafehouseMail(accountId);
  const letters = mail.data?.messages ?? [];
  const unread = letters.filter(letter => !letter.readAt).length;
  const gifts = letters.filter(letter => !letter.claimedAt && Object.values(letter.gift).some(amount => amount > 0)).length;
  const attentionId = useMemo(() => mailAttentionIdentity(accountId, letters), [accountId, letters]);
  const requestedArc = useMemo(() => {
    const params = new URLSearchParams(search);
    const chapterId = params.get('chapter');
    const fromChapter = chapterId && campaign.chapters.some(chapter => chapter.id === chapterId) ? getArcForChapter(chapterId) : undefined;
    const arc = fromChapter ?? FADEWOOD_ARCS.find(candidate => candidate.id === params.get('season'));
    return arc?.available && campaign.chapters.some(chapter => arc.chapterIds.includes(chapter.id)) ? arc : undefined;
  }, [search, campaign.chapters]);
  const resume = resolveContinue(campaign, accountId, requestedArc?.id);
  const modalBusy = blocked || externalDialog || Boolean(queuedReward);
  const busy = modalBusy || Boolean(panel) || mailOpen;
  const live = useRef({ campaign, modalBusy, blocked: busy || Boolean(framing), status });
  live.current = { campaign, modalBusy, blocked: busy || Boolean(framing), status };

  const rememberOpener = () => { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; };
  const restoreFocus = () => { window.requestAnimationFrame(() => {
    const target = opener.current?.isConnected ? opener.current : root.current?.querySelector<HTMLButtonElement>('.fadewood-world__tools button');
    target?.focus({ preventScroll: true });
  }); };
  const cancelTravel = useCallback((message = 'Travel cancelled. Explore at your own pace.') => {
    const request = pendingTravel.current;
    pendingTravel.current = null; setTravel(null);
    if (request) frame.current?.cancelTravel(request.requestId);
    if (request && message) setAnnouncement(message);
  }, []);
  const releaseCamera = useCallback(() => {
    const requestId = pendingFocus.current?.requestId ?? heldFocus.current;
    pendingFocus.current = null; heldFocus.current = null; setFraming(null);
    if (requestId) frame.current?.releaseFocus(requestId);
  }, []);
  const closePanel = useCallback(() => { setPanel(null); releaseCamera(); restoreFocus(); }, [releaseCamera]);
  const presentFocusedTarget = useCallback((request: PendingFocus, unavailable = false) => {
    if (pendingFocus.current?.requestId !== request.requestId) return;
    pendingFocus.current = null; setFraming(null);
    if (unavailable) { heldFocus.current = null; frame.current?.releaseFocus(request.requestId); }
    else heldFocus.current = request.requestId;
    if (live.current.modalBusy || document.hidden) { releaseCamera(); return; }
    if (request.target.kind === 'mail') { setPanel(null); setMailOpen(true); return; }
    setPanel(request.target.panel);
  }, [releaseCamera]);
  const beginFocus = useCallback((sourceId: string, target: FocusTarget) => {
    if (live.current.modalBusy || document.hidden || live.current.status === 'loading') return;
    rememberOpener(); cancelTravel(''); releaseCamera();
    setPanel(null); setMailOpen(false);
    const request: PendingFocus = { requestId: crypto.randomUUID(), sourceId, target };
    pendingFocus.current = request; setFraming(request);
    if (live.current.status === 'error') { presentFocusedTarget(request, true); return; }
    frame.current?.focus(request.requestId, sourceId);
  }, [cancelTravel, releaseCamera, presentFocusedTarget]);
  const navigateTo = useCallback((route: string) => {
    cancelTravel(''); releaseCamera(); setPanel(null); setMailOpen(false); navigate(route);
  }, [cancelTravel, releaseCamera, navigate]);
  const inspectSource = useCallback((sourceId: string, screenId?: string) => {
    const intent = resolveWorldIntent(sourceId, screenId);
    if ((sourceId === 'safehouse' || sourceId === 'safehouse-door') && intent?.kind === 'mode' && intent.route === '/game') {
      if (!live.current.modalBusy) navigateTo(intent.route);
      return;
    }
    beginFocus(sourceId, intent?.kind === 'mail' ? { kind: 'mail' } : { kind: 'panel', panel: { kind: 'source', sourceId, screenId } });
  }, [beginFocus, navigateTo]);
  const openPanel = useCallback((value: Panel) => {
    if (live.current.modalBusy) return;
    if (value.kind === 'source') { inspectSource(value.sourceId, value.screenId); return; }
    rememberOpener(); cancelTravel(''); releaseCamera(); setMailOpen(false); setPanel(value);
  }, [cancelTravel, releaseCamera, inspectSource]);
  // Explicit menu access remains available if the player prefers reading their mailbox.
  const openMailbox = useCallback(() => {
    if (live.current.modalBusy) return;
    rememberOpener(); cancelTravel(''); releaseCamera(); setPanel(null); setMailOpen(true);
  }, [cancelTravel, releaseCamera]);
  const openArchive = (arcId?: string) => {
    cancelTravel(''); releaseCamera(); setPanel(null);
    if (arcId && FADEWOOD_ARCS.some(arc => arc.id === arcId && arc.available)) navigate(`/game/story?view=archive&season=${encodeURIComponent(arcId)}`);
    else onOpenArchive();
  };

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setSystemReduced(preference.matches);
    update(); preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const update = () => setExternalDialog([...document.querySelectorAll('dialog[open], [role="dialog"][aria-modal="true"], .gacha-stage[data-phase]:not([data-phase="idle"])')]
      .some(element => !root.current?.contains(element) && element.getAttribute('aria-hidden') !== 'true'));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'aria-modal', 'aria-hidden', 'data-phase'] });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!modalBusy) return;
    cancelTravel('Travel paused while another screen is open. Continue when you are ready.'); releaseCamera();
    setPanel(null); setMailOpen(false);
  }, [modalBusy, cancelTravel, releaseCamera]);
  useEffect(() => {
    if (panel && !modalBusy) {
      if (!dialog.current?.open) dialog.current?.showModal();
      dialog.current?.querySelector<HTMLButtonElement>('[data-world-initial-focus]')?.focus();
    } else dialog.current?.close();
  }, [panel, modalBusy]);
  useEffect(() => {
    if (!requestedArc || blocked || modalBusy || status === 'loading') return;
    const key = `${search}:${requestedArc.id}`;
    if (seenDeepLink.current === key) return;
    seenDeepLink.current = key;
    openPanel({ kind: 'source', sourceId: requestedArc.hostId, screenId: requestedArc.id });
  }, [requestedArc, search, blocked, modalBusy, status, openPanel, accountId]);
  useEffect(() => {
    setWorldSurface(status === 'loading' ? 'loading' : busy || travel || framing || status === 'error' ? 'busy' : 'exploring');
  }, [status, busy, travel, framing]);
  useEffect(() => () => { setWorldSurface('inactive'); }, []);
  useEffect(() => {
    latestCheckpoint.current = readWorldCheckpoint(accountId); lastCheckpointWrite.current = 0;
    pendingTravel.current = null; pendingFocus.current = null; heldFocus.current = null;
    opener.current = null; seenDeepLink.current = '';
    setTravel(null); setFraming(null); setNearest(null); setPanel(null); setMailOpen(false); setAnnouncement('');
    setStatus('loading'); setProgress(0); setFailure(''); markerLayer.current?.update([]);
    const save = () => { if (latestCheckpoint.current) saveWorldCheckpoint(accountId, latestCheckpoint.current); };
    const visibility = () => { if (document.hidden) { save(); releaseCamera(); } };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      pendingTravel.current = null; pendingFocus.current = null; heldFocus.current = null;
      save(); document.removeEventListener('visibilitychange', visibility);
    };
  }, [accountId, releaseCamera]);
  useEffect(() => {
    if (!travel) return;
    const timeout = window.setTimeout(() => cancelTravel('That trip could not finish. Try again or open the Story archive.'), 20_000);
    return () => window.clearTimeout(timeout);
  }, [travel, cancelTravel]);
  useEffect(() => {
    if (!framing) return;
    const timeout = window.setTimeout(() => { releaseCamera(); setAnnouncement('You can try talking again, or open the Express.'); }, 8_000);
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); releaseCamera(); restoreFocus(); } };
    window.addEventListener('keydown', escape);
    return () => { window.clearTimeout(timeout); window.removeEventListener('keydown', escape); };
  }, [framing, releaseCamera]);
  useEffect(() => {
    const storyTargets = FADEWOOD_ARCS.flatMap(arc => {
      const next = resolveContinue(campaign, accountId, arc.id);
      return next ? [{ arcId: arc.id, sourceId: getActiveCharacterId(arc, next.node.nodeId), label: arc.title }] : [];
    });
    storyTargets.push({ arcId: 'bulletin', sourceId: 'fade-park-bulletin', label: 'Events & bounties' });
    if (unread || gifts) storyTargets.push({ arcId: 'mail', sourceId: 'mailman', label: gifts ? `${gifts} gift${gifts === 1 ? '' : 's'} to claim` : `${unread} unread deliver${unread === 1 ? 'y' : 'ies'}` });
    frame.current?.setPresentation({ storyTargets, mail: { unread, gifts, attentionId, opened: mailOpen } });
  }, [campaign, accountId, unread, gifts, attentionId, mailOpen, status]);

  const startTravel = (destinationId: string, label: string, story?: { arc: FadewoodArc; node: StoryCampaign['nodes'][number] }) => {
    if (modalBusy || status !== 'ready') return;
    rememberOpener(); cancelTravel(''); releaseCamera();
    const request: PendingTravel = { requestId: crypto.randomUUID(), destinationId, label, ...(story ? { arcId: story.arc.id, nodeId: story.node.nodeId } : {}) };
    pendingTravel.current = request;
    setTravel(request); setPanel(null); setMailOpen(false); setAnnouncement(`Travelling to ${label}.`);
    if (story) saveStoryResume(accountId, story.node.nodeId, story.arc.id);
    frame.current?.travel(request.requestId, destinationId);
  };
  const continueStory = (arcId?: string) => {
    const next = resolveContinue(campaign, accountId, arcId ?? requestedArc?.id);
    if (!next || modalBusy) return;
    if (status === 'error') { beginFocus(next.arc.hostId, { kind: 'panel', panel: { kind: 'source', sourceId: next.arc.hostId, screenId: next.arc.id } }); return; }
    startTravel(next.arc.arrivalId, getHostName(next.arc.hostId), next);
  };
  const continueFromCharacter = (arcId: string) => {
    const next = resolveContinue(campaign, accountId, arcId);
    if (!next || modalBusy) return;
    if (panel?.kind === 'source' && (panel.sourceId === next.arc.hostId || panel.sourceId === getActiveCharacterId(next.arc, next.node.nodeId))) {
      saveStoryResume(accountId, next.node.nodeId, next.arc.id); setPanel(null); onOpenNode(next.node.nodeId);
    } else continueStory(arcId);
  };
  const handleStatus = useCallback((value: FadewoodFrameStatus, message?: string) => {
    setStatus(value); if (message) setFailure(message);
    if (value === 'error') { cancelTravel(''); releaseCamera(); }
  }, [cancelTravel, releaseCamera]);
  const handleEvent = (event: WorldEvent) => {
    if (event.type === 'lighting' && event.requestedNight === night) {
      setAppliedNight(event.night); setLightingStatus(event.status);
      if (event.status === 'error') setAnnouncement(event.message ?? 'The night sky could not load. Daylight is still available.');
    }
    if (event.type === 'progress') setProgress(event.progress);
    if (event.type === 'state') {
      latestCheckpoint.current = event.checkpoint;
      const now = performance.now();
      if (now - lastCheckpointWrite.current >= 1000) { saveWorldCheckpoint(accountId, event.checkpoint); lastCheckpointWrite.current = now; }
      const source = event.nearest ?? null;
      setNearest(previous => previous?.id === source?.id && previous?.name === source?.name && previous?.kind === source?.kind ? previous : source);
      markerLayer.current?.update(event.markers ?? []);
    }
    if (event.type === 'inspect' && !live.current.blocked) {
      if (event.sourceId === 'world-map' || event.sourceId === 'world-pause') openPanel({ kind: 'navigation' });
      else inspectSource(event.sourceId);
    }
    if (event.type === 'intent' && !live.current.blocked && resolveWorldIntent(event.sourceId, event.screenId)) inspectSource(event.sourceId, event.screenId);
    if (event.type === 'focusComplete' || event.type === 'focusCancelled') {
      const request = pendingFocus.current;
      if (!request || request.requestId !== event.requestId || request.sourceId !== event.sourceId) return;
      if (event.type === 'focusComplete' || event.reason === 'unavailable') presentFocusedTarget(request, event.type === 'focusCancelled');
      else releaseCamera();
    }
    if (event.type === 'travelCancelled' && pendingTravel.current?.requestId === event.requestId) cancelTravel();
    if (event.type === 'travelComplete') {
      const request = pendingTravel.current;
      if (!request || request.requestId !== event.requestId || request.destinationId !== event.destinationId) return;
      pendingTravel.current = null; setTravel(null);
      if (event.checkpoint) latestCheckpoint.current = event.checkpoint;
      if (latestCheckpoint.current) saveWorldCheckpoint(accountId, latestCheckpoint.current);
      if (live.current.blocked || document.hidden) return;
      setAnnouncement(`Arrived at ${request.label}.`);
      if (request.arcId && request.nodeId) {
        const next = resolveContinue(live.current.campaign, accountId, request.arcId);
        if (next) beginFocus(next.arc.hostId, { kind: 'panel', panel: { kind: 'source', sourceId: next.arc.hostId, screenId: next.arc.id } });
      }
    }
  };
  const available = status === 'ready' && !busy && !travel && !framing;
  const nearbyVerb = nearest && (isMemorialSource(nearest.id) ? 'Remember' : nearest.id === 'safehouse' || nearest.id === 'safehouse-door' ? 'Enter' : nearest.kind === 'character' ? 'Talk to' : 'Open');
  return <section className="fadewood-world" ref={root} data-fadewood-owner="true" data-world-state={status} data-world-framing={Boolean(framing)} data-lighting={appliedNight ? 'night' : 'day'} data-lighting-status={lightingStatus} aria-label="Fadewood Story world" style={{ '--fadewood-world-paper': `url("${rippedPaper}")` } as CSSProperties}>
    <FadewoodSceneFrame key={`${accountId}:${retry}`} ref={frame} night={night} mode={busy || status === 'error' ? 'overlay' : 'exploring'} reducedMotion={bootstrap.profile.settings.reducedMotion || systemReduced}
      checkpoint={checkpoint} onEvent={handleEvent} onStatus={handleStatus} />
    <div className="fadewood-world__shade" aria-hidden="true" />
    <FadewoodMarkers ref={markerLayer} visible={available} unread={unread} gifts={gifts} onInspect={(sourceId, arcId) => inspectSource(sourceId, arcId === 'mail' || arcId === 'bulletin' ? undefined : arcId)} />
    <div className="fadewood-world__heading"><span>THE NEIGHBORHOOD</span><h1>Fadewood</h1></div>
    <nav className="fadewood-world__tools" aria-label="World menus">
      <button type="button" className="fadewood-world__express-tool" onClick={() => openPanel({ kind: 'navigation' })} disabled={modalBusy || Boolean(framing)} aria-label="Open map and fast travel"><img src={getAssetUrl('brand/navigation/squabble-express.webp')} width={1254} height={1254} alt="" /><span>Express</span></button>
      <button type="button" className="fadewood-world__menu-tool" onClick={() => openPanel({ kind: 'help' })} disabled={modalBusy || Boolean(framing)} aria-label="World controls and Story archive"><Menu size={21} /><span>Menu</span></button>
    </nav>
    {status === 'loading' && <div className="fadewood-world__loading" role="status"><GameGlyph name="story" /><strong>Opening the block</strong><span>{Math.round(progress)}%</span><progress max={100} value={progress} /><p>Your Story and wallet stay with your account.</p></div>}
    {status === 'error' && <div className="fadewood-world__fallback" role="alert"><GamePopupFrame material="brick"><GamePopupTitle>The block needs a minute.</GamePopupTitle><GamePopupCopy>{failure}</GamePopupCopy><RewardFileAction onClick={() => { setStatus('loading'); setProgress(0); setFailure(''); setRetry(value => value + 1); }}><RotateCcw size={18} /> Retry the world</RewardFileAction><GamePopupSecondary onClick={() => openArchive()}>Open Story archive</GamePopupSecondary><GamePopupSecondary onClick={() => navigateTo('/game')}>Return to Safehouse</GamePopupSecondary></GamePopupFrame></div>}
    {!busy && <div className="fadewood-world__story-dock">
      {framing ? <div className="fadewood-world__travel fadewood-world__framing" role="status"><span>With {getHostName(framing.sourceId)}</span><button type="button" onClick={() => { releaseCamera(); restoreFocus(); }} aria-label="Cancel character interaction"><X size={18} /><span>Back</span></button></div>
        : travel ? <div className="fadewood-world__travel" role="status"><Navigation size={22} /><div><strong>To {travel.label}</strong><span>{travel.nodeId ? 'Meet your host, then continue when you are ready.' : 'Take a look around when you arrive.'}</span></div><button type="button" onClick={() => cancelTravel()} aria-label="Cancel fast travel"><X size={19} /><span>Cancel</span></button></div>
        : resume ? <button type="button" className="fadewood-world__continue" disabled={status === 'loading'} onClick={() => continueStory()} data-testid="button-continue-story" data-fadewood-continue="true"><GameGlyph name="story" /><span><strong>Continue Story</strong><small>{resume.node.title} · {getHostName(resume.arc.hostId)}</small></span><ArrowRight size={23} /></button> : <button type="button" className="fadewood-world__continue" onClick={() => openArchive()}><GameGlyph name="story" /><span><strong>Story archive</strong><small>Revisit your chapters</small></span><ArrowRight size={23} /></button>}
      {!framing && <span className="fadewood-world__roam-note">Or explore. Your story will be here.</span>}
    </div>}
    {available && <button type="button" className="fadewood-world__archive" onClick={() => openArchive()}><BookOpen size={17} /> Story archive</button>}
    {nearest && available && <button type="button" className="fadewood-world__nearby" onClick={() => inspectSource(nearest.id)} aria-label={`${nearbyVerb} ${getHostName(nearest.id)}`}><GameGlyph name="story" /><span>{nearbyVerb}<strong>{getHostName(nearest.id)}</strong></span><ArrowRight size={18} /></button>}
    <span className="fadewood-world__announcement" role="status" aria-live="polite">{announcement}</span>
    <dialog ref={dialog} className={`fadewood-world__dialog${panel ? ` fadewood-world__dialog--${panel.kind === 'source' ? panel.sourceId === 'fade-park-bulletin' ? 'bulletin' : 'character' : panel.kind === 'navigation' ? 'express' : 'help'}` : ''}`} aria-labelledby="fadewood-menu-title" onClick={event => { if (event.target === event.currentTarget) closePanel(); }} onCancel={event => { event.preventDefault(); closePanel(); }}>
      {panel?.kind === 'navigation' && <FadewoodExpressMenu titleId="fadewood-menu-title" campaign={campaign} accountId={accountId} disabled={status !== 'ready'} onTravel={startTravel} onContinue={continueStory} onArchive={openArchive} onClose={closePanel} />}
      {panel?.kind === 'source' && (panel.sourceId === 'fade-park-bulletin' ? <FadewoodBulletinPanel titleId="fadewood-menu-title" bootstrap={bootstrap} onNavigate={navigateTo} onClose={closePanel} />
        : <FadewoodCharacterPanel titleId="fadewood-menu-title" sourceId={panel.sourceId} preferredArcId={panel.screenId} campaign={campaign} accountId={accountId} disabled={status === 'loading'} onContinue={continueFromCharacter} onNavigate={navigateTo} onMail={openMailbox} onMap={() => openPanel({ kind: 'navigation' })} onArchive={openArchive} onClose={closePanel} />)}
      {panel?.kind === 'help' && <GamePopupFrame material="brick" className="fadewood-world__sheet fadewood-world__help"><GamePopupClose onClick={closePanel} aria-label="Close world menu" data-world-initial-focus /><RewardFilePaper>
        <GamePopupLabel>FADEWOOD · YOUR OWN PACE</GamePopupLabel><GamePopupTitle id="fadewood-menu-title" feature>Make yourself at home.</GamePopupTitle>
        <GamePopupCopy>Meet the neighbors, follow your Story, or take the Express somewhere else.</GamePopupCopy>
        <dl className="fadewood-world__controls"><div><dt>Move</dt><dd>WASD / arrow keys / touch stick</dd></div><div><dt>Look</dt><dd>Drag the view</dd></div><div><dt>Talk / enter</dt><dd>Click a character, press E, or use the nearby sign</dd></div><div><dt>Map / menu</dt><dd>F / Escape</dd></div></dl>
        <div className="fadewood-world__lighting">
          <span>STREET LIGHTING</span>
          <button type="button" className="fadewood-panel__ticket" aria-label={night ? 'Switch streets to daylight' : 'Switch streets to late night'} aria-pressed={night} onClick={() => setNight(value => !value)}>
            {night ? <Moon size={19} aria-hidden="true" /> : <Sun size={19} aria-hidden="true" />} {night ? 'Late night' : 'Daylight'}
          </button>
          <p role="status">{lightingStatus === 'loading' ? 'Changing the sky…' : lightingStatus === 'error' ? 'The night sky could not load. Daylight is still available.' : 'Shares your Safehouse setting.'}</p>
          {lightingStatus === 'error' && <button type="button" className="fadewood-panel__ticket" onClick={() => frame.current?.setLighting(night)}>Try the sky again</button>}
        </div>
        <RewardFileAction onClick={closePanel}>Back to the block <ArrowRight size={18} /></RewardFileAction>
        <GamePopupSecondary className="fadewood-world__mail-slip" onClick={openMailbox}><img src={getAssetUrl('assets/characters/the-mailman-chibi.webp')} alt="" /><span><strong>Mail & deliveries{unread || gifts ? ` · ${gifts ? `${gifts} gifts` : `${unread} unread`}` : ''}</strong><small>Mailman brings waiting deliveries to you.</small></span><Mail size={18} /></GamePopupSecondary>
        <GamePopupSecondary onClick={() => openArchive()}>Story archive · chapters & rewards</GamePopupSecondary>
      </RewardFilePaper></GamePopupFrame>}
    </dialog>
    <SafehouseMail playerId={accountId} open={mailOpen} onClose={() => { setMailOpen(false); releaseCamera(); restoreFocus(); }} />
    {nearest && <span className="sr-only">Nearby: {getHostName(nearest.id)}</span>}
  </section>;
}
