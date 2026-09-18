import { lazy, Suspense, useEffect, useRef, useState, type ButtonHTMLAttributes, type PointerEvent as ReactPointerEvent, type MouseEvent, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Card } from '../data';
import type { CardInstance } from '../gameEngine';
import { CARD_HOLD_MS, CARD_INSPECT_EVENT, cardPointerMoved } from '../lib/cardGestures';

const loadDetails = () => import('./CardInspector').then(module => ({ default: module.CardInspector }));
const Details = lazy(loadDetails);

/** Consume the release click, even if the newly opened dialog is under the finger. */
function suppressReleaseClick() {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const clear = () => {
    clearTimeout(timeout);
    window.removeEventListener('click', click, true);
    window.removeEventListener('pointerup', release, true);
    window.removeEventListener('pointercancel', release, true);
    window.removeEventListener('pointerdown', clear, true);
    window.removeEventListener('blur', clear);
  };
  const click = (event: globalThis.MouseEvent) => {
    if (event.detail === 0) return; // Keyboard activation is independent of the hold.
    event.preventDefault(); event.stopImmediatePropagation(); clear();
  };
  const release = () => { clearTimeout(timeout); timeout = setTimeout(clear, 800); };
  window.addEventListener('click', click, true);
  window.addEventListener('pointerup', release, true);
  window.addEventListener('pointercancel', release, true);
  window.addEventListener('pointerdown', clear, true);
  window.addEventListener('blur', clear);
  return clear;
}

export function useCardInspection(card: Card | CardInstance, enabled: boolean, onInspect?: () => void, variantId?: string) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const latest = useRef({ card, enabled, onInspect });
  latest.current = { card, enabled, onInspect };
  const cancelPress = useRef<(() => void) | null>(null);
  const releaseClick = useRef<(() => void) | null>(null);
  const inspected = useRef(false);
  const identity = 'instanceId' in card ? card.instanceId : card.id;
  useEffect(() => {
    return () => {
      cancelPress.current?.();
      // A hold may replace its source dialog. Still consume that pointer's release.
      if (!inspected.current) releaseClick.current?.();
    };
  }, [identity, enabled]);

  const open = (source: HTMLElement) => {
    if (!latest.current.enabled) return;
    source.focus({ preventScroll: true });
    // Stop any pending battle drag before opening the inspector.
    source.dispatchEvent(new Event(CARD_INSPECT_EVENT, { bubbles: true }));
    if (latest.current.onInspect) latest.current.onInspect();
    else setHost(source.closest<HTMLElement>('dialog[open]') ?? document.body);
  };
  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    cancelPress.current?.();
    if (!event.isPrimary) return;
    releaseClick.current?.(); inspected.current = false;
    if (!enabled || event.button !== 0) return;
    const source = event.currentTarget;
    if (source.matches(':disabled') || source.closest('[inert]')) return;
    if (!onInspect) void loadDetails().catch(() => undefined);
    const { pointerId, pointerType, clientX, clientY } = event;
    const startingIdentity = identity;
    const cleanup = () => {
      clearTimeout(timer);
      source.removeAttribute('data-inspect-holding');
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', end, true);
      window.removeEventListener('pointercancel', end, true);
      window.removeEventListener('lostpointercapture', end, true);
      window.removeEventListener('pointerdown', anotherPointer, true);
      window.removeEventListener('scroll', cleanup, true);
      window.removeEventListener('blur', cleanup);
      window.removeEventListener('keydown', key, true);
      document.removeEventListener('visibilitychange', hidden);
      cancelPress.current = null;
    };
    const move = (next: PointerEvent) => {
      if (next.pointerId !== pointerId) return;
      if (cardPointerMoved(pointerType, next.clientX - clientX, next.clientY - clientY)) {
        cleanup(); releaseClick.current = suppressReleaseClick();
      }
    };
    const end = (next: PointerEvent) => { if (next.pointerId === pointerId) cleanup(); };
    const anotherPointer = (next: PointerEvent) => { if (next.pointerId !== pointerId) { cleanup(); releaseClick.current = suppressReleaseClick(); } };
    const hidden = () => { if (document.hidden) cleanup(); };
    const key = (next: globalThis.KeyboardEvent) => { if (next.key === 'Escape') { cleanup(); releaseClick.current = suppressReleaseClick(); } };
    const timer = setTimeout(() => {
      cleanup();
      const currentCard = latest.current.card;
      const currentIdentity = 'instanceId' in currentCard ? currentCard.instanceId : currentCard.id;
      if (!source.isConnected || currentIdentity !== startingIdentity || !latest.current.enabled) return;
      inspected.current = true;
      releaseClick.current = suppressReleaseClick();
      open(source);
    }, CARD_HOLD_MS);
    cancelPress.current = cleanup;
    source.setAttribute('data-inspect-holding', 'true');
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', end, true);
    window.addEventListener('pointercancel', end, true);
    window.addEventListener('lostpointercapture', end, true);
    window.addEventListener('pointerdown', anotherPointer, true);
    window.addEventListener('scroll', cleanup, true);
    window.addEventListener('blur', cleanup);
    window.addEventListener('keydown', key, true);
    document.addEventListener('visibilitychange', hidden);
  };
  const onContextMenu = (event: MouseEvent<HTMLElement>) => {
    if (!enabled) return;
    event.preventDefault(); event.stopPropagation(); cancelPress.current?.();
    if (!inspected.current) { inspected.current = true; releaseClick.current?.(); releaseClick.current = suppressReleaseClick(); open(event.currentTarget); }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (enabled && (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10') || (event.altKey && event.key === 'Enter'))) {
      event.preventDefault(); event.stopPropagation(); cancelPress.current?.(); open(event.currentTarget);
    }
  };
  const dialog = host && createPortal(<div onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}><Suspense fallback={<div role="status" className="card-details-loading">Opening card details…</div>}>
    <Details card={card} variantId={variantId} useCachedProfile onClose={() => setHost(null)} />
  </Suspense></div>, host);
  return { dialog, props: enabled ? {
    onPointerDown, onContextMenu, onKeyDown,
    onDragStartCapture: (event: MouseEvent<HTMLElement>) => event.preventDefault(),
    'data-card-inspectable': true,
    'aria-description': 'Hold for card details. Right-click or press Alt+Enter for details.',
  } : {} };
}

/** Use on existing button wrappers so holding never adds/replaces a deck card. */
export function CardPressTarget({ card, variantId, onInspect, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  card: Card | CardInstance; variantId?: string; onInspect?: () => void;
}) {
  const inspection = useCardInspection(card, !props.disabled, onInspect, variantId);
  return <><button {...props} {...inspection.props} type="button">{children}</button>{inspection.dialog}</>;
}
