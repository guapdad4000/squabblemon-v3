// Paired Dark-card composition audit. Results are composition/policy probes, not card-strength estimates.
// Run: pnpm --filter @workspace/scripts run balance:dark-sweep -- --quick
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cards } from '@workspace/squabblemon-engine/data';
import { CARD_BALANCE_VERSION, ONLINE_RULES_VERSION } from '@workspace/squabblemon-engine/multiplayer';
import {
  countBalanceMatrixMatches,
  greedyBalancePolicy,
  runBalanceMatrix,
  seededLegalBalancePolicy,
  type BalanceDeck,
  type BalanceMatrixReport,
} from '@workspace/squabblemon-engine/balanceLab';
import { elementDecks } from './element-balance-audit-decks';

type Mode = 'quick' | 'full' | 'shortlist';
type Options = { mode: Mode; outDir?: string };

function parseArgs(args: string[]): Options {
  let mode: Mode = 'quick';
  let modeSeen = false;
  let outDir: string | undefined;
  for (const arg of args) {
    if (arg === '--quick' || arg === '--full' || arg === '--shortlist') {
      if (modeSeen) throw new Error('Choose only one of --quick or --full');
      mode = arg.slice(2) as Mode;
      modeSeen = true;
    } else if (arg.startsWith('--out-dir=')) {
      outDir = arg.slice('--out-dir='.length);
      if (!outDir) throw new Error('--out-dir requires a path');
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return { mode, outDir };
}

function isPlayableDark(id: string): boolean {
  const card = cards[id];
  return Boolean(card && card.type.toLowerCase() === 'dark'
    && !card.hazard && card.kind !== 'support' && card.kind !== 'token');
}

function cardInventory() {
  return Object.entries(cards)
    .filter(([id]) => isPlayableDark(id))
    .map(([id, card]) => ({
      id,
      name: card.name,
      kind: card.kind === 'blockbuster' ? 'blockbuster' : 'character',
      cost: card.cost,
      printedHands: card.power,
      ability: card.ability,
      effect: card.effect,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function deckCost(cardIds: readonly string[]): number {
  return cardIds.reduce((total, id) => total + cards[id].cost, 0);
}

function averageCost(cardIds: readonly string[]): number {
  return deckCost(cardIds) / cardIds.length;
}

function summarize(report: BalanceMatrixReport, deckId: string) {
  const deck = report.decks.find(item => item.deckId === deckId);
  if (!deck) throw new Error(`Missing deck summary for ${deckId}`);
  return {
    ...deck,
    cardEvents: report.cards.filter(card => card.appearances > 0),
    matchups: report.matchups,
    failures: report.failures,
    matchCount: report.matchCount,
    successfulMatches: report.successfulMatches,
    failedMatches: report.failedMatches,
  };
}

const baseline = elementDecks.find(deck => deck.id === 'element-dark');
if (!baseline) throw new Error('The fixed element-dark baseline deck was not found');
const opponents = ['element-water', 'element-electric', 'element-earth', 'element-poison']
  .map(id => elementDecks.find(deck => deck.id === id))
  .filter((deck): deck is BalanceDeck => Boolean(deck));
if (opponents.length !== 4) throw new Error('A fixed Dark sweep opponent deck is missing');

const lowerCurveIds = [
  'counter', 'gamer', 'gothkid', 'nerd', 'redpill',
  'shonuff', 'shiesty', 'incel', 'sugarfoot', 'subwaymagician',
];
if (new Set(lowerCurveIds).size !== 10 || lowerCurveIds.some(id => !isPlayableDark(id))) {
  throw new Error('The lower-cost Dark-only composition contains a non-Dark or unavailable card');
}
if (averageCost(lowerCurveIds) >= averageCost(baseline.cardIds)) {
  throw new Error('The lower-cost Dark-only composition is not cheaper than the fixed baseline');
}

const inventory = cardInventory();
if (!inventory.length) throw new Error('No playable Dark character/blockbuster cards were assembled');

const options = parseArgs(process.argv.slice(2));
const schedule = options.mode === 'quick'
  ? { districtSeeds: ['element-audit-district-00'], rotations: [0], tiers: [0] as const, includeMirrors: false }
  : {
    districtSeeds: ['element-audit-district-00', 'element-audit-district-01'],
    rotations: [0, 5],
    tiers: [0, 3] as const,
    includeMirrors: false,
  };
const sweepOpponents = options.mode === 'shortlist'
  ? ['element-water', 'element-electric', 'element-air', 'focus-counterplay-coherent']
    .map(id => elementDecks.find(deck => deck.id === id))
    .filter((deck): deck is BalanceDeck => Boolean(deck))
  : opponents;
if (sweepOpponents.length !== 4) throw new Error('A Dark sweep opponent deck is missing');
const policyConfigs = [
  { name: 'greedy', policy: greedyBalancePolicy },
  { name: 'seeded-legal', policy: seededLegalBalancePolicy },
] as const;
const baselineHistorical = { balanceV16: { greedyScoreRate: 0.398, seededLegalScoreRate: 0.286, gamesPerPolicy: 192 } };

// Each eligible card replaces one baseline card: prefer a same-cost control, otherwise
// choose the closest cost (stable baseline order breaks ties). Deck identity/orderKey stay
// fixed so baseline and candidate draws are paired by the engine's seeded permutation.
const replacements = inventory.flatMap(candidate => {
  if (baseline.cardIds.includes(candidate.id)) return [];
  const removedId = [...baseline.cardIds].sort((left, right) =>
    Math.abs(cards[left].cost - candidate.cost) - Math.abs(cards[right].cost - candidate.cost)
    || baseline.cardIds.indexOf(left) - baseline.cardIds.indexOf(right))[0];
  const cardIds = baseline.cardIds.map(id => id === removedId ? candidate.id : id);
  return [{
    id: `swap-${candidate.id}`,
    name: `${candidate.name} for ${cards[removedId].name}`,
    cardIds,
    addedCardId: candidate.id,
    removedCardId: removedId,
    costDelta: cards[candidate.id].cost - cards[removedId].cost,
    comparison: cards[candidate.id].cost === cards[removedId].cost ? 'same-cost' : 'cost-changing',
  }];
});
const lowerCostVariant = {
  id: 'dark-lower-cost',
  name: 'Dark lower-cost composition',
  cardIds: lowerCurveIds,
};
const baselineVariant = (cohort: string) => ({
  id: `baseline-dark-${cohort}`,
  name: 'Unchanged finalized Dark baseline',
  cardIds: [...baseline.cardIds],
  kind: 'baseline',
});
const characterVariants = [
  baselineVariant('characters-squabble-on'),
  ...replacements
    .filter(variant => cards[variant.addedCardId].kind !== 'blockbuster')
    .map(variant => ({ ...variant, kind: variant.comparison })),
  { ...lowerCostVariant, kind: 'lower-cost-composition' },
];
const blockbusterVariants = [
  baselineVariant('blockbusters-squabble-off'),
  ...replacements
    .filter(variant => cards[variant.addedCardId].kind === 'blockbuster')
    .map(variant => ({ ...variant, kind: variant.comparison })),
];
const cohorts = [
  {
    id: 'characters-and-lower-cost',
    allowSquabble: true,
    comparisonNote: 'Character substitutions and the lower-cost crew use the official v16 SQUABBLE-enabled rule.',
    variants: characterVariants,
  },
  {
    id: 'blockbusters-no-squabble',
    allowSquabble: false,
    comparisonNote: 'Blockbusters cannot use SQUABBLE in the engine; this separate cohort has its own unchanged baseline. Do not compare its rates with the SQUABBLE-enabled cohort.',
    variants: blockbusterVariants,
  },
];
const selectedCohorts = options.mode === 'shortlist'
  ? [{
    id: 'shortlist-characters-squabble-on',
    allowSquabble: true,
    comparisonNote: 'Shortlist composition probes; SQUABBLE is enabled and all variants share the unchanged Dark baseline identity.',
    variants: characterVariants.filter(variant =>
      variant.id === 'baseline-dark-characters-squabble-on'
      || variant.id === 'swap-inmate-kingpin'
      || variant.id === 'swap-shiesty'
      || variant.id === 'dark-lower-cost'),
  }]
  : cohorts;

const outDir = path.resolve(options.outDir
  ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '../results/dark-card-sweep'));
const allPolicies = [];
for (const policyConfig of policyConfigs) {
  const policyCohorts = [];
  for (const cohort of selectedCohorts) {
    const policyResults = [];
    for (const variant of cohort.variants) {
      const variantDeck: BalanceDeck = {
        id: baseline.id,
        name: variant.name,
        cardIds: variant.cardIds,
        orderKey: baseline.id,
      };
      const opponentResults = [];
      for (const opponent of sweepOpponents) {
        const matchCount = countBalanceMatrixMatches({
          id: `dark-card-sweep-${policyConfig.name}-${cohort.id}`,
          decks: [variantDeck, opponent],
          ...schedule,
        });
        const report = runBalanceMatrix({
          id: `dark-card-sweep-${policyConfig.name}-${cohort.id}`,
          decks: [variantDeck, opponent],
          ...schedule,
          allowSquabble: cohort.allowSquabble,
          policy: policyConfig.policy,
        });
        opponentResults.push({
          opponentId: opponent.id,
          scheduledMatches: matchCount,
          ...summarize(report, baseline.id),
        });
      }
      const games = opponentResults.reduce((sum, result) => sum + result.games, 0);
      const points = opponentResults.reduce((sum, result) => sum + result.wins + result.draws / 2, 0);
      policyResults.push({
        ...variant,
        averageCost: averageCost(variant.cardIds),
        costChangeFromBaseline: averageCost(variant.cardIds) - averageCost(baseline.cardIds),
        games,
        wins: opponentResults.reduce((sum, result) => sum + result.wins, 0),
        losses: opponentResults.reduce((sum, result) => sum + result.losses, 0),
        scoreRate: games ? points / games : 0,
        draws: opponentResults.reduce((sum, result) => sum + result.draws, 0),
        failedMatches: opponentResults.reduce((sum, result) => sum + result.failedMatches, 0),
        scheduledMatches: opponentResults.reduce((sum, result) => sum + result.matchCount, 0),
        schedule: {
          ...schedule,
          bothSeats: true,
          allowSquabble: cohort.allowSquabble,
          opponentIds: sweepOpponents.map(item => item.id),
        },
        opponentResults,
      });
    }
    policyCohorts.push({
      id: cohort.id,
      allowSquabble: cohort.allowSquabble,
      comparisonNote: cohort.comparisonNote,
      unchangedBaselineVariantId: cohort.variants[0].id,
      schedule: {
        ...schedule,
        bothSeats: true,
        allowSquabble: cohort.allowSquabble,
        opponentIds: sweepOpponents.map(item => item.id),
      },
      results: policyResults,
    });
    console.log(`${policyConfig.name}/${cohort.id}: ${policyResults.length} variants, `
      + `${policyResults.reduce((sum, item) => sum + item.scheduledMatches, 0)} scheduled matches`);
  }
  allPolicies.push({
    policy: policyConfig.name,
    baselineV16HistoricalScoreRate: policyConfig.name === 'greedy'
      ? baselineHistorical.balanceV16.greedyScoreRate
      : baselineHistorical.balanceV16.seededLegalScoreRate,
    cohorts: policyCohorts,
  });
}

await mkdir(outDir, { recursive: true });
const reportPath = path.join(outDir, `dark-card-sweep-v${CARD_BALANCE_VERSION}-${options.mode}.json`);
await writeFile(reportPath, `${JSON.stringify({
  metadata: {
    scope: 'assembled playable Dark characters and blockbusters; finalized shared engine cards',
    cardBalanceVersion: CARD_BALANCE_VERSION,
    rulesVersion: ONLINE_RULES_VERSION,
    mode: options.mode,
    scheduleAxes: {
      ...schedule,
      bothSeats: true,
      allowSquabble: selectedCohorts.every(cohort => cohort.allowSquabble),
      opponentIds: sweepOpponents.map(item => item.id),
    },
    pairing: 'Each variant and its cohort baseline retain element-dark identity/orderKey; fixed opponent identity and engine seeded deck ordering are unchanged.',
    baselineDeck: baseline,
    historicalBaselineV16: baselineHistorical,
    interpretation: 'Variant results depend on deck composition and automated policy. Same-cost vs cost-changing is a printed-cost classification, not a causal card-buff estimate.',
    inventoryCount: inventory.length,
  },
  inventory,
  policies: allPolicies,
}, null, 2)}\n`);
console.log(`Dark card sweep report: ${reportPath}`);