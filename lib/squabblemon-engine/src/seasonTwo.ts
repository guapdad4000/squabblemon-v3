import { completeEngineCrew } from "./data";
import type { StoryEncounterSnapshot } from "./gameEngine";
import type {
  StoryChapter, StoryCinematic, StoryDialogueLine, StoryNode, StoryPuzzleDefinition,
  StoryReward, StoryStarObjective, StoryTeaching,
} from "./story";
import { seasonTwoScripts, type SeasonTwoBattleBeat, type SeasonTwoSpeech } from "./seasonTwoDialogue";

const PORTRAITS: Readonly<Record<string, string>> = {
  "Ganger Blue": "ganger-blue", "Ganger Red": "ganger-red", "Cracked Head": "cracked-head",
  "Baby Momma": "baby-momma", Wifey: "wifey", Snitch: "snitch", Cornball: "cornball",
  "OG Uncle": "og-uncle", "Church Auntie": "church-auntie", "All Jokes Roaster": "all-jokes-roaster",
  "Alley Runner": "ganger-blue", "Techbro Rich": "techbro-rich", "Live Streamer": "live-streamer",
  "Delivery Demon": "delivery-demon", "Bottle Girl": "bottle-girl", Promoter: "promoter",
  Landlord: "landlord", "Nail Tech": "nail-tech", Scammer: "scammer", "Regular guy named LeBron James": "lebron-james",
  "Officer Oink": "officer-oink", "Inmate Crafty": "inmate-crafty", "Inmate Informant": "inmate-informant",
  "Inmate Boyfriend": "inmate-boyfriend", "Inmate Contraband": "inmate-contraband", Hooper: "hooper",
};
const portrait = (speaker: string) => {
  const slug = PORTRAITS[speaker];
  if (!slug) throw new Error(`Season Two speaker has no portrait: ${speaker}`);
  return `assets/characters/${slug}.webp`;
};
const dialogue = (speech: readonly SeasonTwoSpeech[]): readonly StoryDialogueLine[] =>
  speech.map(([speaker, text]) => ({ speaker, portraitAssetId: portrait(speaker), text }));

const decks = [
  ["cornball", "snow", "roaster", "rastamon", "wifey", "oink", "baby"],
  ["bikelife", "vibe", "plug", "hooper", "baby", "cornball", "snow"],
  ["streamer", "gamer", "techbro", "plug", "nerd", "scammer", "promoter"],
  ["church", "landlord", "nail", "og", "delivery", "barber", "bottle"],
] as const;
const soundHooks = {
  intro: "story.encounter.intro", play: "story.card.play", phase: "story.boss.phase",
  victory: "story.victory", defeat: "story.defeat",
};
const objectivesFor = (rounds: number, index: number): readonly StoryStarObjective[] => {
  const win: StoryStarObjective = { id: "win", description: `Win the ${rounds}-round encounter.`, criterion: { kind: "win" } };
  const second: StoryStarObjective = index % 2
    ? { id: "outside", description: "Finish holding both outside districts.", criterion: { kind: "specific-districts-held", owner: "player", lanes: [0, 2] } }
    : { id: "motion", description: "Finish with at least 1 Motion.", criterion: { kind: "motion-remaining", owner: "player", atLeast: 1 } };
  const third: StoryStarObjective = index % 3
    ? { id: "squabble", description: "Win without using SQUABBLE.", criterion: { kind: "squabble-used", owner: "player", used: false } }
    : { id: "movement", description: "Move at least one of your cards.", criterion: { kind: "cards-moved", owner: "player", atLeast: 1 } };
  return [win, second, third];
};
const envFor = (chapterIndex: number) => chapterIndex === 0
  ? "assets/story/theater/rooftop.webp"
  : `assets/venues/${["corner-store-court", "harbor-skyline-court", "civic-hill-climb", "red-fence-night-court", "crown-rooftop-court"][chapterIndex % 5]}.webp`;
const cinematic = (environmentAssetId: string): StoryCinematic => ({
  videoAssetId: "assets/story/chapter-one/media/standard-clash.mp4",
  posterAssetId: "assets/story/chapter-one/media/standard-clash.webp",
  environmentAssetId,
});
const xp = (amount: number): StoryReward => ({ kind: "currency", id: "street-xp", amount });
const teaching = (tips: readonly string[], mechanics: readonly string[], cards: readonly string[]): StoryTeaching => ({
  tips, focusMechanics: mechanics, focusCards: cards,
});

function encounterFor(
  beat: SeasonTwoBattleBeat, chapterIndex: number, battleIndex: number,
  objectives: readonly StoryStarObjective[], media: StoryCinematic,
): StoryEncounterSnapshot {
  const cpuOpeningHand = beat.id === "s2-pledge-drive-final"
    ? 3
    : battleIndex === 2 ? 4 : 3;
  const modifiers: NonNullable<StoryEncounterSnapshot["modifiers"]> = {
    startingMotion: { player: 3, cpu: battleIndex === 2 ? 1 : 0 },
    handSize: { cpu: cpuOpeningHand },
    ...(beat.rules === "lock" ? { laneLocks: [{ round: Math.min(3, beat.rounds), owner: "both" as const, lanes: [1 as const] }] } : {}),
    ...(beat.rules === "reinforce" ? { reinforcements: [{ round: Math.min(4, beat.rounds), owner: "cpu" as const, cardId: "cornball" }] } : {}),
  };
  const phases: NonNullable<StoryEncounterSnapshot["phases"]> = beat.rules === "phase" ? [
    {
      id: `${beat.id}-pressure`, name: "Public Pressure",
      description: "At round three, the opponent gains 1 Motion.",
      trigger: { kind: "round", atLeast: 3 }, onEnter: [{ kind: "motion", owner: "cpu", amount: 1 }],
    },
    {
      id: `${beat.id}-late-arrival`, name: "Late Arrival",
      description: `At round ${beat.rounds}, one supporter reinforces the opponent.`,
      trigger: { kind: "round", atLeast: beat.rounds },
      onEnter: [{ kind: "reinforcement", owner: "cpu", cardId: "snow" }],
    },
  ] : [];
  return {
    id: beat.id,
    enemy: {
      id: `${beat.id}:enemy`, name: beat.opponent, portraitAssetId: portrait(beat.opponent),
      deckId: `${beat.id}-deck`, cardIds: completeEngineCrew(decks[(chapterIndex + battleIndex) % decks.length]),
      behaviorProfile: beat.boss ? "combo-boss" : beat.rules === "lock" ? "reactive" : "balanced",
    },
    battlefieldAssetId: media.environmentAssetId, cinematic: media, soundHooks,
    modifiers, phases, roundLimit: beat.rounds, starObjectives: objectives,
    ...(beat.boss ? { passive: { name: "Announced Terms", description: "The final table escalates once without changing the agreement outside the match." } } : {}),
  };
}

function puzzleFor(chapterId: string, puzzle: NonNullable<(typeof seasonTwoScripts)[number]["puzzle"]>): StoryPuzzleDefinition {
  return {
    id: `${chapterId}-evidence-order`, title: "Put the Evidence in Order",
    instruction: "Arrange the evidence from earliest to latest. Dates and recorded handoffs matter more than anyone's confidence.",
    imageAssetId: "assets/story/theater/evidence.webp", pieces: puzzle.pieces,
    solution: puzzle.solution, hints: ["Start with the earliest printed or recorded time.", "Each later item depends on the one before it."],
    solvedText: puzzle.solvedText,
    skipText: "The group orders the copies together. You receive the same story progress, with no puzzle bonus.",
  };
}

export const seasonTwoChapters: readonly StoryChapter[] = seasonTwoScripts.map((script, chapterIndex): StoryChapter => {
  const environment = envFor(chapterIndex);
  const media = cinematic(environment);
  const nodes: StoryNode[] = [];
  const openingId = `${script.id}-opening`;
  nodes.push({
    id: openingId, kind: "dialogue", title: "Call to Order", mapPosition: { x: 7, y: 78 },
    prerequisites: [], optional: false, rewards: [], cinematic: media,
    teaching: teaching(["Listen for the terms before the first contest."], ["story progression"], ["cornball"]),
    scenes: dialogue(script.opening),
  });
  let prior = openingId;
  script.battles.forEach((beat, battleIndex) => {
    const objectives = objectivesFor(beat.rounds, chapterIndex * 3 + battleIndex);
    const focusCards = battleIndex === 0 ? ["cornball", "plug", "snow"] : battleIndex === 1 ? ["carmeet", "delivery", "plug"] : ["wifey", "hooper", "rastamon"];
    nodes.push({
      id: beat.id, kind: "battle", battleType: beat.boss ? "boss" : beat.rules === "lock" ? "rule-twist" : "standard",
      title: beat.title, mapPosition: { x: 27 + battleIndex * 21, y: 64 - battleIndex * 19 },
      prerequisites: [prior], optional: false, rewards: [xp(75 + battleIndex * 25)],
      teaching: teaching(
        [`This announced contest lasts ${beat.rounds} rounds.`, "Its result settles only the stated event term."],
        [beat.rules === "lock" ? "lane locks" : beat.rules === "reinforce" ? "reinforcements" : "boss phases", "Motion management"],
        focusCards,
      ),
      cinematic: media, encounter: encounterFor(beat, chapterIndex, battleIndex, objectives, media),
      preDialogue: dialogue(beat.before), postDialogue: dialogue(beat.after),
      starObjectives: objectives, recommendedCollection: focusCards,
    });
    prior = beat.id;
    if (battleIndex === 0 && script.puzzle) {
      const puzzleId = `${script.id}-evidence`;
      nodes.push({
        id: puzzleId, kind: "dialogue", title: "Evidence Table", mapPosition: { x: 39, y: 70 },
        prerequisites: [prior], optional: false, rewards: [xp(40)], cinematic: media,
        teaching: teaching(["Order the evidence by its authentic timestamps."], ["evidence order"], ["nerd"]),
        puzzle: puzzleFor(script.id, script.puzzle), scenes: dialogue(script.puzzle.scene),
      });
      prior = puzzleId;
    }
  });
  nodes.push({
    id: `${script.id}-closing`, kind: "reward", title: chapterIndex === 7 ? "Keys in Three Pockets" : "After the Tables Fold",
    mapPosition: { x: 94, y: 8 }, prerequisites: [prior], optional: false,
    rewards: [
      xp(125),
      { kind: "pack-ticket", id: "street-pack-ticket", amount: chapterIndex === 7 ? 3 : 1 },
      ...(chapterIndex < 7 ? [{ kind: "chapter-key" as const, id: `story-key:${seasonTwoScripts[chapterIndex + 1].id}`, amount: 1 }] : []),
    ],
    teaching: teaching(["The match result and the real-world agreement remain separate."], ["story resolution"], ["cornball"]),
    cinematic: media, scenes: dialogue(script.closing),
  });
  return {
    id: script.id, order: script.order, title: script.title, subtitle: script.subtitle,
    description: script.description, mapAssetId: environment,
    prerequisites: [chapterIndex === 0 ? "the-crown" : seasonTwoScripts[chapterIndex - 1].id],
    nodes,
  };
});