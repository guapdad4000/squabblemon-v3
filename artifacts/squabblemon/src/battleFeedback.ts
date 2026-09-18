import { eventIntensity } from './battleChoreography';
import type { EffectLogEntry } from './gameEngine';

export type BattleCue = 'play' | 'reveal' | 'move' | 'status' | 'power-up' | 'power-down' | 'claim' | 'pass' | 'select' | 'lock' | 'fire' | 'ice' | 'shield' | 'squabble';

export type FeedbackPreferences = {
  audioEnabled: boolean;
  hapticsEnabled: boolean;
};

export const FEEDBACK_STORAGE_KEY = 'squabblemon_battle_feedback';
export const FEEDBACK_CHANGE_EVENT = 'squabblemon:feedback-change';
const defaults: FeedbackPreferences = { audioEnabled: true, hapticsEnabled: true };

export function loadFeedbackPreferences(): FeedbackPreferences {
  try {
    const stored = JSON.parse(localStorage.getItem(FEEDBACK_STORAGE_KEY) ?? '{}') as Partial<FeedbackPreferences>;
    return {
      audioEnabled: stored.audioEnabled ?? defaults.audioEnabled,
      hapticsEnabled: stored.hapticsEnabled ?? defaults.hapticsEnabled,
    };
  } catch {
    return defaults;
  }
}

export function saveFeedbackPreferences(preferences: FeedbackPreferences) {
  try { localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(preferences)); } catch { /* Private browsing can disable storage. */ }
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FEEDBACK_CHANGE_EVENT, { detail: preferences }));
  }
}

const totalScore = (scores: EffectLogEntry['scores']['before']) =>
  scores.reduce((total, lane) => total + lane.player + lane.cpu, 0);

export function cueForBattleEvent(event: EffectLogEntry): BattleCue {
  if (event.type === 'play') return 'play';
  if (event.type === 'reveal') return 'reveal';
  if (event.type === 'pass') return 'pass';
  if (event.type === 'match-complete') return 'claim';
  if (event.kind === 'fire') return 'fire';
  if (event.kind === 'water') return 'ice';
  if (event.kind === 'blocked') return 'shield';
  if (event.kind === 'move') return 'move';

  const participants = [event.source, ...event.targets].filter(Boolean);
  const statusChanged = participants.some(participant =>
    JSON.stringify(participant?.before?.statuses ?? null) !== JSON.stringify(participant?.after?.statuses ?? null),
  );
  if (statusChanged) return 'status';

  const delta = totalScore(event.scores.after) - totalScore(event.scores.before);
  return delta < 0 ? 'power-down' : 'power-up';
}

type AudioContextConstructor = typeof AudioContext;

export class BattleFeedback {
  private context: AudioContext | null = null;
  private played = new Set<string>();
  private activeAudio = new Set<{ oscillator: OscillatorNode; gain: GainNode }>();
  private lifecycle = 0;

  constructor(
    private preferences: FeedbackPreferences,
    private readonly getAudioContext: () => AudioContextConstructor | undefined = () =>
      window.AudioContext ?? (window as typeof window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext,
    private readonly vibrate: (pattern: number | number[]) => boolean = pattern => navigator.vibrate?.(pattern) ?? false,
  ) {}

  setPreferences(preferences: FeedbackPreferences) {
    if (this.preferences.audioEnabled && !preferences.audioEnabled) {
      this.lifecycle += 1;
      this.stopActiveAudio();
    }
    if (this.preferences.hapticsEnabled && !preferences.hapticsEnabled) this.safeVibrate(0);
    this.preferences = preferences;
  }

  unlockAudio() {
    if (!this.preferences.audioEnabled) return;
    const context = this.getOrCreateContext();
    if (context?.state === 'suspended') void context.resume().catch(() => undefined);
  }

  reset() {
    this.lifecycle += 1;
    this.played.clear();
    this.stopActiveAudio();
    this.safeVibrate(0);
  }

  private stopActiveAudio() {
    for (const active of this.activeAudio) {
      try {
        active.oscillator.stop();
      } catch {
        // The source may already have ended.
      }
      active.oscillator.disconnect();
      active.gain.disconnect();
    }
    this.activeAudio.clear();
  }

  emit(event: EffectLogEntry, generation: number, reducedMotion: boolean, hidden = document.hidden) {
    const key = `${generation}:${event.sequence}`;
    if (hidden || this.played.has(key)) return;
    this.played.add(key);
    const intensity = eventIntensity(event);
    this.cue(intensity === 'squabble' ? 'squabble' : cueForBattleEvent(event), reducedMotion, hidden);
    if (intensity === 'takeover' && event.type !== 'match-complete') this.cue('claim', reducedMotion, hidden);
  }

  cue(cue: BattleCue, reducedMotion: boolean, hidden = document.hidden) {
    if (hidden) return;
    if (this.preferences.audioEnabled) void this.play(cue, this.lifecycle).catch(() => undefined);
    if (this.preferences.hapticsEnabled && !reducedMotion) this.haptic(cue);
  }

  private getOrCreateContext() {
    const Context = this.getAudioContext();
    if (!Context) return null;
    try {
      return this.context ??= new Context();
    } catch {
      return null;
    }
  }

  private async play(cue: BattleCue, lifecycle: number) {
    const context = this.getOrCreateContext();
    if (!context) return;
    if (context.state === 'suspended') {
      try {
        await context.resume();
      } catch {
        return;
      }
    }
    if (context.state !== 'running' || lifecycle !== this.lifecycle || !this.preferences.audioEnabled) return;

    const now = context.currentTime;
    const tones: Record<BattleCue, [OscillatorType, number, number, number]> = {
      select: ['sine', 480, 620, .045],
      lock: ['triangle', 220, 74, .12],
      fire: ['sawtooth', 110, 38, .32],
      ice: ['sine', 1400, 650, .28],
      shield: ['triangle', 760, 380, .3],
      squabble: ['triangle', 90, 28, .45],
      play: ['triangle', 105, 62, .11],
      reveal: ['square', 260, 520, .08],
      move: ['sine', 180, 340, .12],
      status: ['sawtooth', 145, 110, .13],
      'power-up': ['triangle', 220, 440, .14],
      'power-down': ['sawtooth', 210, 90, .16],
      claim: ['square', 130, 390, .22],
      pass: ['sine', 100, 76, .07],
    };
    const [type, start, end, duration] = tones[cue];
    const layers: Array<[OscillatorType, number, number, number, number, number]> = [[type, start, end, duration, 0, cue === 'claim' ? .07 : .045]];
    if (['fire', 'ice', 'shield', 'squabble', 'lock'].includes(cue)) layers.push(['sine', cue === 'ice' ? 2200 : 68, cue === 'ice' ? 1700 : 34, duration * .7, .025, .035]);
    if (cue === 'claim') {
      layers.push(['sine', 523, 523, .3, .09, .045], ['sine', 659, 659, .35, .18, .035], ['sine', 784, 784, .4, .27, .03]);
    }
    for (const [wave, from, to, length, delay, volume] of layers) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const at = now + delay;
      oscillator.type = wave;
      oscillator.frequency.setValueAtTime(from, at);
      oscillator.frequency.exponentialRampToValueAtTime(to, at + length);
      gain.gain.setValueAtTime(.0001, now);
      gain.gain.setValueAtTime(.0001, at);
      gain.gain.exponentialRampToValueAtTime(volume, at + .008);
      gain.gain.exponentialRampToValueAtTime(.0001, at + length);
      oscillator.connect(gain).connect(context.destination);
      const active = { oscillator, gain };
      this.activeAudio.add(active);
      oscillator.onended = () => {
        this.activeAudio.delete(active);
        oscillator.disconnect();
        gain.disconnect();
      };
      oscillator.start(at);
      oscillator.stop(at + length + .01);
    }
  }

  private safeVibrate(pattern: number | number[]) {
    try {
      this.vibrate(pattern);
    } catch {
      // Vibration support is inconsistent; feedback must never interrupt battle.
    }
  }

  private haptic(cue: BattleCue) {
    const pattern: Partial<Record<BattleCue, number | number[]>> = {
      select: 5,
      lock: 12,
      fire: [12, 20, 16],
      ice: [8, 15, 8],
      shield: 14,
      squabble: [24, 40, 35],
      play: 12,
      move: [10, 28, 10],
      status: 18,
      'power-down': 22,
      claim: [18, 45, 30],
    };
    const value = pattern[cue];
    if (value !== undefined) this.safeVibrate(value);
  }
}
