import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import type { StoryCampaign } from '@workspace/api-client-react';
import './chapter-tickets.css';

type Props = { chapters: StoryCampaign['chapters']; activeId?: string; onSelect: (id: string) => void };

/** Chapter navigation with native touch scrolling and mouse drag support. */
export function ChapterTickets({ chapters, activeId, onSelect }: Props) {
  const strip = useRef<HTMLElement>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const [edges, setEdges] = useState({ back: false, next: false });
  const available = chapters.filter(chapter => chapter.status !== 'locked');
  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    const update = () => setEdges(previous => {
      const back = el.scrollLeft > 2, next = el.scrollLeft < el.scrollWidth - el.clientWidth - 2;
      return previous.back === back && previous.next === next ? previous : { back, next };
    });
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? el.clientWidth : 1);
      if (delta > 0 ? el.scrollLeft < el.scrollWidth - el.clientWidth - 1 : el.scrollLeft > 0) {
        event.preventDefault(); el.scrollLeft += delta;
      }
    };
    const observer = new ResizeObserver(update);
    observer.observe(el);
    el.addEventListener('scroll', update, { passive: true });
    el.addEventListener('wheel', wheel, { passive: false });
    update();
    return () => { observer.disconnect(); el.removeEventListener('scroll', update); el.removeEventListener('wheel', wheel); };
  }, [available.length]);
  useEffect(() => {
    const el = strip.current, selected = el?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!el || !selected) return;
    const viewport = el.getBoundingClientRect(), ticket = selected.getBoundingClientRect();
    if (ticket.left < viewport.left || ticket.right > viewport.right) el.scrollLeft += ticket.left - viewport.left - 8;
  }, [activeId]);
  const scroll = (direction: number) => {
    const el = strip.current;
    if (el) el.scrollBy({ left: direction * Math.max(220, el.clientWidth * .75), behavior: 'auto' });
  };
  return <section className="chapter-passes" aria-label="Chapter tickets">
    <div className="chapter-passes__toolbar"><span>Story passes <b>{String(available.length).padStart(2, '0')}</b></span>
      {available.length > 1 && <div><small>Swipe to explore</small><button type="button" aria-label="Scroll to earlier chapters" disabled={!edges.back} onClick={() => scroll(-1)}><ArrowLeft size={16}/></button><button type="button" aria-label="Scroll to later chapters" disabled={!edges.next} onClick={() => scroll(1)}><ArrowRight size={16}/></button></div>}
    </div>
    <nav ref={strip} className="chapter-passes__strip" aria-label="Chapters" tabIndex={0}
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); scroll(event.key === 'ArrowRight' ? 1 : -1); }
        if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); event.currentTarget.scrollLeft = event.key === 'Home' ? 0 : event.currentTarget.scrollWidth; }
      }}
      onPointerDown={event => { drag.current = null; if (event.pointerType === 'mouse' && event.button === 0) drag.current = { x: event.clientX, left: event.currentTarget.scrollLeft, moved: false }; }}
      onPointerMove={event => {
        const start = drag.current;
        if (!start || !event.buttons) return;
        const delta = event.clientX - start.x;
        if (Math.abs(delta) > 6 && !start.moved) { start.moved = true; event.currentTarget.setPointerCapture(event.pointerId); }
        if (start.moved) { event.currentTarget.scrollLeft = start.left - delta; event.currentTarget.dataset.dragging = 'true'; }
      }}
      onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); delete event.currentTarget.dataset.dragging; }}
      onPointerCancel={event => { drag.current = null; delete event.currentTarget.dataset.dragging; }}
      onClickCapture={event => { if (event.detail !== 0 && drag.current?.moved) { event.preventDefault(); event.stopPropagation(); } }}>
      {available.map(chapter => {
        const active = chapter.id === activeId, number = String(chapter.order || 1).padStart(2, '0');
        return <button key={chapter.id} type="button" className="chapter-pass" aria-current={active ? 'true' : undefined} aria-pressed={active} onClick={() => onSelect(chapter.id)}>
          <span className="chapter-pass__stub" aria-hidden="true"><small>Chapter</small><b>{number}</b><i /></span>
          <span className="chapter-pass__body"><small>Squabblemon · Story admission</small><strong>{chapter.title.replace(/^chapter\s+[^:]+:\s*/i, '')}</strong><span className="chapter-pass__status">{active ? 'Now playing' : chapter.status === 'cleared' ? <><Check size={11}/> Cleared</> : 'Enter chapter'}<em>ADMIT 01</em></span></span>
        </button>;
      })}
    </nav>
  </section>;
}
