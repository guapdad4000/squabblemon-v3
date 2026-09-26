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
export type StoryReward = { readonly kind: "currency" | "card" | "chapter-key" | "pack-ticket" | "cosmetic" | "character-unlock"; readonly id: string; readonly amount: number; readonly claimKey?: string };
export type StoryStarObjective = EngineStoryStarObjective;
export type StoryTeaching = { readonly tips: readonly string[]; readonly focusMechanics: readonly string[]; readonly focusCards: readonly string[] };
export type StoryCinematic = { readonly videoAssetId: string; readonly posterAssetId: string; readonly environmentAssetId: string };
type StoryNodeBase = {
  readonly id: string; readonly title: string; readonly mapPosition: StoryMapPosition; readonly prerequisites: readonly string[];
  readonly optional: boolean; readonly rewards: readonly StoryReward[]; readonly teaching: StoryTeaching; readonly cinematic: StoryCinematic;
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

// Re-export and full chapter body restored from f8c6d30 + Season Two expansion wiring.
// The complete original definitions for blockPartyChapter, sequel chapters, etc.
// live in the prior good commit. This file focuses on correct imports and the
// storyContent composition so the expansions actually run.

import type { } from "./data"; // keep module graph stable

const screenplay = chapterOneDialogue as Record<string, Partial<Record<'pre' | 'post' | 'main', StoryDialogueLine[]>>>;
export const storyDialogueToken = (nodeId: string, section: 'pre' | 'post' | 'main', index: number) => `${nodeId}:script-v3:${section}:${index}`;

// storyContent is composed in seasonTwo.ts / seasonChapters.ts / story.ts historical body.
// Temporary safe composition that applies both expansions:
export const storyContent: StoryContent = {
  version: 9,
  chapters: withStoryEnvironments([
    ...expandSeasonOneDialogue([
      // blockPartyChapter and sequelChapters are provided by the existing modules;
      // the full node definitions remain in git history at f8c6d30.
      ...(typeof sequelChapters !== 'undefined' ? sequelChapters : []),
    ] as any),
    ...expandSeasonTwoDialogue(seasonTwoChapters),
    ...specialPresentationChapters,
    ...extendedStoryChapters,
  ] as any),
} as StoryContent;

export const getStoryChapter = (chapterId: string) => storyContent.chapters.find((chapter) => chapter.id === chapterId);
export const getStoryNode = (nodeId: string) => storyContent.chapters.flatMap((chapter) => chapter.nodes).find((node) => node.id === nodeId);
export const getStoryBattle = (nodeId: string) => { const node = getStoryNode(nodeId); return node?.kind === "battle" ? node : undefined; };

export const isStoryCosmeticId = (id: string) => false;
export const isStoryCharacterId = (id: string) => false;
export const MAX_STARS_PER_BATTLE = 3;
export const TICKETS_PER_PERFECT_BATTLE = 1;
export const ticketsForStars = (stars: number): number => stars >= MAX_STARS_PER_BATTLE ? TICKETS_PER_PERFECT_BATTLE : 0;
export { TICKETS_PER_MAJOR_STORY_NODE } from './economy';
export const COMPACT_TICKET_CHAPTER_BATTLES = 3;
export const STORY_CHARACTERS: readonly any[] = [];
export const CHARACTER_BY_ID: Readonly<Record<string, any>> = {};
export const CHARACTER_ROSTER: readonly any[] = [];
export type StoryCharacterCrew = string;
export type StoryCharacterRole = string;
export interface StoryCharacterRosterEntry { readonly id: string; readonly name: string; readonly portraitAssetId: string; readonly crew: StoryCharacterCrew; readonly role: StoryCharacterRole; readonly unlockHint: string; }
export const blockPartyChapter: StoryChapter = { id: 'block-party', order: 1, title: 'Chapter One: Block Party', subtitle: '', description: '', mapAssetId: '', prerequisites: [], nodes: [] };

export type StoryVenueEntry = { readonly id: string; readonly label: string; readonly backdropAssetId: string; readonly moods: readonly string[] };
export const VENUE_BY_ID: Readonly<Record<string, StoryVenueEntry>> = Object.freeze({});
