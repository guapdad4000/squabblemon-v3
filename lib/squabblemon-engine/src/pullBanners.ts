import { cardCatalog, STORY_ONLY_CARD_IDS } from './data';
import { GANG_BY_CARD_ID } from './tripleOgs';

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
  return { standard, featured: week < 0 ? null : occurrence(week), next: occurrence(Math.max(0, week + 1)) };
}
/** Recover the original display identity from a pending request or saved receipt. */
export function getPullBannerOccurrence(occurrenceId: string | null | undefined): PullBanner | null {
  if (!occurrenceId) return null;
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
  const active = getPullBannerSchedule(now).featured;
  return active?.id === banner.id && (!('occurrenceId' in banner) || banner.occurrenceId === active.occurrenceId);
}
export function resolvePullBanner(id = 'standard', now = Date.now(), occurrenceId?: string): PullBanner {
  const schedule = getPullBannerSchedule(now);
  const banner = id === 'standard' ? schedule.standard : schedule.featured?.id === id ? schedule.featured : null;
  if (!banner || (occurrenceId !== undefined && occurrenceId !== banner.occurrenceId)) {
    throw new Error('This pull banner is unavailable. Choose an active banner.');
  }
  return banner;
}
/** Existing receipts keep their v1 identity; the optional week records purchase intent. */
export function pullBannerOddsVersion(baseVersion: string, banner: PullBanner): string {
  return banner.id === 'standard' ? baseVersion : `${baseVersion}:banner-${banner.id}-v1:week-${banner.startsAt!.slice(0, 10)}`;
}
export function pullBannerReceiptIdentity(oddsVersion?: string): { bannerId: string; occurrenceId?: string } {
  const match = /:banner-([a-z-]+)-v\d+(?::week-(\d{4}-\d{2}-\d{2}))?$/.exec(oddsVersion ?? '');
  if (!match || !PULL_BANNERS.some(banner => banner.id === match[1])) return { bannerId: 'standard' };
  return { bannerId: match[1], ...(match[2] ? { occurrenceId: `${match[1]}:${match[2]}` } : {}) };
}
