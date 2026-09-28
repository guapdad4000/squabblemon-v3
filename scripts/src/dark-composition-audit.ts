// Paired deck-composition probe, not an element balance or card-strength estimate.
// pnpm --filter @workspace/scripts exec tsx src/dark-composition-audit.ts [--seeded]
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { cards } from '@workspace/squabblemon-engine/data';
import { CARD_BALANCE_VERSION, ONLINE_RULES_VERSION } from '@workspace/squabblemon-engine/multiplayer';
import { runBalanceMatrix, seededLegalBalancePolicy } from '@workspace/squabblemon-engine/balanceLab';
import { elementDecks } from './element-balance-audit-decks';

const args = process.argv.slice(2);
if (args.length > 1 || args.some(arg => arg !== '--seeded')) {
  throw new Error('Usage: tsx src/dark-composition-audit.ts [--seeded]');
}
const seeded = args.includes('--seeded');
const baseline = elementDecks.find(deck => deck.id === 'element-dark')!;
const opponentIds = ['element-water', 'element-electric', 'element-earth', 'element-poison'];
const opponents = opponentIds.map(id => elementDecks.find(deck => deck.id === id)!);
const variants = [
  { label: 'original-dark', cardIds: baseline.cardIds },
  {
    label: 'dark-lower-curve',
    cardIds: ['counter', 'gamer', 'gothkid', 'nerd', 'redpill', 'shonuff', 'shiesty', 'incel', 'sugarfoot', 'subwaymagician'],
  },
  {
    label: 'dark-mixed-support',
    cardIds: ['counter', 'gamer', 'gothkid', 'nerd', 'redpill', 'queenofhearts', 'repoman', 'thefeds', 'buddy', 'plug'],
  },
];
const schedule = {
  districtSeeds: ['element-audit-district-00'],
  rotations: [0, 5],
  tiers: [0, 3] as const,
  includeMirrors: false,
  allowSquabble: true,
};
const results = [];
for (const variant of variants) {
  let games = 0;
  let points = 0;
  const matchups = [];
  for (const opponent of opponents) {
    // Reuse the original deck identity: changing it changes deterministic draws.
    const report = runBalanceMatrix({
      id: 'dark-composition-audit',
      decks: [{ ...baseline, cardIds: variant.cardIds }, opponent],
      ...schedule,
      ...(seeded ? { policy: seededLegalBalancePolicy } : {}),
    });
    if (report.failedMatches) throw new Error(JSON.stringify(report.failures));
    const result = report.decks.find(deck => deck.deckId === baseline.id)!;
    games += result.games;
    points += result.wins + result.draws / 2;
    matchups.push({ opponentId: opponent.id, ...result });
  }
  results.push({
    ...variant, games, scoreRate: points / games, failedMatches: 0,
    averageCost: variant.cardIds.reduce((sum, id) => sum + cards[id].cost, 0) / variant.cardIds.length,
    matchups,
  });
  console.log(`${variant.label}: ${(points / games * 100).toFixed(1)}% (${games} paired-schedule games)`);
}
const outDir = fileURLToPath(new URL(`../results/element-audit/v${CARD_BALANCE_VERSION}/`, import.meta.url));
await mkdir(outDir, { recursive: true });
await writeFile(`${outDir}dark-composition-${seeded ? 'seeded' : 'greedy'}.json`, JSON.stringify({
  metadata: {
    cardBalanceVersion: CARD_BALANCE_VERSION, rulesVersion: ONLINE_RULES_VERSION,
    policy: seeded ? 'seeded-legal' : 'greedy', bothSeats: true, schedule, opponentIds,
    note: 'Small composition pilot. Not comparable to the full 13-deck leaderboard.',
  },
  results,
}, null, 2) + '\n');