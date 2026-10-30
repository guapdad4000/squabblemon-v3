/** Curated client presentation for operator-authored mail; no URLs come from inbox data. */
export const SQUABBLE_HOUSE_MAIL_ID = 'patch_1-9_eca06fdd26e513a7';

export const STREET_LEGENDS_MAIL_ID = 'patch_1-11_b096c134b668c19b';

export const COLLECTOR_V2_MAIL_ID = 'patch_1-14_69828231cb667d04';

/** Server makePatchLetter identity for version 1.15; changing copy never creates another grant. */
export const KUMITE_BREAKTHROUGH_MAIL_ID = 'patch_1-15_9f0e787f95cbd2f6';

export function getMailEventPresentation(mailId: string) {
  if (mailId === KUMITE_BREAKTHROUGH_MAIL_ID) return {
    bannerAssetId: 'assets/events/kumite-breakthrough-patch-1-15.webp',
    bannerSmallAssetId: 'assets/events/kumite-breakthrough-patch-1-15-small.webp',
    bannerAlt: 'Kumite Breakthrough Beta: three lanes, real-time Motion and a two-hit base.',
    href: '/game/events?patch=1.15',
    actionLabel: 'Read Breakthrough rules & release info',
  };
  if (mailId === COLLECTOR_V2_MAIL_ID) return {
    bannerAssetId: 'assets/events/collector-v2-patch-1-14.webp',
    bannerSmallAssetId: 'assets/events/collector-v2-patch-1-14-small.webp',
    bannerAlt: 'Print. Prism. Punch. Collector V2: layered cards, prismatic foil and a sharper battlefield.',
    href: '/game/events?patch=1.14',
    actionLabel: 'Explore the full update',
  };
  if (mailId === STREET_LEGENDS_MAIL_ID) return {
    bannerAssetId: 'assets/events/street-legends-patch-1-11.webp',
    bannerAlt: 'Them Streets Talkin: 30 new fighters and a gift of 10 Street Pack Tickets.',
    href: '/game/events?patch=1.11',
    actionLabel: 'Read the release notes',
  };
  if (mailId !== SQUABBLE_HOUSE_MAIL_ID) return undefined;
  return {
    bannerAssetId: 'assets/events/last-waffle-patch-1-9.webp',
    bannerAlt: 'The Last Waffle — a Squabble House story. Manager serves breakfast as Red and Blue face off.',
    href: '/game/story?season=special-squabble-house',
    actionLabel: 'Play The Last Waffle',
  };
}
