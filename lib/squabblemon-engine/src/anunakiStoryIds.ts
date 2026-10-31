/** Stable campaign identities shared by progression, raid access and lazy Story delivery. */
export const ANUNAKI_STORY_CHAPTERS = [
  'anunaki-01-no-refunds', 'anunaki-02-tapped-in', 'anunaki-03-instructions',
  'anunaki-04-something-got-out', 'anunaki-05-divine-hands', 'anunaki-06-life-has-a-price',
  'anunaki-07-wrong-millennium', 'anunaki-08-original-arrival',
] as const;
export const ANUNAKI_STORY_SEASON = 'special-anunaki-arrival';
export const anunakiChapterFinale = (id: string) => `${id}-departure`;
