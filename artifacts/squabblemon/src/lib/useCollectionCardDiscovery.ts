import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  acknowledgeDiscovery, readDiscovery, reconcileDiscovery, writeDiscovery,
  type CollectionDiscoveryState, type DiscoveryOpening,
} from './collectionCardDiscovery';

const EMPTY_HISTORY: readonly DiscoveryOpening[] = [];
export const COLLECTION_DISCOVERY_STEP_MS = 850;

function discoveryStorage() {
  try { return window.localStorage; } catch { return null; }
}

type Tour = { playerId: string; cardIds: string[]; index: number; running: boolean };
const emptyTour: Tour = { playerId: '', cardIds: [], index: 0, running: false };

/** Presentation only: this hook never focuses, inspects, selects, or mutates a card. */
export function useCollectionCardDiscovery({
  playerId, ownedCardIds, packHistory = EMPTY_HISTORY, rootRef, scrollRef, gridRef,
  disabled = false, reducedMotion = false,
}: {
  playerId?: string;
  ownedCardIds: readonly string[];
  packHistory?: readonly DiscoveryOpening[];
  rootRef: RefObject<HTMLElement | null>;
  scrollRef: RefObject<HTMLElement | null>;
  gridRef: RefObject<HTMLElement | null>;
  disabled?: boolean;
  reducedMotion?: boolean;
}) {
  const [tour, setTourState] = useState<Tour>(emptyTour);
  const latest = useRef(tour);
  const record = useRef<{ playerId: string; state: CollectionDiscoveryState } | null>(null);
  const cancelled = useRef(false);
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const ownershipKey = JSON.stringify(ownedCardIds);
  const historyKey = JSON.stringify(packHistory);

  const setTour = useCallback((next: Tour | ((value: Tour) => Tour)) => {
    setTourState((value) => {
      const result = typeof next === 'function' ? next(value) : next;
      latest.current = result;
      return result;
    });
  }, []);

  const acknowledge = useCallback((ids: readonly string[]) => {
    const current = record.current;
    if (!current) return;
    current.state = acknowledgeDiscovery(current.state, ids);
    writeDiscovery(current.playerId, current.state, discoveryStorage());
  }, []);

  const stop = useCallback(() => {
    const current = latest.current;
    cancelled.current = true;
    if (!current.running) return;
    acknowledge([current.cardIds[current.index]]);
    const stopped = { ...current, running: false };
    latest.current = stopped;
    setTour(stopped);
  }, [acknowledge, setTour]);

  useEffect(() => {
    if (!playerId) {
      latest.current = emptyTour;
      setTour(emptyTour);
      return;
    }
    const previous = record.current?.playerId === playerId
      ? record.current.state
      : readDiscovery(playerId, discoveryStorage());
    let state = reconcileDiscovery(JSON.parse(ownershipKey), JSON.parse(historyKey), previous, Date.now());
    const cardIds = state.pendingCardIds;
    const noMotion = reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (noMotion && cardIds.length > 0) state = acknowledgeDiscovery(state, cardIds);
    record.current = { playerId, state };
    writeDiscovery(playerId, state, discoveryStorage());
    cancelled.current = false;
    const canRun = cardIds.length > 0
      && !disabledRef.current
      && !noMotion
      && !document.hidden;
    const next = { playerId, cardIds, index: 0, running: canRun };
    latest.current = next;
    setTour(next);
  }, [playerId, ownershipKey, historyKey, reducedMotion, setTour]);

  useEffect(() => {
    if (disabled || reducedMotion) stop();
  }, [disabled, reducedMotion, stop]);

  useEffect(() => {
    if (!tour.running || tour.playerId !== playerId) return;
    const root = rootRef.current;
    const input = () => stop();
    const key = (event: KeyboardEvent) => {
      if (!['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) stop();
    };
    const hide = () => { if (document.hidden) stop(); };
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const reduce = () => { if (motion.matches) stop(); };
    root?.addEventListener('pointerdown', input, { capture: true, passive: true });
    root?.addEventListener('touchstart', input, { capture: true, passive: true });
    root?.addEventListener('wheel', input, { capture: true, passive: true });
    root?.addEventListener('keydown', key, true);
    document.addEventListener('visibilitychange', hide);
    motion.addEventListener('change', reduce);
    reduce();
    return () => {
      root?.removeEventListener('pointerdown', input, true);
      root?.removeEventListener('touchstart', input, true);
      root?.removeEventListener('wheel', input, true);
      root?.removeEventListener('keydown', key, true);
      document.removeEventListener('visibilitychange', hide);
      motion.removeEventListener('change', reduce);
    };
  }, [tour.running, tour.playerId, playerId, rootRef, stop]);

  useEffect(() => {
    if (!tour.running || tour.playerId !== playerId || document.hidden || disabled) return;
    const id = tour.cardIds[tour.index];
    let timer: ReturnType<typeof setTimeout> | undefined;
    let scrollArea: HTMLElement | null = null;
    const frame = requestAnimationFrame(() => {
      if (!latest.current.running || cancelled.current || disabledRef.current) return;
      const grid = gridRef.current;
      const card = Array.from(grid?.querySelectorAll<HTMLElement>('[data-collection-discovery-card-id]') ?? [])
        .find((element) => element.dataset.collectionDiscoveryCardId === id);
      scrollArea = scrollRef.current;
      if (!card || !grid || !scrollArea) { stop(); return; }
      const cardRect = card.getBoundingClientRect();
      const areaRect = scrollArea.getBoundingClientRect();
      const target = scrollArea.scrollTop + cardRect.top - areaRect.top
        - Math.max(12, (areaRect.height - cardRect.height) / 2);
      scrollArea.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
      timer = setTimeout(() => {
        if (!latest.current.running || cancelled.current || disabledRef.current) return;
        acknowledge([id]);
        setTour((value) => {
          if (!value.running || value.playerId !== tour.playerId || value.index !== tour.index) return value;
          const nextIndex = value.index + 1;
          return { ...value, index: nextIndex, running: nextIndex < value.cardIds.length };
        });
      }, COLLECTION_DISCOVERY_STEP_MS);
    });
    return () => {
      cancelAnimationFrame(frame);
      if (timer) clearTimeout(timer);
      scrollArea?.scrollTo({ top: scrollArea.scrollTop, behavior: 'instant' });
    };
  }, [tour, playerId, disabled, acknowledge, stop, setTour, scrollRef, gridRef]);

  useEffect(() => () => {
    const current = latest.current;
    cancelled.current = true;
    if (current.running) acknowledge([current.cardIds[current.index]]);
  }, [acknowledge]);

  return {
    newCardIds: playerId === tour.playerId ? tour.cardIds : [],
    activeCardId: !disabled && tour.running && playerId === tour.playerId
      ? tour.cardIds[tour.index]
      : null,
    stop,
  };
}