import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCardInstance, createMatch, getEffectiveCardPower, playTurnCard, type Lane, type Match, type Owner } from '../../../lib/squabblemon-engine/src/gameEngine';
import { anunakiCards } from '../../../lib/squabblemon-engine/src/anunakiWave';

const unit = (id: string, owner: Owner, lane: Lane, index: number) => ({ ...createCardInstance(id, owner, 'ninh-test', index), lane });
const blank = (): Match => ({ ...createMatch('block', 'block'), round: 3, playerMotion: 12, cpuMotion: 12,
  playerHand: [], cpuHand: [], boards: [[], [], []], districtSnapshot: undefined, districtRuntime: undefined,
  squabbleByOwner: { player: false, cpu: false } });
function cast(match: Match, id: string, owner: Owner, lane: Lane) {
  const card = createCardInstance(id, owner, 'ninh-cast', match.nextEventSequence);
  const after = playTurnCard({ ...match, phase: owner === 'player' ? 'player' : 'cpu-reveal',
    [owner === 'player' ? 'playerHand' : 'cpuHand']: [card] }, owner, card.instanceId, lane);
  return { after, card };
}
const cardById = (match: Match, id: string) => match.boards.flat().find(card => card.instanceId === id)!;

for (const owner of ['player', 'cpu'] as const) {
  const opponent = owner === 'player' ? 'cpu' : 'player';
  test(`Ninhursag costs 2/3 and places a tablet without an immediate ally buff for ${owner}`, () => {
    assert.equal(anunakiCards.ninhursag.cost, 2);
    assert.equal(anunakiCards.ninhursag.power, 3);
    const setup = blank(), ally = unit('buddy', owner, 0, 1); setup.boards[0] = [ally];
    const { after, card } = cast(setup, 'ninhursag', owner, 0);
    assert.equal(getEffectiveCardPower(cardById(after, card.instanceId)), 3);
    assert.equal(getEffectiveCardPower(cardById(after, ally.instanceId)), getEffectiveCardPower(ally));
    assert.deepEqual(after.ancientTablets, [{owner,lane:0}]);
  });
  test(`Ninhursag reacts once per friendly tablet and cleanses debuffed allies for ${owner}`, () => {
    const setup = blank();
    const maker = unit('ninhursag', owner, 0, 1), second = unit('ninhursag', owner, 0, 2);
    const other = unit('ninhursag', owner, 1, 3), enemyMaker = unit('ninhursag', opponent, 0, 4);
    const ally = unit('buddy', owner, 0, 5);
    ally.statuses = { ...ally.statuses, frozen: true, silenced: true, weakened: true, locked: true, burnStacks: 2 };
    const enemy = unit('buddy', opponent, 0, 6); enemy.statuses = {...enemy.statuses, frozen: true};
    setup.boards[0] = [maker,second,enemyMaker,ally,enemy]; setup.boards[1] = [other];
    setup.ancientTablets = [{owner,lane:0},{owner:opponent,lane:0}];
    const {after} = cast(setup, 'inanna', owner, 0);
    assert.equal(getEffectiveCardPower(cardById(after,maker.instanceId)), 5);
    assert.equal(getEffectiveCardPower(cardById(after,second.instanceId)), 5);
    assert.equal(getEffectiveCardPower(cardById(after,other.instanceId)), 3);
    assert.equal(getEffectiveCardPower(cardById(after,enemyMaker.instanceId)), 3);
    const statuses = cardById(after,ally.instanceId).statuses;
    assert.equal(statuses.frozen, false); assert.equal(statuses.silenced, false); assert.equal(statuses.weakened, false);
    assert.equal(statuses.locked, false); assert.equal(statuses.burnStacks, 0);
    assert.equal(cardById(after,enemy.instanceId).statuses.frozen, true);
    assert.deepEqual(after.ancientTablets, [{owner:opponent,lane:0}]);
    const consumption = after.effectLog.find(e => e.note === 'Consumed an Ancient Tablet.')!;
    const reactions = after.effectLog.filter(e => e.note.includes('The Maker’s Touch: consumed Tablet gave'));
    assert.equal(reactions.length, 2);
    assert.deepEqual(reactions[0].replay.before.ancientTablets, consumption.replay.after.ancientTablets);
    assert.equal(cardById({...after,...reactions[0].replay.before},maker.instanceId).powerModifier, 0);
    assert.equal(cardById({...after,...reactions[0].replay.after},maker.instanceId).powerModifier, 2);
    assert.deepEqual(reactions[1].replay.before.boards, reactions[0].replay.after.boards);
  });
  test(`Anu tablet cost and reveal each trigger the correct lane for ${owner}`, () => {
    const setup = blank();
    const one = unit('ninhursag',owner,0,1), two = unit('ninhursag',owner,1,2), enemy = unit('ninhursag',opponent,2,3);
    setup.boards[0] = [one]; setup.boards[1] = [two]; setup.boards[2] = [enemy];
    setup.ancientTablets = [{owner,lane:0},{owner,lane:1},{owner:opponent,lane:2}];
    const {after} = cast(setup, 'anu', owner, 0);
    assert.equal(getEffectiveCardPower(cardById(after,one.instanceId)), 5);
    assert.equal(getEffectiveCardPower(cardById(after,two.instanceId)), 5);
    assert.equal(getEffectiveCardPower(cardById(after,enemy.instanceId)), 3);
    const events = after.effectLog.filter(e => e.note.includes('The Maker’s Touch: consumed Tablet gave'));
    assert.equal(events.length, 2);
    assert.equal(events[0].lane, 0); assert.equal(events[1].lane, 1);
    assert.deepEqual(after.ancientTablets, [{owner:opponent,lane:2}]);
  });
  test(`disabled Ninhursag and absent tablets do not react for ${owner}`, () => {
    const setup = blank(), maker = unit('ninhursag',owner,0,1);
    maker.statuses = {...maker.statuses,silenced:true};
    setup.boards[0] = [maker]; setup.ancientTablets = [{owner,lane:0}];
    const spent = cast(setup,'inanna',owner,0).after;
    assert.equal(cardById(spent,maker.instanceId).powerModifier, 0);
    assert.equal(spent.effectLog.filter(e => e.note.includes('The Maker’s Touch: consumed Tablet gave')).length, 0);
    const missing = blank(), active = unit('ninhursag',owner,0,2); missing.boards[0] = [active];
    const fallback = cast(missing,'inanna',owner,0).after;
    assert.equal(cardById(fallback,active.instanceId).powerModifier, 0);
  });
}
