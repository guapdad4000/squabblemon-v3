import assert from 'node:assert/strict';
import test from 'node:test';
import { listLegalBalancePlays } from '@workspace/squabblemon-engine/balanceLab';
import {
  canAffordSelection, createCardInstance, createDistrictSnapshot, createMatch,
  getDistrictResults, getEffectiveCardPower, nextRound, playTurnCard,
  suppressMatchPresentationEvents,
  type CardInstance, type Lane, type Match, type Owner,
} from './gameEngine';
import { previewBattlePlay } from './battlePreview';

const owners = ['player', 'cpu'] as const;
const opposite = (owner: Owner): Owner => owner === 'player' ? 'cpu' : 'player';
const unit = (id: string, owner: Owner, index: number, lane: Lane | null = null): CardInstance =>
  ({ ...createCardInstance(id, owner, 'subway-arrival', index), lane, arrivalOrder: index });
const find = (match: Match, id: string) => match.boards.flat().find(card => card.instanceId === id);
const damage = (match: Match, id: string) => (match.laneDamage ?? [])
  .filter(entry => entry.instanceId === id).reduce((total, entry) => total + entry.amount, 0);
const targets = (match: Match, id: string) => match.effectLog
  .flatMap(event => event.targets.filter(target => target.cardInstanceId === id).map(target => ({ event, target })));

function fixture(owner: Owner, origin: Lane = 2) {
  // The exact failing audit's districts, including the lane 2 -> 0 wrap.
  const districts = createDistrictSnapshot('deck-balance-v33-onshift-fresh-04');
  assert.deepEqual(districts.locations.map(d => d.id), ['underground-ring', 'waff-l-house', 'the-subway']);
  [districts.locations[origin], districts.locations[2]] = [districts.locations[2], districts.locations[origin]];
  const destination = (origin + 1) % 3 as Lane;
  const rider = unit('cornball', owner, 1);
  const security = unit('squabblehouse-security', opposite(owner), 2, destination);
  const match: Match = {
    ...createMatch('block', 'block', undefined, undefined, districts),
    round: 5, phase: owner === 'player' ? 'player' : 'cpu-reveal',
    playerHand: [], cpuHand: [], playerCardIds: [], cpuCardIds: [],
    playerDrawIndex: 0, cpuDrawIndex: 0, playerMotion: 9, cpuMotion: 9,
    boards: [[], [], []], effectLog: [], nextEventSequence: 1,
  };
  match[owner === 'player' ? 'playerHand' : 'cpuHand'] = [rider];
  match.boards[destination] = [security];
  return { match, rider, security, origin, destination };
}

/** Exercise production play, every legal bot candidate, and the visible player preview. */
function playAndPreview(match: Match, rider: CardInstance, origin: Lane): Match {
  const before = structuredClone(match);
  const owner = rider.owner;
  assert.equal(canAffordSelection(match, owner, rider.instanceId, origin), true);
  const after = playTurnCard(match, owner, rider.instanceId, origin);
  const option = listLegalBalancePlays(match, owner).find(candidate =>
    candidate.instanceId === rider.instanceId && candidate.lane === origin && !candidate.squabble);
  assert.ok(option, 'a lethal but legal ride must not be dropped from candidate enumeration');
  assert.deepEqual(option.preview, after, 'legal preview commits the same deterministic outcome');
  if (owner === 'player') {
    const preview = previewBattlePlay(match, rider.instanceId, origin);
    assert.ok(preview, 'the player can preview a legal ride even if the rider will be defeated');
    assert.deepEqual(preview.after, getDistrictResults(after));
    assert.equal(preview.targets.includes(rider.instanceId), false,
      'a new rider is not a phantom target on the pre-play board');
  }
  const search = playTurnCard(suppressMatchPresentationEvents(match), owner, rider.instanceId, origin);
  for (const key of ['boards', 'playerHand', 'cpuHand', 'playerMotion', 'cpuMotion', 'districtRuntime', 'laneDamage'] as const) {
    assert.deepEqual(search[key], after[key], `${key}: presentation-free search preserves the committed state`);
  }
  assert.deepEqual(match, before, 'neither play nor preview mutates its input');
  return after;
}

function ready(match: Match, rider: CardInstance): Match {
  return { ...match, phase: rider.owner === 'player' ? 'player' : 'cpu-reveal',
    [rider.owner === 'player' ? 'playerHand' : 'cpuHand']: [rider],
    [rider.owner === 'player' ? 'playerMotion' : 'cpuMotion']: 9 };
}

for (const owner of owners) {
  test(`Subway ${owner}: lethal rider removal preserves the landed tax, defeat, and legal preview`, () => {
    const { match, rider, security, origin, destination } = fixture(owner);
    assert.equal(getEffectiveCardPower(rider), 1, 'use the approved one-Hand Cornball');
    const after = playAndPreview(match, rider, origin);
    assert.equal(find(after, rider.instanceId), undefined);
    assert.equal([...after.playerHand, ...after.cpuHand].some(card => card.instanceId === rider.instanceId), false);
    assert.equal(after[owner === 'player' ? 'playerMotion' : 'cpuMotion'], 8, 'the play remains paid for');
    assert.equal(after.phase, match.phase, 'normal multi-card play does not end the turn');
    assert.equal(after.districtRuntime!.roundPlays[owner][origin], 1);
    assert.equal(after.districtRuntime!.roundPlays[owner][destination], 0, 'a ride is not another play');
    assert.equal(find(after, security.instanceId)?.powerModifier, 1, 'Security earns +1 from the landed tax');
    assert.equal(find(after, security.instanceId)?.squabblehouseSecurityRound, 5);
    assert.equal(damage(after, rider.instanceId), 1);
    const casualty = targets(after, rider.instanceId).find(({ event, target }) =>
      event.source?.cardInstanceId === security.instanceId && target.after === null);
    assert.ok(casualty, 'the committed arrival tax retains its defeat participant');
    assert.equal(casualty.target.before?.lane, destination);
    assert.equal(casualty.target.before?.power, 1);
    assert.equal(casualty.target.departureCause, undefined, 'this is direct damage, not aura loss');
    assert.ok(casualty.event.replay.before.boards[destination].some(card => card.instanceId === rider.instanceId));
    assert.equal(casualty.event.replay.after.boards.flat().some(card => card.instanceId === rider.instanceId), false);
    assert.equal(targets(after, rider.instanceId).some(({ event }) =>
      event.kind === 'move' || event.kind === 'blocked'), false,
    'do not manufacture a post-defeat movement or blocked target/event');
    assert.equal(after.effectLog.at(-1)?.source?.cardInstanceId, security.instanceId);
  });

  test(`Subway ${owner}: nonlethal arrival tax keeps the rider and Security's +1`, () => {
    const { match, rider, security, origin, destination } = fixture(owner);
    rider.powerModifier = 1;
    const after = playAndPreview(match, rider, origin);
    assert.equal(find(after, rider.instanceId)?.lane, destination);
    assert.equal(getEffectiveCardPower(find(after, rider.instanceId)!), 1);
    assert.equal(damage(after, rider.instanceId), 1);
    assert.equal(find(after, security.instanceId)?.powerModifier, 1);
    const tax = targets(after, rider.instanceId).find(({ event }) => event.source?.cardInstanceId === security.instanceId)!;
    assert.equal(tax.target.before?.power, 2);
    assert.equal(tax.target.after?.power, 1);
    const rides = targets(after, rider.instanceId).filter(({ event }) => event.kind === 'move');
    assert.equal(rides.length, 1);
    assert.equal(rides[0].target.before?.lane, origin);
    assert.equal(rides[0].target.after?.lane, destination);
  });

  test(`Subway ${owner}: successful rides advance exactly one lane, including 2 -> 0`, () => {
    for (const origin of [0, 1, 2] as const) {
      const { match, rider, destination } = fixture(owner, origin);
      match.boards[destination] = [];
      const after = playAndPreview(match, rider, origin);
      assert.equal(find(after, rider.instanceId)?.lane, destination);
      assert.equal(find(after, rider.instanceId)?.moved, true);
      const rides = targets(after, rider.instanceId).filter(({ event }) => event.kind === 'move');
      assert.equal(rides.length, 1);
      assert.equal(rides[0].target.after?.lane, destination);
      assert.match(rides[0].event.note, /THE SUBWAY: rode to/);
    }
  });

  test(`Subway ${owner}: blocked rides neither move nor trigger destination Security`, () => {
    for (const blocker of ['locked', 'full'] as const) {
      const { match, rider, security, origin, destination } = fixture(owner);
      if (blocker === 'locked') rider.statuses.locked = true;
      else match.boards[destination].push(...[10, 11, 12, 13].map(index => unit('cornball', owner, index, destination)));
      const after = playAndPreview(match, rider, origin);
      assert.equal(find(after, rider.instanceId)?.lane, origin);
      assert.equal(find(after, rider.instanceId)?.moved, false);
      assert.equal(find(after, security.instanceId)?.powerModifier, 0);
      assert.equal(find(after, security.instanceId)?.squabblehouseSecurityRound, undefined);
      assert.equal(damage(after, rider.instanceId), 0);
      const movement = targets(after, rider.instanceId).filter(({ event }) =>
        event.kind === 'move' || event.kind === 'blocked');
      assert.equal(movement.length, 1);
      assert.equal(movement[0].event.kind, 'blocked');
      assert.equal(movement[0].target.after?.lane, origin, 'blocked targets never claim destination occupancy');
      assert.match(movement[0].event.note, blocker === 'locked' ? /LOCKED/ : /DISTRICT FULL/);

      const second = unit('cornball', owner, 20);
      const cleared = { ...after, boards: after.boards.map((cards, lane) =>
        lane === destination ? cards.filter(card => card.owner !== owner) : cards) as Match['boards'] };
      const secondPlay = playAndPreview(ready(cleared, second), second, origin);
      assert.equal(find(secondPlay, second.instanceId)?.lane, origin, 'a blocked first play still uses the round ride');
      assert.equal(secondPlay.districtRuntime!.roundPlays[owner][origin], 2);
    }
  });

  test(`Subway ${owner}: a defeated first rider uses only that side's ride until next round`, () => {
    const { match, rider, security, origin, destination } = fixture(owner);
    let after = playAndPreview(match, rider, origin);
    const second = unit('cornball', owner, 30);
    after = playAndPreview(ready(after, second), second, origin);
    assert.equal(find(after, second.instanceId)?.lane, origin);
    assert.equal(after.districtRuntime!.roundPlays[owner][origin], 2);
    assert.equal(find(after, security.instanceId)?.powerModifier, 1);
    const otherSide = unit('cornball', opposite(owner), 31);
    after = playAndPreview(ready(after, otherSide), otherSide, origin);
    assert.equal(find(after, otherSide.instanceId)?.lane, destination, 'the other side retains its first ride');
    assert.equal(after.districtRuntime!.roundPlays[opposite(owner)][origin], 1);

    const next = nextRound({ ...after, phase: 'resolved' });
    assert.equal(next.round, 6);
    assert.equal(next.districtRuntime!.roundPlays[owner][origin], 0);
    const third = unit('cornball', owner, 32);
    const final = playAndPreview(ready(next, third), third, origin);
    assert.equal(find(final, third.instanceId), undefined, 'both the ride and Security check reset next round');
    assert.equal(find(final, security.instanceId)?.powerModifier, 2);
    assert.equal(final.districtRuntime!.roundPlays[owner][origin], 1);
  });

  test(`Subway ${owner}: blocked or reversed arrival tax retains defenses and grants no Security reward`, () => {
    for (const defense of ['protection', 'immunity', 'janitor'] as const) {
      const { match, rider, security, origin, destination } = fixture(owner);
      const janitor = unit('janitor', owner, 40, destination);
      if (defense === 'protection') {
        rider.statuses.protected = true;
        match.timedEffects = [{ id: 'subway-protection', kind: 'church-protection',
          sourceInstanceId: rider.instanceId, targetInstanceId: rider.instanceId, owner,
          lane: origin, startsAtRound: 5, expiresAtRound: 7, expiration: 'match-complete' }];
      } else if (defense === 'immunity') rider.statuses.uncounterable = true;
      else match.boards[destination].push(janitor);
      const after = playAndPreview(match, rider, origin);
      assert.equal(find(after, rider.instanceId)?.lane, destination);
      assert.equal(find(after, security.instanceId)?.powerModifier, 0);
      assert.equal(find(after, security.instanceId)?.squabblehouseSecurityRound, 5, 'a blocked check is still spent');
      assert.equal(damage(after, rider.instanceId), 0, 'an attempted or reversed tax is not damage');
      assert.ok(after.effectLog.some(event => event.source?.cardInstanceId === security.instanceId
        && event.note.includes('gained no Hands')));
      if (defense === 'protection') assert.equal(after.timedEffects.length, 0);
      if (defense === 'janitor') {
        assert.equal(find(after, rider.instanceId)?.powerModifier, 2);
        assert.ok(after.effectLog.some(event => event.source?.cardInstanceId === janitor.instanceId
          && event.targets.some(target => target.cardInstanceId === rider.instanceId)));
        assert.equal(after.janitorReversals?.length, 1);
      }
    }
  });

  test(`Subway ${owner}: lethal tax preserves nested reactions and a neutral aura-loss casualty`, () => {
    const { match, rider, security, origin, destination } = fixture(owner);
    // Cook retaliates against Security. Its Manager loses its sole staff aura,
    // while Bonnetgirl still reacts to the rider's committed direct damage.
    security.powerModifier = 2 - security.basePower;
    const cook = unit('squabblecook', owner, 50, destination);
    const bonnet = unit('bonnetgirl', owner, 51, destination);
    const manager = unit('squabble-house-manager', opposite(owner), 52, 1);
    manager.powerModifier = -manager.basePower;
    manager.continuousPower = 1;
    match.boards[destination].push(cook, bonnet);
    match.boards[1].push(manager);
    const after = playAndPreview(match, rider, origin);
    assert.equal(find(after, rider.instanceId), undefined);
    assert.equal(find(after, security.instanceId), undefined);
    assert.equal(find(after, manager.instanceId), undefined);
    assert.equal(damage(after, rider.instanceId), 1);
    assert.equal(damage(after, security.instanceId), 2);
    assert.equal(damage(after, manager.instanceId), 0, 'aura loss must not acquire attacker damage credit');
    assert.ok(targets(after, rider.instanceId).some(({ target }) => target.after === null
      && target.departureCause === undefined), 'the rider retains its direct defeat record');
    const aura = targets(after, manager.instanceId).find(({ target }) => target.departureCause === 'aura-loss');
    assert.ok(aura, 'the nested neutral casualty is retained, not hidden by the missing-rider return');
    assert.equal(aura.target.before?.power, 1);
    assert.equal(aura.target.after, null);
    assert.ok(aura.event.replay.before.boards.flat().some(card => card.instanceId === manager.instanceId));
    assert.equal(aura.event.replay.after.boards.flat().some(card => card.instanceId === manager.instanceId), false);
    assert.equal(find(after, bonnet.instanceId)?.powerModifier, 2);
    for (const watcher of [cook, bonnet]) {
      assert.ok(after.effectLog.some(event => event.source?.cardInstanceId === watcher.instanceId
        && event.note.includes('reacted to 1 damage')));
    }
    assert.equal(targets(after, rider.instanceId).some(({ event }) =>
      event.kind === 'move' || event.kind === 'blocked'), false, 'nested events cannot create a phantom final ride');
  });
}