import { completeEngineCrew } from './data';
import type { StoryEncounterSnapshot } from './gameEngine';
import type {
  StoryChapter,
  StoryCinematic,
  StoryDialogueLine,
  StoryNode,
  StoryStarObjective,
} from './story';

type Speaker = 'Sherlock' | 'Alice' | 'Promoter' | 'Snitch' | 'Cornball' | 'Alley Runner';

const portraits: Record<Speaker, string> = {
  Sherlock: 'assets/characters/sherlock.webp',
  Alice: 'assets/characters/alice.webp',
  Promoter: 'assets/characters/promoter.webp',
  Snitch: 'assets/characters/snitch.webp',
  Cornball: 'assets/characters/cornball.webp',
  'Alley Runner': 'assets/characters/ganger-blue.webp',
};

const say = (speaker: Speaker, text: string): StoryDialogueLine => ({
  speaker,
  portraitAssetId: portraits[speaker],
  text,
});

const media = 'assets/story/chapter-one/media/standard-clash';
const cinematic = (venue: string): StoryCinematic => ({
  videoAssetId: `${media}.mp4`,
  posterAssetId: 'assets/story/theater/sherlock.webp',
  environmentAssetId: `assets/venues/${venue}.webp`,
});
const soundHooks = {
  intro: 'story.encounter.intro',
  play: 'story.card.play',
  phase: 'story.boss.phase',
  victory: 'story.victory',
  defeat: 'story.defeat',
};
const objectives: readonly StoryStarObjective[] = [
  { id: 'win', description: 'Win the encounter.', criterion: { kind: 'win' } },
  { id: 'outside', description: 'Finish holding both outside districts.', criterion: { kind: 'specific-districts-held', owner: 'player', lanes: [0, 2] } },
  { id: 'motion', description: 'Finish with at least 1 Motion.', criterion: { kind: 'motion-remaining', owner: 'player', atLeast: 1 } },
];
const decks = {
  deduction: ['sherlock', 'alice', 'cornball', 'nerd', 'snow', 'plug', 'hooper'],
  misdirection: ['alice', 'cheshire', 'streamer', 'gamer', 'vibe', 'plug', 'snow'],
  paperwork: ['techbro', 'nerd', 'streamer', 'cornball', 'roaster', 'snow', 'plug'],
} as const;

function battle(
  id: string,
  title: string,
  opponent: Speaker,
  roundLimit: 4 | 5 | 6,
  venue: string,
  deck: readonly string[],
  prerequisites: readonly string[],
  preDialogue: readonly StoryDialogueLine[],
  postDialogue: readonly StoryDialogueLine[],
  mapPosition: { readonly x: number; readonly y: number },
  battleType: 'standard' | 'rule-twist' | 'mini-boss' | 'boss' = 'standard',
): StoryNode {
  const presentation = cinematic(venue);
  const encounter: StoryEncounterSnapshot = {
    id,
    enemy: {
      id: `${id}:enemy`,
      name: opponent,
      portraitAssetId: portraits[opponent],
      deckId: `${id}-deck`,
      cardIds: completeEngineCrew(deck),
      behaviorProfile: battleType === 'boss' ? 'combo-boss' : 'balanced',
    },
    battlefieldAssetId: presentation.environmentAssetId,
    cinematic: presentation,
    soundHooks,
    roundLimit,
    modifiers: {
      startingMotion: { player: 4, cpu: roundLimit === 6 ? 1 : 0 },
      ...(battleType === 'rule-twist'
        ? { laneLocks: [{ round: Math.min(3, roundLimit), owner: 'both' as const, lanes: [1] }] }
        : {}),
    },
    phases: battleType === 'boss'
      ? [{
          id: 'final-deduction',
          name: 'Final Deduction',
          description: 'At round four, the last hidden detail gives the opponent 1 Motion.',
          trigger: { kind: 'round', atLeast: 4 },
          onEnter: [{ kind: 'motion', owner: 'cpu', amount: 1 }],
        }]
      : [],
    starObjectives: objectives,
  };
  return {
    id,
    kind: 'battle',
    battleType,
    title,
    mapPosition,
    prerequisites,
    optional: false,
    rewards: [{ kind: 'currency', id: 'street-xp', amount: roundLimit * 25 }],
    teaching: {
      tips: [`This testimony match lasts ${roundLimit} rounds.`, 'Hold the outside districts while preserving Motion.'],
      focusMechanics: ['specific districts', 'Motion management'],
      focusCards: ['cornball', 'plug', 'hooper'],
    },
    cinematic: presentation,
    encounter,
    preDialogue,
    postDialogue,
    starObjectives: objectives,
    recommendedCollection: ['cornball', 'plug', 'hooper'],
  };
}

const scene = (
  id: string,
  title: string,
  prerequisites: readonly string[],
  scenes: readonly StoryDialogueLine[],
  mapPosition: { readonly x: number; readonly y: number },
  venue = 'corner-store-court',
  rewards: StoryNode['rewards'] = [],
): StoryNode => ({
  id,
  kind: 'reward',
  title,
  mapPosition,
  prerequisites,
  optional: false,
  rewards,
  teaching: {
    tips: ['Read every statement before advancing the investigation.'],
    focusMechanics: ['story investigation'],
    focusCards: ['sherlock'],
  },
  cinematic: cinematic(venue),
  scenes,
});

const missingMotionNodes: readonly StoryNode[] = [
  scene('sherlock-cold-projector', 'The Cold Projector', [], [
    say('Promoter', 'The closing-night reel vanished from a locked canister. The screening starts when that extension cord stops smoking.'),
    say('Sherlock', 'The projector is cold, the lock is unforced, and someone has placed a tiny DO NOT INTERVIEW sign on it.'),
    say('Cornball', 'That sign protects the projector from leading questions. I made it after it ate my coupon.'),
    say('Alice', 'Three suspects, one empty canister, and a popcorn trail shaped exactly like a question mark.'),
    say('Sherlock', 'Then we begin with facts, not punctuation. Nobody leaves with the snack evidence.'),
  ], { x: 8, y: 78 }),
  battle(
    'sherlock-test-the-witness',
    'Test the Witness',
    'Sherlock',
    4,
    'corner-store-court',
    decks.deduction,
    ['sherlock-cold-projector'],
    [say('Sherlock', 'Show me you can hold two facts at once without decorating either one.')],
    [
      say('Sherlock', 'Good. The circular dust mark proves the reel left the canister, but never reached this projector.'),
      say('Cornball', 'So the machine is innocent. Please remove its little sign before it gets management ideas.'),
    ],
    { x: 31, y: 60 },
    'standard',
  ),
  battle(
    'sherlock-alices-alibi-maze',
    "Alice's Alibi Maze",
    'Alice',
    5,
    'civic-hill-climb',
    decks.misdirection,
    ['sherlock-test-the-witness'],
    [
      say('Alice', 'I found three delivery routes, four contradictory arrows, and one arrow pointing directly at itself.'),
      say('Alley Runner', 'The straight route was blocked by a cardboard moon. I delivered the empty travel case and got a signed receipt.'),
    ],
    [
      say('Alice', 'The receipt time is before the reel vanished. Alley delivered an empty case, not the film.'),
      say('Sherlock', 'And blue carbon dust on its handle matches a booking clipboard. Our mystery has paperwork.'),
    ],
    { x: 63, y: 38 },
    'rule-twist',
  ),
  scene('sherlock-three-bad-alibis', 'Three Bad Alibis', ['sherlock-alices-alibi-maze'], [
    say('Snitch', 'My alibi is a six-hour livestream with only two unexplained commercial breaks.'),
    say('Cornball', 'Mine is a vending receipt. It charged me twice, so legally I was there twice.'),
    say('Promoter', 'I was fixing the premiere schedule. Alone. With my blue-carbon clipboard.'),
    say('Sherlock', 'Snitch had opportunity, Cornball handled the canister, and Promoter has supplied both motive and stationery.'),
    say('Alice', 'Excellent. We have narrowed it down to everybody except the projector.'),
  ], { x: 91, y: 15 }, 'civic-hill-climb', [
    { kind: 'pack-ticket', id: 'street-pack-ticket', amount: 2 },
  ]),
];

const falseBottomNodes: readonly StoryNode[] = [
  scene('sherlock-prop-room-inventory', 'The Prop Room Inventory', [], [
    say('Sherlock', 'The booking ledger lists one film canister, one trophy plinth, and seven ceremonial fog machines.'),
    say('Alice', 'There are eight fog machines. The extra one says NOT A HIDING PLACE in fresh marker.'),
    say('Promoter', 'Prop labels are aspirational. Please stop reading them as evidence.'),
    say('Cornball', 'The trophy also rattles, but I assumed that was applause stored for later.'),
  ], { x: 7, y: 80 }, 'harbor-skyline-court'),
  battle(
    'sherlock-snitchs-exclusive',
    "Snitch's Exclusive",
    'Snitch',
    5,
    'harbor-skyline-court',
    decks.paperwork,
    ['sherlock-prop-room-inventory'],
    [say('Snitch', 'I will surrender my uncut hallway feed after one exclusive testimony match.')],
    [
      say('Snitch', 'Fine. The feed shows Promoter carrying the plinth after the power-cut notice went up.'),
      say('Sherlock', 'It also shows you adding dramatic thunder in post. Fortunately, thunder has no evidentiary weight.'),
    ],
    { x: 30, y: 61 },
    'standard',
  ),
  {
    ...scene('sherlock-evidence-order', 'Put the Evidence in Order', ['sherlock-snitchs-exclusive'], [
      say('Sherlock', 'Sequence before accusation. Arrange what happened, not what makes the best trailer.'),
      say('Alice', 'I have pinned the evidence low enough for everyone except the trophy to inspect it.'),
    ], { x: 55, y: 44 }, 'harbor-skyline-court', [
      { kind: 'currency', id: 'street-xp', amount: 125 },
    ]),
    puzzle: {
      id: 'sherlock-missing-reel-sequence',
      title: 'The Reel Timeline',
      instruction: 'Arrange the evidence from earliest to latest.',
      imageAssetId: 'assets/story/theater/evidence.webp',
      pieces: [
        { id: 'power-notice', label: 'Power-cut notice', detail: 'Posted before the prop room was opened.' },
        { id: 'empty-case', label: 'Empty case receipt', detail: 'Alley Runner delivered an empty travel case.' },
        { id: 'hallway-frame', label: 'Hallway frame', detail: 'Promoter moved the trophy plinth after the delivery.' },
        { id: 'leader-strip', label: 'Film leader strip', detail: 'Found under the plinth after it began to rattle.' },
      ],
      solution: ['power-notice', 'empty-case', 'hallway-frame', 'leader-strip'],
      hints: [
        'The posted notice came before anyone entered the prop room.',
        'The case was already empty when Alley Runner delivered it.',
      ],
      solvedText: 'The plinth moved only after the empty case arrived. The reel was hidden inside its false bottom.',
      skipText: 'Sherlock orders the timestamps himself. The trail still leads to the trophy plinth.',
    },
  },
  battle(
    'sherlock-false-bottom-fade',
    'The False-Bottom Fade',
    'Promoter',
    6,
    'crown-rooftop-court',
    decks.paperwork,
    ['sherlock-evidence-order'],
    [
      say('Promoter', 'Before anybody opens that trophy, I request one dignified match and no close-ups.'),
      say('Alice', 'The trophy has already requested the opposite by rattling during your sentence.'),
    ],
    [
      say('Promoter', 'The false bottom is mine. The reel is safe inside, wrapped in the schedule I was correcting.'),
      say('Sherlock', 'Safe is not the same as returned. We still require the reason.'),
    ],
    { x: 78, y: 25 },
    'mini-boss',
  ),
  scene('sherlock-reel-in-the-trophy', 'The Reel in the Trophy', ['sherlock-false-bottom-fade'], [
    say('Cornball', 'The trophy contained no applause. It did contain one reel and a shocking amount of tape.'),
    say('Sherlock', 'Fresh blue carbon on the false panel matches Promoter’s clipboard. The hiding place and its maker agree.'),
    say('Promoter', 'I borrowed it. I planned to fix one title card and put it back before the lights returned.'),
    say('Alice', 'A confession with an intermission. Save the motive for the final reel.'),
  ], { x: 94, y: 9 }, 'crown-rooftop-court', [
    { kind: 'pack-ticket', id: 'street-pack-ticket', amount: 2 },
  ]),
];

const lastReelNodes: readonly StoryNode[] = [
  scene('sherlock-impossible-date', 'The Impossible Date', [], [
    say('Sherlock', 'The removed title card advertises the premiere on Tuesday, February thirty-first.'),
    say('Promoter', 'It went to print during a very emotional lunch. I needed one quiet hour to replace it.'),
    say('Snitch', 'You manufactured a reel theft to avoid a typo reveal. That is premium behavior.'),
    say('Alice', 'Not theft for profit, then. Theft from embarrassment, with stationery.'),
  ], { x: 7, y: 79 }, 'red-fence-night-court'),
  battle(
    'sherlock-cornballs-reconstruction',
    "Cornball's Reconstruction",
    'Cornball',
    4,
    'red-fence-night-court',
    decks.deduction,
    ['sherlock-impossible-date'],
    [
      say('Cornball', 'I will reconstruct the canister handoff using cups, string, and this unsweetened sparkling water.'),
      say('Sherlock', 'Or we can play one short match and preserve the cups.'),
    ],
    [
      say('Cornball', 'Reconstruction complete. Promoter asked me for the key, then returned it under the water receipt.'),
      say('Sherlock', 'That explains the unforced lock and your fingerprints without making you the thief.'),
    ],
    { x: 32, y: 59 },
    'rule-twist',
  ),
  battle(
    'sherlock-final-deduction',
    'The Final Deduction',
    'Promoter',
    6,
    'crown-rooftop-court',
    decks.paperwork,
    ['sherlock-cornballs-reconstruction'],
    [
      say('Sherlock', 'The reel, the key, the false panel, and the impossible date now tell one story.'),
      say('Promoter', 'Then give me one final table before you tell it to everybody with tickets.'),
    ],
    [
      say('Promoter', 'I took the reel to replace the date. The power returned early, so I hid it and pretended the canister had arrived empty.'),
      say('Sherlock', 'A small mistake became a mystery because you recruited a locked box to lie for you.'),
    ],
    { x: 61, y: 38 },
    'boss',
  ),
  scene('sherlock-the-missing-motion', 'The Missing Motion', ['sherlock-final-deduction'], [
    say('Sherlock', 'Promoter borrowed the reel, hid it in the plinth, and blamed the delivery window. Every clue was mundane; only the panic wore a cape.'),
    say('Promoter', 'I will announce the typo, credit Alley’s receipt, and screen the reel untouched.'),
    say('Snitch', 'My headline is now LOCAL DATE FOUND INNOCENT. The calendar has declined comment.'),
    say('Alice', 'Lights down. Mystery over. Someone move the eighth fog machine before it develops an alibi.'),
    say('Cornball', 'And the projector’s interview ban?'),
    say('Sherlock', 'Lifted. It has been cleared of all charges except chewing coupons.'),
  ], { x: 87, y: 19 }, 'crown-rooftop-court'),
  scene('sherlock-curtain-call', 'Curtain Call', ['sherlock-the-missing-motion'], [
    say('Promoter', 'The corrected title card is on screen, the reel is home, and every borrowed item is in the public inventory.'),
    say('Sherlock', 'Then our fee is simple: keep the evidence board available and the screening open to the block.'),
    say('Alice', 'Also keep one fog machine. A curtain call should look faintly suspicious.'),
  ], { x: 96, y: 7 }, 'crown-rooftop-court', [
    { kind: 'card', id: 'sherlock', amount: 1 },
    { kind: 'pack-ticket', id: 'street-pack-ticket', amount: 5 },
    { kind: 'currency', id: 'street-xp', amount: 300 },
  ]),
];

export const specialPresentationChapters: readonly StoryChapter[] = [
  {
    id: 'special-sherlock-missing-motion',
    order: 17,
    title: 'The Missing Motion, Part I',
    subtitle: 'The canister is empty. The alibis are full.',
    description: 'Sherlock tests three terrible alibis after a closing-night film reel disappears.',
    mapAssetId: 'assets/story/theater/evidence.webp',
    prerequisites: ['block-party'],
    nodes: missingMotionNodes,
  },
  {
    id: 'special-sherlock-false-bottom',
    order: 18,
    title: 'The Missing Motion, Part II',
    subtitle: 'Every trophy has a story. This one rattles.',
    description: 'A hallway recording and an evidence timeline lead to a false-bottom prop.',
    mapAssetId: 'assets/story/theater/evidence.webp',
    prerequisites: ['special-sherlock-missing-motion'],
    nodes: falseBottomNodes,
  },
  {
    id: 'special-sherlock-last-reel',
    order: 19,
    title: 'The Missing Motion, Part III',
    subtitle: 'The impossible date gives up the culprit.',
    description: 'The crew reconstructs the theft, earns a confession, and saves the screening.',
    mapAssetId: 'assets/story/theater/evidence.webp',
    prerequisites: ['special-sherlock-false-bottom'],
    nodes: lastReelNodes,
  },
];