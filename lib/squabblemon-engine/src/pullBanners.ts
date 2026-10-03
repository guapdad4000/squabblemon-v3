import { cardCatalog, STORY_ONLY_CARD_IDS } from './data';
import { GANG_BY_CARD_ID } from './tripleOgs';

export type PullBanner = {
  id: string; name: string; headline: string; accent: string;
  featuredCardIds: readonly string[]; showcaseCardIds: readonly string[];
  startsAt: string | null; endsAt: string | null;
};
const storyOnly = new Set<string>(STORY_ONLY_CARD_IDS);
const featured = (matches: (card: typeof cardCatalog[number]) => boolean) =>
  cardCatalog.filter(card => !storyOnly.has(card.catalogId) && matches(card)).map(card => card.catalogId);
// Explicit UTC dates shared by UI and server; page reloads never restart the window.
const FIRST_WINDOW = { startsAt: '2026-10-03T00:00:00Z', endsAt: '2026-10-17T00:00:00Z' };
export const PULL_BANNERS: readonly PullBanner[] = [
  { id: 'standard', name: 'Street Pack', headline: 'Fight Night', accent: '#c54d37', featuredCardIds: [], showcaseCardIds: ['guap', 'dr-fade', 'buddy'], startsAt: null, endsAt: null },
  { id: 'inmates', name: 'Inmates', headline: 'Cellblock Roll Call', accent: '#ba6632', featuredCardIds: featured(card => card.catalogId.startsWith('inmate-')), showcaseCardIds: ['inmate-crafty', 'inmate-kingpin', 'inmate-boyfriend'], ...FIRST_WINDOW },
  { id: 'oz', name: 'Oz', headline: 'Follow the Gold', accent: '#48744d', featuredCardIds: featured(card => card.faction === 'The Wiz'), showcaseCardIds: ['dorothy', 'oz', 'wicked-witch'], ...FIRST_WINDOW },
  { id: 'wonderland', name: 'Wonderland', headline: 'Down the Rabbit Hole', accent: '#82517f', featuredCardIds: featured(card => card.faction === 'Wonderland'), showcaseCardIds: ['alice', 'queen-of-hearts', 'cheshire'], ...FIRST_WINDOW },
  { id: 'red-blue', name: 'Red & Blue', headline: 'Colors on the Block', accent: '#775286', featuredCardIds: featured(card => card.faction === 'Red Side' || card.faction === 'Blue Side' || Boolean(GANG_BY_CARD_ID[card.engineId]) || ['initiation', 'cane-corso-red'].includes(card.catalogId)), showcaseCardIds: ['triple-og-red', 'initiation', 'triple-og-blue'], ...FIRST_WINDOW },
];
export function isPullBannerActive(banner: PullBanner, now = Date.now()): boolean {
  return (!banner.startsAt || now >= Date.parse(banner.startsAt)) && (!banner.endsAt || now < Date.parse(banner.endsAt));
}
export function resolvePullBanner(id = 'standard', now = Date.now()): PullBanner {
  const banner = PULL_BANNERS.find(candidate => candidate.id === id);
  if (!banner || !isPullBannerActive(banner, now)) throw new Error('This pull banner is unavailable. Choose an active banner.');
  return banner;
}
