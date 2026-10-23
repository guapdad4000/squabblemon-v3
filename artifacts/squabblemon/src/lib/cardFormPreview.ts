import type { Card } from '../data';
import { createCardInstance, type CardInstance } from '../gameEngine';

/** Read-only collection preview: no match, inventory, or equipped finish changes. */
export function previewBuddyForm(card: Card, squabbled: boolean): Card | CardInstance {
  if (card.id !== 'buddy' || !squabbled) return card;
  const normal = createCardInstance('buddy', 'player', 'form-preview', 0);
  return {
    ...card, ...normal,
    type: 'Earth', buddyForm: 'squabble-earth' as const,
    power: normal.basePower * 2, powerModifier: normal.basePower,
    ability: 'Earth Squabble',
    effect: 'Squabble: Double base Hands and transform from Plant into Earth. For two rounds, friendly Earth characters (including BUDDY) gain +2 Hands and enemies lose 1 Hand. The Earth form remains after those temporary modifiers expire. This form does not plant Buds or provide the normal district discount.',
  };
}
