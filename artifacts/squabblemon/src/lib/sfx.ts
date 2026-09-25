import { playInteractionSound, type InteractionSound } from './interactionAudio';
import { FEEDBACK_CHANGE_EVENT, type FeedbackPreferences } from '../battleFeedback';

const PUBLIC_BASE = (import.meta.env?.BASE_URL ?? '/').replace(/\/?$/, '/');
const activeClips = new Set<HTMLAudioElement>();

if (typeof window !== 'undefined') window.addEventListener(FEEDBACK_CHANGE_EVENT, event => {
  if ((event as CustomEvent<FeedbackPreferences>).detail.audioEnabled) return;
  for (const audio of activeClips) audio.pause();
  activeClips.clear();
});

function playClip(audio: HTMLAudioElement) {
  activeClips.add(audio);
  audio.addEventListener('ended', () => activeClips.delete(audio), { once: true });
  void audio.play().catch(() => activeClips.delete(audio));
  return audio;
}

export type SoundEffect =
  | 'district-lost'
  | 'district-takeover-a'
  | 'district-takeover-b'
  | 'gacha-common'
  | 'gacha-epic'
  | 'gacha-legendary'
  | 'gacha-rare-a'
  | 'gacha-rare-b'
  | 'match-found'
  | 'match-search'
  | 'pack-break'
  | 'pack-tear'
  | 'pack-ten'
  | 'squabble-charge'
  | 'story-star'
  | 'vs-impact-a'
  | 'vs-impact-b'
  | 'vs-impact-c';

export type VoiceLine =
  | 'app-welcome'
  | 'home-fade'
  | 'fade-marker'
  | 'fade-park-welcome'
  | 'decks-welcome'
  | 'market-welcome'
  | 'gacha-intro'
  | 'purchase-a'
  | 'purchase-b'
  | 'squabble-a'
  | 'squabble-b'
  | 'win-a'
  | 'win-b'
  | 'loss'
  | 'rarity-rare'
  | 'rarity-epic'
  | 'rarity-legendary'
  | 'rarity-mythical';

function preferredExtension() {
  if (typeof document === 'undefined') return 'm4a';
  const probe = document.createElement('audio');
  return probe.canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'm4a';
}

export function playSoundEffect(
  name: SoundEffect,
  enabled = true,
  volume = 0.8,
): HTMLAudioElement | null {
  if (!enabled || typeof Audio === 'undefined') return null;
  const interaction: Partial<Record<SoundEffect, InteractionSound>> = {
    'district-lost': 'prison', 'district-takeover-a': 'crowd', 'district-takeover-b': 'water-splash',
    'gacha-common': 'magic-poof', 'gacha-rare-a': 'crystal', 'gacha-rare-b': 'magic-swoosh',
    'gacha-epic': 'magic-reveal', 'gacha-legendary': 'treasure', 'story-star': 'crystal',
    'match-found': 'door-chime', 'match-search': 'low-spell', 'pack-break': 'magic-poof',
    'pack-tear': 'magic-swoosh', 'pack-ten': 'treasure', 'squabble-charge': 'low-spell',
    'vs-impact-a': 'intro', 'vs-impact-b': 'fireball', 'vs-impact-c': 'fireball',
  };
  if (interaction[name]) return playInteractionSound(interaction[name]!, enabled);
  const audio = new Audio(`${PUBLIC_BASE}audio/sfx/generated/${name}.${preferredExtension()}`);
  audio.volume = Math.max(0, Math.min(1, volume));
  return playClip(audio);
}

export function playVoiceLine(
  name: VoiceLine,
  enabled = true,
  volume = 0.9,
): HTMLAudioElement | null {
  if (!enabled || typeof Audio === 'undefined') return null;
  const audio = new Audio(`${PUBLIC_BASE}audio/voice/dr-fade/${name}.${preferredExtension()}`);
  audio.volume = Math.max(0, Math.min(1, volume));
  return playClip(audio);
}

export function stopSoundEffect(audio: HTMLAudioElement | null | undefined) {
  if (!audio) return;
  audio.pause();
  activeClips.delete(audio);
  audio.currentTime = 0;
}