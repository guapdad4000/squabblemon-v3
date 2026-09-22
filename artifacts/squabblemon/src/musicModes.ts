import { getStoryBattle } from '@workspace/squabblemon-engine/story';
import soundtrack from './soundtrack.json';
export type MusicMode = 'background' | 'battle' | 'training' | 'story' | 'boss' | 'gacha' | 'victory' | 'defeat';
export type SoundtrackTrack = { id: string; title: string; artist: string; album: string; ogg: string; aac: string };
const modeTrack = (id: string, title: string): SoundtrackTrack => ({ id, title, artist: 'Squabblemon', album: 'Mode soundtrack', ogg: `audio/modes/${id}.mp3`, aac: `audio/modes/${id}.mp3` });
const catalogById = new Map(soundtrack.map(track => [track.id, track]));
const catalogTracks = (ids: readonly string[]): SoundtrackTrack[] => ids.map(id => {
  const track = catalogById.get(id);
  if (!track) throw new Error(`Missing soundtrack track: ${id}`);
  return track;
});
const originalTrackIds = [
  'wax-killa-breaks', 'grime-of-the-temple', 'chop-block', 'shaolin-scratches', 'saber-chop', 'shaolin-static',
] as const;
const originalSoundtrack = catalogTracks(originalTrackIds);
export const outcomeSoundtracks = {
  victory: catalogTracks(['squabblemon-win', 'win-music']),
  defeat: catalogTracks(['squabblemon-loss']),
};
const uploadedBattleIds = [
  'battle-music', 'squabblemon-battle-2', 'track-1-take-2', 'track-1', 'track-1-take-3', 'track-1-wav-master',
] as const;
// Append the originals so existing saved mode indexes still point at the same new upload.
export const battleSoundtrack: readonly SoundtrackTrack[] = [...catalogTracks(uploadedBattleIds), ...originalSoundtrack];
export const modeSoundtracks = {
  battle: battleSoundtrack,
  training: [modeTrack('training-ost', 'Training OST')],
  story: [modeTrack('story-mode-ost', 'Story Mode OST'), modeTrack('story-mode-ost-2', 'Story Mode OST 2')],
  boss: [modeTrack('boss-fight-ost', 'Boss Fight OST')],
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
