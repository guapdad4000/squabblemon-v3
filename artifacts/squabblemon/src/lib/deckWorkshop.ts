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
  { cardId: 'landlord', title: 'Build an Earth tax crew', detail: 'Landlord is an affordable opener: tax the first enemy arrival here each round, then pair him with Earth supports and wide finishers.', testCrew: ['landlord', 'asphaltapostle', 'mansamusa', 'johnhenry'] },
  { cardId: 'dorothy', title: 'Echo movement value', detail: 'The Wiz wants open districts: move a small ally with Dorothy, then let Oz repeat a successful entrance instead of stacking one lane.', testCrew: ['dorothy', 'scarecrow', 'tinman', 'oz'] },
  { cardId: 'alice', title: 'Turn returns into tempo', detail: 'Alice leaves the board once, then returns with a Hands boost and a cheaper redeployment. Cheshire turns each return into lasting board value.', testCrew: ['alice', 'cheshire', 'watson', 'vibe'] },
  { cardId: 'sherlock', title: 'Predict and protect', detail: 'Sherlock marks the strongest other district; Watson protects the detective and repairs an injured ally so a cancelled entrance becomes a swing.', testCrew: ['sherlock', 'watson', 'church', 'counter'] },
  { cardId: 'guap', title: 'Finish with Fire', detail: 'Build friendly characters across the map before GUAP: FINNAM! charges from the whole board and pressures every opposing district.', testCrew: ['guap', 'folks', 'hooper', 'baby'] },
  { cardId: 'bottle-girl', title: 'Chain Poison entries', detail: 'Bottle Girl rewards a later play and discounts your next Poison character. Follow with entry punishment from Cologne Criminal or Nail Tech.', testCrew: ['bottle-girl', 'colognecriminal', 'nail-tech', 'sneaker'] },
  { cardId: 'inmate-crafty', title: 'Sequence Cellblock lanes', detail: 'Establish a lane with a real support and character, then use Crafty, Boyfriend, Informant, and Contraband for bounded local payoffs.', testCrew: ['inmate-crafty', 'inmate-boyfriend', 'inmate-informant', 'inmate-contraband'] },
  { cardId: 'demario', title: 'Set up the Luigion jump', detail: 'Demario creates one visible Mushroom for the next friendly character. Luigion works alone or with an ally; SQUABBLE adds the optional powered movement payoff.', testCrew: ['demario', 'luigion', 'rastamon', 'plug'] },
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
