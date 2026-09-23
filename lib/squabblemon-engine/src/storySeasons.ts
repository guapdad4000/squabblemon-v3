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
    description: "A stolen film reel. A detective charging by the deduction. Everybody has an alibi; none of them are good.",
    chapterIds: ["special-sherlock-missing-motion", "special-sherlock-false-bottom", "special-sherlock-last-reel"],
    posterAssetId: "assets/story/theater/sherlock.webp",
  },
];

export const getStorySeason = (id: string) => storySeasons.find(season => season.id === id);
export const getStorySeasonForChapter = (id: string) => storySeasons.find(season => season.chapterIds.includes(id));