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
  music: ['the-rapper', 'the-dj', 'the-hype-man', 'the-janky-promoter', 'the-manager-nice', 'the-manager-evil', 'the-opening-act', 'the-local-celebrity', 'the-battle-rapper', 'the-og-rap-legend'],
  fitness: ['failedathlete', 'fitness-girl', 'fitness-bro', 'personal-trainer', 'lash-tech', 'apartment-maintenance-sage', 'yn-atv-lord', 'hooper', 'sportsprodigy', 'demon-trainer'],
  investigations: ['sherlock', 'watson', 'boo-boo-the-fool', 'parole-officer', 'uncle-sam', 'apartment-maintenance-sage', 'bail-bonds-auntie', 'nerd', 'homeless-wiseman', 'counter'],
  relationships: ['work-hubby', 'he-just-a-friend', 'crazy-ex-boyfriend', 'side-chick', 'suga-mama', 'wifey', 'baby', 'ms-mary-mack', 'bblnice', 'barber'],
  streetgrowth: ['mr-mc-hands', 'og-uncle-harley-davidson', 'pimp-swookie', 'gas-station-window-wiper', 'bail-bonds-auntie', 'ms-mary-mack', 'landlord', 'bottle', 'nail', 'manman'],
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
  { cardId: 'inmate-crafty', title: 'Inmates together, pressure wide', detail: 'Play another inmate or a real support card first, then follow with 2/3 Crafty for +3 Hands. Spread inmates so Boyfriend can give +3 locally and +3 across districts. Shotta and Roaster add pressure.', testCrew: catalogCrew(recommendedWorkshopCrews.cellblock) },
  { cardId: 'demario', title: 'Set up the Luigion jump', detail: 'Keep the 2/3 Demario in hand to grow one 2-Hand Mushroom each round in a random open district. Deploy him for two more Mushrooms; full districts are skipped. Keep Rooftop Gardener or Performative Male in hand to grow your other Plant characters. Normal or Powered Luigion consumes it once for +2; SQUABBLE is optional for the powered jump.', testCrew: catalogCrew(recommendedWorkshopCrews.mushroom) },
  { cardId: 'the-opening-act', title: 'WHO GOT THE AUX', detail: 'Build a complete Music Industry crew: open the show cheaply, spread artists across districts, then turn your managers, DJ and crowd into a finale. Every performer has a different job.', testCrew: catalogCrew(recommendedWorkshopCrews.music) },
  { cardId: 'personal-trainer', title: 'ONE MORE REP', detail: 'Build a Fitness circuit with athletes in all three districts. Protect and recover your trainees, reward real movement, and let Demon Trainer turn enemy-caused defeats into a comeback.', testCrew: catalogCrew(recommendedWorkshopCrews.fitness) },
  { cardId: 'boo-boo-the-fool', title: 'Make them take the bait', detail: 'Keep Sherlock and Watson working across districts. Boo Boo baits arrivals, Parole Officer punishes real moves, Uncle Sam audits investment, and Maintenance Sage rescues a trapped ally. Bail Bonds Auntie intercepts one targeted threat.', testCrew: catalogCrew(recommendedWorkshopCrews.investigations) },
  { cardId: 'side-chick', title: 'Relationship pressure', detail: 'Side Chick specifically targets an enemy Baby Momma. Work Hubby protects your investment, Suga Mama backs an ally anywhere, and Crazy Ex marks one delayed chase. Mary and BBL Nice convert genuine Hands gains into a wider board.', testCrew: catalogCrew(recommendedWorkshopCrews.relationships) },
  { cardId: 'ms-mary-mack', title: 'Grow without getting pinned', detail: 'Mary shares a bounded rhythm across districts. Nail Tech guards an investment, Pimp Swookie checks enemy gains, and Uncle Harley moves support to a weak district. Mr. Mc Hands closes with two distinct strikes.', testCrew: catalogCrew(recommendedWorkshopCrews.streetgrowth) },
  { cardId: 'counter', title: 'Spread the pressure', detail: 'Shotta opens with a 2-Hand shot. Follow with character plays in other districts to fire up to two 1-Hand encore shots per match, at most once per round. Gamer still rewards new Silence and Weaken effects.', testCrew: catalogCrew(recommendedWorkshopCrews.counterplay) },
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

/** Build an owned ten-card crew around its cover, retaining partial lineups. */
export function autoBuildDeck(draft: DeckDraft, ownedIds: readonly string[]): DeckDraft {
  const pool = [...new Set(ownedIds)].filter(id => catalogCardById[id] && catalogCardById[id].kind !== 'token');
  const owned = new Set(pool);
  const hero = owned.has(draft.heroCardId) ? draft.heroCardId : pool.find(id => catalogCardById[id].kind !== 'support') ?? pool[0] ?? '';
  const chosen = draft.cardIds.length < 10 ? [...new Set(draft.cardIds)].filter(id => owned.has(id)).slice(0, 10) : [];
  if (hero && !chosen.includes(hero)) chosen.unshift(hero);
  const anchor = catalogCardById[hero];
  // Authored crews give these new factions a coherent starting point. Partial
  // player lineups still keep their chosen cards; only open slots are filled.
  const preferredCrew = anchor?.faction === 'Music Industry' ? recommendedWorkshopCrews.music
    : anchor?.faction === 'Fitness' ? recommendedWorkshopCrews.fitness : [];
  const preferred = new Set(catalogCrew(preferredCrew));
  while (chosen.length < 10) {
    const supports = chosen.filter(id => catalogCardById[id].kind === 'support').length;
    const cheap = chosen.filter(id => catalogCardById[id].cost <= 2).length;
    const expensive = chosen.filter(id => catalogCardById[id].cost >= 5).length;
    const score = (id: string) => {
      const c = catalogCardById[id];
      return (preferred.has(id) ? 40 : 0)
        + (anchor && c.faction === anchor.faction ? 8 : 0)
        + (anchor && c.type === anchor.type ? 4 : 0)
        + (c.cost <= 2 && cheap < 4 ? 10 : 0)
        + (c.cost >= 3 && c.cost <= 4 ? 5 : 0)
        - (c.cost >= 5 && expensive >= 2 ? 18 : 0)
        - (c.kind === 'support' && supports >= 2 ? 24 : 0)
        + c.power / Math.max(1, c.cost);
    };
    const next = pool.filter(id => !chosen.includes(id)).sort((a, z) => score(z) - score(a) || a.localeCompare(z))[0];
    if (!next) break;
    chosen.push(next);
  }
  // Opening hand has playable costs; later draws supply finishers.
  const ordered = chosen.sort((a, z) => catalogCardById[a].cost - catalogCardById[z].cost || a.localeCompare(z));
  return { ...draft, cardIds: ordered, heroCardId: hero, recipeId: null };
}
