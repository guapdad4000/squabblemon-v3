import { MAX_MOTION, cards, catalogCardById } from './data';
import { getDistrictResults, getMatchWinner, type Match } from './gameEngine';

export function crewInsights(ids: readonly string[]) {
  const crew = ids.map(id => cards[id] ?? cards[catalogCardById[id]?.engineId]).filter(Boolean);
  const engines = ids.map(id => cards[id] ? id : catalogCardById[id]?.engineId);
  const opening = crew.slice(0, 5).filter(c => c.cost <= 2).length;
  const curve = Array.from({ length: MAX_MOTION + 1 }, (_, i) => crew.filter(c => c.cost === i).length);
  const tips: string[] = [];
  if (opening < 2) tips.push('Your opening hand has fewer than two cards you can summon with 2 Motion. Move a cheap card earlier or add one.');
  if (engines.includes('nguyen')) tips.push('Nguyen gains Hands when an ally is in another district. Spread an opener before summoning him.');
  if (engines.includes('gamer')) tips.push(crew.filter(c => c.cost <= 2).length < 3 ? 'Gamer has few cheap partners. Add another 1- or 2-cost card to give his ability more chances.' : 'Play Gamer before your cheap arrivals; each arrival here strengthens both cards.');
  if (engines.includes('icecream') || engines.includes('manman')) tips.push('Your crew rewards gathering allies. Keep enough plays available to contest a second district.');
  if (engines.some(id => ['earthy', 'nail', 'abuela', 'pinaynurse', 'boombox', 'workboots', 'charger'].includes(id))) tips.push('Your support cards need an ally already on the board. Lead with an opener.');
  if (!engines.some(id => ['pinaynurse', 'rastamon', 'soulfood', 'firstaid', 'laundry', 'nightmedic'].includes(id))) tips.push('You have no cleanser. Freeze will need to be prevented, avoided, or played around.');
  if (engines.some(id => ['bikelife', 'delivery', 'carmeet', 'vibe', 'subwaymap'].includes(id))) tips.push('Movement can shift Hands to a second district without spending another summon there.');
  return { opening, curve, tips: tips.slice(0, 5) };
}
export function battleAchievements(match: Match) {
  const events = match.effectLog.filter(e => e.type === 'ability' && e.owner === 'player');
  const cleansed = events.some(e => e.targets.some(t => t.before?.owner === 'player' && t.after &&
    ((t.before.statuses.frozen && !t.after.statuses.frozen) || (t.before.statuses.silenced && !t.after.statuses.silenced))));
  const movedIds = new Set(events.flatMap(e => [e.source, ...e.targets]).filter(t => t?.before?.owner === 'player' && t.after && t.before.lane !== null && t.after.lane !== t.before.lane).map(t => t!.cardInstanceId));
  const districts = getDistrictResults(match);
  const movementWin = getMatchWinner(match) === 'player' && match.boards.some((lane, i) => districts[i].winner === 'player' && lane.some(c => movedIds.has(c.instanceId)));
  const previous = match.storyEncounter?.activity?.previousCardIds;
  const changedCrew = !!previous?.length && (previous.length !== match.playerCardIds.length || previous.some(id => !match.playerCardIds.includes(id)));
  const playedIds = [...new Set(match.effectLog.filter(e => e.type === 'play' && e.owner === 'player').map(e => e.cardId).filter((id): id is string => !!id && !!cards[id]))];
  return { cleansed, movementWin, changedCrew, playedIds };
}
export function coachBattle(match: Match): string {
  const facts = battleAchievements(match);
  if (facts.cleansed) return 'You removed a status from an ally. Cleansing restores frozen Hands and re-enables silenced abilities; it cannot revive a destroyed card.';
  if (facts.movementWin) return 'You moved an ally into a district you finished ahead in. Keep looking for movement that helps secure your second district.';
  const failed = match.effectLog.find(e => e.type === 'ability' && e.owner === 'player' && /condition not met|needs another|found no|only triggers/.test(e.note));
  if (failed) return `Round ${failed.round}: ${failed.note} Check that condition before spending your next summon.`;
  const districts = getDistrictResults(match);
  const heavy = districts.find(r => r.player - r.cpu >= 6);
  const close = districts.find(r => r.winner !== 'player' && r.cpu - r.player <= 5);
  if (heavy && close) return `You finished district ${heavy.lane + 1} ahead by ${heavy.player - heavy.cpu}; district ${close.lane + 1} needed ${close.cpu - close.player + 1} more Hands to lead. Consider spreading a future play.`;
  return getMatchWinner(match) === 'player' ? 'You secured at least two districts. Change one card and compare how often its ability helps you hold that second district.' : 'Review the last contested district. Try changing one card so you can tell which adjustment helps.';
}
