const PUBLIC_BASE = (import.meta.env?.BASE_URL ?? '/').replace(/\/?$/, '/');

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
  const audio = new Audio(`${PUBLIC_BASE}audio/sfx/generated/${name}.${preferredExtension()}`);
  audio.volume = Math.max(0, Math.min(1, volume));
  void audio.play().catch(() => undefined);
  return audio;
}

export function playVoiceLine(
  name: VoiceLine,
  enabled = true,
  volume = 0.9,
): HTMLAudioElement | null {
  if (!enabled || typeof Audio === 'undefined') return null;
  const audio = new Audio(`${PUBLIC_BASE}audio/voice/dr-fade/${name}.${preferredExtension()}`);
  audio.volume = Math.max(0, Math.min(1, volume));
  void audio.play().catch(() => undefined);
  return audio;
}

export function stopSoundEffect(audio: HTMLAudioElement | null | undefined) {
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
}