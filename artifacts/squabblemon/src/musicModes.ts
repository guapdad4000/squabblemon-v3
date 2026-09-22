import { getStoryBattle } from '@workspace/squabblemon-engine/story';
import soundtrack from './soundtrack.json';
export type MusicMode = 'background' | 'battle' | 'training' | 'story' | 'boss' | 'gacha' | 'victory' | 'defeat';
export type SoundtrackTrack = { id: string; title: string; artist: string; album: string; ogg: string; aac: string };
const modeTrack = (id: string, title: string): SoundtrackTrack => ({ id, title, artist: 'Squabblemon', album: 'Mode soundtrack', ogg: `audio/modes/${id}.mp3`, aac: `audio/modes/${id}.mp3` });
const trebloTrack = (id: string, title: string): SoundtrackTrack => ({ id, title, artist: 'Treblo', album: 'Oakland Chrome and Curls', ogg: `audio/treblo/${id}.ogg`, aac: `audio/treblo/${id}.m4a` });
export const outcomeSoundtracks = {
  victory: [trebloTrack('squabblemon-win', 'Squabblemon Win'), trebloTrack('win-music', 'Win Music')],
  defeat: [trebloTrack('squabblemon-loss', 'Squabblemon Loss')],
};
const uploadedBattleIds = new Set([
  'battle-music', 'squabblemon-battle-2', 'track-1-take-2', 'track-1', 'track-1-take-3', 'track-1-wav-master',
]);
export const battleSoundtrack: readonly SoundtrackTrack[] = soundtrack.filter(track => uploadedBattleIds.has(track.id));
export const modeSoundtracks = {
  battle: battleSoundtrack,
  training: [modeTrack('training-ost', 'Training OST'), ...battleSoundtrack],
  story: [modeTrack('story-mode-ost', 'Story Mode OST'), modeTrack('story-mode-ost-2', 'Story Mode OST 2'), ...battleSoundtrack],
  boss: [modeTrack('boss-fight-ost', 'Boss Fight OST'), ...battleSoundtrack],
  gacha: [modeTrack('gatcha-ost', 'Gacha OST')],
  ...outcomeSoundtracks,
};
export function musicModeForRoute(path: string): MusicMode {
  const battle = path.match(/\/game\/story\/play\/([^/?]+)/)?.[1];
  if (battle) { const type = getStoryBattle(battle)?.battleType; return type === 'boss' || type === 'mini-boss' ? 'boss' : 'story'; }
  if (path.startsWith('/game/story')) return 'story';
  if (path.startsWith('/game/shop')) return 'gacha';
  if (/^\/game\/online(?:\/|$)/.test(path)) return 'battle';
  if (path === '/play/guest' || path === '/game/play' || /\/decks\/[^/]+\/test/.test(path)) return 'training';
  return 'background';
}
export function activeMusicMode(path: string, override: 'boss' | 'victory' | 'defeat' | null): MusicMode {
  return override ?? musicModeForRoute(path);
}
