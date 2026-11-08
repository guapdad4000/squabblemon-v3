import { useLayoutEffect, useRef, useState } from 'react';
import { getCardImage } from '../data';
import { battlePortraitUrl } from '../lib/battlePortrait';
import '../styles/compact-deck-picker.css';
export type PickerDeck = { id: string; name: string; heroCardId: string; cardIds: string[] };
export function CompactDeckPicker({ decks, selectedId, onSelect, disabled = false, label = 'Choose your crew', id, showScrollControls = false, reducedMotion = false }: { decks: PickerDeck[]; selectedId: string; onSelect: (id: string) => void; disabled?: boolean; label?: string; id?: string; showScrollControls?: boolean; reducedMotion?: boolean }) {
  const rail = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  useLayoutEffect(() => {
    const node = rail.current;
    if (!node) return;
    const update = () => {
      const left = node.scrollLeft > 2;
      const right = node.scrollWidth - node.clientWidth - node.scrollLeft > 2;
      setEdges(previous => previous.left === left && previous.right === right ? previous : { left, right });
    };
    let frame = 0;
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; update(); });
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(node);
    for (const child of node.children) observer.observe(child);
    node.addEventListener('scroll', schedule, { passive: true });
    update();
    return () => { observer.disconnect(); node.removeEventListener('scroll', schedule); cancelAnimationFrame(frame); };
  }, [decks]);
  useLayoutEffect(() => {
    const node = rail.current;
    const selected = node?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!node || !selected) return;
    const item = selected.getBoundingClientRect(), viewport = node.getBoundingClientRect();
    if (item.left < viewport.left + 8) node.scrollLeft -= viewport.left + 8 - item.left;
    else if (item.right > viewport.right - 8) node.scrollLeft += item.right - viewport.right + 8;
  }, [selectedId]);
  return <div id={id} className="compact-deck-picker" role="group" aria-label={label} data-left-overflow={edges.left} data-right-overflow={edges.right}>
    {showScrollControls && <div className="compact-deck-picker__controls">
      <span>CHOOSE YOUR CREW</span>
      <button type="button" aria-label="Previous decks" disabled={disabled || !edges.left} onClick={() => rail.current?.scrollBy({ left: -Math.max(160, rail.current.clientWidth * .75), behavior: reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })}>←</button>
      <button type="button" aria-label="Next decks" disabled={disabled || !edges.right} onClick={() => rail.current?.scrollBy({ left: Math.max(160, rail.current.clientWidth * .75), behavior: reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })}>→</button>
    </div>}
    <div ref={rail} className="compact-deck-picker__rail">
    {!decks.length && <span>No battle-ready crew available</span>}
    {decks.map(deck => <button type="button" key={deck.id} aria-pressed={selectedId === deck.id} disabled={disabled} onClick={() => onSelect(deck.id)} className="compact-deck-picker__deck">
      <span className="compact-deck-picker__box" aria-hidden="true"><img src={battlePortraitUrl(getCardImage(deck.heroCardId))} alt="" loading="lazy" draggable={false} decoding="async" /></span>
      <span><strong>{deck.name}</strong><small>{deck.cardIds.length} cards {selectedId === deck.id ? '· READY' : ''}</small></span>
    </button>)}
    </div>
    <span className="compact-deck-picker__edge compact-deck-picker__edge--left" aria-hidden="true" />
    <span className="compact-deck-picker__edge compact-deck-picker__edge--right" aria-hidden="true" />
  </div>;
}
