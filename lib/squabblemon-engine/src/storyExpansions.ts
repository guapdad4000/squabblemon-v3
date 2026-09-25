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
const speak = ([id, text]: Speech): StoryDialogueLine => {
  const card = cards[id];
  if (!card) throw new Error(`Unknown expansion speaker: ${id}`);
  return {
    speaker: card.name,
    portraitAssetId: `assets/characters/${card.id}.webp`,
    text,
  };
};
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
function scramblePuzzlePieces<T extends { id: string }>(
  id: string,
  pieces: T[],
): T[] {
  // Stable per puzzle for refresh/retry, without teaching one universal unscramble trick.
  let seed = [...id].reduce(
    (value, char) => Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0,
    2166136261,
  );
  const shuffled = [...pieces];
  for (let i = shuffled.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  if (shuffled.every((piece, i) => piece.id === pieces[i].id))
    shuffled.push(shuffled.shift()!);
  return shuffled;
}
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
    pieces: scramblePuzzlePieces(id, ordered),
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
      const encounterObjectives: StoryStarObjective[] = [
        objectives[0],
        beat.twist === "outside"
          ? objectives[1]
          : boss
            ? {
                id: "districts",
                description: "Win all three districts against the final crew.",
                criterion: {
                  kind: "districts-held",
                  owner: "player",
                  atLeast: 3,
                },
              }
            : {
                id: "restraint",
                description: "Finish without using SQUABBLE.",
                criterion: {
                  kind: "squabble-used",
                  owner: "player",
                  used: false,
                },
              },
        {
          id: "motion",
          description: `Finish with at least ${beat.twist === "reserve" ? 2 : 1} Motion.`,
          criterion: {
            kind: "motion-remaining",
            owner: "player",
            atLeast: beat.twist === "reserve" ? 2 : 1,
          },
        },
      ];
      return {
        ...common,
        kind: "battle",
        battleType: boss ? "boss" : beat.twist ? "rule-twist" : "standard",
        preDialogue: beat.lines.map(speak),
        postDialogue: (beat.after ?? []).map(speak),
        starObjectives: encounterObjectives,
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
          starObjectives: encounterObjectives,
          modifiers: {
            startingMotion: { player: 3, cpu: boss ? 3 : 2 },
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
  "A tomorrow-dated ticket, two delivery charges, and a missing passenger with one good wheel.",
  "sherlock",
  "special-sherlock-last-reel",
  [
    {
      id: "ticket",
      title: "A Ticket With No Journey",
      lines: [
        [
          "watson",
          "Somebody slid a train ticket under our door. Tomorrow’s date, bell number thirteen, and a bill for a passenger nobody remembers.",
        ],
        ["cornball", "If this is about my emotional baggage, I already paid."],
        [
          "sherlock",
          "The sender wants us staring at the ticket. Start with the bill.",
        ],
      ],
    },
    {
      id: "platform",
      title: "Platform Zero",
      lines: [
        [
          "delivery",
          "Dispatch says I collected that parcel at nine. At nine I was in the shower arguing with a bottle that said FAMILY SIZE.",
        ],
        ["watson", "The signature is yours?"],
        [
          "delivery",
          "They copied it off my old route sheet. Even copied the little heart. That heart is private.",
        ],
      ],
    },
    {
      id: "clocks",
      title: "Three Clocks, One Minute",
      lines: [
        [
          "watson",
          "Station runs seven minutes fast. Bakery runs four slow. River clock is right. Three witnesses, three confident wrong answers.",
        ],
        [
          "sherlock",
          "Correct their times. A van and a train cannot both have carried this parcel on the claimed trip.",
        ],
        [
          "cornball",
          "The bakery got time to lie but never time to warm my croissant.",
        ],
      ],
      puzzle: puzzle(
        "sherlock-clocks",
        "Three clocks. One fake trip.",
        "Place the five sightings from earliest to latest in real time. Station is 7 minutes fast; bakery is 4 minutes slow; river is correct. The invoice claims the parcel left on the 9:07 train.",
        [
          [
            "Bakery shutter — 8:56",
            "Bakery clock. Van enters the loading bay; parcel seal is intact.",
          ],
          [
            "River bell — 9:02",
            "River clock. The delivery cart passes the bell with no parcel.",
          ],
          [
            "Station gate — 9:11",
            "Station clock. Van exits toward the river carrying the sealed parcel.",
          ],
          [
            "Bakery van — 9:01",
            "Bakery clock. Witness sees the van at the river kiosk in the bakery’s side mirror.",
          ],
          [
            "Station whistle — 9:14",
            "Station clock. Train departs; manifest lists passengers, no freight.",
          ],
        ],
        [
          "Fast clocks must be moved backward; slow clocks forward.",
          "Convert the two bakery readings first. The shutter is 9:00; the mirror sighting is 9:05.",
          "Real order: 9:00, 9:02, 9:04, 9:05, 9:07.",
        ],
        "The parcel reached the kiosk at 9:05, two minutes before the alleged train trip began. Compare its serial number with both invoices next.",
      ),
    },
    {
      id: "guard",
      title: "The Guard’s Challenge",
      lines: [
        [
          "landlord",
          "You want locker nine? Beat my crew for the inspection slot. Center closes in round three; maintenance finally found the leak.",
        ],
        ["watson", "Why is the landlord running a station locker?"],
        ["landlord", "Diversification."],
      ],
      fight: ["landlord", "watson", "cornball", "plug", "scarecrow", "tinman"],
      twist: "outside",
      after: [
        [
          "watson",
          "No parcel. Flour on the handle, though—and a duplicate delivery invoice inside the door.",
        ],
        ["cornball", "This man renting out crumbs. We are in hell."],
      ],
    },
    {
      id: "route",
      title: "A Route That Cannot Double Back",
      lines: [
        [
          "delivery",
          "They used a handcart. One bad wheel, flour in the tread. The traffic-camera notes give us six stops, but the kiosk scrubbed the times.",
        ],
        [
          "sherlock",
          "Then reconstruct the route from what the witnesses could actually see.",
        ],
      ],
      puzzle: puzzle(
        "sherlock-route",
        "Rebuild the unclocked route",
        "Order all six stops from station to river. Each was visited once. The damaged cart could not reverse on a narrow ramp. Use the witnesses together; no single witness saw the whole trip.",
        [
          ["Station", "Departure point. The cart had clean wheels here."],
          [
            "Bakery",
            "Flour was acquired here. It was already visible at the laundromat.",
          ],
          ["Laundromat", "The driver visited immediately before the tower."],
          [
            "Clock tower",
            "Exactly two stops separate the tower from the station.",
          ],
          [
            "Ticket kiosk",
            "The last dry wheel print is here, immediately before the river.",
          ],
          ["River", "End point. The cart was abandoned on the bank."],
        ],
        [
          "Fix both endpoints, then place the kiosk.",
          "Tower is fourth. Laundromat has to be third.",
        ],
        "Flour appears before the tower; the kiosk is the final stop before the river. Its back camera should show who unloaded Passenger.",
      ),
    },
    {
      id: "interview",
      title: "The Missing Passenger Speaks",
      lines: [
        [
          "homelessguy",
          "Passenger is my cart. Y’all put out a missing-person notice for a shopping cart with one good wheel.",
        ],
        ["watson", "The ticket lists Passenger as a traveler."],
        [
          "homelessguy",
          "That cart has never sat down a day in its life. Put some respect on its work ethic.",
        ],
        ["sherlock", "Who borrowed it?"],
        [
          "homelessguy",
          "Kiosk owner. Said five minutes. That was two sunsets ago.",
        ],
      ],
    },
    {
      id: "bell",
      title: "Thirteen Is a Serial Number",
      lines: [
        [
          "watson",
          "The bell is stamped 13. The owner entered it as thirteen o’clock, then dated the ticket tomorrow to make the delivery look overnight.",
        ],
        [
          "sherlock",
          "Not a haunted station. An overnight surcharge wearing a ghost costume.",
        ],
        ["cornball", "I knew the ghost was broke. It sent an invoice."],
      ],
    },
    {
      id: "receipt",
      title: "Hold the Loading Dock",
      lines: [
        [
          "delivery",
          "Kiosk owner booked both unloading lanes so nobody can inspect his van. The posted dock contest decides the next slot. We take it, we compare parcel numbers.",
        ],
        [
          "sherlock",
          "Keep that duplicate invoice. Empty packaging alone proves nothing.",
        ],
      ],
      fight: ["delivery", "landlord", "nguyen", "bikelife", "plug", "watson"],
      after: [
        [
          "watson",
          "Same parcel serial on both bills. Van camera shows the delivery; the rail manifest has no parcel at all. Two charges. One trip.",
        ],
        [
          "sherlock",
          "And tomorrow’s ticket was printed today on his terminal. He can refund the delivery before we explain his creative calendar to dispatch.",
        ],
        [
          "cornball",
          "Put the cart’s late fee on there. Passenger got dependents.",
        ],
      ],
    },
    {
      id: "return",
      title: "Passenger Arrives Home",
      lines: [
        [
          "homelessguy",
          "Refund cleared. New wheel fitted. He apologized to Passenger and tried to shake the handle. I let him.",
        ],
        [
          "watson",
          "The bell owner sent the tip. Her parcel got billed twice; she thought thirteen was the departure time.",
        ],
        ["cornball", "Good. I was about to investigate tomorrow."],
        ["watson", "Leave tomorrow alone. The radio station just called."],
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
          "Every night at 11:03, my radio whispers “Miss Two Plates.” Nobody calls me that anymore.",
        ],
        ["watson", "It is the hook on your old intro song."],
        ["streamer", "That song was for my healing. Not discovery."],
        ["sherlock", "Who still has the original recording?"],
      ],
    },
    {
      id: "tape",
      title: "The Reversed Warning",
      lines: [
        [
          "streamer",
          "The voice left six chopped-up words. My chat says it’s a demon.",
        ],
        ["watson", "Your chat also said the microwave was flirting."],
        [
          "sherlock",
          "The file header says the tape ran backward. Recover the instruction. The room label matters.",
        ],
      ],
      puzzle: puzzle(
        "sherlock-tape",
        "The file plays backward",
        "The six word-splices are backward. Decode them, then build the instruction. The engineer confirms the place is called STUDIO THREE, and the object is a KEY. Nothing is hidden under the whole building.",
        [
          ["DNIF", "Reverse the characters; this is an instruction."],
          ["YEK", "A physical object, not a musical pitch."],
          ["W O L E B", "Spaces are tape damage. Join, then reverse."],
          ["KS ED", "Spaces are tape damage. Join, then reverse."],
          ["OIDUTS", "Part of a two-word room name."],
          ["EERHT", "Part of the same room name."],
        ],
        [
          "Remove stray spaces before reversing. The phrase begins FIND KEY.",
          "Read it as FIND KEY / BELOW DESK / STUDIO THREE.",
        ],
        "FIND KEY BELOW DESK, STUDIO THREE. A location we can inspect—not proof of who left the message.",
      ),
    },
    {
      id: "soundcheck",
      title: "Soundcheck Duel",
      lines: [
        [
          "streamer",
          "Studio Three is booked for a live soundcheck battle. Win the booking and we inspect the desk on camera. Lose and chat clips my fear in 4K.",
        ],
        [
          "watson",
          "Round three has one less Motion on both sides. The station’s power limiter is on.",
        ],
      ],
      fight: ["streamer", "gamer", "oz", "plug", "cornball", "rastamon"],
      twist: "reserve",
      after: [
        [
          "watson",
          "Key taped under the mixing desk. TRANSMITTER CUPBOARD. Dust around the tape, none under it. This was placed recently.",
        ],
        ["streamer", "The demon has a stationery budget."],
        ["sherlock", "And a staff key. Narrow your suspect list."],
      ],
    },
    {
      id: "switches",
      title: "The Patch Cable Puzzle",
      lines: [
        [
          "sherlock",
          "Someone unplugged the archive feed after the whisper played. These labels tell us which socket accepts which signal.",
        ],
        [
          "streamer",
          "Read before you plug. Last time Cornball patched it, the weather report started breathing.",
        ],
        ["cornball", "It was humid."],
      ],
      puzzle: puzzle(
        "sherlock-cable",
        "Do not feed the weather back into itself",
        "Build one signal path from microphone to antenna using all six components. Match socket codes, not similar-looking names. A connection must use the output of one piece and the input of the next.",
        [
          ["Microphone", "OUT M2. No input."],
          ["Preamp", "IN M2 → OUT L7."],
          [
            "Recorder",
            "IN L7 → OUT D4. The label “amplifier” has been crossed out.",
          ],
          ["Modulator", "IN D4 → OUT R9."],
          [
            "Amplifier",
            "IN R9 → OUT H1. Do not connect microphone-level audio here.",
          ],
          ["Antenna", "IN H1. No output."],
        ],
        [
          "Start at the only piece with no input.",
          "Recorder accepts L7, not R9; the amplifier belongs near the antenna.",
        ],
        "The full recording plays: four voices asking for their credits back. Somebody cut off that ending before airing the whisper.",
      ),
    },
    {
      id: "archive",
      title: "A Choir of Missing Names",
      lines: [
        [
          "watson",
          "The restored tape ends with four volunteers asking for their credits back. Your anniversary edit cut every name but yours.",
        ],
        ["streamer", "The editor said nobody watches credits."],
        ["watson", "Apparently the credits watch you."],
        ["streamer", "All right. That one hurt. Who made the broadcast?"],
      ],
    },
    {
      id: "voices",
      title: "Who Spoke Where?",
      lines: [
        [
          "sherlock",
          "Four original takes, four room logs. Their background noises overlap. Match the voices to studios before calling this one person’s revenge.",
        ],
        [
          "cornball",
          "I am not scared of a committee. I have survived a family reunion T-shirt vote.",
        ],
      ],
      puzzle: puzzle(
        "sherlock-voices",
        "Four rooms, four takes",
        "Place the witnesses under Studios A, B, C, D, left to right. A has a fan; B has a clock; C has rain against glass; D is soundproof. Studio A’s clock had been removed that morning.",
        [
          [
            "Watson",
            "No ticking in my take. I was not in the silent room or the room with an outside window.",
          ],
          [
            "Cornball",
            "My room had a mechanical background sound. Watson had the other mechanical room.",
          ],
          [
            "Alice",
            "Mine was not soundproof. Neither mechanical noise is on my take.",
          ],
          ["Streamer’s friend", "My take contains no fan, clock, or rain."],
        ],
        [
          "Place the silent take first, then eliminate rooms for Alice.",
          "Watson must be A. Cornball takes the remaining mechanical room, B.",
        ],
        "Every original take has a different room signature. The broadcast combines all four; somebody assembled it after recording.",
      ),
    },
    {
      id: "meeting",
      title: "The Collective Alibi",
      lines: [
        [
          "watson",
          "The four volunteers admit they spliced their takes together. The engineer scheduled 11:03: the exact point where the new edit drops their credits.",
        ],
        ["streamer", "They coordinated a haunting before sending one text?"],
        [
          "watson",
          "They sent twelve. You reacted to the last one with a flame emoji.",
        ],
        ["streamer", "I thought they were promoting something."],
        ["sherlock", "They were. Themselves."],
      ],
    },
    {
      id: "airtime",
      title: "A Fair Share of Air",
      lines: [
        [
          "streamer",
          "Credits are back in the upload. Tonight’s opening slot is still booked to my battle show. Beat my crew and we use that slot for the uncut tape.",
        ],
        ["cornball", "The apology got an undercard."],
        [
          "streamer",
          "And a real audience. Center closes in round three. Do not let chat coach you.",
        ],
      ],
      fight: ["streamer", "watson", "alice", "cheshire", "cornball", "plug"],
      twist: "outside",
      after: [
        [
          "streamer",
          "Uncut tape is live. Every name on screen, links in the description. I called the volunteers myself.",
        ],
        ["cornball", "Mine says “handclaps.”"],
        ["watson", "You clapped."],
        ["cornball", "With intention."],
      ],
    },
    {
      id: "signoff",
      title: "No More Dead Air",
      lines: [
        [
          "streamer",
          "11:03. No whisper. Just my old song and four people finally getting paid.",
        ],
        ["watson", "You still keeping “Miss Two Plates”?"],
        ["streamer", "Merch drops Friday. They get a cut."],
        [
          "sherlock",
          "Museum on line two. A trophy disappeared in front of a camera.",
        ],
        ["cornball", "Ask if the trophy had unpaid credits."],
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
          "Locked display. Unbroken recording. Trophy gone when the light changed.",
        ],
        [
          "watson",
          "Promoter advertised the original. The loan sheet says “image supplied.”",
        ],
        [
          "cornball",
          "After the film-reel mess? This man learns lessons on a free trial.",
        ],
        ["sherlock", "Do not convict him by sequel. Check the room."],
      ],
    },
    {
      id: "seats",
      title: "The Five Witnesses",
      lines: [
        [
          "alice",
          "The camera shows five chairs, but everybody remembers sitting somewhere important.",
        ],
        ["cornball", "I was important. I held two coats."],
        [
          "sherlock",
          "Rebuild the row. The side seats face mirrors; only the middle three face the pedestal.",
        ],
      ],
      puzzle: puzzle(
        "sherlock-seats",
        "Everybody remembers being VIP",
        "Rebuild five seats from left to right, facing the stage. Only seats 2, 3, and 4 had a direct view; the end seats faced mirrors. “Beside” means immediately adjacent.",
        [
          ["Watson", "I sat at an end. Sherlock was to my right, somewhere."],
          ["Alice", "I sat beside Watson, but not beside Promoter."],
          ["Cornball", "Alice and Promoter were my two neighbors."],
          ["Promoter", "Cornball sat immediately to my left."],
          ["Sherlock", "I took the other end; I could reach the right aisle."],
        ],
        [
          "The two end witnesses orient the entire row.",
          "Cornball must be in the middle, with Alice on his left.",
        ],
        "Cornball and Promoter could see the real pedestal. Sherlock and Watson saw the side reflection. Their accounts describe different views of the same display.",
      ),
    },
    {
      id: "reflection",
      title: "Mirror Match",
      lines: [
        [
          "alice",
          "The curator has a demo table in front of the display. Clear the scheduled match and we can move the lights without a crowd blocking the lens.",
        ],
        [
          "sherlock",
          "Center district closes in round three. Like the sightline: keep another angle open.",
        ],
      ],
      fight: ["alice", "cheshire", "sherlock", "watson", "nguyen", "scarecrow"],
      twist: "outside",
      after: [
        [
          "watson",
          "Move the light left: trophy. Move it right: bare pedestal. It is a reflected painting.",
        ],
        ["cornball", "I paid VIP to look at a JPEG with furniture."],
      ],
    },
    {
      id: "ledger",
      title: "Balance the Inventory",
      lines: [
        [
          "sherlock",
          "The reflection explains the vanishing. It does not tell us where the brass original went. Follow the custody marks.",
        ],
        [
          "watson",
          "Six handoffs. Every clerk swears their copy is the important one.",
        ],
      ],
      puzzle: puzzle(
        "sherlock-ledger",
        "Follow the brass, not the brochure",
        "Trace the original trophy from maker to final holder. Handoff codes connect OUT to IN. All six records belong in the chain. Photograph and replica notes do not transfer the brass object.",
        [
          ["Maker", "Serial 041. OUT K8. Original brass trophy."],
          ["School", "IN K8 → OUT M3. Kept a paper rubbing."],
          [
            "Library",
            "IN M3 → OUT R6. Sent museum a photograph, not the trophy.",
          ],
          ["Repair shop", "IN R6 → OUT P2. Polished original serial 041."],
          ["Courier", "IN P2 → OUT H9. Seal recorded intact."],
          [
            "Community hall",
            "IN H9. Serial 041 signed into the display cupboard; no outgoing record.",
          ],
        ],
        [
          "Start with the original’s maker; follow handoff codes.",
          "The photograph branches off at the library. The original continues to the repair shop.",
        ],
        "Serial 041 ends at the hall. The museum got a photograph. Its promise of an original was false before the supposed theft.",
      ),
    },
    {
      id: "promoter",
      title: "The Lie Without a Thief",
      lines: [
        [
          "promoter",
          "The loan email said image supplied. I read “image” as “image of success.”",
        ],
        ["watson", "You read two words and financed a delusion."],
        [
          "promoter",
          "Refunds were due tonight. I thought a theft would buy me a week.",
        ],
        ["sherlock", "Instead you bought six witnesses. At retail."],
      ],
    },
    {
      id: "proof",
      title: "Build the Public Explanation",
      lines: [
        [
          "sherlock",
          "He will call it an optical experience unless we can show exactly when he knew. Put the evidence in time order.",
        ],
        ["cornball", "I have a dramatic finger ready."],
        ["watson", "Keep it holstered."],
      ],
      puzzle: puzzle(
        "sherlock-proof",
        "When did he know?",
        "Arrange the evidence by actual time, earliest first. Two devices use the wrong clock: printer is 10 minutes fast, camera is 5 minutes slow. The email and payment server use correct time.",
        [
          [
            "Loan email — 14:00",
            "Server time. “Photograph only; brass original remains at the hall.” Opened on Promoter’s account.",
          ],
          [
            "Poster print — 14:14",
            "Printer time. “SEE THE ORIGINAL.” Job approved by Promoter.",
          ],
          [
            "First ticket sale — 14:06",
            "Payment-server time. Money accepted for the advertised original.",
          ],
          [
            "Spotlight moved — 14:04",
            "Camera time. Promoter turns the light away from the mirrored painting.",
          ],
          [
            "Theft announcement — 14:12",
            "Server time. Refund deadline postponed because of the alleged theft.",
          ],
        ],
        [
          "Correct the printer and camera clocks before comparing entries.",
          "The poster was printed at 14:04; the light moved at 14:09.",
        ],
        "He opened the photograph-only email before approving the poster. Then he moved the light after collecting ticket money. This was concealment, not a misunderstanding.",
      ),
    },
    {
      id: "final",
      title: "The Last Cross-Examination",
      lines: [
        [
          "promoter",
          "The closing tournament is already sold out. Its door money covers the refunds if we finish the card.",
        ],
        [
          "watson",
          "Refund money goes straight to the desk. You get no handling fee.",
        ],
        ["promoter", "I had not even said handling."],
        [
          "sherlock",
          "Six rounds. Your rival gains a Motion in round four. His crew has learned to save something for the end.",
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
          "Tournament receipts cover the missing balance. The refund desk counted it in front of him.",
        ],
        [
          "cornball",
          "He tried to call the coins “micro-investments.” We made him count again.",
        ],
      ],
    },
    {
      id: "repair",
      title: "Restitution, Not Applause",
      lines: [
        [
          "promoter",
          "Real trophy is here. Signed loan, matching serial, refunds paid. Somebody put my face on the warning sign.",
        ],
        ["watson", "It says CHECK THE DESCRIPTION."],
        [
          "cornball",
          "Passenger the cart gets free entry. Only guest with a clean record.",
        ],
      ],
    },
    {
      id: "casebook",
      title: "A Casebook for the Block",
      reward: "watson",
      lines: [
        [
          "watson",
          "One fake train ride, one revenge broadcast, one trophy that never got stolen.",
        ],
        [
          "sherlock",
          "And every person said, “I can explain.” Eventually, we made them.",
        ],
        ["cornball", "Put me down as associate detective."],
        ["watson", "You ate a receipt."],
        ["cornball", "It had barbecue sauce on it. Evidence expires."],
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
          "I took the last bus. Now we’re airborne, the transfer says EMERALD, and this man is shedding hay into the fare box.",
        ],
        [
          "scarecrow",
          "Keep your voice down. They don’t know I’m covering a shift.",
        ],
        ["dorothy", "The bus is in a cloud."],
        ["scarecrow", "And yet everybody still wants a stop request."],
      ],
    },
    {
      id: "map",
      title: "Yellow Paint, Missing Streets",
      lines: [
        [
          "scarecrow",
          "Wind took the route map. I kept the stop notes. Before you ask: no, I cannot eat them and remember.",
        ],
        ["dorothy", "Nobody asked that."],
        ["scarecrow", "Last passenger did. Loud, too."],
      ],
      puzzle: puzzle(
        "oz-route",
        "Six stops and a wet transfer",
        "Rebuild the route from shelter to terminal. Each sign gives stops remaining AFTER that stop. One sign lost its number, so use the transfer note. Visit every stop once.",
        [
          ["Storm shelter", "Five stops remain."],
          ["Straw market", "My missing number is one less than the shelter’s."],
          ["Copper bridge", "Three stops remain."],
          [
            "Lion square",
            "Between bridge and depot, with neither stop skipped.",
          ],
          ["Poppy depot", "One stop remains."],
          [
            "Emerald Terminal",
            "No stops remain. Transfers home are processed here.",
          ],
        ],
        [
          "Work backward from zero, then fill the missing number.",
          "Shelter is first, market second; square must be after bridge and before depot.",
        ],
        "Route restored. The return transfer points to Emerald. Oz controls the terminal—not the weather, whatever his billboard says.",
      ),
    },
    {
      id: "straw",
      title: "Scarecrow’s First Good Idea",
      lines: [
        [
          "scarecrow",
          "Oz says I need a brain certificate before I can drive the return route. Three favors and a processing fee.",
        ],
        ["dorothy", "You just rebuilt the route from six wet scraps."],
        ["scarecrow", "He said practical experience doesn’t count."],
        [
          "dorothy",
          "He charging you to believe your own head. That is nasty work.",
        ],
      ],
    },
    {
      id: "bridge",
      title: "The Copper Bridge",
      lines: [
        [
          "tinman",
          "Oz replaced my bridge controls with a sponsored battle kiosk. Winner opens the service lane. I built this bridge and now I need a promo code.",
        ],
        ["dorothy", "Who puts a leaderboard on a bridge?"],
        ["tinman", "A man who never carries groceries."],
      ],
      fight: ["tinman", "scarecrow", "plug", "earthy", "cornball", "watson"],
      after: [
        ["tinman", "Service lane’s open. I can get at the control box now."],
        ["scarecrow", "You stayed out here all storm?"],
        [
          "tinman",
          "Somebody had to keep folks off the broken section. Also, I rusted to the railing.",
        ],
      ],
    },
    {
      id: "heart",
      title: "A Heart Is a Verb",
      lines: [
        [
          "tinman",
          "Oz says he can install a heart. Premium plan includes empathy.",
        ],
        ["dorothy", "You lent your coat to three strangers."],
        ["tinman", "I want it back. One of them got mustard on the lining."],
        ["dorothy", "You can care and want your coat."],
      ],
    },
    {
      id: "courage",
      title: "Lion Won’t Roar",
      lines: [
        [
          "lion",
          "I was supposed to guard the depot. Then a pigeon made eye contact and I reassessed my calling.",
        ],
        ["dorothy", "You still warned everybody about the railing."],
        ["lion", "From a safe distance. In a voice I do not wish to discuss."],
        ["tinman", "Warning worked. Pigeon still unemployed."],
      ],
    },
    {
      id: "signal",
      title: "Crossing Signals",
      lines: [
        [
          "tinman",
          "Five operations. One battery. If the tram leaves before the brake test, we all become a cautionary mural.",
        ],
        [
          "scarecrow",
          "The scratched labels tell us what needs power and what has to happen before boarding.",
        ],
      ],
      puzzle: puzzle(
        "oz-signal",
        "One battery, no second chances",
        "Arrange all five bridge operations. The battery is connected once and stays on. Use the interlocks printed on the controls; an unsafe operation cannot be undone.",
        [
          [
            "Connect power",
            "No prerequisite. Every other control needs power.",
          ],
          [
            "Stop road traffic",
            "Must happen before the gate rises. Cannot be done once passengers start boarding.",
          ],
          [
            "Raise the gate",
            "Only after road traffic stops. Boarding through a closed gate is impossible.",
          ],
          [
            "Board and test brakes",
            "Passengers board through the raised gate. With their weight aboard, perform the stationary brake test.",
          ],
          [
            "Depart",
            "Requires the loaded brake test to pass; nobody boards after departure.",
          ],
        ],
        [
          "Find the operation that is possible with a dead battery.",
          "Road traffic must stop before the gate; boarding and brake test come before departure.",
        ],
        "The loaded brakes hold. Tin Man removes the sponsored kiosk from the service controls before anyone can sell the bridge again.",
      ),
    },
    {
      id: "poppies",
      title: "Last Tram Through the Poppies",
      lines: [
        [
          "lion",
          "Depot manager sold the last departure slot twice. Posted rule says a match settles the slot. I’m shaking, but I brought my deck.",
        ],
        [
          "dorothy",
          "Round three cuts one Motion from both crews. Save enough to finish.",
        ],
      ],
      fight: ["lion", "dorothy", "scarecrow", "tinman", "earthy", "plug"],
      twist: "reserve",
      after: [
        ["lion", "Did we win? I blinked with my whole body."],
        ["dorothy", "Doors open. Get on."],
        [
          "scarecrow",
          "Next stop: Emerald Terminal. Please have your fare and your unresolved issues ready.",
        ],
      ],
    },
    {
      id: "gates",
      title: "Emerald at Last",
      lines: [
        [
          "oz",
          "WELCOME TO EMERALD. YOUR POTENTIAL, NOW AVAILABLE IN THREE PAYMENT TIERS.",
        ],
        ["dorothy", "I need a ride home. Not a subscription to myself."],
        ["oz", "We call that the Journey package."],
        ["tinman", "Of course you do."],
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
          "Brains window one. Hearts window two. Courage window three. Refunds through the small door.",
        ],
        ["dorothy", "That door is painted on."],
        ["oz", "Low demand."],
        ["lion", "I knocked."],
      ],
    },
    {
      id: "receipts",
      title: "Four Promises, Four People",
      lines: [
        [
          "scarecrow",
          "He shuffled our claim tickets and said we missed our numbers.",
        ],
        [
          "dorothy",
          "Four numbered windows. Four witness slips. Match them. He is not making us buy our places twice.",
        ],
      ],
      puzzle: puzzle(
        "oz-claims",
        "He moved the windows again",
        "Place the four claimants at windows 1–4. Dorothy has window 4. Lion is beside Dorothy. Tin Man is not at an end. Scarecrow refuses any window whose number exceeds Tin Man’s.",
        [
          [
            "Scarecrow — brain",
            "Wants a certificate to drive the return route.",
          ],
          ["Tin Man — heart", "Wants the bridge work acknowledged."],
          ["Lion — courage", "Wants to stop mistaking fear for failure."],
          ["Dorothy — home", "Wants a return transfer, not an upgrade."],
        ],
        [
          "Place Dorothy, then her neighbor Lion.",
          "Tin Man cannot use 1 or 4, and 3 is occupied.",
        ],
        "All four claimants are at the right windows. All four windows lead to the same stool. Oz has run out of places to send them.",
      ),
    },
    {
      id: "projection",
      title: "A Very Large Face",
      lines: [
        ["oz", "STEP AWAY FROM THE CURTAIN. THAT IS A PRIVATE CLOUD."],
        [
          "tinman",
          "Your cloud is plugged into a power strip from the gas station.",
        ],
        ["dorothy", "And it smells like burnt popcorn."],
        ["oz", "The brand experience is still in development."],
      ],
    },
    {
      id: "screen",
      title: "The Grand Reveal",
      lines: [
        [
          "dorothy",
          "There he is. Little stool, big microphone. You’ve been selling people certificates for things they already do.",
        ],
        [
          "oz",
          "The terminal override is tied to my champion deck. You beat it, the service controls unlock. Six rounds.",
        ],
        ["tinman", "He made even his emergency exit a promotion."],
      ],
      fight: ["oz", "dorothy", "tinman", "lion", "scarecrow", "plug", "watson"],
      twist: "reinforce",
      after: [
        ["oz", "Override released. I can authorize a return tram."],
        ["dorothy", "You could do that the whole time?"],
        ["oz", "Yes."],
        ["lion", "I would like a minute with the painted refund door."],
      ],
    },
    {
      id: "storm-plan",
      title: "The Weather Window",
      lines: [
        [
          "scarecrow",
          "One clear weather window. Six log entries, three clocks that reset during the outage. We need the actual departure sequence.",
        ],
        [
          "tinman",
          "Read the marks on the tickets. If Oz says “trust the process,” unplug his microphone.",
        ],
      ],
      puzzle: puzzle(
        "oz-flight",
        "The tram log lost its clock",
        "Put six events in real order. The repair clock runs 6 minutes fast; the platform clock runs 3 minutes slow; weather radio is correct. No tied times. Find the departure window, not the order printed on the sheet.",
        [
          ["Power restored — 16:06", "Repair clock. Electrical test passes."],
          ["Brakes tested — 16:09", "Repair clock. Empty tram test passes."],
          [
            "Passengers loaded — 16:02",
            "Platform clock. Crew rechecks brakes under load.",
          ],
          [
            "Doors closed — 16:04",
            "Platform clock. Lion counts everyone aboard.",
          ],
          ["Tram departs — 16:09", "Weather-radio time. Route remains clear."],
          ["Storm returns — 16:07", "Platform clock. Service window closes."],
        ],
        [
          "Subtract six from repair times; add three to platform times.",
          "Loading is 16:05. Closing is 16:07. The storm returns at 16:10.",
        ],
        "The tram departs at 16:09, one minute before the storm returns. The route is workable, provided nobody delays departure for a speech.",
      ),
    },
    {
      id: "tickets",
      title: "No One Left on the Platform",
      lines: [
        [
          "lion",
          "Four people outside have expired tickets. The delay was ours.",
        ],
        ["oz", "I’ll waive the expiry."],
        ["dorothy", "And the waiver fee."],
        ["oz", "You cannot possibly know about—"],
        ["dorothy", "And the fee for telling us about the fee."],
      ],
    },
    {
      id: "last-stop",
      title: "Hold the Last Stop",
      lines: [
        [
          "tinman",
          "The depot kiosk still has the return route in its tournament lock. Final table controls the two outer switches. Middle shuts in round three.",
        ],
        [
          "dorothy",
          "We win, open both switches, and leave before this city invents a breathing surcharge.",
        ],
      ],
      fight: ["dorothy", "scarecrow", "lion", "tinman", "nguyen", "watson"],
      twist: "outside",
      after: [
        ["scarecrow", "Both switches clear. I stamped the route myself."],
        ["lion", "Is that official?"],
        [
          "scarecrow",
          "The man who sold the stamps is on our bus. He can file a complaint.",
        ],
      ],
    },
    {
      id: "home",
      title: "The Familiar Corner",
      lines: [
        [
          "dorothy",
          "Same busted curb. Same store. Ahki still arguing with somebody over sandwich geography. We home.",
        ],
        ["tinman", "I got my coat back."],
        ["lion", "I got a refund."],
        ["oz", "I have agreed to stop talking for the rest of the ride."],
      ],
    },
    {
      id: "shoes",
      title: "There Is No Place Like It",
      reward: "dorothy",
      lines: [
        [
          "dorothy",
          "I’m keeping the shoes. After all that walking, somebody owe me an accessory.",
        ],
        ["scarecrow", "Return route runs tomorrow. I’m driving."],
        ["lion", "I’ll check the platform."],
        ["tinman", "I’ll fix the railing."],
        [
          "dorothy",
          "Look at us. Whole transit department and not one magic diploma.",
        ],
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
          "My receipt says I arrived twelve minutes from now. They’ve already charged a late fee.",
        ],
        [
          "cheshire",
          "Service is terrible. You haven’t complained yet and they’ve blocked you.",
        ],
        ["alice", "Who owns this café?"],
        [
          "cheshire",
          "Follow the invoice. That’s how everyone gets to the Queen.",
        ],
      ],
    },
    {
      id: "sizes",
      title: "Small Door, Large Problem",
      lines: [
        [
          "alice",
          "The cake makes me tall. One whole bottle makes me tiny, no matter how tall I started. The key’s on a high shelf.",
        ],
        ["cheshire", "The door says PLEASE STOP KICKING ME."],
        ["alice", "The door knows what it did."],
      ],
      puzzle: puzzle(
        "alice-sizes",
        "Do not shrink without the key",
        "Start ordinary-sized. Use every action once. Cake makes Alice tall; drinking the WHOLE bottle makes her tiny from any starting size. Only tall Alice reaches the key; only tiny Alice reaches the lock and fits the doorway.",
        [
          [
            "Eat the cake",
            "Changes size to tall. The bottle and key can be carried afterward.",
          ],
          [
            "Pocket the key",
            "Requires tall size. Once pocketed, it changes size with Alice.",
          ],
          [
            "Drink the whole bottle",
            "Changes size to tiny. The bottle is used up.",
          ],
          [
            "Turn the key",
            "Requires tiny size AND the pocketed key. Unlocks the door.",
          ],
          ["Cross the doorway", "Requires tiny size and an unlocked door."],
        ],
        [
          "Shrinking is irreversible here, so check what must be collected first.",
          "Cake → key → bottle leaves Alice tiny with the key.",
        ],
        "Alice exits with the key in her pocket. The door requests that future complaints be made in writing, away from its hinges.",
      ),
    },
    {
      id: "tea",
      title: "A Seat for Tomorrow",
      lines: [
        [
          "cheshire",
          "The Queen lends each guest an hour. Then she charges another hour for staying to pay. I have been at brunch since Thursday.",
        ],
        ["alice", "It’s Tuesday."],
        ["cheshire", "I know. My eggs have a pension."],
        ["alice", "Where is the clock spring?"],
      ],
    },
    {
      id: "cups",
      title: "The Tea Service Trial",
      lines: [
        [
          "cheshire",
          "Host keeps the clock key in the table’s prize box. Win the service game, box opens. Round three takes one Motion: the Queen calls it gratuity.",
        ],
        ["alice", "A mandatory tip to leave. She got bottle-service morals."],
      ],
      fight: ["cheshire", "alice", "scarecrow", "cornball", "plug", "watson"],
      twist: "reserve",
      after: [
        [
          "cheshire",
          "Clock key, three spoons, invoice for the silence after your joke.",
        ],
        [
          "alice",
          "Keep the invoice. We’re going to need proof of how stupid this gets.",
        ],
      ],
    },
    {
      id: "cups-puzzle",
      title: "Who Drank What?",
      lines: [
        [
          "alice",
          "Someone hid the clock spring in a cup. The table photo has the seats; the receipts have the drinks. Match them without swallowing the evidence.",
        ],
        ["cheshire", "That feels directed at me."],
        ["alice", "You ate a saucer."],
      ],
      puzzle: puzzle(
        "alice-cups",
        "Four cups, one stolen spring",
        "Assign cups to Alice, Cheshire, Clockkeeper, Queen in that order. Alice refuses hot drinks. Clockkeeper needs a spoon to time his shift. Cheshire’s cup weighs nothing. Nobody shares.",
        [
          ["Iced lemon", "Cold. Liquid. No spoon."],
          [
            "Empty cup",
            "No liquid, no spoon, no weight. Somehow still on the bill.",
          ],
          ["Black tea", "Hot. Liquid. Contains the table’s only spoon."],
          [
            "Rose tea",
            "Hot. Liquid. No spoon. A metal glint under the crown-shaped sugar.",
          ],
        ],
        [
          "Start with weight and temperature; two cups are forced.",
          "Only black tea has the Clockkeeper’s spoon. Rose tea is left for the Queen.",
        ],
        "The spring is in the Queen’s rose tea. Her own cup stopped the clock while she billed everyone for staying.",
      ),
    },
    {
      id: "grin",
      title: "The Cat’s Actual Name",
      lines: [
        ["cheshire", "I could leave through the wall. Been able to all day."],
        ["alice", "Then why are you here?"],
        [
          "cheshire",
          "Last time I left early, she posted “some people show you who they are” with my silhouette.",
        ],
        [
          "alice",
          "You’re a floating grin. That could be any dental practice. Get your coat.",
        ],
      ],
    },
    {
      id: "clock",
      title: "An Hour for Everybody",
      lines: [
        [
          "alice",
          "Spring recovered. Her clock stores borrowed hours in six numbered drawers. We reset them in order, everybody gets their afternoon back.",
        ],
        [
          "cheshire",
          "Please find Thursday. My parking meter is raising my children.",
        ],
      ],
      puzzle: puzzle(
        "alice-clock",
        "Give the hours back",
        "Arrange six hour-drawers from smallest debt to largest. Every drawer has a different whole-hour debt, 1 through 6. Read the relationships; the labels are amounts, not assembly directions.",
        [
          ["Clockkeeper", "Owes one hour."],
          [
            "Door",
            "Owes one more hour than Clockkeeper. It stayed late for repairs.",
          ],
          ["Alice", "Owes twice the Clockkeeper’s debt, plus one."],
          ["Cheshire", "Owes twice the Door’s debt."],
          ["Kitchen", "Owes one less than the Queen."],
          ["Queen", "Owes six hours. She quietly borrowed from her own clock."],
        ],
        [
          "Turn each relationship into a number before ordering.",
          "Alice owes 3; Cheshire owes 4. Kitchen falls between Cheshire and Queen.",
        ],
        "The drawers release 1, 2, 3, 4, 5, 6 hours. The Queen owed the most. Her late-fee speech ages badly in real time.",
      ),
    },
    {
      id: "leave",
      title: "Permission to Leave",
      lines: [
        ["queenofhearts", "NOBODY LEAVES MY TABLE UNDEFEATED."],
        [
          "alice",
          "You printed that on a napkin. Fine. Goodbye game. Center closes in round three; we take the other exits.",
        ],
        ["cheshire", "Put my debt on her room. She owns the building."],
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
        [
          "alice",
          "Clock’s running. Doors open. Everybody take your leftovers.",
        ],
        ["queenofhearts", "YOU WILL HEAR FROM MY COURT."],
        ["cheshire", "Can it email? I’m not coming back for tea."],
      ],
    },
    {
      id: "summons",
      title: "Court of the Unfinished Sentence",
      lines: [
        ["alice", "The summons says “You are hereby guilty of.” That’s it."],
        ["cheshire", "Leave the blank empty. She charges by the confession."],
        [
          "alice",
          "I’m bringing the napkin, the receipts, and this cold biscuit. One of them is a weapon.",
        ],
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
        ["queenofhearts", "You left before the host finished saying goodbye."],
        ["alice", "You were on goodbye number nineteen."],
        ["queenofhearts", "The law is clear."],
        ["alice", "Then why is the clerk still writing it?"],
      ],
    },
    {
      id: "sentence",
      title: "The Traveling Comma",
      lines: [
        [
          "cheshire",
          "Her gold seal fell off the original napkin. The words underneath got cut into strips for the shredder.",
        ],
        [
          "alice",
          "Rebuild the actual promise. She can yell after we know what she signed.",
        ],
      ],
      puzzle: puzzle(
        "alice-decree",
        "The promise under the seal",
        "Rebuild the five strips into the Queen’s original sentence. The torn-edge codes connect: the right edge of one strip matches the left edge of the next. START and END are outside edges. Read the result before submitting.",
        [
          ["Every guest", "Edges: START → crown."],
          ["may", "Edges: crown → spoon."],
          ["leave the party", "Edges: spoon → rose."],
          ["when", "Edges: rose → bell."],
          ["the bell rings", "Edges: bell → END."],
        ],
        [
          "Find START, then match the tear codes.",
          "The permission “may” joins the guest to the action; the bell ends the sentence.",
        ],
        "“Every guest may leave the party when the bell rings.” The gold seal covered the word “may.” Alice kept the signed napkin.",
      ),
    },
    {
      id: "guard",
      title: "Cards on the Witness Stand",
      lines: [
        ["queenofhearts", "THE GUARDS WILL DEFEND THE HONOR OF MY TABLE."],
        [
          "alice",
          "Five rounds for access to the clerk’s exhibits. Say it now. I’m done discovering the rules at checkout.",
        ],
        ["queenofhearts", "Five. And no folding the guards."],
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
          "One guard folded himself under pressure. We should get him laminated.",
        ],
        [
          "alice",
          "Evidence drawer is open. Fresh ink, carbon sheet, delivery slip. Let’s compare.",
        ],
      ],
    },
    {
      id: "evidence",
      title: "Yesterday’s Wet Ink",
      lines: [
        [
          "alice",
          "Law says yesterday. Delivery slip says the blank paper arrived today. Seal’s stuck to the lunch menu.",
        ],
        ["queenofhearts", "My stationery moves differently."],
        ["cheshire", "So does fraud, apparently."],
      ],
    },
    {
      id: "order",
      title: "Which Came First?",
      lines: [
        [
          "alice",
          "The clerk’s stamps survived. Rebuild the sequence and we can prove she wrote the rule after we left.",
        ],
        ["queenofhearts", "THE CALENDAR IS BIASED."],
        [
          "cheshire",
          "It gives you a whole birthday every year. What else you want?",
        ],
      ],
      puzzle: puzzle(
        "alice-law",
        "Yesterday has wet ink",
        "Order the five exhibits by their recorded sequence. Kitchen bell rings at noon. The clerk’s desk clock is 10 minutes fast; courier receipts use the correct clock.",
        [
          [
            "Blank paper delivered — 11:55",
            "Courier receipt. The packet is opened on camera, pages blank.",
          ],
          [
            "Guests leave — bell",
            "Kitchen bell. Queen’s napkin permits departure at this signal.",
          ],
          [
            "Rule written — 12:16",
            "Clerk clock. Writing appears on the newly delivered page.",
          ],
          [
            "Seal applied — 12:18",
            "Clerk clock. Gold seal crosses a wet word.",
          ],
          [
            "Summons delivered — 12:12",
            "Courier receipt. Quotes the newly sealed rule.",
          ],
        ],
        [
          "The clerk’s readings must go backward ten minutes.",
          "Writing happened at 12:06, sealing at 12:08, summons at 12:12.",
        ],
        "The guests left at noon. The new rule was written six minutes later. The Queen’s date cannot change the recorded sequence.",
      ),
    },
    {
      id: "choice",
      title: "The Queen’s Smallest Voice",
      lines: [
        [
          "queenofhearts",
          "If I let people leave, how do I know they’ll come back?",
        ],
        ["alice", "Serve hot food. Stop invoicing friendship."],
        ["queenofhearts", "I spent all week arranging the table."],
        [
          "cheshire",
          "And all week keeping us at it. The flowers have started a family.",
        ],
      ],
    },
    {
      id: "verdict",
      title: "One Last Hand",
      lines: [
        [
          "queenofhearts",
          "The old charge is dismissed. One final match. Winner writes next week’s invitation.",
        ],
        ["alice", "No compulsory attendance, no time debt. Those are settled."],
        [
          "queenofhearts",
          "Fine. Six rounds. I get an extra Motion in round four.",
        ],
        ["cheshire", "Look at her. Announcing the scam in advance. Growth."],
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
          "Your invitation says “come through if you feel like it.” That’s the entire thing?",
        ],
        ["alice", "Address on the back."],
        ["queenofhearts", "It feels naked."],
        ["cheshire", "Put a crown on the envelope. You’ll live."],
      ],
    },
    {
      id: "door",
      title: "An Open Door",
      lines: [
        ["cheshire", "I’m heading out."],
        ["queenofhearts", "Would you like a plate?"],
        ["cheshire", "A plate I can take outside?"],
        ["queenofhearts", "Do not make this difficult."],
        ["alice", "That’s a yes. Grab two."],
      ],
    },
    {
      id: "home",
      title: "Full Stop",
      reward: "alice",
      lines: [
        ["alice", "Receipt says twelve minutes. We were gone two days."],
        ["cheshire", "Time refund. No store credit."],
        ["alice", "Good. I’m taking a nap."],
        ["cheshire", "Queen sent a reminder."],
        ["alice", "Mute it."],
        ["cheshire", "Already did. Felt incredible."],
      ],
    },
  ],
  "red-fence-night-court",
);

const yasuke = chapter(
  "yasuke-banner-without-master",
  27,
  "A Banner Without a Master",
  "A festival sells Yasuke’s face before asking. Its sponsor wants the children out once the cameras leave.",
  "yasuke",
  "block-party",
  [
    {
      id: "arrival",
      title: "The Borrowed Banner",
      lines: [
        ["yasuke", "Why is my face advertising VIP sword lessons?"],
        ["promoter", "Preliminary enthusiasm. The printer got ahead of us."],
        [
          "yasuke",
          "The printer also wrote “touch the blade, touch greatness”?",
        ],
        ["cornball", "For forty dollars, I expected at least a small cut."],
      ],
    },
    {
      id: "terms",
      title: "Before the First Bow",
      lines: [
        [
          "promoter",
          "Tournament money repairs the youth courtyard. Sponsor wants private-club rights after the opening.",
        ],
        [
          "yasuke",
          "So the children pay with their faces and leave when the cameras do.",
        ],
        ["promoter", "When you phrase it like that—"],
        ["yasuke", "How did you phrase it?"],
        ["promoter", "Legacy access."],
        ["yasuke", "Bring the contract."],
      ],
    },
    {
      id: "banners",
      title: "Read the Signals",
      lines: [
        [
          "yasuke",
          "The marshals received four contradictory signal cards. Somebody translated “clear the floor” as “clear the neighborhood.”",
        ],
        ["cornball", "I sent everybody home. Very efficient, very lonely."],
        [
          "yasuke",
          "Use the constraints. Let the young marshal call the sequence. She has actually read them.",
        ],
      ],
      puzzle: puzzle(
        "yasuke-signals",
        "The marshal’s disputed signals",
        "Arrange the four banners into a valid opening. Red cannot precede gold. Blue immediately follows white. Gold is neither first nor second. These constraints are from the signed marshal sheet, not the sponsor’s flyer.",
        [
          ["White square", "Clear equipment and open exits."],
          ["Blue circle", "Inspect the cleared floor."],
          ["Gold stripe", "Admit spectators to the marked seats."],
          ["Red sun", "Begin play."],
        ],
        [
          "Blue and white form a pair. Gold needs a later slot, with red still after it.",
          "Gold must be third, leaving white and blue first and second.",
        ],
        "The young marshal opens the court correctly. The sponsor’s “VIP entry first” flyer goes in the bin.",
      ),
    },
    {
      id: "lesson",
      title: "A Shield for the Smallest",
      lines: [
        [
          "yasuke",
          "Sponsor’s qualifier closes the middle in round three. Hold the outer districts. Charging the biggest target is how you leave a door unguarded.",
        ],
        ["promoter", "Can you say that while pointing at the logo?"],
        ["yasuke", "I can point at the exit."],
      ],
      fight: ["yasuke", "tinman", "watson", "cornball", "scarecrow", "plug"],
      twist: "outside",
      after: [
        ["cornball", "Crowd got louder for the save than the big hit."],
        ["yasuke", "The save was harder."],
        [
          "promoter",
          "Sponsor asked whether we could save with more brand visibility.",
        ],
      ],
    },
    {
      id: "contract",
      title: "No Signature in the Margin",
      lines: [
        [
          "yasuke",
          "The posted contract and the sponsor’s copy disagree. Track the edits. Someone removed the free hours after the youth organizer signed.",
        ],
        ["promoter", "That may be a version-control issue."],
        ["yasuke", "Then we will control the version."],
      ],
      puzzle: puzzle(
        "yasuke-contract",
        "Catch the switched copy",
        "Order five versions of the agreement by their physical evidence. New marks remain on later copies unless a note explicitly says a clause was removed. Find when free public hours disappeared.",
        [
          [
            "Draft A",
            "Plain text. No signatures, stamp, or free-hours clause.",
          ],
          ["Youth copy", "Adds free hours; no signature or stamp."],
          [
            "Signed copy",
            "Free hours plus the organizer’s signature. No sponsor stamp.",
          ],
          [
            "Sponsor copy",
            "Same signature, sponsor stamp; free-hours paragraph removed.",
          ],
          [
            "Filed correction",
            "Both marks retained. Free hours restored and margin initialed by both parties.",
          ],
        ],
        [
          "Track additions first. A later deletion does not make a copy an earlier draft.",
          "The sponsor stamp first appears on the version that removes free hours.",
        ],
        "The sponsor removed public access after the organizer signed. The filed correction restores it with both initials; the original alteration remains visible in the record.",
      ),
    },
    {
      id: "challenge",
      title: "The Sponsor’s Champion",
      lines: [
        [
          "yasuke",
          "The restored agreement is filed. Now his champion wants the final match and the naming rights on the trophy.",
        ],
        ["cornball", "Call it the Read Before You Sign Invitational."],
        [
          "yasuke",
          "Six rounds. He gains a Motion in round four. Watch his reserve, not his entrance.",
        ],
      ],
      fight: ["yasuke", "lion", "oz", "tinman", "scarecrow", "watson", "plug"],
      twist: "reinforce",
      after: [
        [
          "promoter",
          "Champion lost. Sponsor wants the trophy cropped out of the recap.",
        ],
        ["yasuke", "Use a wider frame."],
        ["cornball", "I’m filming horizontal out of spite."],
      ],
    },
    {
      id: "name",
      title: "Who Gets the Banner?",
      lines: [
        ["promoter", "Your portrait over the gate?"],
        ["yasuke", "Opening hours."],
        ["cornball", "My portrait by the snack stand?"],
        ["yasuke", "Prices."],
        ["promoter", "You’re difficult to merchandise."],
        ["yasuke", "You are finding out slowly."],
      ],
    },
    {
      id: "opening",
      title: "The Smallest Champion",
      lines: [
        [
          "promoter",
          "Young marshal gets the ribbon. She wants to know if you can cut it with the sword.",
        ],
        ["yasuke", "Scissors."],
        ["cornball", "But the footage—"],
        ["yasuke", "Scissors."],
        ["promoter", "She brought her own. Doesn’t trust any of us."],
      ],
    },
    {
      id: "bow",
      title: "The Bow Goes Both Ways",
      reward: "yasuke",
      lines: [
        [
          "yasuke",
          "Keep the courtyard open. Keep the names of the people who fixed it on the wall.",
        ],
        ["promoter", "And no VIP sword lessons."],
        ["yasuke", "Now you have understood."],
        ["cornball", "What about regular sword questions?"],
        ["yasuke", "You have reached your limit."],
      ],
    },
  ],
  "crown-rooftop-court",
);
const inmate = chapter(
  "cellblock-library-hour",
  28,
  "The Library Hour",
  "Kingpin sells five aliases the same library seats. Crafty follows the stamps, books, and noodles.",
  "inmate-crafty",
  "block-party",
  [
    {
      id: "shelf",
      title: "A Dictionary Holding Up the Building",
      lines: [
        [
          "inmate-crafty",
          "Three shelves, two legs, and a dictionary doing structural work. Welcome to the library.",
        ],
        ["inmate-boyfriend", "I donated poetry."],
        [
          "inmate-contraband",
          "He donated letters his ex returned. There is a difference.",
        ],
        [
          "inmate-informant",
          "Opening notice disappeared. Kingpin’s charging noodles to reserve seats in a room that isn’t open.",
        ],
      ],
    },
    {
      id: "rumor",
      title: "The Cost of a Rumor",
      lines: [
        [
          "inmate-contraband",
          "A paper goes missing and everybody turns toward me. I got range. It could’ve been a chair.",
        ],
        [
          "inmate-crafty",
          "Nobody accusing you. Yet. We need the approval copies.",
        ],
        ["inmate-informant", "I can get those."],
        ["inmate-boyfriend", "Of course you can."],
        [
          "inmate-informant",
          "Y’all love a source until the source has a face.",
        ],
      ],
    },
    {
      id: "forms",
      title: "The Paper Trail",
      lines: [
        [
          "inmate-crafty",
          "Five stamped copies. Different clocks, different initials. Find when the real room assignment got swapped.",
        ],
        [
          "inmate-contraband",
          "Kingpin’s receipt says “educational hospitality fee.” That’s ramen with a tie on.",
        ],
      ],
      puzzle: puzzle(
        "cellblock-forms",
        "Five stamps, two bad clocks",
        "Order the room’s five approval records in actual time. Library clock is 5 minutes slow. Unit-office clock is 8 minutes fast. All other stamps are correct. The posted opening notice should match the last approved record.",
        [
          ["Library — 09:05", "Library clock. Books and shelves accepted."],
          ["Safety — 09:12", "Correct clock. Exit and room check passed."],
          [
            "Schedule — 09:14",
            "Correct clock. Room assigned for Tuesday, this month.",
          ],
          [
            "Unit office — 09:24",
            "Unit-office clock. Tuesday assignment confirmed.",
          ],
          [
            "Notice board — 09:18",
            "Correct clock. Photograph shows Thursday pasted over Tuesday.",
          ],
        ],
        [
          "Convert library forward five minutes and unit office backward eight.",
          "Real approvals run 09:10, 09:12, 09:14, 09:16, 09:18.",
        ],
        "Tuesday survived every approval. Thursday appears only on the notice board. Compare the pasted date with Kingpin’s seat ledger.",
      ),
    },
    {
      id: "yard",
      title: "First Pick, Dirty Bookmark",
      lines: [
        [
          "inmate-boyfriend",
          "Kingpin’s book crew won first pick at the donation table. Posted challenge gets us the next pick. I want the ledger he’s using as a bookmark.",
        ],
        [
          "inmate-crafty",
          "You want the ledger. Not the romance novel wrapped around it.",
        ],
        ["inmate-boyfriend", "Two things can be true."],
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
          "Seat payments in the margin. He reserved every chair under a different nickname.",
        ],
        [
          "inmate-contraband",
          "Big K, Medium K, K Junior. Criminal empire brought down by no imagination.",
        ],
      ],
    },
    {
      id: "stamps",
      title: "Tuesday Got Repossessed",
      lines: [
        [
          "inmate-informant",
          "Kingpin pasted last month’s Tuesday onto this month’s notice. Told everybody the opening got postponed; sold priority seats for the real day.",
        ],
        ["inmate-crafty", "So the room is approved. The lie is on the board."],
        [
          "inmate-boyfriend",
          "My ex used to reschedule accountability like that.",
        ],
      ],
    },
    {
      id: "shelves",
      title: "The Shelf Cipher",
      lines: [
        [
          "inmate-crafty",
          "His five aliases each borrowed one book. The return slips tell us which. Put the books under the aliases and match them to the seat ledger.",
        ],
        [
          "inmate-contraband",
          "He hiding a monopoly in a book club. I respect the concept. Hate the execution.",
        ],
      ],
      puzzle: puzzle(
        "cellblock-shelves",
        "One man, five library cards",
        "Assign the five books to aliases A, B, C, D, E in that order. A borrowed practical diagrams. B borrowed neither stories nor history. C borrowed nonfiction but no how-to book. D borrowed prose fiction. E took what remained.",
        [
          [
            "Fix the Wobble",
            "Nonfiction repair diagrams. How to brace tables.",
          ],
          [
            "One Pot, Many Plates",
            "Nonfiction how-to recipes. No repair diagrams.",
          ],
          [
            "Before This Block",
            "Nonfiction neighborhood history. No instructions.",
          ],
          ["The Ninth Passenger", "A prose mystery. Fiction, no verses."],
          ["Window Light", "Poetry collection. Fiction in verse."],
        ],
        [
          "Place the diagrams and prose mystery first.",
          "History belongs to C; cooking is the only remaining match for B.",
        ],
        "Every return slip has Kingpin’s same borrower stamp under a different alias. Those aliases match all five “reserved” seats in his ledger.",
      ),
    },
    {
      id: "opening-match",
      title: "Read This Hand",
      lines: [
        [
          "inmate-kingpin",
          "Y’all got my ledger. Cute. The room roster still follows the posted opening tournament. Beat my crew; you run the first hour.",
        ],
        ["inmate-crafty", "And your fake reservations come off the board now."],
        ["inmate-kingpin", "Already off. Six rounds. Try reading this hand."],
      ],
      fight: [
        "inmate-kingpin",
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
          "inmate-crafty",
          "First hour is open seating. Noodles refunded out of his stash.",
        ],
        ["inmate-boyfriend", "He asked for a tax receipt."],
        ["inmate-contraband", "I gave him a bookmark that says BE SERIOUS."],
      ],
    },
    {
      id: "first-reader",
      title: "The First Reader",
      lines: [
        ["inmate-boyfriend", "First reader been on page one a minute."],
        ["inmate-crafty", "Then stop watching him like a loading screen."],
        ["inmate-informant", "Want me to help?"],
        ["inmate-crafty", "Ask him."],
        ["inmate-informant", "Right. Ask. Wild little concept."],
      ],
    },
    {
      id: "bookmark",
      title: "Leave a Bookmark",
      reward: "inmate-crafty",
      lines: [
        [
          "inmate-crafty",
          "Shelf held. Room full. Tomorrow we fix the second table.",
        ],
        [
          "inmate-contraband",
          "Found a legal screwdriver. My reputation may never recover.",
        ],
        ["inmate-boyfriend", "Kingpin signed up for poetry."],
        ["inmate-crafty", "Good. He owes us a different kind of sentence."],
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
          "Leon. Before you say “my brother” six times because you don’t know my name.",
        ],
        ["cornball", "Cornball."],
        ["homelessguy", "That your name or a warning?"],
        ["cornball", "Depends who’s asking."],
        [
          "homelessguy",
          "Grab the other handle. Rain’s coming and Passenger only got one wheel with ambition.",
        ],
      ],
    },
    {
      id: "storm",
      title: "Where the Water Goes",
      lines: [
        [
          "homelessguy",
          "Underpass floods first. Church gate sticks. Library outlets shut off at six. We need the kitchen before this sky makes a decision.",
        ],
        ["delivery", "You know every shortcut?"],
        [
          "homelessguy",
          "I know which shortcuts owe me shoes. Different education.",
        ],
      ],
    },
    {
      id: "dry-route",
      title: "A Dry Way Across",
      lines: [
        [
          "homelessguy",
          "Six dry checkpoints. Delivery app keeps recommending stairs to a cart. Use the access notes.",
        ],
        ["cornball", "Mine says “walk through fence.”"],
        [
          "homelessguy",
          "Your phone is trying to get you arrested. Put it away.",
        ],
      ],
      puzzle: puzzle(
        "leon-route",
        "The app wants us in the canal",
        "Rebuild the six-checkpoint dry route, library to kitchen. Every stop is used once. Pharmacy is immediately before the church. Church is fourth. Shelter comes before pharmacy. Garden is immediately before the kitchen.",
        [
          ["Library", "Start. Step-free side exit; charging ends at six."],
          [
            "Bus shelter",
            "Dry curb ramp. Must be reached before the pharmacy shutters close.",
          ],
          [
            "Pharmacy walkway",
            "Wide enough for Passenger. Next passage reaches the church.",
          ],
          [
            "Church ramp",
            "Fourth checkpoint. Rear gate has now been unjammed.",
          ],
          ["Garden path", "Flat path beside the kitchen. No stairs."],
          ["Community kitchen", "End. Dry storage and outlets."],
        ],
        [
          "Fix endpoints and fourth checkpoint, then fill adjacent pairs.",
          "Pharmacy is third. Garden is fifth. Shelter gets the remaining slot.",
        ],
        "The dry route avoids the flooded underpass and both stairways. Leon marks the repaired gate so the next person does not trust an old map.",
      ),
    },
    {
      id: "supplies",
      title: "Nothing to Lose, Something to Save",
      lines: [
        [
          "delivery",
          "Dry loading bay goes to the winner of today’s driver table. Other bay’s a puddle with an address.",
        ],
        [
          "homelessguy",
          "Then we take the dry one. Round three cuts Motion. Don’t spend everything trying to look rich on arrival.",
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
          "Dry bay secured. We can leave the supplies here for your appointment.",
        ],
        ["homelessguy", "Get a signed receipt."],
        ["cornball", "Even from him?"],
        ["homelessguy", "Especially from somebody smiling that hard."],
      ],
    },
    {
      id: "address",
      title: "An Address for the Paperwork",
      lines: [
        [
          "homelessguy",
          "My appointment letter went to my old place. Landlord offered to sell it back as a document-recovery service.",
        ],
        ["watson", "The caseworker can issue a replacement."],
        [
          "homelessguy",
          "Already asked. Need a charged phone to confirm the desk.",
        ],
        ["cornball", "Landlord monetized an envelope."],
        ["homelessguy", "He’d put a turnstile on a hug."],
      ],
    },
    {
      id: "appointments",
      title: "One Afternoon, Four Stops",
      lines: [
        [
          "homelessguy",
          "We got closing times, walking times, one phone on one percent, and Cornball trying to stop for a haircut.",
        ],
        ["cornball", "A clean lineup changes the day."],
        ["homelessguy", "So does making the appointment. Work the route."],
      ],
      puzzle: puzzle(
        "leon-day",
        "One afternoon. No teleporting.",
        "Start at the kitchen at 12:00. Charge takes 20 minutes; call takes 10. Walk kitchen→letter desk: 20, desk→appointment: 30, appointment→supplies: 20 minutes. Letter pickup takes 10 minutes and closes at 13:10. Appointment is 14:00–14:30; supplies open at 15:00. Use each task once; waiting is allowed.",
        [
          [
            "Charge phone",
            "Kitchen outlet. Needed for the call. Supplies depot has no outlet.",
          ],
          [
            "Confirm letter desk",
            "Call from the kitchen with the charged phone. Desk releases the replacement only after this call.",
          ],
          [
            "Collect letter",
            "Bring the call confirmation. Must finish before desk closes at 13:10.",
          ],
          [
            "Attend appointment",
            "Needs the letter. Fixed start 14:00, finish 14:30.",
          ],
          [
            "Collect supplies",
            "At or after 15:00. The signed storage receipt is already in Leon’s pocket.",
          ],
        ],
        [
          "Work backward from the letter desk closing time; do not go to supplies first.",
          "Charge ends 12:20; call 12:30; letter pickup finishes 13:00. Reach appointment by 13:30 and wait.",
        ],
        "Letter collected by 13:00. Appointment reached at 13:30. After the meeting, reach supplies at 14:50 and wait ten minutes. Cornball’s haircut is not on this route.",
      ),
    },
    {
      id: "space",
      title: "The Community Court",
      lines: [
        [
          "homelessguy",
          "Appointment’s done. Last job: win the court’s mural table so the dry-route map gets painted where folks can see it.",
        ],
        ["cornball", "Other crew’s pitching angel wings for selfies."],
        [
          "homelessguy",
          "Mine gets you somewhere. Center closes in round three. Hold the edges.",
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
        [
          "cornball",
          "Big arrows, closing times, charging points. You putting your face on it?",
        ],
        [
          "homelessguy",
          "No. People need directions, not another man pointing at himself.",
        ],
      ],
    },
    {
      id: "key",
      title: "Check the Key Before the DJ",
      lines: [
        [
          "homelessguy",
          "Room available next week. I’ve got the address, the paperwork list, and a pickup booked.",
        ],
        ["delivery", "Tuesday at ten. Passenger rides free."],
        ["cornball", "Should we do a big key ceremony?"],
        ["homelessguy", "We should check the key works before you hire a DJ."],
      ],
    },
    {
      id: "return",
      title: "My Name on the Door",
      reward: "homelessguy",
      lines: [
        ["watson", "Map credit: Leon, route designer?"],
        [
          "homelessguy",
          "That’ll do. Leave room for updates. Gates change. People close early.",
        ],
        ["cornball", "Can I put assistant route designer?"],
        ["homelessguy", "You got lost carrying the paint."],
        ["cornball", "Creative detour."],
        ["homelessguy", "Put paint consultant. Small letters."],
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
