import { useEffect, useRef } from 'react';
import { loadFeedbackPreferences } from '../battleFeedback';

const base = (import.meta.env?.BASE_URL ?? '/').replace(/\/?$/, '/');
type Cue = 'timer-30' | 'timer-10' | 'times-up' | 'times-up-bell';

function play(name: Cue, volume: number) {
  if (!loadFeedbackPreferences().audioEnabled || typeof Audio === 'undefined' || document.hidden) return;
  const audio = new Audio(`${base}audio/voice/pvp/${name}.mp3`);
  audio.volume = volume;
  void audio.play().catch(() => {});
}

/**
 * PvP turn-clock warnings for the player whose turn it is: 30s, 10s, and time's up.
 * Each cue fires once per turn (keyed by deadline), and only when the clock actually crosses it live,
 * so reconnecting or joining late never replays old warnings.
 */
export function useTurnClockCues(remaining: number, myTurn: boolean, turnKey: string | number | null, active: boolean) {
  const fired = useRef<{ key: string | number | null; last: number | null; cues: Set<Cue> }>({ key: null, last: null, cues: new Set() });
  useEffect(() => {
    const state = fired.current;
    if (state.key !== turnKey) { state.key = turnKey; state.last = null; state.cues = new Set(); }
    const previous = state.last;
    state.last = remaining;
    if (!active || !myTurn || previous === null) return;
    const crossed = (at: number) => previous > at && remaining <= at;
    const once = (cue: Cue, fn: () => void) => { if (!state.cues.has(cue)) { state.cues.add(cue); fn(); } };
    if (crossed(0)) once('times-up', () => { play('times-up-bell', 0.7); play('times-up', 1); });
    else if (crossed(10)) once('timer-10', () => play('timer-10', 1));
    else if (crossed(30)) once('timer-30', () => play('timer-30', 1));
  }, [remaining, myTurn, turnKey, active]);
}
