import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { storyContent, TICKETS_PER_PERFECT_BATTLE, MAX_STARS_PER_BATTLE } from "@workspace/squabblemon-engine/story";
import { STOCKZ_STAKES, STOCKZ_DAILY_LIMIT, LOGIN_REWARDS, GROWTH_GARDEN_REWARD } from "@workspace/squabblemon-engine/accountRewards";
import { ROOKIE_FOUNDATION_IDS } from "@workspace/squabblemon-engine/data";
import { STORY_DUPLICATE_STYLE_SHARDS } from "@workspace/squabblemon-engine/economy";

const root = fileURLToPath(new URL("../../", import.meta.url));
const ledgerPath = resolve(root, "docs/economy-audit-current-v1/ledger.json");

export const ECONOMIC_CLASSIFICATIONS = ["gameplay", "cosmetic", "identity/rank", "convenience", "mixed/gameplay-reachable", "dormant"] as const;
type Classification = typeof ECONOMIC_CLASSIFICATIONS[number];
const classification = (economicClassification: Classification, classificationReason: string) => ({ economicClassification, classificationReason });
export function rewardClassification(kind: string, id: string) {
  if (kind === "cosmetic") return classification("cosmetic", "Visual entitlement; no direct gameplay upgrade.");
  if (kind === "card" || kind === "chapter-key") return classification("gameplay", "Unlocks gameplay roster or campaign access.");
  if (kind === "character-unlock") return classification("identity/rank", "Story character identity unlock, separate from gameplay-card ownership.");
  if (kind === "pack-ticket" || (kind === "currency" && ["street-xp", "clout"].includes(id))) {
    return classification("mixed/gameplay-reachable", "Pack tickets unlock gameplay cards; Clout buys cards/training; account XP unlocks milestone currency/tickets.");
  }
  throw new Error(`Unclassified reward ${kind}:${id}`);
}

/** Audit annotations only. Explicit ids fail closed when new paths need review. */
export function classifyLedger(ledger: Record<string, any>) {
  const mapping: Record<string, Classification> = {
    softCurrency: "mixed/gameplay-reachable", packTickets: "mixed/gameplay-reachable",
    styleShards: "cosmetic", styleShardBalances: "cosmetic", cosmeticCurrency: "dormant",
    xp: "mixed/gameplay-reachable", streetRep: "identity/rank", cardProgression: "gameplay",
    deckSlots: "convenience", packPity: "mixed/gameplay-reachable", ownershipAndProgress: "mixed/gameplay-reachable",
    rankPoints: "identity/rank", rankedRating: "identity/rank",
    "first-collection": "gameplay", "welcome-claim": "mixed/gameplay-reachable",
    "welcome-pull": "mixed/gameplay-reachable", "verified-match": "mixed/gameplay-reachable",
    missions: "mixed/gameplay-reachable", login: "mixed/gameplay-reachable",
    "first-login": "mixed/gameplay-reachable", "new-player": "mixed/gameplay-reachable",
    "level-milestone": "mixed/gameplay-reachable", "growth-garden": "mixed/gameplay-reachable",
    "shop-daily-clout": "mixed/gameplay-reachable", "collection-road": "mixed/gameplay-reachable",
    "career-choice": "gameplay", "mastery-and-badges": "cosmetic",
    "starter-mythic": "mixed/gameplay-reachable", "story-authored": "mixed/gameplay-reachable",
    "story-perfect": "mixed/gameplay-reachable", "courier-backfill": "mixed/gameplay-reachable",
    promo: "mixed/gameplay-reachable", mail: "mixed/gameplay-reachable",
    "stockz-settlement": "mixed/gameplay-reachable", "payment-fulfillment": "mixed/gameplay-reachable",
    "ranked-settlement": "identity/rank", pack: "mixed/gameplay-reachable",
    training: "gameplay", "training-intensive": "gameplay", "move-training": "gameplay",
    ticket: "mixed/gameplay-reachable", "deck-slot": "convenience", "common-recruit": "gameplay",
    "card-cosmetics": "cosmetic", "reaction-packs": "cosmetic", "stockz-stake": "mixed/gameplay-reachable",
  };
  const reasons: Record<Classification, string> = {
    gameplay: "Direct gameplay roster, XP or move access.",
    cosmetic: "Cosmetic entitlement/currency; not direct character power.",
    "identity/rank": "Identity or competitive standing; no spendable wallet credit.",
    convenience: "Saved-crew capacity, not direct combat power.",
    "mixed/gameplay-reachable": "Contains or can reach gameplay cards, XP/coaching or Clout/tickets that purchase them; not cosmetic-only.",
    dormant: "Persisted compatibility field; no active earn or spend path found.",
  };
  for (const section of ["balances", "earns", "spends"]) for (const entry of ledger[section]) {
    const kind = mapping[entry.id];
    if (!kind) throw new Error(`Unclassified ${section} id ${entry.id}`);
    Object.assign(entry, classification(kind, reasons[kind]));
    if (section === "spends") entry.repeatLimit = ({
      training: "Until owned card reaches 4500 XP; repeat purchases require new shop request keys.",
      "training-intensive": "Until owned card reaches 4500 XP; proportional near-cap price.",
      "move-training": "Three move tiers per card; levels 2/5/8 required.",
      "deck-slot": "24 total slots.",
      "common-recruit": "Once per unowned Common card.",
      "card-cosmetics": "Once per authored entitlement; already-owned direct craft does not debit.",
      "reaction-packs": "Once per permanent pack unlock; already-owned purchase rejected.",
      "stockz-stake": "Five starts per UTC day and one unsettled trade.",
    } as Record<string, string>)[entry.id] ?? "No authored daily/lifetime purchase cap; sufficient balance and unique request key required.";
  }
  for (const section of ["missionCatalog", "promoCatalog", "collectionRoadCatalog"]) for (const entry of ledger[section]) {
    const kind = section === "promoCatalog" && !entry.softCurrency && !entry.packTickets && !entry.styleShards
      ? "gameplay" : section === "collectionRoadCatalog" && entry.id === "first-seven"
        ? "gameplay" : "mixed/gameplay-reachable";
    Object.assign(entry, classification(kind, reasons[kind]));
  }
  for (const reward of ledger.storyCatalog.nonCurrencyGrants) Object.assign(reward, rewardClassification(reward.kind, reward.id));
  return ledger;
}

/** Source files only; never imports the API, DB, provider SDK or environment configuration. */
export function sourceManifest() {
  const paths: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(resolve(root, directory), { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else if (/\.(ts|json)$/.test(entry.name) && !/\.(test|spec)\.ts$/.test(entry.name)) paths.push(path);
    }
  };
  // Broad engine coverage intentionally includes imported reward transforms and JSON chapters.
  walk("lib/squabblemon-engine/src");
  const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
  paths.push(...Object.values(ledger.sources as Record<string, string>).map(path => path.split("#")[0]));
  paths.push("scripts/src/economy-current-ledger.ts");
  return [...new Set(paths)].sort().map(path => ({
    path, sha256: createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex"),
  }));
}

export function extractStoryCatalog() {
  return storyContent.chapters.map(chapter => ({
    chapterId: chapter.id,
    order: chapter.order,
    nodes: chapter.nodes.map(node => ({
      nodeId: node.id,
      kind: node.kind,
      optional: node.optional,
      prerequisites: [...node.prerequisites],
      eligibility: node.kind === "battle"
        ? "Available node; server-verified battle clear. Repeat clear does not reissue existing reward keys."
        : node.puzzle
          ? "Available node; server-accepted solution OR explicit skip. Same authored rewards for either."
          : "Available non-battle node; explicit completion.",
      rewards: node.rewards.map((reward, index) => ({
        ...reward,
        ...rewardClassification(reward.kind, reward.id),
        index,
        rewardKey: reward.claimKey ?? `${node.id}:${index}:${reward.kind}:${reward.id}`,
        cadence: "once-per-player-reward-key",
        duplicateUniversalShards: reward.kind === "card" ? STORY_DUPLICATE_STYLE_SHARDS : 0,
      })),
      firstPerfectReward: node.kind === "battle" ? {
        ...rewardClassification("pack-ticket", "street-pack-ticket"),
        kind: "pack-ticket",
        id: "street-pack-ticket",
        amount: TICKETS_PER_PERFECT_BATTLE,
        requiredStars: MAX_STARS_PER_BATTLE,
        rewardKey: `${node.id}:stars:${MAX_STARS_PER_BATTLE}:auto-ticket:v1`,
        eligibility: "First server-verified clear with maximum stars; independent of authored first-clear rewards.",
      } : null,
    })),
  }));
}

/** Exact two-point distribution from stockz.ts randomInt(2) sign and 2*stake winning payout. */
export function stockzDistribution(stake: number) {
  if (!STOCKZ_STAKES.some(allowed => allowed === stake)) throw new Error("Unsupported Stockz stake");
  const outcomes = [{ probability: 0.5, gross: 0, net: -stake }, { probability: 0.5, gross: 2 * stake, net: stake }];
  return {
    stake, outcomes,
    expectedGross: outcomes.reduce((sum, outcome) => sum + outcome.probability * outcome.gross, 0),
    expectedNet: outcomes.reduce((sum, outcome) => sum + outcome.probability * outcome.net, 0),
    variance: stake ** 2,
    dailyStartLimit: STOCKZ_DAILY_LIMIT,
  };
}

export function extractCurrentLedgerEvidence() {
  const chapters = extractStoryCatalog();
  const nodes = chapters.flatMap(chapter => chapter.nodes);
  const rewards = nodes.flatMap(node => node.rewards);
  const sum = (id: string) => rewards.filter(reward => reward.id === id).reduce((total, reward) => total + reward.amount, 0);
  const perfectTickets = nodes.reduce((total, node) => total + (node.firstPerfectReward?.amount ?? 0), 0);
  return {
    extractionVersion: 1,
    sourceManifest: sourceManifest(),
    storyPerNode: chapters,
    computedStoryTotals: {
      chapters: chapters.length, nodes: nodes.length,
      battles: nodes.filter(node => node.kind === "battle").length,
      xp: sum("street-xp"), softCurrency: sum("clout"),
      authoredTickets: sum("street-pack-ticket"), perfectTickets,
      maximumTickets: sum("street-pack-ticket") + perfectTickets,
    },
    starterOwnedIds: [...ROOKIE_FOUNDATION_IDS],
    loginCycle: LOGIN_REWARDS,
    gardenReward: GROWTH_GARDEN_REWARD,
    stockz: STOCKZ_STAKES.map(stockzDistribution),
    limits: "Source extraction and pure-rule diagnostics only. No database concurrency, live reward receipts, player behavior or provider validation.",
  };
}

export function checkRecordedLedger(ledger: Record<string, any>, current = extractCurrentLedgerEvidence()) {
  const errors: string[] = [];
  if (JSON.stringify(ledger.storyCatalog.totals) !== JSON.stringify(current.computedStoryTotals)) errors.push("Story totals differ from current source");
  if (JSON.stringify(ledger.generatedEvidence) !== JSON.stringify(current)) errors.push("Generated evidence differs from source; regenerate and review");
  const keys = current.storyPerNode.flatMap(chapter => chapter.nodes.flatMap(node => [
    ...node.rewards.map(reward => reward.rewardKey),
    ...(node.firstPerfectReward ? [node.firstPerfectReward.rewardKey] : []),
  ]));
  if (new Set(keys).size !== keys.length) errors.push("Duplicate story reward keys");
  for (const section of ["balances", "earns", "spends", "missionCatalog", "promoCatalog", "collectionRoadCatalog"]) {
    for (const entry of ledger[section]) if (!ECONOMIC_CLASSIFICATIONS.includes(entry.economicClassification) || !entry.classificationReason) errors.push(`Missing classification: ${section}:${entry.id ?? entry.code}`);
  }
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const flags = process.argv.slice(2);
  if (flags.some(flag => !["--write-ledger", "--check"].includes(flag))) throw new Error("Use --write-ledger, --check, or no flags for JSON output");
  const evidence = extractCurrentLedgerEvidence();
  if (flags.includes("--write-ledger")) {
    const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
    classifyLedger(ledger);
    ledger.generatedEvidence = evidence;
    writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
    console.log(`Generated source-only evidence in ${relative(root, ledgerPath)}`);
  }
  if (flags.includes("--check")) {
    const errors = checkRecordedLedger(JSON.parse(readFileSync(ledgerPath, "utf8")), evidence);
    if (errors.length) throw new Error(errors.join("; "));
    console.log("Recorded ledger matches current story and source-hash manifest.");
  }
  if (!flags.length) console.log(JSON.stringify(evidence, null, 2));
}