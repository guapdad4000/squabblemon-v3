// Swap each card of an element deck for a same-cost vanilla filler to find what carries it.
// Run: pnpm --filter @workspace/scripts exec tsx src/element-ablation.ts element-water
import { cards } from '@workspace/squabblemon-engine/data';
import { runBalanceMatrix } from '@workspace/squabblemon-engine/balanceLab';
import { elementDecks } from './element-balance-audit-decks';

const subjectId = process.argv[2] ?? 'element-water';
const subject = elementDecks.find((d) => d.id === subjectId)!;
const opponents = ['element-earth', 'element-poison', 'element-air', 'focus-counterplay-coherent'].map((id) => elementDecks.find((d) => d.id === id)!);
const filler: Record<number, string> = { 1: 'bodegacat', 2: 'edgar', 3: 'divorceddad', 4: 'barber', 5: 'barber', 6: 'barber' };
const score = (cardIds: string[]) => {
  const variant = { id: 'variant', name: 'variant', cardIds };
  let points = 0; let games = 0;
  for (const opp of opponents) {
    const r = runBalanceMatrix({ id: 'abl', decks: [variant, opp], districtSeeds: ['abl-00', 'abl-01'], rotations: [0, 5], tiers: [0, 3], includeMirrors: false, allowSquabble: true });
    const d = r.decks.find((x) => x.deckId === 'variant')!;
    points += d.scoreRate * d.games; games += d.games;
  }
  return points / games;
};
const base = score([...subject.cardIds]);
console.log(`${subject.name} baseline ${(base * 100).toFixed(1)}%`);
for (const id of subject.cardIds) {
  const c = (cards as Record<string, { name: string; cost: number }>)[id];
  const swapped = subject.cardIds.map((x) => (x === id ? filler[c.cost] : x));
  const s = score(swapped);
  console.log(`${c.name.padEnd(28)} removed: ${(s * 100).toFixed(1)}%  (${((s - base) * 100).toFixed(1)})`);
}
