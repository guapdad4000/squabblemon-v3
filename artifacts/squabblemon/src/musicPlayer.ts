import tracks from './soundtrack.json';

export const soundtrack = tracks;
export const MUSIC_STORAGE_KEY = 'squabblemon_music_v1';
export type MusicPreferences = { enabled: boolean; volume: number; trackIndex: number };
export type MusicSnapshot = MusicPreferences & { playing: boolean; blocked: boolean; error: string | null };
export const defaultMusic: MusicSnapshot = { enabled: true, volume: 0.24, trackIndex: 0, playing: false, blocked: false, error: null };

export function readMusicPreferences(storage?: Pick<Storage, 'getItem'>): MusicPreferences {
  try {
    const saved = JSON.parse(storage?.getItem(MUSIC_STORAGE_KEY) ?? '{}');
    return {
      enabled: typeof saved.enabled === 'boolean' ? saved.enabled : true,
      volume: typeof saved.volume === 'number' && Number.isFinite(saved.volume) ? Math.max(0, Math.min(1, saved.volume)) : 0.24,
      trackIndex: Number.isInteger(saved.trackIndex) && saved.trackIndex >= 0 && saved.trackIndex < soundtrack.length ? saved.trackIndex : 0,
    };
  } catch { return { ...defaultMusic }; }
}

type Options = {
  preferences?: MusicPreferences;
  assetUrl: (path: string) => string;
  publish: (snapshot: MusicSnapshot) => void;
  save?: (preferences: MusicPreferences) => void;
  createContext?: () => AudioContext | undefined;
};

// One media element for the whole game. Battle cue timing remains independent.
export class MusicPlayer {
  private state: MusicSnapshot;
  private context?: AudioContext;
  private source?: MediaElementAudioSourceNode;
  private gain?: GainNode;
  private active = false;
  private visible = true;
  private masterEnabled = true;
  private unlocked = false;
  private disposed = false;
  private generation = 0;
  private pending = false;
  private loadedIndex = -1;
  private format: 'ogg' | 'aac' = 'ogg';
  private failures = new Set<number>();

  constructor(private audio: HTMLAudioElement, private options: Options) {
    this.state = { ...defaultMusic, ...options.preferences };
    audio.preload = 'none';
    audio.addEventListener('ended', this.onEnded);
    audio.addEventListener('playing', this.onPlaying);
    audio.addEventListener('pause', this.onPause);
    audio.addEventListener('error', this.onError);
    options.publish(this.state);
  }

  get snapshot() { return this.state; }

  private update(next: Partial<MusicSnapshot>, persist = false) {
    this.state = { ...this.state, ...next };
    this.options.publish(this.state);
    if (persist) {
      const { enabled, volume, trackIndex } = this.state;
      try { this.options.save?.({ enabled, volume, trackIndex }); } catch { /* Storage may be unavailable. */ }
    }
  }

  private get allowed() {
    return !this.disposed && this.active && this.visible && this.masterEnabled && this.state.enabled && this.unlocked && !this.state.error;
  }

  setEnvironment(active: boolean, visible: boolean, masterEnabled: boolean) {
    this.active = active;
    this.visible = visible;
    this.masterEnabled = masterEnabled;
    this.sync();
  }

  unlock = () => {
    if (this.disposed) return;
    this.unlocked = true;
    // A touch release may be the browser's first activation-eligible event.
    if (this.allowed && this.context?.state === 'suspended') void this.context.resume().catch(() => undefined);
    this.sync();
  };

  setEnabled(enabled: boolean) {
    if (enabled) {
      this.failures.clear();
      if (this.state.error) this.loadedIndex = -1;
    }
    this.update({ enabled, error: enabled ? null : this.state.error }, true);
    if (enabled) this.unlock(); else this.sync();
  }

  setVolume(volume: number) {
    if (!Number.isFinite(volume)) return;
    this.update({ volume: Math.max(0, Math.min(1, volume)) }, true);
    this.applyVolume();
  }

  selectTrack(index: number) {
    if (!Number.isInteger(index) || index < 0 || index >= soundtrack.length) return;
    this.failures.clear();
    this.changeTrack(index);
  }

  next = () => this.selectTrack((this.state.trackIndex + 1) % soundtrack.length);

  private changeTrack(index: number) {
    this.stop();
    this.loadedIndex = -1;
    this.update({ trackIndex: index, blocked: false, error: null }, true);
    this.sync();
  }

  private onEnded = () => {
    this.failures.clear();
    this.changeTrack((this.state.trackIndex + 1) % soundtrack.length);
  };
  private onPlaying = () => {
    if (!this.allowed) { this.stop(); return; }
    this.update({ playing: true, blocked: false });
  };
  private onPause = () => { if (!this.disposed) this.update({ playing: false }); };
  private onError = () => {
    if (this.disposed || this.loadedIndex < 0 || this.state.error) return;
    this.stop();
    if (this.format === 'ogg') {
      this.format = 'aac';
      this.audio.src = this.options.assetUrl(soundtrack[this.state.trackIndex].aac);
      this.sync();
      return;
    }
    this.failures.add(this.state.trackIndex);
    if (this.failures.size >= soundtrack.length) {
      this.update({ playing: false, error: 'Music could not load. Tap play to retry.' });
      return;
    }
    let next = (this.state.trackIndex + 1) % soundtrack.length;
    while (this.failures.has(next)) next = (next + 1) % soundtrack.length;
    this.changeTrack(next);
  };

  private connectAudio() {
    if (this.context || !this.options.createContext) return;
    let context: AudioContext | undefined;
    try {
      context = this.options.createContext();
      if (!context) return;
      const gain = context.createGain();
      const source = context.createMediaElementSource(this.audio);
      source.connect(gain);
      gain.connect(context.destination);
      this.context = context;
      this.source = source;
      this.gain = gain;
      this.audio.volume = 1;
      gain.gain.setValueAtTime(0, context.currentTime);
    } catch {
      void context?.close().catch(() => undefined);
      // A browser without media-source support can still use native playback.
    }
  }

  private applyVolume() {
    if (this.gain && this.context) {
      this.gain.gain.setTargetAtTime(this.state.volume, this.context.currentTime, 0.12);
    } else { this.audio.volume = this.state.volume; }
  }

  private sync() {
    if (!this.allowed) { this.stop(); return; }
    if (this.pending || (!this.audio.paused && this.state.playing && (!this.context || this.context.state === 'running'))) return;
    if (this.loadedIndex !== this.state.trackIndex) {
      this.format = this.audio.canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'aac';
      this.loadedIndex = this.state.trackIndex;
      this.audio.src = this.options.assetUrl(soundtrack[this.state.trackIndex][this.format]);
    }
    this.connectAudio();
    this.applyVolume();
    const generation = ++this.generation;
    this.pending = true;
    // Both calls happen within the gesture, before awaiting, for mobile browsers.
    try {
      const resume = this.context && this.context.state !== 'running' ? this.context.resume() : Promise.resolve();
      const play = this.audio.play();
      void Promise.all([resume, play]).then(() => {
        if (generation !== this.generation) { if (!this.allowed) this.audio.pause(); return; }
        this.pending = false;
        this.update({ playing: !this.audio.paused, blocked: false });
      }).catch((error: unknown) => {
        if (generation !== this.generation) return;
        this.pending = false;
        this.audio.pause();
        if (error instanceof Error && error.name === 'NotSupportedError') this.onError();
        else this.update({ playing: false, blocked: true });
      });
    } catch {
      this.pending = false;
      this.update({ playing: false, blocked: true });
    }
  }

  private stop() {
    this.generation += 1;
    this.pending = false;
    this.audio.pause();
    if (this.state.playing) this.update({ playing: false });
  }

  dispose() {
    this.disposed = true;
    this.stop();
    this.audio.removeEventListener('ended', this.onEnded);
    this.audio.removeEventListener('playing', this.onPlaying);
    this.audio.removeEventListener('pause', this.onPause);
    this.audio.removeEventListener('error', this.onError);
    this.audio.removeAttribute('src');
    this.audio.load();
    this.source?.disconnect();
    this.gain?.disconnect();
    void this.context?.close().catch(() => undefined);
  }
}
