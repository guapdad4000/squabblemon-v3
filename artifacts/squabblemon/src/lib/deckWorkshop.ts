import { catalogCardById } from '../data';
import type { Match } from '../gameEngine';

export type DeckDraft = { name: string; cardIds: string[]; heroCardId: string; recipeId: string | null };

/** A replacement keeps its draw position and a removed cover follows its slot. */
export function replaceDeckCard(draft: DeckDraft, index: number, cardId: string): DeckDraft {
  if (index < 0 || index >= draft.cardIds.length || !catalogCardById[cardId] || draft.cardIds.includes(cardId)) return draft;
  const previous = draft.cardIds[index];
  return { ...draft, cardIds: draft.cardIds.map((id, slot) => slot === index ? cardId : id), heroCardId: draft.heroCardId === previous ? cardId : draft.heroCardId };
}

export const workshopSuggestions = [
  { cardId: 'nail-tech', title: 'Strengthen an ally', detail: 'Give another friendly card here +2 Hands and soften its next enemy Hands reduction.' },
  { cardId: 'delivery-demon', title: 'Move your Hands', detail: 'Move another friendly 1- or 2-Cost card here to your weakest other district.' },
  { cardId: 'landlord', title: 'Make entry costly', detail: 'The first enemy card here each round costs 1 extra Motion. Landlord costs 4, so plan for a later play.' },
] as const;

export function summarizeDeckTest(match: Match, cardId: string): string {
  const card = catalogCardById[cardId];
  if (!card) return 'Your practice match is saved. Keep experimenting with your crew.';
  // Instance identity is available even on events whose source snapshot is absent.
  const instance = [...match.boards.flat(), ...match.playerHand].find(item => item.id === cardId && item.owner === 'player');
  const play = match.effectLog.find(event => event.type === 'play' && event.owner === 'player' && event.cardInstanceId === instance?.instanceId);
  if (!play) return `${card.name} was not played in this match. Try it next time, or swap it for a card you could use earlier.`;
  const ability = match.effectLog.find(event => event.type === 'ability' && event.owner === 'player' && event.cardInstanceId === play.cardInstanceId);
  return ability ? `${card.name}: ${ability.note}` : `${card.name} was played in round ${play.round}. Review its ability condition and compare it with the card you replaced.`;
}
