import assert from 'node:assert/strict';
import test from 'node:test';
import { createCardInstance, createMatch, nextRound, playTurnCard,
  type CardInstance, type Lane, type Match, type Owner } from '../../../lib/squabblemon-engine/src/gameEngine';

const blank = (): Match => ({ ...createMatch('block', 'block'), round: 3, boards: [[], [], []],
  playerHand: [], cpuHand: [], playerMotion: 9, cpuMotion: 9 });
const unit = (id: string, owner: Owner, lane: Lane, index = 0): CardInstance => ({
  ...createCardInstance(id, owner, 'route-fixture', index), lane,
});
const find = (m: Match, c: CardInstance) => m.boards.flat().find(x => x.instanceId === c.instanceId)!;
const advance = (m: Match) => nextRound({ ...m, phase: 'resolved', playerHand: [], cpuHand: [],
  playerDrawIndex: m.playerCardIds.length, cpuDrawIndex: m.cpuCardIds.length });
function cast(m: Match, id: string, owner: Owner, lane: Lane = 0) {
  const source = createCardInstance(id, owner, 'route-play', m.nextEventSequence);
  return { source, after: playTurnCard({ ...m, phase: owner === 'player' ? 'player' : 'cpu-reveal',
    [owner === 'player' ? 'playerHand' : 'cpuHand']: [source], playerMotion: 9, cpuMotion: 9 },
  owner, source.instanceId, lane) };
}

for (const owner of ['player', 'cpu'] as const) {
  const enemy: Owner = owner === 'player' ? 'cpu' : 'player';
  test(`${owner}: Passport skips a full weakest district and uses the next legal destination`, () => {
    const passenger = unit('waterboy', owner, 0);
    const full = [0, 1, 2, 3].map(index => ({ ...unit('cornball', owner, 1, index), basePower: 0 }));
    const resident = { ...unit('cornball', owner, 2, 10), basePower: 10 };
    const m = { ...blank(), boards: [[passenger], full, [resident]] as Match['boards'] };
    const before = JSON.stringify(m), result = cast(m, 'passportbro', owner);
    assert.equal(find(result.after, passenger).lane, 2);
    assert.equal(find(result.after, passenger).powerModifier, 2);
    assert.equal(JSON.stringify(m), before, 'route selection must not mutate its input');
    assert.deepEqual(cast(JSON.parse(before), 'passportbro', owner).after, result.after);
  });

  test(`${owner}: Passport skips an immovable weakest passenger`, () => {
    const locked = { ...unit('cornball', owner, 0), basePower: 1 };
    locked.statuses.locked = true;
    const passenger = unit('waterboy', owner, 0, 1);
    passenger.statuses.silenced = true;
    const result = cast({ ...blank(), boards: [[locked, passenger], [], []] }, 'passportbro', owner).after;
    assert.equal(find(result, locked).lane, 0);
    assert(find(result, locked).statuses.locked);
    assert.equal(find(result, locked).powerModifier, 0);
    assert.equal(find(result, passenger).lane, 1);
    assert.equal(find(result, passenger).powerModifier, 2);
    assert(!find(result, passenger).statuses.silenced);
  });

  test(`${owner}: Passport pays no travel bonus when every passenger is locked`, () => {
    const passenger = unit('waterboy', owner, 0);
    passenger.statuses.locked = true;
    const result = cast({ ...blank(), boards: [[passenger], [], []] }, 'passportbro', owner).after;
    assert.equal(find(result, passenger).lane, 0);
    assert.equal(find(result, passenger).powerModifier, 0);
    assert(find(result, passenger).statuses.locked);
  });

  test(`${owner}: Passport cleanses and rewards successful travel even from a winning district`, () => {
    const passenger = unit('cornball', owner, 0);
    passenger.statuses.frozen = true;
    passenger.statuses.weakened = true;
    passenger.statuses.silenced = true;
    passenger.statuses.burnStacks = 2;
    const result = cast({ ...blank(), boards: [[passenger], [], []] }, 'passportbro', owner).after;
    const arrived = find(result, passenger);
    assert.equal(arrived.lane, 1);
    assert.equal(arrived.powerModifier, 2);
    assert(!arrived.statuses.frozen && !arrived.statuses.weakened && !arrived.statuses.silenced);
    assert.equal(arrived.statuses.burnStacks, 0);
  });

  test(`${owner}: Passport reveal and losing-Water passive stack once, with no refund`, () => {
    const first = unit('waterboy', owner, 0), second = unit('waterboy', owner, 0, 1);
    const threat = { ...unit('hooper', enemy, 0), basePower: 40 };
    const result = cast({ ...blank(), boards: [[first, second, threat], [], []] }, 'passportbro', owner);
    const moved = [first, second].find(c => find(result.after, c).lane !== 0)!;
    const remaining = [first, second].find(c => c.instanceId !== moved.instanceId)!;
    assert.equal(find(result.after, moved).powerModifier, 5, 'successful travel +2 plus losing-Water exit +3');
    assert.equal(result.after[owner === 'player' ? 'playerMotion' : 'cpuMotion'], 7);
    const again = cast(result.after, 'conductor', owner).after;
    assert.notEqual(find(again, remaining).lane, 0);
    assert.equal(find(again, remaining).powerModifier, 3, 'only Conductor pays; the Passport passive is already spent');
  });

  test(`${owner}: an enemy Open Tab stops Passport travel and its bonus`, () => {
    const passenger = unit('waterboy', owner, 0), cashier = unit('squabblehouse-cashier', enemy, 0);
    const m = blank(); m.boards[0] = [passenger, cashier];
    m.districtTraps = [{ kind: 'open-tab', owner: enemy, lane: 0, source: cashier, expiresAfterRound: 6 }];
    const result = cast(m, 'passportbro', owner).after;
    assert.equal(find(result, passenger).lane, 0);
    assert.equal(find(result, passenger).powerModifier, 0);
    assert.equal(result.districtTraps?.[0].spentRound, result.round);
  });

  test(`${owner}: Truck alone reserves a Treat for a different arrival without eating it itself`, () => {
    const result = cast(blank(), 'icecream', owner);
    assert.deepEqual(find(result.after, result.source).creativeVisits, [0]);
    assert.equal(find(result.after, result.source).powerModifier, 0);
    assert(result.after.creativeMarks?.some(x => x.kind === 'treat' && x.lane === 0));
    const arrival = cast(result.after, 'cornball', owner);
    assert.equal(find(arrival.after, arrival.source).powerModifier, 2);
    assert.equal(find(arrival.after, result.source).powerModifier, 0);
    assert(!arrival.after.creativeMarks?.some(x => x.kind === 'treat' && x.lane === 0));
  });

  test(`${owner}: Truck automatically serves residents at each unvisited district exactly once`, () => {
    const first = unit('cornball', owner, 1), last = { ...unit('cornball', owner, 2, 1), basePower: 20 };
    const result = cast({ ...blank(), boards: [[], [first], [last]] }, 'icecream', owner);
    const before = JSON.stringify(result.after);
    let m = advance(result.after);
    assert.equal(JSON.stringify(result.after), before);
    assert.equal(find(m, result.source).lane, 1);
    assert.equal(find(m, result.source).creativeRound, 4);
    assert.equal(find(m, first).powerModifier, 2);
    const travel = m.effectLog.find(e => e.round === 4 && e.kind === 'move'
      && e.cardInstanceId === result.source.instanceId);
    assert(travel, 'the automatic route has a positional movement frame');
    assert.equal(travel.replay.before.boards.flat().find(c => c.instanceId === result.source.instanceId)?.lane, 0);
    assert.equal(travel.replay.after.boards.flat().find(c => c.instanceId === result.source.instanceId)?.lane, 1);
    assert(!m.creativeMarks?.some(x => x.kind === 'treat' && x.lane === 1));
    m = advance(JSON.parse(JSON.stringify(m)));
    assert.equal(find(m, result.source).lane, 2);
    assert.equal(find(m, result.source).creativeRound, 5);
    assert.equal(find(m, last).powerModifier, 2);
    assert.deepEqual(find(m, result.source).creativeVisits, [0, 1, 2]);
    m = advance(m);
    assert.equal(find(m, result.source).lane, 2);
    assert.equal(find(m, result.source).creativeRound, 5, 'a completed route cannot spend another automatic stop');
    assert.equal(find(m, first).powerModifier, 2);
    assert.equal(find(m, last).powerModifier, 2);
  });

  test(`${owner}: Truck automatic route skips a full district and reserves a later arrival's Treat`, () => {
    const full = [0, 1, 2, 3].map(index => ({ ...unit('cornball', owner, 1, index), basePower: 0 }));
    const result = cast({ ...blank(), boards: [[], full, []] }, 'icecream', owner);
    const routed = advance(result.after);
    assert.equal(find(routed, result.source).lane, 2);
    assert(routed.creativeMarks?.some(x => x.kind === 'treat' && x.lane === 2));
    assert.equal(find(routed, result.source).powerModifier, 0);
    const arriving = cast(routed, 'cornball', owner, 2);
    assert.equal(find(arriving.after, arriving.source).powerModifier, 2);
  });

  test(`${owner}: another card moving Truck delivers to the new district immediately`, () => {
    const resident = unit('cornball', owner, 1), later = { ...unit('cornball', owner, 2, 1), basePower: 20 };
    const truck = cast({ ...blank(), boards: [[], [resident], [later]] }, 'icecream', owner);
    const routed = cast(truck.after, 'passportbro', owner).after;
    assert.equal(find(routed, truck.source).lane, 1);
    assert.equal(find(routed, truck.source).powerModifier, 2, 'Passport rewards its successful passenger');
    assert.equal(find(routed, resident).powerModifier, 2, 'Truck serves the resident on any successful first visit');
    assert.deepEqual(find(routed, truck.source).creativeVisits, [0, 1]);
    assert(!routed.creativeMarks?.some(x => x.kind === 'treat' && x.lane === 1));
    const next = advance(routed);
    assert.equal(find(next, truck.source).lane, 2);
    assert.equal(find(next, later).powerModifier, 2);
  });

  test(`${owner}: new-round story phase locks settle before Truck chooses its automatic stop`, () => {
    const result = cast(blank(), 'icecream', owner), m = result.after;
    m.storyEncounter = {
      id: 'truck-story-route', battlefieldAssetId: 'route-fixture', soundHooks: {},
      enemy: { id: 'route-rival', name: 'Route Rival', portraitAssetId: 'route-rival', deckId: 'block',
        cardIds: [], behaviorProfile: 'balanced' },
      phases: [{ id: 'close-middle', name: 'Road work', trigger: { kind: 'round', atLeast: 4 },
        onEnter: [{ kind: 'lane-lock', owner, lanes: [1] }] }],
    };
    m.storyRuntime = { activePhaseIndex: -1, appliedEffectIds: [], lanePowerBonuses: [], laneLocks: [] };
    const next = advance(m);
    assert.equal(find(next, result.source).lane, 2);
    assert.deepEqual(find(next, result.source).creativeVisits, [0, 2]);
    const lock = next.effectLog.find(e => /phase:close-middle:0: lane-lock/.test(e.note));
    const route = next.effectLog.find(e => /Neighborhood Route: completed/.test(e.note));
    assert(lock && route && lock.sequence < route.sequence);
  });

  test(`${owner}: Open Tab stops the automatic Truck route without serving or consuming a visit`, () => {
    const result = cast(blank(), 'icecream', owner), m = result.after;
    const cashier = unit('squabblehouse-cashier', enemy, 0);
    m.boards[0].push(cashier);
    m.districtTraps = [{ kind: 'open-tab', owner: enemy, lane: 0, source: cashier, expiresAfterRound: 6 }];
    const stopped = advance(m);
    assert.equal(find(stopped, result.source).lane, 0);
    assert.deepEqual(find(stopped, result.source).creativeVisits, [0]);
    assert.equal(find(stopped, result.source).creativeRound, 4, 'the blocked attempt cannot retry in this round');
    assert(!stopped.creativeMarks?.some(x => x.kind === 'treat' && x.lane !== 0));
  });

  for (const status of ['locked', 'silenced', 'frozen', 'weakened'] as const)
    test(`${owner}: ${status} prevents Truck's automatic route without spending a visit`, () => {
      const result = cast(blank(), 'icecream', owner);
      find(result.after, result.source).statuses[status] = true;
      const stopped = advance(result.after);
      assert.equal(find(stopped, result.source).lane, 0);
      assert.deepEqual(find(stopped, result.source).creativeVisits, [0]);
      find(stopped, result.source).statuses[status] = false;
      const resumed = advance(stopped);
      assert.equal(find(resumed, result.source).lane, 1);
      assert.deepEqual(find(resumed, result.source).creativeVisits, [0, 1]);
    });

  test(`${owner}: Truck route works after its entrance was canceled without creating an early Treat`, () => {
    const watched = cast(blank(), 'sherlock', enemy, 1).after;
    const result = cast(watched, 'icecream', owner);
    assert(!result.after.creativeMarks?.some(x => x.kind === 'treat'));
    assert.equal(find(result.after, result.source).creativeVisits, undefined);
    const routed = advance(result.after);
    assert.equal(find(routed, result.source).lane, 1);
    assert.deepEqual(find(routed, result.source).creativeVisits, [1]);
    assert(routed.creativeMarks?.some(x => x.kind === 'treat' && x.lane === 1));
  });
}
