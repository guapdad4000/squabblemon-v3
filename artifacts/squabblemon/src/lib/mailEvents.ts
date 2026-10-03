/** Curated client presentation for operator-authored mail; no URLs come from inbox data. */
export const SQUABBLE_HOUSE_MAIL_ID = 'patch_1-9_eca06fdd26e513a7';

export function getMailEventPresentation(mailId: string) {
  if (mailId !== SQUABBLE_HOUSE_MAIL_ID) return undefined;
  return {
    bannerAssetId: 'assets/events/last-waffle-patch-1-9.webp',
    bannerAlt: 'The Last Waffle — a Squabble House story. Manager serves breakfast as Red and Blue face off.',
    href: '/game/story?season=special-squabble-house',
    actionLabel: 'Play The Last Waffle',
  };
}
