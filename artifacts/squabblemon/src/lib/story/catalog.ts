/** Browser-only delivery. No canonical screenplay module is evaluated here. */
import index from './generated/index.json';
import { createChapterCatalog, freezeStoryData, type ChapterArtifact } from './chapterCatalog';
import type { StoryChapter, StoryNode, StoryCharacterRosterEntry, StoryVenueEntry } from '@workspace/squabblemon-engine/story';
export type * from '@workspace/squabblemon-engine/story';
export { storySeasons, getStorySeason, getStorySeasonForChapter } from '@workspace/squabblemon-engine/storySeasons';
export { isStoryPuzzleSolution } from '../../../../../lib/squabblemon-engine/src/storyPuzzles';
export { TICKETS_PER_MAJOR_STORY_NODE } from '@workspace/squabblemon-engine/economy';

export const storyIndex = freezeStoryData(index);
export const STORY_CHARACTERS = index.characters as readonly StoryCharacterRosterEntry[];
export const CHARACTER_ROSTER = STORY_CHARACTERS;
export const isStoryCharacterId = (id: string) => id in CHARACTER_BY_ID;
export const CHARACTER_BY_ID = Object.freeze(Object.fromEntries(STORY_CHARACTERS.map(character => [character.id, character])));
export const VENUE_BY_ID: Readonly<Record<string, StoryVenueEntry>> = Object.freeze(index.venues);
export const { MAX_STARS_PER_BATTLE, TICKETS_PER_PERFECT_BATTLE, COMPACT_TICKET_CHAPTER_BATTLES } = index.rules;
export const ticketsForStars = (stars: number) => stars >= MAX_STARS_PER_BATTLE ? TICKETS_PER_PERFECT_BATTLE : 0;
export const storyDialogueToken = (nodeId: string, section: 'pre' | 'post' | 'main', position: number) =>
  `${(index.tokens as Record<string, string>)[nodeId] ?? `${nodeId}:script-v3`}:${section}:${position}`;

// URL imports emit revisioned external JSON assets. No chapter body is in the
// route closure, and fetch failures can retry without a poisoned module cache.
const chapterUrls = import.meta.env?.SSR !== false ? {} : import.meta.glob<string>(['./generated/*.json', '!./generated/index.json'], { query: '?url&no-inline', import: 'default', eager: true });
const catalog = createChapterCatalog(index, async id => {
  const url = chapterUrls[`./generated/${id}.json`];
  if (!url) throw new Error(`Story chapter delivery unavailable: ${id}`);
  const response = await fetch(url, { credentials: 'omit' });
  if (!response.ok) throw new Error(`Could not load chapter (${response.status}). Retry or reload current story.`);
  try { return await response.json() as ChapterArtifact; }
  catch { throw new Error('Story content changed. Reload to get the current chapter.'); }
});
export const { getStoryChapter, getStoryNode, loadStoryChapter, loadStoryChapterForNode } = catalog;
export const getStoryBattle = (id: string) => { const node = getStoryNode(id); return node?.kind === 'battle' ? node : undefined; };
