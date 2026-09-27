import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight, CalendarDays, ChevronDown, Clock3, Gift, Hammer, X } from 'lucide-react';
import { getAssetUrl } from '../lib/assets';
import { bulletinBoard, BULLETIN_SEEN_STORAGE_KEY, type BulletinEvent } from '../content/bulletinBoard';
import '../styles/safehouse-bulletin.css';

const generated = (name: string) => getAssetUrl(`assets/events/generated/${name}`);

export function hasUnreadBulletin() {
  try { return localStorage.getItem(BULLETIN_SEEN_STORAGE_KEY) !== bulletinBoard.edition; }
  catch { return true; }
}

function ExpandedEvent({ event }: { event: BulletinEvent }) {
  return <section className={`bulletin-expanded bulletin-accent--${event.accent}`} aria-label={`${event.title} event details`}>
    <img className="bulletin-expanded__frame" src={generated('street-sign-frame.webp')} alt="" />
    <img className="bulletin-expanded__character" src={generated('character-stickers.webp')} alt="Dr. Fade and Buddy ready to fight" />
    <div className="bulletin-expanded__hero"><img src={getAssetUrl(event.image)} alt="" /><b>{event.sticker}</b></div>
    <div className="bulletin-expanded__copy">
      <span>{event.eyebrow}</span><h4>{event.title}</h4><time><Clock3 size={13} />{event.dateLabel}</time><p>{event.details}</p>
      <ul>{event.schedule.map(item => <li key={item}>{item}</li>)}</ul>
      <div className="bulletin-expanded__reward"><Gift size={17} /><span><small>Event reward</small>{event.reward}</span></div>
      <Link href={event.link.href}>{event.link.label}<ArrowRight size={15} /></Link>
    </div>
  </section>;
}

export function SafehouseBulletinBoardContent({ compact = false, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  const [expandedId, setExpandedId] = useState<string>(bulletinBoard.events[0].id);
  const expanded = bulletinBoard.events.find(event => event.id === expandedId) ?? bulletinBoard.events[0];
  return <div className={`bulletin-shell${compact ? ' bulletin-shell--compact' : ''}`}>
    <img className="bulletin-watermark" src={getAssetUrl('brand/prismatic/marks/impact-standard-gold.webp')} alt="" />
    <header className="bulletin-header">
      <img className="bulletin-header__anime" src={generated('event-title-impact.gif')} alt="" />
      <span><CalendarDays size={15} /> Safehouse community board</span>
      <h2 id={compact ? 'bulletin-title' : 'events-title'}>What’s happening<br /><em>on the block?</em></h2>
      <p>Events, updates, and notes straight from the dev room.</p>
      <small>{bulletinBoard.updatedLabel}</small>
      {compact && <Link className="bulletin-full-page" href="/game/events" onClick={onNavigate}>Open full events page <ArrowRight size={13} /></Link>}
    </header>

    <section className="bulletin-section" aria-labelledby="bulletin-events-title">
      <div className="bulletin-section__title bulletin-section__title--yellow"><span>01</span><div><small>Pull up</small><h3 id="bulletin-events-title">Events</h3></div></div>
      <div className="bulletin-event-grid">
        {bulletinBoard.events.map((event, index) => <article key={event.id} className={`bulletin-event bulletin-accent--${event.accent}${index === 0 ? ' bulletin-event--featured' : ''}${expandedId === event.id ? ' is-selected' : ''}`}>
          <button type="button" className="bulletin-event__expand" onClick={() => setExpandedId(event.id)} aria-expanded={expandedId === event.id} aria-controls={`event-detail-${event.id}`}>
            <div className="bulletin-photo"><img src={getAssetUrl(event.image)} alt="" /><b className={`bulletin-sticker bulletin-sticker--${event.status}`}>{event.sticker}</b></div>
            <div className="bulletin-copy"><span>{event.eyebrow}</span><h4>{event.title}</h4><time>{event.dateLabel}</time><p>{event.summary}</p><em>Expand card <ChevronDown size={14} /></em></div>
          </button>
          <Link href={event.link.href} onClick={onNavigate}>{event.link.label}<ArrowRight size={14} /></Link>
        </article>)}
      </div>
      <div id={`event-detail-${expanded.id}`}><ExpandedEvent event={expanded} /></div>
    </section>

    <section className="bulletin-section bulletin-section--dev" aria-labelledby="bulletin-dev-title">
      <div className="bulletin-section__title bulletin-section__title--red"><span>02</span><div><small>From behind the curtain</small><h3 id="bulletin-dev-title">Dev messages</h3></div></div>
      <div className="bulletin-dev-grid">
        {bulletinBoard.developerPosts.map((post, index) => <article key={post.id} className="bulletin-dev-note">
          <img className="bulletin-dev-note__paper" src={generated(index ? 'yellow-note-frame.webp' : 'torn-paper-frame.webp')} alt="" />
          <b className="bulletin-sticker bulletin-sticker--note">{post.sticker}</b>
          {post.image && <img className="bulletin-dev-note__photo" src={getAssetUrl(post.image)} alt="" />}
          <span><Hammer size={12} /> {post.eyebrow}</span><h4>{post.title}</h4><time>{post.publishedLabel}</time><p>{post.summary}</p>
          {post.bullets && <ul>{post.bullets.map(item => <li key={item}>{item}</li>)}</ul>}
          {post.link && <Link href={post.link.href} onClick={onNavigate}>{post.link.label}<ArrowRight size={14} /></Link>}
          <i aria-hidden="true" className={index % 2 ? 'pin pin--green' : 'pin pin--red'} />
        </article>)}
      </div>
    </section>
    <footer className="bulletin-footer"><img src={getAssetUrl('brand/prismatic/logos/squabblemon-wordmark-standard-gold.webp')} alt="Squabblemon" /><p>Built with the block. Updated from the Safehouse.</p></footer>
  </div>;
}

export function SafehouseBulletinBoard({ open, onClose, onViewed }: {
  open: boolean;
  onClose: () => void;
  onViewed?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) {
      node.showModal();
      try { localStorage.setItem(BULLETIN_SEEN_STORAGE_KEY, bulletinBoard.edition); } catch { /* Storage is optional. */ }
      onViewed?.();
    } else if (!open && node.open) node.close();
  }, [open, onViewed]);

  const close = () => { dialog.current?.close(); onClose(); };
  return <dialog ref={dialog} className="bulletin-dialog" aria-labelledby="bulletin-title"
    onCancel={event => { event.preventDefault(); close(); }}
    onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <div className="bulletin-dialog__controls"><button type="button" className="bulletin-close" onClick={close} aria-label="Close bulletin board"><X /></button></div>
    <SafehouseBulletinBoardContent compact onNavigate={close} />
  </dialog>;
}
