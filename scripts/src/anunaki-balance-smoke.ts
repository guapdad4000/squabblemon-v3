import { decks } from '@workspace/squabblemon-engine/data';
import { greedyBalancePolicy, seededLegalBalancePolicy, simulateBalanceMatch, type BalanceDeck, type BalanceMatchResult } from '@workspace/squabblemon-engine/balanceLab';

// A small deterministic diagnostic, not a measure of human or ranked win rate.
const expansion: BalanceDeck = {id: 'anunaki', name: 'Anunaki', cardIds: [
  'nabu', 'enki', 'utu', 'yakub', 'inanna', 'ninhursag', 'caucus-mountaineer', 'enlil', 'ereshkigal', 'anu',
]};
const opponentIds = ['block', 'slide', 'combo', 'receipts', 'crashout', 'voltage', 'music-industry', 'squabblehouse-shift'];
const policies = [['greedy', greedyBalancePolicy], ['seeded', seededLegalBalancePolicy]] as const;
const seedCount = Number(process.env.ANUNAKI_BALANCE_SEEDS ?? 2);
if (!Number.isInteger(seedCount) || seedCount < 1 || seedCount > 100) throw new Error('ANUNAKI_BALANCE_SEEDS must be an integer from 1 to 100.');
const seedPrefix = process.env.ANUNAKI_BALANCE_SEED_PREFIX ?? 'audit';
const seeds = Array.from({length: seedCount}, (_, index) => `${seedPrefix}-${index + 1}`);
const seats = ['a-player', 'b-player'] as const;
const rows: {opponent: string; policy: string; seed: string; seat: typeof seats[number]; result: BalanceMatchResult['logicalWinner']; cards: Pick<BalanceMatchResult['cardsA'][number], 'cardId' | 'played' | 'finalCopies'>[]}[] = [];
for (const id of opponentIds) {
  const deck = decks.find(candidate => candidate.id === id);
  if (!deck) throw new Error(`Missing opponent ${id}`);
  const opponent: BalanceDeck = {id: deck.id, name: deck.name, cardIds: deck.cards};
  for (const [policyName, policy] of policies) for (const districtSeed of seeds) for (const seat of seats) {
    const result = simulateBalanceMatch({deckA: expansion, deckB: opponent, districtSeed, rotation: 0, tier: 0, seat, policy, allowSquabble: true});
    rows.push({opponent: id, policy: policyName, seed: districtSeed, seat, result: result.logicalWinner,
      cards: result.cardsA.map(({cardId, played, finalCopies}) => ({cardId, played, finalCopies}))});
  }
}
const summarize = (samples: typeof rows) => ({games: samples.length,
  wins: samples.filter(row => row.result === 'a').length,
  losses: samples.filter(row => row.result === 'b').length,
  draws: samples.filter(row => row.result === 'draw').length});
console.log(JSON.stringify({deck: expansion, opponentIds, seeds, policies: policies.map(([name]) => name), tier: 0,
  rotation: 0, allowSquabble: true, overall: summarize(rows), byOpponent: Object.fromEntries(opponentIds.map(id => [id, summarize(rows.filter(row => row.opponent === id))])),
  bySeat: Object.fromEntries(seats.map(seat => [seat, summarize(rows.filter(row => row.seat === seat))])),
  byPolicy: Object.fromEntries(policies.map(([policy]) => [policy, summarize(rows.filter(row => row.policy === policy))])),
  cardUse: Object.fromEntries(expansion.cardIds.map(cardId => [cardId, {
    plays: rows.reduce((sum, row) => sum + (row.cards.find(card => card.cardId === cardId)?.played ?? 0), 0),
    finalCopies: rows.reduce((sum, row) => sum + (row.cards.find(card => card.cardId === cardId)?.finalCopies ?? 0), 0),
  }])), rows}, null, 2));
