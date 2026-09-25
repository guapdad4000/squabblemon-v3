import { getStoryBattle, storyContent } from '@workspace/squabblemon-engine/story';
import soundtrack from './soundtrack.json';
export type MusicMode = 'background' | 'battle' | 'training' | 'story' | 'boss' | 'gacha' | 'fadecade' | 'victory' | 'defeat';
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
export const fadecadeSoundtrack: readonly SoundtrackTrack[] = [{
  id: 'fadecade-oakland-chrome-and-curls',
  title: 'Oakland Chrome and Curls — Track 1',
  artist: 'Treblo',
  album: 'The Fadecade',
  ogg: 'audio/modes/fadecade-oakland-chrome-and-curls.ogg',
  aac: 'audio/modes/fadecade-oakland-chrome-and-curls.mp3',
}];
const storyChapterSoundtracks = {
  odd: catalogTracks(['story-music']),
  even: catalogTracks(['story-music-3']),
};
export const modeSoundtracks = {
  battle: battleSoundtrack,
  fadecade: fadecadeSoundtrack,
  training: [modeTrack('training-ost', 'Training OST')],
  story: [...storyChapterSoundtracks.odd, ...storyChapterSoundtracks.even],
  boss: [modeTrack('boss-fight-ost', 'Boss Fight OST')],
  gacha: [modeTrack('gatcha-ost', 'Gacha OST')],
  ...outcomeSoundtracks,
};
export function musicModeForRoute(path: string): MusicMode {
  const battle = path.match(/\/game\/story\/play\/([^/?]+)/)?.[1];
  if (battle) { const type = getStoryBattle(battle)?.battleType; return type === 'boss' || type === 'mini-boss' ? 'boss' : 'story'; }
  if (path.startsWith('/game/story')) return 'story';
  if (path.startsWith('/game/shop')) {
    const view = new URLSearchParams(path.split('?')[1] ?? '').get('view');
    if (view === 'training' || view === 'market') return 'training';
    if (view === 'corner') return 'background';
    return 'gacha';
  }
  if (/^\/game\/online(?:\/|$)/.test(path)) return 'battle';
  if (path === '/play/guest' || (path === '/game/play' || path === '/game/training') || /\/decks\/[^/]+\/test/.test(path)) return 'training';
  return 'background';
}
export function soundtrackForRoute(path: string, mode: MusicMode): readonly SoundtrackTrack[] {
  if (mode === 'background') return soundtrack;
  if (mode !== 'story') return modeSoundtracks[mode];
  const nodeId = path.match(/\/game\/story\/play\/([^/?]+)/)?.[1];
  if (!nodeId) return modeSoundtracks.story;
  const chapter = storyContent.chapters.find(candidate => candidate.nodes.some(node => node.id === nodeId));
  return chapter?.order && chapter.order % 2 === 0 ? storyChapterSoundtracks.even : storyChapterSoundtracks.odd;
}
export function activeMusicMode(path: string, override: 'battle' | 'fadecade' | 'boss' | 'victory' | 'defeat' | null): MusicMode {
  // A completed room may keep its result component alive briefly while routing
  // back to the lobby. The lobby must never inherit that room's outcome cue.
  if (/^\/game\/online(?:\?|$)/.test(path)) return 'battle';
  return override ?? musicModeForRoute(path);
}
