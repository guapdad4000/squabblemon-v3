/** The server owns clocks, RNG, turns and banked arcade rewards. */
export type ArcadeKind = "girl-fade" | "fade-market" | "block-takeover";
export type Direction = "left" | "right" | "up" | "down";
export const DIRECTIONS: Direction[] = ["left", "right", "up", "down"];
export const OPPOSITE: Record<Direction, Direction> = {
  left: "right",
  right: "left",
  up: "down",
  down: "up",
};
export const GIRL_FIGHTERS = [
  {
    id: "bonnet-girl",
    name: "Bonnet Girl",
    style: "Velvet Counter",
    power: 16,
    heal: 12,
  },
  {
    id: "bottle-girl",
    name: "Bottle Girl",
    style: "Golden Pressure",
    power: 19,
    heal: 8,
  },
  {
    id: "baby-momma",
    name: "Baby Momma",
    style: "Never Fold",
    power: 14,
    heal: 18,
  },
] as const;
export const STOCK_ITEMS = [
  { name: "Espresso", effect: "Faster hands", color: "#ddbb78" },
  { name: "Hot sauce", effect: "Harder punches", color: "#f3785e" },
  { name: "Ice bags", effect: "Freeze the lanes", color: "#89d6e8" },
  { name: "Vitamins", effect: "Repair the store", color: "#b1d880" },
  { name: "Protein bars", effect: "Clear a crowd", color: "#d59cd6" },
] as const;
export const DISTRICTS = [
  "The Gym",
  "Blacktop",
  "The Depot",
  "Subway",
  "The Function",
  "Fade Market",
  "Safehouse",
  "The Park",
  "Warehouse",
];
export const BLOCK_CREWS = [
  { name: "Pressure Crew", card: "dr-fade", power: 5, health: 64 },
  { name: "Never Fold", card: "baby-momma", power: 4, health: 82 },
  { name: "Quick Hands", card: "bottle-girl", power: 4, health: 70 },
] as const;
export const ARCADE_RULES = {
  "girl-fade": { title: "Girl Fade", limit: 2, cadence: "daily" },
  "fade-market": { title: "Fade Market", limit: 2, cadence: "daily" },
  "block-takeover": { title: "Block Takeover", limit: 3, cadence: "weekly" },
} as const;
export type ArcadeReward = {
  softCurrency: number;
  packTickets: number;
  styleShards: number;
};
type Base = {
  version: 1;
  id: string;
  kind: ArcadeKind;
  period: string;
  seed: number;
  revision: number;
  phase: "active" | "ended";
  health: number;
  maxHealth: number;
  score: number;
  lastAt: number;
  log: string[];
  result: "win" | "loss" | "retired" | null;
};
export type BoxBeat = {
  direction: Direction;
  attack: Direction;
  outcome: "counter" | "dodge" | "hit";
  damage: number;
};
export type GirlRun = Base & {
  kind: "girl-fade";
  box: {
    fighter: number;
    opponent: number;
    round: number;
    wins: number;
    hits: number;
    combo: number;
    enemyHealth: number;
    enemyMax: number;
    stage: "ready" | "pattern";
    pattern: Direction[];
    opensAt: number;
    deadline: number;
    exchanges: number;
    beats: BoxBeat[];
  };
};
export type MarketEnemy = {
  id: number;
  lane: number;
  position: number;
  hp: number;
  maxHp: number;
  variant: number;
};
export type MarketRun = Base & {
  kind: "fade-market";
  market: {
    tick: number;
    wave: number;
    kills: number;
    powerups: number;
    aim: number;
    cashier: number;
    destination: number;
    stock: number[];
    enemies: MarketEnemy[];
    nextId: number;
    power: number;
    rapid: number;
    freeze: number;
    firing: number[];
    restock: number | null;
  };
};
export type BlockTile = {
  owner: "player" | "neutral" | "rival";
  defense: number;
  captured: boolean;
};
export type BlockRun = Base & {
  kind: "block-takeover";
  block: {
    crew: number;
    turn: number;
    maxTurns: number;
    supplies: number;
    power: number;
    tiles: BlockTile[];
    threat: number;
    captured: number;
    scenario: number;
  };
};
export type ArcadeRun = GirlRun | MarketRun | BlockRun;
export type ArcadeAction =
  | { type: "ready" }
  | { type: "pattern"; directions: Direction[] }
  | { type: "duty"; aim: number; stockLane: number }
  | { type: "attack"; tile: number }
  | { type: "defend"; tile: number }
  | { type: "supply" }
  | { type: "rally" }
  | { type: "retire" };
export class ArcadeRuleError extends Error {}
const roll = (run: ArcadeRun) => {
  run.seed = (Math.imul(run.seed, 1664525) + 1013904223) >>> 0;
  return run.seed / 4294967296;
};
export function arcadePeriod(kind: ArcadeKind, now: Date) {
  if (kind !== "block-takeover") return now.toISOString().slice(0, 10);
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}
export function arcadeReset(kind: ArcadeKind, now: Date) {
  const d = new Date(arcadePeriod(kind, now) + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + (kind === "block-takeover" ? 7 : 1));
  return d.toISOString();
}
export function createArcadeRun(
  kind: ArcadeKind,
  id: string,
  period: string,
  seed: number,
  now: number,
  choice = 0,
): ArcadeRun {
  const base: Base = {
    version: 1,
    id,
    kind,
    period,
    seed: seed >>> 0,
    revision: 0,
    phase: "active",
    health: 100,
    maxHealth: 100,
    score: 0,
    lastAt: now,
    log: [],
    result: null,
  };
  if (kind === "girl-fade") {
    const run: GirlRun = {
      ...base,
      kind,
      box: {
        fighter: choice,
        opponent: (choice + 1) % 3,
        round: 1,
        wins: 0,
        hits: 0,
        combo: 0,
        enemyHealth: 56,
        enemyMax: 56,
        stage: "ready",
        pattern: [],
        opensAt: 0,
        deadline: 0,
        exchanges: 0,
        beats: [],
      },
    };
    run.log = [
      "Read her pattern. Slip away from the red arrows. Punch into the opposite direction.",
    ];
    return run;
  }
  if (kind === "fade-market")
    return {
      ...base,
      kind,
      market: {
        tick: 0,
        wave: 1,
        kills: 0,
        powerups: 0,
        aim: 2,
        cashier: 2,
        destination: 2,
        stock: [0, 0, 0, 0, 0],
        enemies: [],
        nextId: 1,
        power: 4,
        rapid: 0,
        freeze: 0,
        firing: [],
        restock: null,
      },
      log: ["Aim Dr. Fade at a lane. Send Night Cashier to restock a shelf."],
    };
  const crew = BLOCK_CREWS[choice],
    scenario = (seed >>> 0) % 3,
    tiles: BlockTile[] = Array.from({ length: 9 }, (_, i) => ({
      owner:
        i === 6 ? "player" : [0, 2, 4, 8].includes(i) ? "rival" : "neutral",
      defense: i === 0 ? 12 : i === 6 ? 8 : 2 + ((i + scenario) % 3),
      captured: i === 6,
    }));
  return {
    ...base,
    kind,
    health: crew.health,
    maxHealth: crew.health,
    block: {
      crew: choice,
      turn: 0,
      maxTurns: 24,
      supplies: 7,
      power: crew.power,
      tiles,
      threat: 6,
      captured: 0,
      scenario,
    },
    log: [
      "Own six districts to open The Gym headquarters. Hold your turf and watch the red raid marker.",
    ],
  };
}
export function arcadeRewards(run: ArcadeRun): ArcadeReward {
  if (run.kind === "girl-fade")
    return {
      softCurrency: Math.min(450, run.box.wins * 45 + run.box.hits * 3),
      packTickets: Number(run.box.wins >= 3) + Number(run.box.wins >= 6),
      styleShards: Math.min(12, run.box.wins * 2),
    };
  if (run.kind === "fade-market")
    return {
      softCurrency: Math.min(
        600,
        run.market.kills * 8 + run.market.powerups * 12,
      ),
      packTickets: Number(run.market.wave >= 3) + Number(run.market.wave >= 6),
      styleShards: Math.min(16, run.market.powerups * 2),
    };
  return {
    softCurrency: run.block.captured * 25 + (run.result === "win" ? 125 : 0),
    packTickets: run.result === "win" ? 2 : 0,
    styleShards: Math.min(18, run.block.captured * 2),
  };
}
export function blockNeighbors(tile: number) {
  return Array.from({ length: 9 }, (_, i) => i).filter(
    (i) =>
      Math.abs(Math.floor(i / 3) - Math.floor(tile / 3)) +
        Math.abs((i % 3) - (tile % 3)) ===
      1,
  );
}
export function blockCanAttack(run: BlockRun, tile: number) {
  return (
    run.block.tiles[tile]?.owner !== "player" &&
    blockNeighbors(tile).some((i) => run.block.tiles[i].owner === "player") &&
    (tile !== 0 ||
      run.block.tiles.filter((t) => t.owner === "player").length >= 6)
  );
}
function end(run: ArcadeRun, result: Base["result"]) {
  run.phase = "ended";
  run.result = result;
  run.health = Math.max(0, run.health);
}
export function applyArcadeAction(
  input: ArcadeRun,
  action: ArcadeAction,
  now: number,
): ArcadeRun {
  const run = structuredClone(input);
  if (run.phase === "ended") throw new ArcadeRuleError("This run is finished.");
  if (action.type === "retire") {
    end(run, "retired");
    run.log = ["You clocked out. All banked rewards stay yours."];
  } else if (run.kind === "girl-fade") boxAction(run, action, now);
  else if (run.kind === "fade-market") marketAction(run, action, now);
  else blockAction(run, action);
  run.revision++;
  run.lastAt = now;
  return run;
}
function boxAction(run: GirlRun, action: ArcadeAction, now: number) {
  const b = run.box;
  if (action.type === "ready") {
    if (b.stage !== "ready")
      throw new ArcadeRuleError("Your exchange is already running.");
    b.pattern = Array.from(
      { length: Math.min(5, 3 + Math.floor(b.wins / 2)) },
      () => DIRECTIONS[Math.floor(roll(run) * 4)],
    );
    b.opensAt = now + Math.max(1050, 2200 - b.wins * 150);
    b.deadline = b.opensAt + Math.max(2400, 5400 - b.wins * 400);
    b.stage = "pattern";
    b.beats = [];
    run.log = [
      "Memorize her red attack arrows. Your counter goes in the opposite direction.",
    ];
    return;
  }
  if (action.type !== "pattern" || b.stage !== "pattern")
    throw new ArcadeRuleError("Start an exchange before entering a pattern.");
  if (now < b.opensAt) throw new ArcadeRuleError("Watch the telegraph first.");
  if (
    action.directions.length > b.pattern.length ||
    action.directions.some((d) => !DIRECTIONS.includes(d))
  )
    throw new ArcadeRuleError("Invalid boxing pattern.");
  if (action.directions.length !== b.pattern.length && now < b.deadline)
    throw new ArcadeRuleError(
      "Finish the full pattern or let the timer run out.",
    );
  const late = now > b.deadline + 350;
  b.beats = [];
  for (let i = 0; i < b.pattern.length; i++) {
    if (run.health <= 0 || b.enemyHealth <= 0) break;
    const attack = b.pattern[i],
      direction = action.directions[i] ?? attack;
    if (late || !action.directions[i] || direction === attack) {
      const damage = 8 + b.wins * 2;
      run.health -= damage;
      b.combo = 0;
      b.beats.push({ direction, attack, outcome: "hit", damage });
    } else if (direction === OPPOSITE[attack]) {
      b.combo++;
      const damage = GIRL_FIGHTERS[b.fighter].power + Math.min(8, b.combo * 2);
      b.enemyHealth = Math.max(0, b.enemyHealth - damage);
      b.hits++;
      b.beats.push({ direction, attack, outcome: "counter", damage });
    } else {
      b.combo = 0;
      b.beats.push({ direction, attack, outcome: "dodge", damage: 0 });
    }
  }
  b.exchanges++;
  b.stage = "ready";
  run.score = b.wins * 100 + b.hits * 10;
  run.log = b.beats.map((beat) =>
    beat.outcome === "counter"
      ? `Counter! ${beat.damage} damage.`
      : beat.outcome === "hit"
        ? `Caught your step. -${beat.damage} HP.`
        : "Clean slip.",
  );
  if (run.health <= 0) {
    end(run, "loss");
    return;
  }
  if (b.enemyHealth === 0) {
    b.wins++;
    run.score = b.wins * 100 + b.hits * 10;
    b.round++;
    run.health = Math.min(
      run.maxHealth,
      run.health + GIRL_FIGHTERS[b.fighter].heal,
    );
    if (b.wins >= 6) {
      end(run, "win");
      run.log.push("Six opponents down. Girl Fade champion.");
      return;
    }
    b.opponent = (b.opponent + 1) % 3;
    if (b.opponent === b.fighter) b.opponent = (b.opponent + 1) % 3;
    b.enemyMax = 56 + b.wins * 12;
    b.enemyHealth = b.enemyMax;
    run.log.push("Next girl. Faster pattern. Health carries over.");
  }
}
function marketAction(run: MarketRun, action: ArcadeAction, now: number) {
  if (
    action.type !== "duty" ||
    ![action.aim, action.stockLane].every(
      (n) => Number.isInteger(n) && n >= 0 && n < 5,
    )
  )
    throw new ArcadeRuleError("Choose one of the five market lanes.");
  if (now - run.lastAt < 400)
    throw new ArcadeRuleError("Let the shift advance.");
  const m = run.market;
  m.tick++;
  m.wave = 1 + Math.floor(m.tick / 16);
  m.aim = action.aim;
  m.destination = action.stockLane;
  m.firing = [];
  m.restock = null;
  m.cashier += Math.sign(m.destination - m.cashier);
  if (m.cashier === m.destination) {
    m.stock[m.cashier]++;
    if (m.stock[m.cashier] >= 6) {
      m.stock[m.cashier] = 0;
      m.powerups++;
      m.restock = m.cashier;
      if (m.cashier === 0) m.rapid = 18;
      if (m.cashier === 1) m.power = Math.min(14, m.power + 2);
      if (m.cashier === 2) m.freeze = 5;
      if (m.cashier === 3) run.health = Math.min(100, run.health + 15);
      if (m.cashier === 4) {
        const nearest = [...m.enemies]
          .sort((a, b) => b.position - a.position)
          .slice(0, 3);
        nearest.forEach((e) => (e.hp -= 10));
      }
    }
  }
  const spawning = m.tick % Math.max(1, 4 - Math.floor(m.wave / 2)) === 0;
  if (spawning) {
    const count = m.wave >= 6 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const hp = 6 + m.wave * 2;
      m.enemies.push({
        id: m.nextId++,
        lane: Math.floor(roll(run) * 5),
        position: 0,
        hp,
        maxHp: hp,
        variant: Math.floor(roll(run) * 2),
      });
    }
  }
  const shots = 1 + (m.rapid > 0 ? 1 : 0) + Math.floor(m.wave / 4);
  for (let i = 0; i < shots; i++) {
    const target = m.enemies
      .filter((e) => e.lane === m.aim && e.hp > 0)
      .sort((a, b) => b.position - a.position)[0];
    if (target) {
      target.hp -= m.power;
      m.firing.push(target.id);
    }
  }
  const dead = m.enemies.filter((e) => e.hp <= 0);
  m.kills += dead.length;
  m.enemies = m.enemies.filter((e) => e.hp > 0);
  const speed = 0.45 + Math.min(0.65, m.wave * 0.06);
  if (m.freeze <= 0) m.enemies.forEach((e) => (e.position += speed));
  const breach = m.enemies.filter((e) => e.position >= 12);
  run.health -= breach.length * 10;
  m.enemies = m.enemies.filter((e) => e.position < 12);
  m.rapid = Math.max(0, m.rapid - 1);
  m.freeze = Math.max(0, m.freeze - 1);
  run.score = m.kills * 10 + m.powerups * 20;
  run.log = [
    m.restock !== null
      ? `${STOCK_ITEMS[m.restock].name} stocked. ${STOCK_ITEMS[m.restock].effect}!`
      : breach.length
        ? "They reached the counter! Store integrity down."
        : dead.length
          ? `${dead.length} YN stopped. Keep those shelves stocked.`
          : `Wave ${m.wave}. Dr. Fade covers aisle ${m.aim + 1}.`,
  ];
  if (run.health <= 0) end(run, "loss");
}
function blockAction(run: BlockRun, action: ArcadeAction) {
  const b = run.block;
  if (action.type === "attack") {
    if (
      !Number.isInteger(action.tile) ||
      action.tile < 0 ||
      action.tile > 8 ||
      !blockCanAttack(run, action.tile)
    )
      throw new ArcadeRuleError(
        "Attack a neighboring district. Own six districts before the HQ.",
      );
    if (b.supplies < 1)
      throw new ArcadeRuleError("Gather supplies before attacking.");
    b.supplies--;
    const tile = b.tiles[action.tile];
    tile.defense -= b.power;
    run.health -= tile.owner === "rival" ? 3 : 1;
    if (tile.defense <= 0) {
      tile.owner = "player";
      tile.defense = 6;
      if (!tile.captured) {
        tile.captured = true;
        b.captured++;
      }
      if (action.tile === 5) b.supplies += 3;
      if (action.tile === 7)
        run.health = Math.min(run.maxHealth, run.health + 10);
      run.log = [`${DISTRICTS[action.tile]} is yours. Hold it.`];
      if (action.tile === 0) {
        end(run, "win");
        run.log = ["Headquarters captured. This block belongs to your crew."];
      }
    } else
      run.log = [
        `${DISTRICTS[action.tile]} has ${tile.defense} resistance left.`,
      ];
  } else if (action.type === "defend") {
    if (
      !Number.isInteger(action.tile) ||
      b.tiles[action.tile]?.owner !== "player"
    )
      throw new ArcadeRuleError("Fortify one of your districts.");
    if (b.supplies < 1)
      throw new ArcadeRuleError("Fortifying needs one supply.");
    b.supplies--;
    b.tiles[action.tile].defense = Math.min(
      12,
      b.tiles[action.tile].defense + 5,
    );
    run.log = [`${DISTRICTS[action.tile]} fortified.`];
  } else if (action.type === "supply") {
    b.supplies += 3;
    run.log = ["Three supplies collected. Rival crews still move."];
  } else if (action.type === "rally") {
    if (b.supplies < 3)
      throw new ArcadeRuleError("Rally needs three supplies.");
    b.supplies -= 3;
    run.health = Math.min(run.maxHealth, run.health + 14);
    b.power = Math.min(8, b.power + 1);
    run.log = ["Crew rallied. +14 health and stronger attacks."];
  } else throw new ArcadeRuleError("Choose a district action.");
  b.turn++;
  run.score = b.captured * 100 + (run.result === "win" ? 500 : 0);
  if (run.phase === "ended") return;
  const target = b.tiles[b.threat];
  if (target?.owner === "player") {
    const raid = 2 + Math.floor(b.turn / 8);
    target.defense -= raid;
    if (target.defense <= 0) {
      target.owner = "rival";
      target.defense = 4;
      run.health -= 10;
      run.log.push(`${DISTRICTS[b.threat]} fell to the raid.`);
    } else run.log.push("Your defenses held the raid.");
  }
  const owned = b.tiles
    .map((t, i) => (t.owner === "player" ? i : -1))
    .filter((i) => i >= 0);
  b.threat = owned.length ? owned[Math.floor(roll(run) * owned.length)] : 6;
  if (!owned.length || run.health <= 0 || b.turn >= b.maxTurns) {
    end(run, "loss");
    run.log.push("Your takeover ended. Captured-district rewards stay banked.");
  }
}
