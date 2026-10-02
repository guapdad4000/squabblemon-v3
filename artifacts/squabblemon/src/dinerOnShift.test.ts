import assert from 'node:assert/strict';
import test from 'node:test';
import { cards, decks } from './data';
import { totalXpForCardLevel } from '@workspace/squabblemon-engine/cardProgression';
import { afterHoursWaveRarities } from '../../../lib/squabblemon-engine/src/afterHoursWave';
import {
  createAbilityUpgradeSnapshot,
  createCardInstance,
  createMatch,
  createDistrictSnapshot,
  getDistrictResults,
  getEffectiveCardPower,
  getLegalCardCost,
  nextRound,
  playTurnCard,
  type CardInstance,
  type Lane,
  type Match,
  type Owner,
} from './gameEngine';

const emptyStatuses = () => ({
  frozen: false, silenced: false, protected: false, blocked: false, uncounterable: false,
  weakened: false, locked: false, boosted: false, burnStacks: 0,
});

const blank = (): Match => {
  const match = createMatch('block', 'block');
  return {
    ...match,
    round: 1,
    phase: 'player',
    playerMotion: 9,
    cpuMotion: 9,
    boards: [[], [], []],
    playerHand: [],
    cpuHand: [],
    playerCardIds: [],
    cpuCardIds: [],
    playerDrawIndex: 0,
    cpuDrawIndex: 0,
    districtTraps: [],
    timedEffects: [],
    effectLog: [],
    nextEventSequence: 1,
    roundMovedIds: { player: [], cpu: [] },
  };
};

function character(
  cardId: string,
  owner: Owner,
  lane: Lane,
  index: number,
  patch: Partial<CardInstance> = {},
): CardInstance {
  return {
    ...createCardInstance(cardId, owner, 'diner-on-shift-test', index),
    lane,
    playedRound: 1,
    ...patch,
  };
}

function withBoard(match: Match, ...boardCards: CardInstance[]): Match {
  return {
    ...match,
    boards: [0, 1, 2].map(lane =>
      boardCards.filter(card => card.lane === lane)) as Match['boards'],
  };
}

const instance = (match: Match, instanceId: string) =>
  match.boards.flat().find(card => card.instanceId === instanceId);
const card = (match: Match, cardId: string, owner?: Owner) =>
  match.boards.flat().find(item => item.cardId === cardId && (!owner || item.owner === owner));

function play(
  match: Match,
  cardId: string,
  owner: Owner,
  targetLane: Lane,
  index: number,
  patch: Partial<CardInstance> = {},
): Match {
  const source = { ...createCardInstance(cardId, owner, 'diner-on-shift-test', index), ...patch };
  return playTurnCard({
    ...match,
    phase: owner === 'player' ? 'player' : 'cpu-reveal',
    [owner === 'player' ? 'playerHand' : 'cpuHand']: [source],
    [owner === 'player' ? 'playerMotion' : 'cpuMotion']: 9,
  }, owner, source.instanceId, targetLane, false);
}

/** Advance through the engine's actual round-start pipeline, not a card-specific test hook. */
function nextRealRound(match: Match): Match {
  return nextRound({
    ...match,
    phase: 'resolved',
    playerHand: [],
    cpuHand: [],
    playerCardIds: [],
    cpuCardIds: [],
    playerDrawIndex: 0,
    cpuDrawIndex: 0,
  });
}

function managerUpgradeSnapshot(): Match['abilityUpgradeSnapshot'] {
  const allIds = Object.keys(cards);
  const playerIds = ['squabble-house-manager', ...allIds.filter(id => id !== 'squabble-house-manager')].slice(0, 10);
  const cpuIds = allIds.filter(id => !playerIds.includes(id)).slice(0, 10);
  return createAbilityUpgradeSnapshot(playerIds, cpuIds, {
    player: {
      'squabble-house-manager': {
        level: 2,
        xp: totalXpForCardLevel(2),
      },
    },
  });
}

test('the Diner Manager and Bus Boy use their approved printed cost and Hands values', () => {
  const match = blank();
  const manager = createCardInstance('squabble-house-manager', 'player');
  const busBoy = createCardInstance('squabblehouse-bus-boy', 'player');

  assert.equal(afterHoursWaveRarities['squabble-house-manager'], 'Legendary');
  assert.deepEqual([manager.cost, manager.power], [1, 2]);
  assert.deepEqual([busBoy.cost, busBoy.power], [1, 2]);
  assert.equal(getLegalCardCost(match, 'player', manager, 0), 1);
  assert.equal(getLegalCardCost(match, 'player', busBoy, 0), 1);

  const starter = decks.find(deck => deck.id === 'block');
  assert.ok(starter);
  assert.equal(starter.cards.length, 10, 'the existing ten-card starter recipe is not expanded by the diner release');
  assert.ok(!starter.cards.includes('squabble-house-manager'));
  assert.ok(!starter.cards.includes('squabblehouse-bus-boy'));
});

test('Manager Home Advantage retains its enemy-here reveal bonus and never counts its own side as enemies', () => {
  for (const owner of ['player', 'cpu'] as const) {
    const enemy: Owner = owner === 'player' ? 'cpu' : 'player';
    let match = withBoard(blank(), character('squabblecook', owner, 1, 1));
    match = play(match, 'squabble-house-manager', owner, 1, 2);
    let manager = card(match, 'squabble-house-manager', owner)!;
    assert.equal(manager.powerModifier, 0, `${owner}: a friendly board presence is not an enemy`);

    match = play(blank(), 'hooper', enemy, 1, 3);
    match = play(match, 'squabble-house-manager', owner, 1, 4);
    manager = card(match, 'squabble-house-manager', owner)!;
    assert.equal(manager.powerModifier, 1, `${owner}: an enemy in the reveal district grants the printed +1 Hand`);
    assert.equal(manager.waveTrainingUsed, true, 'the successful reveal remains eligible for the existing one-time upgrade');
  }
});

test('Manager counts every other friendly staff member across the board as a live, derived aura', () => {
  const male = character('squabblecook', 'player', 0, 11, {
    basePower: 2,
    statuses: { ...emptyStatuses(), blocked: true },
  });
  const female = character('squabbleserver', 'player', 0, 12, {
    statuses: { ...emptyStatuses(), frozen: true, weakened: true },
  });
  const firstSecurity = character('squabblehouse-security', 'player', 2, 13, {
    statuses: { ...emptyStatuses(), silenced: true },
  });
  const duplicateSecurity = character('squabblehouse-security', 'player', 2, 14, {
    statuses: { ...emptyStatuses(), locked: true },
  });
  const friendlySupport = {
    ...character('sideofhands', 'player', 1, 15),
    kind: 'support' as const,
  };
  const friendlyHazard = {
    ...character('cornball', 'player', 1, 16),
    hazard: true,
    kind: 'token' as const,
  };
  const enemyStaff = character('squabblecook', 'cpu', 0, 17);
  const waitingBoard = withBoard(blank(), male, female, firstSecurity, duplicateSecurity,
    friendlySupport, friendlyHazard, enemyStaff);
  const original = play(waitingBoard, 'squabble-house-manager', 'player', 1, 10);
  const manager = card(original, 'squabble-house-manager', 'player')!;
  const before = JSON.stringify(original);

  // Four other allied staff count, including both legacy workers, a silenced/frozen employee,
  // and a duplicate identity. Support, hazards, and opposing staff are not employees.
  assert.equal(getDistrictResults(original)[1].player, manager.basePower + 4);
  assert.equal(getEffectiveCardPower(manager), manager.basePower + 4,
    'the public effective-power API includes the live derived bonus');
  assert.equal(instance(original, manager.instanceId)?.powerModifier, 0,
    'the ongoing bonus is derived, not a permanent powerModifier');
  for (const employee of [male, female, firstSecurity, duplicateSecurity]) {
    const liveEmployee = instance(original, employee.instanceId)!;
    assert.equal(liveEmployee.continuousPower, undefined,
      `${liveEmployee.cardId}: the Manager aura is not assigned to its employees`);
    assert.equal(liveEmployee.powerModifier, employee.powerModifier,
      `${liveEmployee.cardId}: staff do not inherit the Manager's permanent Hands`);
  }
  const repeatedScores = [getDistrictResults(original), getDistrictResults(original), getDistrictResults(original)];
  assert.deepEqual(repeatedScores[1], repeatedScores[0]);
  assert.deepEqual(repeatedScores[2], repeatedScores[0]);
  assert.equal(JSON.stringify(original), before, 'score/render reads never mutate the match');

  for (const [index, disabledStatus] of ['frozen', 'silenced', 'weakened'].entries()) {
    const disabled = play(waitingBoard, 'squabble-house-manager', 'player', 1, 19 + index * 2, {
      statuses: { ...emptyStatuses(), [disabledStatus]: true },
    });
    const disabledManager = card(disabled, 'squabble-house-manager', 'player')!;
    assert.equal(getDistrictResults(disabled)[1].player,
      disabledStatus === 'frozen' ? 0 : manager.basePower,
      `${disabledStatus} disables the Manager's own aura`);
    const reenabled = {
      ...disabled,
      boards: disabled.boards.map(lane => lane.map(item => item.instanceId === disabledManager.instanceId
        ? { ...item, statuses: { ...item.statuses, [disabledStatus]: false } }
        : item)) as Match['boards'],
    };
    const reenabledAfterAction = play(reenabled, 'cornball', 'player', 0, 20 + index * 2);
    assert.equal(getDistrictResults(reenabledAfterAction)[1].player, manager.basePower + 4,
      `${disabledStatus}: reenabling restores the live count`);
    assert.equal(getEffectiveCardPower(instance(reenabledAfterAction, disabledManager.instanceId)!),
      manager.basePower + 4);
  }

  const employeeReturned = play(original, 'dorothy', 'player', 2, 21);
  assert.equal(instance(employeeReturned, female.instanceId), undefined,
    'Dorothy returns the disabled legacy employee to hand');
  assert.ok(employeeReturned.playerHand.some(item => item.instanceId === female.instanceId));
  const managerAfterReturn = instance(employeeReturned, manager.instanceId)!;
  assert.equal(managerAfterReturn.powerModifier, 0);
  assert.equal(getEffectiveCardPower(managerAfterReturn), manager.basePower + 3,
    'leaving the board removes that employee from the live aura');

  const doomedEmployee = character('squabbleserver', 'player', 0, 22, { basePower: 1 });
  const beforeDeath = play(withBoard(blank(), doomedEmployee), 'squabble-house-manager', 'player', 2, 23);
  const survivingManager = card(beforeDeath, 'squabble-house-manager', 'player')!;
  assert.equal(getEffectiveCardPower(survivingManager), survivingManager.basePower + 1);
  const afterDeath = play(beforeDeath, 'griddle-master', 'cpu', 0, 24);
  assert.equal(instance(afterDeath, doomedEmployee.instanceId), undefined,
    'a real hostile damage action destroys the legacy employee');
  assert.equal(getEffectiveCardPower(instance(afterDeath, survivingManager.instanceId)!),
    survivingManager.basePower, 'employee death removes its live contribution immediately');

  // A regular unrelated action and repeated projections cannot turn the aura into permanent growth.
  const acted = play(original, 'cornball', 'player', 0, 25);
  assert.equal(instance(acted, manager.instanceId)?.powerModifier, 0);
  assert.equal(getDistrictResults(acted)[1].player, manager.basePower + 4);
  assert.equal(getDistrictResults(acted)[1].player, manager.basePower + 4);
  assert.equal(instance(acted, manager.instanceId)?.powerModifier, 0);
});

test('Manager-derived Hands participate in highest damage, lowest cleanse, and district scoring', () => {
  const legacies = [
    character('squabblecook', 'cpu', 1, 21),
    character('squabbleserver', 'cpu', 2, 22),
    character('janitor', 'cpu', 2, 23),
  ];
  const strongerWithoutAura = character('techbro', 'cpu', 0, 24, { basePower: 4 });
  const beforeDamage = play(withBoard(blank(), ...legacies, strongerWithoutAura),
    'squabble-house-manager', 'cpu', 0, 20);
  const manager = card(beforeDamage, 'squabble-house-manager', 'cpu')!;
  assert.equal(getDistrictResults(beforeDamage)[0].cpu,
    manager.basePower + manager.powerModifier + legacies.length + strongerWithoutAura.basePower);

  // The aura makes the Manager the strongest target even though its printed Hands are lower.
  let hit = play(beforeDamage, 'inmate-reformed', 'player', 0, 25);
  assert.equal(instance(hit, manager.instanceId)?.powerModifier, -1,
    'an enemy ability lands exactly its printed one-Hand loss on the aura-powered Manager');
  assert.equal(instance(hit, strongerWithoutAura.instanceId)?.powerModifier, 0);

  const employeeMale = character('squabblecook', 'cpu', 1, 26, { basePower: 1 });
  const employeeFemale = character('squabbleserver', 'cpu', 1, 27, { basePower: 1 });
  let afterEntry = play(withBoard(blank(), employeeMale, employeeFemale,
    character('techbro', 'cpu', 0, 28, { basePower: 3 })),
    'squabble-house-manager', 'cpu', 0, 29);
  const entryManager = card(afterEntry, 'squabble-house-manager', 'cpu')!;
  afterEntry = play(afterEntry, 'inmate-reformed', 'player', 0, 30);
  assert.equal(instance(afterEntry, entryManager.instanceId)?.powerModifier, -1,
    'the active aura selects the Manager as strongest when an enemy enters');
  assert.equal(getEffectiveCardPower(instance(afterEntry, entryManager.instanceId)!), 3);

  afterEntry = play(afterEntry, 'griddle-master', 'player', 1, 31);
  assert.equal(instance(afterEntry, employeeMale.instanceId), undefined,
    'a hostile action removes one canonical employee from the board');
  const afterDeathManager = instance(afterEntry, entryManager.instanceId)!;
  assert.equal(afterDeathManager.powerModifier, -1,
    'losing an employee removes derived aura, not an extra point of permanent enemy damage');
  assert.equal(getEffectiveCardPower(afterDeathManager), 2);
  const attackedAfterDeath = play(afterEntry, 'squabblehouse-security', 'player', 0, 32);
  assert.equal(instance(attackedAfterDeath, 'cpu:diner-on-shift-test:28:techbro')?.powerModifier, -2,
    'after an employee dies, strongest-target selection switches to the remaining stronger ally');
  assert.equal(instance(attackedAfterDeath, entryManager.instanceId)?.powerModifier, -1,
    'passive aura loss neither damages nor takes attribution from the Manager');

  const coworkers = [
    character('squabblecook', 'player', 1, 31),
    character('squabbleserver', 'player', 2, 32),
    character('janitor', 'player', 0, 33),
  ];
  const weakerAffectedAlly = character('hooper', 'player', 0, 34, {
    basePower: 4,
    statuses: { ...emptyStatuses(), burnStacks: 1 },
  });
  const beforeCleanse = play(withBoard(blank(), ...coworkers, weakerAffectedAlly),
    'squabble-house-manager', 'player', 0, 30, {
      statuses: { ...emptyStatuses(), burnStacks: 2 },
    });
  const managerToCleanse = card(beforeCleanse, 'squabble-house-manager', 'player')!;
  const cleaned = play(beforeCleanse, 'squabbleserver', 'player', 0, 35);
  assert.equal(instance(cleaned, weakerAffectedAlly.instanceId)?.statuses.burnStacks, 0,
    'Fresh Pot cleanses the weaker affected ally selected after the live Manager aura');
  assert.equal(instance(cleaned, managerToCleanse.instanceId)?.statuses.burnStacks, 2,
    'the aura-adjusted stronger Manager is not incorrectly selected as the weakest affected ally');

  const frozenAndBurning = character('hooper', 'player', 0, 36, {
    statuses: { ...emptyStatuses(), frozen: true, burnStacks: 2 },
  });
  const freshPot = play(withBoard(blank(), frozenAndBurning), 'squabbleserver', 'player', 0, 37);
  assert.equal(instance(freshPot, frozenAndBurning.instanceId)?.statuses.frozen, false);
  assert.equal(instance(freshPot, frozenAndBurning.instanceId)?.statuses.burnStacks, 0,
    'legacy Female Fresh Pot retains its original Freeze-and-Burn cleanse');
});

test('Manager taxes only the first enemy character played or moved into its district each round', () => {
  for (const owner of ['player', 'cpu'] as const) {
    const enemy: Owner = owner === 'player' ? 'cpu' : 'player';
    for (const firstArrival of ['played', 'moved'] as const) {
      let match = play(blank(), 'squabble-house-manager', owner, 1, 40);
      const manager = card(match, 'squabble-house-manager', owner)!;

      let firstId: string;
      if (firstArrival === 'played') {
        match = play(match, 'hooper', enemy, 1, 41);
        firstId = `${enemy}:diner-on-shift-test:41:hooper`;
      } else {
        const patrol = character('squabblehouse-bus-boy', enemy, 0, 42);
        match = withBoard(match, ...match.boards.flat(), patrol);
        match = nextRealRound(match);
        firstId = patrol.instanceId;
        assert.equal(instance(match, firstId)?.lane, 1, `${owner}: the enemy patrol entered the Manager's district`);
      }
      assert.equal(instance(match, firstId)?.powerModifier, -1,
        `${owner}: the first enemy arrival takes one Hand, regardless of its printed Hands`);

      match = play(match, 'techbro', enemy, 1, 43, { basePower: 30 });
      assert.equal(instance(match, `${enemy}:diner-on-shift-test:43:techbro`)?.powerModifier, 0,
        `${owner}: a later, stronger enemy is not retargeted in the same round`);
      assert.equal(instance(match, manager.instanceId)?.powerModifier, 0,
        'the arrival tax does not become permanent Manager growth');
    }
  }
});

test('Manager arrival tax respects Protection, Hands-loss immunity, and Janitor reversal without phantom training', () => {
  let protectedMatch = play({ ...blank(), abilityUpgradeSnapshot: managerUpgradeSnapshot() },
    'squabble-house-manager', 'player', 1, 50);
  const manager = card(protectedMatch, 'squabble-house-manager', 'player')!;
  const protectedId = 'cpu:diner-on-shift-test:51:hooper';
  protectedMatch = { ...protectedMatch, timedEffects: [{
    id: 'diner-arrival-protection', kind: 'church-protection', sourceInstanceId: protectedId,
    targetInstanceId: protectedId, owner: 'cpu', lane: 1, startsAtRound: 1,
    expiresAtRound: 99, expiration: 'match-complete',
  }] };
  protectedMatch = play(protectedMatch, 'hooper', 'cpu', 1, 51, {
    statuses: { ...emptyStatuses(), protected: true },
  });
  assert.equal(instance(protectedMatch, 'cpu:diner-on-shift-test:51:hooper')?.powerModifier, 0);
  assert.equal(instance(protectedMatch, manager.instanceId)?.waveTrainingUsed, undefined);

  let immuneMatch = play(blank(), 'squabble-house-manager', 'player', 0, 50);
  immuneMatch = play(immuneMatch, 'triple-og-blue', 'cpu', 0, 52);
  assert.equal(instance(immuneMatch, 'cpu:diner-on-shift-test:52:triple-og-blue')?.powerModifier, 0,
    'canonical Hands-loss immunity still wins over the Manager trigger');

  let trained = {
    ...blank(),
    abilityUpgradeSnapshot: managerUpgradeSnapshot(),
  };
  trained = play(trained, 'squabble-house-manager', 'player', 1, 50);
  trained = withBoard(trained, ...trained.boards.flat(), character('janitor', 'cpu', 1, 53));
  const reversed = play(trained, 'hooper', 'cpu', 1, 54);
  const entrant = instance(reversed, 'cpu:diner-on-shift-test:54:hooper')!;
  const liveManager = instance(reversed, manager.instanceId)!;
  assert.equal(entrant.powerModifier, 2, 'Janitor reverses the attempted loss and awards its existing +2 Hands');
  assert.equal(liveManager.waveTrainingUsed, undefined,
    'a reversed Manager tax is not committed ability success and grants no upgrade flag');
  assert.equal(liveManager.powerModifier, 0);
  assert.ok(reversed.effectLog.some(event => event.note.includes('Turn It Around negated')
    && event.targets.some(target => target.cardInstanceId === entrant.instanceId)));
  const secondEntrant = play(reversed, 'cornball', 'cpu', 1, 55);
  assert.equal(instance(secondEntrant, 'cpu:diner-on-shift-test:55:cornball')?.powerModifier, 0,
    'the attempted Manager source is already spent for this round even though Janitor reversed its tax');
});

test('duplicate Managers choose one arrival source and do not stack multiple taxes on the same character', () => {
  let match = play(blank(), 'squabble-house-manager', 'player', 1, 56);
  match = play(match, 'squabble-house-manager', 'player', 1, 57);
  const firstManager = instance(match, 'player:diner-on-shift-test:56:squabble-house-manager')!;
  assert.equal(getEffectiveCardPower(firstManager), firstManager.basePower + 1,
    'a duplicate Manager is another friendly staff member for the ongoing aura');

  match = play(match, 'hooper', 'cpu', 1, 58);
  assert.equal(instance(match, 'cpu:diner-on-shift-test:58:hooper')?.powerModifier, -1,
    'the selected Manager source taxes an entrant once; duplicate sources do not double-tax it');
});

test('a Scammer can copy the Manager passive without becoming an employee for a real Manager', () => {
  let match = play(blank(), 'squabble-house-manager', 'cpu', 0, 59);
  const realManager = card(match, 'squabble-house-manager', 'cpu')!;
  const rivalManager = character('squabble-house-manager', 'player', 1, 60);
  match = withBoard(match, ...match.boards.flat(), rivalManager);
  match = play(match, 'scammer', 'cpu', 1, 61);

  const copiedManager = instance(match, 'cpu:diner-on-shift-test:61:scammer')!;
  const liveRealManager = instance(match, realManager.instanceId)!;
  assert.equal(copiedManager.copiedAbilityCardId, 'squabble-house-manager',
    'Scammer adopts the copied ongoing Manager ability');
  assert.equal(copiedManager.continuousPower, 1,
    'the copied passive can count the real friendly Manager as its employee');
  assert.equal(liveRealManager.continuousPower, undefined,
    'the copied Scammer is not itself a canonical employee for the real Manager');
  assert.equal(getEffectiveCardPower(liveRealManager), liveRealManager.basePower);
});

test('Bus Boy patrol is free, adjacent, deterministic, and naturally reverses at both ends', () => {
  for (const owner of ['player', 'cpu'] as const) {
    let match = withBoard(blank(), character('squabblehouse-bus-boy', owner, 0, 60));
    const busBoyId = `${owner}:diner-on-shift-test:60:squabblehouse-bus-boy`;
    assert.equal(instance(match, busBoyId)?.powerModifier, 0);
    for (const expectedLane of [1, 2, 1, 0] as const) {
      match = JSON.parse(JSON.stringify(nextRealRound(match))) as Match;
      assert.equal(match.round >= 2, true);
      assert.equal(instance(match, busBoyId)?.lane, expectedLane,
        `${owner}: round-start patrol advances one adjacent lane and reverses at an endpoint`);
      assert.equal(instance(match, busBoyId)?.powerModifier, 0,
        'walking itself is free and does not accumulate a movement bonus');
    }
  }
});

test('Bus Boy Clear the Table still relocates the weakest other staff and grants +1 only after success', () => {
  for (const owner of ['player', 'cpu'] as const) {
    const passenger = character('squabblecook', owner, 0, 65);
    let successful = withBoard(blank(), passenger);
    successful = play(successful, 'squabblehouse-bus-boy', owner, 0, 66);
    assert.equal(instance(successful, `${owner}:diner-on-shift-test:66:squabblehouse-bus-boy`)?.powerModifier, 0,
      `${owner}: the Bus Boy does not earn a patrol bonus from its play/Clear the Table action`);
    const movedPassenger = instance(successful, passenger.instanceId)!;
    assert.equal(movedPassenger.lane, 1, `${owner}: the weakest staff moves to its weakest legal district`);
    assert.equal(movedPassenger.powerModifier, 1, `${owner}: a successful Clear the Table move grants +1 Hand`);

    const blockedPassenger = character('squabblecook', owner, 0, 67);
    let blocked = withBoard(blank(), blockedPassenger);
    blocked.storyRuntime = {
      activePhaseIndex: 0,
      appliedEffectIds: [],
      lanePowerBonuses: [],
      laneLocks: [{ owner, lanes: [1, 2] }],
    };
    blocked = play(blocked, 'squabblehouse-bus-boy', owner, 0, 68);
    assert.equal(instance(blocked, blockedPassenger.instanceId)?.lane, 0);
    assert.equal(instance(blocked, blockedPassenger.instanceId)?.powerModifier, 0,
      `${owner}: a rejected route gives no phantom relocation bonus`);
  }
});

test('Bus Boy arrival clears only Weakened from every other allied character, then buffs the weakest after cleansing', () => {
  for (const owner of ['player', 'cpu'] as const) {
    const busBoy = character('squabblehouse-bus-boy', owner, 0, 70);
    const weakest = character('squabbleserver', owner, 1, 71, {
      statuses: { ...emptyStatuses(), weakened: true, locked: true },
    });
    const middle = character('hooper', owner, 1, 72, {
      statuses: { ...emptyStatuses(), weakened: true, protected: true },
    });
    const strongest = character('techbro', owner, 1, 73, {
      statuses: { ...emptyStatuses(), weakened: true, locked: true },
    });
    let match = withBoard(blank(), busBoy, weakest, middle, strongest);

    match = nextRealRound(match);
    const liveWeakest = instance(match, weakest.instanceId)!;
    assert.equal(instance(match, busBoy.instanceId)?.lane, 1);
    for (const ally of [weakest, middle, strongest]) {
      assert.equal(instance(match, ally.instanceId)?.statuses.weakened, false,
        `${owner}: cleanse reaches allied characters from any faction`);
    }
    assert.equal(liveWeakest.powerModifier, 1,
      `${owner}: after cleansing, the weakest other ally receives +1 Hand`);
    assert.equal(liveWeakest.statuses.locked, true, 'unrelated status flags are preserved');
    assert.equal(instance(match, middle.instanceId)?.statuses.protected, true);
    assert.equal(instance(match, strongest.instanceId)?.statuses.locked, true);
    assert.equal(instance(match, middle.instanceId)?.powerModifier, 0);
    assert.equal(instance(match, strongest.instanceId)?.powerModifier, 0);
  }
});

test('a blocked Bus Boy route never advances, skips a lane later, or grants an arrival reward', () => {
  for (const block of ['frozen', 'locked', 'detained', 'capacity', 'story-lock', 'open-tab'] as const) {
    const busBoy = character('squabblehouse-bus-boy', 'player', 0, 80);
    const destinationAlly = character('squabbleserver', 'player', 1, 81, {
      statuses: { ...emptyStatuses(), weakened: true },
    });
    let match = withBoard(blank(), busBoy, destinationAlly);
    if (block === 'frozen' || block === 'locked') {
      match = {
        ...match,
        boards: match.boards.map(lane => lane.map(item => item.instanceId === busBoy.instanceId
          ? { ...item, statuses: { ...item.statuses, [block]: true } }
          : item)) as Match['boards'],
      };
    } else if (block === 'detained') {
      match.districtRuntime = {
        plays: { player: [0, 0, 0], cpu: [0, 0, 0] },
        roundPlays: { player: [0, 0, 0], cpu: [0, 0, 0] },
        trailing: { player: [false, false, false], cpu: [false, false, false] },
        trappedCardIds: [],
        detainedCardIds: [busBoy.instanceId],
      };
      match.districtSnapshot = createDistrictSnapshot('diner-on-shift-detained-route');
    } else if (block === 'capacity') {
      match = withBoard(match, busBoy, destinationAlly,
        character('cornball', 'player', 1, 82),
        character('hooper', 'player', 1, 83),
        character('techbro', 'player', 1, 84),
        character('janitor', 'player', 1, 85));
    } else if (block === 'story-lock') {
      match.storyRuntime = {
        activePhaseIndex: 0,
        appliedEffectIds: [],
        lanePowerBonuses: [],
        laneLocks: [{ owner: 'player', lanes: [1] }],
      };
    } else {
      const cashier = character('squabblehouse-cashier', 'cpu', 0, 86);
      match.districtTraps = [{
        kind: 'open-tab',
        owner: 'cpu',
        lane: 0,
        source: cashier,
        expiresAfterRound: 5,
      }];
    }

    const firstAttempt = nextRealRound(match);
    const repeatedAttempt = nextRound(JSON.parse(JSON.stringify({
      ...match,
      phase: 'resolved',
      playerHand: [],
      cpuHand: [],
      playerCardIds: [],
      cpuCardIds: [],
      playerDrawIndex: 0,
      cpuDrawIndex: 0,
    })) as Match);
    assert.equal(instance(firstAttempt, busBoy.instanceId)?.lane, 0, `${block}: route is blocked`);
    assert.equal(instance(firstAttempt, destinationAlly.instanceId)?.statuses.weakened, true,
      `${block}: no arrival cleanse or reward occurs`);
    assert.equal(instance(firstAttempt, destinationAlly.instanceId)?.powerModifier, 0);
    assert.equal(instance(repeatedAttempt, busBoy.instanceId)?.lane, 0,
      `${block}: replaying the same blocked frame is deterministic`);

    // Once the route is open, the patrol resumes from its actual source lane, not a hidden
    // second step accumulated while blocked.
    let reopened = firstAttempt;
    if (block === 'capacity') {
      const remove = new Set([
        'player:diner-on-shift-test:82:cornball',
        'player:diner-on-shift-test:83:hooper',
        'player:diner-on-shift-test:84:techbro',
        'player:diner-on-shift-test:85:janitor',
      ]);
      reopened = {
        ...reopened,
        boards: reopened.boards.map(lane => lane.filter(item => !remove.has(item.instanceId))) as Match['boards'],
      };
    } else if (block === 'frozen' || block === 'locked') {
      reopened = {
        ...reopened,
        boards: reopened.boards.map(lane => lane.map(item => item.instanceId === busBoy.instanceId
          ? { ...item, statuses: { ...item.statuses, [block]: false } }
          : item)) as Match['boards'],
      };
    } else if (block === 'detained') {
      reopened.districtRuntime = {
        ...reopened.districtRuntime!,
        detainedCardIds: [],
      };
    } else if (block === 'story-lock') {
      reopened.storyRuntime = { ...reopened.storyRuntime!, laneLocks: [] };
    } else {
      reopened = {
        ...reopened,
        districtTraps: (reopened.districtTraps ?? []).filter(trap => trap.kind !== 'open-tab'),
      };
    }
    reopened = nextRealRound(reopened);
    assert.equal(instance(reopened, busBoy.instanceId)?.lane, 1, `${block}: resumes with one step, not a two-lane jump`);
  }
});

test('Bus Boy gives no arrival reward when Dead Air silences it on entry', () => {
  const busBoy = character('squabblehouse-bus-boy', 'player', 0, 90);
  const ally = character('hooper', 'player', 1, 91, {
    statuses: { ...emptyStatuses(), weakened: true },
  });
  const goth = character('gothkid', 'cpu', 1, 92);
  let match = withBoard(blank(), busBoy, ally, goth);
  match.districtTraps = [{
    kind: 'dead-air',
    owner: 'cpu',
    lane: 1,
    source: goth,
    expiresAfterRound: 5,
  }];

  match = nextRealRound(match);
  assert.equal(instance(match, busBoy.instanceId)?.lane, 1, 'patrol reached the arrival reaction');
  assert.equal(instance(match, busBoy.instanceId)?.statuses.silenced, true);
  assert.equal(instance(match, ally.instanceId)?.statuses.weakened, true,
    'a silenced Bus Boy cannot resolve its post-arrival cleanse');
  assert.equal(instance(match, ally.instanceId)?.powerModifier, 0,
    'the stopped arrival reward does not become phantom Hands');
});

test('Manager and Bus Boy movement events retain contiguous nested replay frames', () => {
  const busBoy = character('squabblehouse-bus-boy', 'cpu', 0, 100);
  const janitor = character('janitor', 'cpu', 1, 102);
  const passenger = character('squabblecook', 'cpu', 1, 103, {
    basePower: 1,
    statuses: { ...emptyStatuses(), weakened: true },
  });
  let match = play(blank(), 'squabble-house-manager', 'player', 1, 101);
  const manager = card(match, 'squabble-house-manager', 'player')!;
  match = withBoard(match, ...match.boards.flat(), busBoy, janitor, passenger);

  match = nextRealRound(match);
  const movement = match.effectLog.find(event => event.kind === 'move'
    && event.cardInstanceId === busBoy.instanceId);
  const managerTax = match.effectLog.find(event => event.source?.cardInstanceId === manager.instanceId
    && event.targets.some(target => target.cardInstanceId === busBoy.instanceId));
  const reversal = match.effectLog.find(event => event.note.includes('Turn It Around negated')
    && event.targets.some(target => target.cardInstanceId === busBoy.instanceId));
  const arrivalReward = match.effectLog.find(event => event.source?.cardInstanceId === busBoy.instanceId
    && event.targets.some(target => target.cardInstanceId === passenger.instanceId));

  assert.ok(movement, 'round start emits a canonical move frame');
  assert.ok(managerTax, 'the Manager tax is represented as an arrival event');
  assert.ok(reversal, 'Janitor reversal is its own committed event');
  assert.ok(arrivalReward, 'Bus Boy reward follows the settled arrival reaction');
  assert.ok(movement.sequence < managerTax.sequence);
  assert.ok(movement.sequence < reversal.sequence);
  assert.ok(movement.sequence < managerTax.sequence);
  assert.ok(Math.max(managerTax.sequence, reversal.sequence) < arrivalReward.sequence);

  const ordered = match.effectLog.filter(event =>
    event.sequence >= movement.sequence && event.sequence <= arrivalReward.sequence);
  for (let index = 1; index < ordered.length; index++) {
    assert.deepEqual(ordered[index].replay.before, ordered[index - 1].replay.after,
      `event ${ordered[index].sequence} begins from the prior committed replay frame`);
  }
  assert.equal(movement.replay.after.boards.flat().find(item => item.instanceId === busBoy.instanceId)?.lane, 1);
  assert.equal(instance(match, busBoy.instanceId)?.powerModifier, 2,
    'Janitor reversal is committed before the separate Bus Boy arrival reward');
  assert.equal(instance(match, passenger.instanceId)?.statuses.weakened, false,
    'the independent arrival reward cleanses its passenger');
  assert.equal(instance(match, passenger.instanceId)?.powerModifier, 1,
    'the weakest passenger is buffed only after tax and reversal settle');
});

test('an arrival hit that kills Bus Boy never cleanses or buffs its destination allies', () => {
  for (const owner of ['player', 'cpu'] as const) {
    const enemy: Owner = owner === 'player' ? 'cpu' : 'player';
    const busBoy = character('squabblehouse-bus-boy', owner, 0, 200, { powerModifier: -1 });
    const passenger = character('hooper', owner, 1, 201, {
      statuses: { ...emptyStatuses(), weakened: true },
    });
    const manager = character('squabble-house-manager', enemy, 1, 202);
    const after = nextRealRound(withBoard(blank(), busBoy, passenger, manager));
    assert.equal(instance(after, busBoy.instanceId), undefined, `${owner}: the arrival tax is lethal`);
    assert.equal(instance(after, passenger.instanceId)?.statuses.weakened, true,
      `${owner}: a dead patrol source cannot cleanse`);
    assert.equal(instance(after, passenger.instanceId)?.powerModifier, 0,
      `${owner}: a dead patrol source cannot grant Hands`);
  }
});

test('ongoing Hands collapse records a neutral Manager departure, not another enemy hit', () => {
  for (const owner of ['player', 'cpu'] as const) {
    const enemy: Owner = owner === 'player' ? 'cpu' : 'player';
    const manager = character('squabble-house-manager', owner, 2, 210, {
      basePower: 2, powerModifier: -2, continuousPower: 1,
    });
    const employee = character('squabbleserver', owner, 0, 211, { basePower: 1 });
    const before = withBoard(blank(), manager, employee);
    assert.equal(getEffectiveCardPower(manager), 1);
    const after = play(before, 'griddle-master', enemy, 0, 212);
    assert.equal(instance(after, employee.instanceId), undefined, `${owner}: the direct target dies`);
    assert.equal(instance(after, manager.instanceId), undefined, `${owner}: the ongoing bonus disappears`);
    const departureEvent = after.effectLog.find(event =>
      event.targets.some(target => target.cardInstanceId === manager.instanceId && target.departureCause === 'aura-loss'));
    assert.ok(departureEvent, `${owner}: neutral departure has a presentation record`);
    const departure = departureEvent.targets.find(target => target.cardInstanceId === manager.instanceId)!;
    assert.equal(departure.before?.power, 1, 'the snapshot records the Manager before ongoing Hands disappear');
    assert.equal(departure.after, null);
    assert.equal((after.laneDamage ?? []).filter(entry => entry.instanceId === manager.instanceId).length, 0,
      'the neutral casualty is not credited as committed enemy damage');
    assert.ok(after.effectLog.some(event => event.targets.some(target =>
      target.cardInstanceId === employee.instanceId && target.after === null && target.departureCause === undefined)),
    'the actual employee hit remains distinct from neutral aura loss');
  }
});

test('a real Cashier receipt blocks an unlocked Bus Boy patrol in the following round', () => {
  for (const owner of ['player', 'cpu'] as const) {
    const enemy: Owner = owner === 'player' ? 'cpu' : 'player';
    const busBoy = character('squabblehouse-bus-boy', owner, 0, 220);
    const strongerCoworker = character('techbro', owner, 0, 221, { basePower: 4 });
    const waitingAlly = character('hooper', owner, 1, 222, {
      statuses: { ...emptyStatuses(), weakened: true },
    });
    const before = play(withBoard(blank(), busBoy, strongerCoworker, waitingAlly),
      'squabblehouse-cashier', enemy, 0, 223);
    assert.equal(instance(before, busBoy.instanceId)?.squabblehouseCannotMoveThroughRound, undefined,
      'Cashier locked the stronger coworker, not Bus Boy');
    assert.equal(instance(before, strongerCoworker.instanceId)?.squabblehouseCannotMoveThroughRound, 2);
    assert.ok(before.districtTraps?.some(trap => trap.kind === 'open-tab' && trap.expiresAfterRound === 2));
    const after = nextRealRound(before);
    assert.equal(instance(after, busBoy.instanceId)?.lane, 0, `${owner}: the receipt stops the free patrol`);
    assert.ok(after.districtTraps?.some(trap => trap.kind === 'open-tab' && trap.spentRound === 2),
      'the real receipt consumes its following-round departure check');
    assert.equal(instance(after, waitingAlly.instanceId)?.statuses.weakened, true);
    assert.equal(instance(after, waitingAlly.instanceId)?.powerModifier, 0,
      'a blocked patrol grants no destination reward');
  }
});

test('lethal Manager arrival damage is recorded before Bonnetgirl watches a neutral aura collapse', () => {
  for (const owner of ['player', 'cpu'] as const) {
    const enemy: Owner = owner === 'player' ? 'cpu' : 'player';
    const busBoy = character('squabblehouse-bus-boy', owner, 0, 230, { powerModifier: -1 });
    const friendlyManager = character('squabble-house-manager', owner, 2, 231, {
      powerModifier: -2, continuousPower: 1,
    });
    const bonnet = character('bonnetgirl', owner, 1, 232);
    const enemyManager = character('squabble-house-manager', enemy, 1, 233);
    const after = nextRealRound(withBoard(blank(), busBoy, friendlyManager, bonnet, enemyManager));
    assert.equal(instance(after, busBoy.instanceId), undefined);
    assert.equal(instance(after, friendlyManager.instanceId), undefined);
    const movement = after.effectLog.find(event => event.kind === 'move'
      && event.source?.cardInstanceId === busBoy.instanceId);
    const directHit = after.effectLog.find(event => event.targets.some(target =>
      target.cardInstanceId === busBoy.instanceId && target.before !== null && target.after === null));
    const neutralLoss = after.effectLog.find(event => event.targets.some(target =>
      target.cardInstanceId === friendlyManager.instanceId && target.departureCause === 'aura-loss'));
    const watcher = after.effectLog.find(event => event.source?.cardInstanceId === bonnet.instanceId);
    assert.ok(movement, `${owner}: the arrival begins with its move`);
    assert.ok(directHit, `${owner}: the lethal direct hit has a casualty participant`);
    assert.ok(neutralLoss, `${owner}: the aura casualty has a separate cause`);
    assert.ok(watcher, `${owner}: the damage watcher still reacts`);
    assert.ok(movement.sequence < directHit.sequence && directHit.sequence < watcher.sequence);
    assert.ok(neutralLoss.sequence < watcher.sequence);
    assert.ok(directHit.replay.before.boards.flat().some(card => card.instanceId === busBoy.instanceId));
    assert.ok(!directHit.replay.after.boards.flat().some(card => card.instanceId === busBoy.instanceId));
    assert.ok(neutralLoss.replay.before.boards.flat().some(card => card.instanceId === friendlyManager.instanceId));
    assert.ok(!neutralLoss.replay.after.boards.flat().some(card => card.instanceId === friendlyManager.instanceId));
    const ordered = after.effectLog.filter(event => event.sequence >= movement.sequence
      && event.sequence <= watcher.sequence);
    for (let index = 1; index < ordered.length; index++) {
      assert.deepEqual(ordered[index].replay.before, ordered[index - 1].replay.after,
        `${owner}: damage, neutral departure, and watcher frames remain adjacent`);
    }
    assert.equal((after.laneDamage ?? []).filter(entry => entry.instanceId === busBoy.instanceId)
      .reduce((total, entry) => total + entry.amount, 0), 1);
    assert.equal((after.laneDamage ?? []).filter(entry => entry.instanceId === friendlyManager.instanceId).length, 0);
  }
});

const managerRegressionStaff = [
  'squabblehouse-security',
  'squabblehouse-cashier',
  'waffle-warlord',
] as const;

function managerWithThreeStaff(managerOwner: Owner, janitorInDistrict = false): {
  match: Match;
  manager: CardInstance;
  janitor?: CardInstance;
} {
  const manager = character('squabble-house-manager', managerOwner, 1, 300, {
    basePower: 2,
    powerModifier: -2,
    continuousPower: 3,
    squabblehouseManagerRound: 1,
  });
  const staffIds = janitorInDistrict
    ? ['janitor', 'squabblehouse-security', 'squabblehouse-cashier']
    : managerRegressionStaff;
  const staff = staffIds.map((staffId, index) => character(
    staffId,
    managerOwner,
    janitorInDistrict && index === 0 ? 1 : index === 1 ? 0 : 2,
    301 + index,
    { basePower: 2 },
  ));
  return {
    match: withBoard(blank(), manager, ...staff),
    manager,
    ...(janitorInDistrict ? { janitor: staff[0] } : {}),
  };
}

function playAtExactLegalMotion(
  match: Match,
  cardId: string,
  owner: Owner,
  lane: Lane,
  index: number,
): { after: Match; source: CardInstance; cost: number } {
  const source = createCardInstance(cardId, owner, 'diner-on-shift-test', index);
  const cost = getLegalCardCost(match, owner, source, lane);
  const motionKey = owner === 'player' ? 'playerMotion' : 'cpuMotion';
  const handKey = owner === 'player' ? 'playerHand' : 'cpuHand';
  const after = playTurnCard({
    ...match,
    phase: owner === 'player' ? 'player' : 'cpu-reveal',
    [motionKey]: cost,
    [handKey]: [source],
  }, owner, source.instanceId, lane, false);
  return { after, source, cost };
}

test('Homeless Guy spends its last deployment Motion to steal two Hands from an ongoing Manager', () => {
  for (const managerOwner of ['player', 'cpu'] as const) {
    const thiefOwner: Owner = managerOwner === 'player' ? 'cpu' : 'player';
    const { match, manager } = managerWithThreeStaff(managerOwner);
    const managerBefore = instance(match, manager.instanceId)!;
    assert.equal(getEffectiveCardPower(managerBefore), 3, `${managerOwner}: baseline Manager has 3 actual Hands`);
    assert.equal(managerBefore.continuousPower, 3, `${managerOwner}: three other staff provide ongoing Hands`);

    const { after, source, cost } = playAtExactLegalMotion(match, 'homelessguy', thiefOwner, 1, 304);
    assert.equal(cost, getLegalCardCost(match, thiefOwner, source, 1),
      'the thief spends the actual legal deployment cost');
    assert.equal(after[thiefOwner === 'player' ? 'playerMotion' : 'cpuMotion'], 0,
      'the legal deployment cost spends the thief owner’s last Motion');
    const managerAfter = instance(after, manager.instanceId)!;
    const thiefAfter = instance(after, source.instanceId)!;
    assert.equal(getEffectiveCardPower(managerAfter), 1, `${managerOwner}: Manager loses two actual Hands`);
    assert.equal(managerAfter.powerModifier, -4, `${managerOwner}: both stolen Hands reduce permanent power`);
    assert.equal(managerAfter.continuousPower, 3, `${managerOwner}: the ongoing Manager aura remains intact`);
    assert.equal(thiefAfter.powerModifier, 2, `${thiefOwner}: Homeless Guy gains both stolen Hands`);
  }
});

test('OG Red Night steals from a Manager whose actual Hands are supplied by continuous power', () => {
  for (const managerOwner of ['player', 'cpu'] as const) {
    const redNightOwner: Owner = managerOwner === 'player' ? 'cpu' : 'player';
    const { match, manager } = managerWithThreeStaff(managerOwner);
    const managerBefore = instance(match, manager.instanceId)!;
    assert.equal(getEffectiveCardPower(managerBefore), 3, `${managerOwner}: baseline Manager has 3 actual Hands`);
    assert.equal(managerBefore.continuousPower, 3, `${managerOwner}: continuous Hands are present before the steal`);

    const after = play(match, 'redside2', redNightOwner, 1, 305);
    const managerAfter = instance(after, manager.instanceId)!;
    const redNight = card(after, 'redside2', redNightOwner)!;
    assert.equal(getEffectiveCardPower(managerAfter), 2, `${managerOwner}: OG Red Night genuinely steals one Hand`);
    assert.equal(managerAfter.powerModifier, -3, `${managerOwner}: the stolen Hand is recorded permanently`);
    assert.equal(managerAfter.continuousPower, 3, `${managerOwner}: the Manager aura remains unchanged`);
    assert.equal(redNight.powerModifier, 1, `${redNightOwner}: OG Red Night gains the stolen Hand`);
    assert.ok(after.effectLog.some(event => event.note.includes('stole 1 Hand from')
      && event.targets.some(target => target.cardInstanceId === manager.instanceId)),
      'the real reveal records its successful steal rather than only a target attempt');
  }
});

test('Red Robber damage is reversed by an active Janitor protecting an ongoing Manager', () => {
  for (const managerOwner of ['player', 'cpu'] as const) {
    const robberOwner: Owner = managerOwner === 'player' ? 'cpu' : 'player';
    const { match, manager, janitor } = managerWithThreeStaff(managerOwner, true);
    assert.ok(janitor, `${managerOwner}: a friendly Janitor is in the Manager’s district`);
    const managerBefore = instance(match, manager.instanceId)!;
    assert.equal(getEffectiveCardPower(managerBefore), 3, `${managerOwner}: baseline Manager has 3 actual Hands`);
    assert.equal(managerBefore.continuousPower, 3, `${managerOwner}: Janitor and two other staff provide ongoing Hands`);

    const after = play(match, 'redside3', robberOwner, 1, 306);
    const managerAfter = instance(after, manager.instanceId)!;
    const robber = card(after, 'redside3', robberOwner)!;
    assert.equal(getEffectiveCardPower(managerAfter), 5, `${managerOwner}: Janitor reversal grants two Hands`);
    assert.equal(managerAfter.powerModifier, 0, `${managerOwner}: attempted damage is replaced by the +2 reversal`);
    assert.equal(managerAfter.continuousPower, 3, `${managerOwner}: ongoing Hands remain unchanged`);
    assert.equal(robber.powerModifier, 0, `${robberOwner}: the reversed hit gives Red Robber no phantom bonus`);
    assert.ok(after.janitorReversals?.some(item => item.owner === managerOwner && item.lane === 1
      && item.round === match.round && item.sourceInstanceId === janitor.instanceId
      && item.targetInstanceId === manager.instanceId && item.charge === 'harm'),
    `${managerOwner}: the Janitor’s harmful-effect charge is consumed on the Manager`);
    assert.ok(after.effectLog.some(event => event.note.includes('Turn It Around negated')
      && event.targets.some(target => target.cardInstanceId === manager.instanceId)),
    'the real attack commits a Janitor reversal event');
  }
});
