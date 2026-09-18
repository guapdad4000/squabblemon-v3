export const CARD_HOLD_MS = 450;
export const CARD_INSPECT_EVENT = 'squabble:inspect-card';

// A hold must cancel at exactly the point the battle controller starts a drag.
export function cardPointerMoved(pointerType: string, dx: number, dy: number) {
  return Math.hypot(dx, dy) >= (pointerType === 'touch' ? 12 : 6);
}
