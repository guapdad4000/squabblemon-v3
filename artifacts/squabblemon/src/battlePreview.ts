import { blockbusterExtraCost, canAffordSelection, getDistrictResults, getEffectiveCardPower, getLegalCardCost, playTurnCard, type Match, type Lane } from './gameEngine';

/** Preview only the visible board; private rival draws and the next rival move are excluded. */
export function previewBattlePlay(match: Match, instanceId: string, lane: Lane, squabble = false, investment = 0) {
  const card = match.playerHand.find(card => card.instanceId === instanceId);
  if (!card || match.phase !== 'player' || !canAffordSelection(match, 'player', instanceId, lane)) return null;
  // Random outcomes are revealed only after committing the play.
  if (['the-dice-game','the-shootout','the-cookout'].includes(card.cardId)) return null;
  const cost = getLegalCardCost(match, 'player', card, lane) + blockbusterExtraCost(card.cardId, investment);
  if (cost > match.playerMotion) return null;
  // Replay entries contain whole before/after boards and grow throughout a fade.
  // The engine appends/replaces entries immutably, so retain that history (and
  // every sequence/seed dependency) while isolating the current public state.
  const publicMatch: Match = JSON.parse(JSON.stringify({ ...match, effectLog: [],
    cpuHand: [], cpuCardIds: [], cpuDrawIndex: 0 }));
  publicMatch.effectLog = match.effectLog;
  const result = playTurnCard(publicMatch, 'player', instanceId, lane, squabble, investment);
  const visible = new Set(match.boards.flat().map(card => card.instanceId));
  const targets = [...new Set(result.effectLog.filter(event => event.sequence >= match.nextEventSequence).flatMap(event => event.targets.map(target => target.cardInstanceId)))].filter(id => visible.has(id));
  // Creative abilities may resolve through board changes without explicit event targets.
  const resolvedCards = new Map(result.boards.flat().map(card => [card.instanceId, card]));
  for (const before of match.boards.flat()) {
    const after = resolvedCards.get(before.instanceId);
    if (!after || before.lane !== after.lane || before.owner !== after.owner
      || before.powerModifier !== after.powerModifier || before.basePower !== after.basePower
      || getEffectiveCardPower(before) !== getEffectiveCardPower(after)
      || JSON.stringify(before.statuses) !== JSON.stringify(after.statuses)) {
      if (!targets.includes(before.instanceId)) targets.push(before.instanceId);
    }
  }
  return { cost, before: getDistrictResults(match), after: getDistrictResults(result), targets };
}
