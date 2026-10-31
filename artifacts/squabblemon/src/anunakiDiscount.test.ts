import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCardInstance, createMatch, getLegalCardCost, getCardCostExplanation, playTurnCard, getEffectiveCardPower, type Lane, type Match, type Owner } from '../../../lib/squabblemon-engine/src/gameEngine';
import { createOnlineRoom, joinOnlineRoom, applyOnlineCommand, onlineRoomView } from '../../../lib/squabblemon-engine/src/multiplayer';
import { decks } from '../../../lib/squabblemon-engine/src/data';

function setup(owner: Owner, tablets: {owner:Owner;lane:Lane}[], motion = 4) {
  const card = createCardInstance('anu', owner, `discount-${owner}`, 0);
  const match: Match = { ...createMatch('block','block'), round: 3, phase: owner === 'player' ? 'player' : 'cpu-reveal',
    playerMotion: motion, cpuMotion: motion, playerHand: owner === 'player' ? [card] : [], cpuHand: owner === 'cpu' ? [card] : [],
    boards: [[], [], []], districtSnapshot: undefined, districtRuntime: undefined, ancientTablets: tablets,
    squabbleByOwner: { player: false, cpu: false } };
  return { match, card };
}
for (const owner of ['player', 'cpu'] as const) {
  test(`Anu pays one tablet for the discount and consumes only remaining tablets on reveal for ${owner}`, () => {
    const enemy = owner === 'player' ? 'cpu' : 'player';
    const {match, card} = setup(owner, [{owner,lane:0},{owner,lane:1},{owner:enemy,lane:2}]);
    const saved = JSON.stringify(match);
    assert.equal(getLegalCardCost(match, owner, card, 1), 4);
    assert.match(getCardCostExplanation(match, owner, card, 1), /−2 Ancient Tablet.*district 2/);
    assert.equal(JSON.stringify(match), saved, 'cost preview does not consume');
    const after = playTurnCard(match, owner, card.instanceId, 1);
    assert.equal(after[owner === 'player' ? 'playerMotion' : 'cpuMotion'], 0);
    assert.equal(getEffectiveCardPower(after.boards[1].find(c => c.instanceId === card.instanceId)!), 11);
    assert.deepEqual(after.ancientTablets, [{owner:enemy,lane:2}]);
    const play = after.effectLog.find(e => e.type === 'play' && e.cardId === 'anu')!;
    assert.equal(play.replay.before.ancientTablets?.length, 3);
    assert.deepEqual(play.replay.after.ancientTablets, [{owner,lane:0},{owner:enemy,lane:2}], 'destination tablet spent before reveal');
    assert.match(play.note, /tablet in district 2.*−2 Motion/i);
  });
  test(`Anu cannot spend an enemy tablet or pay on failed plays for ${owner}`, () => {
    const enemy = owner === 'player' ? 'cpu' : 'player';
    const { match, card } = setup(owner, [{owner:enemy,lane:1}], 4);
    assert.equal(getLegalCardCost(match, owner, card, 0), 6);
    const before = JSON.stringify(match);
    assert.throws(() => playTurnCard(match, owner, card.instanceId, 0), /Not enough Motion/);
    assert.equal(JSON.stringify(match), before);
    const only = setup(owner, [{owner,lane:1}], 4);
    const after = playTurnCard(only.match, owner, only.card.instanceId, 0);
    assert.equal(getEffectiveCardPower(after.boards[0].find(c => c.instanceId === only.card.instanceId)!), 10, 'sole tablet pays cost, then fallback grants +2');
  });
  test(`Anu does not stack discounts or consume a weaker saved discount for ${owner}`, () => {
    const { match, card } = setup(owner, [{owner,lane:0}], 4);
    match.discountTokens = [{id:'kept',owner,sourceInstanceId:'other',eligibility:'any',sourceLane:null,createdOrder:1}];
    assert.equal(getLegalCardCost(match, owner, card, 0), 4);
    const after = playTurnCard(match, owner, card.instanceId, 0);
    assert.equal(after.discountTokens.some(t => t.id === 'kept'), true);
    assert.equal(after[owner === 'player' ? 'playerMotion' : 'cpuMotion'], 0);
  });
  test(`Anu preserves a tablet for reveal when an existing equal discount pays for ${owner}`, () => {
    const { match, card } = setup(owner, [{owner,lane:0}], 4);
    match.discountTokens = [{id:'equal',owner,sourceInstanceId:'other',eligibility:'wiseman-prediction',targetLane:0,sourceLane:null,createdOrder:1}];
    assert.equal(getLegalCardCost(match, owner, card, 0), 4);
    assert.match(getCardCostExplanation(match, owner, card, 0), /Told You/);
    const after = playTurnCard(match, owner, card.instanceId, 0);
    const play = after.effectLog.find(e => e.type === 'play' && e.cardId === 'anu')!;
    assert.deepEqual(play.replay.after.ancientTablets, [{owner,lane:0}]);
    assert.equal(after.discountTokens.some(t => t.id === 'equal'), false);
    assert.equal(getEffectiveCardPower(after.boards[0].find(c => c.instanceId === card.instanceId)!), 11);
  });
}
test('online seat sees discounted cost and public tablet payment', () => {
  const member = (userId: string) => ({userId,name:userId,ready:false,deck:decks[0]});
  let room = joinOnlineRoom(createOnlineRoom(member('a'),'player',0),member('b'),0);
  room = applyOnlineCommand(applyOnlineCommand(room,'player',{type:'ready'},1),'cpu',{type:'ready'},2);
  const {match, card} = setup('player',[{owner:'player',lane:1}],4);
  room = {...room, match, activeSeat:'player'};
  const before = onlineRoomView(room,'TABLET','a',3);
  assert.deepEqual(before.hand[0].costs, [4,4,4]);
  const after = applyOnlineCommand(room,'player',{type:'play',instanceId:card.instanceId,lane:0,squabble:false},4);
  const views = [onlineRoomView(after,'TABLET','a',5), onlineRoomView(after,'TABLET','b',5)];
  assert(views.every(view => view.events.some(e => e.tabletConsumed?.some(t => t.owner === 'player' && t.lane === 1))));
});
