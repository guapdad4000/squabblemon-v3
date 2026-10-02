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
const blue = decks.find(d => d.id === 'focused-blue-set')!;
const red = decks.find(d => d.id === 'focused-red-set')!;
const opponents = [red,
  ...['element-light', 'element-air', 'element-dark'].map(id => decks.find(d => d.id === id)!)];
assert(opponents.every(Boolean));
for (const deck of [blue, ...opponents]) {
  assert(!deck.cardIds.includes('guap'), `${deck.id}: GUAP is excluded from this balance scope`);
}
const hash = sourceHash();
type Row = { opponent: string; policy: string; seed: string; rotation: number; tier: 0 | 3; seat: 'a-player' | 'b-player'; result: Omit<BalanceMatchResult, 'cardsA' | 'cardsB'> };
const rows: Row[] = [];
for (const opponent of opponents) {
  for (const [policyName, policy] of Object.entries({ greedy: greedyBalancePolicy, seeded: seededLegalBalancePolicy }))
    for (const seed of ['crip-homage-confirm-a', 'crip-homage-confirm-b'])
      for (const rotation of [0, 5]) for (const tier of [0, 3] as const) for (const seat of ['a-player', 'b-player'] as const) {
        const result = simulateBalanceMatch({ deckA: blue, deckB: opponent, districtSeed: seed, rotation, tier, seat, policy, allowSquabble: true });
        const { cardsA: _a, cardsB: _b, ...compact } = result;
        rows.push({ opponent: opponent.id, policy: policyName, seed, rotation, tier, seat, result: compact });
      }
  console.log(`${label}: ${opponent.id} (${rows.length} games)`);
}
assert.equal(sourceHash(), hash);
assert.equal(rows.length, 128);
const score = (group: Row[]) => ({ games: group.length, score: group.reduce((n, r) => n + (r.result.logicalWinner === 'a' ? 1 : r.result.logicalWinner === 'draw' ? 0.5 : 0), 0) / group.length });
const summary = Object.fromEntries(opponents.map(o => [o.id, {
  all: score(rows.filter(r => r.opponent === o.id)),
  ...Object.fromEntries(['greedy', 'seeded'].map(policy => [policy, score(rows.filter(r => r.opponent === o.id && r.policy === policy))])),
  ...Object.fromEntries([0, 3].map(tier => [`tier${tier}`, score(rows.filter(r => r.opponent === o.id && r.tier === tier))])),
}]));
mkdirSync(`${root}/scripts/results/crip-followup`, { recursive: true });
writeFileSync(file, JSON.stringify({ excludedCardIds: ['guap'], hash, version: CARD_BALANCE_VERSION, decks: [blue, ...opponents], summary, rows }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(summary));
