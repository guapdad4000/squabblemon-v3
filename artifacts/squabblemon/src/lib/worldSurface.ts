import { useSyncExternalStore } from 'react';

/** Presentation state only. Progression, wallet balances and rewards remain server-owned. */
export type WorldSurface = 'inactive' | 'loading' | 'exploring' | 'busy';

let surface: WorldSurface = 'inactive';
const listeners = new Set<() => void>();

export const getWorldSurface = () => surface;
export function setWorldSurface(next: WorldSurface) {
  if (surface === next) return;
  surface = next;
  for (const listener of listeners) listener();
}
export function subscribeWorldSurface(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function useWorldSurface() {
  return useSyncExternalStore(subscribeWorldSurface, getWorldSurface, () => 'inactive' as const);
}

/** Existing arrivals may queue while loading/travelling or interacting with a host. */
export const worldAutoPresentationAllowed = (state: WorldSurface) => state === 'inactive' || state === 'exploring';
export const isWorldAutoPresentationAllowed = () => worldAutoPresentationAllowed(surface);
export function useWorldAutoPresentationAllowed() {
  return worldAutoPresentationAllowed(useWorldSurface());
}

/** Keep presenters mounted during world dialogs so their saved receipt is not lost. */
export function isWorldArrivalRoute(location: string, state: WorldSurface) {
  return location.split(/[?#]/, 1)[0].replace(/\/+$/, '') === '/game/story' && state !== 'inactive';
}

/** Roaming is not the same as reading the Story archive or an actual chapter overlay. */
export const storyOverviewReceiptAllowed = (state: WorldSurface, storyContentActive: boolean) => state !== 'loading' && storyContentActive;
