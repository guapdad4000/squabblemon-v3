import { useEffect, useRef, useState, type CSSProperties, type Ref } from 'react';
import { Link, useSearch } from 'wouter';
import { ArrowRight, Newspaper } from 'lucide-react';
import type { PublicPatch } from '@workspace/api-client-react';
import { cardEntryAccent } from '@workspace/squabblemon-engine/data';
import { usePublishedPatches } from '../hooks/use-patches';
import { getCardImage } from '../lib/assets';
import { catalogPortrait } from './profile/FighterPortrait';
import '../styles/patches.css';

function DateLabel({ value }: { value: string }) {
  const parsed = new Date(value);
  return <time dateTime={value}>{Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}</time>;
}

/** Original catalog character art pinned to a patch note like a street poster. */
export function PatchArt({ cardId, size = 'hero' }: { cardId?: string | null; size?: 'hero' | 'thumb' }) {
  const card = cardId ? catalogPortrait(cardId) : undefined;
  const src = card ? getCardImage(card.catalogId) : '';
  const [failed, setFailed] = useState('');
  if (!card || failed === src) return null;
  return <figure className={`patch-art patch-art--${size}${card.artworkLayout === 'portrait' ? ' patch-art--portrait' : ''}`}
    style={{ '--patch-art-accent': cardEntryAccent(card) } as CSSProperties} aria-hidden={size === 'thumb' || undefined} data-testid={size === 'hero' ? 'patch-art' : undefined}>
    <img src={src} alt={size === 'hero' ? `${card.name} artwork` : ''} draggable={false} decoding="async" loading="lazy" onError={() => setFailed(src)} />
    {size === 'hero' && <figcaption>{card.name}</figcaption>}
  </figure>;
}

export function PatchNotes({ playerId, compact = false }: { playerId: string; compact?: boolean }) {
  const query = usePublishedPatches(playerId);
  const search = useSearch();
  const requested = new URLSearchParams(search).get('patch');
  const patches = query.data ?? [];
  const selected = patches.find(patch => patch.version === requested) ?? patches[0];
  const detail = useRef<HTMLElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const lastFocused = useRef('');
  useEffect(() => {
    if (compact || !requested || !selected || lastFocused.current === requested) return;
    lastFocused.current = requested;
    const frame = requestAnimationFrame(() => {
      detail.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
      title.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [compact, requested, selected]);
  const choose = (version: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('patch', version);
    window.history.replaceState(window.history.state, '', url);
    // URL changes made outside Wouter do not update useSearch in every router version.
    window.dispatchEvent(new PopStateEvent('popstate'));
    if (version === selected?.version) {
      detail.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
      title.current?.focus({ preventScroll: true });
    }
  };
  return <section className="patches-board" aria-labelledby={compact ? 'patch-latest-heading' : 'patch-history-heading'} data-testid="section-patch-notes">
    <div className="patches-board__heading"><div><small><Newspaper size={12} aria-hidden="true" /> From the dev room / official</small><h3 id={compact ? 'patch-latest-heading' : 'patch-history-heading'}>{compact ? 'Latest patch notes' : 'Patch notes archive'}</h3></div>
      {compact && <Link href="/game/events" data-testid="link-all-patches">All notes <ArrowRight size={15} aria-hidden="true" /></Link>}</div>
    {query.isPending ? <div className="patch-skeleton" role="status" aria-label="Loading patch notes" /> :
      query.isError ? <div className="patch-state patch-state--error" role="alert">The notes couldn’t be fetched right now. <button type="button" onClick={() => void query.refetch()} data-testid="button-retry-patches">Try again</button></div> :
      !patches.length ? <div className="patch-state patch-state--empty">No official patches pinned yet. Check back at the Safehouse.</div> :
      compact ? <PatchPaper patch={patches[0]} /> :
      <div className="patch-history">
        <nav className="patch-history__list" aria-label="Published patches">{patches.map(patch => <button type="button" key={`${patch.version}:${patch.publishedAt}`} aria-current={patch === selected ? 'true' : undefined} onClick={() => choose(patch.version)} data-testid={`button-patch-${patch.version}`}><PatchArt cardId={patch.artCardId} size="thumb" /><span><small><DateLabel value={patch.date} /> · {patch.version}</small><strong>{patch.title}</strong></span></button>)}</nav>
        {selected && <PatchDetail patch={selected} articleRef={detail} headingRef={title} />}
      </div>}
  </section>;
}

export function PatchDetail({ patch, articleRef, headingRef, preview = false }: {
  patch: Pick<PublicPatch, 'version' | 'title' | 'date' | 'overview' | 'buffs' | 'changes'> & Partial<Pick<PublicPatch, 'mailStatus' | 'artCardId'>>;
  articleRef?: Ref<HTMLElement>; headingRef?: Ref<HTMLHeadingElement>; preview?: boolean;
}) {
  const headingId = preview ? 'patch-preview-events-heading' : 'patch-detail-heading';
  // Older generated clients may not yet include a terminal partial state.
  const mailStatus: string = patch.mailStatus ?? 'delivering';
  const deliveryNote = mailStatus === 'complete'
    ? 'Mail delivery complete. Check your Mailman inbox for any letter addressed to you.'
    : mailStatus === 'delivering'
      ? 'Mail is still making its rounds. Check your Mailman inbox for delivery.'
      : 'Mail delivery finished with some letters outstanding. Check your Mailman inbox; a missing letter is not a gift you can claim yet.';
  return <article className="patch-detail" ref={articleRef} aria-labelledby={headingId} data-testid={preview ? 'patch-events-preview' : 'patch-detail'}>
    <div className={`patch-detail__head${patch.artCardId ? ' patch-detail__head--art' : ''}`}><div>
      <span className="patch-detail__eyebrow">{preview ? 'Events board preview' : 'Official patch'} / {patch.version}</span>
      <h4 id={headingId} tabIndex={preview ? undefined : -1} ref={headingRef}>{patch.title}</h4>
      <DateLabel value={patch.date} /><p>{patch.overview}</p>
    </div><PatchArt cardId={patch.artCardId} /></div>
    <div className="patch-detail__columns"><section><h5>Buffs</h5>{patch.buffs.length ? <ul>{patch.buffs.map((item, i) => <li key={i}>{item}</li>)}</ul> : <p>No buffs in this update.</p>}</section><section><h5>Changes</h5>{patch.changes.length ? <ul>{patch.changes.map((item, i) => <li key={i}>{item}</li>)}</ul> : <p>No other changes in this update.</p>}</section></div>
    {!preview && <p className="patch-detail__delivery">{deliveryNote}</p>}
  </article>;
}

function PatchPaper({ patch }: { patch: PublicPatch }) {
  return <article className={`patch-paper${patch.artCardId ? ' patch-paper--art' : ''}`} data-testid="latest-patch"><PatchArt cardId={patch.artCardId} /><div className="patch-paper__body"><div className="patch-paper__top"><span className="patch-paper__eyebrow">Patch {patch.version}</span><DateLabel value={patch.date} /></div><h4>{patch.title}</h4><p>{patch.overview}</p><div className="patch-paper__footer"><span>{patch.buffs.length} buffs · {patch.changes.length} changes</span><Link href={`/game/events?patch=${encodeURIComponent(patch.version)}`} data-testid="link-latest-patch">Read this patch <ArrowRight size={15} aria-hidden="true" /></Link></div></div></article>;
}