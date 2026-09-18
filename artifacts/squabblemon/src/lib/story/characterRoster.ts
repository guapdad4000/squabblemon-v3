/**
 * Story Mode character roster helpers.
 *
 * The 40+ character roster lives in the squabblemon-engine (so the engine,
 * the API server, and any future worker that writes screenplays can reason
 * about the same names, portraits, and crew tags). The helpers below expose
 * ergonomic lookups to the React layer: component-side code should never
 * have to import the engine directly.
 *
 * Each entry carries:
 *  - `id` (engine-stable key, e.g. "ganger-blue")
 *  - `name` (display name, e.g. "Ganger Blue")
 *  - `portraitAssetId` (path under `public/assets/characters/`)
 *  - `crew` (one of 9 story crews — used for color tokens, story map art, etc.)
 *  - `role` (lead / rival / boss / support / cameo)
 *  - `unlockHint` (UI copy shown on the locked portrait)
 */
import {
  CHARACTER_BY_ID,
  CHARACTER_ROSTER,
  STORY_CHARACTERS,
  isStoryCharacterId,
  type StoryCharacterRosterEntry,
} from "@workspace/squabblemon-engine/story";

export type StoryCharacter = StoryCharacterRosterEntry;
export type StoryCharacterCrew = StoryCharacterRosterEntry["crew"];
export type StoryCharacterRole = StoryCharacterRosterEntry["role"];

export const storyCharacters: readonly StoryCharacter[] = STORY_CHARACTERS;
export const storyCharacterById: Readonly<Record<string, StoryCharacter>> = CHARACTER_BY_ID;
export const isStoryCharacter = (id: string | null | undefined): id is string =>
  typeof id === "string" && isStoryCharacterId(id);

/**
 * Group characters by crew for crew-card displays, recap panels, and the
 * chapter map crew legend. The crew order is curated so the block crews
 * surface first, the function / old-heads crews next, and the cameos last.
 */
const CREW_ORDER: readonly StoryCharacterCrew[] = [
  "block",
  "blue-side",
  "red-side",
  "compound",
  "function",
  "city",
  "side-show",
  "old-heads",
  "independent",
];

export function charactersByCrew(): Readonly<Record<StoryCharacterCrew, readonly StoryCharacter[]>> {
  const grouped: Record<StoryCharacterCrew, StoryCharacter[]> = {
    "block": [],
    "blue-side": [],
    "red-side": [],
    "compound": [],
    "function": [],
    "city": [],
    "side-show": [],
    "old-heads": [],
    "independent": [],
  };
  for (const character of STORY_CHARACTERS) grouped[character.crew].push(character);
  for (const crew of CREW_ORDER) grouped[crew].sort((a, b) => a.name.localeCompare(b.name));
  return grouped;
}

/**
 * Returns the subset of roster characters that a player has unlocked.
 * The engine's roster is the source of truth for valid IDs; unknown ids in
 * `unlockedIds` are filtered out so a stale DB value can never crash a UI.
 */
export function unlockedCharacters(unlockedIds: readonly string[]): readonly StoryCharacter[] {
  if (!unlockedIds?.length) return [];
  const known = new Set(STORY_CHARACTERS.map((c) => c.id));
  const order = new Map(STORY_CHARACTERS.map((c, i) => [c.id, i]));
  return unlockedIds
    .filter((id) => known.has(id))
    .map((id) => CHARACTER_BY_ID[id])
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export function lockedCharacters(unlockedIds: readonly string[]): readonly StoryCharacter[] {
  const unlocked = new Set(unlockedIds ?? []);
  return STORY_CHARACTERS.filter((c) => !unlocked.has(c.id));
}

export const ALL_STORY_CHARACTERS = CHARACTER_ROSTER;
