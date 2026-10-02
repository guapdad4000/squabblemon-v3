import assert from 'node:assert/strict';
import test from 'node:test';
import { cards } from './data';
import { createMatch, createCardInstance, getLegalCardCost, playCard, suppressMatchPresentationEvents, type Match, type CardInstance, type Owner, type Lane } from './gameEngine';

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
  test(`EV has no instant refund and Salesman anchors discount to his new lane: ${owner}`, () => {
    const solo = cast(blank(), 'wiretap', owner);
    assert.equal(solo.after[motionKey], 7);
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
  test(`Salesman rewards only the successful discounted cross-district play: ${owner}`, () => {
    const moved = cast(blank(), 'livewire', owner);
    const wire = find(moved.after, moved.source);
    assert.notEqual(wire.lane, null);
    const destination = wire.lane === 0 ? 1 : 0;
    const sameLaneCard = createCardInstance('cornball', owner, 'same-lane-discount-test', 9);
    const sameLaneState = { ...moved.after, phase: owner === 'player' ? 'player' as const : 'cpu-reveal' as const,
      [owner === 'player' ? 'playerMotion' : 'cpuMotion']: 9,
      [owner === 'player' ? 'playerHand' : 'cpuHand']: [sameLaneCard] };
    const sameLane = playCard(sameLaneState, owner, sameLaneCard.instanceId, wire.lane!);
    assert.equal(find(sameLane, sameLaneCard).powerModifier, 0);
    assert(sameLane.discountTokens.some(token => token.eligibility === 'livewire-cross-district'));

    const nextCard = createCardInstance('cornball', owner, 'discount-test', 10);
    const handKey = owner === 'player' ? 'playerHand' : 'cpuHand';
    const playState = { ...JSON.parse(JSON.stringify(moved.after)) as Match,
      phase: owner === 'player' ? 'player' as const : 'cpu-reveal' as const,
      [owner === 'player' ? 'playerMotion' : 'cpuMotion']: 9,
      [handKey]: [nextCard] };
    assert.equal(getLegalCardCost(playState, owner, nextCard, destination), 0);
    const discounted = playCard(playState, owner, nextCard.instanceId, destination);
    assert.equal(find(discounted, nextCard).powerModifier, 1);
    assert.equal(discounted.discountTokens.some(token => token.eligibility === 'livewire-cross-district'), false);
    assert(discounted.effectLog.some(event => event.note.includes('discounted character +1 Hand on placement')));

    const demon = unit('bbldemon', enemy, destination, 12);
    const fragile = createCardInstance('rastamon', owner, 'hostile-discount-test', 13);
    const hostileState: Match = { ...JSON.parse(JSON.stringify(moved.after)) as Match,
      phase: owner === 'player' ? 'player' : 'cpu-reveal',
      boards: moved.after.boards.map((lane, index) => index === destination ? [...lane, demon] : lane) as Match['boards'],
      creativeMarks: [{ id: 'drama:hostile-discount', kind: 'drama', source: demon,
        owner: enemy, lane: destination, targets: [], expires: 99 }],
      [motionKey]: 9, [handKey]: [fragile] };
    const survivesDrama = playCard(hostileState, owner, fragile.instanceId, destination);
    assert.equal(find(survivesDrama, fragile).powerModifier, -1,
      'the +1 placement reward lets a 2-Hand character survive the 2-damage arrival trap');
    const rewardEvent = survivesDrama.effectLog.find(event => event.note.includes('discounted character +1 Hand on placement'))!;
    assert.equal(rewardEvent.replay.before.boards.flat().find(c => c.instanceId === fragile.instanceId)?.powerModifier, 0);
    assert.equal(rewardEvent.replay.after.boards.flat().find(c => c.instanceId === fragile.instanceId)?.powerModifier, 1);
    assert(survivesDrama.effectLog.some(event => event.note.includes('Problem Energy')),
      'the hostile arrival hit still resolves');

    const supportCard = createCardInstance('energydrink', owner, 'support-discount-test', 11);
    const supportState = { ...JSON.parse(JSON.stringify(moved.after)) as Match,
      phase: owner === 'player' ? 'player' as const : 'cpu-reveal' as const,
      [owner === 'player' ? 'playerMotion' : 'cpuMotion']: 9,
      [handKey]: [supportCard] };
    assert.equal(getLegalCardCost(supportState, owner, supportCard, destination), 0);
    const supportPlayed = playCard(supportState, owner, supportCard.instanceId, destination);
    assert.equal(find(supportPlayed, supportCard).kind, 'support');
    assert.equal(find(supportPlayed, supportCard).powerModifier, 0);
    assert.equal(supportPlayed.discountTokens.some(token => token.eligibility === 'livewire-cross-district'), false,
      'support cards can spend the cross-district discount');
    assert.equal(supportPlayed.effectLog.some(event => event.note.includes('discounted cross-district card +1 Hand')), false);

    const plug = cast(blank(), 'plug', owner).after;
    const ordinaryToken = { ...plug, phase: owner === 'player' ? 'player' as const : 'cpu-reveal' as const,
      [owner === 'player' ? 'playerMotion' : 'cpuMotion']: 9, [handKey]: [nextCard] };
    const ordinary = playCard(ordinaryToken, owner, nextCard.instanceId, 1);
    assert.equal(find(ordinary, nextCard).powerModifier, 0, 'unrelated another-district discounts do not inherit Livewire’s reward');
  });
  test(`Live Streamer is 2/2 and keeps its two-cheap-play cap for ${owner}`, () => {
    assert.equal(cards.streamer.power, 2);
    let m = cast(blank(), 'streamer', owner).after;
    const first = cast(m, 'cornball', owner);
    const second = cast(first.after, 'cornball', owner);
    const third = cast(second.after, 'cornball', owner);
    assert.equal(third.after.cheapBuffsUsed[owner], 2);
    const streamer = third.after.boards.flat().find(card => card.cardId === 'streamer')!;
    const countLaterFrenzyEvents = (state: Match) => state.effectLog.filter(event => event.source?.cardInstanceId === streamer.instanceId
      && event.note === 'Follower Frenzy gave the cheap play +1 Hands.');
    assert.equal(countLaterFrenzyEvents(first.after).filter(event =>
      event.targets.some(target => target.cardInstanceId !== streamer.instanceId)).length, 1);
    assert.equal(countLaterFrenzyEvents(second.after).filter(event =>
      event.targets.some(target => target.cardInstanceId !== streamer.instanceId)).length, 2);
    assert.equal(countLaterFrenzyEvents(third.after).filter(event =>
      event.targets.some(target => target.cardInstanceId !== streamer.instanceId)).length, 2);
  });
  test(`OG Vegan shares with Plant, Gus reaches across lanes: ${owner}`, () => {
    for (const plant of [false, true]) {
      const m = blank(), ally = unit(plant ? 'rastamon' : 'cornball', owner, 0, 1);
      m.boards[0] = [ally];
      const vegan = cast(m, 'sprout', owner);
      assert.equal(find(vegan.after, ally).powerModifier, plant ? 2 : 0);
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
    assert.equal(find(baby.after, ally).powerModifier, 1);
    assert.equal(find(cast(m, 'monsoonanchor', owner).after, foe).statuses.weakened, true);
  });
  test(`Baby rewards only a successful ally move and leaves missing or blocked passengers unchanged: ${owner}`, () => {
    const ally = unit('cornball', owner, 0, 41);
    const m = blank(); m.boards[0] = [ally];
    const successful = cast(m, 'crosswind', owner);
    assert.notEqual(find(successful.after, ally).lane, 0);
    assert.equal(find(successful.after, ally).powerModifier, 1);

    const blockedAlly = unit('cornball', owner, 0, 42);
    blockedAlly.statuses.locked = true;
    const blocked = blank(); blocked.boards[0] = [blockedAlly];
    const noMove = cast(blocked, 'crosswind', owner);
    assert.equal(find(noMove.after, blockedAlly).lane, 0);
    assert.equal(find(noMove.after, blockedAlly).powerModifier, 0);

    const noPassenger = cast(blank(), 'crosswind', owner);
    assert.equal(find(noPassenger.after, noPassenger.source).powerModifier, 0);
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
