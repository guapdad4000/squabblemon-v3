import type { CardInstance } from './gameEngine';

/** Gameplay identities, independent of artwork, copied abilities and crew ownership. */
export const HOMELESS_CHARACTER_IDS = [
  'homelessguy', 'homelessyn', 'homelesslegend', 'homeless-wiseman', 'cracked-head',
] as const;

const homelessIds = new Set<string>(HOMELESS_CHARACTER_IDS);

export function isHomelessCharacter(card: Pick<CardInstance, 'cardId' | 'kind' | 'hazard'>): boolean {
  return !card.hazard && (card.kind ?? 'character') === 'character' && homelessIds.has(card.cardId);
}
