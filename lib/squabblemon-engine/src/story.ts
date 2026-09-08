import { cards } from "./data";
import type { StoryEncounterSnapshot } from "./gameEngine";

export type StoryMapPosition = { readonly x: number; readonly y: number };
export type StoryDialogueLine = { readonly speaker: string; readonly portraitAssetId: string; readonly text: string; readonly soundHook?: string };
export type StoryReward = { readonly kind: "currency" | "card" | "chapter-key" | "pack-ticket" | "cosmetic"; readonly id: string; readonly amount: number };
export type StoryStarObjective = { readonly id: string; readonly description: string };
export type StoryTeaching = { readonly tips: readonly string[]; readonly focusMechanics: readonly string[]; readonly focusCards: readonly string[] };
export type StoryCinematic = { readonly videoAssetId: string; readonly posterAssetId: string; readonly environmentAssetId: string };
type StoryNodeBase = {
  readonly id: string; readonly title: string; readonly mapPosition: StoryMapPosition; readonly prerequisites: readonly string[];
  readonly optional: boolean; readonly rewards: readonly StoryReward[]; readonly teaching: StoryTeaching; readonly cinematic: StoryCinematic;
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
const encounter = (id: string, name: string, portraitAssetId: string, cards: readonly string[], behaviorProfile: string, cinematicMetadata: StoryCinematic, extra: Pick<StoryEncounterSnapshot, "modifiers" | "phases" | "passive"> = {}): StoryEncounterSnapshot => ({
  id, enemy: { id: `${id}:enemy`, name, portraitAssetId, deckId: `${id}-deck`, cardIds: cards, behaviorProfile },
  battlefieldAssetId: cinematicMetadata.environmentAssetId, cinematic: cinematicMetadata,
  soundHooks: { intro: "story.encounter.intro", play: "story.card.play", phase: "story.boss.phase", victory: "story.victory", defeat: "story.defeat" }, modifiers: {}, phases: [], ...extra,
});
const objectives: readonly StoryStarObjective[] = [{ id: "win", description: "Win the encounter." }, { id: "districts", description: "Finish holding all three districts." }, { id: "squabble", description: "Win without using SQUABBLE." }];
const blueDeck = ["cornball", "snow", "roaster", "rastamon", "wifey", "oink", "baby"] as const;
const redDeck = ["cornball", "bikelife", "vibe", "plug", "snow", "hooper", "baby"] as const;
const receiptDeck = ["cornball", "roaster", "nerd", "snow", "plug", "baby", "hooper"] as const;
const bossDeck = ["cornball", "plug", "streamer", "gamer", "techbro", "vibe", "wifey"] as const;
const storyCosmeticIds = new Set(["side-alley-tagged-cardback", "block-party-crowned"]);
export const isStoryCosmeticId = (id: string) => storyCosmeticIds.has(id);

export const blockPartyChapter: StoryChapter = {
  id: "block-party", order: 1, title: "Chapter One: Block Party", subtitle: "Take the block, keep the receipts.", description: "A neighborhood rivalry turns into a public test of your crew.", mapAssetId: `${env}map.webp`, prerequisites: [],
  nodes: [
    { id: "welcome-to-the-block", kind: "battle", battleType: "guided", title: "Welcome to the Block", mapPosition: { x: 8, y: 76 }, prerequisites: [], optional: false, rewards: [{ kind: "currency", id: "street-xp", amount: 50 }], teaching: teaching(["Play where district rules help your card.", "You only need two districts to win."], ["district scoring", "Motion"], ["cornball", "snow"]), cinematic: cinematic("chapter-opening", "map"), encounter: { ...encounter("welcome-to-the-block", "Ganger Blue", portraits.blue, blueDeck, "balanced", cinematic("chapter-opening", "map")), battlefieldAssetId: `${venue}corner-store-court.webp` }, preDialogue: [line("Ganger Blue", portraits.blue, "Welcome to the Block. Claim two districts and make it look easy.")], postDialogue: [line("Ganger Blue", portraits.blue, "You can hold ground. Now hold it under pressure.")], starObjectives: objectives, recommendedCollection: ["cornball", "snow", "rastamon"] },
    { id: "blue-side-pressure", kind: "battle", battleType: "standard", title: "Blue Side Pressure", mapPosition: { x: 23, y: 62 }, prerequisites: ["welcome-to-the-block"], optional: false, rewards: [{ kind: "currency", id: "street-xp", amount: 75 }], teaching: teaching(["Cheap cards establish a lead before big finishers arrive."], ["tempo", "lane commitment"], ["plug", "bikelife"]), cinematic: cinematic("standard-clash", "blue-side"), encounter: { ...encounter("blue-side-pressure", "Ganger Blue", portraits.blue, blueDeck, "balanced", cinematic("standard-clash", "blue-side")), battlefieldAssetId: `${venue}harbor-skyline-court.webp` }, preDialogue: [line("Ganger Blue", portraits.blue, "Blue side does not give up districts for free.")], postDialogue: [line("Ganger Blue", portraits.blue, "Red side saw that. They brought receipts.")], starObjectives: objectives, recommendedCollection: ["plug", "bikelife", "vibe"] },
    { id: "receipts-on-camera", kind: "battle", battleType: "rule-twist", title: "Receipts on Camera", mapPosition: { x: 40, y: 54 }, prerequisites: ["blue-side-pressure"], optional: false, rewards: [{ kind: "currency", id: "street-xp", amount: 100 }], teaching: teaching(["The middle district closes in round two—commit elsewhere or wait it out."], ["lane locks", "disruption"], ["roaster", "nerd", "snow"]), cinematic: cinematic("standard-clash", "receipts"), encounter: { ...encounter("receipts-on-camera", "Ganger Red", portraits.red, receiptDeck, "aggressive", cinematic("standard-clash", "receipts"), { modifiers: { startingMotion: { player: 2, cpu: 2 }, laneLocks: [{ round: 2, owner: "both", lanes: [1] }], lanePowerBonuses: [{ owner: "both", lane: 2, amount: 2 }] } }), battlefieldAssetId: `${venue}red-fence-night-court.webp` }, preDialogue: [line("Ganger Red", portraits.red, "Camera is rolling. Middle road closes next round.")], postDialogue: [line("Ganger Red", portraits.red, "Keep those receipts. You will need them.")], starObjectives: objectives, recommendedCollection: ["roaster", "nerd", "snow"] },
    { id: "red-side-retaliation", kind: "battle", battleType: "standard", title: "Red Side Retaliation", mapPosition: { x: 57, y: 42 }, prerequisites: ["receipts-on-camera"], optional: false, rewards: [{ kind: "currency", id: "street-xp", amount: 125 }], teaching: teaching(["Save Motion for a contested district.", "Protection can absorb targeted disruption."], ["Motion management", "protection"], ["wifey", "hooper"]), cinematic: cinematic("standard-clash", "red-side"), encounter: { ...encounter("red-side-retaliation", "Ganger Red", portraits.red, redDeck, "aggressive", cinematic("standard-clash", "red-side"), { modifiers: { startingMotion: { cpu: 2 }, roundMotionDeltas: [{ round: 4, owner: "cpu", amount: 1 }] } }), battlefieldAssetId: `${venue}red-fence-night-court.webp` }, preDialogue: [line("Ganger Red", portraits.red, "You embarrassed us on camera. Now play a harder hand.")], postDialogue: [line("Ganger Red", portraits.red, "Cracked Head runs this corner. Good luck.")], starObjectives: objectives, recommendedCollection: ["wifey", "hooper", "baby"] },
    { id: "side-alley-challenge", kind: "battle", battleType: "standard", title: "Side Alley Challenge", mapPosition: { x: 52, y: 76 }, prerequisites: ["blue-side-pressure"], optional: true, rewards: [{ kind: "cosmetic", id: "side-alley-tagged-cardback", amount: 1 }], teaching: teaching(["This mastery match is optional and never blocks the main route."], ["movement", "mastery"], ["bikelife", "vibe"]), cinematic: cinematic("standard-clash", "side-alley"), encounter: { ...encounter("side-alley-challenge", "Alley Runner", portraits.blue, redDeck, "movement", cinematic("standard-clash", "side-alley")), battlefieldAssetId: `${venue}corner-store-court.webp` }, preDialogue: [line("Alley Runner", portraits.blue, "Optional route. Win it if you want the tag.")], postDialogue: [line("Alley Runner", portraits.blue, "That cardback is yours.")], starObjectives: objectives, recommendedCollection: ["bikelife", "vibe"] },
    { id: "snitch-at-the-corner", kind: "battle", battleType: "mini-boss", title: "Snitch at the Corner", mapPosition: { x: 72, y: 31 }, prerequisites: ["red-side-retaliation"], optional: false, rewards: [{ kind: "currency", id: "street-xp", amount: 175 }], teaching: teaching(["Snitch's Watching the Feed gives a deterministic CPU Motion bump in round four."], ["round modifiers", "timing"], ["snow", "rastamon", "roaster"]), cinematic: cinematic("snitch-intro", "snitch-corner"), encounter: { ...encounter("snitch-at-the-corner", "Snitch", portraits.snitch, receiptDeck, "reactive", cinematic("snitch-intro", "snitch-corner"), { passive: { name: "Watching the Feed", description: "At round four, Snitch cashes the camera chatter into +2 Motion." }, modifiers: { handSize: { cpu: 4 } }, phases: [{ id: "watching-the-feed", name: "Watching the Feed", description: "At round four, Snitch cashes the camera chatter into +2 CPU Motion.", trigger: { kind: "round", atLeast: 4 }, onEnter: [{ kind: "motion", owner: "cpu", amount: 2 }] }] }), battlefieldAssetId: `${venue}civic-hill-climb.webp` }, preDialogue: [line("Snitch", portraits.snitch, "Watching the Feed: every play is evidence.")], postDialogue: [line("Snitch", portraits.snitch, "Cracked Head heard the whole stream.")], starObjectives: objectives, recommendedCollection: ["snow", "rastamon", "roaster"] },
    { id: "cracked-head-takes-the-block", kind: "battle", battleType: "boss", title: "Cracked Head Takes the Block", mapPosition: { x: 88, y: 16 }, prerequisites: ["snitch-at-the-corner"], optional: false, rewards: [{ kind: "currency", id: "street-xp", amount: 250 }], teaching: teaching(["Each phase is telegraphed and triggers once.", "Plan around the late reinforcement."], ["boss phases", "reinforcements"], ["wifey", "roaster", "hooper"]), cinematic: cinematic("cracked-head-finale", "cracked-head-block"), encounter: { ...encounter("cracked-head-takes-the-block", "Cracked Head", portraits.cracked, bossDeck, "combo-boss", cinematic("cracked-head-finale", "cracked-head-block"), { passive: { name: "Three Deep", description: "Cracked Head escalates through three one-time phases as the block changes hands." }, modifiers: { startingMotion: { cpu: 2 } }, phases: [{ id: "territory-claim", name: "Territory Claim", description: "Opening claim: CPU gains +1 Motion once.", trigger: { kind: "round", atLeast: 1 }, onEnter: [{ kind: "motion", owner: "cpu", amount: 1 }] }, { id: "pressure-cooker", name: "Pressure Cooker", description: "When you hold two districts, CPU gets +2 Power in the middle once.", trigger: { kind: "districts-held", owner: "player", atLeast: 2 }, onEnter: [{ kind: "lane-power", owner: "cpu", lane: 1, amount: 2 }] }, { id: "last-call", name: "Last Call", description: "Round five brings one Snow reinforcement once.", trigger: { kind: "round", atLeast: 5 }, onEnter: [{ kind: "reinforcement", owner: "cpu", cardId: "snow" }] }] }), battlefieldAssetId: `${venue}crown-rooftop-court.webp` }, preDialogue: [line("Cracked Head", portraits.cracked, "This block has phases. You are entering all three.")], postDialogue: [line("Cracked Head", portraits.cracked, "Block is yours. Wear the crown.")], starObjectives: objectives, recommendedCollection: ["wifey", "roaster", "hooper"] },
    { id: "block-crowned", kind: "reward", title: "Block Crowned", mapPosition: { x: 94, y: 5 }, prerequisites: ["cracked-head-takes-the-block"], optional: false, rewards: [{ kind: "card", id: "nerd", amount: 1 }, { kind: "pack-ticket", id: "street-pack-ticket", amount: 1 }, { kind: "cosmetic", id: "block-party-crowned", amount: 1 }, { kind: "chapter-key", id: "story-key:chapter-two", amount: 1 }], teaching: teaching(["Chapter Two is unlocked after this ceremony."], ["collection rewards"], ["nerd"]), cinematic: cinematic("cracked-head-finale", "victory"), scenes: [line("Snitch", portraits.snitch, "Block Crowned. Your Chapter Two route is open.") ] },
  ],
};

const fail = (message: string): never => { throw new Error(`Invalid story content: ${message}`); };
const validReward = (reward: StoryReward) => ["currency", "card", "chapter-key", "pack-ticket", "cosmetic"].includes(reward.kind) && !!reward.id && Number.isInteger(reward.amount) && reward.amount > 0;
export function validateStoryContent(content: StoryContent): StoryContent {
  if (!Number.isInteger(content.version) || content.version < 1 || !content.chapters.length) fail("version or chapters is invalid");
  const chapterIds = new Set<string>(), nodeIds = new Set<string>(), chapterOrders = new Set<number>();
  for (const chapter of content.chapters) {
    if (!chapter.id || chapterIds.has(chapter.id) || chapterOrders.has(chapter.order) || !chapter.title || !chapter.subtitle || !chapter.description || !chapter.mapAssetId) fail(`invalid chapter ${chapter.id}`);
    chapterIds.add(chapter.id); chapterOrders.add(chapter.order);
    const local = new Map(chapter.nodes.map((node) => [node.id, node]));
    if (!chapter.nodes.length) fail(`chapter ${chapter.id} has no nodes`);
    for (const node of chapter.nodes) {
      if (!node.id || nodeIds.has(node.id) || !node.title || !local.has(node.id) || ![node.mapPosition.x, node.mapPosition.y].every((x) => Number.isFinite(x) && x >= 0 && x <= 100)) fail(`invalid node ${node.id}`);
      nodeIds.add(node.id);
      if (!node.teaching.tips.length || !node.teaching.focusMechanics.length || !node.teaching.focusCards.length || node.teaching.focusCards.some((id) => !cards[id]) || !node.cinematic.videoAssetId.endsWith(".mp4") || !node.cinematic.posterAssetId.endsWith(".webp") || !node.cinematic.environmentAssetId) fail(`node ${node.id} presentation is incomplete`);
      if (node.prerequisites.includes(node.id) || new Set(node.prerequisites).size !== node.prerequisites.length || node.prerequisites.some((id) => !local.has(id))) fail(`node ${node.id} has invalid prerequisites`);
      if (node.rewards.some((reward) => !validReward(reward) || (reward.kind === "card" && !cards[reward.id]) || (reward.kind === "cosmetic" && !isStoryCosmeticId(reward.id)) || (reward.kind === "chapter-key" && !reward.id.startsWith("story-key:")))) fail(`node ${node.id} has malformed rewards`);
      if (node.kind === "battle") {
        const battle = node.encounter;
        if (battle.enemy.cardIds.length !== 7 || new Set(battle.enemy.cardIds).size !== 7 || battle.enemy.cardIds.some((id) => !cards[id]) || !battle.enemy.name || !battle.enemy.portraitAssetId || !battle.enemy.deckId || !battle.enemy.behaviorProfile || !battle.battlefieldAssetId || !Object.keys(battle.soundHooks).length || !node.preDialogue.length || !node.postDialogue.length || !node.starObjectives.length || !node.recommendedCollection.length || node.recommendedCollection.some((id) => !cards[id])) fail(`battle ${node.id} is incomplete`);
        const phases = battle.phases ?? [];
        const modifiers = battle.modifiers ?? {};
        if (
          Object.values(modifiers.startingMotion ?? {}).some((value) => !Number.isInteger(value) || value < 0) ||
          Object.values(modifiers.handSize ?? {}).some((value) => !Number.isInteger(value) || value < 1 || value > 7) ||
          (modifiers.laneLocks ?? []).some((lock) => !Number.isInteger(lock.round) || lock.round < 1 || lock.round > 6 || !lock.lanes.length || lock.lanes.some((lane) => ![0, 1, 2].includes(lane))) ||
          (modifiers.roundMotionDeltas ?? []).some((item) => !Number.isInteger(item.round) || item.round < 1 || item.round > 6 || !Number.isInteger(item.amount)) ||
          (modifiers.lanePowerBonuses ?? []).some((item) => ![0, 1, 2].includes(item.lane) || !Number.isInteger(item.amount)) ||
          (modifiers.reinforcements ?? []).some((item) => !Number.isInteger(item.round) || item.round < 1 || item.round > 6 || !cards[item.cardId])
        ) fail(`battle ${node.id} has invalid modifiers`);
        if (new Set(phases.map((phase) => phase.id)).size !== phases.length || phases.some((phase) => !phase.id || !phase.name || !phase.description || phase.trigger.atLeast < 1 || (phase.onEnter ?? []).some((effect) => (effect.kind === "reinforcement" && !cards[effect.cardId]) || ((effect.kind === "lane-lock" && effect.lanes.some((lane) => ![0, 1, 2].includes(lane))) || (effect.kind === "lane-power" && ![0, 1, 2].includes(effect.lane)))))) fail(`battle ${node.id} has invalid phases`);
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
export const storyContent = validateStoryContent({ version: 2, chapters: [blockPartyChapter] });
export const getStoryChapter = (chapterId: string) => storyContent.chapters.find((chapter) => chapter.id === chapterId);
export const getStoryNode = (nodeId: string) => storyContent.chapters.flatMap((chapter) => chapter.nodes).find((node) => node.id === nodeId);
export const getStoryBattle = (nodeId: string) => { const node = getStoryNode(nodeId); return node?.kind === "battle" ? node : undefined; };