import assert from 'node:assert/strict';
import test from 'node:test';
import { cards, cardCatalog, catalogCardById, validateCardAbilityUpgrades } from './data';
import { STREET_PACK_RARITY_WEIGHTS } from '../../../lib/squabblemon-engine/src/packRules';
import { createMatch, createCardInstance, playTurnCard, getEffectiveCardPower, getCharacterDistrictMarks,
  type Match, type Owner, type Lane, type CardInstance } from './gameEngine';

const blank = (): Match => ({ ...createMatch('block', 'block'), round: 3, playerMotion: 9, cpuMotion: 9,
  boards: [[], [], []], playerHand: [], cpuHand: [] });
const unit = (id: string, owner: Owner, lane: Lane, index = 0): CardInstance => ({
  ...createCardInstance(id, owner, 'test', index), lane,
});
const find = (m: Match, id: string) => m.boards.flat().find(c => c.cardId === id)!;

function cast(m: Match, id: string, lane: Lane, owner: Owner = 'player') {
  const source = createCardInstance(id, owner, 'cast', m.round * 10 + lane);
  return playTurnCard({ ...m, phase: owner === 'player' ? 'player' : 'cpu-reveal',
    [owner === 'player' ? 'playerHand' : 'cpuHand']: [source] }, owner, source.instanceId, lane);
}

test('the Triple OG set ships as a complete, pullable catalog wave', () => {
  validateCardAbilityUpgrades();
  const expected: Record<string, [string, string, number, number]> = {
    'triple-og-blue': ['CLUE COOKY', 'Mythical', 4, 6],
    'triple-og-red': ['RED PUNCH', 'Mythical', 4, 3],
    initiation: ['INITIATION', 'Legendary', 1, 0],
    'block-spinner': ['BLOCK SPINNER', 'Epic', 1, 2],
    'look-out': ['LOOK OUT', 'Epic', 1, 2],
  };
  for (const [id, [name, rarity, cost, power]] of Object.entries(expected)) {
    const card = catalogCardById[id];
    assert.equal(card.name, name, id);
    assert.equal(card.rarity, rarity, id);
    assert.deepEqual([card.cost, card.power], [cost, power], id);
    assert.equal(card.faction, 'Triple OGs', id);
    assert.equal(card.artworkId, id);
    assert.equal(card.abilityUpgrades.length, 3, id);
    // Regular gacha: nothing in this set is locked behind story rewards.
    assert(card.acquisitionSources.includes('Street Packs'), `${id} must stay pullable`);
    assert(STREET_PACK_RARITY_WEIGHTS[card.rarity] > 0, `${id} rarity must be pullable`);
  }
  assert.equal(cardCatalog.filter(card => card.faction === 'Triple OGs').length, 5);
});

test('each Triple OG only sets up on their own side of the board', () => {
  const m = blank();
  assert.throws(() => cast(m, 'triple-og-blue', 1), /left district/);
  assert.throws(() => cast(m, 'triple-og-blue', 2), /left district/);
  assert.throws(() => cast(m, 'triple-og-red', 0), /right district/);
  assert.throws(() => cast(m, 'triple-og-red', 1), /right district/);
  assert.equal(find(cast(m, 'triple-og-blue', 0), 'triple-og-blue').lane, 0);
  assert.equal(find(cast(m, 'triple-og-red', 2), 'triple-og-red').lane, 2);
});

test('CLUE COOKY collects homage only while losing, and never loses Hands', () => {
  const held = blank();
  held.boards[0] = [unit('hooper', 'player', 0, 1)];
  held.boards[1] = [unit('hooper', 'player', 1, 2)];
  const notLosing = cast(held, 'triple-og-blue', 0);
  assert.equal(getEffectiveCardPower(find(notLosing, 'triple-og-blue')), 6, 'no homage is owed when the district is held');
  assert.equal(getEffectiveCardPower(notLosing.boards[1][0]), 5);

  const losing = blank();
  losing.boards[0] = [unit('hooper', 'player', 0, 1), unit('oink', 'cpu', 0, 2), unit('snow', 'cpu', 0, 3)];
  losing.boards[1] = [unit('hooper', 'player', 1, 4)];
  losing.boards[0][1].powerModifier = 20;
  const paid = cast(losing, 'triple-og-blue', 0);
  const cooky = find(paid, 'triple-og-blue');
  assert.equal(getEffectiveCardPower(cooky), 8, 'both allies paid 1 Hand each');
  assert.equal(getEffectiveCardPower(paid.boards.flat().find(c => c.owner === 'player' && c.cardId === 'hooper' && c.lane === 1)!), 4);
  // The weakest enemy is pushed into the district the player is strongest in, with -1 Hand.
  const pushed = paid.boards.flat().find(c => c.cardId === 'snow')!;
  assert.notEqual(pushed.lane, 0);
  assert.equal(getEffectiveCardPower(pushed), 1, 'the weakest enemy left with -1 Hand');

  const hit = { ...paid, boards: paid.boards.map(l => [...l]) as Match['boards'] };
  const after = cast(hit, 'roaster', 0, 'cpu');
  assert.equal(getEffectiveCardPower(find(after, 'triple-og-blue')), 8, 'CLUE COOKY cannot lose Hands');
});

test('RED PUNCH taxes his own district and moves anyone he cannot touch', () => {
  const m = blank();
  m.boards[2] = [unit('hooper', 'player', 2, 1), unit('oink', 'cpu', 2, 2), unit('cornball', 'cpu', 2, 3)];
  m.boards[2][0].statuses.protected = true;
  const after = cast(m, 'triple-og-red', 2);
  const punch = find(after, 'triple-og-red');
  assert.equal(getEffectiveCardPower(punch), 5, 'gained one Hand per card actually weakened');
  assert.equal(getEffectiveCardPower(after.boards.flat().find(c => c.cardId === 'oink')!), 5);
  const respected = after.boards.flat().find(c => c.cardId === 'hooper')!;
  assert.notEqual(respected.lane, 2, 'the protected ally was moved out of respect');
  assert.equal(getEffectiveCardPower(respected), 5, 'the moved ally kept every Hand');
});

test('a silenced Triple OG still answers roll call', () => {
  const m = blank();
  m.boards[2] = [unit('oink', 'cpu', 2, 2)];
  const source = createCardInstance('triple-og-red', 'player', 'cast', 7);
  source.statuses.silenced = true;
  const after = playTurnCard({ ...m, phase: 'player', playerHand: [source] }, 'player', source.instanceId, 2);
  assert.equal(getEffectiveCardPower(find(after, 'triple-og-red')), 4);
  assert.equal(getEffectiveCardPower(after.boards.flat().find(c => c.cardId === 'oink')!), 5);
});

test('INITIATION puts the next character on with the set already in the district', () => {
  const m = blank();
  m.boards[1] = [unit('triple-og-blue', 'player', 1, 1)];
  const marked = cast(m, 'initiation', 1);
  assert(getCharacterDistrictMarks(marked).some(mark => mark.lane === 1 && /Marked Territory/.test(mark.text)));
  const joined = cast(marked, 'cornball', 1);
  const recruit = joined.boards.flat().find(c => c.cardId === 'cornball')!;
  assert.equal(recruit.gangTag, 'blue');
  assert.equal(getEffectiveCardPower(recruit), 2, 'the initiate gained +1 Hand');
  // The mark is spent, so the next card joins nothing.
  const next = cast(joined, 'plug', 1);
  const second = next.boards.flat().find(c => c.cardId === 'plug')!;
  assert.equal(second.gangTag, undefined);
  assert.equal(getEffectiveCardPower(second), 2);

  const unclaimed = cast(cast(blank(), 'initiation', 0), 'cornball', 0);
  const founder = unclaimed.boards.flat().find(c => c.cardId === 'cornball')!;
  assert.equal(founder.gangTag, undefined);
  assert.equal(getEffectiveCardPower(founder), 2, 'with no set here the initiate still gains +1 Hand');
});

test('BLOCK SPINNER burns an enemy here and the next enemy played here', () => {
  const m = blank();
  m.boards[0] = [unit('oink', 'cpu', 0, 1)];
  const spun = cast(m, 'block-spinner', 0);
  assert.equal(spun.boards.flat().find(c => c.cardId === 'oink')!.statuses.burnStacks, 1);
  assert(getCharacterDistrictMarks(spun).some(mark => mark.lane === 0 && /Spinning/.test(mark.text)));
  const caught = cast(spun, 'cornball', 0, 'cpu');
  assert.equal(caught.boards.flat().find(c => c.cardId === 'cornball')!.statuses.burnStacks, 1);
  // The trap is single use.
  const later = cast(caught, 'plug', 0, 'cpu');
  assert.equal(later.boards.flat().find(c => c.cardId === 'plug')!.statuses.burnStacks, 0);
});

test('LOOK OUT discounts your next card in the district the opponent walked into', () => {
  const watching = cast(blank(), 'look-out', 1);
  assert.equal(find(watching, 'look-out').lookoutReady, true);
  const called = cast(watching, 'oink', 2, 'cpu');
  assert.equal(find(called, 'look-out').lookoutReady, false);
  const motionBefore = called.playerMotion;
  const discounted = cast(called, 'hooper', 2);
  assert.equal(motionBefore - discounted.playerMotion, cards.hooper.cost - 1, 'the called district costs 1 less Motion');
  // Only the called district is discounted, and only once.
  const again = cast(discounted, 'snow', 2);
  assert.equal(discounted.playerMotion - again.playerMotion, cards.snow.cost);
});

test('Roll Call removes a 1-Hand ally instead of leaving it at zero, and replays continuously', () => {
  const m = blank();
  m.boards[2] = [unit('cornball', 'player', 2, 1), unit('oink', 'cpu', 2, 2)];
  const after = cast(m, 'triple-og-red', 2);
  assert.equal(after.boards.flat().some(c => c.cardId === 'cornball'), false,
    'a 1-Hand ally that pays roll call leaves the board like any other defeated card');
  assert.equal(getEffectiveCardPower(find(after, 'triple-og-red')), 5, 'both the ally and the enemy paid');
});

test('a Triple OG reveal that moves someone leaves no discontinuous replay frame', () => {
  const m = blank();
  m.boards[2] = [unit('hooper', 'player', 2, 1), unit('oink', 'cpu', 2, 2)];
  m.boards[2][0].statuses.protected = true;
  const after = cast(m, 'triple-og-red', 2);
  const frames = after.effectLog.filter(entry => entry.cardId === 'triple-og-red');
  assert(frames.length >= 2, 'the forced move and the roll call are separate frames');
  for (let i = 1; i < frames.length; i += 1) {
    assert.deepEqual(frames[i].replay.before, frames[i - 1].replay.after,
      'each frame must start where the previous one ended so playback never jumps');
  }
});
