import { useSyncExternalStore } from 'react';

export const ANNOUNCER_VOLUME_KEY = 'squabblemon_battle_announcer_volume';
const CHANGE_EVENT = 'squabblemon:announcer-volume';
const DEFAULT_VOLUME = 0.9;
// Retain changes even in browsers that deny access to localStorage.
let fallback = DEFAULT_VOLUME;

export function getAnnouncerVolume(): number {
  try {
    const stored = localStorage.getItem(ANNOUNCER_VOLUME_KEY);
    const value = stored === null ? fallback : Number(stored);
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : DEFAULT_VOLUME;
  } catch { return fallback; }
}

export function setAnnouncerVolume(value: number) {
  if (!Number.isFinite(value)) return;
  fallback = Math.max(0, Math.min(1, value));
  try { localStorage.setItem(ANNOUNCER_VOLUME_KEY, String(fallback)); } catch { /* Storage is optional. */ }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeAnnouncerVolume(listener: () => void): () => void {
  const storage = (event: StorageEvent) => { if (event.key === null || event.key === ANNOUNCER_VOLUME_KEY) listener(); };
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener('storage', storage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener('storage', storage);
  };
}

export function useAnnouncerVolume() {
  return useSyncExternalStore(subscribeAnnouncerVolume, getAnnouncerVolume, () => DEFAULT_VOLUME);
}
