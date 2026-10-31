import { useSyncExternalStore } from 'react';

/** Keep the existing device preference compatible with saved Safehouse settings. */
export const WORLD_LIGHTING_STORAGE_KEY = 'squabblemon_safehouse_lighting';
export const WORLD_LIGHTING_EVENT = 'squabblemon:world-lighting';
export type WorldLightingUpdate = boolean | ((previous: boolean) => boolean);
type LightingTarget = Pick<Window, 'localStorage' | 'addEventListener' | 'removeEventListener' | 'dispatchEvent'>;
const browserTarget = (): LightingTarget | undefined => typeof window === 'undefined' ? undefined : window;

/** One small presentation store; it never writes an account or reloads a scene. */
export function createWorldLightingStore(targetFor: () => LightingTarget | undefined = browserTarget) {
  let target: LightingTarget | undefined;
  let attached: LightingTarget | undefined;
  let night = false;
  // Quota/security failures can leave readable but stale storage. Keep the live
  // choice in memory until another explicit change or real storage event.
  let volatile = false;
  const listeners = new Set<() => void>();
  const update = (next: boolean) => {
    if (night === next) return;
    night = next;
    for (const listener of listeners) listener();
  };
  const read = (current: LightingTarget) => {
    try { update(current.localStorage.getItem(WORLD_LIGHTING_STORAGE_KEY) === 'night'); }
    catch { /* A blocked preference must not block entry or the lighting control. */ }
  };
  const ensureTarget = () => {
    const current = targetFor();
    if (current !== target) {
      target = current;
      night = false;
      volatile = false;
      if (current) read(current);
    }
    return current;
  };
  const onStorage: EventListener = event => {
    const value = event as StorageEvent;
    if (value.key !== WORLD_LIGHTING_STORAGE_KEY && value.key !== null) return;
    try { if (value.storageArea && value.storageArea !== attached?.localStorage) return; }
    catch { /* The event still carries the new value when storage is restricted. */ }
    volatile = false;
    update(value.newValue === 'night');
  };
  const onSameTab: EventListener = event => {
    const detail = (event as CustomEvent<unknown>).detail;
    if (!detail || typeof detail !== 'object' || !('night' in detail) || typeof detail.night !== 'boolean') return;
    volatile = !('persisted' in detail && detail.persisted === true);
    update(detail.night);
  };
  const detach = () => {
    attached?.removeEventListener('storage', onStorage);
    attached?.removeEventListener(WORLD_LIGHTING_EVENT, onSameTab);
    attached = undefined;
  };
  const getSnapshot = () => ensureTarget() ? night : false;
  const subscribe = (listener: () => void) => {
    const current = ensureTarget();
    listeners.add(listener);
    if (current && attached !== current) {
      detach();
      attached = current;
      current.addEventListener('storage', onStorage);
      current.addEventListener(WORLD_LIGHTING_EVENT, onSameTab);
      // Another tab may have changed the preference while neither room was mounted.
      if (!volatile) read(current);
    }
    return () => { listeners.delete(listener); if (!listeners.size) detach(); };
  };
  const setNight = (value: WorldLightingUpdate) => {
    const current = ensureTarget();
    if (!current) return; // Do not retain one SSR request's choice for another request.
    const next = typeof value === 'function' ? value(night) : value;
    let persisted = false;
    try { current.localStorage.setItem(WORLD_LIGHTING_STORAGE_KEY, next ? 'night' : 'day'); persisted = true; }
    catch { /* The in-memory preference still works for this session. */ }
    volatile = !persisted;
    update(next);
    current.dispatchEvent(new CustomEvent(WORLD_LIGHTING_EVENT, { detail: { night: next, persisted } }));
  };
  return { getSnapshot, getServerSnapshot: () => false, subscribe, setNight };
}

const lighting = createWorldLightingStore();
export const getWorldLighting = lighting.getSnapshot;
export const setWorldLighting = lighting.setNight;
export const subscribeWorldLighting = lighting.subscribe;
export function useWorldLighting() {
  const night = useSyncExternalStore(lighting.subscribe, lighting.getSnapshot, lighting.getServerSnapshot);
  return [night, lighting.setNight] as const;
}
