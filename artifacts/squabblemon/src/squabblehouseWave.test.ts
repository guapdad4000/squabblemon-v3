import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SQUABBLEHOUSE_WAVE, squabblehouseFactionById, squabblehouseRarityById, squabblehouseWaveCards,
} from '../../../lib/squabblemon-engine/src/squabblehouseWave';
import {
  createAbilityUpgradeSnapshot, createCardInstance, createMatch, nextRound, playTurnCard,
  type CardInstance, type Lane, type Match, type Owner,
} from './gameEngine';
import { cardCatalog, cards } from './data';

const IDS = SQUABBLEHOUSE_WAVE.map(([id]) => id);
const emptyStatuses = () => ({
  frozen: false, silenced: false, protected: false, blocked: false, uncounterable: false,
  weakened: false, locked: false, boosted: false, burnStacks: 0,
});
const blank = (): Match => {
  const match = createMatch('block', 'block');
  return {
    ...match, round: 1, phase: 'player', playerMotion: 9, cpuMotion: 9,
    boards: [[], [], []], playerHand: [], cpuHand: [], playerCardIds: [], cpuCardIds: [],
    playerDrawIndex: 0, cpuDrawIndex: 0,
  };
};
const unit = (id: string, owner: Owner, lane: Lane, index: number): CardInstance => {
  const definition = squabblehouseWaveCards[id];
  const original = definition
    ? { ...definition, cardId: id, instanceId: `${owner}:sqh:${index}:${id}`, owner, deck: 'sqh-test',
      lane: null, playedRound: null, basePower: definition.power, powerModifier: 0, moved: false,
      statuses: emptyStatuses(), lastEffectNote: 'Ready in hand.' } as CardInstance
    : createCardInstance(id, owner, 'sqh-test', index);
  return { ...original, lane, arrivalOrder: index };
};
const withBoard = (match: Match, ...cards: CardInstance[]): Match => ({
  ...match, boards: match.boards.map((lane, laneIndex) =>
    [...lane, ...cards.filter(card => card.lane === laneIndex)]) as Match['boards'],
});
const find = (match: Match, id: string) => match.boards.flat().find(card => card.cardId === id);
const findInstance = (match: Match, id: string) => match.boards.flat().find(card => card.instanceId === id);
function cast(
  match: Match, id: string, owner: Owner, targetLane: Lane, index = match.nextEventSequence,
): Match {
  const card = unit(id, owner, targetLane, index);
  return playTurnCard({
    ...match, phase: owner === 'player' ? 'player' : 'cpu-reveal',
    [owner === 'player' ? 'playerHand' : 'cpuHand']: [card],
  }, owner, card.instanceId, targetLane);
}
const beginNextRound = (match: Match): Match => nextRound({
  ...match, phase: 'resolved', playerHand: [], cpuHand: [],
  playerCardIds: [], cpuCardIds: [], playerDrawIndex: 0, cpuDrawIndex: 0,
});
const replayTransitions = (match: Match) => match.effectLog.filter(event => event.replay);

test('Squabblehouse wave definitions expose all nine playable identities, budgets, rarity, and faction', () => {
  assert.deepEqual(IDS, [
    'squabblehouse-security', 'squabblehouse-teknician', 'griddle-master',
    'inmate-reformed', 'squabblehouse-bus-boy', 'squabblehouse-cashier', 'waffle-warlord',
    'cane-corso-red', 'blue-nose-pit',
  ]);
  const expected = {
    'squabblehouse-security': ['Legendary', 3, 4, 'Normal'],
    'squabblehouse-teknician': ['Mythical', 5, 5, 'Electric'],
    'griddle-master': ['Rare', 3, 3, 'Fire'],
    'inmate-reformed': ['Rare', 3, 3, 'Normal'],
    'squabblehouse-bus-boy': ['Uncommon', 1, 2, 'Water'],
    'squabblehouse-cashier': ['Rare', 2, 3, 'Earth'],
    'waffle-warlord': ['Legendary', 5, 5, 'Fire'],
    'cane-corso-red': ['Rare', 2, 3, 'Fire'],
    'blue-nose-pit': ['Rare', 2, 4, 'Water'],
  };
  for (const id of IDS) {
    const card = squabblehouseWaveCards[id];
    assert.deepEqual([squabblehouseRarityById[id], card.cost, card.power, card.type], expected[id]);
    assert.equal(squabblehouseFactionById[id], 'Squabblehouse');
    assert.equal(card.kind, 'character');
    assert.equal(card.abilityUpgrades.length, 3);
    assert.doesNotThrow(() => unit(id, 'player', 0, 1));
  }
  assert.match(squabblehouseWaveCards['squabblehouse-security'].effect, /first enemy played or moved/);
  assert.match(squabblehouseWaveCards['squabblehouse-bus-boy'].effect,
    /round start, attempt one counterable move to an adjacent lane, reversing direction at the edges/i);
  assert.match(squabblehouseWaveCards['squabblehouse-bus-boy'].effect,
    /successful arrival, cleanse Weakened from all other friendly characters there and give the weakest other friendly character there \+1 Hand/i);
  assert.match(squabblehouseWaveCards['blue-nose-pit'].effect, /immunity to Hands loss/);
  assert.equal(squabblehouseWaveCards['griddle-master'].ability, 'Hot Off the Griddle');
  assert.match(squabblehouseWaveCards['griddle-master'].effect,
    /Hit strongest enemy: strip Protection; deal 3 \(5 if burning\) damage \+ 1 Burn/i);
  assert.match(squabblehouseWaveCards['waffle-warlord'].effect,
    /each staffed district \+1 Hand, or \+2 Hands if you have staff in all three districts/i);
  assert.equal(squabblehouseWaveCards['squabblehouse-cashier'].ability, 'Pay Your Tab');
  assert.match(squabblehouseWaveCards['squabblehouse-cashier'].effect,
    /Through next round: lock strongest enemy character \(no moves\/returns\)/i);
  assert.match(squabblehouseWaveCards['squabblehouse-cashier'].effect,
    /Open Tab stops one legal enemy exit\/return\/round/i);
  assert.match(squabblehouseWaveCards['squabblehouse-cashier'].effect, /Arrivals ignored\. Defenses apply/i);
  assert.match(squabblehouseWaveCards['squabblehouse-cashier'].effect, /echoes extend expiry, never recharge/i);
  assert.equal(cards.janitor.ability, 'Turn It Around');
  assert.match(cards.janitor.effect,
    /Two charges\/district\/round separately reverse first enemy Hands loss\/harmful status on any ally and first enemy-forced move\/return\/execution on staff/i);
  assert.match(cards.janitor.effect, /\+2 Hands each/i);
  assert.match(cards.janitor.effect, /duplicates share both/i);
  assert.match(cards.janitor.effect, /damage deaths use harm/i);
  const support = cards.sideofhands;
  assert.deepEqual([support.id, support.kind, support.cost, support.power], ['a-side-of-hands', 'support', 2, 0]);
  assert.equal(cardCatalog.find(card => card.engineId === 'sideofhands')?.faction, 'Squabblehouse');
  assert.equal(cardCatalog.find(card => card.engineId === 'sideofhands')?.crewTags.includes('Squabblehouse') ?? false, false);
  for (const id of ['squabblehouse-bus-boy', 'squabblehouse-cashier', 'waffle-warlord']) {
    assert(cardCatalog.find(card => card.engineId === id)?.crewTags.includes('Squabblehouse'));
  }
});

test('dogs support their OG only after reaching its district', () => {
  for (const [dogId, ogId, ogLane, startLane] of [
    ['blue-nose-pit', 'triple-og-blue', 0, 2],
    ['cane-corso-red', 'triple-og-red', 2, 0],
  ] as const) {
    let match = withBoard(blank(), unit(ogId, 'player', ogLane, 1),
      unit('lebron-james', 'cpu', ogLane, 2));
    match = cast(match, dogId, 'player', startLane, 3);
    const dog = find(match, dogId)!;
    assert.equal(dog.squabblehouseEffectRound, undefined, 'remote On Reveal does not support the OG');
    assert.equal(findInstance(match, dog.instanceId)?.lane, 1, 'reveal approaches by one district');
    match = beginNextRound(match);
    assert.equal(findInstance(match, dog.instanceId)?.lane, ogLane);
    assert.equal(findInstance(match, dog.instanceId)?.squabblehouseEffectRound, match.round,
      'support activates on arrival');
  }
});

test('both OG dogs wait when unmatched, then walk exactly one adjacent lane per round', () => {
  let match = blank();
  const redDog = unit('cane-corso-red', 'player', 0, 1);
  match = withBoard(match, redDog);
  match = beginNextRound(match);
  assert.equal(findInstance(match, redDog.instanceId)?.lane, 0, 'no matching OG means no movement');
  assert.equal(findInstance(match, redDog.instanceId)?.squabblehouseEffectRound, undefined);

  const redOg = unit('triple-og-red', 'player', 2, 2);
  match = withBoard(match, redOg);
  match = beginNextRound(match);
  assert.equal(findInstance(match, redDog.instanceId)?.lane, 1, 'round start advances only one lane toward Red OG');
  let dogMoves = match.effectLog.filter(event => event.cardInstanceId === redDog.instanceId && event.kind === 'move');
  assert.equal(dogMoves.at(-1)?.replay.before.boards.flat().find(card => card.instanceId === redDog.instanceId)?.lane, 0);
  assert.equal(dogMoves.at(-1)?.replay.after.boards.flat().find(card => card.instanceId === redDog.instanceId)?.lane, 1);
  match = beginNextRound(match);
  assert.equal(findInstance(match, redDog.instanceId)?.lane, 2);
  dogMoves = match.effectLog.filter(event => event.cardInstanceId === redDog.instanceId && event.kind === 'move');
  assert.deepEqual(dogMoves.map(event => [
    event.replay.before.boards.flat().find(card => card.instanceId === redDog.instanceId)?.lane,
    event.replay.after.boards.flat().find(card => card.instanceId === redDog.instanceId)?.lane,
  ]), [[0, 1], [1, 2]]);

  for (const disabled of ['frozen', 'locked'] as const) {
    let stopped = blank();
    const dog = unit('blue-nose-pit', 'player', 2, 4);
    dog.statuses[disabled] = true;
    stopped = withBoard(stopped, dog, unit('triple-og-blue', 'player', 0, 5));
    stopped = beginNextRound(stopped);
    assert.equal(findInstance(stopped, dog.instanceId)?.lane, 2, `${disabled} dogs do not walk`);
  }
  let laneLocked = blank();
  const lockedLaneDog = unit('blue-nose-pit', 'player', 2, 6);
  laneLocked = withBoard(laneLocked, lockedLaneDog, unit('triple-og-blue', 'player', 0, 7));
  laneLocked.storyRuntime = { activePhaseIndex: 0, appliedEffectIds: [], lanePowerBonuses: [],
    laneLocks: [{ owner: 'player', lanes: [1] }] };
  laneLocked = beginNextRound(laneLocked);
  assert.equal(findInstance(laneLocked, lockedLaneDog.instanceId)?.lane, 2, 'locked adjacent lane is respected');
});

test('Dog On Reveal waits without its matching OG and never teleports as part of the reveal', () => {
  let match = blank();
  match = cast(match, 'cane-corso-red', 'player', 0);
  assert.equal(find(match, 'cane-corso-red')?.lane, 0);
  assert.equal(find(match, 'cane-corso-red')?.squabblehouseEffectRound, undefined);
  match = withBoard(match, unit('triple-og-red', 'player', 2, 40));
  match = cast(match, 'blue-nose-pit', 'player', 2);
  assert.equal(find(match, 'blue-nose-pit')?.lane, 2);
  assert.equal(find(match, 'blue-nose-pit')?.squabblehouseEffectRound, undefined,
    'a Red OG does not activate the unrelated Blue dog');
});

test('Red dog leaps two lanes to intercept one complete Griddle damage-and-Burn package', () => {
  let match = blank();
  const og = unit('triple-og-red', 'cpu', 2, 11);
  const dog = unit('cane-corso-red', 'cpu', 0, 12);
  match = withBoard(match, og, dog);
  const after = cast(match, 'griddle-master', 'player', 2);
  assert.equal(findInstance(after, og.instanceId)?.powerModifier, 0, 'the OG remains protected');
  assert.equal(findInstance(after, dog.instanceId), undefined, '3 damage destroys the 3-Hands bodyguard');
  const jump = after.effectLog.find(event => event.cardInstanceId === dog.instanceId && event.kind === 'move');
  assert.ok(jump, 'emergency movement is a canonical movement event');
  assert.equal(jump.replay.before.boards.flat().find(card => card.instanceId === dog.instanceId)?.lane, 0);
  assert.equal(jump.replay.after.boards.flat().find(card => card.instanceId === dog.instanceId)?.lane, 2,
    'emergency guard may leap across two lanes');
  const guardHit = after.effectLog.find(event => event.targets.some(target => target.cardInstanceId === dog.instanceId)
    && event.targets.some(target => target.cardInstanceId === og.instanceId));
  assert.ok(guardHit, 'damage event names the real dog recipient');
  assert.ok(guardHit.targets.some(target => target.cardInstanceId === og.instanceId),
    'the same event names the protected OG');
  assert.equal(guardHit.targets.find(target => target.cardInstanceId === dog.instanceId)?.before?.power, 3);
  assert.equal(guardHit.targets.find(target => target.cardInstanceId === dog.instanceId)?.after, null);
});

test('same-lane dogs guard in place, one dog spends one package per round, and duplicates resolve deterministically', () => {
  let match = blank();
  const og = unit('triple-og-red', 'cpu', 2, 10);
  const firstDog = unit('cane-corso-red', 'cpu', 2, 20);
  const secondDog = unit('cane-corso-red', 'cpu', 2, 30);
  // Keep the OG strongest and both guards alive through the stronger hits and Burn;
  // this fixture checks spent charges and their reset, not lethal interception.
  og.powerModifier = 10;
  firstDog.powerModifier = 3;
  firstDog.basePower = 5;
  secondDog.powerModifier = 1;
  secondDog.basePower = 4;
  firstDog.arrivalOrder = 2;
  secondDog.arrivalOrder = 3;
  match = withBoard(match, og, firstDog, secondDog);
  match = cast(match, 'griddle-master', 'player', 2, 31);
  assert.equal(findInstance(match, firstDog.instanceId)?.statuses.burnStacks, 1);
  assert.equal(findInstance(match, firstDog.instanceId)?.powerModifier, 0);
  assert.equal(findInstance(match, og.instanceId)?.powerModifier, 10);
  assert.equal(findInstance(match, firstDog.instanceId)?.squabblehouseGuardRound, 1);
  assert.equal(findInstance(match, secondDog.instanceId)?.squabblehouseGuardRound, undefined);
  assert.equal(match.effectLog.some(event => event.cardInstanceId === firstDog.instanceId && event.kind === 'move'), false,
    'same-lane protection needs no movement');

  match = cast(match, 'griddle-master', 'player', 2, 32);
  assert.equal(findInstance(match, secondDog.instanceId)?.squabblehouseGuardRound, 1,
    'the next arrival-order dog guards the next package');
  assert.equal(findInstance(match, og.instanceId)?.powerModifier, 10);
  match = cast(match, 'griddle-master', 'player', 2, 33);
  assert.equal(findInstance(match, og.instanceId)?.powerModifier, 7,
    'once duplicate guards each spent their package, the OG receives the next attack');

  match = { ...beginNextRound(match), playerMotion: 9 };
  const ogAfterRoundStart = findInstance(match, og.instanceId)?.powerModifier;
  assert.equal(ogAfterRoundStart, 6, 'ordinary Burn ticked RED PUNCH once before the next attack');
  match = cast(match, 'griddle-master', 'player', 2, 34);
  assert.equal(findInstance(match, firstDog.instanceId)?.squabblehouseGuardRound, 2,
    'the per-instance guard mark resets by round number');
  assert.equal(findInstance(match, og.instanceId)?.powerModifier, ogAfterRoundStart,
    'the dog prevents another Hands reduction after the round-start Burn tick');
});

test('Blue dog grants Blue OG once per round; OG Hands-loss immunity remains authoritative', () => {
  let match = blank();
  const og = unit('triple-og-blue', 'player', 0, 1);
  match = withBoard(match, og);
  match = cast(match, 'blue-nose-pit', 'player', 2, 3);
  assert.equal(findInstance(match, og.instanceId)?.powerModifier, 0);
  assert.equal(find(match, 'blue-nose-pit')?.lane, 1, 'playing the dog advances only one adjacent lane');
  const blueHandsBeforeRoundTwo = findInstance(match, og.instanceId)?.powerModifier ?? 0;
  match = beginNextRound(match);
  assert.equal(find(match, 'blue-nose-pit')?.lane, 0);
  assert.equal(findInstance(match, og.instanceId)?.powerModifier, blueHandsBeforeRoundTwo + 1,
    'the dog supports its OG upon arrival at round start');
  const blueHandsBeforeRoundThree = findInstance(match, og.instanceId)?.powerModifier ?? 0;
  match = beginNextRound(match);
  assert.equal(findInstance(match, og.instanceId)?.powerModifier, blueHandsBeforeRoundThree + 1);

  const redSource = unit('cane-corso-red', 'cpu', 2, 4);
  match = withBoard(match, redSource, unit('triple-og-red', 'cpu', 2, 5));
  // Red's -1 target selection can point at the opposing Blue OG when it shares the OG district.
  const blueLaneOg = findInstance(match, og.instanceId)!;
  match = { ...match, boards: match.boards.map((items, lane) => {
    const others = items.filter(card => card.instanceId !== og.instanceId && card.cardId !== 'blue-nose-pit');
    return lane === 2 ? [...others, { ...blueLaneOg, lane: 2 as Lane }] : others;
  }) as Match['boards'] };
  const afterRed = cast(match, 'cane-corso-red', 'cpu', 2, 6);
  assert.equal(findInstance(afterRed, og.instanceId)?.powerModifier, blueLaneOg.powerModifier,
    'canonical Hands-loss immunity on triple-og-blue remains unchanged');
});

test('uncounterable attacks, Griddle shieldbreak, Wifey, and disabled dogs retain their order ahead of dog redirection', () => {
  const og = unit('triple-og-red', 'cpu', 2, 1);
  const dog = unit('cane-corso-red', 'cpu', 0, 2);
  let immune = blank();
  og.statuses.uncounterable = true;
  immune = withBoard(immune, og, dog);
  immune = cast(immune, 'griddle-master', 'player', 2);
  assert.equal(findInstance(immune, og.instanceId)?.powerModifier, 0);
  assert.equal(findInstance(immune, dog.instanceId)?.powerModifier, 0);
  assert.equal(findInstance(immune, dog.instanceId)?.squabblehouseGuardRound, undefined);
  assert.equal(findInstance(immune, dog.instanceId)?.lane, 0);

  let shielded = blank();
  const shieldedOg = unit('triple-og-red', 'cpu', 2, 11);
  const shieldDog = unit('cane-corso-red', 'cpu', 0, 12);
  shieldedOg.statuses.protected = true;
  shielded = withBoard(shielded, shieldedOg, shieldDog);
  shielded.timedEffects = [{ id: 'test-shield', kind: 'church-protection', sourceInstanceId: shieldedOg.instanceId,
    targetInstanceId: shieldedOg.instanceId, owner: 'cpu', lane: 2, startsAtRound: 1, expiresAtRound: 99,
    expiration: 'match-complete' }];
  shielded = cast(shielded, 'griddle-master', 'player', 2);
  assert.equal(findInstance(shielded, shieldDog.instanceId), undefined,
    'Griddle breaks the strongest enemy shield, then its 3-damage follow-up is redirected to and destroys the 2-Hand dog');
  assert.equal(findInstance(shielded, shieldedOg.instanceId)?.powerModifier, 0);

  let sideEye = blank();
  const wifeyOg = unit('triple-og-red', 'cpu', 2, 21);
  const wifey = unit('wifey', 'cpu', 2, 22);
  const wifeyDog = unit('cane-corso-red', 'cpu', 0, 23);
  wifey.statuses.protected = true;
  sideEye = withBoard(sideEye, wifeyOg, wifey, wifeyDog);
  sideEye = cast(sideEye, 'griddle-master', 'player', 2);
  assert.equal(findInstance(sideEye, wifeyDog.instanceId)?.squabblehouseGuardRound, undefined);
  assert.equal(findInstance(sideEye, wifey.instanceId)?.statuses.blocked, true);

  for (const disabled of ['frozen', 'locked'] as const) {
    let stopped = blank();
    const exposedOg = unit('triple-og-red', 'cpu', 2, 31);
    exposedOg.powerModifier = 5;
    const disabledDog = unit('cane-corso-red', 'cpu', 0, 32);
    disabledDog.statuses[disabled] = true;
    stopped = withBoard(stopped, exposedOg, disabledDog);
    stopped = cast(stopped, 'griddle-master', 'player', 2);
    assert.equal(findInstance(stopped, exposedOg.instanceId)?.powerModifier, 2,
      `${disabled} dogs cannot intercept`);
    assert.equal(findInstance(stopped, disabledDog.instanceId)?.lane, 0);
    assert.equal(findInstance(stopped, disabledDog.instanceId)?.squabblehouseGuardRound, undefined);
  }

  let laneLockedGuard = blank();
  const lockedOg = unit('triple-og-red', 'cpu', 2, 41);
  lockedOg.powerModifier = 5;
  const remoteDog = unit('cane-corso-red', 'cpu', 0, 42);
  laneLockedGuard = withBoard(laneLockedGuard, lockedOg, remoteDog);
  laneLockedGuard.storyRuntime = { activePhaseIndex: 0, appliedEffectIds: [], lanePowerBonuses: [],
    laneLocks: [{ owner: 'cpu', lanes: [2] }] };
  laneLockedGuard = cast(laneLockedGuard, 'griddle-master', 'player', 2);
  assert.equal(findInstance(laneLockedGuard, lockedOg.instanceId)?.powerModifier, 2,
    'emergency movement cannot cross a locked destination');
  assert.equal(findInstance(laneLockedGuard, remoteDog.instanceId)?.lane, 0);
  assert.equal(findInstance(laneLockedGuard, remoteDog.instanceId)?.squabblehouseGuardRound, undefined);
});

test('Red dog attacks only its matching OG district, and Red/Blue dog effects are once per round', () => {
  let match = blank();
  const og = unit('triple-og-red', 'player', 2, 1);
  const enemy = unit('techbro', 'cpu', 2, 2);
  const dog = unit('cane-corso-red', 'player', 2, 5);
  match = withBoard(match, og, enemy, unit('techbro', 'cpu', 0, 4));
  match = playTurnCard({ ...match, playerHand: [dog] }, 'player', dog.instanceId, 2);
  assert.equal(findInstance(match, enemy.instanceId)?.powerModifier, -1);
  assert.equal(find(match, 'techbro')?.powerModifier, 0, 'the other district remains outside the Red OG attack');
  assert.equal(findInstance(match, dog.instanceId)?.squabblehouseEffectRound, 1);
  match = beginNextRound(match);
  assert.equal(findInstance(match, dog.instanceId)?.lane, 2, 'a dog already at its OG stays there');
  assert.equal(findInstance(match, enemy.instanceId)?.powerModifier, -2);
  assert.equal(findInstance(match, dog.instanceId)?.squabblehouseEffectRound, 2);
});

test('Security hits the strongest enemy on reveal and its bounded first-arrival trigger resolves once', () => {
  let match = blank();
  const strong = unit('techbro', 'cpu', 1, 1);
  strong.powerModifier = 3;
  const weak = unit('hooper', 'cpu', 1, 2);
  match = withBoard(match, strong, weak);
  match = cast(match, 'squabblehouse-security', 'player', 1);
  assert.equal(findInstance(match, strong.instanceId)?.powerModifier, 1, 'strongest enemy took -2 Hands');

  const security = find(match, 'squabblehouse-security')!;
  const arrival = unit('hooper', 'cpu', 1, 5);
  match = playTurnCard({ ...match, phase: 'cpu-reveal', cpuMotion: 9, cpuHand: [arrival] },
    'cpu', arrival.instanceId, 1);
  assert.equal(findInstance(match, arrival.instanceId)?.powerModifier, -1);
  assert.equal(find(match, 'squabblehouse-security')?.powerModifier, 1);
  const second = unit('hooper', 'cpu', 1, 6);
  match = playTurnCard({ ...match, phase: 'cpu-reveal', cpuMotion: 9, cpuHand: [second] }, 'cpu', second.instanceId, 1);
  assert.equal(findInstance(match, second.instanceId)?.powerModifier, 0);
  assert.equal(find(match, 'squabblehouse-security')?.powerModifier, 1);
  assert.equal(find(match, 'squabblehouse-security')?.squabblehouseSecurityRound, match.round);
  assert.ok(match.effectLog.some(event => event.source?.cardId === security.cardId
    && event.targets.some(target => target.cardInstanceId === arrival.instanceId)));
});

test('Security reacts to movement into its district and ignores repeat arrivals until next round', () => {
  let match = blank();
  const security = unit('squabblehouse-security', 'player', 1, 1);
  const entrant = unit('yn-gokarter', 'cpu', 0, 2);
  const laneTwoFiller = ['techbro', 'hooper', 'rastamon', 'cornball'].map((id, i) => unit(id, 'cpu', 2, 10 + i));
  match = withBoard(match, security, ...laneTwoFiller);
  match = playTurnCard({ ...match, phase: 'cpu-reveal', cpuHand: [entrant] }, 'cpu', entrant.instanceId, 0);
  assert.equal(findInstance(match, entrant.instanceId)?.lane, 1, 'the canonical movement chose Security district');
  assert.equal(findInstance(match, entrant.instanceId)?.powerModifier, -1);
  assert.equal(findInstance(match, security.instanceId)?.powerModifier, 1);
  const note = match.effectLog.find(event => event.source?.cardInstanceId === security.instanceId);
  assert.ok(note?.note.includes('played or moved'));
});

test('Security gains its arrival reward only when the Hands loss lands', () => {
  const arrival = (entrant: CardInstance, ...cpuAllies: CardInstance[]) => {
    let match = withBoard(blank(), unit('squabblehouse-security', 'player', 1, 1), ...cpuAllies);
    if (entrant.statuses.protected) match.timedEffects = [{
      id: 'arrival-test-shield', kind: 'church-protection', sourceInstanceId: entrant.instanceId,
      targetInstanceId: entrant.instanceId, owner: 'cpu', lane: 1, startsAtRound: 1,
      expiresAtRound: 99, expiration: 'match-complete',
    }];
    return playTurnCard({ ...match, phase: 'cpu-reveal', cpuMotion: 9, cpuHand: [entrant] },
      'cpu', entrant.instanceId, 1);
  };
  const protectedEntrant = unit('hooper', 'cpu', 1, 10);
  protectedEntrant.statuses.protected = true;
  let match = arrival(protectedEntrant);
  assert.equal(findInstance(match, protectedEntrant.instanceId)?.powerModifier, 0);
  assert.equal(find(match, 'squabblehouse-security')?.powerModifier, 0);

  const immuneEntrant = unit('hooper', 'cpu', 1, 11);
  immuneEntrant.statuses.uncounterable = true;
  match = arrival(immuneEntrant);
  assert.equal(findInstance(match, immuneEntrant.instanceId)?.powerModifier, 0);
  assert.equal(find(match, 'squabblehouse-security')?.powerModifier, 0);

  const blueOg = unit('triple-og-blue', 'cpu', 0, 16);
  const securityBesideImmuneOg = unit('squabblehouse-security', 'player', 0, 17);
  const weakerEnemy = unit('hooper', 'player', 0, 18);
  let immuneOgMatch = withBoard(blank(), securityBesideImmuneOg, weakerEnemy);
  immuneOgMatch = playTurnCard({ ...immuneOgMatch, phase: 'cpu-reveal', cpuMotion: 9, cpuHand: [blueOg] },
    'cpu', blueOg.instanceId, 0);
  assert.equal(findInstance(immuneOgMatch, blueOg.instanceId)?.powerModifier, 0,
    'Blue OG keeps its canonical immunity to Hands loss');
  const blockedCheck = immuneOgMatch.effectLog.find(event =>
    event.source?.cardInstanceId === securityBesideImmuneOg.instanceId
      && event.note.startsWith('Keep the Peace: the first enemy'));
  assert.ok(blockedCheck, 'the first-arrival check is captured before Blue OG resolves its reveal');
  assert.equal(blockedCheck.source?.after?.powerModifier, 0,
    'blocked Hands loss grants no Security reward');

  const wifeyEntrant = unit('hooper', 'cpu', 1, 12);
  const wifey = unit('wifey', 'cpu', 1, 13);
  wifey.statuses.protected = true;
  match = arrival(wifeyEntrant, wifey);
  assert.equal(findInstance(match, wifeyEntrant.instanceId)?.powerModifier, 0);
  assert.equal(find(match, 'squabblehouse-security')?.powerModifier, 0);

  const janitorEntrant = unit('hooper', 'cpu', 1, 14);
  match = arrival(janitorEntrant, unit('janitor', 'cpu', 1, 15));
  assert.equal(findInstance(match, janitorEntrant.instanceId)?.powerModifier, 2,
    'Janitor retains its existing reversal bonus');
  assert.equal(find(match, 'squabblehouse-security')?.powerModifier, 0,
    'reversed Hands loss grants no Security reward');
  assert.ok(match.effectLog.some(event => event.note.includes('gained no Hands')));
});

test('Teknician repeats the latest eligible staff reveal and its district trigger cannot recurse', () => {
  let match = blank();
  const enemy = unit('techbro', 'cpu', 0, 1);
  enemy.powerModifier = 10;
  match = withBoard(match, enemy);
  match = cast(match, 'griddle-master', 'player', 0, 2);
  assert.equal(findInstance(match, enemy.instanceId)?.powerModifier, 7);
  assert.equal(findInstance(match, enemy.instanceId)?.statuses.burnStacks, 1);
  match = cast(match, 'squabblehouse-teknician', 'player', 0, 3);
  assert.equal(findInstance(match, enemy.instanceId)?.powerModifier, 2, 'burning Griddle target took the repeated 5 damage');
  assert.equal(findInstance(match, enemy.instanceId)?.statuses.burnStacks, 2);
  assert.equal(find(match, 'squabblehouse-teknician')?.squabblehouseTeknicianRevealRound, 1);
  assert.ok(match.squabblehouseRevealHistory?.some(item => item.cardId === 'griddle-master'));
  assert.ok(match.effectLog.some(event => event.note.includes('Run It Back')));

  let district = blank();
  const tech = unit('squabblehouse-teknician', 'player', 1, 20);
  const target = unit('techbro', 'cpu', 1, 21);
  target.powerModifier = 10;
  district = withBoard(district, tech, target);
  district = cast(district, 'squabblehouse-security', 'player', 1, 22);
  assert.equal(findInstance(district, target.instanceId)?.powerModifier, 6,
    'a new eligible staff play repeats once after its own On Reveal');
  assert.equal(findInstance(district, tech.instanceId)?.squabblehouseTeknicianRound, 1);
  assert.equal(district.effectLog.filter(event => event.note.includes('Keep the Peace checked')).length, 2,
    'Security does not recurse through the Teknician echo');
});

test('Teknician skips destroyed or disabled latest staff and falls back to the latest live active reveal', () => {
  const runWithUnavailableLatest = (destroy: boolean) => {
    let match = blank();
    const enemy = unit('techbro', 'cpu', 0, 40);
    enemy.powerModifier = 20;
    match = withBoard(match, enemy);
    match = cast({ ...match, playerMotion: 9 }, 'griddle-master', 'player', 0, 41);
    match = cast({ ...match, playerMotion: 9 }, 'squabblehouse-security', 'player', 0, 42);
    const latest = find(match, 'squabblehouse-security')!;
    if (destroy) match = { ...match, boards: match.boards.map(items =>
      items.filter(card => card.instanceId !== latest.instanceId)) as Match['boards'] };
    else match = { ...match, boards: match.boards.map(items => items.map(card => card.instanceId === latest.instanceId
      ? { ...card, statuses: { ...card.statuses, silenced: true } } : card)) as Match['boards'] };
    return cast({ ...match, playerMotion: 9 }, 'squabblehouse-teknician', 'player', 0, 43);
  };
  for (const destroy of [false, true]) {
    const match = runWithUnavailableLatest(destroy);
    assert.equal(findInstance(match, 'cpu:sqh-test:40:techbro')?.powerModifier, 10,
      'the earlier Griddle reveal repeats after skipping the unavailable latest Security');
    assert.ok(match.effectLog.some(event => event.note.includes('Run It Back')
      && event.note.includes("Griddle Master's On Reveal")));
  }
});

test('Teknician has a clean no-target fallback and never treats Janitor or a dog as repeatable staff', () => {
  let match = cast(blank(), 'squabblehouse-teknician', 'player', 0);
  assert.equal(find(match, 'squabblehouse-teknician')?.squabblehouseTeknicianRevealRound, undefined);
  assert.ok(match.effectLog.some(event => event.note.includes('no eligible friendly Squabblehouse staff')));

  let excluded = blank();
  excluded = withBoard(excluded, unit('janitor', 'player', 0, 1), unit('cane-corso-red', 'player', 0, 2));
  excluded = cast(excluded, 'squabblehouse-teknician', 'player', 0, 3);
  assert.equal(find(excluded, 'squabblehouse-teknician')?.squabblehouseTeknicianRevealRound, undefined);
});

test('Griddle damage scales against Burn and applies damage plus Burn as one hostile package', () => {
  for (const owner of ['player', 'cpu'] as const) {
    const enemy = owner === 'player' ? 'cpu' : 'player';
    let match = blank();
    const target = unit('techbro', enemy, 0, 1);
    target.powerModifier = 10;
    match = withBoard(match, target);
    match = cast(match, 'griddle-master', owner, 0, 2);
    assert.equal(findInstance(match, target.instanceId)?.powerModifier, 7);
    assert.equal(findInstance(match, target.instanceId)?.statuses.burnStacks, 1);
    match = cast(match, 'griddle-master', owner, 0, 3);
    assert.equal(findInstance(match, target.instanceId)?.powerModifier, 2,
      `${owner}: a target already burning takes 5 rather than 3 damage`);
    assert.equal(findInstance(match, target.instanceId)?.statuses.burnStacks, 2);
  }
});

test('Grown-Man Fanboy Griddle redirects scale damage from the actual recipient Burn state', () => {
  for (const [selectedBurn, fanBurn, damage] of [[0, 1, 5], [1, 0, 3]] as const) {
    let target = unit('techbro', 'cpu', 0, 10 + selectedBurn);
    target = { ...target, powerModifier: 20,
      statuses: { ...target.statuses, burnStacks: selectedBurn } };
    const fan = unit('grownfanboy', 'cpu', 0, 20 + fanBurn);
    const interceptor = { ...fan, idolId: target.instanceId, powerModifier: 10,
      statuses: { ...fan.statuses, burnStacks: fanBurn } };
    let match = withBoard(blank(), target, interceptor);

    match = cast(match, 'griddle-master', 'player', 0, 30 + selectedBurn);

    assert.equal(findInstance(match, target.instanceId)?.powerModifier, target.powerModifier,
      'the redirected package leaves the selected idol untouched');
    assert.equal(findInstance(match, interceptor.instanceId)?.powerModifier,
      interceptor.powerModifier - damage);
    assert.equal(findInstance(match, interceptor.instanceId)?.statuses.burnStacks, fanBurn + 1);
  }
});

test('Inmate Reformed gains Hands only with house staff but always checks its strongest enemy', () => {
  let alone = blank();
  const enemy = unit('techbro', 'cpu', 0, 1);
  alone = withBoard(alone, enemy);
  alone = cast(alone, 'inmate-reformed', 'player', 0);
  assert.equal(find(alone, 'inmate-reformed')?.powerModifier, 0);
  assert.equal(findInstance(alone, enemy.instanceId)?.powerModifier, -1);

  let staffed = blank();
  staffed = withBoard(staffed, unit('janitor', 'player', 0, 2));
  staffed = cast(staffed, 'inmate-reformed', 'player', 0);
  assert.equal(find(staffed, 'inmate-reformed')?.powerModifier, 2,
    'an ongoing Janitor counts as house staff for Inmate synergy');
  assert.ok(staffed.effectLog.some(event => event.note.includes('no enemy was here')));
});

test('Janitor retains one shared hostile-effect reversal per district each round', () => {
  let match = blank();
  const janitor = unit('janitor', 'cpu', 1, 1);
  const first = unit('techbro', 'cpu', 1, 2);
  first.basePower = 5; // Keep this reversal target stronger than Hooper regardless of printed balance.
  const second = unit('hooper', 'cpu', 1, 3);
  match = withBoard(match, janitor, first, second);
  match = cast(match, 'squabblehouse-security', 'player', 1);
  assert.equal(findInstance(match, first.instanceId)?.powerModifier, 2,
    'Janitor still reverses the first hostile Hands reduction');
  assert.equal(match.janitorReversals?.filter(item => item.owner === 'cpu' && item.lane === 1 && item.round === 1).length, 1);
  match = cast(match, 'griddle-master', 'player', 1);
  assert.equal(findInstance(match, first.instanceId)?.statuses.burnStacks, 1,
    'the district reversal is spent; later hostile Burn and damage proceed normally');
  assert.equal(match.janitorReversals?.filter(item => item.owner === 'cpu' && item.lane === 1 && item.round === 1).length, 1);
  match = beginNextRound(match);
  assert.equal(match.janitorReversals?.filter(item => item.round === match.round).length ?? 0, 0);
});

test('Squabblehouse wave ability upgrades train from a successful base reveal', () => {
  let match = blank();
  const enemy = unit('techbro', 'cpu', 0, 1);
  enemy.powerModifier = 5;
  match = withBoard(match, enemy);
  match.abilityUpgradeSnapshot = createAbilityUpgradeSnapshot(['squabblehouse-security'], [], {
    player: { 'squabblehouse-security': { level: 2, xp: 100, moveTier: 1 } },
  });
  match = cast(match, 'squabblehouse-security', 'player', 0);
  const security = find(match, 'squabblehouse-security')!;
  assert.equal(security.waveTrainingUsed, true);
  assert.equal(security.powerModifier, 1, 'one unlocked On Reveal upgrade grants +1 Hand');
  assert.ok(match.effectLog.some(event => event.abilityMetadata?.upgradeId === 'squabblehouse-security:upgrade:1'));
});

test('full JSON snapshot replay parity includes dog and Teknician marks and replay frames', () => {
  let match = blank();
  const og = unit('triple-og-red', 'cpu', 2, 1);
  og.powerModifier = 5;
  const dog = unit('cane-corso-red', 'cpu', 0, 2);
  dog.basePower = 4;
  const enemy = unit('techbro', 'cpu', 2, 3);
  dog.basePower = 4;
  match = withBoard(match, og, dog, enemy);
  const before = JSON.stringify(match);
  const first = cast(match, 'griddle-master', 'player', 2);
  const second = cast(JSON.parse(before) as Match, 'griddle-master', 'player', 2);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(JSON.stringify(match), before, 'inputs remain immutable');
  assert.equal(findInstance(first, dog.instanceId)?.squabblehouseGuardRound, 1);
  assert.ok(first.effectLog.some(event => event.replay.after.boards.flat()
    .find(card => card.instanceId === dog.instanceId)?.squabblehouseGuardRound === 1));
  for (const event of replayTransitions(first)) {
    assert.deepEqual(JSON.parse(JSON.stringify(event.replay)), event.replay);
  }

  let staff = blank();
  const enemyStaffTarget = unit('techbro', 'cpu', 0, 10);
  enemyStaffTarget.powerModifier = 10;
  staff = withBoard(staff, enemyStaffTarget);
  staff = cast(staff, 'griddle-master', 'player', 0);
  const tekStart = JSON.stringify(staff);
  const runA = cast(staff, 'squabblehouse-teknician', 'player', 0);
  const runB = cast(JSON.parse(tekStart) as Match, 'squabblehouse-teknician', 'player', 0);
  assert.equal(JSON.stringify(runA), JSON.stringify(runB));
  assert.deepEqual(runA.effectLog.at(-1)?.replay.after.squabblehouseRevealHistory,
    runA.squabblehouseRevealHistory);
});

test('Bus Boy moves only eligible staff, respects movement blocks and open destinations for both owners', () => {
  for (const owner of ['player', 'cpu'] as const) {
    const rival: Owner = owner === 'player' ? 'cpu' : 'player';
    let match = withBoard(blank(), unit('griddle-master', owner, 0, 1));
    match = cast(match, 'squabblehouse-bus-boy', owner, 0, 2);
    const griddle = find(match, 'griddle-master')!;
    assert.equal(griddle.lane, 1, `${owner}: weakest open other district wins the tie`);
    assert.equal(griddle.powerModifier, 1, `${owner}: Hands are awarded only after movement`);
    const moveEvent = match.effectLog.find(event => event.kind === 'move' && event.note.includes('moved from district'));
    assert.ok(moveEvent?.replay.before.boards.flat().some(card => card.instanceId === griddle.instanceId && card.lane === 0));

    for (const blocked of ['frozen', 'locked'] as const) {
      let stopped = withBoard(blank(), unit('griddle-master', owner, 0, 10));
      const target = find(stopped, 'griddle-master')!;
      target.statuses[blocked] = true;
      stopped = cast(stopped, 'squabblehouse-bus-boy', owner, 0, 11);
      assert.equal(findInstance(stopped, target.instanceId)?.lane, 0, `${owner}: ${blocked} staff stays`);
      assert.equal(findInstance(stopped, target.instanceId)?.powerModifier, 0, `${owner}: no reward for blocked movement`);
    }

    let crowded = withBoard(blank(), unit('griddle-master', owner, 0, 20),
      ...[0, 1, 2, 3].map(i => unit('plug', owner, 1, 21 + i)),
      ...[0, 1, 2, 3].map(i => unit('cornball', owner, 2, 30 + i)));
    const crowdedStaff = find(crowded, 'griddle-master')!;
    crowded = cast(crowded, 'squabblehouse-bus-boy', owner, 0, 40);
    assert.equal(findInstance(crowded, crowdedStaff.instanceId)?.lane, 0, `${owner}: full destinations are skipped`);
    assert.equal(findInstance(crowded, crowdedStaff.instanceId)?.powerModifier, 0);
    assert.equal(crowded.boards.flat().filter(card => card.cardId === 'squabblehouse-bus-boy').length, 1);
    assert.equal(rival === owner, false);
  }
});

test('Bus Boy replay frames preserve movement, Security arrival, and the later +1 reward as adjacent transitions', () => {
  const staff = unit('griddle-master', 'player', 0, 1);
  const security = unit('squabblehouse-security', 'cpu', 1, 2);
  let match = withBoard(blank(), staff, security);
  match = cast(match, 'squabblehouse-bus-boy', 'player', 0, 3);

  const moveIndex = match.effectLog.findIndex(event => event.kind === 'move'
    && event.note.includes('moved from district 1 to district 2.'));
  const securityIndex = match.effectLog.findIndex(event => event.note.includes('Keep the Peace: the first enemy played or moved'));
  const rewardIndex = match.effectLog.findIndex(event => event.note.includes('after arrival effects'));
  assert(moveIndex >= 0 && moveIndex < securityIndex && securityIndex < rewardIndex,
    'movement settles before Security, and the Bus Boy reward resolves afterward');

  const moveEvent = match.effectLog[moveIndex];
  const securityEvent = match.effectLog[securityIndex];
  const rewardEvent = match.effectLog[rewardIndex];
  const stateOf = (event: typeof moveEvent, side: 'before' | 'after') =>
    event.replay[side].boards.flat().find(card => card.instanceId === staff.instanceId);
  assert.equal(stateOf(moveEvent, 'before')?.lane, 0);
  assert.equal(stateOf(moveEvent, 'after')?.lane, 1);
  assert.equal(stateOf(moveEvent, 'after')?.powerModifier, 0);
  assert.equal(stateOf(securityEvent, 'before')?.lane, 1);
  assert.equal(stateOf(securityEvent, 'before')?.powerModifier, 0);
  assert.equal(stateOf(securityEvent, 'after')?.powerModifier, -1);
  assert.equal(stateOf(rewardEvent, 'before')?.powerModifier, -1);
  assert.equal(stateOf(rewardEvent, 'after')?.powerModifier, 0);

  const frames = match.effectLog.slice(moveIndex, rewardIndex + 2);
  for (let index = 1; index < frames.length; index++) {
    assert.deepEqual(frames[index - 1].replay.after, frames[index].replay.before,
      `adjacent replay frames ${index - 1} and ${index} must be continuous`);
  }
});

test('Waffle Warlord keeps its +2 full-coverage payout and excludes itself and nonstaff', () => {
  for (const owner of ['player', 'cpu'] as const) {
    let match = withBoard(blank(),
      unit('griddle-master', owner, 0, 1), unit('inmate-reformed', owner, 0, 2),
      unit('squabblehouse-security', owner, 1, 3), unit('squabblehouse-cashier', owner, 2, 4));
    const weakest = ['griddle-master', 'inmate-reformed', 'squabblehouse-security', 'squabblehouse-cashier']
      .map(id => find(match, id)!);
    weakest.forEach((card, index) => { card.powerModifier = index; });
    match = cast(match, 'waffle-warlord', owner, 0, 5);
    assert.deepEqual(weakest.map(card => findInstance(match, card.instanceId)?.powerModifier),
      [2, 1, 4, 5], `${owner}: source is excluded and the weakest ally gets the single district bonus`);

    let incomplete = withBoard(blank(), unit('triple-og-blue', owner, 2, 10), unit('blue-nose-pit', owner, 1, 11));
    incomplete = cast(incomplete, 'waffle-warlord', owner, 0, 12);
    assert.equal(find(incomplete, 'waffle-warlord')?.powerModifier, 0, 'OG and dog do not count as diner staff');
  }
});

test('Waffle Warlord pays +1 to the weakest other staff with only one or two staffed districts', () => {
  for (const owner of ['player', 'cpu'] as const) for (const staffedLanes of [1, 2]) {
    const enemy = owner === 'player' ? 'cpu' : 'player';
    const weakest = unit('griddle-master', owner, 0, 30);
    const stronger = unit('squabblehouse-security', owner, 0, 31);
    const nonstaff = unit('cornball', owner, 0, 32);
    const dog = unit('blue-nose-pit', owner, 2, 33);
    const rivalStaff = unit('squabblehouse-cashier', enemy, 2, 34);
    const remote = unit('squabblehouse-cashier', owner, 1, 35);
    const before = withBoard(blank(), weakest, stronger, nonstaff, dog, rivalStaff,
      ...(staffedLanes === 2 ? [remote] : []));
    const snapshot = JSON.stringify(before);
    const after = cast(before, 'waffle-warlord', owner, 0, 36);
    assert.equal(findInstance(after, weakest.instanceId)?.powerModifier, 1,
      `${owner}/${staffedLanes}: partial coverage has a useful payoff`);
    for (const untouched of [stronger, nonstaff, dog, rivalStaff]) {
      assert.equal(findInstance(after, untouched.instanceId)?.powerModifier, 0,
        'only the weakest other friendly employee per district gets the bonus');
    }
    if (staffedLanes === 2) assert.equal(findInstance(after, remote.instanceId)?.powerModifier, 1);
    assert.equal(find(after, 'waffle-warlord')?.powerModifier, 0, 'Warlord never receives its own base bonus');
    assert.equal(JSON.stringify(before), snapshot, 'resolution preserves the input snapshot');
    assert.deepEqual(cast(JSON.parse(snapshot) as Match, 'waffle-warlord', owner, 0, 36), after,
      'partial coverage replays deterministically for either owner');
  }
});

test('Waffle Warlord counts its own occupied district but still buffs only other staff', () => {
  for (const owner of ['player', 'cpu'] as const) {
    const before = withBoard(blank(),
      unit('griddle-master', owner, 1, 40), unit('squabblehouse-cashier', owner, 2, 41));
    const after = cast(before, 'waffle-warlord', owner, 0, 42);
    assert.equal(find(after, 'griddle-master')?.powerModifier, 2);
    assert.equal(find(after, 'squabblehouse-cashier')?.powerModifier, 2);
    assert.equal(find(after, 'waffle-warlord')?.powerModifier, 0);
  }
});

test('A Side of Hands is ephemeral support with independent halves, protection, and friendly-only upgrade targeting', () => {
  for (const owner of ['player', 'cpu'] as const) {
    const rival: Owner = owner === 'player' ? 'cpu' : 'player';
    const ally = unit('griddle-master', owner, 0, 1);
    const enemy = unit('techbro', rival, 0, 2);
    enemy.powerModifier = 8;
    let match = withBoard(blank(), ally, enemy);
    match.abilityUpgradeSnapshot = createAbilityUpgradeSnapshot(
      owner === 'player' ? ['sideofhands'] : [],
      owner === 'cpu' ? ['sideofhands'] : [],
      {
      ...(owner === 'player' ? { player: { sideofhands: { level: 2, xp: 100, moveTier: 1 } } } : {}),
      ...(owner === 'cpu' ? { cpu: { sideofhands: { level: 2, xp: 100, moveTier: 1 } } } : {}),
      },
    );
    match = cast(match, 'sideofhands', owner, 0, 3);
    assert.equal(findInstance(match, ally.instanceId)?.powerModifier, 3, 'friendly effect and its upgrade land on ally');
    assert.equal(findInstance(match, enemy.instanceId)?.powerModifier, 6, 'declared -2 receives no Earth matchup bonus');
    assert.equal(match.boards.flat().some(card => card.cardId === 'sideofhands'), false, 'support leaves after resolution');
    assert.equal(match.effectLog.some(event => event.abilityMetadata?.sourceCardId === 'sideofhands'
      && event.abilityMetadata.targetInstanceIds[0] === ally.instanceId), true);
    assert.equal(match.squabblehouseRevealHistory?.some(entry => entry.cardId === 'sideofhands') ?? false, false);

    let buffOnly = withBoard(blank(), unit('griddle-master', owner, 0, 10));
    buffOnly = cast(buffOnly, 'sideofhands', owner, 0, 11);
    assert.equal(find(buffOnly, 'griddle-master')?.powerModifier, 2);
    assert.equal(buffOnly.boards.flat().some(card => card.cardId === 'sideofhands'), false);

    let debuffOnly = withBoard(blank(), unit('techbro', rival, 0, 12));
    const onlyEnemy = find(debuffOnly, 'techbro')!;
    onlyEnemy.powerModifier = 8;
    debuffOnly = cast(debuffOnly, 'sideofhands', owner, 0, 13);
    assert.equal(findInstance(debuffOnly, onlyEnemy.instanceId)?.powerModifier, 6);
    assert.equal(debuffOnly.effectLog.some(event => event.abilityMetadata?.sourceCardId === 'sideofhands'), false,
      'enemy-only success never grants a friendly-target upgrade');

    const shieldedEnemy = unit('techbro', rival, 0, 14);
    shieldedEnemy.powerModifier = 8;
    shieldedEnemy.statuses.protected = true;
    let shielded = withBoard(blank(), unit('griddle-master', owner, 0, 15), shieldedEnemy);
    shielded.timedEffects = [{ id: 'side-shield', kind: 'church-protection',
      sourceInstanceId: shieldedEnemy.instanceId, targetInstanceId: shieldedEnemy.instanceId,
      owner: rival, lane: 0, startsAtRound: 1, expiresAtRound: 99, expiration: 'match-complete' }];
    shielded = cast(shielded, 'sideofhands', owner, 0, 16);
    assert.equal(findInstance(shielded, shieldedEnemy.instanceId)?.powerModifier, 8);
    assert.equal(find(shielded, 'griddle-master')?.powerModifier, 2, 'hostile protection does not cancel the friendly buff');

    let noTargets = cast(blank(), 'sideofhands', owner, 0, 17);
    assert.equal(noTargets.boards.flat().some(card => card.cardId === 'sideofhands'), false);
    assert.equal(noTargets.effectLog.some(event => event.abilityMetadata?.sourceCardId === 'sideofhands'), false,
      'both missing targets means no successful ability upgrade');
  }
  const card = cards.sideofhands;
  assert.equal(card.kind, 'support');
  assert.equal(cardCatalog.find(entry => entry.engineId === 'sideofhands')?.acquisitionSources.includes('Street Packs'), true);
});

test('support side cannot SQUABBLE and Tek echoes new diner staff reveals from history deterministically', () => {
  const source = unit('sideofhands', 'player', 0, 1);
  assert.throws(() => playTurnCard({ ...blank(), playerHand: [source] }, 'player', source.instanceId, 0, true), /Support cards cannot use SQUABBLE/);
  const run = () => {
    let match = withBoard(blank(), unit('griddle-master', 'player', 0, 2), unit('inmate-reformed', 'player', 0, 3));
    match = cast(match, 'squabblehouse-bus-boy', 'player', 0, 4);
    match = cast(match, 'squabblehouse-teknician', 'player', 2, 5);
    assert(match.squabblehouseRevealHistory?.some(entry => entry.cardId === 'squabblehouse-bus-boy'));
    assert(match.effectLog.some(event => event.note.includes('Run It Back') && event.note.includes('Bus Boy')));
    return match;
  };
  const first = run();
  const second = run();
  assert.equal(JSON.stringify(first), JSON.stringify(second), 'remote-lane replay and echo stay deterministic');
});