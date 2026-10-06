/** Shared deterministic rules. The server owns the clock, RNG, state and reward ledger. */
export const WAFFLE_RUN_VERSION = 1 as const;
export const WAFFLE_DAILY_RUNS = 2;
export const WAFFLE_MAX_HP = 48;
export type WaffleReward = {
  softCurrency: number;
  packTickets: number;
  styleShards: number;
};
export type WaffleMoveId =
  | "peck"
  | "wing-slap"
  | "crumb-guard"
  | "syrup-spit"
  | "double-peck"
  | "dine-dash"
  | "coffee-rush"
  | "waffle-heal"
  | "beak-breaker";
export const WAFFLE_MOVES: Record<
  WaffleMoveId,
  { name: string; description: string; pp: number; power: number; tone: string }
> = {
  peck: {
    name: "Peck",
    description: "A reliable 8 damage. Always available.",
    pp: 99,
    power: 8,
    tone: "cream",
  },
  "wing-slap": {
    name: "Wing Slap",
    description: "12 damage. No fancy footwork.",
    pp: 7,
    power: 12,
    tone: "gold",
  },
  "crumb-guard": {
    name: "Crumb Guard",
    description: "Block 10 damage and recover 3 HP.",
    pp: 4,
    power: 0,
    tone: "blue",
  },
  "syrup-spit": {
    name: "Syrup Spit",
    description: "5 damage plus 4 sticky damage for 3 turns.",
    pp: 3,
    power: 5,
    tone: "pink",
  },
  "double-peck": {
    name: "Double Peck",
    description: "18 damage. A 25% chance to miss.",
    pp: 5,
    power: 18,
    tone: "gold",
  },
  "dine-dash": {
    name: "Dine & Dash",
    description: "6 damage and dodge the next hit.",
    pp: 3,
    power: 6,
    tone: "blue",
  },
  "coffee-rush": {
    name: "Coffee Rush",
    description: "Lose 3 HP; boost your next two hits by 7.",
    pp: 3,
    power: 0,
    tone: "pink",
  },
  "waffle-heal": {
    name: "Waffle Break",
    description: "Restore 16 HP. You keep your waffle score.",
    pp: 2,
    power: 0,
    tone: "cream",
  },
  "beak-breaker": {
    name: "Beak Breaker",
    description: "22 damage with 4 recoil damage.",
    pp: 3,
    power: 22,
    tone: "pink",
  },
};
export const WAFFLE_STAFF = [
  {
    id: "busser",
    name: "The Bus Boy",
    line: "Not on my clean table.",
    sprite: 0,
  },
  {
    id: "cashier",
    name: "The Cashier",
    line: "You paying for those?",
    sprite: 1,
  },
  {
    id: "cook",
    name: "The Line Cook",
    line: "Bird. Off. My. Waffles.",
    sprite: 2,
  },
  {
    id: "security",
    name: "Night Security",
    line: "Kitchen is closed, little homie.",
    sprite: 3,
  },
] as const;
export type WaffleIntent = "strike" | "wind-up" | "guard";
export type WaffleRun = {
  version: 1;
  id: string;
  day: string;
  seed: number;
  revision: number;
  phase: "hopping" | "learning" | "battle" | "ended";
  hp: number;
  maxHp: number;
  plate: number;
  waffles: number;
  wins: number;
  hops: number;
  alarm: number;
  floor: number;
  phaseStartedAt: number;
  patrolOffset: number;
  moves: WaffleMoveId[];
  pp: Partial<Record<WaffleMoveId, number>>;
  offeredMoves: WaffleMoveId[];
  enemy: number;
  enemyHp: number;
  enemyMaxHp: number;
  enemyIntent: WaffleIntent;
  shield: number;
  dodge: boolean;
  boost: number;
  poison: number;
  enemyCharge: boolean;
  log: string[];
  endReason: "caught" | "retired" | null;
};
export type WaffleAction =
  | { type: "hop"; plate: number }
  | { type: "learn"; move: WaffleMoveId; replace?: number }
  | { type: "move"; move: WaffleMoveId }
  | { type: "retire" };
export class WaffleRuleError extends Error {}
function random(run: WaffleRun) {
  run.seed = (Math.imul(run.seed, 1664525) + 1013904223) >>> 0;
  return run.seed / 4294967296;
}
export function createWaffleRun(
  id: string,
  day: string,
  seed: number,
  now: number,
): WaffleRun {
  return {
    version: 1,
    id,
    day,
    seed: seed >>> 0,
    revision: 0,
    phase: "hopping",
    hp: WAFFLE_MAX_HP,
    maxHp: WAFFLE_MAX_HP,
    plate: 0,
    waffles: 0,
    wins: 0,
    hops: 0,
    alarm: 0,
    floor: 1,
    phaseStartedAt: now,
    patrolOffset: (seed >>> 0) % 6,
    moves: ["peck"],
    pp: { peck: 99 },
    offeredMoves: [],
    enemy: 0,
    enemyHp: 0,
    enemyMaxHp: 0,
    enemyIntent: "strike",
    shield: 0,
    dodge: false,
    boost: 0,
    poison: 0,
    enemyCharge: false,
    log: ["Slip in. Watch the red plate. Grab a waffle."],
    endReason: null,
  };
}
export function waffleHopTargets(run: Pick<WaffleRun, "plate">) {
  return [(run.plate + 1) % 6, (run.plate + 2) % 6];
}
export function waffleWatchedPlate(
  run: Pick<WaffleRun, "phaseStartedAt" | "patrolOffset">,
  now: number,
) {
  return (
    (Math.max(0, Math.floor((now - run.phaseStartedAt) / 1400)) +
      run.patrolOffset) %
    6
  );
}
export function waffleRewards(
  run: Pick<WaffleRun, "waffles" | "wins">,
): WaffleReward {
  return {
    softCurrency: Math.min(
      600,
      Math.floor(run.waffles / 3) * 20 + run.wins * 25,
    ),
    packTickets: (run.waffles >= 12 ? 1 : 0) + (run.waffles >= 30 ? 1 : 0),
    styleShards: Math.min(18, Math.floor(run.wins / 2) * 3),
  };
}
export const WAFFLE_REWARD_STOPS = [
  { waffles: 3, label: "20 Clout" },
  { waffles: 12, label: "+1 ticket" },
  { waffles: 30, label: "+1 ticket" },
  { waffles: 60, label: "400+ Clout" },
] as const;
function encounter(run: WaffleRun, now: number) {
  run.enemy = run.wins % WAFFLE_STAFF.length;
  run.enemyMaxHp = 23 + run.wins * 7;
  run.enemyHp = run.enemyMaxHp;
  run.enemyIntent = "strike";
  run.enemyCharge = false;
  run.shield = 0;
  run.dodge = false;
  run.boost = 0;
  run.poison = 0;
  const unlearned = (Object.keys(WAFFLE_MOVES) as WaffleMoveId[]).filter(
    (id) => id !== "peck" && !run.moves.includes(id),
  );
  const offers = unlearned.length
    ? unlearned
    : (Object.keys(WAFFLE_MOVES) as WaffleMoveId[]).filter(
        (id) => id !== "peck",
      );
  run.offeredMoves = [];
  while (offers.length && run.offeredMoves.length < 3)
    run.offeredMoves.push(
      offers.splice(Math.floor(random(run) * offers.length), 1)[0],
    );
  run.phase = "learning";
  run.phaseStartedAt = now;
  run.log = [
    `${WAFFLE_STAFF[run.enemy].name} caught you! Pick a new move before the fade.`,
  ];
}
function finishBattle(run: WaffleRun, now: number) {
  if (run.hp <= 0) {
    run.hp = 0;
    run.phase = "ended";
    run.endReason = "caught";
    run.log.push("The bird is down. Your banked rewards are safe.");
    return;
  }
  if (run.enemyHp <= 0) {
    run.enemyHp = 0;
    run.wins++;
    run.hp = Math.min(run.maxHp, run.hp + 4);
    run.phase = "hopping";
    run.alarm = 15;
    run.phaseStartedAt = now;
    run.patrolOffset = Math.floor(random(run) * 6);
    run.log.push("You won the fade! +4 HP. Back to the waffles.");
  }
}
/** Never mutate the persisted input. Illegal transitions do not consume a turn. */
export function applyWaffleAction(
  input: WaffleRun,
  action: WaffleAction,
  now: number,
): WaffleRun {
  const run = structuredClone(input);
  if (run.phase === "ended")
    throw new WaffleRuleError("This run is already finished.");
  if (action.type === "retire") {
    run.phase = "ended";
    run.endReason = "retired";
    run.log = ["You left the diner. Your banked rewards are safe."];
    run.revision++;
    return run;
  }
  if (action.type === "hop") {
    if (
      run.phase !== "hopping" ||
      !Number.isInteger(action.plate) ||
      !waffleHopTargets(run).includes(action.plate)
    )
      throw new WaffleRuleError("Hop to one of the two nearby plates.");
    if (now - run.phaseStartedAt < 260)
      throw new WaffleRuleError("Let the pigeon land before hopping again.");
    const caught = action.plate === waffleWatchedPlate(run, now);
    const fast = action.plate === (run.plate + 2) % 6;
    run.plate = action.plate;
    run.waffles++;
    run.hops++;
    run.floor = 1 + Math.floor(run.waffles / 6);
    run.alarm = Math.min(100, run.alarm + (fast ? 26 : 18));
    run.log = [
      `Waffle ${run.waffles} stolen. ${fast ? "Big hop. Extra attention." : "Keep it quiet."}`,
    ];
    if (caught || run.alarm >= 100) encounter(run, now);
    else {
      run.phaseStartedAt = now;
      run.patrolOffset = Math.floor(random(run) * 6);
    }
  } else if (action.type === "learn") {
    if (run.phase !== "learning" || !run.offeredMoves.includes(action.move))
      throw new WaffleRuleError("Choose one of the offered moves.");
    if (run.moves.length >= 4) {
      if (
        !Number.isInteger(action.replace) ||
        action.replace! < 1 ||
        action.replace! > 3
      )
        throw new WaffleRuleError(
          "Replace one of your learned moves. Peck always stays.",
        );
      run.moves[action.replace!] = action.move;
    } else if (!run.moves.includes(action.move)) run.moves.push(action.move);
    run.pp = Object.fromEntries(
      run.moves.map((id) => [id, WAFFLE_MOVES[id].pp]),
    );
    run.phase = "battle";
    run.phaseStartedAt = now;
    run.offeredMoves = [];
    run.log = [
      `${WAFFLE_MOVES[action.move].name} learned. ${WAFFLE_STAFF[run.enemy].line}`,
    ];
  } else if (action.type === "move") {
    if (
      run.phase !== "battle" ||
      !run.moves.includes(action.move) ||
      (run.pp[action.move] ?? 0) <= 0
    )
      throw new WaffleRuleError("That move is not available.");
    if (action.move !== "peck")
      run.pp[action.move] = (run.pp[action.move] ?? 0) - 1;
    const move = WAFFLE_MOVES[action.move];
    run.log = [];
    let power = move.power;
    if (action.move === "double-peck" && random(run) < 0.25) {
      power = 0;
      run.log.push("Double Peck missed!");
    }
    if (power > 0) {
      if (run.boost > 0) {
        power += 7;
        run.boost--;
      }
      if (run.enemyIntent === "guard") power = Math.max(1, power - 6);
      run.enemyHp = Math.max(0, run.enemyHp - power);
      run.log.push(`${move.name}: ${power} damage.`);
    }
    if (action.move === "crumb-guard") {
      run.shield = 10;
      run.hp = Math.min(run.maxHp, run.hp + 3);
      run.log.push("You tuck behind a plate. +3 HP.");
    }
    if (action.move === "dine-dash") run.dodge = true;
    if (action.move === "coffee-rush") {
      run.boost = 2;
      run.hp = Math.max(0, run.hp - 3);
      run.log.push("Coffee rush! The next two hits get +7.");
    }
    if (action.move === "waffle-heal") {
      run.hp = Math.min(run.maxHp, run.hp + 16);
      run.log.push("Waffle break. +16 HP.");
    }
    if (action.move === "beak-breaker") run.hp = Math.max(0, run.hp - 4);
    if (action.move === "syrup-spit") run.poison = 3;
    if (run.poison > 0 && run.enemyHp > 0) {
      run.enemyHp = Math.max(0, run.enemyHp - 4);
      run.poison--;
      run.log.push("Sticky syrup: 4 damage.");
    }
    finishBattle(run, now);
    if (run.phase === "battle") {
      if (run.enemyIntent === "wind-up") {
        run.enemyCharge = true;
        run.log.push("They wind up. A heavy hit is coming.");
      } else if (run.enemyIntent === "guard") {
        run.log.push("They brace behind the counter.");
      } else {
        let damage = 6 + run.wins * 2 + (run.enemyCharge ? 7 : 0);
        run.enemyCharge = false;
        if (run.dodge) {
          damage = 0;
          run.dodge = false;
          run.log.push("Dine & Dash dodged the hit!");
        }
        damage = Math.max(0, damage - run.shield);
        run.shield = 0;
        run.hp = Math.max(0, run.hp - damage);
        run.log.push(`${WAFFLE_STAFF[run.enemy].name}: ${damage} damage.`);
      }
      finishBattle(run, now);
      if (run.phase === "battle")
        run.enemyIntent = run.enemyCharge
          ? "strike"
          : random(run) < 0.18
            ? "wind-up"
            : random(run) < 0.2
              ? "guard"
              : "strike";
    }
  }
  run.revision++;
  return run;
}
