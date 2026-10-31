import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import type { Lane } from '@workspace/squabblemon-engine/breakthrough';
import {
  laneAtPoint,
  moveGesture,
  type DragGesture,
  type LaneBounds,
} from './deploymentInput';

type Options = {
  active: boolean;
  matchKey: number;
  arena: RefObject<HTMLElement | null>;
  onStart: (cardId: string) => void;
  onClear: () => void;
  onDrop: (cardId: string, lane: Lane, squabble: boolean) => void;
};
type CapturedGesture = DragGesture & { capture: HTMLElement };

/** Pointer capture keeps the release attached to its card across artwork and UI layers. */
export function useDeploymentDrag(options: Options) {
  const latest = useRef(options);
  latest.current = options;
  const pending = useRef<CapturedGesture | null>(null);
  const ignoreClick = useRef(false);
  const [drag, setDrag] = useState<{
    cardId: string;
    lane: Lane | null;
  } | null>(null);

  function release(gesture: CapturedGesture) {
    if (gesture.capture.hasPointerCapture(gesture.pointerId))
      gesture.capture.releasePointerCapture(gesture.pointerId);
  }
  function cancel() {
    const gesture = pending.current;
    pending.current = null;
    if (gesture) release(gesture);
    if (gesture?.dragging) {
      ignoreClick.current = true;
      latest.current.onClear();
    }
    setDrag(null);
  }
  useEffect(() => {
    cancel();
  }, [options.active, options.matchKey]);
  useEffect(
    () => () => {
      const gesture = pending.current;
      pending.current = null;
      if (gesture) release(gesture);
    },
    [],
  );

  function laneFor(x: number, y: number) {
    const lanes: LaneBounds[] = Array.from(
      latest.current.arena.current?.querySelectorAll<HTMLElement>('.bt-lane') ??
        [],
    ).map((element, lane) => {
      const rect = element.getBoundingClientRect();
      return {
        lane: lane as Lane,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
      };
    });
    return laneAtPoint(x, y, lanes);
  }
  function position(x: number, y: number) {
    const element = latest.current.arena.current;
    element?.style.setProperty('--bt-drag-x', `${x}px`);
    element?.style.setProperty('--bt-drag-y', `${y}px`);
  }
  function pointerDown(
    event: PointerEvent<HTMLButtonElement>,
    cardId: string,
    squabble: boolean,
  ) {
    if (!latest.current.active || event.button !== 0 || !event.isPrimary)
      return;
    // A fresh press by the same pointer supersedes a missed release, without waiting for a render.
    if (pending.current?.pointerId === event.pointerId) cancel();
    if (pending.current) return;
    const source = event.currentTarget;
    pending.current = {
      pointerId: event.pointerId,
      cardId,
      squabble,
      startX: event.clientX,
      startY: event.clientY,
      threshold: event.pointerType === 'mouse' ? 6 : 9,
      dragging: false,
      capture: source,
    };
    source.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: PointerEvent<HTMLElement>) {
    const before = pending.current;
    if (!before || before.pointerId !== event.pointerId) return;
    const gesture = {
      ...before,
      ...moveGesture(before, event.clientX, event.clientY),
    };
    pending.current = gesture;
    if (!gesture.dragging) return;
    event.preventDefault();
    position(event.clientX, event.clientY);
    if (!before.dragging) {
      // Once dragging, capture belongs to the persistent field, not a card that will leave the hand.
      const arena = latest.current.arena.current;
      if (arena) {
        gesture.capture = arena;
        arena.setPointerCapture(gesture.pointerId);
      }
      latest.current.onStart(gesture.cardId);
    }
    const lane = laneFor(event.clientX, event.clientY);
    setDrag((current) =>
      current?.cardId === gesture.cardId && current.lane === lane
        ? current
        : { cardId: gesture.cardId, lane },
    );
  }
  function pointerUp(event: PointerEvent<HTMLElement>) {
    const before = pending.current;
    if (!before || before.pointerId !== event.pointerId) return;
    const gesture = moveGesture(before, event.clientX, event.clientY);
    pending.current = null;
    release(before);
    if (!gesture.dragging) return; // A normal tap still reaches the accessible card click.
    event.preventDefault();
    ignoreClick.current = true;
    setDrag(null);
    latest.current.onClear();
    const lane = laneFor(event.clientX, event.clientY);
    if (latest.current.active && lane !== null)
      latest.current.onDrop(gesture.cardId, lane, gesture.squabble);
  }
  function pointerCancel(event: PointerEvent<HTMLElement>) {
    const gesture = pending.current;
    if (gesture?.pointerId !== event.pointerId) return;
    // Ignore the old card's capture-loss during transfer, or a previous release after a fresh grab.
    if (
      event.type === 'lostpointercapture' &&
      (event.target !== gesture.capture ||
        gesture.capture.hasPointerCapture(event.pointerId))
    )
      return;
    cancel();
  }
  return {
    drag,
    cancel,
    pointerDown,
    pointerMove,
    pointerUp,
    pointerCancel,
    contextMenu: (event: MouseEvent<HTMLButtonElement>) => {
      if (pending.current) event.preventDefault();
    },
    // Suppress only the click belonging to a completed drag. A fresh down or keyboard click is independent.
    pointerDownCapture: () => {
      ignoreClick.current = false;
    },
    clickCapture: (event: MouseEvent<HTMLElement>) => {
      if (ignoreClick.current && event.detail > 0) {
        ignoreClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      }
    },
  };
}
