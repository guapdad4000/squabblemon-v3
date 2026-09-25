import { FEEDBACK_CHANGE_EVENT, loadFeedbackPreferences, type FeedbackPreferences } from '../battleFeedback';

export type InteractionSound = 'door-chime' | 'door-knock' | 'cards-spread' | 'bag-hit' | 'phone-ring' | 'watering' | 'bag-open' | 'arcade-beep' | 'film' | 'ui-beep' | 'machine' | 'crowd' | 'prison' | 'magic-swoosh' | 'magic-reveal' | 'water-splash' | 'magic-aura' | 'magic-poof' | 'fireball' | 'crystal' | 'low-spell' | 'treasure' | 'intro';
const base = (import.meta.env?.BASE_URL ?? '/').replace(/\/?$/, '/');
let current: HTMLAudioElement | null = null;
let lastName = '';
let lastTime = 0;
export function stopInteractionSound() {
  current?.pause();
  current = null;
}
/** One quiet effect at a time; never pause, duck, or restart the soundtrack. */
export function playInteractionSound(name: InteractionSound, enabled = loadFeedbackPreferences().audioEnabled) {
  if (!enabled || typeof Audio === 'undefined' || (typeof document !== 'undefined' && document.hidden)) return null;
  const now = Date.now();
  if (name === lastName && now - lastTime < 180) return null;
  lastName = name; lastTime = now;
  stopInteractionSound();
  const audio = new Audio(`${base}audio/sfx/interactions/${name}.mp3`);
  audio.volume = 0.6;
  current = audio;
  const release = () => { if (current === audio) current = null; };
  audio.addEventListener('ended', release, { once: true });
  audio.addEventListener('error', release, { once: true });
  void audio.play().catch(release);
  return audio;
}
if (typeof window !== 'undefined') {
  window.addEventListener(FEEDBACK_CHANGE_EVENT, event => {
    if (!(event as CustomEvent<FeedbackPreferences>).detail.audioEnabled) stopInteractionSound();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopInteractionSound(); });
}
