import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { CardView } from './CardView';
import type { CardInstance, Lane } from '../gameEngine';
import { CARD_INSPECT_EVENT, cardPointerMoved } from '../lib/cardGestures';
import './battle-drag.css';

export type DropChoice = { allowed: boolean; cost: number; message: string };
type DragState = { instanceId: string; lane: Lane | null; choice: DropChoice | null; width: number };
type Options = {
  enabled: boolean;
  contextKey: string;
  hasCard: (instanceId: string) => boolean;
  getChoice: (instanceId: string, lane: Lane) => DropChoice;
  onStart: (instanceId: string) => void;
  onDrop: (instanceId: string, lane: Lane) => void;
};
type Gesture = {
  pointerId: number; pointerType: string; instanceId: string; contextKey: string;
  source: HTMLElement; root: HTMLElement; scroller: HTMLElement | null; scrollLeft: number;
  startX: number; startY: number; x: number; y: number; width: number;
  mode: 'pending' | 'scroll' | 'drag';
};

/** Pointer capture keeps mouse, pen and touch on the same path; no HTML5 drag API. */
export function useBattleDrag(options: Options) {
  const latest = useRef(options);
  latest.current = options;
  const gesture = useRef<Gesture | null>(null);
  const ghost = useRef<HTMLDivElement | null>(null);
  const suppressClick = useRef(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const positionGhost = useCallback(() => {
    const current = gesture.current;
    if (!current || !ghost.current) return;
    // Keep the card and the release label above a finger without moving the hit point.
    const lift = current.pointerType === 'touch' ? 32 : 12;
    const left = Math.max(8, Math.min(window.innerWidth - current.width - 8, current.x - current.width / 2));
    const top = Math.max(8, current.y - current.width * 1.15 - lift);
    ghost.current.style.transform = `translate3d(${left}px, ${top}px, 0)`;
    ghost.current.style.setProperty('--drag-label-x', `${Math.max(118, Math.min(window.innerWidth - 118, current.x)) - left}px`);
  }, []);
  const ghostRef = useCallback((node: HTMLDivElement | null) => {
    ghost.current = node;
    positionGhost();
  }, [positionGhost]);
  const clear = useCallback((message?: string) => {
    const current = gesture.current;
    gesture.current = null;
    if (current) {
      current.source.removeAttribute('data-drag-lifted');
      if (current.mode !== 'pending') suppressClick.current = true;
      try { if (current.source.hasPointerCapture(current.pointerId)) current.source.releasePointerCapture(current.pointerId); } catch { /* The browser may already have cancelled the pointer. */ }
    }
    setDrag(null);
    if (message) setAnnouncement(message);
  }, []);
  const validGesture = useCallback((current: Gesture) => latest.current.enabled
    && current.contextKey === latest.current.contextKey && latest.current.hasCard(current.instanceId), []);
  const targetAt = useCallback((current: Gesture, x: number, y: number): Lane | null => {
    const target = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop-lane]');
    if (!target || !current.root.contains(target)) return null;
    const value = Number(target.dataset.dropLane);
    return value === 0 || value === 1 || value === 2 ? value : null;
  }, []);

  useEffect(() => {
    const current = gesture.current;
    if (current && !validGesture(current)) clear('Drag cancelled. The turn or hand changed.');
  }, [options.enabled, options.contextKey, options.hasCard, clear, validGesture]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const current = gesture.current;
      if (!current || event.pointerId !== current.pointerId) return;
      if (!validGesture(current)) { clear('Drag cancelled. The turn or hand changed.'); return; }
      current.x = event.clientX; current.y = event.clientY;
      const dx = current.x - current.startX, dy = current.y - current.startY;
      if (current.mode === 'pending') {
        if (!cardPointerMoved(current.pointerType, dx, dy)) return;
        // Horizontal touch swipes browse the hand; gestures toward the board lift a card.
        current.mode = current.pointerType === 'touch' && current.scroller && Math.abs(dx) > Math.abs(dy) * 1.25 ? 'scroll' : 'drag';
        suppressClick.current = true;
        if (current.mode === 'drag') {
          current.source.setAttribute('data-drag-lifted', 'true');
          latest.current.onStart(current.instanceId);
        }
      }
      if (event.cancelable) event.preventDefault();
      if (current.mode === 'scroll') {
        current.scroller!.scrollLeft = current.scrollLeft - dx;
        return;
      }
      const lane = targetAt(current, current.x, current.y);
      const choice = lane === null ? null : latest.current.getChoice(current.instanceId, lane);
      setDrag(previous => previous?.instanceId === current.instanceId && previous.lane === lane && previous.choice?.message === choice?.message
        ? previous : { instanceId: current.instanceId, lane, choice, width: current.width });
      positionGhost();
    };
    const up = (event: PointerEvent) => {
      const current = gesture.current;
      if (!current || current.pointerId !== event.pointerId) return;
      if (current.mode !== 'drag') { clear(); return; }
      if (event.cancelable) event.preventDefault();
      const lane = targetAt(current, event.clientX, event.clientY);
      const choice = lane !== null && validGesture(current) ? latest.current.getChoice(current.instanceId, lane) : null;
      // Clear capture before dispatch; duplicate releases and synthetic clicks cannot replay it.
      clear(choice?.allowed ? 'Card played.' : choice?.message ?? 'Card returned to your hand.');
      if (choice?.allowed && lane !== null) latest.current.onDrop(current.instanceId, lane);
    };
    const cancel = (event: PointerEvent) => {
      if (event.pointerId === gesture.current?.pointerId) clear('Card returned to your hand.');
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && gesture.current) { event.preventDefault(); clear('Card returned to your hand.'); } };
    const blur = () => { if (gesture.current) clear('Card returned to your hand.'); };
    const hidden = () => { if (document.hidden) blur(); };
    const secondPointer = (event: PointerEvent) => { if (gesture.current && event.pointerId !== gesture.current.pointerId) blur(); };
    const inspect = () => { if (gesture.current) { suppressClick.current = true; clear(); } };
    window.addEventListener(CARD_INSPECT_EVENT, inspect);
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('lostpointercapture', cancel);
    window.addEventListener('pointerdown', secondPointer, true);
    window.addEventListener('keydown', escape);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener(CARD_INSPECT_EVENT, inspect);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('lostpointercapture', cancel);
      window.removeEventListener('pointerdown', secondPointer, true);
      window.removeEventListener('keydown', escape);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', hidden);
      const current = gesture.current;
      gesture.current = null;
      current?.source.removeAttribute('data-drag-lifted');
      try { if (current?.source.hasPointerCapture(current.pointerId)) current.source.releasePointerCapture(current.pointerId); } catch { /* Unmounted capture owner. */ }
    };
  }, [clear, positionGhost, targetAt, validGesture]);

  const onPointerDownCapture = (event: ReactPointerEvent<HTMLElement>) => {
    suppressClick.current = false;
    if (!latest.current.enabled || !event.isPrimary || event.button !== 0 || gesture.current) return;
    const source = (event.target as HTMLElement).closest<HTMLElement>('[data-battle-draggable="true"]');
    const instanceId = source?.dataset.instanceId;
    if (!source || !instanceId || !latest.current.hasCard(instanceId)) return;
    const scroller = source.closest<HTMLElement>('[data-drag-hand]');
    gesture.current = { pointerId: event.pointerId, pointerType: event.pointerType, instanceId, contextKey: latest.current.contextKey,
      source, root: event.currentTarget, scroller, scrollLeft: scroller?.scrollLeft ?? 0,
      startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY,
      width: Math.min(140, source.getBoundingClientRect().width), mode: 'pending' };
    try { source.setPointerCapture(event.pointerId); } catch { /* Window listeners also cover browsers without capture. */ }
  };
  const onClickCapture = (event: ReactMouseEvent<HTMLElement>) => {
    if (suppressClick.current && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; }
  };
  const preventNativeDrag = (event: ReactMouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('[data-battle-draggable="true"]')) event.preventDefault();
  };
  return { drag, announcement, ghostRef,
    rootProps: { onPointerDownCapture, onClickCapture, onDragStartCapture: preventNativeDrag, onContextMenuCapture: preventNativeDrag },
    laneState: (lane: Lane, instanceId?: string) => !drag ? undefined : drag.lane === lane
      ? drag.choice?.allowed ? 'ready' : 'blocked'
      : latest.current.getChoice(instanceId ?? drag.instanceId, lane).allowed ? 'available' : 'unavailable',
  };
}

export function BattleDragOverlay({ controller, card, variantId, squabble }: {
  controller: ReturnType<typeof useBattleDrag>; card?: CardInstance; variantId?: string; squabble?: boolean;
}) {
  const { drag, ghostRef, announcement } = controller;
  const message = drag?.choice?.message ?? (drag ? 'Drop into a lane to play. Release outside to cancel.' : announcement);
  return <><span className="sr-only" role="status" aria-live="polite">{message}</span>
    {drag && card && createPortal(<div ref={ghostRef} data-testid="battle-drag-preview" data-presentation-copy="drag" data-drop-valid={drag.choice?.allowed ?? false}
      className="battle-drag-preview" style={{ width: drag.width }} aria-hidden="true">
      <CardView card={card} cost={drag.choice?.cost ?? card.cost} presentationOnly disableLayout variantId={variantId} squabble={squabble} />
      <span className="battle-drag-label">{message}</span>
    </div>, document.body)}
  </>;
}
