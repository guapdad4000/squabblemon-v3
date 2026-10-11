import type { DistrictDisplay, Lane, Match } from './gameEngine';

/** Compact live state uses the issued match rule, never a newer catalog rule. */
export function getDistrictBattleCue(district: DistrictDisplay, match: Match, lane: Lane) {
  const issued = match.districtSnapshot?.locations[lane];
  const effect = issued?.id === district.id && issued.rule === district.rule ? issued.effect : undefined;
  const status = district.status;
  if (effect?.kind === 'broadcast') {
    const count = match.boards[lane].filter(card => card.owner === 'player' && !card.hazard).length;
    return { text: count === effect.requiredAllies ? 'ON AIR' : `${count}/${effect.requiredAllies} allies`,
      state: count === effect.requiredAllies ? 'active' : count > effect.requiredAllies ? 'blocked' : 'progress',
      detail: `${count} ${count === 1 ? 'ally' : 'allies'} here. Exactly ${effect.requiredAllies} activates +${effect.amount} Hands in each other lane.` };
  }
  const replacements: [RegExp, string][] = [
    [/^Your first-play discount ready$/, 'Discount ready'], [/^Your discount used$/, 'Discount spent'],
    [/^First play used this round$/, 'Used this round'], [/^Your comeback: (.+) ready$/, 'Comeback $1 ready'],
    [/^You did not start behind$/, 'No comeback this round'], [/^Your first arrival recorded$/, 'First arrival held'],
    [/^Your first arrival will be held$/, 'First arrival locks'],
    [/^(\d+)\/(\d+) card types in your gang$/, '$1/$2 types'],
    [/^Your spotlight used this round$/, 'Spotlight spent'], [/^Your spotlight: (.+) ready$/, 'Spotlight $1 ready'],
    [/^Your ride used this round$/, 'Ride spent'], [/^Your cheap cards: (.+) each$/, 'Cheap allies $1'],
    [/^Your tithe paid this round$/, 'Tithe paid'], [/^Your appointment used this round$/, 'Protection spent'],
    [/^Your first-play protection ready$/, 'Protection ready'], [/^Your cleanup used this round$/, 'Cleanup spent'],
    [/^Your gang cleanup ready$/, 'Cleanup ready'], [/^Your trade used this round$/, 'Trade spent'],
    [/^Your next play trades your weakest ally$/, 'Trade ready'], [/^Final harvest complete$/, 'Harvest complete'],
    [/^Flood arrives at round (\d+)$/, 'Flood in R$1'], [/^Flood has passed$/, 'Flood passed'],
    [/^Gates close at round (\d+)$/, 'Open until R$1'], [/^CLOSED · Movement only$/, 'CLOSED · moves only'],
    [/^Your draw used this round$/, 'Draw spent'], [/^Your next play draws a card$/, 'Draw ready'],
    [/^Your meal served this round$/, 'Meal served'], [/^Your next play feeds the other lanes$/, 'Meal ready'],
    [/^Traffic cleared this round$/, 'Traffic cleared'], [/^Next play pushes both gangs right$/, 'Traffic ready'],
  ];
  const replacement = replacements.find(([pattern]) => pattern.test(status));
  const text = replacement ? status.replace(...replacement) : status;
  return { text, state: /CLOSED/.test(text) ? 'blocked' : /ready|ON AIR/.test(text) ? 'active' : 'neutral', detail: status };
}
