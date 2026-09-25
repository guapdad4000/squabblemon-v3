import { blockbusterExtraCost, getDistrictResults, getLegalCardCost, getStoryLockedLanes, playTurnCard, type Match, type Lane } from './gameEngine';

/** Preview only the visible board; private rival draws and the next rival move are excluded. */
export function previewBattlePlay(match: Match, instanceId: string, lane: Lane, squabble = false, investment = 0) {
  const card = match.playerHand.find(card => card.instanceId === instanceId);
  if (!card || match.phase !== 'player' || getStoryLockedLanes(match, 'player').includes(lane)) return null;
  // Random outcomes are revealed only after committing the play.
  if (['the-dice-game','the-shootout','the-cookout'].includes(card.cardId)) return null;
  const cost = getLegalCardCost(match, 'player', card, lane) + blockbusterExtraCost(card.cardId, investment);
  if (cost > match.playerMotion) return null;
  const publicMatch: Match = JSON.parse(JSON.stringify(match));
  publicMatch.cpuHand = []; publicMatch.cpuCardIds = []; publicMatch.cpuDrawIndex = 0;
  const result = playTurnCard(publicMatch, 'player', instanceId, lane, squabble, investment);
  const visible = new Set(match.boards.flat().map(card => card.instanceId));
  const targets = [...new Set(result.effectLog.filter(event => event.sequence >= match.nextEventSequence).flatMap(event => event.targets.map(target => target.cardInstanceId)))].filter(id => visible.has(id));
  return { cost, before: getDistrictResults(match), after: getDistrictResults(result), targets };
}
