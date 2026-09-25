import { cards, completeEngineCrew } from "./data";
import type {
  StoryChapter,
  StoryNode,
  StoryDialogueLine,
  StoryStarObjective,
} from "./story";
import type { StoryPuzzleDefinition } from "./storyPuzzles";

type Speech = readonly [string, string];
type Beat = {
  id: string;
  title: string;
  lines: Speech[];
  fight?: string[];
  after?: Speech[];
  puzzle?: StoryPuzzleDefinition;
  reward?: string;
  twist?: "outside" | "reserve" | "reinforce";
};
const speak = ([id, text]: Speech): StoryDialogueLine => ({
  speaker: cards[id]?.name ?? id,
  portraitAssetId: `assets/characters/${cards[id]?.id ?? "cornball"}.webp`,
  text,
});
const objectives: StoryStarObjective[] = [
  { id: "win", description: "Win the encounter.", criterion: { kind: "win" } },
  {
    id: "outside",
    description: "Finish holding both outside districts.",
    criterion: {
      kind: "specific-districts-held",
      owner: "player",
      lanes: [0, 2],
    },
  },
  {
    id: "motion",
    description: "Finish with at least 1 Motion.",
    criterion: { kind: "motion-remaining", owner: "player", atLeast: 1 },
  },
];
// The same ordered slots support timelines, matching, ciphers and connected routes.
// Pieces begin scrambled. All clues needed for the unique solution are in the puzzle.
function puzzle(
  id: string,
  title: string,
  instruction: string,
  pieces: [string, string][],
  hints: string[],
  solvedText: string,
): StoryPuzzleDefinition {
  const ordered = pieces.map(([label, detail], index) => ({
    id: `${id}-${index}`,
    label,
    detail,
  }));
  return {
    id,
    title,
    instruction,
    imageAssetId: "assets/story/theater/evidence.webp",
    pieces: [...ordered.slice(2), ...ordered.slice(0, 2)].reverse(),
    solution: ordered.map((piece) => piece.id),
    hints,
    solvedText,
    skipText:
      "Your crew reconstructs the answer with you. The story and its rewards continue.",
  };
}
function chapter(
  id: string,
  order: number,
  title: string,
  subtitle: string,
  lead: string,
  prerequisite: string,
  beats: Beat[],
  venue = "corner-store-court",
): StoryChapter {
  return {
    id,
    order,
    title,
    subtitle,
    description: subtitle,
    mapAssetId: `assets/venues/${venue}.webp`,
    prerequisites: [prerequisite],
    nodes: beats.map((beat, index): StoryNode => {
      const nodeId = `${id}-${beat.id}`;
      const cinematic = {
        videoAssetId: "assets/story/chapter-one/media/standard-clash.mp4",
        posterAssetId: ["alice", "inmate-crafty"].includes(lead)
          ? `assets/characters/${cards[lead].id}.webp`
          : `assets/cosmetics/${cards[lead].id}/deck-cover-v3.webp`,
        environmentAssetId: `assets/venues/${venue}.webp`,
      };
      const common = {
        id: nodeId,
        title: beat.title,
        mapPosition: {
          x: 8 + (index / Math.max(1, beats.length - 1)) * 84,
          y:
            78 -
            (index / Math.max(1, beats.length - 1)) * 60 +
            (index % 2 ? -8 : 6),
        },
        prerequisites: index ? [`${id}-${beats[index - 1].id}`] : [],
        optional: false,
        cinematic,
        teaching: {
          tips: [
            beat.puzzle
              ? "Read the clues, arrange the pieces, and use hints whenever you need them."
              : "Read the district rules before committing your Motion.",
          ],
          focusMechanics: [beat.puzzle ? "deduction" : "district control"],
          focusCards: [lead],
        },
        rewards: beat.reward
          ? [
              { kind: "card" as const, id: beat.reward, amount: 1 },
              {
                kind: "pack-ticket" as const,
                id: "street-pack-ticket",
                amount: 2,
              },
              { kind: "currency" as const, id: "street-xp", amount: 200 },
            ]
          : beat.fight
            ? [{ kind: "currency" as const, id: "street-xp", amount: 100 }]
            : [],
      };
      if (!beat.fight)
        return {
          ...common,
          kind: beat.reward ? "reward" : "dialogue",
          scenes: beat.lines.map(speak),
          ...(beat.puzzle ? { puzzle: beat.puzzle } : {}),
        };
      const boss = beat.twist === "reinforce";
      return {
        ...common,
        kind: "battle",
        battleType: boss ? "boss" : beat.twist ? "rule-twist" : "standard",
        preDialogue: beat.lines.map(speak),
        postDialogue: (beat.after ?? []).map(speak),
        starObjectives: objectives,
        recommendedCollection: ["cornball", "plug", "drfade"],
        encounter: {
          id: nodeId,
          enemy: {
            id: `${nodeId}-rival`,
            name: cards[beat.fight[0]].name,
            portraitAssetId: `assets/characters/${cards[beat.fight[0]].id}.webp`,
            deckId: `${nodeId}-crew`,
            cardIds: completeEngineCrew(beat.fight),
            behaviorProfile: boss ? "combo-boss" : "balanced",
          },
          cinematic,
          battlefieldAssetId: cinematic.environmentAssetId,
          soundHooks: {
            intro: "story.encounter.intro",
            play: "story.card.play",
            phase: "story.boss.phase",
            victory: "story.victory",
            defeat: "story.defeat",
          },
          passive: {
            name: beat.title,
            description:
              beat.twist === "outside"
                ? "The center district closes to new plays in round three."
                : beat.twist === "reserve"
                  ? "Both sides receive 1 less Motion in round three."
                  : boss
                    ? "At round four, the rival gains 1 Motion."
                    : "Control two districts when the final round ends.",
          },
          roundLimit: boss ? 6 : 5,
          starObjectives: objectives,
          modifiers: {
            startingMotion: { player: 3, cpu: 1 },
            ...(beat.twist === "outside"
              ? {
                  laneLocks: [
                    { round: 3, owner: "both" as const, lanes: [1] as [1] },
                  ],
                }
              : {}),
            ...(beat.twist === "reserve"
              ? {
                  roundMotionDeltas: [
                    { round: 3, owner: "player" as const, amount: -1 },
                    { round: 3, owner: "cpu" as const, amount: -1 },
                  ],
                }
              : {}),
          },
          phases: boss
            ? [
                {
                  id: "second-wind",
                  name: "The last word",
                  description:
                    "The rival gains 1 Motion at the start of round four.",
                  trigger: { kind: "round", atLeast: 4 },
                  onEnter: [{ kind: "motion", owner: "cpu", amount: 1 }],
                },
              ]
            : [],
        },
      };
    }),
  };
}

const sherlockClock = chapter(
  "sherlock-thirteenth-bell",
  20,
  "The Thirteenth Bell",
  "A station clock strikes thirteen. A missing passenger never boarded.",
  "sherlock",
  "special-sherlock-last-reel",
  [
    {
      id: "ticket",
      title: "A Ticket With No Journey",
      lines: [
        [
          "watson",
          "The projectionist sent a thank-you. Inside it: a train ticket stamped tomorrow, a brass bell, and a bill addressed to nobody.",
        ],
        [
          "sherlock",
          "A new client. Either exceptionally punctual or profoundly lost.",
        ],
        [
          "cornball",
          "I charge extra for tomorrow. My calendar calls it surge pricing.",
        ],
      ],
    },
    {
      id: "platform",
      title: "Platform Zero",
      lines: [
        [
          "delivery",
          "My parcel rode a train that does not stop here. Dispatch says I signed for it while I was in the shower.",
        ],
        ["watson", "We need your route, not your shampoo."],
        ["delivery", "Both contain important stops."],
      ],
    },
    {
      id: "clocks",
      title: "Three Clocks, One Minute",
      lines: [
        [
          "sherlock",
          "The station is seven minutes fast. The bakery is four minutes slow. The river bell keeps real time. Correct the clocks before accusing anyone.",
        ],
      ],
      puzzle: puzzle(
        "sherlock-clocks",
        "Correct the witness clocks",
        "Arrange events from earliest to latest in real time. Station clocks run 7 minutes fast; bakery clocks run 4 minutes slow; the river clock is correct.",
        [
          [
            "Bakery shutter: 8:56",
            "The baker sees the shutter open on the bakery clock.",
          ],
          ["River bell: 9:02", "Watson hears the bell at the river."],
          [
            "Station gate: 9:11",
            "The guard stamps the gate log using station time.",
          ],
          ["Bakery van: 9:01", "A van leaves beside the bakery clock."],
          [
            "Station whistle: 9:14",
            "The whistle sounds under the station clock.",
          ],
        ],
        [
          "Add four minutes to bakery times; subtract seven from station times.",
          "Real times are 9:00, 9:02, 9:04, 9:05, and 9:07.",
        ],
        "The van left before the whistle. The parcel traveled by road, not rail.",
      ),
    },
    {
      id: "guard",
      title: "The Guard’s Challenge",
      lines: [
        [
          "sherlock",
          "The guard will let us inspect the public locker after a friendly fade. The logbook remains evidence whatever the score.",
        ],
      ],
      fight: ["landlord", "watson", "cornball", "plug", "scarecrow", "tinman"],
      twist: "outside",
      after: [
        ["watson", "Locker nine is empty, but its handle is coated in flour."],
        ["cornball", "Finally, a suspect with a crust."],
      ],
    },
    {
      id: "route",
      title: "A Route That Cannot Double Back",
      lines: [
        [
          "delivery",
          "The cart has one broken wheel. It can only follow the chalk arrows.",
        ],
      ],
      puzzle: puzzle(
        "sherlock-route",
        "Follow the one-way delivery",
        "Build a continuous route from station to river, using every location once. Each card names its only outgoing connection.",
        [
          ["Station", "The chalk arrow points to the bakery."],
          ["Bakery", "Its loading ramp connects only to the laundromat."],
          ["Laundromat", "The back alley exits at the clock tower."],
          ["Clock tower", "The service passage leads to the ticket kiosk."],
          ["Ticket kiosk", "The ramp ends at the river."],
          ["River", "The wheel tracks stop here."],
        ],
        [
          "Start at the station and follow the named connections.",
          "The laundromat sits between bakery and clock tower.",
        ],
        "A road delivery reached the river kiosk. The train ticket was packaging, not a passenger record.",
      ),
    },
    {
      id: "interview",
      title: "The Missing Passenger Speaks",
      lines: [
        [
          "homelessguy",
          "You keep asking where the passenger went. Passenger is the name painted on my cart. Somebody borrowed it.",
        ],
        ["sherlock", "A proper noun disguised as a person."],
        [
          "homelessguy",
          "It is a very good cart. You can apologize to it directly.",
        ],
      ],
    },
    {
      id: "bell",
      title: "Thirteen Is a Serial Number",
      lines: [
        [
          "watson",
          "The brass bell is stamped 13 underneath. The clerk copied that into the time column.",
        ],
        [
          "sherlock",
          "A wrong column created an impossible journey. Now we find who benefited from the confusion.",
        ],
      ],
    },
    {
      id: "receipt",
      title: "Hold the Loading Dock",
      lines: [
        [
          "delivery",
          "The kiosk owner challenges us for the first delivery slot. Win the slot; then we can weigh the disputed parcel together.",
        ],
      ],
      fight: ["delivery", "landlord", "nguyen", "bikelife", "plug", "watson"],
      after: [
        [
          "watson",
          "Empty parcel. The owner billed the same delivery twice and hid the duplicate behind the clock error.",
        ],
        [
          "sherlock",
          "Return the fee, correct the log, and return Passenger. In that order.",
        ],
      ],
    },
    {
      id: "return",
      title: "Passenger Arrives Home",
      lines: [
        [
          "homelessguy",
          "New wheel, corrected invoice, apology to the cart. You are learning.",
        ],
        [
          "sherlock",
          "The mystery began with a fictional passenger and ended with a real debt.",
        ],
        ["watson", "Another envelope. This one is humming."],
        ["cornball", "I do not accept musical invoices."],
      ],
    },
  ],
);
const sherlockSignal = chapter(
  "sherlock-dead-air",
  21,
  "Dead Air, Live Alibis",
  "An impossible radio voice interrupts the neighborhood every night.",
  "sherlock",
  sherlockClock.id,
  [
    {
      id: "voice",
      title: "The Voice at 11:03",
      lines: [
        [
          "streamer",
          "My radio says my private nickname at eleven-oh-three. I never put that nickname online.",
        ],
        ["watson", "Your show opens with a song titled that nickname."],
        ["streamer", "Art should not be used against artists."],
      ],
    },
    {
      id: "tape",
      title: "The Reversed Warning",
      lines: [
        [
          "sherlock",
          "The warning is recorded backward. Listen to the marked segments, then restore the sentence.",
        ],
      ],
      puzzle: puzzle(
        "sherlock-tape",
        "Decode the tape splice",
        "Each label is a word written backward. Decode them and arrange a grammatical instruction beginning with FIND. The hidden room is the last two words.",
        [
          ["DNIF", "The opening verb."],
          ["EHT", "The article before the object."],
          ["YEK", "A small object that opens a lock."],
          ["REDNU", "A location word."],
          ["OIDUTS", "The first word of the room’s name."],
          ["EERHT", "The room number."],
        ],
        [
          "Read each word from right to left.",
          "Find the key under Studio Three.",
        ],
        "FIND THE KEY UNDER STUDIO THREE. The broadcast is a scavenger trail, not a threat.",
      ),
    },
    {
      id: "soundcheck",
      title: "Soundcheck Duel",
      lines: [
        [
          "streamer",
          "I will loan you Studio Three after a soundcheck fade. No shouting into the microphone when you lose.",
        ],
      ],
      fight: ["streamer", "gamer", "oz", "plug", "cornball", "rastamon"],
      twist: "reserve",
      after: [
        [
          "watson",
          "The key is taped under the console. Its label says TRANSMITTER CUPBOARD.",
        ],
        ["sherlock", "An invitation with unnecessary reverb."],
      ],
    },
    {
      id: "switches",
      title: "The Patch Cable Puzzle",
      lines: [
        [
          "sherlock",
          "The transmitter is disconnected. Restore the signal path without connecting the speaker back to the microphone.",
        ],
      ],
      puzzle: puzzle(
        "sherlock-cable",
        "Patch the silent transmitter",
        "Connect output to matching input, starting at microphone and ending at antenna. Use every component once.",
        [
          ["Microphone", "Output: tiny analog signal."],
          [
            "Preamp",
            "Input: tiny analog signal. Output: strong analog signal.",
          ],
          ["Recorder", "Input: strong analog signal. Output: saved audio."],
          ["Modulator", "Input: saved audio. Output: radio carrier."],
          ["Amplifier", "Input: radio carrier. Output: broadcast signal."],
          ["Antenna", "Input: broadcast signal. No output socket."],
        ],
        [
          "Match the output words to the next component’s input.",
          "Recorder comes after preamp; modulator comes before amplifier.",
        ],
        "The warning returns, including the final sentence everyone had talked over: “Please repair the community archive.”",
      ),
    },
    {
      id: "archive",
      title: "A Choir of Missing Names",
      lines: [
        [
          "watson",
          "Someone cut the volunteer credits out of the old block recordings. The tape boxes still list every name.",
        ],
        [
          "sherlock",
          "A haunting is cheaper than a lawsuit, but considerably less clear.",
        ],
        [
          "streamer",
          "We can fix the credits. We can also fix this person’s microphone technique.",
        ],
      ],
    },
    {
      id: "voices",
      title: "Who Spoke Where?",
      lines: [
        [
          "sherlock",
          "Four volunteers recorded in different rooms. Put their witness cards under rooms A, B, C, D.",
        ],
      ],
      puzzle: puzzle(
        "sherlock-voices",
        "Match voices to studios",
        "Slots are Studio A, B, C, D from left to right. A had a fan; B had a clock; C had rain on the window; D was silent. Match each witness using the sound clues.",
        [
          ["Watson", "A steady motor hummed under every word."],
          [
            "Cornball",
            "Tick, tick, tick. I thought the host was judging my timing.",
          ],
          ["Alice", "Water tapped the glass, though nobody knocked."],
          ["Streamer’s friend", "The only recorded sound was my voice."],
        ],
        [
          "Listen for the room sound in each testimony.",
          "Watson heard a fan, and Cornball heard a clock.",
        ],
        "The recording was assembled from all four rooms. No single volunteer made the message alone.",
      ),
    },
    {
      id: "meeting",
      title: "The Collective Alibi",
      lines: [
        [
          "watson",
          "The volunteers worked together. None could reach the transmitter alone, but all had one piece of the key.",
        ],
        [
          "sherlock",
          "Our culprit is a committee. The motive is credit. The weapon is extremely poor communication.",
        ],
      ],
    },
    {
      id: "airtime",
      title: "A Fair Share of Air",
      lines: [
        [
          "streamer",
          "We have one hour and four shows. Win this scheduling fade, and we open with the archive restoration. The credits get fixed either way.",
        ],
      ],
      fight: ["streamer", "watson", "alice", "cheshire", "cornball", "plug"],
      twist: "outside",
      after: [
        [
          "watson",
          "Every contributor will be credited in the restored program. No mysterious voices needed.",
        ],
        ["cornball", "Mine should say “essential atmosphere.”"],
      ],
    },
    {
      id: "signoff",
      title: "No More Dead Air",
      lines: [
        [
          "sherlock",
          "A voice becomes a ghost when people stop listening to its owner.",
        ],
        ["watson", "That is going in the report."],
        ["sherlock", "Remove the poetry before billing. We charge for facts."],
        [
          "streamer",
          "A museum called. Their exhibit moved while the camera never blinked.",
        ],
      ],
    },
  ],
  "red-fence-night-court",
);
const sherlockMuseum = chapter(
  "sherlock-negative-space",
  22,
  "The Case of Negative Space",
  "The final mystery lives in what the camera never showed.",
  "sherlock",
  sherlockSignal.id,
  [
    {
      id: "display",
      title: "The Empty Pedestal",
      lines: [
        [
          "sherlock",
          "The museum’s first neighborhood trophy disappeared behind a glass door. No broken lock. No cut in the recording.",
        ],
        ["watson", "And no trophy in the inventory photograph from last week."],
        ["cornball", "Excellent security. Nothing got past it."],
      ],
    },
    {
      id: "seats",
      title: "The Five Witnesses",
      lines: [
        [
          "sherlock",
          "Restore the front-row seating. Their sightlines decide whose testimony can describe the display.",
        ],
      ],
      puzzle: puzzle(
        "sherlock-seats",
        "Rebuild the witness row",
        "Arrange left to right. Watson sat at the left end. Alice sat immediately right of Watson. Cornball sat between Alice and Promoter. Sherlock sat at the right end.",
        [
          ["Watson", "I occupied an end seat."],
          ["Alice", "I was directly beside Watson."],
          ["Cornball", "I had Alice on one side and Promoter on the other."],
          ["Promoter", "Cornball was on my left."],
          ["Sherlock", "The right-hand aisle was beside me."],
        ],
        [
          "Lock the two end seats first.",
          "The middle chain is Alice, Cornball, Promoter.",
        ],
        "Only the middle seats faced the trophy. The end seats saw a reflected display, not the real pedestal.",
      ),
    },
    {
      id: "reflection",
      title: "Mirror Match",
      lines: [
        [
          "alice",
          "The curator will demonstrate the mirrored display after we test the tournament layout. The middle district closes in round three—watch your exits.",
        ],
      ],
      fight: ["alice", "cheshire", "sherlock", "watson", "nguyen", "scarecrow"],
      twist: "outside",
      after: [
        [
          "watson",
          "The side mirror turns a painted trophy into a convincing solid object.",
        ],
        ["cornball", "I cheered for a wall. Not my worst date."],
      ],
    },
    {
      id: "ledger",
      title: "Balance the Inventory",
      lines: [
        [
          "sherlock",
          "The ledger tracks actual objects separately from reproductions. Put these cards into the only valid chain of custody.",
        ],
      ],
      puzzle: puzzle(
        "sherlock-ledger",
        "Chain of custody",
        "Track the real trophy. Start with its maker. Each custody record names the next recipient. Ignore references to the painted replica; follow the real object.",
        [
          ["Maker", "Delivered the brass original to the school."],
          [
            "School",
            "Lent the brass original to the library, retaining a paper copy.",
          ],
          [
            "Library",
            "Sent the original to the repair shop; the museum received a photograph.",
          ],
          [
            "Repair shop",
            "Polished the original and handed it to the courier.",
          ],
          ["Courier", "Delivered the signed parcel to the community hall."],
          [
            "Community hall",
            "Receipt matches the maker’s serial number. The original remains here.",
          ],
        ],
        [
          "The museum never received the brass object.",
          "Follow school, library, repair shop, courier.",
        ],
        "The original never vanished. The museum advertised a photograph as an original, then staged a theft to explain the mistake.",
      ),
    },
    {
      id: "promoter",
      title: "The Lie Without a Thief",
      lines: [
        [
          "promoter",
          "I said we had the trophy. Then tickets sold. By the time I understood the loan, the poster was everywhere.",
        ],
        ["watson", "So you moved the spotlight and announced a theft."],
        ["promoter", "It sounded easier than a correction."],
        ["sherlock", "It never is."],
      ],
    },
    {
      id: "proof",
      title: "Build the Public Explanation",
      lines: [
        [
          "sherlock",
          "Our accusation needs a chain of reasons, not a dramatic finger.",
        ],
      ],
      puzzle: puzzle(
        "sherlock-proof",
        "From observation to conclusion",
        "Arrange the argument: observation, physical explanation, custody evidence, motive, conclusion. Each card belongs to one step.",
        [
          [
            "The recording has no missing frames",
            "Observation: nobody crossed the camera’s view.",
          ],
          [
            "A mirror showed a painted trophy",
            "Physical explanation: moving the light removed the reflection.",
          ],
          [
            "The real trophy stayed at the hall",
            "Custody evidence: matching serial numbers and delivery signatures.",
          ],
          [
            "The poster promised an original",
            "Motive: admitting an advertising error threatened refunds.",
          ],
          [
            "The theft announcement was staged",
            "Conclusion: there was no stolen original at the museum.",
          ],
        ],
        [
          "Separate what was seen from why it happened.",
          "The conclusion belongs after the motive and evidence.",
        ],
        "The public can check every link. Promoter agrees to publish the correction and offer refunds.",
      ),
    },
    {
      id: "final",
      title: "The Last Cross-Examination",
      lines: [
        [
          "sherlock",
          "One final exhibition match raises money for the archive. Six rounds. The rival finds a second wind in round four. Then this case closes.",
        ],
      ],
      fight: [
        "sherlock",
        "watson",
        "alice",
        "oz",
        "tinman",
        "scarecrow",
        "plug",
      ],
      twist: "reinforce",
      after: [
        [
          "watson",
          "We found a cart, restored a choir, and recovered a trophy that never left home.",
        ],
        [
          "sherlock",
          "Three impossible events. Three perfectly ordinary people avoiding difficult conversations.",
        ],
      ],
    },
    {
      id: "repair",
      title: "Restitution, Not Applause",
      lines: [
        [
          "promoter",
          "Refund desk is open. The real trophy is on loan now, with the right paperwork. Every volunteer gets a credit.",
        ],
        ["cornball", "And the cart?"],
        ["watson", "Guest of honor. Parked beside the accessible entrance."],
      ],
    },
    {
      id: "casebook",
      title: "A Casebook for the Block",
      reward: "watson",
      lines: [
        [
          "sherlock",
          "Keep the notebook. Look for what changes, who benefits, and which fact nobody bothered to verify.",
        ],
        ["watson", "And ask people their names before calling them suspects."],
        ["cornball", "My official name is Essential Atmosphere."],
        ["sherlock", "Case closed. Temporarily."],
      ],
    },
  ],
  "crown-rooftop-court",
);

const ozRoad = chapter(
  "oz-yellow-line",
  23,
  "The Yellow Line",
  "Dorothy follows a vanished bus route into a city built on promises.",
  "dorothy",
  "block-party",
  [
    {
      id: "storm",
      title: "The Bus After the Storm",
      lines: [
        [
          "dorothy",
          "One minute I was taking the last bus home. Now the stop is floating, my transfer says EMERALD, and the driver is a scarecrow.",
        ],
        ["scarecrow", "Temporary driver. Permanent directions problem."],
        ["dorothy", "Then we start by finding somewhere safe to land."],
      ],
    },
    {
      id: "map",
      title: "Yellow Paint, Missing Streets",
      lines: [
        [
          "scarecrow",
          "The storm scattered the route signs. I remember every stop, just not in a useful order.",
        ],
      ],
      puzzle: puzzle(
        "oz-route",
        "Restore the yellow line",
        "Start at the storm shelter and finish at Emerald Terminal. Each stop sign points to the next one.",
        [
          ["Storm shelter", "Next stop: straw market."],
          ["Straw market", "Next stop: copper bridge."],
          ["Copper bridge", "Next stop: lion square."],
          ["Lion square", "Next stop: poppy depot."],
          ["Poppy depot", "Next stop: Emerald Terminal."],
          [
            "Emerald Terminal",
            "End of the line. Transfers home available inside.",
          ],
        ],
        [
          "Every sign names exactly one next stop.",
          "The copper bridge comes before lion square.",
        ],
        "The line is connected. Scarecrow did know the route; he needed time to put it together.",
      ),
    },
    {
      id: "straw",
      title: "Scarecrow’s First Good Idea",
      lines: [
        [
          "scarecrow",
          "They told me a brain certificate costs three favors and a processing fee.",
        ],
        ["dorothy", "You just repaired a map. Let the certificate catch up."],
        ["scarecrow", "I would like that on official paper."],
      ],
    },
    {
      id: "bridge",
      title: "The Copper Bridge",
      lines: [
        [
          "tinman",
          "The bridge opens for a friendly district match. I used to operate it, before somebody decided caring was inefficient.",
        ],
      ],
      fight: ["tinman", "scarecrow", "plug", "earthy", "cornball", "watson"],
      after: [
        [
          "tinman",
          "You protected the smallest card before chasing the big score.",
        ],
        ["dorothy", "It was part of the plan."],
        ["tinman", "That is what caring looks like when it has a plan."],
      ],
    },
    {
      id: "heart",
      title: "A Heart Is a Verb",
      lines: [
        ["tinman", "I have been waiting for Oz to give me a heart."],
        ["scarecrow", "You stayed in the rain so everyone else could cross."],
        ["tinman", "Yes, but I complained."],
        ["dorothy", "You are allowed."],
      ],
    },
    {
      id: "courage",
      title: "Lion Won’t Roar",
      lines: [
        ["lion", "Everyone expects a roar. Today my voice shakes."],
        ["dorothy", "Then use the voice you have."],
        ["lion", "Please move away from that damaged railing."],
        ["scarecrow", "Look at that. Saved us without a roar."],
      ],
    },
    {
      id: "signal",
      title: "Crossing Signals",
      lines: [
        [
          "tinman",
          "One safe crossing needs four steps. Nobody moves until the traffic is stopped.",
        ],
      ],
      puzzle: puzzle(
        "oz-signal",
        "Open the bridge safely",
        "Put the bridge instructions in dependency order. Power must precede signals; signals precede the gate; the gate precedes boarding; boarding precedes departure.",
        [
          ["Power", "Restore the copper connection."],
          ["Signal", "Turn the road lights red. Requires power."],
          ["Gate", "Raise the footbridge gate after traffic stops."],
          [
            "Board",
            "Let the waiting passengers board. Requires the open gate.",
          ],
          ["Depart", "Release the tram only after everyone is aboard."],
        ],
        [
          "Find the step with no prerequisite.",
          "Gate belongs between Signal and Board.",
        ],
        "The tram runs again. Nobody needs a miracle to do the next useful thing.",
      ),
    },
    {
      id: "poppies",
      title: "Last Tram Through the Poppies",
      lines: [
        [
          "lion",
          "The depot crew challenges us for the last departure slot. I am scared. I am playing anyway.",
        ],
      ],
      fight: ["lion", "dorothy", "scarecrow", "tinman", "earthy", "plug"],
      twist: "reserve",
      after: [
        ["dorothy", "Doors open. Everybody aboard."],
        [
          "scarecrow",
          "Emerald Terminal next. Please keep your expectations inside the vehicle.",
        ],
      ],
    },
    {
      id: "gates",
      title: "Emerald at Last",
      lines: [
        [
          "oz",
          "BEHOLD THE CITY THAT GRANTS EVERY WISH. SMALL PRINT AVAILABLE UPON REQUEST.",
        ],
        ["dorothy", "I request the small print."],
        ["oz", "That is usually not the first request."],
      ],
    },
  ],
);
const ozCurtain = chapter(
  "oz-behind-the-curtain",
  24,
  "Behind the Curtain",
  "Home is a route you build together, not a favor from a floating face.",
  "oz",
  ozRoad.id,
  [
    {
      id: "queue",
      title: "The Wish Counter",
      lines: [
        [
          "oz",
          "Brain, heart, courage, return ticket. Four separate windows, all closed for lunch.",
        ],
        ["dorothy", "You are standing behind every window."],
        ["oz", "An agile organization."],
      ],
    },
    {
      id: "receipts",
      title: "Four Promises, Four People",
      lines: [
        [
          "scarecrow",
          "He mixed our claim tickets. We can at least sort our own requests.",
        ],
      ],
      puzzle: puzzle(
        "oz-claims",
        "Match the wish tickets",
        "Slots are Scarecrow, Tin Man, Lion, Dorothy. Match the request to each traveler using what they told you.",
        [
          [
            "A brain certificate",
            "A thinker wants permission to trust his ideas.",
          ],
          ["A heart", "A bridge keeper wants his care to count."],
          ["Courage", "A guardian thinks a shaking voice cannot be brave."],
          [
            "A way home",
            "A traveler needs a reliable route back to her people.",
          ],
        ],
        [
          "Dorothy’s request belongs last.",
          "Tin Man keeps caring; Lion keeps showing up despite fear.",
        ],
        "Every request describes something the travelers have already practiced—except the actual journey home.",
      ),
    },
    {
      id: "projection",
      title: "A Very Large Face",
      lines: [
        ["oz", "Do not inspect that curtain. It is load-bearing theater."],
        ["tinman", "The projector cable is frayed. May I fix it?"],
        ["oz", "Please. It has been sparking since Tuesday."],
      ],
    },
    {
      id: "screen",
      title: "The Grand Reveal",
      lines: [
        [
          "oz",
          "I copied other people’s victories until everyone thought I caused them. Test the real me in six rounds. Then I will answer plainly.",
        ],
      ],
      fight: ["oz", "dorothy", "tinman", "lion", "scarecrow", "plug", "watson"],
      twist: "reinforce",
      after: [
        [
          "oz",
          "I cannot grant courage. I can provide a working vehicle and stop charging for promises.",
        ],
        ["dorothy", "That is a much better beginning."],
      ],
    },
    {
      id: "storm-plan",
      title: "The Weather Window",
      lines: [
        [
          "scarecrow",
          "The storm leaves one safe departure window. We need the repair plan in the right order.",
        ],
      ],
      puzzle: puzzle(
        "oz-flight",
        "Prepare the return tram",
        "Restore power before testing brakes. Test brakes before loading. Load before closing doors. Close doors before departure. Depart before the storm returns.",
        [
          ["Restore power", "The tram cannot test its brakes without power."],
          ["Test brakes", "Passengers board only after the safety test."],
          [
            "Load passengers",
            "The doors remain open until the final passenger boards.",
          ],
          ["Close doors", "The tram must be sealed before moving."],
          ["Depart", "Take the cleared route while the weather holds."],
          ["Storm returns", "The departure window ends."],
        ],
        [
          "The storm is the deadline, not a task.",
          "Loading is third; closing the doors is fourth.",
        ],
        "Everyone has a job. The plan depends on people doing it, not on Oz sounding impressive.",
      ),
    },
    {
      id: "tickets",
      title: "No One Left on the Platform",
      lines: [
        ["lion", "There are passengers without tickets."],
        ["oz", "Then I will open the gate."],
        ["tinman", "That was your power the whole time."],
        ["oz", "A humbling discovery."],
      ],
    },
    {
      id: "last-stop",
      title: "Hold the Last Stop",
      lines: [
        [
          "dorothy",
          "The route crew wants one last exhibition to celebrate reopening. Keep both outside districts connected when the center closes.",
        ],
      ],
      fight: ["dorothy", "scarecrow", "lion", "tinman", "nguyen", "watson"],
      twist: "outside",
      after: [
        ["scarecrow", "Route certified. By me. I made a stamp."],
        ["lion", "I still feel scared."],
        ["dorothy", "You can bring that feeling home too."],
      ],
    },
    {
      id: "home",
      title: "The Familiar Corner",
      lines: [
        ["dorothy", "Same cracked pavement. Same bodega. I missed every inch."],
        ["tinman", "We brought a bridge-repair plan."],
        [
          "oz",
          "And a corrected price list. Everything I promised magically is now a public service request.",
        ],
      ],
    },
    {
      id: "shoes",
      title: "There Is No Place Like It",
      reward: "dorothy",
      lines: [
        [
          "dorothy",
          "Home is not where nothing bad happens. It is where people notice you are missing and make room when you return.",
        ],
        ["scarecrow", "That goes on the new route map."],
        ["lion", "In very large letters."],
      ],
    },
  ],
  "crown-rooftop-court",
);

const aliceTea = chapter(
  "alice-borrowed-hour",
  25,
  "The Borrowed Hour",
  "Alice enters a tea party that keeps borrowing tomorrow to avoid ending today.",
  "alice",
  "block-party",
  [
    {
      id: "door",
      title: "The Door Under the Table",
      lines: [
        [
          "alice",
          "The café receipt says I have been here for negative twelve minutes.",
        ],
        ["cheshire", "Excellent service. You can complain before you arrive."],
        ["alice", "I would like to meet whoever is charging me for time."],
      ],
    },
    {
      id: "sizes",
      title: "Small Door, Large Problem",
      lines: [
        [
          "alice",
          "A bottle says DRINK ME. A cake says EAT ME. The door says PLEASE STOP KICKING ME.",
        ],
      ],
      puzzle: puzzle(
        "alice-sizes",
        "Pass the impossible doorway",
        "Start at ordinary size. The key is on a high shelf, reachable only when tall. Only tiny Alice fits through the door. A sip halves her size; the cake makes her tall. Arrange these unique actions using the clues.",
        [
          ["Eat the cake", "Become tall enough to reach the high shelf."],
          ["Take the key", "The shelf is inaccessible when ordinary or tiny."],
          [
            "Drink the small bottle",
            "Become tiny; carry anything already in your pocket.",
          ],
          [
            "Unlock the door",
            "The lock is reachable at tiny size, but needs the key.",
          ],
          [
            "Walk through",
            "Only possible after the door is unlocked and Alice is tiny.",
          ],
        ],
        [
          "Get the key before shrinking.",
          "Unlocking comes after the small bottle, before walking through.",
        ],
        "Alice fits. The door thanks her for choosing a solution with less kicking.",
      ),
    },
    {
      id: "tea",
      title: "A Seat for Tomorrow",
      lines: [
        [
          "cheshire",
          "Every guest borrowed an hour. Now the table is waiting for a tomorrow that never arrives.",
        ],
        ["alice", "Who owns the clock?"],
        [
          "cheshire",
          "The Queen. Ownership is the only thing here that never shrinks.",
        ],
      ],
    },
    {
      id: "cups",
      title: "The Tea Service Trial",
      lines: [
        [
          "alice",
          "The host offers the clock key if we win the table’s game. I would prefer a conversation, but apparently the tea has rules.",
        ],
      ],
      fight: ["cheshire", "alice", "scarecrow", "cornball", "plug", "watson"],
      twist: "reserve",
      after: [
        [
          "cheshire",
          "One key, three teaspoons, and an invoice for the pause between thoughts.",
        ],
        ["alice", "We are returning that invoice."],
      ],
    },
    {
      id: "cups-puzzle",
      title: "Who Drank What?",
      lines: [
        [
          "alice",
          "The labels are honest. The guests are confusing. Put the cups in seat order.",
        ],
      ],
      puzzle: puzzle(
        "alice-cups",
        "Set the tea table",
        "Seats run left to right: Alice, Cheshire, the Clockkeeper, Queen. Alice drinks the only cold cup. Cheshire drinks the cup without liquid. The Clockkeeper takes tea with a ticking spoon. The Queen takes the remaining rose tea.",
        [
          ["Iced lemon", "Cold glass, lemon slice, no spoon."],
          ["An empty cup", "Contains exactly one invisible grin."],
          ["Black tea", "A spoon ticks against the rim."],
          ["Rose tea", "Warm and fragrant, with a crown-shaped sugar cube."],
        ],
        [
          "The empty cup belongs to Cheshire.",
          "The ticking spoon belongs in the third seat.",
        ],
        "The Queen’s cup contains the clock spring. Time is not missing; somebody hid the mechanism.",
      ),
    },
    {
      id: "grin",
      title: "The Cat’s Actual Name",
      lines: [
        ["cheshire", "You keep asking what I am."],
        ["alice", "Today I need to know what you want."],
        ["cheshire", "To leave a party without becoming the villain of it."],
        ["alice", "That is allowed."],
      ],
    },
    {
      id: "clock",
      title: "An Hour for Everybody",
      lines: [
        [
          "alice",
          "We cannot fix a clock by deciding whose hour matters least. We return all the borrowed hours together.",
        ],
      ],
      puzzle: puzzle(
        "alice-clock",
        "Repair the shared clock",
        "Reassemble from the power source toward the hands. Each component names what it drives.",
        [
          ["Spring", "Drives the main gear."],
          ["Main gear", "Drives the escape wheel."],
          ["Escape wheel", "Moves the pendulum."],
          ["Pendulum", "Regulates the minute spindle."],
          ["Minute spindle", "Turns the clock hands."],
          ["Clock hands", "Show time to everyone at the table."],
        ],
        [
          "The spring provides power; the hands display the result.",
          "The escape wheel sits between main gear and pendulum.",
        ],
        "For the first time all day, the minute hand moves forward.",
      ),
    },
    {
      id: "leave",
      title: "Permission to Leave",
      lines: [
        ["queenofhearts", "Nobody leaves my tea party undefeated."],
        [
          "alice",
          "Then this is our goodbye game. Closing the middle district will not close every exit.",
        ],
      ],
      fight: [
        "queenofhearts",
        "cheshire",
        "alice",
        "tinman",
        "cornball",
        "plug",
      ],
      twist: "outside",
      after: [
        ["alice", "The hour belongs to its people. The party is over."],
        ["queenofhearts", "We will discuss this in court."],
        ["cheshire", "Of course. The tea was merely the waiting room."],
      ],
    },
    {
      id: "summons",
      title: "Court of the Unfinished Sentence",
      lines: [
        ["alice", "The summons ends halfway through a sentence."],
        ["cheshire", "Her favorite kind. The defendant has to finish it."],
        ["alice", "Then I will bring a full stop."],
      ],
    },
  ],
);
const aliceCourt = chapter(
  "alice-full-stop",
  26,
  "The Queen Meets a Full Stop",
  "In a court where words change size, Alice asks for rules that stay put.",
  "alice",
  aliceTea.id,
  [
    {
      id: "charge",
      title: "Guilty of Leaving",
      lines: [
        [
          "queenofhearts",
          "You are charged with leaving before I said goodbye.",
        ],
        ["alice", "Where is that rule written?"],
        ["queenofhearts", "It will be written yesterday."],
        ["alice", "Then today we have no such rule."],
      ],
    },
    {
      id: "sentence",
      title: "The Traveling Comma",
      lines: [
        [
          "cheshire",
          "Her decree changes whenever someone moves the punctuation. Put each part where it actually belongs.",
        ],
      ],
      puzzle: puzzle(
        "alice-decree",
        "Make a rule everyone can read",
        "Build the promised sentence: first name who the rule covers, then the permission, then the action, then the condition, then the time. The result must permit departure when the bell rings.",
        [
          ["Every guest", "Who the rule covers."],
          ["may", "Permission, not an obligation."],
          ["leave the party", "The action being permitted."],
          ["when", "Introduces the condition."],
          ["the bell rings", "The agreed signal and time."],
        ],
        [
          "Begin with Every guest.",
          "The permission comes before the action; the bell is last.",
        ],
        "“Every guest may leave the party when the bell rings.” Even the Queen can read this version only one way.",
      ),
    },
    {
      id: "guard",
      title: "Cards on the Witness Stand",
      lines: [
        ["queenofhearts", "My guards demand a demonstration."],
        [
          "alice",
          "A demonstration is not a confession. Five rounds, then we return to the actual question.",
        ],
      ],
      fight: [
        "queenofhearts",
        "tinman",
        "watson",
        "scarecrow",
        "cornball",
        "plug",
      ],
      after: [
        [
          "cheshire",
          "A guard folded under cross-examination. Literally. Paper crease.",
        ],
        ["alice", "Somebody bring tape."],
      ],
    },
    {
      id: "evidence",
      title: "Yesterday’s Wet Ink",
      lines: [
        [
          "alice",
          "The law is dated yesterday, but the ink is still wet and the page sits over today’s carbon copy.",
        ],
        ["queenofhearts", "My stationery is very advanced."],
        ["cheshire", "Its only innovation is lying badly."],
      ],
    },
    {
      id: "order",
      title: "Which Came First?",
      lines: [
        ["alice", "We can show the sequence without accusing the calendar."],
      ],
      puzzle: puzzle(
        "alice-law",
        "Reconstruct the decree",
        "Order events by dependency. A blank page arrives before any writing. The Queen writes after Alice leaves. The seal is applied to the written decree. The summons quotes the sealed decree.",
        [
          [
            "A blank page arrives",
            "The clerk signs the delivery receipt at breakfast.",
          ],
          [
            "Alice leaves the party",
            "The bell rings at noon; the page is still blank.",
          ],
          [
            "The Queen writes a new rule",
            "Witnessed after lunch, on the delivered page.",
          ],
          [
            "The clerk applies the seal",
            "The seal covers a word of the finished decree.",
          ],
          ["The summons is issued", "Its text quotes the sealed rule."],
        ],
        [
          "Alice left before the rule existed.",
          "Writing must precede sealing, which precedes the summons.",
        ],
        "The Queen tried to punish an action with a rule written afterward. The guards refuse to enforce it.",
      ),
    },
    {
      id: "choice",
      title: "The Queen’s Smallest Voice",
      lines: [
        ["queenofhearts", "When a guest leaves, the room becomes smaller."],
        ["alice", "You can miss someone without owning their afternoon."],
        ["queenofhearts", "And if nobody returns?"],
        ["cheshire", "Try serving better tea."],
      ],
    },
    {
      id: "verdict",
      title: "One Last Hand",
      lines: [
        [
          "queenofhearts",
          "A final match, with rules announced before we begin. If I lose, I host next week without compulsory attendance.",
        ],
        ["alice", "If you win, you host without compulsory attendance too."],
        ["queenofhearts", "Fine. But I choose the biscuits."],
      ],
      fight: [
        "queenofhearts",
        "alice",
        "cheshire",
        "oz",
        "tinman",
        "watson",
        "plug",
      ],
      twist: "reinforce",
      after: [
        [
          "queenofhearts",
          "I enjoyed a contest more when the outcome was allowed to surprise me.",
        ],
        ["alice", "That is usually the point."],
      ],
    },
    {
      id: "door",
      title: "An Open Door",
      lines: [
        ["cheshire", "I am leaving now."],
        ["queenofhearts", "Thank you for coming."],
        ["cheshire", "Look at that. Nobody turned into a villain."],
        ["alice", "And the clock is still moving."],
      ],
    },
    {
      id: "home",
      title: "Full Stop",
      reward: "alice",
      lines: [
        [
          "alice",
          "Some doors want you smaller. Some tables want your whole tomorrow. You can ask a question. You can say no. You can go home.",
        ],
        ["cheshire", "And you can come back by choice."],
        ["alice", "That is a different kind of invitation."],
      ],
    },
  ],
  "red-fence-night-court",
);

const yasuke = chapter(
  "yasuke-banner-without-master",
  27,
  "A Banner Without a Master",
  "A fictional neighborhood festival asks Yasuke who a champion is supposed to protect.",
  "yasuke",
  "block-party",
  [
    {
      id: "arrival",
      title: "The Borrowed Banner",
      lines: [
        [
          "yasuke",
          "They put my name on a tournament banner before asking me to attend.",
        ],
        ["promoter", "The print deadline was very persuasive."],
        [
          "yasuke",
          "Ink cannot accept an invitation for me. Tell me who this event serves.",
        ],
      ],
    },
    {
      id: "terms",
      title: "Before the First Bow",
      lines: [
        [
          "promoter",
          "Prize money funds the youth courtyard. Sponsors want the champion to endorse their private club.",
        ],
        ["yasuke", "The children can enter that club?"],
        ["promoter", "Not under the current terms."],
        ["yasuke", "Then the terms are our first opponent."],
      ],
    },
    {
      id: "banners",
      title: "Read the Signals",
      lines: [
        [
          "yasuke",
          "The festival marshals use four banners. Arrange them into the safe opening sequence.",
        ],
      ],
      puzzle: puzzle(
        "yasuke-signals",
        "The courtyard signal code",
        "Opening order: clear the courtyard, inspect the floor, invite the crowd, begin the match. Match the banners using their written meanings.",
        [
          ["White square", "Marshals clear obstacles and open the exits."],
          ["Blue circle", "The referee checks the court for hazards."],
          ["Gold stripe", "Spectators may enter the marked seating area."],
          ["Red sun", "Players may begin after the referee’s signal."],
        ],
        [
          "Safety checks precede admission.",
          "The red sun starts the match and belongs last.",
        ],
        "The youngest marshal runs the opening perfectly. Yasuke bows to her first.",
      ),
    },
    {
      id: "lesson",
      title: "A Shield for the Smallest",
      lines: [
        [
          "yasuke",
          "The exhibition begins with protection. Hold the outer districts when the center closes. Strength is also choosing who does not face danger alone.",
        ],
      ],
      fight: ["yasuke", "tinman", "watson", "cornball", "scarecrow", "plug"],
      twist: "outside",
      after: [
        [
          "promoter",
          "The crowd cheered for the protected card louder than the biggest hit.",
        ],
        ["yasuke", "They understood the lesson."],
      ],
    },
    {
      id: "contract",
      title: "No Signature in the Margin",
      lines: [
        [
          "yasuke",
          "The sponsor moved the public-use promise into a footnote. We read the whole page before celebrating.",
        ],
      ],
      puzzle: puzzle(
        "yasuke-contract",
        "Build the public-use agreement",
        "Put the agreement in approval order: name the space, state who can use it, define free hours, assign maintenance, then sign. Each part must be read before signatures.",
        [
          ["The youth courtyard", "Identify the exact public space."],
          [
            "Everyone in the neighborhood",
            "Name who may enter; membership is not required.",
          ],
          [
            "Free access after school",
            "State protected opening hours without an entry fee.",
          ],
          [
            "A shared maintenance schedule",
            "Assign repairs and a public contact for problems.",
          ],
          ["Sign and publish", "Only after all four terms have been agreed."],
        ],
        [
          "A signature comes after terms, never before them.",
          "Access comes before hours; maintenance follows both.",
        ],
        "The agreement names the actual space and its users. The banner now promises something that can be checked.",
      ),
    },
    {
      id: "challenge",
      title: "The Sponsor’s Champion",
      lines: [
        [
          "yasuke",
          "The final challenger is skilled. Respect that. But no result will remove the public-use terms we already agreed.",
        ],
      ],
      fight: ["yasuke", "lion", "oz", "tinman", "scarecrow", "watson", "plug"],
      twist: "reinforce",
      after: [
        [
          "yasuke",
          "A good opponent makes you more precise. An audience makes you responsible.",
        ],
        [
          "promoter",
          "Then the courtyard dedication comes before the trophy presentation.",
        ],
      ],
    },
    {
      id: "name",
      title: "Who Gets the Banner?",
      lines: [
        ["promoter", "Should we put your portrait above the gate?"],
        ["yasuke", "Put the opening hours there. People need those more."],
        ["cornball", "Can my portrait go on the maintenance schedule?"],
        ["yasuke", "If you take a shift."],
      ],
    },
    {
      id: "opening",
      title: "The Smallest Champion",
      lines: [
        ["yasuke", "The child who ran the signals should cut the ribbon."],
        ["promoter", "She asked whether the scissors are sharp."],
        ["yasuke", "She remains the most qualified person here."],
      ],
    },
    {
      id: "bow",
      title: "The Bow Goes Both Ways",
      reward: "yasuke",
      lines: [
        [
          "yasuke",
          "Carry your name carefully. It belongs to you, but what you do with it reaches other people.",
        ],
        ["promoter", "The banner is staying. With permission this time."],
        ["yasuke", "Then I am honored."],
      ],
    },
  ],
  "crown-rooftop-court",
);
const inmate = chapter(
  "cellblock-library-hour",
  28,
  "The Library Hour",
  "A cellblock crew builds a reading room while one missing form threatens the opening.",
  "inmate-crafty",
  "block-party",
  [
    {
      id: "shelf",
      title: "A Shelf Built From Scraps",
      lines: [
        [
          "inmate-crafty",
          "Three shelves, two wobbly legs, one book about building shelves. We are overqualified.",
        ],
        [
          "inmate-boyfriend",
          "The reading hour is approved. We still need the room inspected.",
        ],
        [
          "inmate-informant",
          "The inspection request disappeared from the office tray.",
        ],
      ],
    },
    {
      id: "rumor",
      title: "The Cost of a Rumor",
      lines: [
        [
          "inmate-contraband",
          "Everybody is looking at me because my nickname sounds like a search warrant.",
        ],
        [
          "inmate-crafty",
          "A nickname is not evidence. We check the route the form took.",
        ],
        ["inmate-informant", "Thank you. I would also appreciate that policy."],
      ],
    },
    {
      id: "forms",
      title: "The Paper Trail",
      lines: [
        [
          "inmate-crafty",
          "Five copies. Five stamps. Restore the actual approval path.",
        ],
      ],
      puzzle: puzzle(
        "cellblock-forms",
        "Follow the room request",
        "Arrange by required approvals. The request goes to the librarian, then safety inspector, then scheduling desk, then unit office, then the notice board.",
        [
          ["Librarian copy", "Confirms books and shelves are available."],
          [
            "Safety inspection",
            "Checks exits after the librarian approves the contents.",
          ],
          ["Scheduling desk", "Assigns the hour after safety clearance."],
          ["Unit office", "Confirms the approved time with the staff roster."],
          ["Notice board", "Publishes the final time for everyone."],
        ],
        [
          "A public notice must be last.",
          "Safety clearance comes before assigning a time.",
        ],
        "The scheduling copy never reached the unit office. No theft is needed to explain the gap.",
      ),
    },
    {
      id: "yard",
      title: "The Courtyard Exhibition",
      lines: [
        [
          "inmate-boyfriend",
          "We agreed to a friendly fade for first choice of the donated books. Everyone gets reading time either way.",
        ],
      ],
      fight: [
        "inmate-boyfriend",
        "inmate-crafty",
        "inmate-contraband",
        "tinman",
        "watson",
        "plug",
      ],
      after: [
        [
          "inmate-crafty",
          "We chose the repair manual. The poetry shelf can wait exactly one trip to the donation box.",
        ],
        ["inmate-boyfriend", "I already made that trip."],
      ],
    },
    {
      id: "stamps",
      title: "The Wrong Tuesday",
      lines: [
        [
          "inmate-informant",
          "The clerk used last month’s calendar. Our Tuesday became a Thursday on the staffing sheet.",
        ],
        [
          "inmate-contraband",
          "A whole room almost closed because a calendar got comfortable.",
        ],
        ["inmate-crafty", "Then we correct it where everybody can see it."],
      ],
    },
    {
      id: "shelves",
      title: "The Shelf Cipher",
      lines: [
        [
          "inmate-crafty",
          "The donated books have section marks, but the labels fell off the shelf.",
        ],
      ],
      puzzle: puzzle(
        "cellblock-shelves",
        "Shelve the first five books",
        "Shelf order is repair, cooking, history, fiction, poetry. Match each description to its section.",
        [
          ["Fix the Wobble", "Diagrams for repairing chairs and tables."],
          ["One Pot, Many Plates", "Recipes sized for a shared kitchen."],
          ["Before This Block", "An illustrated timeline of the neighborhood."],
          [
            "The Ninth Passenger",
            "A made-up mystery with a very opinionated train conductor.",
          ],
          [
            "Window Light",
            "Short verses written during the same hour each afternoon.",
          ],
        ],
        [
          "Start with the practical repair guide.",
          "The mystery is fiction; the verses go last.",
        ],
        "Every shelf has a label. Every book has somewhere to return.",
      ),
    },
    {
      id: "opening-match",
      title: "One Hour, Shared",
      lines: [
        [
          "inmate-informant",
          "The opening exhibition supports the book fund. My card has a sharp ability; use Protection and choose your district carefully.",
        ],
      ],
      fight: [
        "inmate-informant",
        "inmate-boyfriend",
        "inmate-crafty",
        "inmate-contraband",
        "watson",
        "plug",
        "tinman",
      ],
      twist: "reinforce",
      after: [
        [
          "inmate-boyfriend",
          "The corrected schedule is signed. The room opens after lunch.",
        ],
        ["inmate-crafty", "And the shelf?"],
        ["inmate-contraband", "Still standing. A moving review."],
      ],
    },
    {
      id: "first-reader",
      title: "The First Reader",
      lines: [
        ["inmate-boyfriend", "He has read the same page three times."],
        [
          "inmate-crafty",
          "Maybe it is a good page. Maybe he needs time. We have an hour.",
        ],
        ["inmate-informant", "For once, nobody needs a report about it."],
      ],
    },
    {
      id: "bookmark",
      title: "Leave a Bookmark",
      reward: "inmate-crafty",
      lines: [
        [
          "inmate-crafty",
          "This does not fix the whole place. It is still worth building.",
        ],
        ["inmate-boyfriend", "Tomorrow we fix the second table."],
        [
          "inmate-contraband",
          "I found a legitimate screwdriver. I will need time to adjust my brand.",
        ],
      ],
    },
  ],
  "red-fence-night-court",
);
const homeless = chapter(
  "homeless-a-place-to-return",
  29,
  "A Place to Return",
  "The person everybody walks past knows how every street connects.",
  "homelessguy",
  "block-party",
  [
    {
      id: "name",
      title: "Ask Me First",
      lines: [
        [
          "homelessguy",
          "You can call me Leon. The card says Homeless Guy. That is a circumstance, not an introduction.",
        ],
        ["cornball", "I am Cornball. Mine is unfortunately an introduction."],
        [
          "homelessguy",
          "Then we are both carrying more than the label. Help me move this cart before the rain.",
        ],
      ],
    },
    {
      id: "storm",
      title: "Where the Water Goes",
      lines: [
        [
          "homelessguy",
          "That underpass floods first. The church ramp stays dry, but its rear gate sticks. The library has charging outlets until six.",
        ],
        ["delivery", "How do you remember every route?"],
        [
          "homelessguy",
          "Because a wrong turn costs me more than five minutes.",
        ],
      ],
    },
    {
      id: "dry-route",
      title: "A Dry Way Across",
      lines: [
        [
          "homelessguy",
          "We need a step-free route for the supply cart. Use the access notes.",
        ],
      ],
      puzzle: puzzle(
        "leon-route",
        "Connect the accessible route",
        "Start at the library and end at the community kitchen. Follow each step-free connection. The flooded underpass is not part of this route.",
        [
          ["Library", "The level side exit reaches the bus shelter."],
          ["Bus shelter", "Its curb ramp joins the pharmacy walkway."],
          ["Pharmacy walkway", "The wide passage exits at the church ramp."],
          ["Church ramp", "A repaired rear gate opens onto the garden path."],
          ["Garden path", "The flat path ends at the kitchen entrance."],
          [
            "Community kitchen",
            "Destination: dry storage and a place to charge phones.",
          ],
        ],
        [
          "Follow the named accessible connections.",
          "The church ramp comes after the pharmacy and before the garden.",
        ],
        "The route works for carts, wheelchairs, and anyone who cannot take the stairs. Leon marks it for everybody.",
      ),
    },
    {
      id: "supplies",
      title: "Nothing to Lose, Something to Save",
      lines: [
        [
          "homelessguy",
          "The kitchen crew is playing an exhibition for the next delivery shift. I can invest extra Motion when I arrive. Spend with a plan; nothing is unlimited.",
        ],
      ],
      fight: [
        "homelessguy",
        "delivery",
        "watson",
        "rastamon",
        "cornball",
        "plug",
      ],
      twist: "reserve",
      after: [
        [
          "delivery",
          "You saved Motion instead of making the biggest possible entrance.",
        ],
        ["homelessguy", "I still need to get through tomorrow."],
      ],
    },
    {
      id: "address",
      title: "An Address for the Paperwork",
      lines: [
        [
          "homelessguy",
          "The appointment letter went to an address I left months ago. The caseworker has a replacement, but my phone is dead.",
        ],
        ["watson", "We can charge it at the kitchen and call together."],
        ["homelessguy", "Together. I will do the talking."],
      ],
    },
    {
      id: "appointments",
      title: "One Afternoon, Four Stops",
      lines: [
        [
          "homelessguy",
          "We can make the appointment without abandoning the supplies if we order the stops properly.",
        ],
      ],
      puzzle: puzzle(
        "leon-day",
        "Plan the afternoon",
        "The phone must charge before the call. The call confirms where to collect the replacement letter. Collect the letter before the appointment. The supply pickup happens after the appointment.",
        [
          ["Charge the phone", "Kitchen opens at noon and has a free outlet."],
          [
            "Call the caseworker",
            "Use the charged phone to confirm the collection desk.",
          ],
          [
            "Collect the letter",
            "The named desk holds the replacement until three.",
          ],
          [
            "Attend the appointment",
            "Bring the replacement letter to the two o’clock meeting.",
          ],
          ["Pick up the supplies", "The delivery window begins at three."],
        ],
        [
          "Start with the task that makes the phone usable.",
          "The letter is needed before the appointment; supplies come after.",
        ],
        "A workable afternoon. The plan solves access problems; nobody has to pretend those problems were laziness.",
      ),
    },
    {
      id: "space",
      title: "The Community Court",
      lines: [
        [
          "homelessguy",
          "The reopening fade decides who paints the court’s center mural. Our appointment and the kitchen access are already arranged. No one should have to win a game to deserve help.",
        ],
      ],
      fight: [
        "homelessguy",
        "abuela",
        "delivery",
        "watson",
        "tinman",
        "cornball",
        "plug",
      ],
      twist: "outside",
      after: [
        ["cornball", "What is going on the mural?"],
        ["homelessguy", "The dry route. Big arrows. Useful art."],
      ],
    },
    {
      id: "key",
      title: "Not a Miracle Ending",
      lines: [
        [
          "homelessguy",
          "The appointment went well. There is a room available next week. There are still forms, and I still need a ride.",
        ],
        ["delivery", "I put it on my schedule."],
        ["homelessguy", "Good. Hope works better with a pickup time."],
      ],
    },
    {
      id: "return",
      title: "My Name on the Door",
      reward: "homelessguy",
      lines: [
        [
          "homelessguy",
          "Keep the route map updated. Someone else will need it tomorrow.",
        ],
        ["watson", "What should the map credit say?"],
        [
          "homelessguy",
          "Leon. Route designer. And leave enough space for the next person’s name.",
        ],
      ],
    },
  ],
);

export const extendedStoryChapters: readonly StoryChapter[] = [
  sherlockClock,
  sherlockSignal,
  sherlockMuseum,
  ozRoad,
  ozCurtain,
  aliceTea,
  aliceCourt,
  yasuke,
  inmate,
  homeless,
];
