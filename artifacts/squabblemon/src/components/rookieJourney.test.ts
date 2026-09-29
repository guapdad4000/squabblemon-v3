import assert from 'node:assert/strict';
import test from 'node:test';
import { ROOKIE_CORE_IDS, ROOKIE_MENTOR_CORE_IDS, ROOKIE_DECK_ID, ROOKIE_FOUNDATION_IDS, catalogCardById, catalogIdsToEngineIds } from '../data';
import { createGuidedTutorialTranscript, verifyStoryMatchTranscript, getMatchWinner, getDistrictResults, createStoryMatch, getTutorialPlay, pass, playTurnCard, revealCpuTurn, nextRound } from '../gameEngine';
import { rookieEncounter, rookieDistricts } from '@workspace/squabblemon-engine/rookie';
import { getTutorialGuidance } from './tutorialGuidance';
import { coachBattle } from '@workspace/squabblemon-engine/insights';
import updates from '../../reference/dr-fade-tutorial-recording-updates.json';
import tour from '../lib/safehouseTour.json';
import { getTutorialMilestones } from '../../../api-server/src/lib/tutorialMilestones';
import { tutorialClipsForText } from '../lib/tutorialVoice';
test('every offered first-deck replacement can win the four-round lesson with legal guided moves', () => {
  for (const lineup of [ROOKIE_CORE_IDS, ROOKIE_MENTOR_CORE_IDS]) for (const recruit of ROOKIE_FOUNDATION_IDS.filter(id => !lineup.includes(id))) {
    const crew = [...lineup]; crew[5] = recruit;
    const ids = catalogIdsToEngineIds(crew), encounter = rookieEncounter(), districts = rookieDistricts();
    const moves = createGuidedTutorialTranscript(undefined, districts, encounter, ids, ROOKIE_DECK_ID);
    const result = verifyStoryMatchTranscript(encounter, ids, moves, ROOKIE_DECK_ID, undefined, districts);
    assert.equal(getMatchWinner(result), 'player', recruit + ': ' + JSON.stringify(getDistrictResults(result)));
    assert.deepEqual(getTutorialMilestones(result), { playerCardPlayed: true, bankedMotionAfterPlay: true, squabbleUsed: true });
    assert.equal(result.round, 4);
    assert.equal(moves.filter(m => m.endTurn).length, 4);
  }
});

test("coach does not simulate player moves during rival resolution or after the match", () => {
  const match = createStoryMatch(rookieEncounter(), catalogIdsToEngineIds(ROOKIE_CORE_IDS), ROOKIE_DECK_ID, undefined, rookieDistricts());
  assert.equal(getTutorialPlay(pass(match, "player")), null);
  assert.equal(getTutorialPlay({ ...match, phase: "complete" }), null);
});


test('new starter rewards and both tutorial crews keep later story characters locked', () => {
  const later = ['alice', 'cheshire', 'queenofhearts', 'queen-of-hearts', 'dorothy', 'scarecrow', 'tinman', 'tin-man', 'lion', 'oz', 'sherlock', 'watson'];
  for (const id of [...ROOKIE_FOUNDATION_IDS, ...ROOKIE_MENTOR_CORE_IDS, ...rookieEncounter().enemy.cardIds!]) assert.ok(!later.includes(id), id);
  assert.equal(new Set(ROOKIE_FOUNDATION_IDS).size, 24);
  assert.ok(ROOKIE_MENTOR_CORE_IDS.includes('dr-fade'));
});

test('first-deck setup distinguishes the owned collection from a ten-card deck and explains draw timing', () => {
  const collectionLesson = tour.find(step => step.id === 'home-5')?.body ?? '';
  assert.match(collectionLesson, /collection is every card you own/i);
  assert.match(collectionLesson, /ten different cards from that collection/i);
  assert.match(collectionLesson, /first five are your opening hand/i);
  assert.match(collectionLesson, /round two through six/i);
  assert.equal(ROOKIE_MENTOR_CORE_IDS.length, 10);
  assert.equal(new Set(ROOKIE_MENTOR_CORE_IDS).size, 10);
  assert.ok(ROOKIE_MENTOR_CORE_IDS.every(id => ROOKIE_FOUNDATION_IDS.includes(id)), 'the displayed first gang is owned in the issued starter collection');
  for (const id of ROOKIE_MENTOR_CORE_IDS) {
    const card = catalogCardById[id];
    assert.ok(Number.isFinite(card.cost) && Number.isFinite(card.power), `${id} exposes its real Motion cost and Base Hands`);
    assert.ok(card.ability.length > 0 && card.effect.length > 0, `${id} exposes its ability and rules text`);
  }
});


test('coached prompts match the exact new-account guided match; obsolete recordings are never played', () => {
  const expected = new Map(updates.map(cue => [cue.id, cue.text]));
  assert.equal(tour.find(step => step.id === 'home-6')?.body, expected.get('home-6'));
  const crew = ROOKIE_MENTOR_CORE_IDS.map((id, index) => index === 5 ? 'landlord' : id);
  let match = createStoryMatch(rookieEncounter(), catalogIdsToEngineIds(crew), ROOKIE_DECK_ID, undefined, rookieDistricts());
  for (let round = 1; round <= 4; round++) {
    const choice = getTutorialGuidance({ match, selectedInstanceId: null, selectedLane: null, squabble: false, playsThisRound: 0 });
    if (round <= 2) {
      assert.match(choice.body, new RegExp(`you have ${match.playerMotion}`, 'i'));
      assert.ok(choice.expectedCard && choice.expectedLane !== undefined);
      assert.deepEqual(tutorialClipsForText(choice.body), [], 'a different recording must not speak over the live rule');
    }
    if (round === 4) {
      const district = getTutorialGuidance({ match, selectedInstanceId: choice.expectedCard!, selectedLane: null, squabble: true, playsThisRound: 0 });
      assert.match(district.body, /Rule:/);
      assert.deepEqual(tutorialClipsForText(district.body), []);
    }
    if (round !== 3) match = playTurnCard(match, 'player', choice.expectedCard!, choice.expectedLane! as 0 | 1 | 2, round === 4);
    match = nextRound(revealCpuTurn(pass(match, 'player')));
  }
  assert.ok(coachBattle(match).length > 0);
  assert.equal(getMatchWinner(match), 'player');
});
