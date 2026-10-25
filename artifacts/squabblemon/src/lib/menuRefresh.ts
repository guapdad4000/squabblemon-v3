import { useSyncExternalStore } from 'react';
import { isBattleActive, subscribeBattleActive } from './imageWarmup';
export const menuRefreshAllowed = () => !isBattleActive() && (typeof document === 'undefined' || document.visibilityState !== 'hidden');
const listeners = new Set<() => void>();
let releaseBattle: (() => void) | undefined;
const notify = () => { for (const listener of listeners) listener(); };
function subscribe(listener: () => void) {
  if (!listeners.size) {
    releaseBattle = subscribeBattleActive(notify);
    document.addEventListener('visibilitychange', notify);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      releaseBattle?.(); releaseBattle = undefined;
      document.removeEventListener('visibilitychange', notify);
    }
  };
}
/** Automatic menu reads yield to combat. Explicit reward/receipt mutations remain independent. */
export function useMenuRefreshAllowed() {
  return useSyncExternalStore(subscribe, menuRefreshAllowed, () => false);
}
