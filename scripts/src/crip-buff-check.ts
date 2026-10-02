import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { allRankingDecks } from './all-decks-ranking-decks';
import { root, sourceHash } from './all-decks-ranking';
import { greedyBalancePolicy, seededLegalBalancePolicy, simulateBalanceMatch, type BalanceMatchResult } from '@workspace/squabblemon-engine/balanceLab';
import { CARD_BALANCE_VERSION } from '@workspace/squabblemon-engine/multiplayer';
const label = process.argv[2];
assert(label && /^[a-z0-9-]+$/.test(label));
const decks = allRankingDecks();
const blue = decks.find(d => d.id === 'focused-blue-set')!;
const hash = sourceHash();
type Row = { opponent: string; policy: string; seed: string; tier: 0 | 3; seat: 'a-player' | 'b-player'; result: Omit<BalanceMatchResult, 'cardsA' | 'cardsB'> };
const rows: Row[] = [];
for (const opponent of decks.filter(d => d.id !== blue.id)) {
  for (const [policyName, policy] of Object.entries({ greedy: greedyBalancePolicy, seeded: seededLegalBalancePolicy }))
    for (const seed of ['crip-followup-20261002-a', 'crip-followup-20261002-b'])
      for (const tier of [0, 3] as const) for (const seat of ['a-player', 'b-player'] as const) {
        const result = simulateBalanceMatch({ deckA: blue, deckB: opponent, districtSeed: seed, rotation: 0, tier, seat, policy, allowSquabble: true });
        const { cardsA: _cardsA, cardsB: _cardsB, ...compactResult } = result;
        rows.push({ opponent: opponent.id, policy: policyName, seed, tier, seat, result: compactResult });
      }
  console.log(`${label}: ${opponent.id} (${rows.length} games)`);
}
assert.equal(sourceHash(), hash, 'Sources changed during the run');
assert.equal(rows.length, (decks.length - 1) * 16);
const score = (group: typeof rows) => ({ games: group.length, score: group.reduce((n, r) => n + (r.result.logicalWinner === 'a' ? 1 : r.result.logicalWinner === 'draw' ? 0.5 : 0), 0) / group.length });
const summary = { all: score(rows), base: score(rows.filter(r => r.tier === 0)), trained: score(rows.filter(r => r.tier === 3)), greedy: score(rows.filter(r => r.policy === 'greedy')), seeded: score(rows.filter(r => r.policy === 'seeded')), player: score(rows.filter(r => r.seat === 'a-player')), cpu: score(rows.filter(r => r.seat === 'b-player')) };
mkdirSync(`${root}/scripts/results/crip-followup`, { recursive: true });
writeFileSync(`${root}/scripts/results/crip-followup/${label}.json`, JSON.stringify({ hash, version: CARD_BALANCE_VERSION, decks, summary, rows }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(summary));
