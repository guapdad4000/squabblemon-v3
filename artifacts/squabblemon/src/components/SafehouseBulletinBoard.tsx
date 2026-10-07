import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'wouter';
import { ArrowRight, CalendarDays, ChevronDown, Clock3, Hammer, ListChecks, MessageSquareText, X } from 'lucide-react';
import { getAssetUrl } from '../lib/assets';
import { bulletinBoard, BULLETIN_SEEN_STORAGE_KEY, FEEDBACK_HREF, type BulletinEvent } from '../content/bulletinBoard';
import { PatchNotes } from './PatchNotes';
import { markPatchBoardRead, usePublishedPatches } from '../hooks/use-patches';
import '../styles/safehouse-bulletin.css';

const supplied = (name: string) => getAssetUrl(`assets/events/supplied/${name}.webp`);
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function hasUnreadBulletin() {
  try { return localStorage.getItem(BULLETIN_SEEN_STORAGE_KEY) !== bulletinBoard.edition; }
  catch { return true; }
}

function ExpandedEvent({ event, onNavigate, headingRef, idPrefix }: { event: BulletinEvent; onNavigate?: () => void; headingRef: React.Ref<HTMLHeadingElement>; idPrefix: string }) {
  return <section className={`bulletin-expanded bulletin-accent--${event.accent}`} aria-labelledby={`${idPrefix}-detail-title`} data-testid={`detail-event-${event.id}`} data-event-id={event.id}>
    <div className="bulletin-expanded__hero" aria-hidden="true"><img src={getAssetUrl(event.image)} alt="" /><b>{event.sticker}</b></div>
    <div className="bulletin-expanded__copy">
      <span>{event.eyebrow}</span>
      <h4 id={`${idPrefix}-detail-title`} ref={headingRef} tabIndex={-1}>{event.title}</h4>
      <p className="bulletin-expanded__status"><Clock3 size={13} aria-hidden="true" />{event.statusLabel}</p>
      <p>{event.details}</p>
      <div className="bulletin-expanded__reward"><ListChecks size={17} aria-hidden="true" /><span><small>What is available</small>
        <ul>{event.availability.map(item => <li key={item}>{item}</li>)}</ul></span></div>
      <Link href={event.link.href} onClick={onNavigate} data-testid={`link-detail-${event.id}`}>{event.link.label}<ArrowRight size={15} aria-hidden="true" /></Link>
    </div>
  </section>;
}

export function SafehouseBulletinBoardContent({ playerId, compact = false, onNavigate, children }: { playerId: string; compact?: boolean; onNavigate?: () => void; children?: ReactNode }) {
  const [expandedId, setExpandedId] = useState<string>(bulletinBoard.events[0].id);
  const pendingReveal = useRef(false);
  const detailRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const idPrefix = compact ? 'bulletin-popup' : 'bulletin-page';
  const expanded = bulletinBoard.events.find(event => event.id === expandedId) ?? bulletinBoard.events[0];

  useEffect(() => {
    if (!pendingReveal.current) return;
    pendingReveal.current = false;
    detailRef.current?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    headingRef.current?.focus({ preventScroll: true });
  }, [expandedId]);

  const select = (id: string) => {
    pendingReveal.current = true;
    if (id === expandedId) { pendingReveal.current = false; detailRef.current?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' }); headingRef.current?.focus({ preventScroll: true }); return; }
    setExpandedId(id);
  };

  return <div className={`bulletin-shell${compact ? ' bulletin-shell--compact' : ''}`} style={{ '--cork-art': `url("${supplied('cork')}")` } as CSSProperties}>
    <img className="bulletin-watermark" src={supplied('punch')} alt="" aria-hidden="true" />
    <header className="bulletin-header">
      <img className="bulletin-title-art" src={supplied('events-title')} alt="Squabblemon Events" />
      <div className="bulletin-header-copy">
        <span><CalendarDays size={15} aria-hidden="true" /> Safehouse community board</span>
        <h2 id={compact ? 'bulletin-title' : 'events-title'}>What’s happening <em>on the block?</em></h2>
        <p>What you can play right now, what is planned, and notes from the dev room.</p>
        <small>{bulletinBoard.updatedLabel}</small>
        <div className="bulletin-header-links">
          {compact && <Link className="bulletin-full-page" href="/game/events" onClick={onNavigate} data-testid="link-full-events">Open full Events page <ArrowRight size={13} aria-hidden="true" /></Link>}
          {compact && <Link className="bulletin-full-page" href={FEEDBACK_HREF} onClick={onNavigate} data-testid="link-header-feedback">Send feedback to the devs <MessageSquareText size={13} aria-hidden="true" /></Link>}
        </div>
      </div>
    </header>

    <PatchNotes playerId={playerId} compact={compact} />
    <section className="bulletin-section" aria-labelledby={`${idPrefix}-events-title`}>
      <div className="bulletin-section__title bulletin-section__title--yellow"><img className="bulletin-calendar" src={supplied('calendar')} alt="" aria-hidden="true" /><div><small>Pull up</small><h3 id={`${idPrefix}-events-title`}>Events</h3></div></div>
      <div className="bulletin-event-grid">
        {bulletinBoard.events.map((event, index) => <article key={event.id} className={`bulletin-event bulletin-accent--${event.accent}${index === 0 ? ' bulletin-event--featured' : ''}${expandedId === event.id ? ' is-selected' : ''}`} data-testid={`card-event-${event.id}`}>
          <button type="button" className="bulletin-event__expand" onClick={() => select(event.id)} aria-expanded={expandedId === event.id} aria-controls={`${idPrefix}-event-detail`} data-testid={`button-expand-${event.id}`}>
            <div className="bulletin-photo"><img src={getAssetUrl(event.image)} alt="" /><b className={`bulletin-sticker bulletin-sticker--${event.status}`}>{event.sticker}</b></div>
            <div className="bulletin-copy"><span>{event.eyebrow}</span><h4>{event.title}</h4><time>{event.statusLabel}</time><p>{event.summary}</p><em>{expandedId === event.id ? 'Showing details' : 'Show details'} <ChevronDown size={14} aria-hidden="true" /></em></div>
          </button>
          <Link href={event.link.href} onClick={onNavigate} data-testid={`link-event-${event.id}`}>{event.link.label}<ArrowRight size={14} aria-hidden="true" /></Link>
        </article>)}
      </div>
      <div id={`${idPrefix}-event-detail`} ref={detailRef} className="bulletin-detail-anchor"><ExpandedEvent key={expanded.id} event={expanded} onNavigate={onNavigate} headingRef={headingRef} idPrefix={idPrefix} /></div>
    </section>

    <section className="bulletin-section bulletin-section--dev" aria-labelledby={`${idPrefix}-dev-title`}>
      <div className="bulletin-section__title bulletin-section__title--red"><span>02</span><div><small>From behind the curtain</small><h3 id={`${idPrefix}-dev-title`}>Dev messages</h3></div></div>
      <div className="bulletin-dev-grid">
        {bulletinBoard.developerPosts.map((post, index) => <article key={post.id} className="bulletin-dev-note" data-testid={`note-${post.id}`}>
          <img className="bulletin-ink-stamp" src={supplied('fist-stamp')} alt="" aria-hidden="true" /><b className="bulletin-sticker bulletin-sticker--note">{post.sticker}</b>
          {post.image && <img className="bulletin-dev-note__photo" src={getAssetUrl(post.image)} alt="" aria-hidden="true" />}
          <span><Hammer size={12} aria-hidden="true" /> {post.eyebrow}</span><h4>{post.title}</h4><time>{post.publishedLabel}</time><p>{post.summary}</p>
          {post.bullets && <ul>{post.bullets.map(item => <li key={item}>{item}</li>)}</ul>}
          <Link href={post.link.href} onClick={onNavigate} data-testid={`link-note-${post.id}`}>{post.link.label}<ArrowRight size={14} aria-hidden="true" /></Link>
          <i aria-hidden="true" className={index % 2 ? 'pin pin--green' : 'pin pin--red'} />
        </article>)}
      </div>
    </section>
    {children}
    <footer className="bulletin-footer"><img src={getAssetUrl('brand/prismatic/logos/squabblemon-wordmark-standard-gold.webp')} alt="Squabblemon" /><p>Built with the block. Updated from the Safehouse.</p></footer>
  </div>;
}

export function SafehouseBulletinBoard({ playerId, open, onClose, onViewed }: {
  playerId: string;
  open: boolean;
  onClose: () => void;
  onViewed?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const patches = usePublishedPatches(playerId);
  const onViewedRef = useRef(onViewed);
  onViewedRef.current = onViewed;
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) {
      node.showModal();
      // A failed query must never acknowledge an unseen publication.
      if (patches.data) markPatchBoardRead(patches.data);
      onViewedRef.current?.();
    } else if (!open && node.open) node.close();
  }, [open]);
  useEffect(() => {
    if (open && patches.data) { markPatchBoardRead(patches.data); onViewedRef.current?.(); }
  }, [open, patches.data]);
  useEffect(() => () => { if (dialog.current?.open) dialog.current.close(); }, []);

  const close = () => { if (dialog.current?.open) dialog.current.close(); onClose(); };
  return <dialog ref={dialog} className="bulletin-dialog" aria-labelledby="bulletin-title" data-testid="dialog-bulletin"
    onCancel={event => { event.preventDefault(); close(); }}
    onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <div className="bulletin-dialog__controls"><button type="button" className="bulletin-close" onClick={close} aria-label="Close bulletin board" data-testid="button-close-bulletin"><X aria-hidden="true" /></button></div>
    {open && <SafehouseBulletinBoardContent playerId={playerId} compact onNavigate={close} />}
  </dialog>;
}
