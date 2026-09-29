import assert from 'node:assert/strict';
import test from 'node:test';
import { cards } from './data';
import { createCardInstance, createMatch, DISTRICT_CATALOG, getCharacterDistrictMarks, playTurnCard, type CardInstance, type DistrictSnapshot, type Lane, type Match, type Owner } from './gameEngine';

const rival = (owner: Owner): Owner => owner === 'player' ? 'cpu' : 'player';
const inHand = (owner: Owner): 'playerHand' | 'cpuHand' => owner === 'player' ? 'playerHand' : 'cpuHand';
const phaseFor = (owner: Owner): Match['phase'] => owner === 'player' ? 'player' : 'cpu-reveal';
const unit = (id: string, owner: Owner, lane: Lane, index: number): CardInstance => ({
  ...createCardInstance(id, owner, 'dark-lanes', index), lane,
});
const blank = (owner: Owner): Match => ({
  ...createMatch('block', 'block'), round: 2, phase: phaseFor(owner),
  boards: [[], [], []], playerHand: [], cpuHand: [], playerMotion: 9, cpuMotion: 9,
});
const find = (m: Match, card: CardInstance): CardInstance | undefined =>
  m.boards.flat().find(c => c.instanceId === card.instanceId);
const cast = (m: Match, owner: Owner, id: string, lane: Lane, index: number) => {
  const card = createCardInstance(id, owner, 'dark-lanes', index);
  const ready = { ...m, phase: phaseFor(owner), [inHand(owner)]: [card], playerMotion: 9, cpuMotion: 9 };
  return { card, after: playTurnCard(ready, owner, card.instanceId, lane) };
};

for (const owner of ['player', 'cpu'] as const) {
  test(`Hater costs 1 Motion and has 2 printed Hands for ${owner}`, () => {
    assert.deepEqual([cards.hater.cost, cards.hater.power], [1, 2]);
    const card = createCardInstance('hater', owner, 'dark-lanes', 1);
    const motion = owner === 'player' ? 'playerMotion' : 'cpuMotion';
    const ready = { ...blank(owner), [inHand(owner)]: [card], playerMotion: 1, cpuMotion: 1 };
    const after = playTurnCard(ready, owner, card.instanceId, 0);
    assert.equal(after[motion], 0);
    assert.equal(find(after, card)?.basePower, 2);
  });

  test(`Goth Kid relocates, ignores allies and Silences the first enemy before On Reveal for ${owner}`, () => {
    const { card: goth, after: armed } = cast(blank(owner), owner, 'gothkid', 0, 1);
    assert.equal(find(armed, goth)?.lane, 1);
    assert.deepEqual(armed.districtTraps?.map(trap => [trap.kind, trap.lane]), [['dead-air', 1]]);
    const mark = getCharacterDistrictMarks(armed).find(item => item.owner === owner && item.lane === 1 && item.text.startsWith('Dead Air'));
    assert.match(mark?.text ?? '', /first enemy played or moved here: Silence/);
    assert.doesNotMatch(mark?.text ?? '', /Motion/);
    const { after: friendly } = cast(armed, owner, 'scarecrow', 1, 2);
    assert.equal(friendly.districtTraps?.length, 1, 'a friendly arrival never consumes Dead Air');
    const { card: enemy, after: intercepted } = cast(friendly, rival(owner), 'scarecrow', 1, 3);
    assert.equal(find(intercepted, enemy)?.lane, 1, 'its own entrance movement was stopped');
    assert.equal(find(intercepted, enemy)?.powerModifier, 0);
    assert.equal(find(intercepted, enemy)?.statuses.silenced, true);
    assert.equal(intercepted.districtTraps?.length, 0, 'only the first enemy is caught');
    const playIndex = intercepted.effectLog.findIndex(event => event.cardInstanceId === enemy.instanceId && event.type === 'play');
    const trapIndex = intercepted.effectLog.findIndex(event => event.note.startsWith('Dead Air Silenced'));
    const revealIndex = intercepted.effectLog.findIndex(event => event.cardInstanceId === enemy.instanceId && event.type === 'reveal');
    assert(playIndex >= 0 && trapIndex > playIndex && revealIndex > trapIndex, 'Silence occurs before the enemy reveal');
    assert.equal(intercepted.effectLog[trapIndex].replay.before.districtTraps?.length, 1);
    assert.equal(intercepted.effectLog[trapIndex].replay.after.districtTraps?.length, 0);
  });

  test(`Goth Kid Silences a moving enemy and disarms when he leaves for ${owner}`, () => {
    const { card: goth, after: armed } = cast(blank(owner), owner, 'gothkid', 0, 11);
    const { card: mover, after: intercepted } = cast(armed, rival(owner), 'bikelife', 0, 12);
    assert.equal(find(intercepted, mover)?.lane, 1, 'Ride Out moved into the trapped district');
    assert.equal(find(intercepted, mover)?.statuses.silenced, true);
    assert.equal(find(intercepted, mover)?.powerModifier, 0, 'Silence interrupts the remaining +1 Hand from Ride Out');
    assert.equal(intercepted.districtTraps?.length, 0);
    const moveEvent = intercepted.effectLog.find(event => event.cardInstanceId === mover.instanceId
      && event.kind === 'move' && event.note.includes('moved into district'));
    const trapEvent = intercepted.effectLog.find(event => event.note.startsWith('Dead Air Silenced'));
    assert(moveEvent && trapEvent && moveEvent.sequence < trapEvent.sequence);
    assert.equal(moveEvent.replay.before.boards[0].some(c => c.instanceId === mover.instanceId), true);
    assert.equal(moveEvent.replay.after.boards[1].some(c => c.instanceId === mover.instanceId), true);
    assert.deepEqual(moveEvent.replay.after.boards, trapEvent.replay.before.boards, 'the trap follows the move without a replay gap');
    const { after: unarmed } = cast(armed, owner, 'vibe', 0, 13);
    assert.equal(find(unarmed, goth)?.lane, 0, 'Wave Check moved Goth Kid out of his district');
    assert.equal(unarmed.districtTraps?.length, 0);
    assert(!getCharacterDistrictMarks(unarmed).some(item => item.text.startsWith('Dead Air')));
  });

  test(`Dead Air and THE TRAP preserve complete replay continuity for ${owner}`, () => {
    const snapshot: DistrictSnapshot = {
      version: 1,
      locations: (['time-square', 'the-trap', 'magic-city'] as const)
        .map(id => ({ ...DISTRICT_CATALOG.find(district => district.id === id)! })) as DistrictSnapshot['locations'],
    };
    const base = createMatch('block', 'block', undefined, undefined, snapshot);
    const ready: Match = { ...base, round: 2, phase: phaseFor(owner), boards: [[], [], []],
      playerHand: [], cpuHand: [], playerMotion: 9, cpuMotion: 9 };
    const { after: armed } = cast(ready, owner, 'gothkid', 0, 31);
    const { card: mover, after } = cast(armed, rival(owner), 'bikelife', 0, 32);
    const moveIndex = after.effectLog.findIndex(event => event.cardInstanceId === mover.instanceId
      && event.kind === 'move' && event.note.includes('moved into district'));
    assert(moveIndex > 0);
    const moved = after.effectLog[moveIndex], previous = after.effectLog[moveIndex - 1], trapped = after.effectLog[moveIndex + 1];
    assert.equal(trapped.note.startsWith('Dead Air'), true);
    assert.deepEqual(previous.replay.after.boards, moved.replay.before.boards, 'movement starts from the previous board');
    assert.deepEqual(previous.replay.after.districtRuntime, moved.replay.before.districtRuntime,
      'THE TRAP has not been consumed before the movement event starts');
    assert.deepEqual(moved.replay.after, trapped.replay.before, 'trap starts where movement ended');
    assert(!moved.replay.before.districtRuntime?.trappedCardIds.includes(mover.instanceId));
    assert(moved.replay.after.districtRuntime?.trappedCardIds.includes(mover.instanceId));
    assert.equal(find(after, mover)?.statuses.silenced, true);
    assert.equal(find(after, mover)?.powerModifier, 2, 'THE TRAP bonus applies, but Ride Out does not add another Hand');
  });

  test(`Goth Kid keeps his old Silence when no district is empty for ${owner}`, () => {
    const other = rival(owner);
    const m = blank(owner);
    m.boards = [[unit('scarecrow', other, 0, 21)], [unit('hooper', other, 1, 22)], [unit('hooper', other, 2, 23)]];
    const { card: goth, after } = cast(m, owner, 'gothkid', 0, 24);
    assert.equal(find(after, goth)?.lane, 0);
    assert.equal(find(after, m.boards[0][0])?.statuses.silenced, true);
    assert.equal(after.districtTraps?.length, 0);
  });
}