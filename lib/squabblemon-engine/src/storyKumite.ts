import { KUMITE_PUZZLES } from "./storyKumitePuzzles";
import { cards, completeEngineCrew } from "./data";
import type { StoryEncounterSnapshot } from "./gameEngine";
import type {
  StoryChapter,
  StoryCinematic,
  StoryDialogueLine,
  StoryNode,
  StoryReward,
  StoryStarObjective,
} from "./story";

type SpeakerKey =
  | "leroy"
  | "shonuff"
  | "bushedo-brown"
  | "franklin-duke"
  | "dragonflyjones"
  | "undercova"
  | "ptang"
  | "chonk-lee";

const say = (key: SpeakerKey, text: string): StoryDialogueLine => {
  const card = cards[key];
  if (!card) throw new Error(`Unknown Kumite speaker: ${key}`);
  return {
    speaker: card.name,
    portraitAssetId: `assets/characters/${card.id}.webp`,
    text,
  };
};

const film = (
  slug: "chonk" | "ptang" | "franklin" | "brown" | "undercova" | "shonuff" | "glo" | "leroy",
  environment: "dojo-arena-wide" | "hallway-wide" = "dojo-arena-wide",
): StoryCinematic => {
  const episode = {
    chonk: "ep01-invitation", ptang: "ep02-belt-check", franklin: "ep03-find-the-glo",
    brown: "ep04-courtesy", undercova: "ep05-break-the-bracket", shonuff: "ep06-arena-is-ours",
    glo: "ep07-i-got-the-glo", leroy: "ep08-legends-remain",
  }[slug];
  return {
    videoAssetId: `assets/kumite/films/story-v2/${episode}-landscape.mp4`,
    posterAssetId: `assets/kumite/films/story-v2/${episode}-landscape.webp`,
    portraitVideoAssetId: `assets/kumite/films/story-v2/${episode}-portrait.mp4`,
    portraitPosterAssetId: `assets/kumite/films/story-v2/${episode}-portrait.webp`,
    titleAssetId: `assets/kumite/titles/${episode}.webp`,
    environmentAssetId: `assets/kumite/${environment}.webp`,
  };
};

const standardStars: readonly StoryStarObjective[] = [
  { id: "win", description: "Win the encounter.", criterion: { kind: "win" } },
  {
    id: "two-districts",
    description: "Finish holding at least two districts.",
    criterion: { kind: "districts-held", owner: "player", atLeast: 2 },
  },
  {
    id: "motion",
    description: "Finish with at least 1 Motion.",
    criterion: { kind: "motion-remaining", owner: "player", atLeast: 1 },
  },
];

const outsideStars: readonly StoryStarObjective[] = [
  standardStars[0],
  {
    id: "outside",
    description: "Finish holding both outside districts.",
    criterion: {
      kind: "specific-districts-held",
      owner: "player",
      lanes: [0, 2],
    },
  },
  standardStars[2],
];

const bossStars: readonly StoryStarObjective[] = [
  standardStars[0],
  {
    id: "districts",
    description: "Win at least two districts against Sho'Nuff's takeover.",
    criterion: { kind: "districts-held", owner: "player", atLeast: 2 },
  },
  {
    id: "motion",
    description: "Finish with at least 2 Motion.",
    criterion: { kind: "motion-remaining", owner: "player", atLeast: 2 },
  },
];

const soundHooks = {
  intro: "story.encounter.intro",
  play: "story.card.play",
  phase: "story.boss.phase",
  victory: "story.victory",
  defeat: "story.defeat",
};

const KUMITE_SUGGESTED_CREW = [
  "leroy",
  "bushedo-brown",
  "undercova",
  "dragonflyjones",
  "ptang",
  "wifey",
  "hooper",
  "cornball",
  "plug",
  "snow",
] as const;

type EpisodeSpec = {
  id: string;
  title: string;
  filmSlug:
    | "chonk"
    | "ptang"
    | "franklin"
    | "brown"
    | "undercova"
    | "shonuff"
    | "glo"
    | "leroy";
  env?: "dojo-arena-wide" | "hallway-wide";
  mapPosition: { readonly x: number; readonly y: number };
  focusCards: readonly string[];
  tips: readonly string[];
  scenes?: readonly StoryDialogueLine[];
  battle?: {
    battleType: "standard" | "rule-twist" | "mini-boss" | "boss";
    opponent: SpeakerKey;
    crew: readonly string[];
    roundLimit: 5 | 6;
    passive: { readonly name: string; readonly description: string };
    pre: readonly StoryDialogueLine[];
    post: readonly StoryDialogueLine[];
    stars: readonly StoryStarObjective[];
    modifiers: StoryEncounterSnapshot["modifiers"];
    phases?: StoryEncounterSnapshot["phases"];
  };
  rewards?: readonly StoryReward[];
  finale?: boolean;
};

const episodes: readonly EpisodeSpec[] = [
  {
    id: "kumite-break-the-bracket-invitation",
    title: "01 · The Invitation",
    filmSlug: "chonk",
    env: "hallway-wide",
    mapPosition: { x: 10, y: 80 },
    focusCards: ["chonk-lee", "leroy", "bushedo-brown"],
    tips: [
      "Eight contenders enter beneath the bracket board: four quarterfinals, two semifinals, and one final.",
      "Watch or skip any episode film at any time; replay remains available on the node.",
    ],
    scenes: [
      say(
        "chonk-lee",
        "Eight names on the board. Red lights up top, yellow flags on the wall, and no referees saving you when the bell rings.",
      ),
      say(
        "bushedo-brown",
        "Respect the bracket, read the three districts, and keep your hands up. Every fighter in this hallway earned their invitation.",
      ),
      say(
        "leroy",
        "I did not come here to talk about titles. Show me the first table.",
      ),
    ],
  },
  {
    id: "kumite-break-the-bracket-belt-check",
    title: "02 · Belt Check",
    filmSlug: "ptang",
    mapPosition: { x: 22, y: 68 },
    focusCards: ["ptang", "dragonflyjones", "leroy"],
    tips: [
      "P. Tang punishes crowded lanes with knockback; spread your Hands across two districts.",
      "Round 1 adds a temporary Dragonfly Jones to your hand for this fight.",
    ],
    battle: {
      battleType: "standard",
      opponent: "ptang",
      crew: [
        "ptang",
        "dragonflyjones",
        "cornball",
        "roaster",
        "hooper",
        "plug",
        "bikelife",
      ],
      roundLimit: 5,
      passive: {
        name: "Belt Check",
        description:
          "Round 1 adds a temporary Dragonfly Jones to your hand. Hold two districts against P. Tang's belt pressure.",
      },
      pre: [
        say(
          "dragonflyjones",
          "Quiet in the stands! Seven-time grandmaster stepping onto the mat—watch the footwork!",
        ),
        say(
          "ptang",
          "Boy, my belt has more reach than your whole speech. Step into the middle lane and find out.",
        ),
      ],
      post: [
        say(
          "dragonflyjones",
          "Alright, the belt caught my jacket—not my pride. Next round is yours.",
        ),
        say(
          "ptang",
          "Good balance. Keep moving like that when the heavy hitters step up.",
        ),
      ],
      stars: standardStars,
      modifiers: {
        startingMotion: { player: 5, cpu: 1 },
        handSize: { player: 5, cpu: 3 },
        reinforcements: [
          {
            round: 1,
            owner: "player",
            cardId: "dragonflyjones",
            allowDuplicate: true,
          },
        ],
      },
    },
  },
  {
    id: "kumite-break-the-bracket-find-the-glo",
    title: "03 · Find the Glo",
    filmSlug: "franklin",
    mapPosition: { x: 35, y: 56 },
    focusCards: ["franklin-duke", "leroy", "wifey"],
    tips: [
      "Franklin Duke pressures the center; claim the outside districts before round three locks the middle.",
      "Round 1 adds a temporary Leroy to your hand so you can time the counter.",
    ],
    battle: {
      battleType: "rule-twist",
      opponent: "franklin-duke",
      crew: [
        "franklin-duke",
        "chonk-lee",
        "hooper",
        "bikelife",
        "plug",
        "snow",
        "cornball",
      ],
      roundLimit: 5,
      passive: {
        name: "First Gold Spark",
        description:
          "The center district locks in round three. Round 1 adds a temporary Leroy to your hand.",
      },
      pre: [
        say(
          "franklin-duke",
          "They told me Leroy had a secret glow. All I see is somebody backing toward the ropes.",
        ),
        say(
          "leroy",
          "Breathe first. Read the rib shot, then answer cleanly on the outside.",
        ),
      ],
      post: [
        say(
          "franklin-duke",
          "Wait—my hands shook on that counter. What was that gold spark?",
        ),
        say(
          "bushedo-brown",
          "Just the first spark. He hasn't even opened the door yet.",
        ),
      ],
      stars: outsideStars,
      modifiers: {
        startingMotion: { player: 5, cpu: 1 },
        handSize: { player: 5, cpu: 3 },
        laneLocks: [{ round: 3, owner: "both", lanes: [1] }],
        reinforcements: [
          { round: 1, owner: "player", cardId: "leroy", allowDuplicate: true },
        ],
      },
    },
  },
  {
    id: "kumite-break-the-bracket-courtesy",
    title: "04 · Professional Courtesy",
    filmSlug: "brown",
    mapPosition: { x: 48, y: 46 },
    focusCards: ["bushedo-brown", "undercova", "sherlock"],
    tips: [
      "Bushedo Brown and Undercova trade disruption and district control; keep 1 Motion in reserve.",
      "Round 1 adds Undercova Brotha to your hand as temporary backup.",
    ],
    battle: {
      battleType: "mini-boss",
      opponent: "bushedo-brown",
      crew: [
        "bushedo-brown",
        "undercova",
        "yasuke",
        "wifey",
        "hooper",
        "plug",
        "cornball",
      ],
      roundLimit: 6,
      passive: {
        name: "88 Seconds of Technique",
        description:
          "Round 1 adds Undercova Brotha to your hand. At round four, Bushedo Brown gains +1 Motion.",
      },
      pre: [
        say(
          "undercova",
          "Phone checked. Watch calibrated. Let's keep this professional, Bushedo.",
        ),
        say(
          "bushedo-brown",
          "Professional courtesy means I don't hold back a single hand. Show me your form.",
        ),
      ],
      post: [
        say(
          "bushedo-brown",
          "Clean exchange. Neither of us gave an inch for eighty-eight seconds.",
        ),
        say(
          "undercova",
          "Hold up—look at the bracket board. Somebody just crossed out the semifinal order.",
        ),
      ],
      stars: standardStars,
      modifiers: {
        startingMotion: { player: 5, cpu: 1 },
        handSize: { player: 5, cpu: 4 },
        reinforcements: [
          {
            round: 1,
            owner: "player",
            cardId: "undercova",
            allowDuplicate: true,
          },
        ],
      },
      phases: [
        {
          id: "second-stance",
          name: "Second Stance",
          description: "At round four, Bushedo Brown gains 1 extra Motion.",
          trigger: { kind: "round", atLeast: 4 },
          onEnter: [{ kind: "motion", owner: "cpu", amount: 1 }],
        },
      ],
    },
  },
  {
    id: "kumite-break-the-bracket-breakdown",
    title: "05 · Break the Bracket",
    filmSlug: "undercova",
    env: "hallway-wide",
    mapPosition: { x: 60, y: 36 },
    focusCards: ["undercova", "bushedo-brown", "shonuff"],
    tips: [
      "A knockdown on the mat does not prove elimination when outside interference hits the floor.",
    ],
    scenes: [
      say(
        "undercova",
        "The announcer is calling a foul on the mic—two-on-one in the corridor and the officials aren't stepping in.",
      ),
      say(
        "bushedo-brown",
        "They aren't trying to win the bracket. They're trying to break it so Sho'Nuff takes the arena by force.",
      ),
      say(
        "leroy",
        "Nobody hijacks this floor while we're standing on it. Clear the aisle.",
      ),
    ],
  },
  {
    id: "kumite-break-the-bracket-arena-is-ours",
    title: "06 · The Arena Is Ours",
    filmSlug: "shonuff",
    mapPosition: { x: 72, y: 26 },
    focusCards: ["shonuff", "leroy", "bushedo-brown"],
    tips: [
      "Sho'Nuff brings heavy lane pressure; use your round-1 Bushedo Brown and round-2 Leroy reinforcements to hold two districts.",
    ],
    battle: {
      battleType: "mini-boss",
      opponent: "shonuff",
      crew: [
        "shonuff",
        "franklin-duke",
        "chonk-lee",
        "redneck-evil",
        "folks",
        "ganger-red",
        "plug",
      ],
      roundLimit: 6,
      passive: {
        name: "Shogun Interruption",
        description:
          "Round 1 adds Bushedo Brown and Round 2 adds Leroy to your hand. At round four, Sho'Nuff surges with +1 Motion.",
      },
      pre: [
        say(
          "shonuff",
          "Forget the scoreboard! Who's the master?! This whole arena belongs to the Shogun now!",
        ),
        say(
          "leroy",
          "You jumped the corridor and hijacked the bracket. Step into the center and answer to both of us.",
        ),
      ],
      post: [
        say(
          "shonuff",
          "You think one round stops the Shogun?! Turn the red lights up—ask me again who the master is!",
        ),
        say("leroy", "I already know the answer."),
      ],
      stars: standardStars,
      modifiers: {
        startingMotion: { player: 6, cpu: 1 },
        handSize: { player: 5, cpu: 4 },
        reinforcements: [
          {
            round: 1,
            owner: "player",
            cardId: "bushedo-brown",
            allowDuplicate: true,
          },
          { round: 2, owner: "player", cardId: "leroy", allowDuplicate: true },
        ],
      },
      phases: [
        {
          id: "shogun-ambush",
          name: "Shogun Ambush",
          description: "At round four, Sho'Nuff gains 1 Motion.",
          trigger: { kind: "round", atLeast: 4 },
          onEnter: [{ kind: "motion", owner: "cpu", amount: 1 }],
        },
      ],
    },
  },
  {
    id: "kumite-break-the-bracket-i-got-the-glo",
    title: "07 · I Got the Glo",
    filmSlug: "glo",
    mapPosition: { x: 84, y: 16 },
    focusCards: ["leroy", "shonuff", "bushedo-brown"],
    tips: [
      "The two-stage finale: Leroy's gold aura boosts your left and center districts by +2 Hands at the start.",
      "Save 2 Motion at the final bell to earn all three mastery stars.",
    ],
    battle: {
      battleType: "boss",
      opponent: "shonuff",
      crew: [
        "shonuff",
        "franklin-duke",
        "chonk-lee",
        "ptang",
        "triple-og-red",
        "folks",
        "plug",
      ],
      roundLimit: 6,
      passive: {
        name: "I Got the Glo",
        description:
          "Leroy's gold awakening grants +2 Hands in the left and center districts and adds Leroy to your opening hand.",
      },
      pre: [
        say("shonuff", "Say it! Who's the master?!"),
        say("leroy", "I am."),
      ],
      post: [
        say(
          "bushedo-brown",
          "One gold uppercut and the whole takeover came apart.",
        ),
        say(
          "leroy",
          "The bracket is back in order. Every fighter gets a fair count.",
        ),
      ],
      stars: bossStars,
      modifiers: {
        startingMotion: { player: 6, cpu: 2 },
        handSize: { player: 6, cpu: 4 },
        lanePowerBonuses: [
          { owner: "player", lane: 0, amount: 2 },
          { owner: "player", lane: 1, amount: 2 },
        ],
        reinforcements: [
          { round: 1, owner: "player", cardId: "leroy", allowDuplicate: true },
          {
            round: 2,
            owner: "player",
            cardId: "bushedo-brown",
            allowDuplicate: true,
          },
        ],
      },
      phases: [
        {
          id: "red-glow-clash",
          name: "Red Glow Clash",
          description:
            "At round four, Sho'Nuff's final surge grants +1 CPU Motion and +2 Hands in the right district.",
          trigger: { kind: "round", atLeast: 4 },
          onEnter: [
            { kind: "motion", owner: "cpu", amount: 1 },
            { kind: "lane-power", owner: "cpu", lane: 2, amount: 2 },
          ],
        },
      ],
    },
  },
  {
    id: "kumite-break-the-bracket-legends-remain",
    title: "08 · Legends Remain",
    filmSlug: "leroy",
    mapPosition: { x: 94, y: 8 },
    focusCards: ["leroy", "bushedo-brown", "undercova"],
    tips: [
      "Complete weekly Kumite brackets and Dojo Boss Raids to claim permanent Kumite fighters on the unlock roadmap.",
    ],
    finale: true,
    rewards: [
      {
        kind: "currency",
        id: "street-xp",
        amount: 300,
      },
    ],
    scenes: [
      say(
        "bushedo-brown",
        "The lights are back up and the eight-player board is clean. Weekly brackets and the Dojo Boss Raid are open.",
      ),
      say(
        "undercova",
        "The films stay here. The unlock road keeps your real progress. Bring ten cards when you're ready for the weekly bracket.",
      ),
      say("leroy", "See you in the Kumite."),
    ],
  },
];

const trainingScenes: Readonly<Record<string, readonly StoryDialogueLine[]>> = {
  "kumite-puzzle-reach-matrix": [
    say(
      "undercova",
      "Scouting cards, not the live draw. Compare the styles before you commit your crew.",
    ),
    say(
      "bushedo-brown",
      "Start with the reach gap. Finish with the gold-and-red contrast.",
    ),
  ],
  "kumite-puzzle-meridian-map": [
    say(
      "ptang",
      "This stunt manual's got five cues. Put the combination back together before you try to improvise.",
    ),
    say(
      "dragonflyjones",
      "I improvise professionally. The floor keeps changing my choreography.",
    ),
  ],
  "kumite-puzzle-glo-conduit": [
    say(
      "leroy",
      "Feet, hips, breath, focus. Carry one clean motion all the way through.",
    ),
    say(
      "bushedo-brown",
      "The first spark starts with control. Read the seven cues from the floor up.",
    ),
  ],
  "kumite-puzzle-five-form-manual": [
    say(
      "undercova",
      "Five feints. I'll tell you what I show; you tell me which form answers.",
    ),
    say(
      "bushedo-brown",
      "Read the opening, then choose the counter. Every answer is in the manual.",
    ),
  ],
  "kumite-puzzle-wooden-dummy": [
    say(
      "bushedo-brown",
      "Upper, middle, lower. Change the lead hand every beat.",
    ),
    say(
      "dragonflyjones",
      "Left, right, left, right. I've mastered the counting. Now for the landing.",
    ),
  ],
  "kumite-puzzle-broken-timecode": [
    say(
      "undercova",
      "Somebody shifted the ringside clocks. I kept the slips, including every offset.",
    ),
    say(
      "leroy",
      "Put the bell and the ambush back in order. Let the record speak.",
    ),
  ],
  "kumite-puzzle-bone-impact": [
    say(
      "bushedo-brown",
      "The stunt diagram shows five connected cues. Rebuild the chain from floor to fist.",
    ),
    say("leroy", "One clean line. Keep the whole motion together."),
  ],
  "kumite-puzzle-cutman-triage": [
    say(
      "bushedo-brown",
      "The corner crew handles the fighter. You handle the order on this cinema chart.",
    ),
    say(
      "undercova",
      "Bell starts the sequence. Clear the stool at the end. Read what comes between.",
    ),
  ],
  "kumite-puzzle-qi-waveform": [
    say(
      "leroy",
      "Hear the rhythm in the full reel. That gold frame is marked twelve fifty-seven.",
    ),
    say(
      "bushedo-brown",
      "Each chapter starts its own clock. Put the manual's five cues in order.",
    ),
  ],
  "kumite-puzzle-grandmaster-seals": [
    say(
      "bushedo-brown",
      "Five masters, five tiers. Put their fist seals in the Dojo's order.",
    ),
    say(
      "leroy",
      "Study the archive freely. Defeat each master in a real raid to earn their stamp.",
    ),
  ],
};

export const kumiteBreakTheBracketChapter: StoryChapter = {
  id: "kumite-break-the-bracket",
  order: 36,
  title: "Kumite: Break the Bracket",
  subtitle: "Eight contenders. One ambushed bracket. Find the Glo.",
  description:
    "When Sho’Nuff and a two-on-one ambush break the tournament order, Leroy, Bushedo Brown, and Undercova Brotha fight through eight anime episodes to take back the arena.",
  mapAssetId: "assets/kumite/dojo-arena-wide.webp",
  prerequisites: ["block-party"],
  nodes: episodes.flatMap((ep, index): StoryNode[] => {
    const cinematic = film(ep.filmSlug, ep.env ?? "dojo-arena-wide");
    const prerequisites = index ? [episodes[index - 1].id] : [];
    const teaching = {
      tips: ep.tips,
      focusMechanics: ["district control", "Motion timing", "counterplay"],
      focusCards: ep.focusCards,
    };
    const buildNode = (): StoryNode => {
      if (!ep.battle) {
        return {
          id: ep.id,
          kind: ep.finale ? "reward" : "dialogue",
          title: ep.title,
          mapPosition: ep.mapPosition,
          prerequisites,
          optional: false,
          rewards: ep.rewards ?? [],
          teaching,
          cinematic,
          scenes: ep.scenes ?? [],
        };
      }
      const b = ep.battle;
      const encounter: StoryEncounterSnapshot = {
        id: ep.id,
        enemy: {
          id: `${ep.id}:enemy`,
          name: cards[b.opponent].name,
          portraitAssetId: `assets/characters/${cards[b.opponent].id}.webp`,
          deckId: `${ep.id}-deck`,
          cardIds: completeEngineCrew(b.crew),
          behaviorProfile: b.battleType === "boss" ? "combo-boss" : "balanced",
        },
        battlefieldAssetId: cinematic.environmentAssetId,
        cinematic,
        soundHooks,
        roundLimit: b.roundLimit,
        passive: b.passive,
        modifiers: b.modifiers,
        phases: b.phases ?? [],
        starObjectives: b.stars,
      };
      return {
        id: ep.id,
        kind: "battle",
        battleType: b.battleType,
        title: ep.title,
        mapPosition: ep.mapPosition,
        prerequisites,
        optional: false,
        rewards: [
          { kind: "currency", id: "street-xp", amount: 125 + index * 25 },
        ],
        teaching,
        cinematic,
        encounter,
        preDialogue: b.pre,
        postDialogue: b.post,
        starObjectives: b.stars,
        recommendedCollection: KUMITE_SUGGESTED_CREW,
      };
    };
    const node = buildNode();
    const drills = KUMITE_PUZZLES.filter((p) => p.afterEpisode === index);
    return [
      node,
      ...drills.map((puzzle, drill): StoryNode => ({
        id: puzzle.id,
        kind: "dialogue",
        title: puzzle.title,
        mapPosition: [
          [{ x: 19, y: 90 }],
          [{ x: 29, y: 83 }],
          [{ x: 39, y: 75 }],
          [
            { x: 49, y: 67 },
            { x: 58, y: 76 },
          ],
          [{ x: 62, y: 57 }],
          [
            { x: 71, y: 47 },
            { x: 81, y: 50 },
          ],
          [{ x: 88, y: 35 }],
          [{ x: 94, y: 52 }],
        ][index][drill],
        prerequisites: [drill ? drills[drill - 1].id : ep.id],
        optional: true,
        rewards: [{ kind: "currency", id: "street-xp", amount: 50 }],
        teaching: {
          tips: [puzzle.instruction],
          focusMechanics: ["Kumite training"],
          focusCards: ep.focusCards,
        },
        cinematic,
        scenes: trainingScenes[puzzle.id] ?? [
          say("bushedo-brown", puzzle.instruction),
        ],
        puzzle,
      })),
    ];
  }),
};
