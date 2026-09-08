export const TURN_SECONDS = 20;

export type TurnTimerState = 'calm' | 'warning' | 'urgent' | 'paused';

export function getTurnTimerState(seconds: number, active: boolean): TurnTimerState {
  if (!active) return 'paused';
  if (seconds <= 5) return 'urgent';
  if (seconds <= 10) return 'warning';
  return 'calm';
}

export function getTurnTimerProgress(seconds: number) {
  return Math.max(0, Math.min(1, seconds / TURN_SECONDS));
}