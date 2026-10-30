import {
  advance,
  advancePractice,
  type GameState,
  type Lane,
} from '@workspace/squabblemon-engine/breakthrough';

/** Rendering and player commands consume the same monotonic clock, exactly once. */
export class PracticeInputClock {
  private sampledAt: number | null = null;
  resume(now: number) {
    this.check(now);
    this.sampledAt = now;
  }
  stop() {
    this.sampledAt = null;
  }
  advanceTo(state: GameState, now: number, withAi: boolean): GameState {
    this.check(now);
    if (this.sampledAt === null) return state;
    const sample = Math.max(now, this.sampledAt);
    const next = (withAi ? advancePractice : advance)(
      state,
      sample - this.sampledAt,
    );
    this.sampledAt = sample;
    return next;
  }
  private check(now: number) {
    if (!Number.isFinite(now) || now < 0)
      throw new Error('Invalid input clock sample');
  }
}

export type LaneBounds = {
  lane: Lane;
  left: number;
  right: number;
  top: number;
  bottom: number;
};
export function laneAtPoint(
  x: number,
  y: number,
  lanes: LaneBounds[],
): Lane | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return (
    lanes.find(
      (lane) =>
        x >= lane.left && x < lane.right && y >= lane.top && y < lane.bottom,
    )?.lane ?? null
  );
}

export type DragGesture = {
  pointerId: number;
  cardId: string;
  squabble: boolean;
  startX: number;
  startY: number;
  threshold: number;
  dragging: boolean;
};
export function moveGesture(
  gesture: DragGesture,
  x: number,
  y: number,
): DragGesture {
  return gesture.dragging ||
    Math.hypot(x - gesture.startX, y - gesture.startY) >= gesture.threshold
    ? { ...gesture, dragging: true }
    : gesture;
}
