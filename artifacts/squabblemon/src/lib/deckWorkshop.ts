import { catalogCardByEngineId, catalogCardById } from '../data';
import type { Match } from '../gameEngine';

export type DeckDraft = { name: string; cardIds: string[]; heroCardId: string; recipeId: string | null };

/** A replacement keeps its draw position and a removed cover follows its slot. */
export function replaceDeckCard(draft: DeckDraft, index: number, cardId: string): DeckDraft {
  if (index < 0 || index >= draft.cardIds.length || !catalogCardById[cardId] || draft.cardIds.includes(cardId)) return draft;
  const previous = draft.cardIds[index];
  return { ...draft, cardIds: draft.cardIds.map((id, slot) => slot === index ? cardId : id), heroCardId: draft.heroCardId === previous ? cardId : draft.heroCardId };
}

/**
 * Complete practice crews used by the balance lab. These are recommendations only:
 * opening the workshop never replaces a starter or a player's saved crew.
 */
export const recommendedWorkshopCrews = {
  cellblock: ['inmate-crafty', 'inmate-boyfriend', 'inmate-informant', 'inmate-contraband', 'lebron-james', 'bustdown', 'cognac', 'tinman', 'counter', 'roaster'],
  detectives: ['sherlock', 'watson', 'crossingguard', 'nightmedic', 'wifey', 'counter', 'oz', 'rastamon', 'bustdown', 'tinman'],
  mushroom: ['demario', 'luigion', 'gardener', 'sprout', 'rootnurse', 'canopykeeper', 'gardenwall', 'hair-stylist', 'stylist', 'black-cowboy'],
  counterplay: ['counter', 'gamer', 'gothkid', 'nerd', 'redpill', 'buddy', 'wifey', 'pinaynurse', 'plug', 'bustdown'],
} as const;

const catalogCrew = (engineCardIds: readonly string[]): string[] =>
  engineCardIds.map(cardId => catalogCardByEngineId[cardId].catalogId);

export const workshopSuggestions = [
  { cardId: 'landlord', title: 'Build an Earth tax crew', detail: 'Landlord is an affordable opener: tax the first enemy arrival here each round, then pair him with Earth supports and wide finishers.', testCrew: ['landlord', 'asphaltapostle', 'mansamusa', 'johnhenry'] },
  { cardId: 'dorothy', title: 'Echo movement value', detail: 'The Wiz wants open districts: move a small ally with Dorothy, then let Oz repeat a successful entrance instead of stacking one lane.', testCrew: ['dorothy', 'scarecrow', 'tinman', 'oz'] },
  { cardId: 'alice', title: 'Turn returns into tempo', detail: 'Alice leaves the board once, then returns with a Hands boost and a cheaper redeployment. Cheshire turns each return into lasting board value.', testCrew: ['alice', 'cheshire', 'watson', 'vibe'] },
  { cardId: 'sherlock', title: 'Predict, cancel, protect', detail: 'An actual Sherlock cancellation gives him +2 Hands and your weakest other character +2. Watson is a 2/3 who repairs up to 3 actual damage, Protects that ally or a fallback ally, and Protects Sherlock anywhere.', testCrew: catalogCrew(recommendedWorkshopCrews.detectives) },
  { cardId: 'guap', title: 'Finish with Fire', detail: 'Build friendly characters across the map before GUAP: FINNAM! charges from the whole board and pressures every opposing district.', testCrew: ['guap', 'folks', 'hooper', 'baby'] },
  { cardId: 'bottle-girl', title: 'Chain Poison entries', detail: 'Bottle Girl rewards a later play and discounts your next Poison character. Follow with entry punishment from Cologne Criminal or Nail Tech.', testCrew: ['bottle-girl', 'colognecriminal', 'nail-tech', 'sneaker'] },
  { cardId: 'inmate-crafty', title: 'Inmates together, pressure wide', detail: 'Play another inmate or a real support card first, then follow with 2/3 Crafty for +2 Hands. Spread inmates so Boyfriend can give +2 locally and +2 across districts. Counter and Roaster add pressure.', testCrew: catalogCrew(recommendedWorkshopCrews.cellblock) },
  { cardId: 'demario', title: 'Set up the Luigion jump', detail: 'Build Plant pressure around the 2/2 Demario and his local Mushroom. Keep Rooftop Gardener or Performative Male in hand to grow your other Plant characters. Normal or Powered Luigion consumes it once for +2; SQUABBLE is optional for the powered jump.', testCrew: catalogCrew(recommendedWorkshopCrews.mushroom) },
  { cardId: 'counter', title: 'Trigger Dark control', detail: 'Use Silence and Weaken enablers such as Closet Nerd, BUDDY, and Red Pill. Each round, the first new debuff activates Counter and Gamer’s Dark payoff.', testCrew: catalogCrew(recommendedWorkshopCrews.counterplay) },
] as const;

export function summarizeDeckTest(match: Match, cardId: string): string {
  const card = catalogCardById[cardId];
  if (!card) return 'Your practice fade is saved. Keep experimenting with your gang.';
  // Instance identity is available even on events whose source snapshot is absent.
  const instance = [...match.boards.flat(), ...match.playerHand].find(item => item.id === cardId && item.owner === 'player');
  const play = match.effectLog.find(event => event.type === 'play' && event.owner === 'player' && event.cardInstanceId === instance?.instanceId);
  if (!play) return `${card.name} was not played in this fade. Try it next time, or swap it for a card you could use earlier.`;
  const ability = match.effectLog.find(event => event.type === 'ability' && event.owner === 'player' && event.cardInstanceId === play.cardInstanceId);
  return ability ? `${card.name}: ${ability.note}` : `${card.name} was played in round ${play.round}. Review its ability condition and compare it with the card you replaced.`;
}
