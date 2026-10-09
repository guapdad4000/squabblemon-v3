import { BOSS_DISTRICT_SNAPSHOT } from "./bossDistricts";
import {
  createMatchFromEngineCards,
  createCardInstance,
  pass,
  playTurnCard,
  nextRound,
  getLaneScoreForMatch,
  getEffectiveCardPower,
  getLegalCardCost,
  type Match,
  type Lane,
  type CardInstance,
} from "./gameEngine";
import { catalogIdsToEngineIds, cards } from "./data";
import { BOSS_NPCS, type BossNpcId } from "./bossNpcCards";
export { BOSS_NPCS, type BossNpcId } from "./bossNpcCards";
export const BOSS_FORMS = [
  {
    tier: 1,
    name: "Patrol Shakedown",
    hp: 1200,
    art: "oink-tier-1",
    multiplier: 3,
    pressure: "Cheap-card checks and surveillance",
    reward: { softCurrency: 500, packTickets: 5, styleShards: 50 },
  },
  {
    tier: 2,
    name: "Riot Captain",
    hp: 1500,
    art: "oink-tier-2",
    multiplier: 4,
    pressure: "Reinforced shields and buff confiscation",
    reward: { softCurrency: 700, packTickets: 7, styleShards: 70 },
  },
  {
    tier: 3,
    name: "Tactical Commander",
    hp: 1575,
    art: "oink-tier-3",
    multiplier: 5,
    pressure: "Extra armor, drones and movement lockdown",
    reward: { softCurrency: 900, packTickets: 9, styleShards: 90 },
  },
  {
    tier: 4,
    name: "Federal Warden",
    hp: 1875,
    art: "oink-tier-4",
    multiplier: 6,
    pressure: "Federal taxes and trap confiscation",
    reward: { softCurrency: 1200, packTickets: 12, styleShards: 120 },
  },
  {
    tier: 5,
    name: "Commissioner Iron Tusk",
    hp: 2250,
    art: "oink-tier-5",
    multiplier: 7,
    pressure: "Maximum armor and the full department",
    reward: { softCurrency: 1600, packTickets: 15, styleShards: 150 },
  },
] as const;
export type BossTier = 1 | 2 | 3 | 4 | 5;
export const bossForm = (tier: BossTier = 1) => BOSS_FORMS[tier - 1];
export const BOSS_HP = BOSS_FORMS[0].hp;
export type BossCampaign = {
  version: 2;
  tier: BossTier;
  hp: number;
  totalDamage: number;
  attacks: number;
  tierAttacks: number;
  defeated: BossTier[];
  completed: boolean;
  earned: BossReward;
};
export const createBossCampaign = (): BossCampaign => ({
  version: 2,
  tier: 1,
  hp: BOSS_HP,
  totalDamage: 0,
  attacks: 0,
  tierAttacks: 0,
  defeated: [],
  completed: false,
  earned: { softCurrency: 0, packTickets: 0, styleShards: 0 },
});
/** One immutable campaign snapshot is updated alongside each authoritative run action. */
export function settleBossCampaign(
  c: BossCampaign,
  old: BossRaid,
  next: BossRaid,
) {
  if (c.completed || c.tier !== next.bossTier || c.hp !== old.hp)
    throw new BossRuleError("Campaign changed. Sync your raid.");
  const damage = next.score - old.score;
  if (damage < 0 || old.hp - next.hp !== damage)
    throw new BossRuleError("Invalid boss damage.");
  const campaign = {
    ...c,
    hp: next.hp,
    totalDamage: c.totalDamage + damage,
    defeated: [...c.defeated],
  };
  const reward: BossReward = {
    softCurrency: 0,
    packTickets: 0,
    styleShards: 0,
  };
  if (next.hp === 0) {
    Object.assign(reward, bossForm(c.tier).reward);
    campaign.defeated.push(c.tier);
    if (c.tier === 5) campaign.completed = true;
    else {
      campaign.tier = (c.tier + 1) as BossTier;
      campaign.hp = bossForm(campaign.tier).hp;
      campaign.tierAttacks = 0;
    }
  }
  return { campaign, reward };
}
export const BOSS_ROUNDS = 6;
export const BOSS_TIERS = [
  {
    score: 20,
    name: "Make Some Noise",
    softCurrency: 50,
    packTickets: 0,
    styleShards: 0,
  },
  {
    score: 50,
    name: "Crack the Badge",
    softCurrency: 100,
    packTickets: 1,
    styleShards: 0,
  },
  {
    score: 90,
    name: "Break the Line",
    softCurrency: 175,
    packTickets: 2,
    styleShards: 15,
  },
  {
    score: 130,
    name: "Heat on the Precinct",
    softCurrency: 250,
    packTickets: 3,
    styleShards: 25,
  },
  {
    score: 160,
    name: "Leave Your Mark",
    softCurrency: 350,
    packTickets: 5,
    styleShards: 50,
  },
] as const;
export type BossReward = {
  softCurrency: number;
  packTickets: number;
  styleShards: number;
};
export type BossBlast = {
  round: number;
  policeHands: [number, number, number];
  winners: ("player" | "cpu" | "draw")[];
  policePlays: { instanceId: string; name: string; lane: Lane; cost: number; boards: Match["boards"] }[];
  boardsBeforePolice: Match["boards"];
  boards: Match["boards"];
  hands: [number, number, number];
  armor: [number, number, number];
  damage: [number, number, number];
  total: number;
  hpBefore: number;
  hpAfter: number;
};
export type BossRaid = {
  version: 1;
  rulesVersion: 2;
  id: string;
  day: string;
  revision: number;
  phase: "active" | "complete" | "retired";
  deckName: string;
  bossTier: BossTier;
  maxHp: number;
  startHp: number;
  match: Match;
  hp: number;
  score: number;
  blasts: BossBlast[];
  log: string[];
  used: string[];
  temporarySilences: string[];
};
export type BossAction =
  | {
      type: "play";
      instanceId: string;
      lane: Lane;
      squabble?: boolean;
      investment?: number;
    }
  | { type: "blast" }
  | { type: "retire" };
export type BossStatus = {
  day: string;
  resetsAt: string;
  serverNow: number;
  attemptsRemaining: number;
  run: BossRaid | null;
  earned: BossReward;
  bestScore: number;
  campaign: BossCampaign;
  history: { day: string; score: number; defeated: boolean }[];
};
export class BossRuleError extends Error {}
export const bossDay = (now: Date) => now.toISOString().slice(0, 10);
export const bossReset = (now: Date) =>
  new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  ).toISOString();
export function bossRewards(run: BossRaid): BossReward {
  const tier = [...BOSS_TIERS].reverse().find((t) => run.score >= t.score);
  return tier
    ? {
        softCurrency: tier.softCurrency,
        packTickets: tier.packTickets,
        styleShards: tier.styleShards,
      }
    : { softCurrency: 0, packTickets: 0, styleShards: 0 };
}
const active = (c: CardInstance) =>
  c.owner === "cpu" &&
  !!BOSS_NPCS[c.cardId as BossNpcId] &&
  !c.statuses.silenced &&
  !c.statuses.frozen;
const npcAt = (m: Match, lane: Lane, id: BossNpcId) =>
  m.boards[lane].some((c) => c.cardId === id && active(c));
const players = (m: Match, lane?: Lane) =>
  (lane === undefined ? m.boards.flat() : m.boards[lane]).filter(
    (c) => c.owner === "player",
  );
function note(r: BossRaid, text: string) {
  r.log = [...r.log, text].slice(-24);
}
function edit(r: BossRaid, id: string, fn: (c: CardInstance) => CardInstance) {
  r.match.boards = r.match.boards.map((l) =>
    l.map((c) => (c.instanceId === id ? fn(c) : c)),
  ) as Match["boards"];
}
function hit(r: BossRaid, c: CardInstance, n: number, reason: string) {
  if (c.statuses.protected || c.statuses.uncounterable) {
    note(r, c.name + " blocked " + reason + ".");
    return;
  }
  edit(r, c.instanceId, (t) => ({
    ...t,
    powerModifier: t.powerModifier - n,
    lastEffectNote: reason + ": −" + n + " Hands.",
  }));
  note(r, c.name + " −" + n + " Hands · " + reason);
}
function lockPoliceLanes(r: BossRaid) {
  for (const lane of [0, 1, 2] as const)
    if (npcAt(r.match, lane, "raid-operator"))
      for (const card of players(r.match, lane)) {
        if (card.statuses.protected || card.statuses.uncounterable) continue;
        edit(r, card.instanceId, c => ({ ...c,
          squabblehouseCannotMoveThroughRound: r.match.round,
          lastEffectNote: "Airspace Denied: movement held this round.",
        }));
      }
}
/** Board-only planning: never inspect the player's unrevealed hand. Illegal
 * candidates (locked lanes, trap restrictions, taxes) are rejected by real rules. */
function choosePolicePlay(m: Match) {
  const options: { instanceId: string; lane: Lane; score: number; cost: number }[] = [];
  for (const c of m.cpuHand) for (const lane of [0, 1, 2] as const) {
    try {
      const n = playTurnCard(m, "cpu", c.instanceId, lane);
      const result = bossBlastPreview(n);
      const control = result.winners.reduce((v, w) => v + (w === "cpu" ? 15 : w === "player" ? -15 : 0), 0);
      const margin = result.policeHands.reduce((v, power, l) => {
        const lead = power - result.hands[l];
        return v + 12 * lead / (4 + Math.abs(lead));
      }, 0);
      const targets = players(m, lane).filter(p => !p.hazard);
      const pressure = c.cardId === "raid-ham" ? targets.reduce((v, p) => v + Math.min(3, Math.max(0, p.powerModifier)), 0)
        : c.cardId === "raid-hog" ? targets.length
        : c.cardId === "raid-protester" ? (m.districtTraps ?? []).filter(t => t.owner === "player" && t.lane === lane).length * 3
        : c.cardId === "raid-hound" ? targets.filter(p => p.cost <= 2).length * 0.5
        : c.cardId === "raid-feds" ? targets.filter(p => p.kind === "token").length * 2
        : 0;
      options.push({ instanceId: c.instanceId, lane, cost: getLegalCardCost(m, "cpu", c, lane), score: control + margin + pressure });
    } catch { /* Native engine rejects unavailable plays. */ }
  }
  return options.sort((a, b) => b.score - a.score || a.cost - b.cost || a.instanceId.localeCompare(b.instanceId) || ((a.lane + m.round) % 3) - ((b.lane + m.round) % 3))[0];
}
/** The precinct spends its own Motion through native legal plays, then passes. */
function policeTurn(r: BossRaid) {
  const plays: BossBlast["policePlays"] = [];
  r.match.cpuHand = r.match.cpuHand.map(c => {
    const npc = BOSS_NPCS[c.cardId as BossNpcId];
    return npc ? { ...c,
      basePower: npc.power + Math.floor((r.bossTier - 1) / 2),
      raidArmor: (c.cardId === "raid-hog" ? 4 : 1) + (r.bossTier >= 3 ? 1 : 0),
    } : c; // Native abilities may give the opponent ordinary cards.
  });
  r.match = pass(r.match, "player");
  for (let i = 0; i < 10; i++) {
    const choice = choosePolicePlay(r.match);
    if (!choice) break;
    const card = r.match.cpuHand.find(c => c.instanceId === choice.instanceId)!;
    const cost = getLegalCardCost(r.match, "cpu", card, choice.lane);
    r.match = playTurnCard(r.match, "cpu", choice.instanceId, choice.lane, false, 0);
    plays.push({ instanceId: card.instanceId, name: card.name, lane: choice.lane, cost, boards: structuredClone(r.match.boards) });
    note(r, `${card.name} played in lane ${choice.lane + 1} for ${cost} Motion.`);
  }
  r.match = pass(r.match, "cpu");
  lockPoliceLanes(r);
  return plays;
}
/** Server calls this only after catalog ownership/deck legality validation. */
export function createBossRaid(
  id: string,
  day: string,
  catalogIds: string[],
  deckName: string,
  encounter: { tier: BossTier; hp: number } = { tier: 1, hp: BOSS_HP },
): BossRaid {
  const ids = catalogIdsToEngineIds(catalogIds);
  // The same date produces the same shuffle and police lane rotation for everyone.
  let seed = Array.from(day).reduce(
    (n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0,
    7,
  );
  const shuffled = [...ids];
  for (let i = shuffled.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const m = createMatchFromEngineCards(
    "raid-player",
    shuffled,
    "boss-raid",
    ids,
    undefined,
    undefined,
    undefined,
    BOSS_DISTRICT_SNAPSHOT,
  );
  // Enemy-only definitions remain outside the collectible catalog. Shuffle a
  // real ten-card opponent deck independently of the player's private hand.
  const police = Object.keys(BOSS_NPCS) as BossNpcId[];
  for (let i = police.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [police[i], police[j]] = [police[j], police[i]];
  }
  m.cpuCardIds = police;
  m.cpuHand = police.slice(0, 5).map((id, i) => createCardInstance(id, "cpu", "boss-raid", i));
  m.cpuDrawIndex = 5;
  const r: BossRaid = {
    version: 1,
    rulesVersion: 2,
    id,
    day,
    revision: 0,
    phase: "active",
    deckName,
    bossTier: encounter.tier,
    maxHp: bossForm(encounter.tier).hp,
    startHp: encounter.hp,
    match: m,
    hp: encounter.hp,
    score: 0,
    blasts: [],
    log: ["Officer Oink has called in the whole precinct."],
    used: [],
    temporarySilences: [],
  };
  return r;
}
export function bossCardCost(
  r: BossRaid,
  c: CardInstance,
  lane: Lane,
  squabble = false,
  investment = 0,
) {
  return (
    getLegalCardCost(r.match, "player", c, lane) * (squabble ? 2 : 1) +
    investment +
    (npcAt(r.match, lane, "raid-feds") && !r.used.includes("tax:" + lane)
      ? 1
      : 0)
  );
}
export function bossBlastPreview(m: Match, tier: BossTier = 1) {
  const hands = [0, 1, 2].map((l) =>
    getLaneScoreForMatch(m, players(m, l as Lane), l as Lane, "player"),
  ) as BossBlast["hands"];
  const armor = [0, 1, 2].map((l) =>
    m.boards[l]
      .filter(active)
      .reduce(
        (n, c) =>
          n +
          ((c as CardInstance & { raidArmor?: number }).raidArmor ??
            (c.cardId === "raid-hog" ? 4 : 1)),
        0,
      ),
  ) as BossBlast["armor"];
  const policeHands = [0, 1, 2].map(l => getLaneScoreForMatch(m,
    m.boards[l].filter(c => c.owner === "cpu"), l as Lane, "cpu")) as BossBlast["policeHands"];
  const winners = hands.map((n, l) => n > policeHands[l] ? "player" as const : n < policeHands[l] ? "cpu" as const : "draw" as const);
  // Control determines how much of a lane's Hands gets through the precinct.
  // Every surviving character supplies 2 charge, even under suppression.
  // Winning lanes add full Hands; ties half; losing lanes a quarter, minus armor.
  const damage = hands.map((n, l) => Math.max(0,
    Math.floor(n * (winners[l] === "player" ? 1 : winners[l] === "draw" ? 0.5 : 0.25)) - armor[l])
    + players(m, l as Lane).filter(c => !c.hazard).length * 2)
    .map(n => n * bossForm(tier).multiplier) as BossBlast["damage"];
  return { hands, policeHands, winners, armor, damage, total: damage.reduce((a, b) => a + b, 0) };
}
export function applyBossAction(
  current: BossRaid,
  action: BossAction,
): BossRaid {
  if (current.phase !== "active")
    throw new BossRuleError("This raid has ended.");
  const r = structuredClone(current);
  r.revision++;
  if (action.type === "retire") {
    r.phase = "retired";
    note(r, "Raid ended. Earned tiers remain banked.");
    return r;
  }
  if (action.type === "play") {
    const card = r.match.playerHand.find(
      (c) => c.instanceId === action.instanceId,
    );
    if (!card || ![0, 1, 2].includes(action.lane))
      throw new BossRuleError("Choose a card in your hand and an open lane.");
    const lane = action.lane,
      tax =
        bossCardCost(r, card, lane) -
        getLegalCardCost(r.match, "player", card, lane);
    if (r.match.playerMotion < bossCardCost(r, card, lane))
      throw new BossRuleError("Not enough Motion, including the RICO tax.");
    r.match.playerMotion -= tax;
    if (tax) r.used.push("tax:" + lane);
    const surveillance =
      npcAt(r.match, lane, "raid-drone") &&
      !r.used.includes("drone:" + lane) &&
      (card.kind ?? "character") === "character";
    if (
      surveillance &&
      !card.statuses.silenced &&
      !card.statuses.uncounterable &&
      !card.statuses.protected
    ) {
      r.match.playerHand = r.match.playerHand.map((c) =>
        c.instanceId === card.instanceId
          ? { ...c, statuses: { ...c.statuses, silenced: true } }
          : c,
      );
      r.temporarySilences.push(card.instanceId);
      r.used.push("drone:" + lane);
      note(r, "No Blind Spots: " + card.name + " is silenced this round.");
    }
    try {
      r.match = playTurnCard(
        r.match,
        "player",
        card.instanceId,
        lane,
        action.squabble ?? false,
        action.investment ?? 0,
      );
    } catch (e) {
      throw new BossRuleError(e instanceof Error ? e.message : "Illegal play.");
    }
    const landed = r.match.boards
      .flat()
      .find((c) => c.instanceId === card.instanceId);
    if (
      landed &&
      npcAt(r.match, lane, "raid-hound") &&
      card.cost <= 2 &&
      !r.used.includes("hound:" + lane)
    ) {
      r.used.push("hound:" + lane);
      hit(r, landed, 2, "Follow the Scent");
    }
    return r;
  }
  const boardsBeforePolice = structuredClone(r.match.boards);
  const policePlays = policeTurn(r);
  // Resolve enemy pressure before native round-end bonds, Mary Mack, and all card timers.
  for (const lane of [0, 1, 2] as const) {
    if (npcAt(r.match, lane, "raid-protester")) {
      const hazards = players(r.match, lane).filter((c) => c.hazard);
      r.match.boards[lane] = r.match.boards[lane].filter(
        (c) => !hazards.includes(c),
      );
      const traps = r.match.districtTraps ?? [];
      r.match.districtTraps = traps.filter(
        (t) => t.owner !== "player" || t.lane !== lane,
      );
      if (hazards.length || traps.length !== r.match.districtTraps.length)
        note(r, "Entrapment: lane " + (lane + 1) + " traps confiscated.");
    }
    for (const card of players(r.match, lane)) {
      if (card.hazard) continue;
      if (npcAt(r.match, lane, "raid-ham") && card.powerModifier > 0)
        hit(r, card, Math.min(3, card.powerModifier), "Asset Forfeiture");
      if (npcAt(r.match, lane, "raid-hog")) hit(r, card, 1, "Riot Shield");
      if (
        npcAt(r.match, lane, "raid-feds") &&
        (card.kind === "token" || !cards[card.cardId])
      )
        hit(r, card, 2, "RICO Sweep");
      if (
        r.match.boards.flat().some((c) => c.cardId === "raid-oink" && active(c))
      )
        hit(r, card, 1, "Protection Racket");
    }
  }
  if (
    r.match.boards.flat().some((c) => c.cardId === "raid-judge" && active(c))
  ) {
    const target = players(r.match)
      .filter((c) => !c.hazard)
      .sort(
        (a, b) =>
          getEffectiveCardPower(b) - getEffectiveCardPower(a) ||
          a.instanceId.localeCompare(b.instanceId),
      )[0];
    if (target) hit(r, target, 3, "Maximum Sentence");
  }
  const hpBefore = r.hp;
  r.match = nextRound({ ...r.match, phase: "resolved" }, (settled) => {
    const blast = bossBlastPreview(settled, r.bossTier),
      total = Math.min(r.hp, blast.total);
    r.hp -= total;
    r.score += total;
    let remaining = total;
    const damage = blast.damage.map(n => {
      const applied = Math.min(n, remaining);
      remaining -= applied;
      return applied;
    }) as BossBlast["damage"];
    r.blasts.push({
      round: current.match.round,
      ...blast,
      damage,
      policePlays,
      boardsBeforePolice,
      boards: structuredClone(settled.boards),
      total,
      hpBefore,
      hpAfter: r.hp,
    });
    note(r, "Round " + current.match.round + ": " + total + " damage to Oink.");
    // Only surveillance applied by this mode expires; existing silence is untouched.
    settled.boards = settled.boards.map((l) =>
      l.map((c) =>
        r.temporarySilences.includes(c.instanceId)
          ? { ...c, statuses: { ...c.statuses, silenced: false } }
          : c,
      ),
    ) as Match["boards"];
    settled.playerHand = settled.playerHand.map((c) =>
      r.temporarySilences.includes(c.instanceId)
        ? { ...c, statuses: { ...c.statuses, silenced: false } }
        : c,
    );
    return settled;
  });
  r.temporarySilences = [];
  r.used = [];
  if (r.hp === 0 || current.match.round === BOSS_ROUNDS) {
    r.phase = "complete";
    r.match.phase = "complete";
    note(
      r,
      r.hp === 0
        ? "OINK DOWN. The block fought back."
        : "Six rounds survived. Come back stronger tomorrow.",
    );
  } else lockPoliceLanes(r);
  return r;
}
