import { getStoryBattle } from '@workspace/squabblemon-engine/story';
export type MusicMode = 'background' | 'training' | 'story' | 'boss' | 'gacha';
export type SoundtrackTrack = { id: string; title: string; artist: string; album: string; ogg: string; aac: string };
const modeTrack = (id: string, title: string): SoundtrackTrack => ({ id, title, artist: 'Squabblemon', album: 'Mode soundtrack', ogg: `audio/modes/${id}.mp3`, aac: `audio/modes/${id}.mp3` });
export const modeSoundtracks = {
  training: [modeTrack('training-ost', 'Training OST')],
  story: [modeTrack('story-mode-ost', 'Story Mode OST'), modeTrack('story-mode-ost-2', 'Story Mode OST 2')],
  boss: [modeTrack('boss-fight-ost', 'Boss Fight OST')],
  gacha: [modeTrack('gatcha-ost', 'Gacha OST')],
};
export function musicModeForRoute(path: string): MusicMode {
  const battle = path.match(/\/game\/story\/play\/([^/?]+)/)?.[1];
  if (battle) { const type = getStoryBattle(battle)?.battleType; return type === 'boss' || type === 'mini-boss' ? 'boss' : 'story'; }
  if (path.startsWith('/game/story')) return 'story';
  if (path.startsWith('/game/shop')) return 'gacha';
  if (path === '/play/guest' || path === '/game/play' || /\/decks\/[^/]+\/test/.test(path)) return 'training';
  return 'background';
}
