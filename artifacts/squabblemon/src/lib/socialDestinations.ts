/** Only these social destinations may survive the account/onboarding gates. */
export const SOCIAL_DESTINATION_KEY = 'squabblemon_social_destination';
const LEGACY_ROOM_KEY = 'squabblemon_friend_invite';
const MAX_AGE = 24 * 60 * 60 * 1000;
const FRIEND_CODE = /^[A-F0-9]{12}$/;
const INVITATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function safeGameDestination(raw: string, base = '', origin = 'https://squabblemon.invalid'): string | null {
  if (!raw || /[\u0000-\u001f\\]/.test(raw) || raw.startsWith('//')) return null;
  try {
    const url = new URL(raw, origin);
    if (url.origin !== origin || url.username || url.password) return null;
    const prefix = base.replace(/\/+$/, '');
    const pathname = prefix && url.pathname.startsWith(`${prefix}/`)
      ? url.pathname.slice(prefix.length) : url.pathname;
    if (pathname !== '/game' && !pathname.startsWith('/game/')) return null;
    return `${pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function safeSocialDestination(raw: string, base = '', origin = 'https://squabblemon.invalid'): string | null {
  const destination = safeGameDestination(raw, base, origin);
  if (!destination) return null;
  const url = new URL(destination, origin);
  if (/^\/game\/online\/[a-f0-9]{12}$/i.test(url.pathname)) {
    return `/game/online/${url.pathname.split('/').at(-1)!.toUpperCase()}`;
  }
  if (url.pathname === '/game/settings') {
    const code = url.searchParams.get('friend')?.toUpperCase();
    if (code && FRIEND_CODE.test(code)) return `/game/settings?friend=${code}#homies`;
    if (!url.search && url.hash === '#homies') return '/game/settings#homies';
  }
  if (url.pathname === '/game/online' && url.searchParams.get('tab') === 'friends') {
    const id = url.searchParams.get('invite');
    if (id && INVITATION_ID.test(id)) return `/game/online?tab=friends&invite=${id.toLowerCase()}`;
  }
  return null;
}

type PendingDestination = { path: string; savedAt: number; accountId: string | null };
type DestinationOptions = { base?: string; origin?: string; now?: number };

/** Storage failure must not prevent sign-in; the current URL still remains usable. */
export function rememberSocialDestination(
  storage: Storage,
  raw: string,
  accountId: string | null = null,
  { base = '', origin = 'https://squabblemon.invalid', now = Date.now() }: DestinationOptions = {},
): void {
  const path = safeSocialDestination(raw, base, origin);
  if (!path) return;
  try {
    const previous = readSocialDestination(storage, accountId, { base, origin, now });
    if (previous === path) return;
    storage.setItem(SOCIAL_DESTINATION_KEY, JSON.stringify({ path, savedAt: now, accountId } satisfies PendingDestination));
    storage.removeItem(LEGACY_ROOM_KEY);
  } catch { /* Disabled session storage: keep the current route, without persistence. */ }
}

export function readSocialDestination(
  storage: Storage,
  accountId: string | null = null,
  { base = '', origin = 'https://squabblemon.invalid', now = Date.now() }: DestinationOptions = {},
): string | null {
  try {
    const raw = storage.getItem(SOCIAL_DESTINATION_KEY);
    if (!raw) {
      // Upgrade existing shared-room journeys once; never interpret arbitrary storage as a route.
      const legacy = storage.getItem(LEGACY_ROOM_KEY);
      storage.removeItem(LEGACY_ROOM_KEY);
      if (!legacy) return null;
      const path = safeSocialDestination(legacy, base, origin);
      if (!path) return null;
      storage.setItem(SOCIAL_DESTINATION_KEY, JSON.stringify({ path, savedAt: now, accountId } satisfies PendingDestination));
      return path;
    }
    const pending: PendingDestination = JSON.parse(raw);
    const path = typeof pending.path === 'string' ? safeSocialDestination(pending.path, base, origin) : null;
    if (!path || !Number.isFinite(pending.savedAt) || now - pending.savedAt > MAX_AGE || pending.savedAt > now ||
      (accountId && pending.accountId && accountId !== pending.accountId)) {
      clearSocialDestination(storage);
      return null;
    }
    if (accountId && !pending.accountId) {
      storage.setItem(SOCIAL_DESTINATION_KEY, JSON.stringify({ ...pending, accountId }));
    }
    return path;
  } catch {
    clearSocialDestination(storage);
    return null;
  }
}

export function clearSocialDestination(storage: Storage): void {
  try {
    storage.removeItem(SOCIAL_DESTINATION_KEY);
    storage.removeItem(LEGACY_ROOM_KEY);
  } catch { /* Storage is optional; it is not an authorization mechanism. */ }
}

export function consumeSocialDestination(storage: Storage, accountId: string, options?: DestinationOptions): string | null {
  const destination = readSocialDestination(storage, accountId, options);
  clearSocialDestination(storage);
  return destination;
}