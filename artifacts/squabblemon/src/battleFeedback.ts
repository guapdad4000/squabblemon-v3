import type { EffectLogEntry } from './gameEngine';

export type BattleCue = 'play' | 'reveal' | 'move' | 'status' | 'power-up' | 'power-down' | 'claim' | 'pass';

export type FeedbackPreferences = {
  audioEnabled: boolean;
  hapticsEnabled: boolean;
};

const STORAGE_KEY = 'squabblemon_battle_feedback';
const defaults: FeedbackPreferences = { audioEnabled: true, hapticsEnabled: true };

export function loadFeedbackPreferences(): FeedbackPreferences {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<FeedbackPreferences>;
    return {
      audioEnabled: stored.audioEnabled ?? defaults.audioEnabled,
      hapticsEnabled: stored.hapticsEnabled ?? defaults.hapticsEnabled,
    };
  } catch {
    return defaults;
  }
}

export function saveFeedbackPreferences(preferences: FeedbackPreferences) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}

const totalScore = (scores: EffectLogEntry['scores']['before']) =>
  scores.reduce((total, lane) => total + lane.player + lane.cpu, 0);

export function cueForBattleEvent(event: EffectLogEntry): BattleCue {
  if (event.type === 'play') return 'play';
  if (event.type === 'reveal') return 'reveal';
  if (event.type === 'pass') return 'pass';
  if (event.type === 'match-complete') return 'claim';
  if (event.kind === 'move') return 'move';

  const participants = [event.source, ...event.targets].filter(Boolean);
  const statusChanged = participants.some(participant =>
    JSON.stringify(participant?.before?.statuses ?? null) !== JSON.stringify(participant?.after?.statuses ?? null),
  );
  if (statusChanged || event.kind === 'blocked') return 'status';

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
    this.safeVibrate(0);
  }

  emit(event: EffectLogEntry, generation: number, reducedMotion: boolean, hidden = document.hidden) {
    const key = `${generation}:${event.sequence}`;
    if (hidden || this.played.has(key)) return;
    this.played.add(key);
    const cue = cueForBattleEvent(event);
    if (this.preferences.audioEnabled) void this.play(cue, this.lifecycle);
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
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const tones: Record<BattleCue, [OscillatorType, number, number, number]> = {
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
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(start, now);
    oscillator.frequency.exponentialRampToValueAtTime(end, now + duration);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(cue === 'claim' ? .12 : .065, now + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(gain).connect(context.destination);
    const active = { oscillator, gain };
    this.activeAudio.add(active);
    oscillator.onended = () => {
      this.activeAudio.delete(active);
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(now);
    oscillator.stop(now + duration + .01);
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