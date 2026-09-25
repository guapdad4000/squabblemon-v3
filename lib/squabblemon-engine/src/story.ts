import { cards, DECK_SIZE, completeEngineCrew } from "./data";
import chapterOneDialogue from "./chapterOneDialogue";
import { sequelChapters } from "./seasonChapters";
import type { StoryEncounterSnapshot, StoryStarObjective as EngineStoryStarObjective } from "./gameEngine";
import { validateStoryPuzzle, type StoryPuzzleDefinition } from "./storyPuzzles";
import { seasonTwoChapters } from "./seasonTwo";
import { extendedStoryChapters } from "./storyExpansions";
import { specialPresentationChapters } from "./storySpecials";
import { expandSeasonOneDialogue } from "./seasonOneDialogueExpansion";
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

// Story characters that can be unlocked as a reward. Kept in lockstep with the
// `portraits` map above so the narrative cast stays in one place.
export const isStoryCharacterId = (id: string) => id in CHARACTER_BY_ID;

// A battle has three star objectives, and a perfect 3-star clear grants one
// pack ticket. Centralised so the server (api-server) and any future client
// surface that wants to render a "3 stars → ticket" preview agree on the rule.
export const MAX_STARS_PER_BATTLE = 3;
export const TICKETS_PER_PERFECT_BATTLE = 1;
export const ticketsForStars = (stars: number): number =>
  stars >= MAX_STARS_PER_BATTLE ? TICKETS_PER_PERFECT_BATTLE : 0;

// Major story nodes use the shared economy constant. Re-export it here for
// existing story consumers without creating a story/season circular import.
export { TICKETS_PER_MAJOR_STORY_NODE } from './economy';

// The "compact" 3-battle, 1-ticket-per-perfect-clear format. Long-form
// chapters still surface the same progress widget, but only the compact
// format is shown as a 3-of-3 preview to the player.
export const COMPACT_TICKET_CHAPTER_BATTLES = 3;

// Story character roster. The engine is the source of truth for character
// ids, names, portraits, and crew membership so the React layer (story map,
// recap panels) and the API server (character-unlock rewards) reason about
// the same cast. The roster grows as content ships — the docstring on
// `artifacts/squabblemon/src/lib/story/characterRoster.ts` calls out the
// 40+ character target. The current cast covers Chapter One and the named
// cameos that already appear in dialogue.
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
    { id: "blue-side-pressure", kind: "battle", battleType: "standard", title: "Blue Side Pressure", mapPosition: { x: 23, y: 62 }, prerequisites: ["welcome-to-the-block"], optional: false, rewards: [{ kind: "currency", id: "street-xp", amount: 75 }], teaching: teaching(["Cheap cards establish a lead before big finishers arrive."], ["tempo", "lane commitment"], ["plug", "cornball", "snow"]), cinematic: cinematic("standard-clash", "blue-side"), encounter: { ...encounter("blue-side-pressure", "Ganger Blue", portraits.blue, blueDeck, "balanced", cinematic("standard-clash", "blue-side"), { roundLimit: 4, starObjectives: bluePressureObjectives }), battlefieldAssetId: `${venue}harbor-skyline-court.webp` }, preDialogue: [line("Ganger Blue", portraits.blue, "Blue side does not give up districts for free.")], postDialogue: [line("Ganger Blue", portraits.blue, "Red side saw that. They brought receipts.")], starObjectives: bluePressureObjectives, recommendedCollection: ["plug", "cornball", "snow"] },
    { id: "receipts-on-camera", kind: "battle", battleType: "rule-twist", title: "Receipts on Camera", mapPosition: { x: 40, y: 54 }, prerequisites: ["blue-side-pressure"], optional: false, rewards: [{ kind: "currency", id: "street-xp", amount: 100 }], teaching: teaching(["The middle district closes in round two—commit elsewhere or wait it out."], ["lane locks", "disruption"], ["roaster", "plug", "snow"]), cinematic: cinematic("standard-clash", "receipts"), encounter: { ...encounter("receipts-on-camera", "Ganger Red", portraits.red, receiptDeck, "aggressive", cinematic("standard-clash", "receipts"), { modifiers: { startingMotion: { player: 3, cpu: 1 }, handSize: { cpu: 4 }, laneLocks: [{ round: 2, owner: "both", lanes: [1] }], lanePowerBonuses: [{ owner: "both", lane: 2, amount: 2 }] }, starObjectives: receiptsObjectives }), battlefieldAssetId: `${venue}red-fence-night-court.webp` }, preDialogue: [line("Ganger Red", portraits.red, "Camera is rolling. Middle road closes next round.")], postDialogue: [line("Ganger Red", portraits.red, "Keep those receipts. You will need them.")], starObjectives: receiptsObjectives, recommendedCollection: ["roaster", "plug", "snow"] },
    { id: "red-side-retaliation", kind: "battle", battleType: "standard", title: "Red Side Retaliation", mapPosition: { x: 57, y: 42 }, prerequisites: ["receipts-on-camera"], optional: false, rewards: [{ kind: "currency", id: "street-xp", amount: 125 }], teaching: teaching(["Save Motion for a contested district.", "Protection can absorb targeted disruption."], ["Motion management", "protection"], ["wifey", "hooper"]), cinematic: cinematic("standard-clash", "red-side"), encounter: { ...encounter("red-side-retaliation", "Ganger Red", portraits.red, redDeck, "aggressive", cinematic("standard-clash", "red-side"), { modifiers: { startingMotion: { player: 4, cpu: 0 }, handSize: { cpu: 3 }, roundMotionDeltas: [{ round: 4, owner: "cpu", amount: 1 }] }, starObjectives: retaliationObjectives }), battlefieldAssetId: `${venue}red-fence-night-court.webp` }, preDialogue: [line("Ganger Red", portraits.red, "You embarrassed us on camera. Now play a harder hand.")], postDialogue: [line("Ganger Red", portraits.red, "Cracked Head runs this corner. Good luck.")], starObjectives: retaliationObjectives, recommendedCollection: ["wifey", "hooper", "rastamon"] },
    { id: "side-alley-challenge", kind: "battle", battleType: "standard", title: "Side Alley Challenge", mapPosition: { x: 52, y: 76 }, prerequisites: ["blue-side-pressure"], optional: true, rewards: [{ kind: "cosmetic", id: "side-alley-tagged-cardback", amount: 1 }], teaching: teaching(["This mastery fade is optional and never blocks the main route."], ["movement", "mastery"], ["carmeet", "delivery", "plug"]), cinematic: cinematic("standard-clash", "side-alley"), encounter: { ...encounter("side-alley-challenge", "Alley Runner", portraits.blue, redDeck, "movement", cinematic("standard-clash", "side-alley"), { modifiers: { startingMotion: { player: 4, cpu: 0 }, handSize: { cpu: 3 } }, starObjectives: movementObjectives }), battlefieldAssetId: `${venue}corner-store-court.webp` }, preDialogue: [line("Alley Runner", portraits.blue, "Optional route. Win it if you want the tag.")], postDialogue: [line("Alley Runner", portraits.blue, "That cardback is yours.")], starObjectives: movementObjectives, recommendedCollection: ["carmeet", "delivery", "plug"] },
    { id: "snitch-at-the-corner", kind: "battle", battleType: "mini-boss", title: "Snitch at the Corner", mapPosition: { x: 72, y: 31 }, prerequisites: ["red-side-retaliation"], optional: false, rewards: [{ kind: "currency", id: "street-xp", amount: 175 }], teaching: teaching(["Snitch's Watching the Feed gives a deterministic CPU Motion bump in round four."], ["round modifiers", "timing"], ["snow", "rastamon", "roaster"]), cinematic: cinematic("snitch-intro", "snitch-corner"), encounter: { ...encounter("snitch-at-the-corner", "Snitch", portraits.snitch, receiptDeck, "reactive", cinematic("snitch-intro", "snitch-corner"), { passive: { name: "Watching the Feed", description: "At round four, Snitch cashes the camera chatter into +2 Motion." }, modifiers: { startingMotion: { player: 4, cpu: 0 }, handSize: { cpu: 3 } }, phases: [{ id: "watching-the-feed", name: "Watching the Feed", description: "At round four, Snitch cashes the camera chatter into +2 CPU Motion.", trigger: { kind: "round", atLeast: 4 }, onEnter: [{ kind: "motion", owner: "cpu", amount: 2 }] }], starObjectives: snitchObjectives }), battlefieldAssetId: `${venue}civic-hill-climb.webp` }, preDialogue: [line("Snitch", portraits.snitch, "Watching the Feed: every play is evidence.")], postDialogue: [line("Snitch", portraits.snitch, "Cracked Head heard the whole stream.")], starObjectives: snitchObjectives, recommendedCollection: ["snow", "rastamon", "roaster"] },
    { id: "cracked-head-takes-the-block", kind: "battle", battleType: "boss", title: "Cracked Head Takes the Block", mapPosition: { x: 88, y: 16 }, prerequisites: ["snitch-at-the-corner"], optional: false, rewards: [{ kind: "currency", id: "street-xp", amount: 250 }], teaching: teaching(["Each phase is telegraphed and triggers once.", "Plan around the late reinforcement."], ["boss phases", "reinforcements"], ["wifey", "roaster", "hooper"]), cinematic: cinematic("cracked-head-finale", "cracked-head-block"), encounter: { ...encounter("cracked-head-takes-the-block", "Cracked Head", portraits.cracked, bossDeck, "combo-boss", cinematic("cracked-head-finale", "cracked-head-block"), { passive: { name: "Three Deep", description: "Cracked Head escalates through three one-time phases as the block changes hands." }, modifiers: { startingMotion: { player: 3, cpu: 1 }, handSize: { cpu: 4 } }, phases: [{ id: "territory-claim", name: "Territory Claim", description: "Opening claim: CPU gains +1 Motion once.", trigger: { kind: "round", atLeast: 1 }, onEnter: [{ kind: "motion", owner: "cpu", amount: 1 }] }, { id: "pressure-cooker", name: "Pressure Cooker", description: "When you hold two districts, CPU gets +2 Hands in the middle once.", trigger: { kind: "districts-held", owner: "player", atLeast: 2 }, onEnter: [{ kind: "lane-power", owner: "cpu", lane: 1, amount: 2 }] }, { id: "last-call", name: "Last Call", description: "Round five brings one Snow reinforcement once.", trigger: { kind: "round", atLeast: 5 }, onEnter: [{ kind: "reinforcement", owner: "cpu", cardId: "snow" }] }], starObjectives: standardObjectives }), battlefieldAssetId: `${venue}crown-rooftop-court.webp` }, preDialogue: [line("Cracked Head", portraits.cracked, "This block has phases. You are entering all three.")], postDialogue: [line("Cracked Head", portraits.cracked, "Block is yours. Wear the crown.")], starObjectives: standardObjectives, recommendedCollection: ["wifey", "roaster", "hooper"] },
    { id: "block-crowned", kind: "reward", title: "Block Crowned", mapPosition: { x: 94, y: 5 }, prerequisites: ["cracked-head-takes-the-block"], optional: false, rewards: [{ kind: "card", id: "nerd", amount: 1 }, { kind: "pack-ticket", id: "street-pack-ticket", amount: 10 }, { kind: "cosmetic", id: "block-party-crowned", amount: 1 }, { kind: "chapter-key", id: "story-key:chapter-two", amount: 1 }, { kind: "currency", id: "clout", amount: 250, claimKey: "dr-fade-training:chapter-one:v1" }], teaching: teaching(["Chapter Two is unlocked after this ceremony.", "10 Street Pack tickets is one upgraded ten-pull at the gym.", "Use your 250 Clout training fund at the Trading Post: Practice Session adds character XP; Move Coaching unlocks Corner Advice at level 2."], ["collection rewards"], ["nerd"]), cinematic: cinematic("cracked-head-finale", "victory"), scenes: [line("Snitch", portraits.snitch, "Block Crowned. Your Chapter Two route is open."), line("Dr. Fade", "assets/characters/dr-fade.webp", "You earned that. Take 250 Clout for training. Get me to level 2, then grab Corner Advice from Move Coaching at the Trading Post. We keep getting stronger together.") ] },
  ],
};

const fail = (message: string): never => { throw new Error(`Invalid story content: ${message}`); };
const validReward = (reward: StoryReward) => ["currency", "card", "chapter-key", "pack-ticket", "cosmetic", "character-unlock"].includes(reward.kind) && !!reward.id && Number.isInteger(reward.amount) && reward.amount > 0 && (reward.claimKey === undefined || reward.claimKey.length > 0);
const validObjective = (objective: StoryStarObjective): boolean => {
  if (!objective.id || !objective.description || !objective.criterion) return false;
  const ownerIsValid = (owner: string) => owner === "player" || owner === "cpu";
  const criterion = objective.criterion;
  switch (criterion.kind) {
    case "win": return true;
    case "districts-held": return ownerIsValid(criterion.owner) && Number.isInteger(criterion.atLeast) && criterion.atLeast >= 1 && criterion.atLeast <= 3;
    case "specific-districts-held": return ownerIsValid(criterion.owner) && criterion.lanes.length > 0 && new Set(criterion.lanes).size === criterion.lanes.length && criterion.lanes.every((lane) => [0, 1, 2].includes(lane));
    case "squabble-used": return ownerIsValid(criterion.owner) && typeof criterion.used === "boolean";
    case "motion-remaining": return ownerIsValid(criterion.owner) && Number.isInteger(criterion.atLeast) && criterion.atLeast >= 0;
    case "cards-moved": return ownerIsValid(criterion.owner) && Number.isInteger(criterion.atLeast) && criterion.atLeast >= 1;
  }
};
export function validateStoryContent(content: StoryContent): StoryContent {
  if (!Number.isInteger(content.version) || content.version < 1 || !content.chapters.length) fail("version or chapters is invalid");
  const chapterIds = new Set<string>(), nodeIds = new Set<string>(), chapterOrders = new Set<number>();
  for (const chapter of content.chapters) {
    if (!chapter.id || chapterIds.has(chapter.id) || chapterOrders.has(chapter.order) || !chapter.title || !chapter.subtitle || !chapter.description || !chapter.mapAssetId) fail(`invalid chapter ${chapter.id}`);
    chapterIds.add(chapter.id); chapterOrders.add(chapter.order);
    const local = new Map(chapter.nodes.map((node) => [node.id, node]));
    if (!chapter.nodes.length) fail(`chapter ${chapter.id} has no nodes`);
    for (const node of chapter.nodes) {
      if (node.puzzle && (node.kind === "battle" || !validateStoryPuzzle(node.puzzle))) fail(`node ${node.id} has invalid puzzle`);
      if (!node.id || nodeIds.has(node.id) || !node.title || !local.has(node.id) || ![node.mapPosition.x, node.mapPosition.y].every((x) => Number.isFinite(x) && x >= 0 && x <= 100)) fail(`invalid node ${node.id}`);
      nodeIds.add(node.id);
      if (!node.teaching.tips.length || !node.teaching.focusMechanics.length || !node.teaching.focusCards.length || node.teaching.focusCards.some((id) => !cards[id]) || !node.cinematic.videoAssetId.endsWith(".mp4") || !node.cinematic.posterAssetId.endsWith(".webp") || !node.cinematic.environmentAssetId) fail(`node ${node.id} presentation is incomplete`);
      if (node.prerequisites.includes(node.id) || new Set(node.prerequisites).size !== node.prerequisites.length || node.prerequisites.some((id) => !local.has(id))) fail(`node ${node.id} has invalid prerequisites`);
      if (node.rewards.some((reward) => !validReward(reward) || (reward.kind === "card" && !cards[reward.id]) || (reward.kind === "cosmetic" && !isStoryCosmeticId(reward.id)) || (reward.kind === "chapter-key" && !reward.id.startsWith("story-key:")))) fail(`node ${node.id} has malformed rewards`);
      if (node.kind === "battle") {
        const battle = node.encounter;
        if (battle.enemy.cardIds.length !== DECK_SIZE || new Set(battle.enemy.cardIds).size !== DECK_SIZE || battle.enemy.cardIds.some((id) => !cards[id]) || !battle.enemy.name || !battle.enemy.portraitAssetId || !battle.enemy.deckId || !battle.enemy.behaviorProfile || !battle.battlefieldAssetId || !Object.keys(battle.soundHooks).length || !node.preDialogue.length || !node.postDialogue.length || !node.starObjectives.length || !node.recommendedCollection.length || node.recommendedCollection.some((id) => !cards[id])) fail(`battle ${node.id} is incomplete`);
        const phases = battle.phases ?? [];
        const modifiers = battle.modifiers ?? {};
        const roundLimit = battle.roundLimit ?? 6;
        if (!Number.isInteger(roundLimit) || roundLimit < 1 || roundLimit > 6) fail(`battle ${node.id} has invalid round limit`);
        if (node.starObjectives.length !== MAX_STARS_PER_BATTLE || new Set(node.starObjectives.map((objective) => objective.id)).size !== node.starObjectives.length || node.starObjectives.some((objective) => !validObjective(objective)) || JSON.stringify(node.starObjectives) !== JSON.stringify(battle.starObjectives)) fail(`battle ${node.id} has invalid star objectives`);
        if (
          Object.values(modifiers.startingMotion ?? {}).some((value) => !Number.isInteger(value) || value < 0) ||
          Object.values(modifiers.handSize ?? {}).some((value) => !Number.isInteger(value) || value < 1 || value > DECK_SIZE) ||
          (modifiers.laneLocks ?? []).some((lock) => !Number.isInteger(lock.round) || lock.round < 1 || lock.round > roundLimit || !lock.lanes.length || lock.lanes.some((lane) => ![0, 1, 2].includes(lane))) ||
          (modifiers.roundMotionDeltas ?? []).some((item) => !Number.isInteger(item.round) || item.round < 1 || item.round > roundLimit || !Number.isInteger(item.amount)) ||
          (modifiers.lanePowerBonuses ?? []).some((item) => ![0, 1, 2].includes(item.lane) || !Number.isInteger(item.amount)) ||
          (modifiers.reinforcements ?? []).some((item) => !Number.isInteger(item.round) || item.round < 1 || item.round > roundLimit || !cards[item.cardId])
        ) fail(`battle ${node.id} has invalid modifiers`);
        if (new Set(phases.map((phase) => phase.id)).size !== phases.length || phases.some((phase) => !phase.id || !phase.name || !phase.description || phase.trigger.atLeast < 1 || (phase.trigger.kind === "round" && phase.trigger.atLeast > roundLimit) || (phase.onEnter ?? []).some((effect) => (effect.kind === "reinforcement" && !cards[effect.cardId]) || ((effect.kind === "lane-lock" && effect.lanes.some((lane) => ![0, 1, 2].includes(lane))) || (effect.kind === "lane-power" && ![0, 1, 2].includes(effect.lane)))))) fail(`battle ${node.id} has invalid phases`);
      } else if (!node.scenes.length || node.scenes.some((scene) => !scene.speaker || !scene.portraitAssetId || !scene.text)) fail(`node ${node.id} needs dialogue`);
    }
    for (const node of chapter.nodes) for (const prerequisite of node.prerequisites) if (local.get(prerequisite)?.optional && !node.optional) fail(`optional node ${prerequisite} gates required node ${node.id}`);
    const roots = chapter.nodes.filter((node) => !node.prerequisites.length); const reachable = new Set(roots.map((node) => node.id));
    for (let changed = true; changed;) { changed = false; for (const node of chapter.nodes) if (!reachable.has(node.id) && node.prerequisites.every((id) => reachable.has(id))) { reachable.add(node.id); changed = true; } }
    if (reachable.size !== chapter.nodes.length) fail(`chapter ${chapter.id} has cycles or unreachable nodes`);
  }
  for (const chapter of content.chapters) if (chapter.prerequisites.some((id) => id === chapter.id || !chapterIds.has(id)) || new Set(chapter.prerequisites).size !== chapter.prerequisites.length) fail(`chapter ${chapter.id} has invalid prerequisites`);
  const reachableChapters = new Set(content.chapters.filter((chapter) => !chapter.prerequisites.length).map((chapter) => chapter.id));
  for (let changed = true; changed;) { changed = false; for (const chapter of content.chapters) if (!reachableChapters.has(chapter.id) && chapter.prerequisites.every((id) => reachableChapters.has(id))) { reachableChapters.add(chapter.id); changed = true; } }
  if (reachableChapters.size !== content.chapters.length) fail("chapters have cycles or are unreachable");
  return content;
}
const screenplay = chapterOneDialogue as Record<string, Partial<Record<'pre' | 'post' | 'main', StoryDialogueLine[]>>>;
export const storyDialogueToken = (nodeId: string, section: 'pre' | 'post' | 'main', index: number) => `${nodeId}:script-v3:${section}:${index}`;
export const storyContent = validateStoryContent({ version: 8, chapters: [...expandSeasonOneDialogue([{ ...blockPartyChapter, nodes: blockPartyChapter.nodes.map((node): StoryNode => {
  const dialogue = screenplay[node.id];
  if (!dialogue) return node;
  return node.kind === 'battle'
    ? { ...node, preDialogue: dialogue.pre ?? node.preDialogue, postDialogue: dialogue.post ?? node.postDialogue }
    : { ...node, scenes: dialogue.main ?? node.scenes };
}) }, ...sequelChapters]), ...seasonTwoChapters, ...specialPresentationChapters, ...extendedStoryChapters] });
export const getStoryChapter = (chapterId: string) => storyContent.chapters.find((chapter) => chapter.id === chapterId);
export const getStoryNode = (nodeId: string) => storyContent.chapters.flatMap((chapter) => chapter.nodes).find((node) => node.id === nodeId);

// `artifacts/squabblemon/src/lib/story/parallaxScenes.ts` imports VENUE_BY_ID
// and StoryVenueEntry from this module. They are not yet authored in the
// engine — the cinematic parallax system is wired up to a screenplay
// pipeline that the content team is still drafting. Exporting the shape
// here unblocks the import graph so Story / ResultScreen can render in
// the meantime; the runtime no-ops when a venue id is missing.
export interface StoryVenueEntry {
  readonly id: string;
  readonly label: string;
  readonly baseAssetId: string;
  readonly backdropAssetId: string;
  readonly moods: readonly string[];
}
export const VENUE_BY_ID: Readonly<Record<string, StoryVenueEntry>> = Object.freeze({});
export const getStoryBattle = (nodeId: string) => { const node = getStoryNode(nodeId); return node?.kind === "battle" ? node : undefined; };
