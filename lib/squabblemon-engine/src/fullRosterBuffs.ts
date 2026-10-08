import type { Card } from './data';
/** v50: one-Hand body improvements for setup-heavy and narrow utility cards. */
export const FULL_ROSTER_BUFFS: Readonly<Record<string, number>> = {
  'side-chick': 3, 'work-hubby': 3, 'suga-mama': 4, 'crazy-ex-boyfriend': 4, bblnice: 3,
  'the-janky-promoter': 4,
  'lash-tech': 3, 'apartment-maintenance-sage': 4,
  stonersr: 3, foodz: 3, bbldemon: 5, krump: 4, dancecaptain: 4, cornercoach: 4, redpill: 4, fein: 2,
};
export const FULL_ROSTER_TEMPO_BUFFS: Readonly<Record<string, { fromCost:number; fromPower:number; cost:number; power:number }>> = {
  'the-og-rap-legend': {fromCost:5,fromPower:6,cost:4,power:5},
  'the-rapper': {fromCost:3,fromPower:4,cost:2,power:3},
};
export function applyFullRosterBuffs(cards: Record<string, Card>): void {
  for (const [id, power] of Object.entries(FULL_ROSTER_BUFFS)) {
    const card = cards[id];
    if (id === 'guap' || !card || (card.kind ?? 'character') !== 'character' || card.power + 1 !== power)
      throw new Error(`Invalid bounded roster buff: ${id}`);
    card.power = power;
  }
  for (const [id, patch] of Object.entries(FULL_ROSTER_TEMPO_BUFFS)) {
    const card=cards[id];
    if (id==='guap' || !card || card.cost!==patch.fromCost || card.power!==patch.fromPower) throw new Error(`Invalid tempo buff: ${id}`);
    card.cost=patch.cost; card.power=patch.power;
  }
}
