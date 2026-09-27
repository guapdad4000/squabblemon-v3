import { useLayoutEffect, useRef, useState } from 'react';
import { getCardImage } from '../data';
import '../styles/compact-deck-picker.css';
export type PickerDeck = { id: string; name: string; heroCardId: string; cardIds: string[] };
export function CompactDeckPicker({ decks, selectedId, onSelect, disabled = false, label = 'Choose your crew', id }: { decks: PickerDeck[]; selectedId: string; onSelect: (id: string) => void; disabled?: boolean; label?: string; id?: string }) {
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
    const observer = new ResizeObserver(update);
    observer.observe(node);
    for (const child of node.children) observer.observe(child);
    node.addEventListener('scroll', update, { passive: true });
    update();
    return () => { observer.disconnect(); node.removeEventListener('scroll', update); };
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
    <div ref={rail} className="compact-deck-picker__rail">
    {!decks.length && <span>No battle-ready crew available</span>}
    {decks.map(deck => <button type="button" key={deck.id} aria-pressed={selectedId === deck.id} disabled={disabled} onClick={() => onSelect(deck.id)} className="compact-deck-picker__deck">
      <span className="compact-deck-picker__box" aria-hidden="true"><img src={getCardImage(deck.heroCardId)} alt="" loading="lazy" /></span>
      <span><strong>{deck.name}</strong><small>{deck.cardIds.length} cards {selectedId === deck.id ? '· READY' : ''}</small></span>
    </button>)}
    </div>
    <span className="compact-deck-picker__edge compact-deck-picker__edge--left" aria-hidden="true" />
    <span className="compact-deck-picker__edge compact-deck-picker__edge--right" aria-hidden="true" />
  </div>;
}
