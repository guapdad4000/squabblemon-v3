import { completeEngineCrew } from "./data";
import type { StoryEncounterSnapshot } from "./gameEngine";
import type { StoryChapter, StoryCinematic, StoryDialogueLine, StoryNode, StoryReward, StoryStarObjective } from "./story";
import type { StoryPuzzleDefinition } from "./storyPuzzles";

const root = "assets/story/squabble-house";
const portraits = {
  Manager: "C01_manager", Blue: "C02_blue", Red: "C03_red", "Red OG": "C04_red_og",
  "Blue OG": "C05_blue_og", "Blue Titan": "C06_blue_titan", Pigeon: "C07_pigeon",
  Cuff: "C08_cuff", Griddle: "C09_griddle", Mop: "C10_mop", Security: "C11_security", "tek-KEN": "C12_tek_ken",
} as const;
type Speaker = keyof typeof portraits;
const say = (speaker: Speaker, text: string): StoryDialogueLine => ({ speaker, text, portraitAssetId: `${root}/cast/${portraits[speaker]}.webp` });
const film = (chapter: number): StoryCinematic => {
  const name = `ch${String(chapter).padStart(2, "0")}`;
  return { videoAssetId: `${root}/media/${name}.mp4`, posterAssetId: `${root}/keyframes/${name}.webp`, environmentAssetId: `${root}/environments/${name}.webp` };
};

/** Encounter crews use existing playable cards. Red/Blue are cinematic cast, not invented collection cards. */
export const SQUABBLE_HOUSE_ENEMY_CREWS = {
  blood: completeEngineCrew(["block-spinner", "redside1", "ganger-red", "cane-corso-red", "initiation", "cornball", "baby", "bikelife", "vibe", "plug"]),
  crip: completeEngineCrew(["triple-og-blue", "look-out", "blueside1", "ganger-blue", "blue-nose-pit", "initiation", "waterboy", "alchy", "cognac", "bustdown"]),
  bloodOg: completeEngineCrew(["triple-og-red", "block-spinner", "redside1", "ganger-red", "cane-corso-red", "initiation", "redneck-evil", "folks", "cognac", "bustdown"]),
  cripTitan: completeEngineCrew(["triple-og-blue", "look-out", "blueside1", "ganger-blue", "blue-nose-pit", "initiation", "waterboy", "alchy", "cognac", "partytitan"]),
  rivals: completeEngineCrew(["triple-og-red", "block-spinner", "redside1", "ganger-red", "cane-corso-red", "triple-og-blue", "look-out", "blueside1", "ganger-blue", "blue-nose-pit"]),
} as const;

/** An optional collection goal, never an ownership bypass or a replacement for the player's submitted deck. */
export const SQUABBLE_HOUSE_SUGGESTED_CREW = [
  "squabble-house-manager", "squabbleserver", "squabblecook", "janitor", "cornball",
  "plug", "wifey", "roaster", "soulfood", "energydrink",
] as const;

/** Temporary encounter support lets a fresh collection try the House synergy before earning its cards. */
const shiftSupport: readonly (readonly [string, string])[] = [
  ["squabble-house-manager", "squabbleserver"],
  ["squabbleserver", "squabblecook"],
  ["squabblecook", "squabble-house-manager"],
  ["squabblecook", "janitor"],
  ["janitor", "squabble-house-manager"],
  ["squabble-house-manager", "janitor"],
];
const supportNames: Readonly<Record<string, string>> = {
  "squabble-house-manager": "Squabble House Manager", squabbleserver: "Squabble House server",
  squabblecook: "Squabble House cook", janitor: "Janitor",
};

type PuzzleLayout = "tickets" | "register" | "booths" | "pass" | "route" | "evidence";
function puzzle(
  chapter: number, id: string, title: string, instruction: string,
  pieces: readonly (readonly [string, string, string])[], solution: readonly string[],
  hints: readonly string[], solvedText: string, layout: PuzzleLayout, slotLabels: readonly string[], prop: string,
): StoryPuzzleDefinition {
  return {
    id, title, instruction, imageAssetId: `${root}/puzzles/ch${String(chapter).padStart(2, "0")}.webp`,
    pieces: pieces.map(([pieceId, label, detail]) => ({ id: pieceId, label, detail, imageAssetId: `${root}/puzzles/props/${prop}.webp` })),
    solution, hints, solvedText, skipText: "Let the crew explain the solution. The next fade still has to be won to earn its reward.",
    presentation: { theme: "squabble-house", layout, slotLabels },
  };
}

/** Every answer follows visible rules; array order is deliberately scrambled. */
export const squabbleHousePuzzles: readonly StoryPuzzleDefinition[] = [
  puzzle(1, "squabble-house-breakfast-line", "Build the Last Waffle",
    "Rebuild the kitchen log from first action to last. Start with a cold, empty iron and an empty plate. Each action happens once. Follow the requirements printed on the tickets; nothing happens offscreen.",
    [
      ["syrup", "Finish with syrup", "Syrup goes only on the cooked waffle after it reaches the plate."],
      ["batter", "Pour the batter", "The iron must already be hot and empty. Pouring fills it with uncooked batter."],
      ["plate", "Lift onto the plate", "Lift the waffle out only after the cook cycle finishes. The iron becomes empty."],
      ["heat", "Heat the empty iron", "This must happen while the iron is empty, before any batter is poured."],
      ["cook", "Close and cook", "The iron must contain batter. Complete the full cook cycle before opening it."],
    ], ["heat", "batter", "cook", "plate", "syrup"],
    ["The cold iron cannot cook anything. Find the ticket that changes that.", "Heat → batter → cook → plate → syrup. The waffle was perfect when it left the kitchen."],
    "The kitchen sequence is sound. A cooked, plated waffle left the pass. Someone took it after service—not before.",
    "tickets", ["First action", "Second action", "Third action", "Fourth action", "Last action"], "ticket"),
  puzzle(2, "squabble-house-receipt-register", "Sort the Damage",
    "tek-KEN needs the receipt lines from smallest final charge to largest. Final charge = food + extras − discount. Use the amounts printed on each receipt. No tax or tip is added. All five final charges are different.",
    [
      ["red-plate", "Red’s plate", "$8 food + $3 extras − $2 discount."],
      ["og-combo", "OG’s combo", "$10 food + $2 extras − $1 discount."],
      ["coffee", "Coffee refill", "$6 food + $1 extras − $3 discount."],
      ["blue-plate", "Blue’s plate", "$12 food + $0 extras − $5 discount."],
      ["side-order", "Mystery side order", "$9 food + $2 extras − $5 discount."],
    ], ["coffee", "side-order", "blue-plate", "red-plate", "og-combo"],
    ["Calculate each total before comparing them. A bigger printed food price can have a smaller final charge.", "The final charges are $4, $6, $7, $9, $11. Blue’s $7 plate comes before Red’s $9 plate."],
    "$37 in actual orders. Blue’s plate and Red’s plate share Red OG’s account number. The food was real; the romance story remains unverified.",
    "register", ["Lowest charge", "2nd lowest", "Middle charge", "2nd highest", "Highest charge"], "receipt"),
  puzzle(3, "squabble-house-booth-truce", "A Booth Apart",
    "Seat the five people left to right as you face the booth. One person per seat. Use every person once and satisfy every seating request. Left and right refer to the screen, not the diners’ hands.",
    [
      ["cuff", "Cuff", "Sits immediately next to Blue."],
      ["blue", "Blue", "Sits at the opposite end from Red, somewhere to Red’s right."],
      ["manager", "Manager", "Takes the middle seat: seat 3 of 5."],
      ["red", "Red", "Takes an end seat."],
      ["ken", "tek-KEN", "Sits immediately to Red’s right so Red can read the bill."],
    ], ["red", "ken", "manager", "cuff", "blue"],
    ["Red occupies an end and Blue must be to his right. That rules out Red’s right-hand end.", "Red is seat 1, Blue seat 5, Manager seat 3. tek-KEN belongs immediately after Red; Cuff fills seat 4."],
    "Red • tek-KEN • Manager • Cuff • Blue. Both rivals can see the receipts without reaching each other. Their OGs, unfortunately, are still standing.",
    "booths", ["Seat 1 · left end", "Seat 2", "Seat 3 · middle", "Seat 4", "Seat 5 · right end"], "booth"),
  puzzle(4, "squabble-house-grill-rush", "Keep the Pass Moving",
    "One grill. Start at minute 0. Cook one ticket at a time without interruption, using each ticket once. Each order must FINISH at or before its pickup deadline. Choose the sequence that gets all five out on time; waiting never helps.",
    [
      ["hash", "Hash browns", "Cook time: 3 minutes. Pickup deadline: minute 10."],
      ["toast", "Toast", "Cook time: 1 minute. Pickup deadline: minute 11."],
      ["waffle", "Waffle", "Cook time: 3 minutes. Pickup deadline: minute 5."],
      ["eggs", "Eggs", "Cook time: 2 minutes. Pickup deadline: minute 2."],
      ["bacon", "Bacon", "Cook time: 2 minutes. Pickup deadline: minute 7."],
    ], ["eggs", "waffle", "bacon", "hash", "toast"],
    ["The eggs need two minutes and must finish by minute two. Nothing can go before them.", "After eggs finish at 2: waffle finishes at 5, bacon at 7, hash browns at 10, toast at 11. Any swap makes an order late."],
    "Every pickup hits its deadline: 2, 5, 7, 10, 11. Griddle keeps the service moving while Security keeps Titan away from the hot pass.",
    "pass", ["First on grill", "Second on grill", "Third on grill", "Fourth on grill", "Last on grill"], "plate"),
  puzzle(5, "squabble-house-dry-route", "Respect the Wet Floor",
    "Trace the dry route from A1 (front door) to D3 (service pass). Columns A–D go left to right; rows 1–3 go from the windows toward the counter. Step one square horizontally or vertically. No diagonals. Use every dry tile once; all unlisted squares are wet.",
    [
      ["c3", "C3 · turn at the cone", "Dry square C3. The service pass is one square to the right."],
      ["b1", "B1 · window mat", "Dry square B1. A1 is one square left; B2 is one square toward the counter."],
      ["d3", "D3 · service pass", "Dry square D3. Finish here."],
      ["a1", "A1 · front door", "Dry square A1. Start here."],
      ["c2", "C2 · aisle mat", "Dry square C2. B2 is one square left; C3 is one square toward the counter."],
      ["b2", "B2 · booth corner", "Dry square B2. B1 is one square toward the windows; C2 is one square right."],
    ], ["a1", "b1", "b2", "c2", "c3", "d3"],
    ["From A1, only B1 is a listed horizontal or vertical neighbor. Follow the dry squares, not the diagonal shortcuts.", "A1 → B1 → B2 → C2 → C3 → D3. Right, toward counter, right, toward counter, right."],
    "Plate delivered. Shoes dry. Red and Blue’s diagonal shortcut was not on the map—and neither was their landing.",
    "route", ["Start · A1", "Step 2", "Step 3", "Step 4", "Step 5", "Finish · D3"], "cone"),
  puzzle(6, "squabble-house-feather-file", "The Feather File",
    "Put the five camera events in real chronological order, earliest to latest. All stamps are from the same night. Each camera’s clock error is printed on its evidence card: subtract a fast clock’s error; add a slow clock’s error. Use every event once.",
    [
      ["accusation", "Red points at Blue", "Booth camera reads 02:25. Its clock is accurate."],
      ["theft", "Waffle leaves the plate", "Shelf camera reads 02:20. Its clock is 3 minutes slow. A small wing crosses the plate."],
      ["escape", "Pigeon reaches the exit", "Exit camera reads 02:29. Its clock is 2 minutes fast. The stolen waffle is in its claws."],
      ["plate", "Manager plates breakfast", "Kitchen camera reads 02:19. Its clock is 2 minutes slow."],
      ["entry", "Pigeon enters the window", "Hall camera reads 02:24. Its clock is 2 minutes fast."],
    ], ["plate", "entry", "theft", "accusation", "escape"],
    ["A fast camera shows a later time than reality. Correct every timestamp before sorting the events.", "Actual times: plated 02:21; pigeon enters 02:22; theft 02:23; accusation 02:25; escape 02:27."],
    "The pigeon took the waffle two minutes before Red accused Blue. The receipts prove who paid; the footage proves who ate. Those are different questions.",
    "evidence", ["Earliest event", "Second event", "Third event", "Fourth event", "Latest event"], "evidence"),
];

const standardStars: readonly StoryStarObjective[] = [
  { id: "win", description: "Win the encounter.", criterion: { kind: "win" } },
  { id: "two-districts", description: "Finish holding at least two districts.", criterion: { kind: "districts-held", owner: "player", atLeast: 2 } },
  { id: "motion", description: "Finish with at least 1 Motion.", criterion: { kind: "motion-remaining", owner: "player", atLeast: 1 } },
];
const outsideStars: readonly StoryStarObjective[] = [
  standardStars[0],
  { id: "outside", description: "Finish holding both outside districts.", criterion: { kind: "specific-districts-held", owner: "player", lanes: [0, 2] } },
  standardStars[2],
];
type ChapterScript = {
  slug: string; title: string; subtitle: string; opening: readonly StoryDialogueLine[]; puzzleLines: readonly StoryDialogueLine[];
  battleTitle: string; opponent: Speaker; crew: keyof typeof SQUABBLE_HOUSE_ENEMY_CREWS; pre: readonly StoryDialogueLine[];
  post: readonly StoryDialogueLine[]; closing: readonly StoryDialogueLine[]; tips: readonly string[]; focus: readonly string[];
  rewards: readonly StoryReward[];
};
const rewardCard = (id: string): StoryReward => ({ kind: "card", id, amount: 1, claimKey: `squabble-house:card:${id}:v1` });
const scripts: readonly ChapterScript[] = [
  {
    slug: "last-waffle", title: "The Last Waffle", subtitle: "One breakfast. Two egos. No evidence.",
    opening: [
      say("Manager", "Squabble House. Good food. Bad decisions. Welcome to the night shift."),
      say("Red", "Who touched my waffle? Blue, why you looking full?"),
      say("Blue", "That is my natural face. You want me to look hungry for you?"),
      say("Cuff", "Eggs still there. Bacon still there. Waffle missing. One feather. We doing facts or volume?"),
      say("Manager", "You—new shift. Check the kitchen log, then hold the floor. Nobody earns free food by yelling."),
    ],
    puzzleLines: [say("Griddle", "My iron works. Check the tickets in order and tell him that waffle left here cooked."), say("Red", "So somebody stole a professionally prepared waffle. That makes it worse.")],
    battleTitle: "Red Side, Table Five", opponent: "Red", crew: "blood",
    pre: [say("Red", "Blood crew got this booth. Beat the deck if you want me to sit down."), say("Manager", "Two districts gets it done. Open cheap, save Motion, and make him overcommit.")],
    post: [say("Red", "I sat down because the booth looked comfortable."), say("Cuff", "Sure. Your cards sat down first.")],
    closing: [say("Manager", "Fresh Pot is on your crew now. The Squabble House server clears Burn and Freeze from a teammate."), say("Blue", "Before we move on... your girl sent me breakfast."), say("Red", "She sent you WHAT?")],
    tips: ["Win two districts; you do not need to fill all three.", "Start with low-cost cards and leave room for a late response.", "You start with 8 Motion and a House +3 Hands edge in the left and middle districts; Red starts with 0 and a smaller hand."],
    focus: ["squabbleserver", "cornball", "plug"], rewards: [rewardCard("squabbleserver")],
  },
  {
    slug: "receipts", title: "The Receipts", subtitle: "Same girl. Two orders. A very different payer.",
    opening: [say("tek-KEN", "Same girl. Two orders. Both on his tab."), say("Red OG", "MY tab?"), say("Blue", "I thought that was a hospitality program."), say("tek-KEN", "The program is called paying. Let me sort the line items before somebody invents a discount."), say("Manager", "Check every total. Then get Blue off the counter.")],
    puzzleLines: [say("tek-KEN", "Food, plus extras, minus discount. No mystery tax. Lowest final charge first."), say("Blue", "Put mine under emotional support breakfast."), say("tek-KEN", "That is still seven dollars.")],
    battleTitle: "Blue’s Breakfast Alibi", opponent: "Blue", crew: "crip",
    pre: [say("Blue", "Crip crew. We control the table while you check the receipt."), say("Cuff", "Blue uses Freeze and protection. Fresh Pot clears Burn or Freeze from your weakest affected ally in its district.")],
    post: [say("Blue", "My plate was complimentary."), say("tek-KEN", "Your compliments have been declined.")],
    closing: [say("tek-KEN", "Thirty-seven dollars. Every line accounted for. Take these two Street Pack tickets; you earned a break."), say("Red OG", "Who told anybody I was paying?"), say("Blue OG", "She said you was her uncle.")],
    tips: ["Use the House server after an ally is Burned or Frozen in the same district.", "Do not pile every threat into the district Blue is protecting.", "Holding two districts is enough; keep 1 Motion for the third star."],
    focus: ["squabbleserver", "rastamon", "snow"], rewards: [{ kind: "pack-ticket", id: "street-pack-ticket", amount: 2, claimKey: "squabble-house:receipts:tickets:v1" }],
  },
  {
    slug: "family-discount", title: "Family Discount", subtitle: "The uncle joke lands. Then the hands do.",
    opening: [say("Red OG", "Catch this family discount!"), say("Blue OG", "You throwing hands with a reservation?"), say("Manager", "Dogs stay by the booth. Everybody else stops rearranging my furniture."), say("Cuff", "I can separate Red and Blue. Five seats. One rule: they do not get the ends wrong."), say("tek-KEN", "Give me a seat where Red can see the bill. He keeps discovering new reading problems.")],
    puzzleLines: [say("Cuff", "Face the booth. Your left is the left end. Read everybody’s request, then seat all five."), say("Manager", "I am taking the middle. This establishment has enough divided opinions.")],
    battleTitle: "OG’s Family Discount", opponent: "Red OG", crew: "bloodOg",
    pre: [say("Red OG", "Blood crew handles the family business. You want my seat? Earn it."), say("Griddle", "RED PUNCH controls the right district and takes Hands from everyone there. Spread your crew before his reveal.")],
    post: [say("Blue OG", "Was that the senior discount?"), say("Red OG", "Keep talking. I got a loyalty program too.")],
    closing: [say("Griddle", "You earned the Squabble House cook. Hands on the Clock answers an enemy ability that damages another ally here, once each round."), say("Cuff", "Seats fixed. Plate safe. Why is that shadow getting bigger?"), say("Blue Titan", "I ordered the large.")],
    tips: ["RED PUNCH can only enter the right district and takes Hands from other cards there.", "Develop two useful districts instead of filling every slot early.", "The cook you earn retaliates against ability damage to another ally in its district."],
    focus: ["squabblecook", "wifey", "hooper"], rewards: [rewardCard("squabblecook")],
  },
  {
    slug: "hands-on-the-clock", title: "Hands on the Clock", subtitle: "The staff handles the rush and the fade.",
    opening: [say("Blue Titan", "Door looked bigger outside."), say("Security", "You fit through it. Keep that option in mind."), say("Griddle", "Hands on the clock! We still got orders up!"), say("Manager", "Not the plate. Cuff, keep it level. New shift—get the grill tickets moving."), say("Cuff", "Catching breakfast while everybody else catches feelings. Multitasking.")],
    puzzleLines: [say("Griddle", "One grill. Each pickup has a deadline. Finish the food by that minute; starting it then does not count."), say("Manager", "No plate gets cold while these two rehearse being furniture.")],
    battleTitle: "Titan at the Service Pass", opponent: "Blue Titan", crew: "cripTitan",
    pre: [say("Blue Titan", "Crip crew brought a bigger finish."), say("Security", "Titan supports his crew late. Win space early; protect the cook and another ally together.")],
    post: [say("Blue Titan", "So... large order still coming?"), say("Griddle", "Large bill. Regular portions.")],
    closing: [say("Manager", "Every order on time. Your training fund gets 180 Clout. A strong crew knows when to answer and when to hold."), say("Mop", "Anybody planning to use the floor? Because I am planning to clean it."), say("Red", "Blue. Run it back. Right now.")],
    tips: ["Blue Titan brings a costly late support card. Take the middle and right districts before CLUE COOKY anchors the left.", "Place the cook beside another ally so enemy ability damage can trigger retaliation.", "The cook retaliates once per round; it is not an unlimited damage loop."],
    focus: ["squabblecook", "squabbleserver", "wifey"], rewards: [{ kind: "currency", id: "clout", amount: 180, claimKey: "squabble-house:clock:clout:v1" }],
  },
  {
    slug: "wet-floor", title: "Wet Floor. Dry Humor.", subtitle: "The quietest employee ends the loudest rematch.",
    opening: [say("Mop", "I JUST mopped."), say("Red", "Floor got a personal problem with me."), say("Blue", "You fell first."), say("Mop", "Y’all tied. Congratulations. The plate still needs a dry route to the pass."), say("Manager", "Follow the marked tiles. We are running out of dignity, not towels.")],
    puzzleLines: [say("Mop", "Door A1 to pass D3. No diagonals, no wet squares, no improvising."), say("Cuff", "That last rule was for both of you.")],
    battleTitle: "The Dry-Side Rematch", opponent: "Blue", crew: "rivals",
    pre: [say("Red", "Blood and Crip crews sharing a plan. First time for everything."), say("Mop", "Center closes for cleaning in round three. Claim the outside districts before the cone goes down.")],
    post: [say("Red", "Run it back!"), say("Mop", "Tip first.")],
    closing: [say("Mop", "Janitor joins your crew. Janitor reverses the first hostile Hands loss or status and the first forced staff move in its district each round; each ally gains two Hands instead."), say("Manager", "A comeback card with a work ethic. There is a lesson in there."), say("Cuff", "And there is a pigeon by the window holding a whole waffle.")],
    tips: ["The center district locks for both crews in round three; use the outside districts.", "Cards already in the center still contribute; the lock stops later entry.", "Janitor has a separate charge for harmful Hands or status effects and forced staff moves in its district each round."],
    focus: ["janitor", "bikelife", "squabblecook"], rewards: [rewardCard("janitor")],
  },
  {
    slug: "real-thief", title: "The Real Thief", subtitle: "The bird has the waffle. The House has the receipts.",
    opening: [say("Pigeon", "Y’all beefing. I’m eating."), say("Red", "The BIRD?"), say("Blue", "You owe me an apology and half that waffle."), say("Manager", "Y’all split the bill... and the embarrassment."), say("tek-KEN", "Before anyone declares a mistrial, fix the camera clocks. The footage tells the whole story.")],
    puzzleLines: [say("tek-KEN", "Fast clocks get time subtracted. Slow clocks get time added. Put the events in real order."), say("Pigeon", "My legal team says that feather could be anybody’s."), say("Security", "You are still holding the evidence.")],
    battleTitle: "Settle the House Tab", opponent: "Red OG", crew: "rivals",
    pre: [say("Red OG", "Blood and Crip crews. One last table. Settle it before the bird leaves."), say("Manager", "This is the final shift: both rivals, one extra Motion for them in round four. Keep your House crew working together.")],
    post: [say("Blue OG", "Joint statement: that was everybody else’s fault."), say("tek-KEN", "Joint invoice: still payable.")],
    closing: [say("Manager", "You held the floor. Squabble House Manager joins your collection. One Motion, two Hands, plus one on reveal when an enemy is here. The Manager keeps gaining a Hand for each other friendly staff member on the board."), say("Griddle", "Server, cook, Janitor, Manager. That is a real shift. Keep them together and make the next crew work for it."), say("Pigeon", "Put it on her tab."), say("Red", "HER?!"), say("Blue", "We are absolutely coming back tomorrow."), say("Manager", "Good. We open early.")],
    tips: ["Both rival sets bring their OGs and dogs: Blue anchors the left, Red anchors the right. Contest the middle and one outside district.", "In round four, the enemy gains 1 extra Motion once. The phase is visible in the encounter rules.", "Cleanse with the server, retaliate with the cook, and use Janitor to protect a key district."],
    focus: ["squabbleserver", "squabblecook", "janitor", "squabble-house-manager"], rewards: [rewardCard("squabble-house-manager"), { kind: "pack-ticket", id: "street-pack-ticket", amount: 3, claimKey: "squabble-house:finale:tickets:v1" }],
  },
];

export const squabbleHouseChapters: readonly StoryChapter[] = scripts.map((script, index): StoryChapter => {
  const number = index + 1;
  const id = `squabble-house-${script.slug}`;
  const cinematic = film(number);
  const support = shiftSupport[index];
  const supportDescription = `Round 1: ${supportNames[support[0]]} joins your hand. Round 2: ${supportNames[support[1]]} joins your hand. These are temporary copies for this battle; pay their normal Motion costs to play them.`;
  const teaching = { tips: [...script.tips, supportDescription], focusMechanics: ["district control", "Motion", "Squabble House synergy"], focusCards: script.focus };
  const shared = { optional: false, teaching, cinematic };
  const stars = number === 5 ? outsideStars : standardStars;
  const encounter: StoryEncounterSnapshot = {
    id: `${id}-battle`,
    enemy: { id: `${id}-enemy`, name: script.opponent, portraitAssetId: `${root}/cast/${portraits[script.opponent]}.webp`, deckId: `squabble-house-${script.crew}`, cardIds: SQUABBLE_HOUSE_ENEMY_CREWS[script.crew], behaviorProfile: number === 6 ? "combo-boss" : "balanced" },
    battlefieldAssetId: cinematic.environmentAssetId, cinematic, roundLimit: 6,
    passive: { name: "On-Shift Backup", description: supportDescription },
    soundHooks: { intro: "story.encounter.intro", play: "story.card.play", phase: "story.boss.phase", victory: "story.victory", defeat: "story.defeat" },
    modifiers: { startingMotion: { player: number === 1 || number === 3 ? 8 : 6, cpu: 0 }, handSize: { player: number === 1 || number === 3 ? 6 : 5, cpu: 3 }, ...(number === 1 ? { lanePowerBonuses: [{ owner: "player" as const, lane: 0 as const, amount: 3 }, { owner: "player" as const, lane: 1 as const, amount: 3 }] } : {}), reinforcements: support.map((cardId, supportIndex) => ({ round: supportIndex + 1, owner: "player" as const, cardId })), ...(number === 5 ? { laneLocks: [{ round: 3, owner: "both" as const, lanes: [1 as const] }] } : {}) },
    phases: number === 6 ? [{ id: "last-call", name: "Last Call", description: "At the start of round four, the rival crew gains 1 extra Motion once.", trigger: { kind: "round", atLeast: 4 }, onEnter: [{ kind: "motion", owner: "cpu", amount: 1 }] }] : [],
    starObjectives: stars,
  };
  const nodes: readonly StoryNode[] = [
    { ...shared, id: `${id}-opening`, kind: "dialogue", title: "Now Showing", mapPosition: { x: 14, y: 74 }, prerequisites: [], rewards: [], scenes: script.opening },
    { ...shared, id: `${id}-puzzle`, kind: "dialogue", title: squabbleHousePuzzles[index].title, mapPosition: { x: 38, y: 54 }, prerequisites: [`${id}-opening`], rewards: [], scenes: script.puzzleLines, puzzle: squabbleHousePuzzles[index] },
    { ...shared, id: `${id}-battle`, kind: "battle", battleType: number === 6 ? "boss" : number === 5 ? "rule-twist" : number === 3 || number === 4 ? "mini-boss" : "standard", title: script.battleTitle, mapPosition: { x: 62, y: 38 }, prerequisites: [`${id}-puzzle`], rewards: [{ kind: "currency", id: "street-xp", amount: 75 + index * 25 }], encounter, preDialogue: [...script.pre, say("Manager", supportDescription)], postDialogue: script.post, starObjectives: stars, recommendedCollection: SQUABBLE_HOUSE_SUGGESTED_CREW },
    { ...shared, id: `${id}-closing`, kind: "reward", title: number === 6 ? "The House Always Serves" : "Shift Pay", mapPosition: { x: 86, y: 20 }, prerequisites: [`${id}-battle`], rewards: script.rewards, scenes: script.closing },
  ];
  return { id, title: script.title, subtitle: script.subtitle, description: `${script.subtitle} Watch the film, work the shift, solve the House puzzle, and win a fade against the red and blue crews.`, order: 30 + index, mapAssetId: `${root}/map.webp`, prerequisites: index === 0 ? [] : [`squabble-house-${scripts[index - 1].slug}`], nodes };
});
