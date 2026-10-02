import {
  createCardInstance,
  createMatch,
  playCard,
  playTurnCard,
  type CardInstance,
  type Match,
} from '@workspace/squabblemon-engine/gameEngine';
import { insist, type RevisionArm } from './squabblehouse-counter-revisionChecks';

function boardCard(cardId: string, owner: 'player' | 'cpu', index: number, power?: number): CardInstance {
  const card = createCardInstance(cardId, owner, 'counter-revision-fixture', index);
  return { ...card, lane: 0, playedRound: 0, ...(power === undefined ? {} : { basePower: power }) };
}

function fixtureMatch(): Match {
  const match = createMatch('vibes', 'vibes');
  return {
    ...match,
    playerMotion: 20,
    cpuMotion: 20,
    playerHand: [],
    cpuHand: [],
    boards: [[], [], []],
  };
}

function cashierFixture(arm: RevisionArm): void {
  const cashier = createCardInstance('squabblehouse-cashier', 'player', 'counter-revision-fixture', 10);
  const target = boardCard('inmate-reformed', 'cpu', 10);
  const match = fixtureMatch();
  const played = playCard({
    ...match,
    playerHand: [cashier],
    boards: [[target], [], []],
  }, 'player', cashier.instanceId, 0);
  const liveTarget = played.boards.flat().find(card => card.instanceId === target.instanceId);
  insist(liveTarget, `${arm}: Cashier fixture target disappeared`);
  const hasMovementLock = (liveTarget.squabblehouseCannotMoveThroughRound ?? 0) >= played.round + 1;
  const hasOpenTab = (played.districtTraps ?? []).some(trap => trap.kind === 'open-tab'
    && trap.owner === 'player' && trap.lane === 0);
  const lockExpected = ['corrected-original', 'cashier-only', 'combined-v32'].includes(arm);
  const receiptExpected = arm !== 'corrected-original';
  insist(hasMovementLock === lockExpected,
    `${arm}: Cashier lock fixture expected ${lockExpected}, received ${hasMovementLock}`);
  insist(hasOpenTab === receiptExpected,
    `${arm}: Cashier Open Tab fixture expected ${receiptExpected}, received ${hasOpenTab}`);
}

function griddleFixture(arm: RevisionArm): void {
  const griddle = createCardInstance('griddle-master', 'player', 'counter-revision-fixture', 20);
  const weakBase = boardCard('inmate-reformed', 'cpu', 20, 3);
  const weakerProtected = {
    ...weakBase,
    statuses: { ...weakBase.statuses, protected: true },
  };
  const strongerUnprotected = boardCard('inmate-reformed', 'cpu', 21, 7);
  const match = fixtureMatch();
  const played = playCard({
    ...match,
    playerHand: [griddle],
    boards: [[weakerProtected, strongerUnprotected], [], []],
  }, 'player', griddle.instanceId, 0);
  const liveWeak = played.boards.flat().find(card => card.instanceId === weakerProtected.instanceId);
  const liveStrong = played.boards.flat().find(card => card.instanceId === strongerUnprotected.instanceId);
  insist(liveWeak && liveStrong, `${arm}: Griddle fixture target disappeared`);
  const revised = ['corrected-original', 'griddle-only', 'combined-v32'].includes(arm);
  if (revised) {
    insist(liveStrong.powerModifier < 0 && liveStrong.statuses.burnStacks > 0,
      `${arm}: Griddle should hit the strongest unprotected enemy and apply damage plus Burn`);
    insist(liveWeak.statuses.protected,
      `${arm}: Griddle should leave the weaker protected enemy untouched`);
  } else {
    insist(liveWeak.powerModifier < 0 && !liveWeak.statuses.protected && liveWeak.statuses.burnStacks === 0,
      `${arm}: frozen v31 Griddle should crack the protected enemy without Burn`);
    insist(liveStrong.powerModifier === 0 && liveStrong.statuses.burnStacks === 0,
      `${arm}: frozen v31 Griddle should not switch to the strongest unprotected enemy`);
  }
}

function janitorFixture(arm: RevisionArm): void {
  const janitor = boardCard('janitor', 'player', 30, 10);
  const manager = boardCard('squabble-house-manager', 'player', 31, 1);
  const fade = createCardInstance('drfade', 'cpu', 'counter-revision-fixture', 30);
  const monkeys = createCardInstance('flyingmonkeys', 'cpu', 'counter-revision-fixture', 31);
  let match: Match = {
    ...fixtureMatch(),
    phase: 'cpu-reveal',
    boards: [[janitor, manager], [], []],
    cpuHand: [fade, monkeys],
  };
  match = playTurnCard(match, 'cpu', fade.instanceId, 0);
  const liveJanitorAfterHarm = match.boards.flat().find(card => card.instanceId === janitor.instanceId);
  insist((liveJanitorAfterHarm?.powerModifier ?? 0) > 0,
    `${arm}: Janitor harm counter fixture did not restore Hands before the forced move`);
  match = playTurnCard(match, 'cpu', monkeys.instanceId, 0);
  const liveManager = match.boards.flat().find(card => card.instanceId === manager.instanceId);
  insist(liveManager, `${arm}: forced-move fixture unexpectedly removed the staff target`);
  const splitChargeExpected = arm === 'janitor-only' || arm === 'combined-v32';
  insist((liveManager.lane === 0) === splitChargeExpected,
    `${arm}: Janitor's post-harm staff-move counter expected ${splitChargeExpected}, target lane ${liveManager.lane}`);
}

function queenExecutionCase(
  arm: RevisionArm,
  targetIsStaff: boolean,
  includeJanitor: boolean,
): void {
  const queen = createCardInstance('queenofhearts', 'cpu', 'counter-revision-queen-execution', 40);
  const target = boardCard(
    targetIsStaff ? 'squabblehouse-cashier' : 'drfade',
    'player',
    targetIsStaff ? 41 : 42,
    1,
  );
  const janitor = boardCard('janitor', 'player', 43, 10);
  const match: Match = {
    ...fixtureMatch(),
    phase: 'cpu-reveal',
    cpuHand: [queen],
    boards: [[...(includeJanitor ? [janitor] : []), target], [], []],
  };
  const result = playTurnCard(match, 'cpu', queen.instanceId, 0);
  const liveTarget = result.boards.flat().find(card => card.instanceId === target.instanceId);
  const cardGuardAppeared = result.boards.flat().some(card => card.cardId === 'cardguard');
  const interceptExpected = includeJanitor
    && (arm === 'corrected-original' || targetIsStaff);
  if (interceptExpected) {
    insist(liveTarget && liveTarget.powerModifier === target.powerModifier + 2,
      `${arm}: fresh Janitor must authentically reverse this Queen execution for ${targetIsStaff ? 'staff' : 'nonstaff'}`);
    insist(!cardGuardAppeared,
      `${arm}: reversed Queen execution must not summon Card Guard`);
    insist(result.janitorReversals?.length === 1,
      `${arm}: fresh Queen execution should consume exactly one Janitor charge`);
    if (arm === 'janitor-only' || arm === 'combined-v32') {
      insist(result.janitorReversals?.[0]?.charge === 'staff',
        `${arm}: v32 staff execution must consume the separate staff charge`);
    }
  } else {
    insist(!liveTarget && cardGuardAppeared,
      `${arm}: unprotected Queen execution should remove the target and summon Card Guard`);
    insist((result.janitorReversals?.length ?? 0) === 0,
      `${arm}: this Queen execution should not consume a Janitor charge`);
  }
}

function forcedMonkeyMoveCase(
  arm: RevisionArm,
  targetIsStaff: boolean,
  includeJanitor: boolean,
): void {
  const monkeys = createCardInstance('flyingmonkeys', 'cpu', 'counter-revision-monkey-move', 50);
  const target = boardCard(
    targetIsStaff ? 'squabblehouse-cashier' : 'drfade',
    'player',
    targetIsStaff ? 51 : 52,
    1,
  );
  const janitor = boardCard('janitor', 'player', 53, 10);
  const match: Match = {
    ...fixtureMatch(),
    phase: 'cpu-reveal',
    cpuHand: [monkeys],
    boards: [[...(includeJanitor ? [janitor] : []), target], [], []],
  };
  const result = playTurnCard(match, 'cpu', monkeys.instanceId, 0);
  const liveTarget = result.boards.flat().find(card => card.instanceId === target.instanceId);
  insist(liveTarget, `${arm}: Flying Monkeys fixture target disappeared`);
  const interceptExpected = includeJanitor
    && arm !== 'corrected-original'
    && targetIsStaff;
  if (interceptExpected) {
    insist(liveTarget.lane === 0 && liveTarget.statuses.burnStacks === 0,
      `${arm}: fresh Janitor staff charge should stop a staff forced move before Burn`);
    insist(result.janitorReversals?.length === 1,
      `${arm}: fresh staff forced move should consume one Janitor charge`);
    if (arm === 'janitor-only' || arm === 'combined-v32') {
      insist(result.janitorReversals?.[0]?.charge === 'staff',
        `${arm}: v32 staff forced move must consume the separate staff charge`);
    }
  } else {
    insist(liveTarget.lane !== 0 && liveTarget.statuses.burnStacks === 1,
      `${arm}: forced move should proceed and apply 1 Burn for ${targetIsStaff ? 'staff' : 'nonstaff'}`);
    insist((result.janitorReversals?.length ?? 0) === 0,
      `${arm}: this forced move should not consume a Janitor charge`);
  }
}

function freshJanitorActionFixtures(arm: RevisionArm): void {
  for (const targetIsStaff of [true, false]) {
    queenExecutionCase(arm, targetIsStaff, false);
    queenExecutionCase(arm, targetIsStaff, true);
    forcedMonkeyMoveCase(arm, targetIsStaff, false);
    forcedMonkeyMoveCase(arm, targetIsStaff, true);
  }
}

export function runCounterRevisionFixtures(arm: RevisionArm): Record<string, true> {
  cashierFixture(arm);
  griddleFixture(arm);
  janitorFixture(arm);
  freshJanitorActionFixtures(arm);
  return {
    cashierLockAndOpenTab: true,
    griddleProtectedTargetAndDamage: true,
    janitorSeparateHarmAndStaffCharges: true,
    janitorFreshQueenStaffAndNonstaffControls: true,
    janitorFreshMonkeyStaffAndNonstaffControls: true,
  };
}