import { useSyncExternalStore } from 'react';
import { defaultMusic, type MusicPlayer, type MusicSnapshot } from './musicPlayer';

let player: MusicPlayer | null = null;
let snapshot = defaultMusic;
const listeners = new Set<() => void>();
export function publishMusic(next: MusicSnapshot) {
  snapshot = next;
  listeners.forEach(listener => listener());
}
export function attachMusicPlayer(next: MusicPlayer | null) { player = next; }
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const useMusic = () => useSyncExternalStore(subscribe, () => snapshot, () => defaultMusic);
export const musicActions = {
  play: () => player?.setEnabled(true),
  pause: () => player?.setEnabled(false),
  next: () => { player?.unlock(); player?.next(); },
  select: (index: number) => { player?.unlock(); player?.selectTrack(index); },
  volume: (volume: number) => player?.setVolume(volume),
};
