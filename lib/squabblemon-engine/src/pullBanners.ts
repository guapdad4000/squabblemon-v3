import { cardCatalog, STORY_ONLY_CARD_IDS } from './data';
import { GANG_BY_CARD_ID } from './tripleOgs';
import { ANUNAKI_BANNER_CARD_IDS, ANUNAKI_BANNER_GAMEPLAY_READY, ANUNAKI_BANNER_WINDOWS, type AnunakiBannerWindow } from './anunakiBanner';

export type PullBannerDefinition = {
  id: string; name: string; headline: string; accent: string;
  featuredCardIds: readonly string[]; showcaseCardIds: readonly string[];
};
export type PullBanner = PullBannerDefinition & {
  startsAt: string | null; endsAt: string | null; occurrenceId: string | null;
};
const storyOnly = new Set<string>(STORY_ONLY_CARD_IDS);
const featured = (matches: (card: typeof cardCatalog[number]) => boolean) =>
  cardCatalog.filter(card => !storyOnly.has(card.catalogId) && matches(card)).map(card => card.catalogId);
// Definition IDs are permanent. Only their weekly occurrences rotate.
export const PULL_BANNERS: readonly PullBannerDefinition[] = [
  { id: 'standard', name: 'Street Pack', headline: 'Fight Night', accent: '#c54d37', featuredCardIds: [], showcaseCardIds: ['guap', 'dr-fade', 'buddy'] },
  { id: 'inmates', name: 'Inmates', headline: 'Cellblock Roll Call', accent: '#ba6632', featuredCardIds: featured(card => card.catalogId.startsWith('inmate-')), showcaseCardIds: ['inmate-crafty', 'inmate-kingpin', 'inmate-boyfriend'] },
  { id: 'oz', name: 'Oz', headline: 'Follow the Gold', accent: '#48744d', featuredCardIds: featured(card => card.faction === 'The Wiz'), showcaseCardIds: ['dorothy', 'oz', 'wicked-witch'] },
  { id: 'wonderland', name: 'Wonderland', headline: 'Down the Rabbit Hole', accent: '#82517f', featuredCardIds: featured(card => card.faction === 'Wonderland'), showcaseCardIds: ['alice', 'queen-of-hearts', 'cheshire'] },
  { id: 'red-blue', name: 'Red & Blue', headline: 'Colors on the Block', accent: '#775286', featuredCardIds: featured(card => card.faction === 'Red Side' || card.faction === 'Blue Side' || Boolean(GANG_BY_CARD_ID[card.engineId]) || ['initiation', 'cane-corso-red'].includes(card.catalogId)), showcaseCardIds: ['triple-og-red', 'initiation', 'triple-og-blue'] },
];
/** Separate from weekly rotation so historical weekly identities never change. */
export const ANUNAKI_PULL_BANNER: PullBannerDefinition = {
  id: 'anunaki', name: 'Anunaki', headline: 'Arrival of the Anunaki', accent: '#33d39c',
  featuredCardIds: ANUNAKI_BANNER_CARD_IDS, showcaseCardIds: ['nabu', 'enki', 'utu'],
};
function validAnunakiWindow(window: AnunakiBannerWindow): boolean {
  const start = Date.parse(window.startsAt), end = Date.parse(window.endsAt);
  return Number.isFinite(start) && Number.isFinite(end) && start < end
    && new Date(start).toISOString() === window.startsAt && new Date(end).toISOString() === window.endsAt
    && window.startsAt.endsWith('T00:00:00.000Z') && window.endsAt.endsWith('T00:00:00.000Z');
}
function anunakiWindowBanner(window: AnunakiBannerWindow): PullBanner {
  return { ...ANUNAKI_PULL_BANNER, ...window, occurrenceId: `anunaki:${window.startsAt.slice(0, 10)}` };
}
export function activeAnunakiBanner(now: number, windows: readonly AnunakiBannerWindow[] = ANUNAKI_BANNER_WINDOWS,
  ready = ANUNAKI_BANNER_GAMEPLAY_READY): PullBanner | null {
  if (!ready || !Number.isFinite(now)) return null;
  // Ambiguous or malformed windows fail closed rather than changing a paid occurrence.
  if (windows.some(window => !validAnunakiWindow(window))) return null;
  const active = windows.filter(window => now >= Date.parse(window.startsAt) && now < Date.parse(window.endsAt));
  if (active.length) return active.length === 1 ? anunakiWindowBanner(active[0]) : null;
  const monthly = monthlyAnunakiWindow(now, windows);
  return monthly && now >= Date.parse(monthly.startsAt) && now < Date.parse(monthly.endsAt) ? anunakiWindowBanner(monthly) : null;
}
/** First Monday 00:00 UTC through the next Monday, after all authored launch windows. */
export function monthlyAnunakiWindow(now: number, windows: readonly AnunakiBannerWindow[] = ANUNAKI_BANNER_WINDOWS): AnunakiBannerWindow | null {
  if (!Number.isFinite(now) || !windows.length || windows.some(window => !validAnunakiWindow(window))) return null;
  const date = new Date(now);
  const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  first.setUTCDate(1 + (8 - first.getUTCDay()) % 7);
  const start = first.getTime();
  const launch = [...windows].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0];
  if (start < Date.parse(launch.endsAt)) return null;
  // Appending a future authored window cannot invalidate earlier monthly receipts.
  if (windows.some(window => start < Date.parse(window.endsAt) && start + 7 * 86400000 > Date.parse(window.startsAt))) return null;
  return { startsAt: first.toISOString(), endsAt: new Date(start + 7 * 86400000).toISOString() };
}
export function nextAnunakiBanner(now: number): PullBanner | null {
  if (!ANUNAKI_BANNER_GAMEPLAY_READY || !ANUNAKI_BANNER_WINDOWS.length) return null;
  const explicit = ANUNAKI_BANNER_WINDOWS.filter(window => validAnunakiWindow(window) && Date.parse(window.startsAt) > now).map(anunakiWindowBanner);
  for (let month = 0; month < 24; month++) {
    const date = new Date(now);
    const candidate = monthlyAnunakiWindow(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + month, 1));
    if (candidate && Date.parse(candidate.startsAt) > now) { explicit.push(anunakiWindowBanner(candidate)); break; }
  }
  return explicit.sort((a, b) => Date.parse(a.startsAt!) - Date.parse(b.startsAt!))[0] ?? null;
}
export const PULL_BANNER_ROTATION_ANCHOR = '2026-10-19T00:00:00.000Z';
export const PULL_BANNER_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const anchor = Date.parse(PULL_BANNER_ROTATION_ANCHOR);
const themes = PULL_BANNERS.slice(1);
const standard: PullBanner = { ...PULL_BANNERS[0], startsAt: null, endsAt: null, occurrenceId: null };
function occurrence(week: number): PullBanner {
  const definition = themes[week % themes.length];
  const startsAt = new Date(anchor + week * PULL_BANNER_WEEK_MS).toISOString();
  return { ...definition, startsAt, endsAt: new Date(anchor + (week + 1) * PULL_BANNER_WEEK_MS).toISOString(), occurrenceId: `${definition.id}:${startsAt.slice(0, 10)}` };
}
/** One shared UTC clock: no local timezone, page-load timer, or cron state. */
export function getPullBannerSchedule(now = Date.now()) {
  if (!Number.isFinite(now)) throw new Error('Invalid banner schedule time.');
  const week = Math.floor((now - anchor) / PULL_BANNER_WEEK_MS);
  return { standard, featured: week < 0 ? null : occurrence(week), next: occurrence(Math.max(0, week + 1)), special: activeAnunakiBanner(now) };
}
/** Recover the original display identity from a pending request or saved receipt. */
export function getPullBannerOccurrence(occurrenceId: string | null | undefined): PullBanner | null {
  if (!occurrenceId) return null;
  if (occurrenceId.startsWith('anunaki:')) {
    const window = ANUNAKI_BANNER_WINDOWS.find(item => validAnunakiWindow(item) && `anunaki:${item.startsAt.slice(0, 10)}` === occurrenceId);
    if (window) return anunakiWindowBanner(window);
    const match = /^anunaki:(\d{4}-\d{2}-\d{2})$/.exec(occurrenceId);
    const monthly = match ? monthlyAnunakiWindow(Date.parse(`${match[1]}T00:00:00.000Z`)) : null;
    return monthly && `anunaki:${monthly.startsAt.slice(0, 10)}` === occurrenceId ? anunakiWindowBanner(monthly) : null;
  }
  const match = /^([a-z-]+):(\d{4}-\d{2}-\d{2})$/.exec(occurrenceId);
  if (!match) return null;
  const week = (Date.parse(`${match[2]}T00:00:00.000Z`) - anchor) / PULL_BANNER_WEEK_MS;
  if (!Number.isInteger(week) || week < 0) return null;
  const banner = occurrence(week);
  return banner.occurrenceId === occurrenceId ? banner : null;
}
export function isPullBannerActive(banner: PullBannerDefinition | PullBanner, now = Date.now()): boolean {
  if (!Number.isFinite(now)) return false;
  if (banner.id === 'standard') return true;
  if (banner.id === 'anunaki') {
    const active = activeAnunakiBanner(now);
    return !!active && (!('occurrenceId' in banner) || banner.occurrenceId === active.occurrenceId);
  }
  const active = getPullBannerSchedule(now).featured;
  return active?.id === banner.id && (!('occurrenceId' in banner) || banner.occurrenceId === active.occurrenceId);
}
export function matchesPullBannerRequest(banner: PullBanner | null | undefined, id: string, occurrenceId?: string): boolean {
  if (!banner) return false;
  // New event banners require an exact occurrence. Weekly legacy requests may omit it.
  return id === 'anunaki' ? !!occurrenceId && occurrenceId === banner.occurrenceId
    : occurrenceId === undefined || occurrenceId === banner.occurrenceId;
}
export function resolvePullBanner(id = 'standard', now = Date.now(), occurrenceId?: string): PullBanner {
  const schedule = getPullBannerSchedule(now);
  const banner = id === 'standard' ? schedule.standard : id === 'anunaki' ? schedule.special : schedule.featured?.id === id ? schedule.featured : null;
  if (!matchesPullBannerRequest(banner, id, occurrenceId)) {
    throw new Error('This pull banner is unavailable. Choose an active banner.');
  }
  return banner!;
}
/** Existing receipts keep their v1 identity; the optional week records purchase intent. */
export function pullBannerOddsVersion(baseVersion: string, banner: PullBanner): string {
  return banner.id === 'standard' ? baseVersion : `${baseVersion}:banner-${banner.id}-v2:week-${banner.startsAt!.slice(0, 10)}`;
}
export function pullBannerReceiptIdentity(oddsVersion?: string): { bannerId: string; occurrenceId?: string } {
  const match = /:banner-([a-z-]+)-v\d+(?::week-(\d{4}-\d{2}-\d{2}))?$/.exec(oddsVersion ?? '');
  if (!match || match[1] !== 'anunaki' && !PULL_BANNERS.some(banner => banner.id === match[1])) return { bannerId: 'standard' };
  return { bannerId: match[1], ...(match[2] ? { occurrenceId: `${match[1]}:${match[2]}` } : {}) };
}
