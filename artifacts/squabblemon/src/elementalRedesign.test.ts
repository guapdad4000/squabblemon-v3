import assert from 'node:assert/strict';
import test from 'node:test';
import { cards } from './data';
import { createMatch, createCardInstance, playCard, suppressMatchPresentationEvents, type Match, type CardInstance, type Owner, type Lane } from './gameEngine';

const unit = (id: string, owner: Owner, lane: Lane, n: number, power = 10): CardInstance =>
  ({ ...createCardInstance(id, owner, 'redesign', n), lane, basePower: power, power });
const find = (m: Match, c: CardInstance) => m.boards.flat().find(x => x.instanceId === c.instanceId)!;
const blank = (): Match => ({ ...createMatch('block', 'combo'), round: 3, playerMotion: 9, cpuMotion: 9,
  playerHand: [], cpuHand: [], boards: [[], [], []] });
function cast(m: Match, id: string, owner: Owner = 'player', motion = 9, locked = false) {
  const source = createCardInstance(id, owner, 'source', 99);
  source.statuses.locked = locked;
  return { source, after: playCard({ ...m, phase: owner === 'player' ? 'player' : 'cpu-reveal',
    [owner === 'player' ? 'playerMotion' : 'cpuMotion']: motion,
    [owner === 'player' ? 'playerHand' : 'cpuHand']: [source] }, owner, source.instanceId, 0) };
}
for (const owner of ['player', 'cpu'] as const) {
  const enemy: Owner = owner === 'player' ? 'cpu' : 'player';
  const motionKey = owner === 'player' ? 'playerMotion' : 'cpuMotion';
  test(`Gator Boy rewards landed bites, not shields: ${owner}`, () => {
    for (const protectedHit of [true, false]) {
      const m = blank(), foe = unit('cornball', enemy, 0, 1);
      if (protectedHit) {
        foe.statuses.protected = true;
        m.timedEffects.push({ id: 'shield', kind: 'church-protection', owner: enemy,
          sourceInstanceId: foe.instanceId, targetInstanceId: foe.instanceId, lane: 0,
          startsAtRound: 1, expiresAtRound: 7, expiration: 'match-complete' });
      }
      m.boards[0] = [foe];
      const { after, source } = cast(m, 'riptidebruiser', owner);
      assert.equal(find(after, foe).powerModifier, protectedHit ? 0 : -1);
      assert.equal(find(after, source).powerModifier, protectedHit ? 0 : 1);
    }
  });
  test(`Hottie cleanses and Matcha branches on Motion after payment: ${owner}`, () => {
    const m = blank(), ally = unit('cornball', owner, 0, 1);
    ally.statuses.frozen = true; m.boards[0] = [ally];
    const hottie = cast(m, 'stillwatermedic', owner);
    assert.equal(find(hottie.after, ally).statuses.frozen, false);
    assert.equal(find(hottie.after, ally).powerModifier, 1);
    assert.equal(find(hottie.after, hottie.source).powerModifier, 1);
    const high = cast(m, 'rootnurse', owner, 6);
    assert.equal(find(high.after, high.source).powerModifier, 2);
    assert.equal(find(high.after, ally).statuses.frozen, true);
    const low = cast(m, 'rootnurse', owner, 5);
    assert.equal(find(low.after, low.source).powerModifier, 0);
    assert.equal(find(low.after, ally).statuses.frozen, false);
  });
  test(`Energy crash pays its cost and Developer only repairs damaged remote allies: ${owner}`, () => {
    const energy = cast(blank(), 'rainmaker', owner);
    assert.equal(energy.after[motionKey], 8);
    assert.equal(find(energy.after, energy.source).powerModifier, -2);
    for (const damaged of [false, true]) {
      const m = blank(), ally = unit('cornball', owner, 1, 1);
      ally.powerModifier = damaged ? -2 : 0; m.boards[1] = [ally];
      const dev = cast(m, 'batteryback', owner);
      assert.equal(find(dev.after, ally).powerModifier, damaged ? -1 : 0);
      assert.equal(dev.after[motionKey], damaged ? 9 : 8);
    }
  });
  test(`EV respects solo parking and Salesman anchors discount to his new lane: ${owner}`, () => {
    const solo = cast(blank(), 'wiretap', owner);
    assert.equal(solo.after[motionKey], 8);
    const m = blank(); m.boards[0] = [unit('cornball', owner, 0, 1)];
    assert.equal(cast(m, 'wiretap', owner).after[motionKey], 7);
    const moved = cast(blank(), 'livewire', owner);
    const newLane = find(moved.after, moved.source).lane;
    assert.notEqual(newLane, 0);
    assert.equal(moved.after.discountTokens[0].sourceLane, newLane);
    const blocked = cast(blank(), 'livewire', owner, 9, true);
    assert.equal(find(blocked.after, blocked.source).lane, 0);
    assert.equal(blocked.after.discountTokens.length, 0);
    assert.equal(find(blocked.after, blocked.source).powerModifier, 0);
  });
  test(`OG Vegan shares with Plant, Gus reaches across lanes: ${owner}`, () => {
    for (const plant of [false, true]) {
      const m = blank(), ally = unit(plant ? 'rastamon' : 'cornball', owner, 0, 1);
      m.boards[0] = [ally];
      const vegan = cast(m, 'sprout', owner);
      assert.equal(find(vegan.after, ally).powerModifier, plant ? 1 : 0);
      assert.equal(find(vegan.after, vegan.source).powerModifier, plant ? 1 : 0);
    }
    const m = blank(), ally = unit('cornball', owner, 0, 1), local = unit('cornball', enemy, 0, 2, 20), remote = unit('cornball', enemy, 2, 3);
    m.boards = [[ally, local], [], [remote]];
    const gus = cast(m, 'gardenwall', owner);
    assert.equal(find(gus.after, local).powerModifier, 0);
    assert.equal(find(gus.after, remote).powerModifier, -2);
    assert.equal(find(gus.after, ally).powerModifier, 1);
  });
  test(`Pigeon robs only after moving and Model buffs the person left behind: ${owner}`, () => {
    const m = blank(), ally = unit('cornball', owner, 0, 1), foe = unit('cornball', enemy, 1, 2);
    m.boards = [[ally], [foe], []];
    const pigeon = cast(m, 'gust', owner);
    assert.equal(find(pigeon.after, pigeon.source).lane, 1);
    assert.equal(find(pigeon.after, foe).powerModifier, -1);
    assert.equal(find(cast(m, 'gust', owner, 9, true).after, foe).powerModifier, 0);
    const model = cast(m, 'cloudbreak', owner);
    assert.equal(find(model.after, ally).powerModifier, 2);
    assert.equal(find(model.after, model.source).lane, 1);
    assert.equal(find(cast(m, 'cloudbreak', owner, 9, true).after, ally).powerModifier, 0);
  });
  test(`Baby disperses a neighbor and Sushi weakens a rival: ${owner}`, () => {
    const m = blank(), ally = unit('cornball', owner, 0, 1), foe = unit('cornball', enemy, 0, 2);
    m.boards[0] = [ally, foe];
    const baby = cast(m, 'crosswind', owner);
    assert.equal(find(baby.after, foe).statuses.weakened, true);
    assert.notEqual(find(baby.after, ally).lane, 0);
    assert.equal(find(cast(m, 'monsoonanchor', owner).after, foe).statuses.weakened, true);
  });
}
test('new identities preserve catalog keys and AI search resolves the same mechanics', () => {
  const names = ['Gator Boy', 'Hot Tub Hottie', 'Gas Station Sushi Chef', 'Energy Drink Freak', 'Game Developer', 'Electrician Foreman', 'E.V. Enthusiast', 'Dominican Phone Salesman', 'OG Vegan', 'Matcha Freak', 'Performative Male', 'A Spare Gus', 'Big City Pigeon', 'Baby Crying on an Airplane', 'The Flight Plug', 'Airheaded Model'];
  const ids = ['riptidebruiser','stillwatermedic','monsoonanchor','rainmaker','batteryback','circuitcaptain','wiretap','livewire','sprout','rootnurse','canopykeeper','gardenwall','gust','crosswind','slipstream','cloudbreak'];
  ids.forEach((id, i) => {
    assert.equal(cards[id].name, names[i]);
    const m = blank(); m.boards[0] = [unit('cornball','player',0,1),unit('cornball','cpu',0,2)];
    const visible = cast(m,id).after, fast = cast(suppressMatchPresentationEvents(m),id).after;
    assert.deepEqual(fast.boards,visible.boards); assert.deepEqual(fast.discountTokens,visible.discountTokens);
    assert.equal(fast.playerMotion,visible.playerMotion);
  });
});
