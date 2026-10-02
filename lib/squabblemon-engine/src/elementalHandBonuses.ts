import type { Card } from './data';

/** Every live type, including Normal, has a card that can support it from hand. */
export const ELEMENTAL_HAND_BONUS_CARDS = {
  Fire: 'guap',
  Water: 'monsoonanchor',
  Electric: 'piratedj',
  Light: 'abuela',
  Plant: 'gardener',
  Earth: 'torta',
  Air: 'slipstream',
  Dark: 'gamer',
  Poison: 'nail',
  Normal: 'barber',
} as const;

const existingHandBonusCards = new Set<string>(['guap', 'monsoonanchor', 'piratedj']);

/** Run after kit/balance overrides so the live engine and printed catalog agree. */
export function applyElementalHandBonuses(cards: Record<string, Card>): void {
  for (const [type, id] of Object.entries(ELEMENTAL_HAND_BONUS_CARDS)) {
    const card = cards[id];
    if (!card || card.type !== type || card.hazard || (card.kind && card.kind !== 'character')) {
      throw new Error(`Invalid ${type} hand-bonus carrier: ${id}`);
    }
    if (existingHandBonusCards.has(id)) {
      // Preserve their exact kits, including Sushi Chef's existing trained bond.
      if (card.elementalBond !== type) throw new Error(`Missing existing ${type} hand bonus: ${id}`);
      continue;
    }
    // These are dual reveal/hand kits: their upgrades still belong to the reveal.
    // An Ongoing-only prefix would inadvertently activate pure-bond training.
    if (!card.effect.startsWith('On Reveal:')) {
      throw new Error(`Hand bonus must preserve ${id}'s reveal kit and training`);
    }
    const bonus = `Ongoing: While ${card.name} is in your hand, your other ${type} characters on the board gain +1 Hands at round end.`;
    card.elementalBond = type;
    if (!card.effect.includes(bonus)) card.effect += ` ${bonus}`;
  }
}