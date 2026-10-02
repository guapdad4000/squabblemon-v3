import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { allRankingDecks } from './all-decks-ranking-decks';
import { root, sourceHash } from './all-decks-ranking';
import { greedyBalancePolicy, seededLegalBalancePolicy, simulateBalanceMatch, type BalanceMatchResult } from '@workspace/squabblemon-engine/balanceLab';
import { CARD_BALANCE_VERSION } from '@workspace/squabblemon-engine/multiplayer';
const label = process.argv[2];
assert(label && /^[a-z0-9-]+$/.test(label));
const file = `${root}/scripts/results/crip-followup/${label}.json`;
assert(!existsSync(file), 'Preserve existing results');
const decks = allRankingDecks();
const originalBlue = decks.find(d => d.id === 'focused-blue-set')!;
const blue = process.argv[3] === 'water-provider'
  ? { ...originalBlue, cardIds: originalBlue.cardIds.map(id => id === 'alchy' ? 'monsoonanchor' : id) }
  : process.argv[3] === 'water-support'
    ? { ...originalBlue, cardIds: originalBlue.cardIds.map(id => id === 'cognac' ? 'monsoonanchor' : id) }
    : originalBlue;
const red = decks.find(d => d.id === 'focused-red-set')!;
const opponents = [red];
for (const deck of [blue, ...opponents]) {
  assert(!deck.cardIds.includes('guap'), `${deck.id}: GUAP is excluded from this balance scope`);
}
const hash = sourceHash();
type Row = { opponent: string; policy: string; seed: string; rotation: number; tier: 0 | 1 | 2 | 3; seat: 'a-player' | 'b-player'; result: Omit<BalanceMatchResult, 'cardsA' | 'cardsB'> };
const rows: Row[] = [];
for (const opponent of opponents) for (const [policyName, policy] of Object.entries({ greedy: greedyBalancePolicy, seeded: seededLegalBalancePolicy })) {
  for (const seed of (process.argv.includes('--final') ? Array.from({ length: 8 }, (_, i) => `blood-crip-final-${i}`) : process.argv.includes('--holdout')
    ? ['blood-repair-holdout-a', 'blood-repair-holdout-b', 'blood-repair-holdout-c', 'blood-repair-holdout-d']
    : ['blood-repair-paired-a', 'blood-repair-paired-b', 'blood-repair-paired-c', 'blood-repair-paired-d']))
    for (const rotation of [0, 5]) for (const tier of [0, 1, 2, 3] as const) for (const seat of ['a-player', 'b-player'] as const) {
      const result = simulateBalanceMatch({ deckA: blue, deckB: opponent, districtSeed: seed, rotation, tier, seat, policy, allowSquabble: true });
      const { cardsA: _a, cardsB: _b, ...compact } = result;
      rows.push({ opponent: opponent.id, policy: policyName, seed, rotation, tier, seat, result: compact });
    }
  console.log(`${label}: ${opponent.id} / ${policyName} (${rows.length} games)`);
}
assert.equal(sourceHash(), hash);
assert.equal(rows.length, process.argv.includes('--final') ? 256 : 128);
const score = (group: Row[]) => ({ games: group.length, score: group.reduce((n, r) => n + (r.result.logicalWinner === 'a' ? 1 : r.result.logicalWinner === 'draw' ? 0.5 : 0), 0) / group.length });
const summary = Object.fromEntries(opponents.map(o => [o.id, {
  all: score(rows.filter(r => r.opponent === o.id)),
  ...Object.fromEntries(['greedy', 'seeded'].map(policy => [policy, score(rows.filter(r => r.opponent === o.id && r.policy === policy))])),
  ...Object.fromEntries([0, 1, 2, 3].map(tier => [`tier${tier}`, score(rows.filter(r => r.opponent === o.id && r.tier === tier))])),
  ...Object.fromEntries(['a-player', 'b-player'].map(seat => [seat, score(rows.filter(r => r.opponent === o.id && r.seat === seat))])),
}]));
mkdirSync(`${root}/scripts/results/crip-followup`, { recursive: true });
writeFileSync(file, JSON.stringify({ excludedCardIds: ['guap'], hash, version: CARD_BALANCE_VERSION, decks: [blue, ...opponents], summary, rows }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(summary));
