import type { StoryPuzzleDefinition } from "./storyPuzzles";

/** Fictional arcade training props. Completion and rewards use the existing server puzzle contract. */
export const KUMITE_PUZZLES: readonly (StoryPuzzleDefinition & {
  readonly afterEpisode: number;
})[] = [
  {
    id: "kumite-puzzle-reach-matrix",
    afterEpisode: 0,
    title: "Tale of the Tape Reach Matrix",
    instruction:
      "Seed the four bouts from reach gap to mirror guard, then the gold/red angle.",
    imageAssetId: "assets/story/puzzles/kumite/reach-matrix.webp",
    presentation: {
      theme: "kumite",
      layout: "manual",
      slotLabels: ["1", "2", "3", "4"],
    },
    pieces: [
      {
        id: "quarter-c",
        label: "Quarterfinal C",
        detail: "Bushedo Brown / Undercova · orthodox mirror",
      },
      {
        id: "quarter-d",
        label: "Quarterfinal D",
        detail: "Leroy / Sho’Nuff · gold against red",
      },
      {
        id: "quarter-a",
        label: "Quarterfinal A",
        detail: "Chonk Lee / Dragonfly Jones · widest reach gap",
      },
      {
        id: "quarter-b",
        label: "Quarterfinal B",
        detail: "Franklin Duke / P. Tang · power against belt range",
      },
    ],
    solution: ["quarter-a", "quarter-b", "quarter-c", "quarter-d"],
    hints: [
      "Read the tape: widest gap, belt range, orthodox mirror, gold/red.",
    ],
    solvedText: "Technique logged. The next bout is ready.",
    skipText: "Training skipped. You can return to this manual.",
  },
  {
    id: "kumite-puzzle-meridian-map",
    afterEpisode: 1,
    title: "Dim Mak Meridian Map",
    instruction: "Arrange the five fictional strike cues to open the guard.",
    imageAssetId: "assets/story/puzzles/kumite/meridian-map.webp",
    presentation: {
      theme: "kumite",
      layout: "manual",
      slotLabels: ["1", "2", "3", "4", "5"],
    },
    pieces: [
      {
        id: "liver-hook",
        label: "Liver Hook",
        detail: "Turn the torso toward the open lane.",
      },
      {
        id: "solar-plexus",
        label: "Solar Plexus",
        detail: "Break the central iron guard.",
      },
      {
        id: "carotid-gate",
        label: "Carotid Gate",
        detail: "Finish the fictional cinema combination.",
      },
      {
        id: "brachial-knot",
        label: "Brachial Knot",
        detail: "Open the lead arm guard.",
      },
      {
        id: "floating-rib",
        label: "Floating Rib",
        detail: "Draw the elbow away from the body.",
      },
    ],
    solution: [
      "brachial-knot",
      "floating-rib",
      "liver-hook",
      "solar-plexus",
      "carotid-gate",
    ],
    hints: ["Arm opens; elbow lifts; body turns; center breaks; gate opens."],
    solvedText: "Technique logged. The next bout is ready.",
    skipText: "Training skipped. You can return to this manual.",
  },
  {
    id: "kumite-puzzle-glo-conduit",
    afterEpisode: 2,
    title: "7-Chakra · Find the Glo",
    instruction:
      "Connect the fictional Glo chain from floor to finishing uppercut.",
    imageAssetId: "assets/story/puzzles/kumite/glo-conduit.webp",
    presentation: {
      theme: "kumite",
      layout: "manual",
      slotLabels: ["1", "2", "3", "4", "5", "6", "7"],
    },
    pieces: [
      {
        id: "solar-core",
        label: "Solar · Core",
        detail: "Drive through the center.",
      },
      {
        id: "heart-rhythm",
        label: "Heart · Rhythm",
        detail: "Set an even pulse.",
      },
      {
        id: "throat-kiai",
        label: "Throat · Kiai",
        detail: "Release the breath.",
      },
      {
        id: "third-eye-read",
        label: "Third Eye · Read",
        detail: "Read the opening.",
      },
      {
        id: "crown-glo",
        label: "Glo · Finish",
        detail: "Carry the chain through the uppercut.",
      },
      { id: "root-stance", label: "Root · Stance", detail: "Plant both feet." },
      {
        id: "sacral-hip-torque",
        label: "Sacral · Hip Torque",
        detail: "Turn from the hips.",
      },
    ],
    solution: [
      "root-stance",
      "sacral-hip-torque",
      "solar-core",
      "heart-rhythm",
      "throat-kiai",
      "third-eye-read",
      "crown-glo",
    ],
    hints: [
      "Feet, hips, core, pulse, breath, read, Glo. The top seal is a fist.",
    ],
    solvedText: "Technique logged. The next bout is ready.",
    skipText: "Training skipped. You can return to this manual.",
  },
  {
    id: "kumite-puzzle-five-form-manual",
    afterEpisode: 3,
    title: "5-Form Kung Fu Manual",
    instruction:
      "Read the five feints in order: high straight, reach, chest drive, short hook, low rush.",
    imageAssetId: "assets/story/puzzles/kumite/five-form-manual.webp",
    presentation: {
      theme: "kumite",
      layout: "manual",
      slotLabels: ["1", "2", "3", "4", "5"],
    },
    pieces: [
      {
        id: "tiger",
        label: "Tiger Palm Check",
        detail: "Chest drive → meet the center.",
      },
      {
        id: "mantis",
        label: "Mantis Elbow Trap",
        detail: "Short hook → fold the elbow.",
      },
      {
        id: "root",
        label: "Iron Sweeping Root",
        detail: "Low rush → settle and sweep.",
      },
      {
        id: "crane",
        label: "Crane Wing Deflect",
        detail: "High straight feint → lift outward.",
      },
      {
        id: "serpent",
        label: "Serpent Wrist Lock",
        detail: "Reaching hand → wrap the wrist.",
      },
    ],
    solution: ["crane", "serpent", "tiger", "mantis", "root"],
    hints: ["Each form’s counter names the opening it answers."],
    solvedText: "Technique logged. The next bout is ready.",
    skipText: "Training skipped. You can return to this manual.",
  },
  {
    id: "kumite-puzzle-wooden-dummy",
    afterEpisode: 3,
    title: "Shaolin Wooden Dummy",
    instruction:
      "Alternate hands through upper, middle, lower, upper, middle, sweep.",
    imageAssetId: "assets/story/puzzles/kumite/wooden-dummy.webp",
    presentation: {
      theme: "kumite",
      layout: "manual",
      slotLabels: ["1", "2", "3", "4", "5", "6"],
    },
    pieces: [
      {
        id: "left-low",
        label: "Left · Lower Gate",
        detail: "Lead left under the lower arm.",
      },
      {
        id: "right-high",
        label: "Right · Upper Return",
        detail: "Lead right at the upper arm.",
      },
      {
        id: "left-mid",
        label: "Left · Middle Return",
        detail: "Lead left through the center.",
      },
      {
        id: "right-sweep",
        label: "Right · Sweep Peg",
        detail: "Lead right past the sweep peg.",
      },
      {
        id: "left-high",
        label: "Left · Upper Gate",
        detail: "Lead left at the upper arm.",
      },
      {
        id: "right-mid",
        label: "Right · Middle Gate",
        detail: "Lead right through the center.",
      },
    ],
    solution: [
      "left-high",
      "right-mid",
      "left-low",
      "right-high",
      "left-mid",
      "right-sweep",
    ],
    hints: ["No repeated lead hand: L R L R L R."],
    solvedText: "Technique logged. The next bout is ready.",
    skipText: "Training skipped. You can return to this manual.",
  },
  {
    id: "kumite-puzzle-broken-timecode",
    afterEpisode: 4,
    title: "Broken Bracket Timecode",
    instruction: "Subtract each logged offset and restore the bout chronology.",
    imageAssetId: "assets/story/puzzles/kumite/broken-timecode.webp",
    presentation: {
      theme: "kumite",
      layout: "manual",
      slotLabels: ["1", "2", "3", "4", "5"],
    },
    pieces: [
      {
        id: "interference",
        label: "Corridor Interference",
        detail: "Log 01:22 · offset +00:02 → real 01:20",
      },
      {
        id: "ambush",
        label: "Red-Light Ambush",
        detail: "Log 01:58 · offset -00:02 → real 02:00",
      },
      {
        id: "reset",
        label: "Officials Reset",
        detail: "Log 02:51 · offset +00:11 → real 02:40",
      },
      {
        id: "bell",
        label: "Opening Bell",
        detail: "Log 00:12 · offset +00:12 → real 00:00",
      },
      {
        id: "feint",
        label: "First Feint",
        detail: "Log 00:49 · offset +00:09 → real 00:40",
      },
    ],
    solution: ["bell", "feint", "interference", "ambush", "reset"],
    hints: ["Negative offsets mean the rigged clock was behind."],
    solvedText: "Technique logged. The next bout is ready.",
    skipText: "Training skipped. You can return to this manual.",
  },
  {
    id: "kumite-puzzle-bone-impact",
    afterEpisode: 5,
    title: "Bone-Impact X-Ray",
    instruction:
      "Calibrate the game’s five-link strike chain from floor to fist.",
    imageAssetId: "assets/story/puzzles/kumite/bone-impact.webp",
    presentation: {
      theme: "kumite",
      layout: "manual",
      slotLabels: ["1", "2", "3", "4", "5"],
    },
    pieces: [
      {
        id: "scapula",
        label: "Scapular Lock",
        detail: "Set the shoulder blade.",
      },
      {
        id: "forearm",
        label: "Radius / Ulna Rotation",
        detail: "Turn the forearm into line.",
      },
      {
        id: "knuckle",
        label: "Metacarpal Alignment",
        detail: "Finish with a straight fictional impact line.",
      },
      { id: "heel", label: "Heel Plant", detail: "Anchor to the floor." },
      {
        id: "hip",
        label: "Hip Turn",
        detail: "Transfer the push through the pelvis.",
      },
    ],
    solution: ["heel", "hip", "scapula", "forearm", "knuckle"],
    hints: ["Plant, turn, set, rotate, align."],
    solvedText: "Technique logged. The next bout is ready.",
    skipText: "Training skipped. You can return to this manual.",
  },
  {
    id: "kumite-puzzle-cutman-triage",
    afterEpisode: 5,
    title: "Cutman Triage",
    instruction: "Order this fictional between-round corner sequence.",
    imageAssetId: "assets/story/puzzles/kumite/cutman-triage.webp",
    presentation: {
      theme: "kumite",
      layout: "manual",
      slotLabels: ["1", "2", "3", "4", "5"],
    },
    pieces: [
      {
        id: "swab",
        label: "Brow Swab",
        detail: "Game cue: address the split brow next.",
      },
      {
        id: "tape",
        label: "Rib Tape",
        detail: "Game cue: stabilize the bruised ribs.",
      },
      {
        id: "clear",
        label: "Clear the Stool",
        detail: "Return before the sixty-second bell.",
      },
      {
        id: "bell",
        label: "Corner Bell",
        detail: "The clock starts; assess the illustrated fighter.",
      },
      {
        id: "cold",
        label: "Cold Iron",
        detail: "Game cue: orbital swelling first.",
      },
    ],
    solution: ["bell", "cold", "swab", "tape", "clear"],
    hints: [
      "Bell → swelling → brow → ribs → clear. This is a cinema game, not treatment guidance.",
    ],
    solvedText: "Technique logged. The next bout is ready.",
    skipText: "Training skipped. You can return to this manual.",
  },
  {
    id: "kumite-puzzle-qi-waveform",
    afterEpisode: 6,
    title: "Qi Waveform Synchronizer",
    instruction:
      "Align breath, crest, descent, trough and release with the 12:57 film cue.",
    imageAssetId: "assets/story/puzzles/kumite/qi-waveform.webp",
    presentation: {
      theme: "kumite",
      layout: "manual",
      slotLabels: ["1", "2", "3", "4", "5"],
    },
    pieces: [
      {
        id: "exhale",
        label: "Exhale · 6 Beats",
        detail: "Let the wave descend slowly.",
      },
      {
        id: "settle",
        label: "Settle · 1 Beat",
        detail: "Find the quiet trough.",
      },
      {
        id: "release",
        label: "Release · 12:57",
        detail: "Land on the gold impact marker.",
      },
      {
        id: "inhale",
        label: "Inhale · 4 Beats",
        detail: "Start the smooth gold wave.",
      },
      { id: "hold", label: "Retain · 2 Beats", detail: "Hold an even crest." },
    ],
    solution: ["inhale", "hold", "exhale", "settle", "release"],
    hints: ["4 in, 2 held, 6 out, 1 still, then the gold cue."],
    solvedText: "Technique logged. The next bout is ready.",
    skipText: "Training skipped. You can return to this manual.",
  },
  {
    id: "kumite-puzzle-grandmaster-seals",
    afterEpisode: 7,
    title: "5-Grandmaster Seal Scroll",
    instruction: "Place all five fist seals in the Dojo’s tier order.",
    imageAssetId: "assets/story/puzzles/kumite/grandmaster-seals.webp",
    presentation: {
      theme: "kumite",
      layout: "manual",
      slotLabels: ["1", "2", "3", "4", "5"],
    },
    pieces: [
      { id: "franklin", label: "Franklin Duke", detail: "Tier III · Reach" },
      { id: "bushedo", label: "Bushedo Brown", detail: "Tier IV · Technique" },
      { id: "shonuff", label: "Sho’Nuff", detail: "Tier V · Red Glo" },
      { id: "chonk", label: "Chonk Lee", detail: "Tier I · Root" },
      { id: "dragonfly", label: "Dragonfly Jones", detail: "Tier II · Read" },
    ],
    solution: ["chonk", "dragonfly", "franklin", "bushedo", "shonuff"],
    hints: ["Root, read, reach, technique, Red Glo."],
    solvedText: "Technique logged. The next bout is ready.",
    skipText: "Training skipped. You can return to this manual.",
  },
];
