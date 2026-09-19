import assert from 'node:assert/strict';
import test from 'node:test';
import { createMatch, playCard, type EffectLogEntry, type Match } from '../gameEngine';
import {
  MECHANIC_LESSON_STORAGE_KEY,
  detectMechanicLessons,
  findFirstUnseenMechanicLesson,
  getTutorialGuidance,
  readSeenMechanicLessons,
  writeSeenMechanicLessons,
} from './tutorialGuidance';

const guidance = (match: Match, selectedInstanceId: string | null = null, selectedLane: number | null = null, squabble = false, playsThisRound = 0) =>
  getTutorialGuidance({ match, selectedInstanceId, selectedLane, squabble, playsThisRound });

test('Rookie Road coaches an action sequence instead of repeating a generic prompt', () => {
  const match = createMatch('vibes', 'combo');
  const card = match.playerHand.find(item => item.cost <= match.playerMotion)!;
  assert.equal(guidance(match).id, 'r1_choose_card');
  assert.equal(guidance(match, card.instanceId).id, 'r1_choose_district');
  assert.equal(guidance(match, card.instanceId, 0).id, 'r1_play_card');
  assert.equal(guidance(match, null, null, false, 1).id, 'r1_end_turn');
});

test('round three teaches banking and round four teaches the once-per-match SQUABBLE flow', () => {
  const base = createMatch('vibes', 'combo');
  const card = base.playerHand.find(item => item.cost <= base.playerMotion)!;
  assert.equal(guidance({ ...base, round: 3 } as Match).id, 'r3_bank_motion');
  const roundFour = { ...base, round: 4, playerMotion: 6 } as Match;
  assert.equal(guidance(roundFour).id, 'r4_choose_card');
  assert.equal(guidance(roundFour, card.instanceId).id, 'r4_arm_squabble');
  assert.equal(guidance(roundFour, card.instanceId, null, true).id, 'r4_choose_district');
  assert.equal(guidance(roundFour, card.instanceId, 1, true).id, 'r4_play_squabble');
  assert.equal(guidance({ ...roundFour, squabbleUsed: true } as Match).id, 'free_play');
  assert.equal(guidance({ ...roundFour, squabbleUsed: true } as Match, null, null, false, 1).id, 'r4_end_turn');
});

test('mechanic detection reads authoritative before and after event snapshots', () => {
  let match = createMatch('block', 'combo');
  const playable = match.playerHand.find(card => card.cost <= match.playerMotion)!;
  match = playCard(match, 'player', playable.instanceId, 0);
  const base = match.effectLog.at(-1)!;
  const target = base.source!;
  const effect = {
    ...base,
    type: 'ability',
    kind: 'fire',
    source: null,
    targets: [{
      ...target,
      before: { ...target.after!, lane: 0, statuses: { ...target.after!.statuses, burnStacks: 0 } },
      after: { ...target.after!, lane: 0, statuses: { ...target.after!.statuses, burnStacks: 2, silenced: true } },
    }],
  } satisfies EffectLogEntry;
  assert.deepEqual(detectMechanicLessons(effect), ['burn', 'silence']);
  assert.equal(findFirstUnseenMechanicLesson(effect, new Set(['burn']))?.id, 'silence');
});

test('natural Burn expiration is not mislabeled as a Cleanse', () => {
  let match = createMatch('block', 'combo');
  const playable = match.playerHand.find(card => card.cost <= match.playerMotion)!;
  match = playCard(match, 'player', playable.instanceId, 0);
  const base = match.effectLog.at(-1)!;
  const target = base.source!;
  const expiration = {
    ...base,
    type: 'expiration',
    kind: 'fire',
    note: 'BURN: -2 Hands at round end.',
    source: null,
    targets: [{
      ...target,
      before: { ...target.after!, lane: 0, statuses: { ...target.after!.statuses, burnStacks: 2 } },
      after: { ...target.after!, lane: 0, statuses: { ...target.after!.statuses, burnStacks: 0 } },
    }],
  } satisfies EffectLogEntry;
  assert.deepEqual(detectMechanicLessons(expiration), []);
});

test('seen mechanic lessons persist as a versioned, allowlisted set', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
  writeSeenMechanicLessons(new Set(['burn', 'movement']), storage);
  assert.equal(values.get(MECHANIC_LESSON_STORAGE_KEY), '["burn","movement"]');
  values.set(MECHANIC_LESSON_STORAGE_KEY, '["burn","private_value",7]');
  assert.deepEqual([...readSeenMechanicLessons(storage)], ['burn']);
});
