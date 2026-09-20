import { useSyncExternalStore } from 'react';
import { defaultMusic, type MusicPlayer, type MusicSnapshot, type MusicPreferences, readMusicPreferences, MUSIC_STORAGE_KEY } from './musicPlayer';

let player: MusicPlayer | null = null;
let snapshot = defaultMusic;
const listeners = new Set<() => void>();
export function publishMusic(next: MusicSnapshot) { snapshot = next; listeners.forEach(listener => listener()); }
export function attachMusicPlayer(next: MusicPlayer | null) { player = next; }
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const useMusic = () => useSyncExternalStore(subscribe, () => snapshot, () => defaultMusic);
export const musicActions = {
  play: () => player?.setEnabled(true), pause: () => player?.setEnabled(false),
  next: () => { player?.unlock(); player?.next(); },
  select: (index: number) => { player?.unlock(); player?.selectTrack(index); },
  volume: (volume: number) => player?.setVolume(volume),
};
export type MusicBank = 'background' | 'mode';
const bankListeners = new Set<() => void>();
function readBank(key: string) { try { return readMusicPreferences({ getItem: () => localStorage.getItem(key) }); } catch { return { enabled: true, volume: .24, trackIndex: 0 }; } }
let banks = { background: readBank(MUSIC_STORAGE_KEY), mode: readBank('squabblemon_mode_music_v1') };
export const getMusicBanks = () => banks;
export function saveMusicBank(bank: MusicBank, next: MusicPreferences) {
  banks = { ...banks, [bank]: next };
  try { localStorage.setItem(bank === 'background' ? MUSIC_STORAGE_KEY : 'squabblemon_mode_music_v1', JSON.stringify(next)); } catch { /* Playback works without storage. */ }
  bankListeners.forEach(fn => fn());
}
const subscribeBanks = (fn: () => void) => { bankListeners.add(fn); return () => { bankListeners.delete(fn); }; };
export const useMusicBanks = () => useSyncExternalStore(subscribeBanks, getMusicBanks, getMusicBanks);
export function updateMusicBank(bank: MusicBank, patch: Partial<MusicPreferences>) { saveMusicBank(bank, { ...banks[bank], ...patch }); }
let battleMode: 'boss' | null = null;
const modeListeners = new Set<() => void>();
export function setBattleMusicMode(mode: 'boss' | null) { battleMode = mode; modeListeners.forEach(fn => fn()); }
export const useBattleMusicMode = () => useSyncExternalStore(fn => { modeListeners.add(fn); return () => { modeListeners.delete(fn); }; }, () => battleMode, () => null);
