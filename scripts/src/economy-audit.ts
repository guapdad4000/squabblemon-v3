import { pathToFileURL } from "node:url";
import {
  cardCatalog,
  ROOKIE_MENTOR_CORE_IDS,
  type CardRarity,
} from "@workspace/squabblemon-engine/data";
import {
  ECONOMY_VERSION,
  MISSION_TEMPLATES,
  MOVE_TRAINING_COSTS,
  TICKETS_PER_MAJOR_STORY_NODE,
  WELCOME_REWARD,
  battleEarnings,
} from "@workspace/squabblemon-engine/economy";
import { CARD_XP_CAP } from "@workspace/squabblemon-engine/cardProgression";
import {
  RARE_PLUS_GUARANTEE_WEIGHTS,
  STREET_PACK_RARITY_WEIGHTS,
  STREET_PACK_RULES,
} from "@workspace/squabblemon-engine/packRules";
import { storyContent } from "@workspace/squabblemon-engine/story";

export const AUDIT_SEED = 0x5a17c0de;
export const ITERATIONS = 100_000;
const RARITIES: readonly CardRarity[] = [
  "SuperCommon", "Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythical",
];
const RARE_PLUS: readonly CardRarity[] = ["Rare", "Epic", "Legendary", "Mythical"];

export type EconomyVersion = "v1" | "v2";
type Wallet = {
  owned: Set<string>;
  variants: Set<string>;
  pity: number;
  clout: number;
  tickets: number;
  shards: number;
};
type PackResult = {
  draws: Array<{ cardId: string; rarity: CardRarity; isNew: boolean }>;
  cardRarities: CardRarity[];
  newRarities: CardRarity[];
  featured: boolean;
  forcedRare: CardRarity | null;
  clout: number;
  shards: number;
  bonusClout: number;
  bonusShards: number;
};

/**
 * Immutable historical fixture. Values were transcribed from the linked source
 * blobs at the recorded revision, rather than being resolved through git HEAD
 * at runtime (which would change as soon as this audit is committed).
 */
export const V1_BASELINE = Object.freeze({
  sourceRevision: "e3069d1437f23412743a1811a6d2a9ff9459f4a1",
  sourceBlobs: Object.freeze({
    "lib/squabblemon-engine/src/economy.ts": "ff763626f593dcde70ea67029217a9bdacb9a8a2",
    "artifacts/api-server/src/lib/collectionEconomy.ts": "0b2421e5085102914b157dd36f2105eb249dcc8b",
    "artifacts/api-server/src/lib/playerState.ts": "dbbcc5724f128bf7066ffbafeeb6d64fe207d004",
    "lib/squabblemon-engine/src/data.ts": "a4b1b8c19c82b9c2757c666aa4b9dc67e3ff60bd",
    "lib/squabblemon-engine/src/seasonTwo.ts": "c7a7dd05ce08e813865d516ecee7d2fe0d0b405f",
  }),
  starterCardIds: Object.freeze([
    "dr-fade", "cornball", "plug", "snow-bunny", "wifey", "hooper", "rastamon",
    "all-jokes-roaster", "bus-pass", "soul-food", "cognac-bottle", "barber-bro",
    "bottle-girl", "sneaker-reseller", "church-auntie", "landlord", "car-meet-kid",
    "promoter", "nail-tech", "og-uncle", "delivery-demon",
  ]),
  welcome: Object.freeze({ accountXp: 100, softCurrency: 250, packTickets: 1, streetRep: 5 }),
  missions: Object.freeze({
    rookieTickets: 1,
    dailyClout: 250,
    weeklyClout: 300,
    weeklyTickets: 2,
  }),
  storyChapters: Object.freeze([
    ["block-party", 7, 775, 250, 10],
    ["red-side-tapes", 6, 1075, 500, 11],
    ["blue-side-blues", 3, 290, 0, 10],
    ["side-show", 7, 865, 0, 10],
    ["old-heads-know", 8, 935, 0, 10],
    ["the-function", 3, 350, 0, 10],
    ["return-of-the-block", 8, 955, 0, 10],
    ["the-crown", 9, 1310, 0, 10],
    ["s2-the-morning-after", 3, 465, 0, 1],
    ["s2-the-rent-party", 3, 425, 0, 1],
    ["s2-unlicensed-improvements", 3, 425, 0, 1],
    ["s2-regular-guy-behavior", 3, 425, 0, 1],
    ["s2-museum-of-the-block", 3, 465, 0, 1],
    ["s2-everybody-has-a-buyer", 3, 425, 0, 1],
    ["s2-premiere-night", 3, 465, 0, 1],
    ["s2-the-blockbuster", 3, 425, 0, 3],
    ["special-sherlock-missing-motion", 2, 225, 0, 2],
    ["special-sherlock-false-bottom", 2, 400, 0, 2],
    ["special-sherlock-last-reel", 2, 550, 0, 5],
  ] as const),
});

const missionReward = (missionKey: string) => {
  const mission = MISSION_TEMPLATES.find((entry) => entry.missionKey === missionKey);
  if (!mission) throw new Error(`Missing authoritative mission ${missionKey}`);
  return mission.rewardAmount;
};
const v2Win = battleEarnings("win", ECONOMY_VERSION).softCurrency;
const v2Draw = battleEarnings("draw", ECONOMY_VERSION).softCurrency;
const v2Loss = battleEarnings("loss", ECONOMY_VERSION).softCurrency;

export const RULES = {
  v1: {
    matchClout: { win: 40, draw: 30, loss: 20 },
    duplicateShards: 25,
    bonus: { shards: 0.70, clout: 0.25, style: 0.05 },
    shardAmounts: [15, 25, 40],
    cloutAmounts: [50, 100],
    coaching: [150, 400, 900],
    majorTickets: 10,
    starterCards: V1_BASELINE.starterCardIds.length,
  },
  v2: {
    matchClout: { win: v2Win, draw: v2Draw, loss: v2Loss },
    duplicateShards: STREET_PACK_RULES.duplicateStyleShards,
    bonus: {
      shards: STREET_PACK_RULES.bonus.styleShardChance / 100,
      clout: STREET_PACK_RULES.bonus.cloutChance / 100,
      style: STREET_PACK_RULES.bonus.featuredStyleChance / 100,
    },
    shardAmounts: STREET_PACK_RULES.bonus.styleShardAmounts,
    cloutAmounts: STREET_PACK_RULES.bonus.cloutAmounts,
    coaching: MOVE_TRAINING_COSTS,
    majorTickets: TICKETS_PER_MAJOR_STORY_NODE,
    starterCards: ROOKIE_MENTOR_CORE_IDS.length,
  },
  shared: {
    rarityWeights: STREET_PACK_RARITY_WEIGHTS,
    packClout: STREET_PACK_RULES.single.softCurrencyCost,
    tenPullClout: STREET_PACK_RULES.ten.softCurrencyCost,
    pity: STREET_PACK_RULES.pityLimit,
    rareGuarantee: RARE_PLUS_GUARANTEE_WEIGHTS,
  },
} as const;

export function seededRandom(seed = AUDIT_SEED) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(items: readonly T[], random: () => number): T =>
  items[Math.floor(random() * items.length)];

function weighted<T extends string>(
  weights: Readonly<Record<T, number>>,
  random: () => number,
): T {
  const entries = Object.entries(weights) as Array<[T, number]>;
  const roll = random() * entries.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = 0;
  for (const [value, weight] of entries) {
    cursor += weight;
    if (roll < cursor) return value;
  }
  return entries.at(-1)![0];
}

function makeWallet(ownedIds: readonly string[]): Wallet {
  return {
    owned: new Set(ownedIds),
    variants: new Set(),
    pity: 0,
    clout: 0,
    tickets: 0,
    shards: 0,
  };
}

function chooseV1Card(
  wallet: Wallet,
  pulled: Set<string>,
  guaranteeMissing: boolean,
  random: () => number,
) {
  const eligible = cardCatalog.filter((card) => !pulled.has(card.catalogId));
  const missing = eligible.filter((card) => !wallet.owned.has(card.catalogId));
  const pool = guaranteeMissing && missing.length ? missing : eligible;
  const rarity = weighted(RULES.shared.rarityWeights, random);
  const rarityPool = pool.filter((card) => card.rarity === rarity);
  return pick(rarityPool.length ? rarityPool : pool, random);
}

function chooseV2Card(
  wallet: Wallet,
  pulled: Set<string>,
  guaranteeMissing: boolean,
  random: () => number,
) {
  const rarity = weighted(RULES.shared.rarityWeights, random);
  const wholeTier = cardCatalog.filter((card) => card.rarity === rarity);
  if (!wholeTier.length) throw new Error(`Street Pack rarity tier ${rarity} has no gameplay cards`);
  const notPulled = wholeTier.filter((card) => !pulled.has(card.catalogId));
  const eligible = notPulled.length ? notPulled : wholeTier;
  const missingInTier = eligible.filter((card) => !wallet.owned.has(card.catalogId));
  return pick(guaranteeMissing && missingInTier.length ? missingInTier : eligible, random);
}

function availableVariants(wallet: Wallet) {
  return cardCatalog.flatMap((card) =>
    card.variantSlots
      .filter((variant) => !wallet.variants.has(variant.id))
      .map((variant) => ({ card, variant })),
  );
}

export function openPack(
  version: EconomyVersion,
  wallet: Wallet,
  random: () => number,
): PackResult {
  const rules = RULES[version];
  const result: PackResult = {
    draws: [], cardRarities: [], newRarities: [], featured: false,
    forcedRare: null, clout: 0, shards: 0, bonusClout: 0, bonusShards: 0,
  };
  const pulled = new Set<string>();
  for (let slot = 0; slot < 5; slot += 1) {
    const card = version === "v1"
      ? chooseV1Card(wallet, pulled, slot < 2, random)
      : chooseV2Card(wallet, pulled, slot < 2, random);
    pulled.add(card.catalogId);
    result.cardRarities.push(card.rarity);
    const isNew = !wallet.owned.has(card.catalogId);
    result.draws.push({ cardId: card.catalogId, rarity: card.rarity, isNew });
    if (!isNew) {
      result.shards += rules.duplicateShards;
    } else {
      wallet.owned.add(card.catalogId);
      result.newRarities.push(card.rarity);
    }
  }
  const variants = availableVariants(wallet);
  const forcedStyle = variants.length > 0 && wallet.pity >= RULES.shared.pity - 1;
  const roll = forcedStyle ? 0.9999 : random();
  if ((forcedStyle || roll >= 0.95) && variants.length) {
    const selected = pick(variants, random);
    wallet.variants.add(selected.variant.id);
    result.featured = true;
    wallet.pity = 0;
  } else if (roll < rules.bonus.shards) {
    result.bonusShards = pick(rules.shardAmounts, random);
    result.shards += result.bonusShards;
    wallet.pity = Math.min(RULES.shared.pity - 1, wallet.pity + 1);
  } else if (roll < rules.bonus.shards + rules.bonus.clout) {
    result.bonusClout = pick(rules.cloutAmounts, random);
    result.clout += result.bonusClout;
    wallet.pity = Math.min(RULES.shared.pity - 1, wallet.pity + 1);
  } else {
    // Historical v1 converted exhausted style rolls to 50 shards. Finalized v2
    // converts them to the shared Clout amount instead.
    if (version === "v1") {
      result.bonusShards = 50;
      result.shards += result.bonusShards;
    } else {
      result.bonusClout = STREET_PACK_RULES.bonus.exhaustedStyleClout;
      result.clout += result.bonusClout;
    }
    wallet.pity = 0;
  }
  if (!variants.length) wallet.pity = 0;
  wallet.clout += result.clout;
  wallet.shards += result.shards;
  return result;
}

export function drawRarePlusGuarantee(
  version: EconomyVersion,
  ownedCardIds: ReadonlySet<string>,
  random: () => number,
) {
  const rarity = version === "v1"
    ? RARE_PLUS.slice().reverse().find((candidate) =>
        cardCatalog.some((card) => card.rarity === candidate && !ownedCardIds.has(card.catalogId)),
      ) ?? "Mythical"
    : weighted(RULES.shared.rareGuarantee, random);
  const tier = cardCatalog.filter((card) => card.rarity === rarity);
  const missing = tier.filter((card) => !ownedCardIds.has(card.catalogId));
  const card = version === "v1"
    ? pick(missing.length ? missing : tier, random)
    : pick(tier, random);
  return { card, isDuplicate: ownedCardIds.has(card.catalogId) };
}

function applyForcedCard(
  version: EconomyVersion,
  wallet: Wallet,
  random: () => number,
  result: PackResult,
) {
  const { card, isDuplicate } = drawRarePlusGuarantee(version, wallet.owned, random);
  if (wallet.owned.has(card.catalogId)) {
    const shards = RULES[version].duplicateShards;
    wallet.shards += shards;
    result.shards += shards;
  } else {
    wallet.owned.add(card.catalogId);
    result.newRarities.push(card.rarity);
  }
  result.draws.push({ cardId: card.catalogId, rarity: card.rarity, isNew: !isDuplicate });
  result.cardRarities.push(card.rarity);
  result.forcedRare = card.rarity;
}

export function openTenPull(
  version: EconomyVersion,
  wallet: Wallet,
  random: () => number,
) {
  const results = Array.from({ length: 10 }, () => openPack(version, wallet, random));
  const hasRarePlus = results.some((result) =>
    result.cardRarities.some((rarity) => RARE_PLUS.includes(rarity)),
  );
  if (!hasRarePlus) {
    const target = results.at(-1)!;
    if (version === "v1") {
      // v1 replaces the final bonus reward.
      target.shards -= target.bonusShards;
      target.clout -= target.bonusClout;
      wallet.shards -= target.bonusShards;
      wallet.clout -= target.bonusClout;
      target.bonusShards = 0;
      target.bonusClout = 0;
    } else {
      // Finalized v2 replaces the final gameplay slot, never the bonus.
      const removed = target.draws.pop()!;
      target.cardRarities.pop();
      if (removed.isNew) {
        wallet.owned.delete(removed.cardId);
        const rarityIndex = target.newRarities.lastIndexOf(removed.rarity);
        target.newRarities.splice(rarityIndex, 1);
      } else {
        target.shards -= RULES.v2.duplicateShards;
        wallet.shards -= RULES.v2.duplicateShards;
      }
    }
    applyForcedCard(version, wallet, random, target);
  }
  return results;
}

const countRarities = (values: readonly CardRarity[]) =>
  Object.fromEntries(RARITIES.map((rarity) => [rarity, values.filter((value) => value === rarity).length]));
const percent = (count: number, denominator: number) =>
  Number((100 * count / Math.max(1, denominator)).toFixed(3));
const percentile = (values: number[], p: number) =>
  values.sort((a, b) => a - b)[Math.floor((values.length - 1) * p)];

function simulatePacks(version: EconomyVersion, startingOwned: readonly string[], iterations: number, seed: number) {
  const random = seededRandom(seed);
  const cardRarities: CardRarity[] = [];
  const newRarities: CardRarity[] = [];
  const shards: number[] = [];
  const clout: number[] = [];
  let featured = 0;
  for (let index = 0; index < iterations; index += 1) {
    // Independent accounts measure the state requested, rather than one account
    // drifting from new to complete during the run.
    const wallet = makeWallet(startingOwned);
    const result = openPack(version, wallet, random);
    cardRarities.push(...result.cardRarities);
    newRarities.push(...result.newRarities);
    shards.push(result.shards);
    clout.push(result.clout);
    if (result.featured) featured += 1;
  }
  const counts = countRarities(cardRarities);
  const newCounts = countRarities(newRarities);
  return {
    iterations,
    cardRarityPercent: Object.fromEntries(RARITIES.map((rarity) => [
      rarity, percent(counts[rarity], cardRarities.length),
    ])),
    newUnlocksPerPack: Number((newRarities.length / iterations).toFixed(3)),
    newUnlockRarityPercent: Object.fromEntries(RARITIES.map((rarity) => [
      rarity, percent(newCounts[rarity], newRarities.length),
    ])),
    rarePlusPackPercent: percent(
      Array.from({ length: iterations }, (_, index) =>
        cardRarities.slice(index * 5, index * 5 + 5).some((rarity) => RARE_PLUS.includes(rarity)) ? 1 : 0,
      ).reduce((sum, value) => sum + value, 0),
      iterations,
    ),
    averageShards: Number((shards.reduce((sum, value) => sum + value, 0) / iterations).toFixed(3)),
    averageClout: Number((clout.reduce((sum, value) => sum + value, 0) / iterations).toFixed(3)),
    featuredPercent: percent(featured, iterations),
    shardP50P95: [percentile(shards, 0.5), percentile(shards, 0.95)],
  };
}

function simulateGuarantees(version: EconomyVersion, iterations: number, seed: number) {
  const random = seededRandom(seed);
  const forced: CardRarity[] = [];
  // Directly exercise the fallback distribution: this avoids natural Rare+
  // masking the very guarantee whose v1 rarest-first behavior is under audit.
  for (let index = 0; index < iterations; index += 1) {
    const wallet = makeWallet([]);
    const result: PackResult = {
      draws: [], cardRarities: [], newRarities: [], featured: false,
      forcedRare: null, clout: 0, shards: 0, bonusClout: 0, bonusShards: 0,
    };
    applyForcedCard(version, wallet, random, result);
    forced.push(result.forcedRare!);
  }
  const counts = countRarities(forced);
  return Object.fromEntries(RARE_PLUS.map((rarity) => [rarity, percent(counts[rarity], forced.length)]));
}

function currentStoryLedger() {
  const byChapter = storyContent.chapters.map((chapter) => {
    let battles = 0, profileXp = 0, clout = 0, authoredTickets = 0;
    for (const node of chapter.nodes) {
      if (node.kind === "battle") battles += 1;
      for (const reward of node.rewards) {
        if (reward.kind === "currency" && reward.id === "street-xp") profileXp += reward.amount;
        if (reward.kind === "currency" && reward.id === "clout") clout += reward.amount;
        if (reward.kind === "pack-ticket") authoredTickets += reward.amount;
      }
    }
    return { order: chapter.order, id: chapter.id, battles, profileXp, clout, authoredTickets };
  });
  return summarizeStory(byChapter, storyContent.chapters.reduce((sum, chapter) => sum + chapter.nodes.length, 0));
}

function baselineStoryLedger() {
  const byChapter = V1_BASELINE.storyChapters.map(
    ([id, battles, profileXp, clout, authoredTickets], index) => ({
      order: index + 1, id, battles, profileXp, clout, authoredTickets,
    }),
  );
  return summarizeStory(byChapter, 119);
}

function summarizeStory(
  byChapter: Array<{
    order: number; id: string; battles: number; profileXp: number;
    clout: number; authoredTickets: number;
  }>,
  nodes: number,
) {
  return {
    chapters: byChapter.length,
    nodes,
    battles: byChapter.reduce((sum, chapter) => sum + chapter.battles, 0),
    profileXp: byChapter.reduce((sum, chapter) => sum + chapter.profileXp, 0),
    clout: byChapter.reduce((sum, chapter) => sum + chapter.clout, 0),
    authoredTickets: byChapter.reduce((sum, chapter) => sum + chapter.authoredTickets, 0),
    perfectClearTickets: byChapter.reduce((sum, chapter) => sum + chapter.battles, 0),
    totalTicketsWithAllPerfectClears:
      byChapter.reduce((sum, chapter) => sum + chapter.authoredTickets + chapter.battles, 0),
    byChapter,
  };
}

function journey(version: EconomyVersion) {
  const rules = RULES[version];
  const welcome = version === "v1" ? V1_BASELINE.welcome : WELCOME_REWARD;
  const missions = version === "v1"
    ? V1_BASELINE.missions
    : {
        rookieTickets: missionReward("rookie-road"),
        dailyClout: missionReward("daily-show-up") + missionReward("daily-take-room"),
        weeklyClout: missionReward("weekly-cleanse") + missionReward("weekly-movement") +
          missionReward("weekly-experiment"),
        weeklyTickets: missionReward("weekly-main-character"),
      };
  const firstSession = {
    assumptions: "onboarding claim + W/L/W, daily show-up + take-room claims, rookie ticket claim, one perfect story clear",
    matches: 3,
    clout: welcome.softCurrency + rules.matchClout.win * 2 + rules.matchClout.loss + missions.dailyClout,
    tickets: welcome.packTickets + missions.rookieTickets + 1,
    profileXp: welcome.accountXp + 50 + 25 + 50 + 50,
  };
  const sevenDay = {
    assumptions: "first-session included; then 2 verified matches/day (8W/2D/4L total), both daily bounties each day, all three 100-Clout weekly mastery missions, weekly five-match ticket claim",
    matches: 14,
    clout: welcome.softCurrency + rules.matchClout.win * 8 + rules.matchClout.draw * 2 +
      rules.matchClout.loss * 4 + 7 * missions.dailyClout + missions.weeklyClout,
    tickets: welcome.packTickets + missions.rookieTickets + missions.weeklyTickets + 1,
  };
  const repeat = {
    assumptions: "100 verified matches at 50W/10D/40L; no missions, story, packs, or one-time grants",
    matches: 100,
    clout: rules.matchClout.win * 50 + rules.matchClout.draw * 10 + rules.matchClout.loss * 40,
  };
  const expectedMatchClout = 0.5 * rules.matchClout.win + 0.1 * rules.matchClout.draw + 0.4 * rules.matchClout.loss;
  const expectedCardXp = 0.5 * 30 + 0.1 * 25 + 0.4 * 20;
  return {
    firstSession,
    sevenDay,
    repeat,
    expectedRepeatCloutPerMatch: expectedMatchClout,
    matchesPer200CloutPack: Number((200 / expectedMatchClout).toFixed(2)),
    winsPerCoachingTier: rules.coaching.map((cost) => Number((cost / rules.matchClout.win).toFixed(2))),
    coachingTotal: rules.coaching.reduce((sum, cost) => sum + cost, 0),
    cardXpPacing: {
      cap: CARD_XP_CAP,
      participatingWinsToMax: Number((CARD_XP_CAP / 30).toFixed(2)),
      participatingMixedMatchesToMax: Number((CARD_XP_CAP / expectedCardXp).toFixed(2)),
      mixedMatchesToLevels: Object.fromEntries([
        [2, 100], [5, 1000], [8, 2800], [10, CARD_XP_CAP],
      ].map(([level, xp]) => [level, Number((xp / expectedCardXp).toFixed(2))])),
      intensiveTrainingPurchasesToMax: Math.ceil(CARD_XP_CAP / 250),
      intensiveTrainingCloutToMax: Math.ceil(CARD_XP_CAP / 250) * 225,
    },
  };
}

const COLLECTION_ROAD_FIXTURE = [
  { id: "first-seven", threshold: 7, cardId: "closet-nerd" },
  { id: "nine-deep", threshold: 9, cardId: "live-streamer", shards: 50 },
  { id: "twelve-deep", threshold: 12, cardId: "techbro-rich", clout: 150 },
  { id: "full-roster", threshold: cardCatalog.length, clout: 300 },
] as const;

function claimCollectionRoad(
  version: EconomyVersion,
  wallet: Wallet,
  claimed = new Set<string>(),
) {
  const newRarities: CardRarity[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const milestone of COLLECTION_ROAD_FIXTURE) {
      if (claimed.has(milestone.id) || wallet.owned.size < milestone.threshold) continue;
      claimed.add(milestone.id);
      changed = true;
      if ("cardId" in milestone && milestone.cardId) {
        const card = cardCatalog.find((entry) => entry.catalogId === milestone.cardId);
        if (!card) throw new Error(`Collection Road card is missing: ${milestone.cardId}`);
        if (wallet.owned.has(card.catalogId)) wallet.shards += RULES[version].duplicateShards;
        else {
          wallet.owned.add(card.catalogId);
          newRarities.push(card.rarity);
        }
      }
      if ("shards" in milestone) wallet.shards += milestone.shards;
      if ("clout" in milestone) wallet.clout += milestone.clout;
    }
  }
  return { claimed, newRarities };
}

function simulateTicketJourney(
  version: EconomyVersion,
  startingOwned: readonly string[],
  earnedClout: number,
  earnedTickets: number,
  iterations: number,
  seed: number,
) {
  const random = seededRandom(seed);
  let finalCards = 0, newCards = 0, newRarePlus = 0, newLegendaryPlus = 0;
  let newMythical = 0, shards = 0, finalClout = 0, roadClaims = 0, sessionsWithRarePlus = 0;
  for (let index = 0; index < iterations; index += 1) {
    const wallet = makeWallet(startingOwned);
    wallet.clout = earnedClout;
    wallet.tickets = earnedTickets;
    const road = claimCollectionRoad(version, wallet);
    roadClaims += road.claimed.size;
    const acquired = [...road.newRarities];
    while (wallet.tickets >= 10) {
      const results = openTenPull(version, wallet, random);
      wallet.tickets -= 10;
      acquired.push(...results.flatMap((result) => result.newRarities));
    }
    while (wallet.tickets > 0) {
      const result = openPack(version, wallet, random);
      wallet.tickets -= 1;
      acquired.push(...result.newRarities);
    }
    const claimsBeforePacks = road.claimed.size;
    const afterPacksRoad = claimCollectionRoad(version, wallet, road.claimed);
    roadClaims += afterPacksRoad.claimed.size - claimsBeforePacks;
    acquired.push(...afterPacksRoad.newRarities);
    const rareCount = acquired.filter((rarity) => RARE_PLUS.includes(rarity)).length;
    finalCards += wallet.owned.size;
    newCards += wallet.owned.size - startingOwned.length;
    newRarePlus += rareCount;
    newLegendaryPlus += acquired.filter((rarity) => rarity === "Legendary" || rarity === "Mythical").length;
    newMythical += acquired.filter((rarity) => rarity === "Mythical").length;
    shards += wallet.shards;
    finalClout += wallet.clout;
    if (rareCount > 0) sessionsWithRarePlus += 1;
  }
  const average = (value: number) => Number((value / iterations).toFixed(3));
  return {
    iterations,
    earnedTickets,
    ticketsSpent: earnedTickets,
    averageRoadClaims: average(roadClaims),
    averageFinalCollection: average(finalCards),
    averageNewCards: average(newCards),
    averageNewRarePlus: average(newRarePlus),
    averageNewLegendaryPlus: average(newLegendaryPlus),
    averageNewMythical: average(newMythical),
    sessionsWithNewRarePlusPercent: percent(sessionsWithRarePlus, iterations),
    averageFinalShards: average(shards),
    averageFinalCloutAfterRoadAndPackBonuses: average(finalClout),
  };
}

export function buildAudit(iterations = ITERATIONS, seed = AUDIT_SEED) {
  const nearCompleteTarget = cardCatalog.find((card) => card.rarity === "Mythical")!;
  const almostComplete = cardCatalog
    .filter((card) => card.catalogId !== nearCompleteTarget.catalogId)
    .map((card) => card.catalogId);
  const complete = cardCatalog.map((card) => card.catalogId);
  const midCollection = RARITIES.flatMap((rarity) =>
    cardCatalog.filter((card) => card.rarity === rarity)
      .filter((_, index) => index % 2 === 0)
      .map((card) => card.catalogId),
  );
  const v1Journey = journey("v1");
  const v2Journey = journey("v2");
  const v1Story = baselineStoryLedger();
  const v2Story = currentStoryLedger();
  return {
    generatedAt: "deterministic-no-clock",
    seed,
    iterations,
    catalog: {
      cards: cardCatalog.length,
      nearCompleteMissing: {
        cardId: nearCompleteTarget.catalogId,
        rarity: nearCompleteTarget.rarity,
      },
      rarityCounts: Object.fromEntries(RARITIES.map((rarity) => [
        rarity, cardCatalog.filter((card) => card.rarity === rarity).length,
      ])),
      starterV1: V1_BASELINE.starterCardIds.length,
      starterV2: ROOKIE_MENTOR_CORE_IDS.length,
      midCollectionCards: midCollection.length,
    },
    historicalBaseline: V1_BASELINE,
    rules: RULES,
    story: { v1: v1Story, v2: v2Story },
    journeys: {
      v1: {
        ...v1Journey,
        ticketSpending: {
          firstSession: simulateTicketJourney(
            "v1", V1_BASELINE.starterCardIds,
            v1Journey.firstSession.clout, v1Journey.firstSession.tickets, iterations, seed + 20,
          ),
          sevenDay: simulateTicketJourney(
            "v1", V1_BASELINE.starterCardIds,
            v1Journey.sevenDay.clout, v1Journey.sevenDay.tickets, iterations, seed + 21,
          ),
          allStory: simulateTicketJourney(
            "v1", V1_BASELINE.starterCardIds, v1Story.clout,
            v1Story.totalTicketsWithAllPerfectClears, Math.min(iterations, 2_000), seed + 22,
          ),
        },
      },
      v2: {
        ...v2Journey,
        ticketSpending: {
          firstSession: simulateTicketJourney(
            "v2", ROOKIE_MENTOR_CORE_IDS,
            v2Journey.firstSession.clout, v2Journey.firstSession.tickets, iterations, seed + 30,
          ),
          sevenDay: simulateTicketJourney(
            "v2", ROOKIE_MENTOR_CORE_IDS,
            v2Journey.sevenDay.clout, v2Journey.sevenDay.tickets, iterations, seed + 31,
          ),
          allStory: simulateTicketJourney(
            "v2", ROOKIE_MENTOR_CORE_IDS, v2Story.clout,
            v2Story.totalTicketsWithAllPerfectClears, Math.min(iterations, 2_000), seed + 32,
          ),
        },
      },
    },
    packs: {
      v1: {
        starter: simulatePacks("v1", V1_BASELINE.starterCardIds, iterations, seed + 1),
        midCollection: simulatePacks("v1", midCollection, iterations, seed + 9),
        nearComplete: simulatePacks("v1", almostComplete, iterations, seed + 2),
        complete: simulatePacks("v1", complete, iterations, seed + 3),
        forcedRarePlus: simulateGuarantees("v1", iterations, seed + 4),
      },
      v2: {
        starter: simulatePacks("v2", ROOKIE_MENTOR_CORE_IDS, iterations, seed + 5),
        midCollection: simulatePacks("v2", midCollection, iterations, seed + 10),
        nearComplete: simulatePacks("v2", almostComplete, iterations, seed + 6),
        complete: simulatePacks("v2", complete, iterations, seed + 7),
        forcedRarePlus: simulateGuarantees("v2", iterations, seed + 8),
      },
    },
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const iterationsArg = process.argv.find((argument) => argument.startsWith("--iterations="));
  const iterations = iterationsArg ? Number(iterationsArg.split("=")[1]) : ITERATIONS;
  if (!Number.isInteger(iterations) || iterations < 1) throw new Error("--iterations must be a positive integer");
  process.stdout.write(`${JSON.stringify(buildAudit(iterations), null, 2)}\n`);
}