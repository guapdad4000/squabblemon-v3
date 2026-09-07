import { cards } from "./data";
import type { StoryEncounterSnapshot } from "./gameEngine";

export type StoryMapPosition = { readonly x: number; readonly y: number };
export type StoryDialogueLine = {
  readonly speaker: string;
  readonly portraitAssetId: string;
  readonly text: string;
  readonly soundHook?: string;
};
export type StoryReward = {
  readonly kind: "currency" | "card" | "chapter-key";
  readonly id: string;
  readonly amount: number;
};
export type StoryStarObjective = { readonly id: string; readonly description: string };
type StoryNodeBase = {
  readonly id: string;
  readonly title: string;
  readonly mapPosition: StoryMapPosition;
  readonly prerequisites: readonly string[];
  readonly rewards: readonly StoryReward[];
};
export type StoryDialogueNode = StoryNodeBase & {
  readonly kind: "dialogue";
  readonly scenes: readonly StoryDialogueLine[];
};
export type StoryRewardNode = StoryNodeBase & {
  readonly kind: "reward";
  readonly scenes: readonly StoryDialogueLine[];
};
export type StoryBattleNode = StoryNodeBase & {
  readonly kind: "battle";
  readonly battleType: "standard" | "rule-twist" | "mini-boss" | "boss";
  readonly encounter: StoryEncounterSnapshot;
  readonly preDialogue: readonly StoryDialogueLine[];
  readonly postDialogue: readonly StoryDialogueLine[];
  readonly starObjectives: readonly StoryStarObjective[];
  readonly recommendedCollection: readonly string[];
};
export type StoryNode = StoryDialogueNode | StoryRewardNode | StoryBattleNode;
export type StoryChapter = {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly description: string;
  readonly order: number;
  readonly mapAssetId: string;
  readonly prerequisites: readonly string[];
  readonly nodes: readonly StoryNode[];
};
export type StoryContent = { readonly version: number; readonly chapters: readonly StoryChapter[] };

const portraits = {
  blue: "assets/characters/ganger-blue.webp",
  red: "assets/characters/ganger-red.webp",
  cracked: "assets/characters/cracked-head.webp",
  snitch: "assets/characters/snitch.webp",
} as const;
const battlefield = "assets/0_0.png";
const deckA = ["cornball", "snow", "roaster", "rastamon", "wifey", "oink", "baby"] as const;
const deckB = ["cornball", "bikelife", "vibe", "plug", "snow", "hooper", "baby"] as const;
const deckC = ["cornball", "plug", "streamer", "gamer", "techbro", "vibe", "wifey"] as const;
const deckD = ["cornball", "roaster", "nerd", "snow", "plug", "baby", "hooper"] as const;
const line = (speaker: string, portraitAssetId: string, text: string, soundHook?: string): StoryDialogueLine =>
  ({ speaker, portraitAssetId, text, ...(soundHook ? { soundHook } : {}) });
const encounter = (
  id: string,
  name: string,
  portraitAssetId: string,
  deckId: string,
  cardIds: readonly string[],
  behaviorProfile: string,
  extra: Pick<StoryEncounterSnapshot, "modifiers" | "phases"> = {},
): StoryEncounterSnapshot => ({
  id,
  enemy: { id: `${id}:enemy`, name, portraitAssetId, deckId, cardIds, behaviorProfile },
  battlefieldAssetId: battlefield,
  soundHooks: { intro: "story.encounter.intro", play: "story.card.play", phase: "story.boss.phase", victory: "story.victory", defeat: "story.defeat" },
  modifiers: {},
  phases: [],
  ...extra,
});
const objectives: readonly StoryStarObjective[] = [
  { id: "win", description: "Win the encounter." },
  { id: "districts", description: "Finish holding all three districts." },
  { id: "squabble", description: "Win without using SQUABBLE." },
];

export const prologueChapter: StoryChapter = {
  id: "prologue-street-rules",
  title: "Prologue: Street Rules",
  subtitle: "Learn the city before the city learns you.",
  description: "A reusable six-stop introduction to dialogue, rewards, twists, and phased rivals.",
  order: 0,
  mapAssetId: battlefield,
  prerequisites: [],
  nodes: [
    {
      id: "prologue-welcome", kind: "dialogue", title: "Word Travels", mapPosition: { x: 8, y: 78 }, prerequisites: [], rewards: [],
      scenes: [
        line("Snitch", portraits.snitch, "Every district heard you built a crew.", "story.dialogue.snitch"),
        line("Ganger Blue", portraits.blue, "Then let the cards do the talking.", "story.dialogue.blue"),
      ],
    },
    {
      id: "prologue-first-hand", kind: "battle", battleType: "standard", title: "First Hand", mapPosition: { x: 24, y: 65 }, prerequisites: ["prologue-welcome"],
      rewards: [{ kind: "currency", id: "street-xp", amount: 50 }],
      encounter: encounter("prologue-first-hand", "Ganger Blue", portraits.blue, "prologue-blue", deckA, "balanced"),
      preDialogue: [line("Ganger Blue", portraits.blue, "Six rounds. Two districts. Keep it clean.")],
      postDialogue: [line("Ganger Blue", portraits.blue, "You know the basics. Now expect interference.")],
      starObjectives: objectives, recommendedCollection: ["cornball", "rastamon", "snow"],
    },
    {
      id: "prologue-starter-drop", kind: "reward", title: "The Drop", mapPosition: { x: 40, y: 58 }, prerequisites: ["prologue-first-hand"],
      rewards: [{ kind: "currency", id: "street-xp", amount: 75 }, { kind: "card", id: "plug", amount: 1 }],
      scenes: [line("Snitch", portraits.snitch, "A Plug card. Data says it opens cheaper routes.")],
    },
    {
      id: "prologue-roadwork", kind: "battle", battleType: "rule-twist", title: "Roadwork", mapPosition: { x: 56, y: 45 }, prerequisites: ["prologue-starter-drop"],
      rewards: [{ kind: "currency", id: "street-xp", amount: 100 }],
      encounter: encounter("prologue-roadwork", "Ganger Red", portraits.red, "prologue-red", deckB, "aggressive", {
        modifiers: {
          startingHype: { player: 2, cpu: 2 },
          laneLocks: [{ round: 2, owner: "both", lanes: [1] }],
          lanePowerBonuses: [{ owner: "both", lane: 2, amount: 2 }],
          roundHypeDeltas: [{ round: 4, owner: "cpu", amount: 1 }],
        },
      }),
      preDialogue: [line("Ganger Red", portraits.red, "Middle road closes next round. Pick a side.")],
      postDialogue: [line("Ganger Red", portraits.red, "Rules move. Good crews move faster.")],
      starObjectives: objectives, recommendedCollection: ["plug", "bikelife", "vibe"],
    },
    {
      id: "prologue-scrap-test", kind: "battle", battleType: "mini-boss", title: "Scrap Test", mapPosition: { x: 72, y: 31 }, prerequisites: ["prologue-roadwork"],
      rewards: [{ kind: "currency", id: "street-xp", amount: 150 }],
      encounter: encounter("prologue-scrap-test", "Cracked Head", portraits.cracked, "prologue-cracked", deckC, "combo", {
        modifiers: { handSize: { cpu: 4 }, reinforcements: [{ round: 3, owner: "cpu", cardId: "snow" }] },
        phases: [
          { id: "scramble", name: "Scramble", trigger: { kind: "round", atLeast: 1 } },
          { id: "pile-on", name: "Pile On", trigger: { kind: "total-power", owner: "player", atLeast: 12 }, onEnter: [{ kind: "hype", owner: "cpu", amount: 2 }] },
        ],
      }),
      preDialogue: [line("Cracked Head", portraits.cracked, "Build something. I like breaking builds.")],
      postDialogue: [line("Cracked Head", portraits.cracked, "Still standing? Go meet the source.")],
      starObjectives: objectives, recommendedCollection: ["wifey", "roaster", "hooper"],
    },
    {
      id: "prologue-last-word", kind: "battle", battleType: "boss", title: "Last Word", mapPosition: { x: 89, y: 15 }, prerequisites: ["prologue-scrap-test"],
      rewards: [{ kind: "currency", id: "street-xp", amount: 250 }, { kind: "chapter-key", id: "story-chapter-access", amount: 1 }],
      encounter: encounter("prologue-last-word", "Snitch", portraits.snitch, "prologue-snitch", deckD, "reactive-boss", {
        modifiers: { startingHype: { cpu: 2 }, roundHypeDeltas: [{ round: 5, owner: "cpu", amount: 2 }] },
        phases: [
          { id: "watching", name: "Watching", trigger: { kind: "round", atLeast: 1 } },
          { id: "receipts", name: "Receipts", trigger: { kind: "districts-held", owner: "player", atLeast: 2 }, onEnter: [{ kind: "lane-power", owner: "cpu", lane: 1, amount: 2 }] },
          { id: "last-word", name: "Last Word", trigger: { kind: "round", atLeast: 5 }, onEnter: [{ kind: "reinforcement", owner: "cpu", cardId: "oink" }] },
        ],
      }),
      preDialogue: [line("Snitch", portraits.snitch, "I know every move before it becomes a rumor.")],
      postDialogue: [line("Snitch", portraits.snitch, "Take the key. The real chapters start past here.")],
      starObjectives: objectives, recommendedCollection: ["nerd", "wifey", "rastamon"],
    },
  ],
};

const fail = (message: string): never => { throw new Error(`Invalid story content: ${message}`); };
export function validateStoryContent(content: StoryContent): StoryContent {
  if (!Number.isInteger(content.version) || content.version < 1) fail("version must be a positive integer");
  if (!content.chapters.length) fail("at least one chapter is required");
  const chapterIds = new Set<string>(), nodeIds = new Set<string>();
  for (const chapter of content.chapters) {
    if (!chapter.id || chapterIds.has(chapter.id)) fail(`duplicate or empty chapter id ${chapter.id}`);
    chapterIds.add(chapter.id);
    if (!chapter.title || !chapter.mapAssetId || !Number.isFinite(chapter.order)) fail(`chapter ${chapter.id} metadata is incomplete`);
    for (const node of chapter.nodes) {
      if (!node.id || nodeIds.has(node.id)) fail(`duplicate or empty node id ${node.id}`);
      nodeIds.add(node.id);
      if (![node.mapPosition.x, node.mapPosition.y].every(Number.isFinite)) fail(`node ${node.id} has an invalid map position`);
      if (!node.title || !Array.isArray(node.rewards)) fail(`node ${node.id} metadata is incomplete`);
      if (node.kind === "battle") {
        const { encounter: battle } = node;
        if (battle.enemy.cardIds.length !== 7 || new Set(battle.enemy.cardIds).size !== 7) fail(`battle ${node.id} needs seven unique enemy cards`);
        for (const cardId of battle.enemy.cardIds) if (!cards[cardId]) fail(`battle ${node.id} has unknown card ${cardId}`);
        if (!battle.enemy.id || !battle.enemy.name || !battle.enemy.portraitAssetId || !battle.enemy.deckId || !battle.enemy.behaviorProfile) fail(`battle ${node.id} enemy is incomplete`);
        if (!battle.battlefieldAssetId || !Object.keys(battle.soundHooks).length) fail(`battle ${node.id} presentation is incomplete`);
        if (!node.preDialogue.length || !node.postDialogue.length || !node.starObjectives.length || !node.recommendedCollection.length) fail(`battle ${node.id} guidance is incomplete`);
        for (const cardId of node.recommendedCollection) if (!cards[cardId]) fail(`battle ${node.id} recommends unknown card ${cardId}`);
        for (const lock of battle.modifiers?.laneLocks ?? []) if (lock.round < 1 || lock.round > 6 || lock.lanes.some((lane) => ![0, 1, 2].includes(lane))) fail(`battle ${node.id} has an invalid lane lock`);
        for (const phase of battle.phases ?? []) {
          if (!phase.id || !phase.name || phase.trigger.atLeast < 1) fail(`battle ${node.id} has an invalid phase`);
          for (const effect of phase.onEnter ?? []) {
            if (effect.kind === "reinforcement" && !cards[effect.cardId]) fail(`battle ${node.id} has unknown reinforcement ${effect.cardId}`);
            if ((effect.kind === "lane-lock" || effect.kind === "lane-power") && ("lane" in effect ? ![0, 1, 2].includes(effect.lane) : effect.lanes.some((lane) => ![0, 1, 2].includes(lane)))) fail(`battle ${node.id} has an invalid phase lane`);
          }
        }
      } else if (!node.scenes.length) fail(`node ${node.id} needs a scene`);
    }
    for (const prerequisite of chapter.prerequisites) if (!chapterIds.has(prerequisite)) fail(`chapter ${chapter.id} has unknown prerequisite ${prerequisite}`);
    for (const node of chapter.nodes) for (const prerequisite of node.prerequisites) if (!nodeIds.has(prerequisite)) fail(`node ${node.id} has unknown prerequisite ${prerequisite}`);
  }
  return content;
}

export const storyContent = validateStoryContent({ version: 1, chapters: [prologueChapter] });
export const getStoryChapter = (chapterId: string) => storyContent.chapters.find((chapter) => chapter.id === chapterId);
export const getStoryNode = (nodeId: string) => storyContent.chapters.flatMap((chapter) => chapter.nodes).find((node) => node.id === nodeId);
export const getStoryBattle = (nodeId: string) => {
  const node = getStoryNode(nodeId);
  return node?.kind === "battle" ? node : undefined;
};