import { useLayoutEffect, useState, type RefObject } from 'react';
import { COLLECTION_CARD_VIEWPORT_BUFFER, updateCollectionCardViewport } from './collectionCardViewport';

const EMPTY_CARDS: ReadonlySet<string> = new Set();

/** One observer for the grid. Buttons keep their size and remain keyboard targets. */
export function useCollectionCardViewport({
  gridRef, scrollRef, catalogKey, enabled,
}: {
  gridRef: RefObject<HTMLElement | null>;
  scrollRef: RefObject<HTMLElement | null>;
  catalogKey: string;
  enabled: boolean;
}) {
  const [nearby, setNearby] = useState<ReadonlySet<string> | null>(EMPTY_CARDS);

  useLayoutEffect(() => {
    if (!enabled || !gridRef.current || !scrollRef.current) return;
    const grid = gridRef.current;
    const cards = Array.from(grid.querySelectorAll<HTMLElement>('[data-collection-discovery-card-id]'));
    // Unsupported browsers retain full artwork and all interactions.
    if (!('IntersectionObserver' in window)) { setNearby(null); return; }
    let observer: IntersectionObserver | undefined;
    let resizeFrame = 0;
    let generation = 0;
    const connect = () => {
      observer?.disconnect();
      const currentGeneration = ++generation;
      let root: HTMLElement | null = scrollRef.current;
      while (root && !/(auto|scroll)/.test(getComputedStyle(root).overflowY)) root = root.parentElement;
      const rootRect = root?.getBoundingClientRect();
      const top = Math.max(0, rootRect?.top ?? 0) - COLLECTION_CARD_VIEWPORT_BUFFER;
      const bottom = Math.min(window.innerHeight, rootRect?.bottom ?? window.innerHeight) + COLLECTION_CARD_VIEWPORT_BUFFER;
      // Measure once before paint. Stable shells prevent a blank first viewport or layout shift.
      setNearby(new Set(cards.filter(card => {
        const bounds = card.getBoundingClientRect();
        return bounds.height > 0 && bounds.bottom >= top && bounds.top <= bottom;
      }).map(card => card.dataset.collectionDiscoveryCardId!)));
      observer = new IntersectionObserver(entries => {
        if (currentGeneration !== generation) return;
        setNearby(current => updateCollectionCardViewport(current ?? EMPTY_CARDS, entries.map(entry => ({
          cardId: (entry.target as HTMLElement).dataset.collectionDiscoveryCardId ?? '',
          visible: entry.isIntersecting,
        }))));
      }, { root, rootMargin: `${COLLECTION_CARD_VIEWPORT_BUFFER}px 0px` });
      cards.forEach(card => observer!.observe(card));
    };
    connect();
    const resize = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(connect);
    };
    window.addEventListener('resize', resize, { passive: true });
    return () => {
      generation++;
      observer?.disconnect();
      cancelAnimationFrame(resizeFrame);
      window.removeEventListener('resize', resize);
    };
  }, [enabled, catalogKey, gridRef, scrollRef]);

  return nearby;
}
