import { rookieEncounter, rookieDistricts } from '@workspace/squabblemon-engine/rookie';
import { ROOKIE_CORE_IDS, ROOKIE_DECK_ID, ROOKIE_MENTOR_CORE_IDS, catalogIdsToEngineIds } from '../data';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canAffordSelection, createMatch, createStoryMatch, getTutorialPlay, nextRound, pass, playCard, playTurnCard, revealCpuTurn,
  type EffectLogEntry, type Lane, type Match,
} from '../gameEngine';
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

// The production first gang with Bottle Girl recruited into the opening hand.
const recruitedRookieMatch = () => createStoryMatch(
  rookieEncounter(),
  catalogIdsToEngineIds(ROOKIE_MENTOR_CORE_IDS.map(id => id === 'wifey' ? 'bottle-girl' : id)),
  ROOKIE_DECK_ID, undefined, rookieDistricts(),
);
const lanes = [0, 1, 2] as const;
const handCard = (instanceId: string) => '#hand-tray [data-instance-id=' + JSON.stringify(instanceId) + ']';

test('Rookie Road only offers Commit for the exact coached card and district', () => {
  const match = recruitedRookieMatch();
  const choice = getTutorialPlay(match)!;
  const snowBunny = match.playerHand.find(card => card.instanceId === choice.instanceId)!;
  const bottleGirl = match.playerHand.find(card => card.cardId === 'bottlegirl' || card.name === 'Bottle Girl')!;
  assert.equal(snowBunny.name, 'Snow Bunny');
  assert.equal(choice.lane, 0);

  // The reported soft-lock: Bottle Girl in VIP SECTION used to reach "Commit the play".
  const wrongCard = guidance(match, bottleGirl.instanceId, 2);
  assert.equal(wrongCard.id, 'r1_choose_card');
  assert.equal(wrongCard.focus, 'card');
  assert.equal(wrongCard.target, handCard(snowBunny.instanceId));
  assert.equal(wrongCard.redirectLabel, 'Switch to Snow Bunny');
  assert.match(wrongCard.body, /Bottle Girl stays in your hand/);

  const wrongDistrict = guidance(match, snowBunny.instanceId, 2);
  assert.equal(wrongDistrict.id, 'r1_choose_district');
  assert.equal(wrongDistrict.target, '[data-testid="lane-0"]');
  assert.equal(wrongDistrict.redirectLabel, 'Choose BODEGA');

  const coached = guidance(match, snowBunny.instanceId, 0);
  assert.equal(coached.focus, 'play');
  assert.equal(coached.redirectLabel, undefined);

  for (const card of match.playerHand) for (const lane of lanes) {
    const step = guidance(match, card.instanceId, lane);
    const isCoached = card.instanceId === choice.instanceId && lane === choice.lane;
    assert.equal(step.focus === 'play', isCoached, `${card.name} @ ${lane}`);
    assert.equal(Boolean(step.redirectLabel), !isCoached, `${card.name} @ ${lane}`);
  }
});

test('Rookie Road round four cannot arm or commit SQUABBLE on an off-script pick', () => {
  let match = recruitedRookieMatch();
  for (let round = 1; round <= 3; round++) {
    const choice = getTutorialPlay(match)!;
    if (round !== 3) match = playTurnCard(match, 'player', choice.instanceId, choice.lane);
    match = nextRound(revealCpuTurn(pass(match, 'player')));
  }
  assert.equal(match.round, 4);
  const choice = getTutorialPlay(match)!;
  const fade = match.playerHand.find(card => card.instanceId === choice.instanceId)!;
  const other = match.playerHand.find(card => card.instanceId !== choice.instanceId
    && lanes.some(lane => canAffordSelection(match, 'player', card.instanceId, lane)))!;
  const wrongLane = lanes.find(lane => lane !== choice.lane)! as Lane;
  assert.equal(fade.name, 'Dr. Fade');

  const wrongCard = guidance(match, other.instanceId, null);
  assert.equal(wrongCard.id, 'r4_choose_card');
  assert.equal(wrongCard.target, handCard(fade.instanceId));
  assert.equal(wrongCard.redirectLabel, 'Switch to Dr. Fade');
  assert.equal(guidance(match, other.instanceId, choice.lane, true).focus, 'card');

  assert.equal(guidance(match, fade.instanceId, wrongLane).id, 'r4_arm_squabble');
  const armedWrongLane = guidance(match, fade.instanceId, wrongLane, true);
  assert.equal(armedWrongLane.id, 'r4_choose_district');
  assert.equal(armedWrongLane.target, `[data-testid="lane-${choice.lane}"]`);
  assert.ok(armedWrongLane.redirectLabel);
  assert.equal(guidance(match, fade.instanceId, choice.lane, true).id, 'r4_play_squabble');

  for (const card of match.playerHand) for (const lane of lanes) for (const squabble of [false, true]) {
    const step = guidance(match, card.instanceId, lane, squabble);
    assert.equal(step.focus === 'play', card.instanceId === choice.instanceId && lane === choice.lane && squabble,
      `${card.name} @ ${lane} squabble=${squabble}`);
  }
});

test('Rookie Road round three points at the selected card to clear, not at a play', () => {
  let match = recruitedRookieMatch();
  for (let round = 1; round <= 2; round++) {
    const choice = getTutorialPlay(match)!;
    match = nextRound(revealCpuTurn(pass(playTurnCard(match, 'player', choice.instanceId, choice.lane), 'player')));
  }
  assert.equal(match.round, 3);
  for (const card of match.playerHand) {
    const step = guidance(match, card.instanceId, 1);
    assert.equal(step.id, 'r3_bank_motion');
    assert.equal(step.target, handCard(card.instanceId));
    assert.equal(step.body, 'Tap the selected card again to clear it. Then end your turn without playing.');
    assert.equal(step.expectedCard, undefined);
  }
  assert.equal(guidance(match).target, '[data-testid="button-next-round"]');
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

test('coached card targets the exact hand instance instead of a matching board card', () => {
  const match = createStoryMatch(rookieEncounter(), catalogIdsToEngineIds(ROOKIE_CORE_IDS), ROOKIE_DECK_ID, undefined, rookieDistricts());
  const step = guidance(match);
  assert(step.expectedCard);
  assert.equal(step.target, '#hand-tray [data-instance-id=' + JSON.stringify(step.expectedCard) + ']');
  assert(step.body.includes('costs 2 Motion'));
});
