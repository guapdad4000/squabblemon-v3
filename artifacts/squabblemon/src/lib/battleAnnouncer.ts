import { FEEDBACK_CHANGE_EVENT, FEEDBACK_STORAGE_KEY, loadFeedbackPreferences } from '../battleFeedback';
import { getAnnouncerVolume, subscribeAnnouncerVolume } from './battleAnnouncerVolume';
import { getGameAudioContext } from '../gameAudioContext';

type RecordedRound = 1 | 2 | 3 | 4 | 5;
export type BattleAnnouncement = `round-${RecordedRound}` | `your-turn-${RecordedRound}` | 'final-round';
export type AnnouncementState = {
  round: number;
  roundLimit: number;
  active: boolean;
  roundReady: boolean;
  yourTurn: boolean;
};
type Play = (cue: BattleAnnouncement, done: () => void) => () => void;

/** Presentation can return to player-ready after every card. Speak only once per round. */
export class BattleAnnouncementDirector {
  private round = 0;
  private turnRound = 0;
  private queue: BattleAnnouncement[] = [];
  private playing: { stop: () => void } | undefined;
  constructor(private readonly play: Play) {}

  update(state: AnnouncementState) {
    if (!state.active) { this.stop(); return; }
    if (state.round < this.round) return;
    if (state.round > this.round) {
      this.stop();
      if (!state.roundReady) return;
      this.round = state.round;
      if (state.round === state.roundLimit) this.queue.push('final-round');
      else if (state.round >= 1 && state.round <= 5) this.queue.push(`round-${state.round as RecordedRound}`);
    }
    if (!state.yourTurn) this.queue = this.queue.filter(cue => !cue.startsWith('your-turn-'));
    if (state.yourTurn && this.turnRound !== state.round) {
      this.turnRound = state.round;
      // Five supplied takes; the sixth round uses the first take again.
      this.queue.push(`your-turn-${((state.round - 1) % 5 + 1) as RecordedRound}`);
    }
    this.pump();
  }

  stop() {
    this.queue = [];
    const playing = this.playing;
    this.playing = undefined;
    playing?.stop();
  }

  private pump() {
    if (this.playing || this.queue.length === 0) return;
    const cue = this.queue.shift()!;
    const playing = { stop: () => {} };
    this.playing = playing;
    playing.stop = this.play(cue, () => {
      if (this.playing !== playing) return;
      this.playing = undefined;
      this.pump();
    });
  }
}

const PUBLIC_BASE = (import.meta.env?.BASE_URL ?? '/').replace(/\/?$/, '/');

/** This voice channel never touches the soundtrack or its gain, pause, or ducking state. */
export function createBattleAnnouncer() {
  let applyCurrentVolume: (() => void) | undefined;
  let closed = false;
  const audible = () => !document.hidden && loadFeedbackPreferences().audioEnabled && getAnnouncerVolume() > 0;
  const director = new BattleAnnouncementDirector((cue, done) => {
    if (!audible()) { queueMicrotask(done); return () => {}; }
    const extension = document.createElement('audio').canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'm4a';
    const audio = new Audio(`${PUBLIC_BASE}audio/voice/dr-fade/battle/${cue}.${extension}`);
    audio.preload = 'auto';
    // iOS ignores HTMLMediaElement.volume. Give only this voice its own gain node.
    const context = getGameAudioContext();
    let source: MediaElementAudioSourceNode | undefined;
    let gain: GainNode | undefined;
    try {
      if (context) {
        gain = context.createGain();
        gain.connect(context.destination);
        source = context.createMediaElementSource(audio);
        source.connect(gain);
      }
    } catch {
      source?.disconnect();
      gain?.disconnect();
      gain = undefined;
    }
    const applyVolume = () => {
      if (gain && context) gain.gain.setValueAtTime(getAnnouncerVolume(), context.currentTime);
      else audio.volume = getAnnouncerVolume();
    };
    applyCurrentVolume = applyVolume;
    applyVolume();
    let disposed = false;
    let pending = false;

    function stop() {
      if (disposed) return;
      disposed = true;
      document.removeEventListener('pointerup', play);
      document.removeEventListener('keydown', play);
      audio.removeEventListener('ended', finish);
      audio.removeEventListener('error', finish);
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      source?.disconnect();
      gain?.disconnect();
      if (applyCurrentVolume === applyVolume) applyCurrentVolume = undefined;
    }
    function finish() { stop(); done(); }
    function play() {
      if (disposed) return;
      if (!audible()) { director.stop(); return; }
      if (gain && context?.state === 'suspended') {
        void context.resume().then(() => {
          if (!disposed && !audio.paused) removeGestures();
        }).catch(() => { /* Retry inside the next user gesture. */ });
      }
      if (pending || !audio.paused) return;
      pending = true;
      void audio.play().then(() => {
        pending = false;
        if (disposed) { audio.pause(); return; }
        if (!gain || context?.state === 'running') removeGestures();
      }).catch((error: unknown) => {
        pending = false;
        if (disposed) return;
        if (!(error instanceof Error) || error.name !== 'NotAllowedError') finish();
        // Retry autoplay denial on a gesture, only while this cue is still relevant.
      });
    }
    function removeGestures() {
      document.removeEventListener('pointerup', play);
      document.removeEventListener('keydown', play);
    }
    audio.addEventListener('ended', finish);
    audio.addEventListener('error', finish);
    document.addEventListener('pointerup', play);
    document.addEventListener('keydown', play);
    play();
    return stop;
  });
  const preferencesChanged = () => { if (!audible()) director.stop(); };
  const storageChanged = (event: StorageEvent) => { if (event.key === null || event.key === FEEDBACK_STORAGE_KEY) preferencesChanged(); };
  const unsubscribeVolume = subscribeAnnouncerVolume(() => {
    applyCurrentVolume?.();
    preferencesChanged();
  });
  document.addEventListener('visibilitychange', preferencesChanged);
  window.addEventListener(FEEDBACK_CHANGE_EVENT, preferencesChanged);
  window.addEventListener('storage', storageChanged);
  return {
    update: (state: AnnouncementState) => { if (!closed) director.update(state); },
    dispose() {
      if (closed) return;
      closed = true;
      director.stop();
      unsubscribeVolume();
      document.removeEventListener('visibilitychange', preferencesChanged);
      window.removeEventListener(FEEDBACK_CHANGE_EVENT, preferencesChanged);
      window.removeEventListener('storage', storageChanged);
    },
  };
}
