import { createDefaultBalanceDecks, simulateBalanceMatch, type BalanceSeat, type BalanceTier } from '../../../lib/squabblemon-engine/src/balanceLab';

const decks = createDefaultBalanceDecks();
const wonderland = decks.find(deck => deck.id === 'focus-wonderland');
const oz = decks.find(deck => deck.id === 'focus-wiz');
if (!wonderland || !oz) throw new Error('Missing Wonderland or Oz balance deck');

const schedule = process.argv.includes('--holdout') ? 'holdout'
  : process.argv.includes('--validation') ? 'validation'
  : process.argv.includes('--audit') ? 'audit' : 'main';
const replacement = process.argv.find(arg => arg.startsWith('--replace='))?.slice('--replace='.length);
const swaps = replacement ? replacement.split(',').map(pair => pair.split(':')) : [];
if (swaps.some(([removed, added]) => !removed || !added || !wonderland.cardIds.includes(removed))
  || new Set(swaps.map(([removed]) => removed)).size !== swaps.length) {
  throw new Error('Use --replace=existing:new[,existing:new] with unique existing Wonderland cards');
}
const changes = new Map(swaps);
const deck = {
  ...wonderland,
  cardIds: wonderland.cardIds.map(id => changes.get(id) ?? id),
  orderKey: wonderland.id,
};
if (new Set(deck.cardIds).size !== 10) throw new Error('Replacement deck must contain ten unique cards');

const seeds = Array.from({ length: process.argv.includes('--quick') ? 1 : 3 },
  (_, i) => `wonderland-oz-${schedule}-0${i}`);
const rotations = process.argv.includes('--quick') ? [0, 2, 4] : [0, 2, 4, 6];
const tiers: BalanceTier[] = [0, 3];
const seats: BalanceSeat[] = ['a-player', 'b-player'];
let wins = 0, draws = 0, alicePlays = 0, aliceReturns = 0;
const seatPoints: Record<BalanceSeat, number> = { 'a-player': 0, 'b-player': 0 };
const seedDetails: Record<string, { points: number; player: number; cpu: number; alicePlays: number; districts: string[] }> = {};
for (const districtSeed of seeds) for (const rotation of rotations) for (const tier of tiers) for (const seat of seats) {
  const result = simulateBalanceMatch({
    deckA: deck, deckB: oz, districtSeed, rotation, tier, seat,
    observeComplete: match => {
      aliceReturns += match.effectLog.filter(event => event.note === 'Alice returned to hand.').length;
    },
  });
  const points = result.logicalWinner === 'a' ? 1 : result.logicalWinner === 'draw' ? 0.5 : 0;
  wins += result.logicalWinner === 'a' ? 1 : 0;
  draws += result.logicalWinner === 'draw' ? 1 : 0;
  seatPoints[seat] += points;
  const played = result.cardsA.find(card => card.cardId === 'alice')?.played ?? 0;
  alicePlays += played;
  const detail = seedDetails[districtSeed] ??= { points: 0, player: 0, cpu: 0, alicePlays: 0, districts: [...result.districtIds] };
  detail.points += points;
  detail[seat === 'a-player' ? 'player' : 'cpu'] += points;
  detail.alicePlays += played;
}
const games = seeds.length * rotations.length * tiers.length * seats.length;
const points = wins + draws / 2;
console.log(JSON.stringify({
  schedule,
  deck: deck.cardIds,
  games, wins, draws, losses: games - wins - draws,
  points, scorePercent: points / games * 100,
  playerSeatPoints: seatPoints['a-player'],
  cpuSeatPoints: seatPoints['b-player'],
  alicePlays, aliceReturns,
  seedDetails,
}, null, 2));
if (process.argv.includes('--assert-target') && points / games < 0.5) process.exitCode = 1;