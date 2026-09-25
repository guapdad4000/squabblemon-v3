export type StorySeasonDefinition = {
  readonly id: string;
  readonly kind: "season" | "special";
  readonly title: string;
  readonly subtitle: string;
  readonly description: string;
  readonly chapterIds: readonly string[];
  readonly posterAssetId: string;
};

/** Membership is additive: legacy chapter/node IDs and reward identities never change. */
export const storySeasons: readonly StorySeasonDefinition[] = [
  {
    id: "season-1", kind: "season", title: "The Block Crown", subtitle: "Season One",
    description: "One neighborhood. Two brothers. A crown that cannot fix a family.",
    chapterIds: ["block-party", "red-side-tapes", "blue-side-blues", "side-show", "old-heads-know", "the-function", "return-of-the-block", "the-crown"],
    posterAssetId: "assets/story/theater/season-one.webp",
  },
  {
    id: "season-2", kind: "season", title: "Blockbuster on the Block", subtitle: "Season Two",
    description: "You won the Crown. Somebody else bought the roof. Save the gathering place without selling out the people.",
    chapterIds: ["s2-the-morning-after", "s2-the-rent-party", "s2-unlicensed-improvements", "s2-regular-guy-behavior", "s2-museum-of-the-block", "s2-everybody-has-a-buyer", "s2-premiere-night", "s2-the-blockbuster"],
    posterAssetId: "assets/story/theater/season-two.webp",
  },
  {
    id: "special-sherlock", kind: "special", title: "The Missing Motion", subtitle: "A Sherlock Special Presentation",
    description: "A missing reel opens six chapters of clock corrections, coded broadcasts, impossible journeys, and a museum theft with no thief.",
    chapterIds: ["special-sherlock-missing-motion", "special-sherlock-false-bottom", "special-sherlock-last-reel", "sherlock-thirteenth-bell", "sherlock-dead-air", "sherlock-negative-space"],
    posterAssetId: "assets/story/theater/sherlock.webp",
  },
  { id: 'special-oz', kind: 'special', title: 'The Yellow Line', subtitle: 'The Wizard of Oz', description: 'Dorothy follows a broken route home with three strangers who are more capable than they know.', chapterIds: ['oz-yellow-line', 'oz-behind-the-curtain'], posterAssetId: 'assets/cosmetics/dorothy/deck-cover-v3.webp' },
  { id: 'special-alice', kind: 'special', title: 'The Borrowed Hour', subtitle: 'Alice in Wonderland', description: 'A tea party steals tomorrow. Alice follows a moving clock into a court that cannot finish a sentence.', chapterIds: ['alice-borrowed-hour', 'alice-full-stop'], posterAssetId: 'assets/characters/alice.webp' },
  { id: 'special-yasuke', kind: 'special', title: 'A Banner Without a Master', subtitle: 'A Yasuke Chapter', description: 'A fictional festival, a borrowed name, and a champion who puts the neighborhood before the trophy.', chapterIds: ['yasuke-banner-without-master'], posterAssetId: 'assets/cosmetics/yasuke/deck-cover-v3.webp' },
  { id: 'special-cellblock', kind: 'special', title: 'The Library Hour', subtitle: 'A Cellblock Story', description: 'A missing form, a shelf built from scraps, and a crew determined to make one shared hour count.', chapterIds: ['cellblock-library-hour'], posterAssetId: 'assets/characters/inmate-crafty.webp' },
  { id: 'special-leon', kind: 'special', title: 'A Place to Return', subtitle: 'Leon’s Chapter', description: 'A route designer with no fixed address helps the block weather a storm while planning his own next step.', chapterIds: ['homeless-a-place-to-return'], posterAssetId: 'assets/cosmetics/homeless-guy/deck-cover-v3.webp' },
];

export const getStorySeason = (id: string) => storySeasons.find(season => season.id === id);
export const getStorySeasonForChapter = (id: string) => storySeasons.find(season => season.chapterIds.includes(id));