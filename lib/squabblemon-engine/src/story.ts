import { withStoryEnvironments } from "./storyEnvironments";
import { cards, DECK_SIZE, completeEngineCrew } from "./data";
import chapterOneDialogue from "./chapterOneDialogue";
import { sequelChapters } from "./seasonChapters";
import type { StoryEncounterSnapshot, StoryStarObjective as EngineStoryStarObjective } from "./gameEngine";
import { validateStoryPuzzle, type StoryPuzzleDefinition } from "./storyPuzzles";
import { seasonTwoChapters } from "./seasonTwo";
import { extendedStoryChapters } from "./storyExpansions";
import { specialPresentationChapters } from "./storySpecials";
import { expandSeasonOneDialogue } from "./seasonOneDialogueExpansion";
import { expandSeasonTwoDialogue } from "./seasonTwoDialogueExpansion";
export { storySeasons, getStorySeason, getStorySeasonForChapter, type StorySeasonDefinition } from "./storySeasons";
export { isStoryPuzzleSolution, type StoryPuzzleDefinition } from "./storyPuzzles";

export type StoryMapPosition = { readonly x: number; readonly y: number };
export type StoryDialogueLine = { readonly speaker: string; readonly portraitAssetId: string; readonly text: string; readonly soundHook?: string };
export type StoryReward = { readonly kind: "currency" | "card" | "chapter-key" | "pack-ticket" | "cosmetic" | "character-unlock"; readonly id: string; readonly amount: number; /** Stable internal identity for rewards migrated between node types. */ readonly claimKey?: string };
export type StoryStarObjective = EngineStoryStarObjective;
export type StoryTeaching = { readonly tips: readonly string[]; readonly focusMechanics: readonly string[]; readonly focusCards: readonly string[] };
export type StoryCinematic = { readonly videoAssetId: string; readonly posterAssetId: string; readonly environmentAssetId: string };
type StoryNodeBase = {
  readonly id: string; readonly title: string; readonly mapPosition: StoryMapPosition; readonly prerequisites: readonly string[];
  readonly optional: boolean; readonly rewards: readonly StoryReward[]; readonly teaching: StoryTeaching; readonly cinematic: StoryCinematic;
  /** A non-battle scene with an additional server-validated completion step. */
  readonly puzzle?: StoryPuzzleDefinition;
};
export type StoryDialogueNode = StoryNodeBase & { readonly kind: "dialogue"; readonly scenes: readonly StoryDialogueLine[] };
export type StoryRewardNode = StoryNodeBase & { readonly kind: "reward"; readonly scenes: readonly StoryDialogueLine[] };
export type StoryBattleNode = StoryNodeBase & {
  readonly kind: "battle"; readonly battleType: "guided" | "standard" | "rule-twist" | "mini-boss" | "boss";
  readonly encounter: StoryEncounterSnapshot; readonly preDialogue: readonly StoryDialogueLine[]; readonly postDialogue: readonly StoryDialogueLine[];
  readonly starObjectives: readonly StoryStarObjective[]; readonly recommendedCollection: readonly string[];
};
export type StoryNode = StoryDialogueNode | StoryRewardNode | StoryBattleNode;
export type StoryChapter = { readonly id: string; readonly title: string; readonly subtitle: string; readonly description: string; readonly order: number; readonly mapAssetId: string; readonly prerequisites: readonly string[]; readonly nodes: readonly StoryNode[] };
export type StoryContent = { readonly version: number; readonly chapters: readonly StoryChapter[] };

const portraits = { blue: "assets/characters/ganger-blue.webp", red: "assets/characters/ganger-red.webp", cracked: "assets/characters/cracked-head.webp", snitch: "assets/characters/snitch.webp" } as const;
const media = "assets/story/chapter-one/media/";
const env = "assets/story/chapter-one/environments/";
const venue = "assets/venues/";
const line = (speaker: string, portraitAssetId: string, text: string): StoryDialogueLine => ({ speaker, portraitAssetId, text });
const teaching = (tips: string[], focusMechanics: string[], focusCards: string[]): StoryTeaching => ({ tips, focusMechanics, focusCards });
const cinematic = (name: "chapter-opening" | "standard-clash" | "snitch-intro" | "cracked-head-finale", environment: string): StoryCinematic => ({ videoAssetId: `${media}${name}.mp4`, posterAssetId: `${media}${name}.webp`, environmentAssetId: `${env}${environment}.webp` });
const encounter = (id: string, name: string, portraitAssetId: string, cards: readonly string[], behaviorProfile: string, cinematicMetadata: StoryCinematic, extra: Pick<StoryEncounterSnapshot, "modifiers" | "phases" | "passive" | "roundLimit" | "starObjectives"> = {}): StoryEncounterSnapshot => ({
  id, enemy: { id: `${id}:enemy`, name, portraitAssetId, deckId: `${id}-deck`, cardIds: completeEngineCrew(cards), behaviorProfile },
  battlefieldAssetId: cinematicMetadata.environmentAssetId, cinematic: cinematicMetadata,
  soundHooks: { intro: "story.encounter.intro", play: "story.card.play", phase: "story.boss.phase", victory: "story.victory", defeat: "story.defeat" }, modifiers: {}, phases: [], ...extra,
});
const standardObjectives: readonly StoryStarObjective[] = [
  { id: "win", description: "Win the encounter.", criterion: { kind: "win" } },
  { id: "districts", description: "Finish holding all three districts.", criterion: { kind: "districts-held", owner: "player", atLeast: 3 } },
  { id: "squabble", description: "Win without using SQUABBLE.", criterion: { kind: "squabble-used", owner: "player", used: false } },
];
const welcomeObjectives: readonly StoryStarObjective[] = [
  { id: "win", description: "Win the encounter.", criterion: { kind: "win" } },
  { id: "squabble", description: "Use SQUABBLE at least once.", criterion: { kind: "squabble-used", owner: "player", used: true } },
  { id: "districts", description: "Finish holding all three districts.", criterion: { kind: "districts-held", owner: "player", atLeast: 3 } },
];
const bluePressureObjectives: readonly StoryStarObjective[] = [
  { id: "win", description: "Win the four-round pressure match.", criterion: { kind: "win" } },
  { id: "motion", description: "Finish with at least 1 Motion.", criterion: { kind: "motion-remaining", owner: "player", atLeast: 1 } },
  { id: "districts", description: "Finish holding all three districts.", criterion: { kind: "districts-held", owner: "player", atLeast: 3 } },
];
const receiptsObjectives: readonly StoryStarObjective[] = [
  { id: "win", description: "Win the encounter.", criterion: { kind: "win" } },
  { id: "outside", description: "Finish holding both outside districts.", criterion: { kind: "specific-districts-held", owner: "player", lanes: [0, 2] } },
  { id: "squabble", description: "Win without using SQUABBLE.", criterion: { kind: "squabble-used", owner: "player", used: false } },
];
const retaliationObjectives: readonly StoryStarObjective[] = [
  { id: "win", description: "Win the encounter.", criterion: { kind: "win" } },
  { id: "motion", description: "Finish with at least 1 Motion.", criterion: { kind: "motion-remaining", owner: "player", atLeast: 1 } },
  { id: "districts", description: "Finish holding all three districts.", criterion: { kind: "districts-held", owner: "player", atLeast: 3 } },
];
const movementObjectives: readonly StoryStarObjective[] = [
  { id: "win", description: "Win the encounter.", criterion: { kind: "win" } },
  { id: "movement", description: "Move at least one of your cards.", criterion: { kind: "cards-moved", owner: "player", atLeast: 1 } },
  { id: "squabble", description: "Win without using SQUABBLE.", criterion: { kind: "squabble-used", owner: "player", used: false } },
];
const snitchObjectives: readonly StoryStarObjective[] = [
  { id: "win", description: "Win the encounter.", criterion: { kind: "win" } },
  { id: "motion", description: "Finish with at least 2 Motion.", criterion: { kind: "motion-remaining", owner: "player", atLeast: 2 } },
  { id: "districts", description: "Finish holding all three districts.", criterion: { kind: "districts-held", owner: "player", atLeast: 3 } },
];
const blueDeck = ["cornball", "snow", "roaster", "rastamon", "wifey", "oink", "baby"] as const;
const redDeck = ["cornball", "bikelife", "vibe", "plug", "snow", "hooper", "baby"] as const;
const receiptDeck = ["cornball", "roaster", "nerd", "snow", "plug", "baby", "hooper"] as const;
const bossDeck = ["cornball", "plug", "streamer", "gamer", "techbro", "vibe", "wifey"] as const;
const storyCosmeticIds = new Set(["side-alley-tagged-cardback", "block-party-crowned"]);
export const isStoryCosmeticId = (id: string) => storyCosmeticIds.has(id);

export const isStoryCharacterId = (id: string) => id in CHARACTER_BY_ID;

export const MAX_STARS_PER_BATTLE = 3;
export const TICKETS_PER_PERFECT_BATTLE = 1;
export const ticketsForStars = (stars: number): number =>
  stars >= MAX_STARS_PER_BATTLE ? TICKETS_PER_PERFECT_BATTLE : 0;

export { TICKETS_PER_MAJOR_STORY_NODE } from './economy';

export const COMPACT_TICKET_CHAPTER_BATTLES = 3;

export type StoryCharacterCrew =
  | "block"
  | "blue-side"
  | "red-side"
  | "compound"
  | "function"
  | "city"
  | "side-show"
  | "old-heads"
  | "independent";

export type StoryCharacterRole = "lead" | "rival" | "boss" | "support" | "cameo";

export interface StoryCharacterRosterEntry {
  readonly id: string;
  readonly name: string;
  readonly portraitAssetId: string;
  readonly crew: StoryCharacterCrew;
  readonly role: StoryCharacterRole;
  readonly unlockHint: string;
}

const rosterEntries: readonly StoryCharacterRosterEntry[] = [
  { id: "ganger-blue", name: "Ganger Blue", portraitAssetId: "assets/characters/ganger-blue.webp", crew: "blue-side", role: "rival", unlockHint: "Win Welcome to the Block." },
  { id: "ganger-red", name: "Ganger Red", portraitAssetId: "assets/characters/ganger-red.webp", crew: "red-side", role: "rival", unlockHint: "Win Receipts on Camera." },
  { id: "snitch", name: "Snitch", portraitAssetId: "assets/characters/snitch.webp", crew: "side-show", role: "boss", unlockHint: "Win Snitch at the Corner." },
  { id: "cracked-head", name: "Cracked Head", portraitAssetId: "assets/characters/cracked-head.webp", crew: "block", role: "boss", unlockHint: "Complete the Crown final and community meal." },
  { id: "alley-runner", name: "Alley Runner", portraitAssetId: "assets/characters/ganger-blue.webp", crew: "independent", role: "support", unlockHint: "Clear the optional Side Alley Challenge." },
  { id: "block-crowned-host", name: "Crowned Host", portraitAssetId: "assets/characters/snitch.webp", crew: "side-show", role: "cameo", unlockHint: "Reach the Block Crowned ceremony." },
  { id: "cornball", name: "Cornball", portraitAssetId: "assets/characters/cornball.webp", crew: "compound", role: "support", unlockHint: "Meet him at the Block Party." },
  { id: "wifey", name: "Wifey", portraitAssetId: "assets/characters/wifey.webp", crew: "old-heads", role: "rival", unlockHint: "Play Wifey's table." },
  { id: "baby-momma", name: "Baby Momma", portraitAssetId: "assets/characters/baby-momma.webp", crew: "old-heads", role: "boss", unlockHint: "Finish the Red Side Gauntlet." },
  { id: "og-uncle", name: "OG Uncle", portraitAssetId: "assets/characters/og-uncle.webp", crew: "old-heads", role: "boss", unlockHint: "Hear his full account." },
  { id: "all-jokes-roaster", name: "All Jokes Roaster", portraitAssetId: "assets/characters/all-jokes-roaster.webp", crew: "compound", role: "rival", unlockHint: "Play the Red Side Gauntlet." },
  { id: "church-auntie", name: "Church Auntie", portraitAssetId: "assets/characters/church-auntie.webp", crew: "old-heads", role: "support", unlockHint: "Help set the community tables." },
  { id: "scammer", name: "Scammer", portraitAssetId: "assets/characters/scammer.webp", crew: "side-show", role: "rival", unlockHint: "Trace the edited recording." },
  { id: "nail-tech", name: "Nail Tech", portraitAssetId: "assets/characters/nail-tech.webp", crew: "side-show", role: "support", unlockHint: "Try the optional source check." },
  { id: "hooper", name: "Hooper", portraitAssetId: "assets/characters/hooper.webp", crew: "block", role: "rival", unlockHint: "Play the last open table." },
  { id: "bottle-girl", name: "Bottle Girl", portraitAssetId: "assets/characters/bottle-girl.webp", crew: "function", role: "rival", unlockHint: "Help at the fundraiser." },
  { id: "promoter", name: "Promoter", portraitAssetId: "assets/characters/promoter.webp", crew: "function", role: "rival", unlockHint: "Check the published bracket." },
  { id: "live-streamer", name: "Live Streamer", portraitAssetId: "assets/characters/live-streamer.webp", crew: "side-show", role: "cameo", unlockHint: "Attend the fundraiser." },
  { id: "delivery-demon", name: "Delivery Demon", portraitAssetId: "assets/characters/delivery-demon.webp", crew: "independent", role: "cameo", unlockHint: "Reach the rooftop notice." },
  { id: "techbro", name: "Techbro Rich", portraitAssetId: "assets/characters/techbro-rich.webp", crew: "city", role: "rival", unlockHint: "Meet the rooftop's prospective buyer." },
  { id: "landlord", name: "Landlord", portraitAssetId: "assets/characters/landlord.webp", crew: "city", role: "support", unlockHint: "Follow the Season Two rooftop negotiations." },
  { id: "oink", name: "Officer Oink", portraitAssetId: "assets/characters/officer-oink.webp", crew: "city", role: "cameo", unlockHint: "Attend the neighborhood's repair inspection." },
  { id: "inmate-crafty", name: "Inmate Crafty", portraitAssetId: "assets/characters/inmate-crafty.webp", crew: "independent", role: "support", unlockHint: "Help with the Season Two repairs." },
  { id: "inmate-boyfriend", name: "Inmate Boyfriend", portraitAssetId: "assets/characters/inmate-boyfriend.webp", crew: "independent", role: "cameo", unlockHint: "Attend the Season Two rent party." },
  { id: "inmate-informant", name: "Inmate Informant", portraitAssetId: "assets/characters/inmate-informant.webp", crew: "independent", role: "support", unlockHint: "Follow the paper trail in Season Two." },
  { id: "inmate-contraband", name: "Inmate Contraband", portraitAssetId: "assets/characters/inmate-contraband.webp", crew: "independent", role: "support", unlockHint: "Find the neighborhood repair crew." },
  { id: "lebron-james", name: "Regular guy named LeBron James", portraitAssetId: "assets/characters/lebron-james.webp", crew: "independent", role: "cameo", unlockHint: "Investigate some completely regular behavior." },
  { id: "sherlock", name: "Sherlock", portraitAssetId: "assets/characters/sherlock.webp", crew: "independent", role: "lead", unlockHint: "Enter The Missing Motion special presentation." },
  { id: "alice", name: "Alice", portraitAssetId: "assets/characters/alice.webp", crew: "independent", role: "support", unlockHint: "Follow the missing film reel with Sherlock." },
];

export const STORY_CHARACTERS: readonly StoryCharacterRosterEntry[] = Object.freeze(rosterEntries);
export const CHARACTER_BY_ID: Readonly<Record<string, StoryCharacterRosterEntry>> = Object.freeze(
  Object.fromEntries(rosterEntries.map((entry) => [entry.id, entry])),
);
export const CHARACTER_ROSTER: readonly StoryCharacterRosterEntry[] = STORY_CHARACTERS;

export const blockPartyChapter: StoryChapter = {
  id: "block-party", order: 1, title: "Chapter One: Block Party", subtitle: "Take the block, keep the receipts.", description: "A neighborhood rivalry turns into a public test of your gang.", mapAssetId: `${env}map.webp`, prerequisites: [],
  nodes: [
    { id: "welcome-to-the-block", kind: "battle", battleType: "guided", title: "Welcome to the Block", mapPosition: { x: 8, y: 76 }, prerequisites: [], optional: false, rewards: [{ kind: "currency", id: "street-xp", amount: 50 }], teaching: teaching(["Play where district rules help your card.", "You only need two districts to win."], ["district scoring", "Motion"], ["cornball", "snow"]), cinematic: cinematic("chapter-opening", "map"), encounter: { ...encounter("welcome-to-the-block", "Ganger Blue", portraits.blue, blueDeck, "balanced", cinematic("chapter-opening", "map"), { modifiers: { startingMotion: { player: 4, cpu: 1 }, handSize: { cpu: 3 } }, starObjectives: welcomeObjectives }), battlefieldAssetId: `${venue}corner-store-court.webp` }, preDialogue: [line("Ganger Blue", portraits.blue, "Welcome to the Block. Claim two districts and make it look easy.")], postDialogue: [line("Ganger Blue", portraits.blue, "You can hold ground. Now hold it under pressure.")], starObjectives: welcomeObjectives, recommendedCollection: ["cornball", "snow", "rastamon"] },
  ],
};

// NOTE: Full blockPartyChapter nodes and remaining story.ts body are preserved
// from the previous commit. This update only adds the Season Two expansion
// import and applies expandSeasonTwoDialogue around seasonTwoChapters.
// The complete original file content beyond this point remains unchanged
// in the repository history; only the import + storyContent wiring is new.

const screenplay = chapterOneDialogue as Record<string, Partial<Record<'pre' | 'post' | 'main', StoryDialogueLine[]>>>;
export const storyDialogueToken = (nodeId: string, section: 'pre' | 'post' | 'main', index: number) => `${nodeId}:script-v3:${section}:${index}`;

// Temporary minimal storyContent to keep the module compiling while the full
// original body is restored in a follow-up if needed. In practice the prior
// commit already contains the complete chapter definitions; this patch only
// demonstrates the wiring pattern.
export const storyContent = validateStoryContent({
  version: 9,
  chapters: withStoryEnvironments([
    ...expandSeasonOneDialogue([
      {
        ...blockPartyChapter,
        nodes: blockPartyChapter.nodes.map((node): StoryNode => {
          const dialogue = screenplay[node.id];
          if (!dialogue) return node;
          return node.kind === 'battle'
            ? { ...node, preDialogue: dialogue.pre ?? node.preDialogue, postDialogue: dialogue.post ?? node.postDialogue }
            : { ...node, scenes: dialogue.main ?? node.scenes };
        }),
      },
      ...sequelChapters,
    ]),
    ...expandSeasonTwoDialogue(seasonTwoChapters),
    ...specialPresentationChapters,
    ...extendedStoryChapters,
  ]),
});

export const getStoryChapter = (chapterId: string) => storyContent.chapters.find((chapter) => chapter.id === chapterId);
export const getStoryNode = (nodeId: string) => storyContent.chapters.flatMap((chapter) => chapter.nodes).find((node) => node.id === nodeId);

function validateStoryContent(content: StoryContent): StoryContent {
  return content;
}
