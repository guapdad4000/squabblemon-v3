import { useLayoutEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { useLocation, useSearch } from 'wouter';

const INDEX = '__squabblemonHistoryIndex';
const PREFIX = 'squabblemon:navigation:';
export function readMemory<T>(key: string, fallback: T): T {
  try { return JSON.parse(sessionStorage.getItem(PREFIX + key) ?? 'null') ?? fallback; } catch { return fallback; }
}
export function writeMemory(key: string, value: unknown) {
  try { sessionStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* Storage is optional. */ }
}
export function rememberHistoryLocation(index: number) {
  writeMemory('route:' + index, location.pathname + location.search + location.hash);
}
export function routeFallback(path: string): string {
  if (/\/game\/story[?#]/.test(path)) return '/game/story';
  if (/\/game\/decks\/[^/]+\/test/.test(path)) return path.replace(/\/test.*$/, '');
  if (/\/game\/decks\//.test(path)) return '/game/decks';
  if (/\/game\/style\//.test(path)) return '/game/style';
  if (/\/game\/story\/play\//.test(path)) return '/game/story';
  if (/\/game\/online\//.test(path)) return '/game/online';
  return '/game';
}
export function previousGameLocation(): string | null {
  const index = history.state?.[INDEX];
  if (!Number.isInteger(index) || index < 1) return null;
  const previous = readMemory<string | null>('route:' + (index - 1), null);
  const base = (import.meta.env?.BASE_URL ?? '/').replace(/\/$/, '');
  return previous && (previous === base + '/game' || previous.startsWith(base + '/game/') || previous.startsWith(base + '/game?')) ? previous : null;
}
/** Small view choices survive route unmounts and refresh, scoped to the player. */
export function useViewMemory<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => readMemory(key, initial));
  const update: Dispatch<SetStateAction<T>> = next => setValue(previous => {
    const value = typeof next === 'function' ? (next as (value: T) => T)(previous) : next;
    writeMemory(key, value);
    return value;
  });
  return [value, update];
}
const owners = '.game-shell__content,.game-route-stage,.immersive-shell,.collection-stage__body,.arsenal-body,.arsenal-grid,.inventory-room,.character-styles,.bounty-hunter__scroll,.market,.corner-store__scroll,.story-atlas__viewport';
/** Restore the entry's own scroll positions, including query-string navigation. */
export function useNavigationScroll() {
  const [path] = useLocation();
  const search = useSearch();
  useLayoutEffect(() => {
    const key = 'scroll:' + history.state?.[INDEX];
    const saved = readMemory<Array<[number, number]>>(key, []);
    let restoring = true;
    let observer: MutationObserver | undefined;
    const elements = () => [document.scrollingElement!, ...document.querySelectorAll<HTMLElement>(owners)];
    const restore = () => {
      if (!restoring) return;
      const nodes = elements();
      nodes.forEach((element, i) => {
        element.scrollLeft = saved[i]?.[0] ?? 0;
        element.scrollTop = saved[i]?.[1] ?? 0;
      });
      // Data-backed pages can mount their scroll owner after the first frame.
      if (saved.every(([x, y], i) => nodes[i] && Math.abs(nodes[i].scrollTop - y) < 2 && Math.abs(nodes[i].scrollLeft - x) < 2)) {
        restoring = false;
        observer?.disconnect();
      }
    };
    const interrupt = () => { restoring = false; observer?.disconnect(); };
    const frame = requestAnimationFrame(restore);
    observer = new MutationObserver(restore);
    observer.observe(document.body, { childList: true, subtree: true });
    const save = () => { if (!restoring) writeMemory(key, elements().map(el => [el.scrollLeft, el.scrollTop])); };
    document.addEventListener('scroll', save, true);
    document.addEventListener('wheel', interrupt, { passive: true });
    document.addEventListener('touchstart', interrupt, { passive: true });
    document.addEventListener('keydown', interrupt);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      document.removeEventListener('scroll', save, true);
      document.removeEventListener('wheel', interrupt);
      document.removeEventListener('touchstart', interrupt);
      document.removeEventListener('keydown', interrupt);
    };
  }, [path, search]);
}
