import assert from 'node:assert/strict';
import test from 'node:test';
import { ROOKIE_CORE_IDS, ROOKIE_DECK_ID, ROOKIE_FOUNDATION_IDS, catalogIdsToEngineIds } from '../data';
import { createGuidedTutorialTranscript, verifyStoryMatchTranscript, getMatchWinner, getDistrictResults, createStoryMatch, getTutorialPlay, pass } from '../gameEngine';
import { rookieEncounter, rookieDistricts } from '@workspace/squabblemon-engine/rookie';
import { getTutorialMilestones } from '../../../api-server/src/lib/tutorialMilestones';
test('every offered first-deck replacement can win the four-round lesson with legal guided moves', () => {
  for (const recruit of ROOKIE_FOUNDATION_IDS.filter(id => !ROOKIE_CORE_IDS.includes(id))) {
    const crew = [...ROOKIE_CORE_IDS]; crew[5] = recruit;
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
