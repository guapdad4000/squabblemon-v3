import { FEEDBACK_CHANGE_EVENT, loadFeedbackPreferences, type FeedbackPreferences } from '../battleFeedback';
import { setMusicDucked } from '../musicStore';
import clips from './tutorialVoiceClips.json';

const PUBLIC_BASE = (import.meta.env?.BASE_URL ?? '/').replace(/\/?$/, '/');
const normalize = (text: string) => text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();
const byId = new Map(clips.map(clip => [clip.id, clip]));
const byText = new Map<string, string>();
for (const clip of clips) if (!byText.has(normalize(clip.text))) byText.set(normalize(clip.text), clip.id);

export const tutorialScript = (...ids: string[]) => ids.map(id => byId.get(id)?.text ?? '').filter(Boolean).join('\n');

/** Never announce a recorded card, price, or district that differs from the live prompt. */
export function tutorialClipsForText(text: string): string[] {
  return text.split('\n').flatMap(paragraph => {
    const exact = byText.get(normalize(paragraph));
    if (exact) return [exact];
    if (/^Tap .+\. The number at the top is its Motion cost; Hands is the strength it adds to a district\. This card replaces your selected slot\.$/.test(paragraph)) return ['generic-recruit'];
    if (/^Tap .+\. It costs \d+ Motion in our target district\. Hands is the strength it adds to your side\.$/.test(paragraph)) return ['generic-card'];
    if (/^Tap .+\. Dr\. Fade fights here while helping an ally in another district\. Watch both scores\.$/.test(paragraph)) return ['generic-fade-district'];
    if (paragraph.startsWith('Tap this district. You win by leading in two of the three districts at the end. ')) return ['generic-district'];
    return [];
  });
}

let stopActive: (() => void) | undefined;

/** One voice at a time. Every queue belongs to the prompt that created it. */
export function playTutorialSequence(ids: readonly string[]): () => void {
  stopActive?.();
  if (!ids.length || typeof Audio === 'undefined' || typeof document === 'undefined') return () => {};
  let index = 0;
  let audio: HTMLAudioElement | null = null;
  let disposed = false;
  let pending = false;
  let enabled = loadFeedbackPreferences().audioEnabled;
  const probe = document.createElement('audio');
  const extension = probe.canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'm4a';

  const pause = () => { audio?.pause(); setMusicDucked(false); };
  const release = () => {
    if (!audio) return;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    audio = null;
    pending = false;
  };
  const stop = () => {
    if (disposed) return;
    disposed = true;
    release();
    setMusicDucked(false);
    window.removeEventListener(FEEDBACK_CHANGE_EVENT, preferencesChanged);
    document.removeEventListener('visibilitychange', visibilityChanged);
    document.removeEventListener('pointerup', retry);
    document.removeEventListener('keydown', retry);
    if (stopActive === stop) stopActive = undefined;
  };
  const advance = () => {
    if (disposed) return;
    release();
    index += 1;
    if (index >= ids.length) stop(); else play();
  };
  const play = () => {
    if (disposed || !enabled || document.hidden || pending) return;
    if (!audio) {
      if (!byId.has(ids[index])) { advance(); return; }
      audio = new Audio(`${PUBLIC_BASE}audio/voice/dr-fade/tutorial/${ids[index]}.${extension}`);
      audio.volume = 0.95;
      audio.preload = 'auto';
      audio.onended = advance;
      // A missing/broken recording must never block the lesson or leave music ducked.
      audio.onerror = advance;
    }
    if (!audio.paused) return;
    const current = audio;
    pending = true;
    void current.play().then(() => {
      if (disposed || audio !== current) { current.pause(); return; }
      pending = false;
      if (!enabled || document.hidden) pause(); else setMusicDucked(true);
    }).catch((error: unknown) => {
      if (disposed || audio !== current) return;
      pending = false;
      setMusicDucked(false);
      // Browser autoplay denial is retried inside the next user gesture.
      if (error instanceof Error && error.name === 'NotSupportedError') advance();
    });
  };
  function retry() { play(); }
  function visibilityChanged() { if (document.hidden) pause(); else play(); }
  function preferencesChanged(event: Event) {
    enabled = (event as CustomEvent<FeedbackPreferences>).detail.audioEnabled;
    if (enabled) play(); else pause();
  }
  stopActive = stop;
  window.addEventListener(FEEDBACK_CHANGE_EVENT, preferencesChanged);
  document.addEventListener('visibilitychange', visibilityChanged);
  document.addEventListener('pointerup', retry);
  document.addEventListener('keydown', retry);
  play();
  return stop;
}
