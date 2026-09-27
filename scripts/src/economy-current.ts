/**
 * Read-only current economy experiment. Uses the production pure pack generator;
 * never imports transactions, database clients, payment clients or environment.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { cardCatalog, ROOKIE_FOUNDATION_IDS, catalogCardById, catalogCardByEngineId } from "@workspace/squabblemon-engine/data";
import { battleEarnings, WELCOME_REWARD, MISSION_TEMPLATES, MOVE_TRAINING_COSTS, SHOP_OFFERS, STORY_DUPLICATE_STYLE_SHARDS } from "@workspace/squabblemon-engine/economy";
import { storyContent } from "@workspace/squabblemon-engine/story";
import { STARTER_MYTHIC } from "@workspace/squabblemon-engine/starterMythic";
import { LOGIN_REWARDS, NEW_PLAYER_BONUS, FIRST_LOGIN_BONUS, LEVEL_MILESTONE_REWARD, GROWTH_GARDEN_REWARD, GROWTH_GARDEN_SIZE } from "@workspace/squabblemon-engine/accountRewards";
import { totalXpForCardLevel, CARD_XP_CAP } from "@workspace/squabblemon-engine/cardProgression";
import { PACK_RARITIES, STREET_PACK_RULES as RULES, STREET_PACK_RARITY_WEIGHTS as WEIGHTS, RARE_PLUS_GUARANTEE_WEIGHTS } from "@workspace/squabblemon-engine/packRules";
import { STYLE_SHARD_RARITIES as TIERS, normalizeStyleShardBalances, addStyleShardBalances } from "@workspace/squabblemon-engine/styleShards";

// URL import keeps scripts' rootDir boundary; this module contains only pure rules.
const runtimeUrl = new URL("../../artifacts/api-server/src/lib/collectionEconomy.ts", import.meta.url);
type PackState = { ownedCardIds: string[]; discoveredCardIds: string[]; ownedVariants: string[]; pity: number };
type Pack = Omit<PackState, "pity"> & {
  pityAfter: number; styleShardsGained: number; styleShardBalancesGained: Partial<Record<typeof TIERS[number], number>>; softCurrencyGained: number;
  rewards: { kind: string; cardId: string | null; rarity: string | null; amount: number }[];
};
// Structural boundary is checked with runtime receipt invariants in the focused suite.
const runtime: {
  generateStreetPack: (state: PackState, random: (max: number) => number) => Pack;
  generateStreetTenPull: (state: PackState, random: (max: number) => number) => Pack;
  COLLECTION_ROAD: { id: string; threshold: number; reward: { cardId?: string; softCurrency?: number; styleShards?: number } }[];
} = await import(runtimeUrl.href);
export const SEED = 0x185c0ffe;
export function rng(seed: number) {
  let state = seed >>> 0;
  return (max: number) => {
    state += 0x6d2b79f5;
    let x = state;
    x = Math.imul(x ^ x >>> 15, x | 1);
    x ^= x + Math.imul(x ^ x >>> 7, x | 61);
    return Math.floor(((x ^ x >>> 14) >>> 0) / 4294967296 * max);
  };
}
const ids = cardCatalog.map(c => c.catalogId);
const variants = cardCatalog.flatMap(c => c.variantSlots.map(v => v.id));
export const COHORTS = {
  new: [...ROOKIE_FOUNDATION_IDS],
  mid: PACK_RARITIES.flatMap(r => cardCatalog.filter(c => c.rarity === r).filter((_, i) => i % 2 === 0).map(c => c.catalogId)),
  near: ids.filter(id => id !== cardCatalog.find(c => c.rarity === "Mythical")!.catalogId),
  complete: ids,
};
export const stats = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const q = (p: number) => sorted[Math.floor((sorted.length - 1) * p)];
  return { mean: values.reduce((a, b) => a + b, 0) / values.length, p05: q(.05), p50: q(.5), p95: q(.95) };
};
const stateFor = (owned: readonly string[], exhausted = false, pity = 0) => ({
  ownedCardIds: [...owned], discoveredCardIds: [...owned], ownedVariants: exhausted ? [...variants] : [], pity,
});
const nextState = (pack: Awaited<ReturnType<typeof runtime.generateStreetPack>>) => ({
  ownedCardIds: pack.ownedCardIds, discoveredCardIds: pack.discoveredCardIds, ownedVariants: pack.ownedVariants, pity: pack.pityAfter,
});
const rare = new Set(["Rare", "Epic", "Legendary", "Mythical"]);

export function packExperiment(iterations: number, seed: number) {
  const random = rng(seed);
  return Object.fromEntries(Object.entries(COHORTS).map(([cohort, owned]) => {
    const run = (ten: boolean) => {
      const rows = Array.from({ length: iterations }, () => {
        const pack = (ten ? runtime.generateStreetTenPull : runtime.generateStreetPack)(stateFor(owned), random);
        const gameplay = pack.rewards.filter(r => r.cardId && (r.kind === "card" || r.kind === "styleShards"));
        return { pack, gameplay };
      });
      return {
        newCards: stats(rows.map(r => r.pack.ownedCardIds.length - owned.length)),
        universal: stats(rows.map(r => r.pack.styleShardsGained)),
        matching: Object.fromEntries(TIERS.map(t => [t, stats(rows.map(r => r.pack.styleShardBalancesGained[t] ?? 0))])),
        clout: stats(rows.map(r => r.pack.softCurrencyGained)),
        rarePlusHaulProbability: rows.filter(r => r.gameplay.some(g => rare.has(g.rarity!))).length / iterations,
        byTier: Object.fromEntries(PACK_RARITIES.map(t => [t, {
          effectiveSlotProbability: rows.reduce((n, r) => n + r.gameplay.filter(g => g.rarity === t).length, 0) / (iterations * (ten ? 50 : 5)),
          haulProbability: rows.filter(r => r.gameplay.some(g => g.rarity === t)).length / iterations,
          newPerHaul: rows.reduce((n, r) => n + r.gameplay.filter(g => g.rarity === t && g.kind === "card").length, 0) / iterations,
        }])),
        protectedSlotNewProbability: rows.reduce((n, r) => n + r.pack.rewards.filter((g, i) => i % 6 < 2 && g.kind === "card").length, 0) / (iterations * (ten ? 20 : 2)),
      };
    };
    return [cohort, { single: run(false), ten: run(true) }];
  }));
}

export function analyticalOdds() {
  const rareProbability = PACK_RARITIES.filter(r => rare.has(r)).reduce((s, r) => s + WEIGHTS[r] / 100, 0);
  return {
    byTier: Object.fromEntries(PACK_RARITIES.map(t => {
      const p = WEIGHTS[t] / 100;
      const count = cardCatalog.filter(c => c.rarity === t).length;
      // Complete collection: symmetry + within-pack non-repeat (all tiers >=5).
      const specificOwnedCardPerPack = 5 * p / count;
      const onlyMissingCardPerPack = 1 - (1 - p) ** 2 * (1 - 3 * p / count);
      const tail = (chance: number) => Object.fromEntries([.5, .9, .95, .99].map(q => [String(q), Math.ceil(Math.log(1 - q) / Math.log(1 - chance))]));
      return [t, { count, baseSlotProbability: p, basePackProbability: 1 - (1 - p) ** 5,
        naturalTenProbability: 1 - (1 - p) ** 50,
        effectiveTenProbability: 1 - (1 - p) ** 50 + (rare.has(t) ? (1 - rareProbability) ** 50 * (RARE_PLUS_GUARANTEE_WEIGHTS[t as keyof typeof RARE_PLUS_GUARANTEE_WEIGHTS] / 100) : -p * (1 - rareProbability - p) ** 49),
        specificOwnedCardPerPack, specificOwnedCardRepeatPackTails: tail(specificOwnedCardPerPack),
        onlyMissingCardPerPack, onlyMissingCardAcquisitionPackTails: tail(onlyMissingCardPerPack) }];
    })),
    naturalRarePlusSingle: 1 - (1 - rareProbability) ** 5,
    naturalRarePlusTen: 1 - (1 - rareProbability) ** 50,
    tenFallbackProbability: (1 - rareProbability) ** 50,
    guaranteedRarePlusTen: 1,
    pity: { nominalStyleProbability: .05, maximumWaitWhileEligible: RULES.pityLimit,
      expectedRenewalWait: (1 - .95 ** RULES.pityLimit) / .05,
      longRunStyleProbabilityBeforeExhaustion: .05 / (1 - .95 ** RULES.pityLimit), finiteStylePool: variants.length },
  };
}

export function styleLifetime(iterations: number, seed: number) {
  const random = rng(seed);
  const waits: number[] = [];
  for (let trial = 0; trial < iterations; trial++) {
    let packs = 0;
    for (let style = 0; style < variants.length; style++) {
      let wait = 1;
      while (wait < RULES.pityLimit && random(10000) < 9500) wait++;
      packs += wait;
    }
    waits.push(packs);
  }
  // Exact state propagation for ten sequential eligible bonuses, starting pity zero.
  let states: number[] = Array.from({ length: RULES.pityLimit }, (_, i) => i === 0 ? 1 : 0);
  let styles = 0, universal = 0, clout = 0;
  for (let pack = 0; pack < 10; pack++) {
    const forced = states.at(-1)!;
    styles += forced + (1 - forced) * .05;
    universal += (1 - forced) * .3 * 10;
    clout += (1 - forced) * .65 * 37.5;
    const next = Array.from({ length: RULES.pityLimit }, () => 0);
    next[0] = forced + (1 - forced) * .05;
    for (let i = 0; i < states.length - 1; i++) next[i + 1] = states[i] * .95;
    states = next;
  }
  const renewal = (1 - .95 ** RULES.pityLimit) / .05;
  const styleRate = 1 / renewal;
  const ordinary = (1 - styleRate) / .95;
  return {
    assumptions: "No direct crafting; start with zero styles and pity; each bonus grants one unowned style. Renewal-only RNG, no gameplay simulation needed.",
    pool: variants.length, exhaustionPacks: stats(waits), exactExpectedExhaustionPacks: variants.length * renewal,
    nominalAndFirstPack: { styleProbability: .05, universalProbability: .3, cloutProbability: .65, universalEV: 3, cloutEV: 24.375 },
    tenFromZero: { expectedStyles: styles, universalEV: universal, cloutEV: clout, atLeastOneStyleProbability: 1 },
    steadyStateBeforeExhaustion: { styleProbability: styleRate, universalProbability: ordinary * .3, cloutProbability: ordinary * .65, universalEV: ordinary * 3, cloutEV: ordinary * 24.375 },
    afterExhaustion: { styleProbability: 0, universalProbability: .3, cloutProbability: .7, universalEV: 3, cloutEV: 24.375 + .05 * 25 },
  };
}

export function campaignBoundary() {
  const nodes = storyContent.chapters.flatMap(c => c.nodes);
  const keys = new Set<string>();
  const rewards = nodes.flatMap(node => node.rewards.filter((r, index) => {
    const key = r.claimKey ?? `${node.id}:${index}:${r.kind}:${r.id}`;
    if (keys.has(key)) return false;
    keys.add(key); return true;
  }));
  const accountXp = rewards.filter(r => r.kind === "currency" && r.id === "street-xp").reduce((s, r) => s + r.amount, 0);
  const tickets = rewards.filter(r => r.kind === "pack-ticket").reduce((s, r) => s + r.amount, 0);
  const clout = rewards.filter(r => r.kind === "currency" && r.id === "clout").reduce((s, r) => s + r.amount, 0);
  const perfect = nodes.filter(n => n.kind === "battle").length;
  const milestones = Math.floor((1 + Math.floor(accountXp / 250)) / 10);
  return {
    assumptions: "All authored stable claims and every first-perfect claimed once; no pack spending, match income, login, welcome, Collection Road or prior profile XP. Starter Mythic separately claimed when Chapter 5 becomes reachable.",
    chapters: storyContent.chapters.length, nodes: nodes.length, battles: perfect, accountXp, authoredClout: clout,
    authoredTickets: tickets, perfectTickets: perfect, authoredAndPerfectTickets: tickets + perfect,
    authoredXpOnlyMilestones: { count: milestones, clout: milestones * LEVEL_MILESTONE_REWARD.softCurrency, tickets: milestones * LEVEL_MILESTONE_REWARD.packTickets, universal: milestones * LEVEL_MILESTONE_REWARD.styleShards },
    starterMythic: STARTER_MYTHIC,
    byStartingCollection: Object.fromEntries(Object.entries(COHORTS).map(([cohort, initial]) => {
      const owned = new Set(initial);
      let universal = 0, newCards = 0;
      for (const reward of rewards.filter(r => r.kind === "card")) {
        const card = catalogCardById[reward.id] ?? catalogCardByEngineId[reward.id];
        if (!card) throw Error(`Unknown story card ${reward.id}`);
        if (owned.has(card.catalogId)) universal += STORY_DUPLICATE_STYLE_SHARDS;
        else { owned.add(card.catalogId); newCards++; }
      }
      if (owned.has(STARTER_MYTHIC.cardId)) universal += STARTER_MYTHIC.duplicateShards;
      else { owned.add(STARTER_MYTHIC.cardId); newCards++; }
      return [cohort, { newCards, ownedCardsAfterFiniteClaims: [...owned], storyAndStarterDuplicateUniversal: universal,
        cloutIncludingStarterAndMilestones: clout + STARTER_MYTHIC.softCurrency + milestones * LEVEL_MILESTONE_REWARD.softCurrency,
        ticketsIncludingPerfectStarterAndMilestones: tickets + perfect + STARTER_MYTHIC.packTickets + milestones * LEVEL_MILESTONE_REWARD.packTickets }];
    })),
  };
}

const mission = (key: string) => {
  const found = MISSION_TEMPLATES.find(m => m.missionKey === key);
  if (!found) throw Error(`Missing mission: ${key}`);
  return found.rewardAmount;
};
export function journey(days: number, engaged: boolean, cohort: keyof typeof COHORTS, priority: "save" | "packs" | "training", online: boolean, seed: number, captureState?: (state: PackState) => void) {
  const random = rng(seed);
  let state = stateFor(COHORTS[cohort]);
  let clout = 0, tickets = 0, universal = 0, profileXp = 0, cardXp = 0, matches = 0, sessions = 0, streak = 0, plants = 0, opened = 0, trainingSpent = 0, moveTier = 0;
  let matching = normalizeStyleShardBalances({});
  const claims = new Set<string>();
  // Take the fixed welcome opening before any random opening; it does not consume a ticket.
  if (cohort === "new") {
    if (state.ownedCardIds.includes("dr-fade")) universal += RULES.duplicateStyleShards;
    else state.ownedCardIds.push("dr-fade");
  }
  const grant = (r: { softCurrency: number; packTickets: number; styleShards?: number }) => {
    clout += r.softCurrency; tickets += r.packTickets; universal += r.styleShards ?? 0;
  };
  const road = () => {
    // Mature cohorts assume road/onboarding already claimed; initial wallet is zero.
    if (cohort !== "new") return;
    for (const reward of runtime.COLLECTION_ROAD) {
      if (claims.has(reward.id) || state.ownedCardIds.length < reward.threshold) continue;
      claims.add(reward.id);
      if (reward.reward.cardId) {
        if (state.ownedCardIds.includes(reward.reward.cardId)) universal += RULES.duplicateStyleShards;
        else state.ownedCardIds.push(reward.reward.cardId);
      }
      clout += reward.reward.softCurrency ?? 0; universal += reward.reward.styleShards ?? 0;
    }
  };
  const pack = (ten: boolean) => {
    const result = (ten ? runtime.generateStreetTenPull : runtime.generateStreetPack)(state, random);
    state = nextState(result); clout += result.softCurrencyGained; universal += result.styleShardsGained;
    matching = addStyleShardBalances(matching, result.styleShardBalancesGained);
    opened += ten ? 10 : 1; road();
  };
  let weeklyMatches = 0, weeklyActive = 0, movementClaimed = false;
  for (let day = 0; day < days; day++) {
    if (day % 7 === 0) { weeklyMatches = 0; weeklyActive = 0; movementClaimed = false; }
    // Monday start; casual misses Wednesday and Saturday, breaking the login streak.
    if (!engaged && [2, 5].includes(day % 7)) { streak = 0; continue; }
    sessions++; streak++; weeklyActive++;
    grant(LOGIN_REWARDS[(streak - 1) % 7]); clout += 50; // dailyClout.ts source-checked below
    if (cohort === "new" && day === 0) { grant(NEW_PLAYER_BONUS); grant(FIRST_LOGIN_BONUS); }
    let wins = 0;
    const dailyMatches = days === 1 ? 3 : engaged ? 6 : 2;
    for (let match = 0; match < dailyMatches; match++) {
      matches++;
      if (online) continue; // supplied as a zero-progression settlement scenario, not all online modes
      const roll = random(100);
      const outcome = roll < 50 ? "win" : roll < 60 ? "draw" : "loss";
      const earnings = battleEarnings(outcome);
      clout += earnings.softCurrency; profileXp += earnings.xp;
      if (outcome === "win") wins++;
      // One tracked owned character actually played in 60%/80% of verified matches.
      if (random(100) < (engaged ? 80 : 60)) cardXp = Math.min(CARD_XP_CAP, cardXp + (outcome === "win" ? 30 : outcome === "draw" ? 25 : 20));
    }
    if (!online) {
      if (cohort === "new" && day === 0) {
        grant(WELCOME_REWARD); profileXp += WELCOME_REWARD.accountXp; tickets += mission("rookie-road");
      }
      clout += mission("daily-show-up");
      if (wins) {
        clout += mission("daily-take-room"); plants++;
        if (plants % GROWTH_GARDEN_SIZE === 0) grant(GROWTH_GARDEN_REWARD);
      }
      const previousMatches = weeklyMatches;
      weeklyMatches += dailyMatches;
      if (previousMatches < 5 && weeklyMatches >= 5) tickets += mission("weekly-main-character");
      // Engaged deliberately qualifies one distinct mastery mission on each first 3 active days.
      if (engaged && weeklyActive === 1) clout += mission("weekly-cleanse");
      if (engaged && weeklyActive === 3) clout += mission("weekly-experiment");
      if (engaged && weeklyActive >= 2 && wins && !movementClaimed) {
        clout += mission("weekly-movement"); movementClaimed = true;
      }
      for (let level = 10; level <= 1 + Math.floor(profileXp / 250); level += 10) {
        if (!claims.has(`level:${level}`)) { claims.add(`level:${level}`); grant(LEVEL_MILESTONE_REWARD); }
      }
    }
    road();
    while (tickets >= 10) { tickets -= 10; pack(true); }
    while (tickets > 0) { tickets--; pack(false); }
    if (priority === "training") {
      while (cardXp < CARD_XP_CAP) {
        const gain = Math.min(250, CARD_XP_CAP - cardXp);
        const cost = Math.ceil(225 * gain / 250);
        if (clout < cost) break;
        clout -= cost; trainingSpent += cost; cardXp += gain;
      }
      while (moveTier < 3 && cardXp >= totalXpForCardLevel([2, 5, 8][moveTier]) && clout >= MOVE_TRAINING_COSTS[moveTier]) {
        clout -= MOVE_TRAINING_COSTS[moveTier]; trainingSpent += MOVE_TRAINING_COSTS[moveTier]; moveTier++;
      }
    }
    if (priority === "packs") {
      while (clout >= RULES.ten.softCurrencyCost) { clout -= RULES.ten.softCurrencyCost; pack(true); }
      while (clout >= RULES.single.softCurrencyCost) { clout -= RULES.single.softCurrencyCost; pack(false); }
    }
  }
  captureState?.(state);
  return { clout, tickets, universal, matching, profileXp, cardXp, matches, sessions, plants, opened, trainingSpent, moveTier, ownedCards: state.ownedCardIds.length,
    strandedForMythical: TIERS.filter(t => t !== "Mythical").reduce((s, t) => s + matching[t], 0) };
}

const promoUrl = new URL("../../artifacts/api-server/src/lib/promoCodes.ts", import.meta.url);
const promoModule: { findPromoCode: (code: string, environment: string) => { code: string; softCurrency: number; packTickets: number; styleShards: number; cardIds?: string[] } | null } = await import(promoUrl.href);
export function supplementalScenarios(iterations: number, seed: number) {
  // Parse just literal approved offer data; do not import payment service/config or inspect env.
  const source = readFileSync("artifacts/api-server/src/lib/payments/config.ts", "utf8");
  const offers = [...source.matchAll(/\{ id: '(clout-[^']+)', name: '[^']+', clout: (\d+), amountMinor: (\d+), currency: '([^']+)', env: '[^']+' \}/g)]
    .map(([, id, clout, amount, currency]) => ({ id, clout: Number(clout), amountMinor: Number(amount), currency }));
  if (JSON.stringify(offers.map(o => [o.clout, o.amountMinor, o.currency])) !== JSON.stringify([[500, 299, "usd"], [1500, 799, "usd"], [4000, 1999, "usd"]])) {
    throw Error("Payment offer source changed; review supplemental scenario quotes");
  }
  const promos = ["KYLE", "CITYLEGENDS"].map(code => {
    const promo = promoModule.findPromoCode(code, "production");
    if (!promo) throw Error(`Expected production promo unavailable: ${code}`);
    return promo;
  });
  const summarize = (rows: { clout: number; universal: number; matching: ReturnType<typeof normalizeStyleShardBalances>; newCards: number; rebate: number; owned: number }[]) => ({
    clout: stats(rows.map(r => r.clout)), universal: stats(rows.map(r => r.universal)),
    matching: Object.fromEntries(TIERS.map(t => [t, stats(rows.map(r => r.matching[t]))])),
    newCards: stats(rows.map(r => r.newCards)), rebate: stats(rows.map(r => r.rebate)), owned: stats(rows.map(r => r.owned)),
  });
  const organic = Array.from({ length: iterations }, (_, i) => {
    let state = stateFor(COHORTS.new);
    const wallet = journey(1, false, "new", "save", false, seed + i, value => { state = value; });
    return { state, wallet };
  });
  const promoCards = [...new Set(promos.flatMap(p => p.cardIds ?? []))];
  const promoClout = promos.reduce((s, p) => s + p.softCurrency, 0);
  const promoTickets = promos.reduce((s, p) => s + p.packTickets, 0);
  const promoUniversal = promos.reduce((s, p) => s + p.styleShards, 0);
  const boundary = campaignBoundary();
  return {
    assumptions: "Counterfactual overlays only, no purchase or redemption executed. Paid and promotional data remain separate from organic journeys. First-session overlays retain new/casual/save wallet and leave added Clout/tickets unspent.",
    trials: iterations,
    purchased: offers.map(offer => ({ offer, cloutAdded: offer.clout,
      finalClout: stats(organic.map(r => r.wallet.clout + offer.clout)),
      organicClout: stats(organic.map(r => r.wallet.clout)),
      taxTreatment: "USD base price only; no tax/checkout/provider inference",
      extraFullPriceSinglePacksWithoutRebate: Math.floor(offer.clout / RULES.single.softCurrencyCost),
      extraFullPriceTenPullsWithoutRebate: Math.floor(offer.clout / RULES.ten.softCurrencyCost) })),
    promotional: {
      grants: promos, cloutAdded: promoClout, ticketsAdded: promoTickets, universalAdded: promoUniversal, cardIds: promoCards,
      finalClout: stats(organic.map(r => r.wallet.clout + promoClout)),
      finalTickets: stats(organic.map(r => r.wallet.tickets + promoTickets)),
      finalUniversal: stats(organic.map(r => r.wallet.universal + promoUniversal)),
      newPromoCards: stats(organic.map(r => promoCards.filter(id => !r.state.ownedCardIds.includes(id)).length)),
      finalOwned: stats(organic.map(r => new Set([...r.state.ownedCardIds, ...promoCards]).size)),
      duplicatePolicy: "Ownership union, no duplicate-card shard award in promoCodeTransactions.ts",
    },
    finiteCampaignTicketSpending: Object.fromEntries(Object.entries(boundary.byStartingCollection).map(([cohort, finite]) => {
      const rows = Array.from({ length: iterations }, (_, trial) => {
        const random = rng(seed + trial);
        let state = stateFor(finite.ownedCardsAfterFiniteClaims);
        let matching = normalizeStyleShardBalances({});
        let universal = finite.storyAndStarterDuplicateUniversal + boundary.authoredXpOnlyMilestones.universal;
        let rebate = 0, tickets = finite.ticketsIncludingPerfectStarterAndMilestones;
        while (tickets > 0) {
          const ten = tickets >= 10;
          const result = (ten ? runtime.generateStreetTenPull : runtime.generateStreetPack)(state, random);
          tickets -= ten ? 10 : 1; state = nextState(result);
          universal += result.styleShardsGained; rebate += result.softCurrencyGained;
          matching = addStyleShardBalances(matching, result.styleShardBalancesGained);
        }
        return { clout: finite.cloutIncludingStarterAndMilestones + rebate, universal, matching, rebate,
          newCards: state.ownedCardIds.length - finite.ownedCardsAfterFiniteClaims.length, owned: state.ownedCardIds.length };
      });
      return [cohort, { ticketsSpent: finite.ticketsIncludingPerfectStarterAndMilestones,
        order: "All finite rewards first; then 22 ten-pulls and seven singles. No Collection Road/Clout spending or between-node pack openings.",
        finiteNewCards: finite.newCards, finiteDuplicateUniversal: finite.storyAndStarterDuplicateUniversal,
        finiteMilestoneUniversal: boundary.authoredXpOnlyMilestones.universal,
        metrics: summarize(rows) }];
    })),
  };
}

export function finishTargets(iterations: number, seed: number) {
  return Object.fromEntries(TIERS.map((tier, index) => [tier, [80, 140].map(cost => {
    const waits: number[] = [], stranded: number[] = [];
    for (let trial = 0; trial < iterations; trial++) {
      const random = rng(seed + index * 100000 + trial);
      let state = stateFor(ids), universal = 0, matching = normalizeStyleShardBalances({}), packs = 0;
      while (universal + matching[tier] < cost) {
        const result = runtime.generateStreetPack(state, random);
        state = nextState(result); universal += result.styleShardsGained; matching = addStyleShardBalances(matching, result.styleShardBalancesGained); packs++;
        if (packs > 10000) throw Error("Finish target exceeded bounded experiment");
      }
      waits.push(packs); stranded.push(TIERS.filter(t => t !== tier).reduce((s, t) => s + matching[t], 0));
    }
    return { cost, packs: stats(waits), otherTierShardsUnavailableForTarget: stats(stranded),
      repeatOnlyMatchesIgnoringRebates: stats(waits.map(n => Math.ceil(n * 200 / 62))),
      twoMatchSessionsIgnoringRebates: stats(waits.map(n => Math.ceil(n * 200 / 62 / 2))) };
  })]));
}

export function buildCurrentAudit(iterations = 1000, seed = SEED, journeyIterations = 100) {
  if (!Number.isSafeInteger(iterations) || iterations < 1) throw Error("iterations must be a positive integer");
  const dailySource = readFileSync("artifacts/api-server/src/lib/dailyClout.ts", "utf8");
  if (!dailySource.includes("softCurrency: 50")) throw Error("Daily shop grant changed; review journey assumptions");
  const paths = ["scripts/src/economy-current.ts", "artifacts/api-server/src/lib/collectionEconomy.ts",
    "artifacts/api-server/src/lib/dailyClout.ts", "artifacts/api-server/src/lib/welcomePull.ts",
    "artifacts/api-server/src/lib/promoCodes.ts", "artifacts/api-server/src/lib/promoCodeTransactions.ts", "artifacts/api-server/src/lib/payments/config.ts",
    ...["data", "packRules", "styleShards", "economy", "accountRewards", "cardProgression", "reactions", "story", "starterMythic"].map(n => `lib/squabblemon-engine/src/${n}.ts`)];
  const journeys = [];
  for (const days of [1, 7, 30]) for (const engaged of [false, true]) for (const cohort of Object.keys(COHORTS) as Array<keyof typeof COHORTS>) for (const priority of ["save", "packs", "training"] as const) for (const online of [false, true]) {
    const trials = Array.from({ length: Math.min(iterations, journeyIterations) }, (_, i) => journey(days, engaged, cohort, priority, online, seed + i));
    const first = trials[0];
    journeys.push({ days, cadence: engaged ? "engaged" : "casual", cohort, priority, settlement: online ? "zero-progression-online" : "verified-reward", trials: trials.length,
      metrics: Object.fromEntries(Object.keys(first).filter(k => k !== "matching").map(k => [k, stats(trials.map(t => t[k as keyof typeof first] as number))])),
      matching: Object.fromEntries(TIERS.map(t => [t, stats(trials.map(row => row.matching[t]))])) });
  }
  return {
    modelVersion: "economy-current-v1", seed, iterations,
    sourceRevision: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    sha256: Object.fromEntries(paths.map(p => [p, createHash("sha256").update(readFileSync(p)).digest("hex")])),
    analytical: analyticalOdds(), styleLifetime: styleLifetime(iterations, seed), campaignBoundary: campaignBoundary(),
    supplemental: supplementalScenarios(Math.min(iterations, journeyIterations), seed),
    packs: packExperiment(iterations, seed), journeys,
    finishTargetsCompleteCollection: finishTargets(Math.min(iterations, 500), seed),
    repeatOnlyPacing: {
      mixedMatchClout: 62, mixedParticipatingCardXp: 25.5,
      cloutTargets: [...SHOP_OFFERS.filter(o => o.currency === "softCurrency"), { id: "ten-pull", price: RULES.ten.softCurrencyCost }].map(o => ({ id: o.id, cost: o.price, matches: o.price / 62, twoMatchSessions: o.price / 124 })),
      moveTiers: MOVE_TRAINING_COSTS.map((cost, i) => ({ tier: i + 1, cost, cumulativeClout: MOVE_TRAINING_COSTS.slice(0, i + 1).reduce((a, b) => a + b, 0), participatingMatchesForLevel: totalXpForCardLevel([2, 5, 8][i]) / 25.5 })),
      cardCap: { xp: CARD_XP_CAP, participatingMatches: CARD_XP_CAP / 25.5, actualMatchesAt60PercentParticipation: CARD_XP_CAP / 25.5 / .6 },
      participationTargets: [.6, .8].map(participation => ({
        participation,
        goals: [2, 5, 8, 10].map(level => {
          const xp = totalXpForCardLevel(level);
          const trainingPurchases = Math.ceil(xp / 250);
          return { level, xp, mixedMatches: xp / 25.5 / participation,
            twoMatchSessions: xp / 25.5 / participation / 2, sixMatchSessions: xp / 25.5 / participation / 6,
            intensiveTrainingFromZeroCost: Math.floor(xp / 250) * 225 + Math.ceil(xp % 250 * 225 / 250),
            intensiveTrainingPurchasesToReachOrPass: trainingPurchases,
            note: "Threshold prorating shown as XP-equivalent cost, not available partial purchases; actual full training may overshoot below cap.",
            actualIntensiveCostToReachOrPass: level === 10 ? 4050 : trainingPurchases * 225 };
        }),
      })),
    },
    diagnostics: {
      exhausted: runtime.generateStreetPack(stateFor(ids, true, 9), max => max - 1),
      forcedPity: runtime.generateStreetPack(stateFor(ids, false, 9), () => 0),
      forcedGuarantee: runtime.generateStreetTenPull(stateFor(ids), () => 0),
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const iterations = Number(process.argv.find(a => a.startsWith("--iterations="))?.split("=")[1] ?? 1000);
  const output = "docs/economy-audit-current-v1/simulation.json";
  mkdirSync("docs/economy-audit-current-v1", { recursive: true });
  const journeys = Number(process.argv.find(a => a.startsWith("--journeys="))?.split("=")[1] ?? 100);
  if (!Number.isSafeInteger(journeys) || journeys < 1) throw Error("journeys must be a positive integer");
  writeFileSync(output, JSON.stringify(buildCurrentAudit(iterations, SEED, journeys), null, 2) + "\n");
  console.log(`Wrote ${output}; seed ${SEED}; ${iterations} independent pack trials per cohort/type.`);
}