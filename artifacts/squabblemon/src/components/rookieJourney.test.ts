import assert from 'node:assert/strict';
import test from 'node:test';
import { ROOKIE_CORE_IDS, ROOKIE_MENTOR_CORE_IDS, ROOKIE_DECK_ID, ROOKIE_FOUNDATION_IDS, catalogIdsToEngineIds } from '../data';
import { createGuidedTutorialTranscript, verifyStoryMatchTranscript, getMatchWinner, getDistrictResults, createStoryMatch, getTutorialPlay, pass, playTurnCard, revealCpuTurn, nextRound } from '../gameEngine';
import { rookieEncounter, rookieDistricts } from '@workspace/squabblemon-engine/rookie';
import { getTutorialGuidance } from './tutorialGuidance';
import { coachBattle } from '@workspace/squabblemon-engine/insights';
import updates from '../../reference/dr-fade-tutorial-recording-updates.json';
import tour from '../lib/safehouseTour.json';
import { getTutorialMilestones } from '../../../api-server/src/lib/tutorialMilestones';
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


test('replacement recording lines match the exact new-account guided match', () => {
  const expected = new Map(updates.map(cue => [cue.id, cue.text]));
  assert.equal(tour.find(step => step.id === 'home-6')?.body, expected.get('home-6'));
  const crew = ROOKIE_MENTOR_CORE_IDS.map((id, index) => index === 5 ? 'landlord' : id);
  let match = createStoryMatch(rookieEncounter(), catalogIdsToEngineIds(crew), ROOKIE_DECK_ID, undefined, rookieDistricts());
  for (let round = 1; round <= 4; round++) {
    const choice = getTutorialGuidance({ match, selectedInstanceId: null, selectedLane: null, squabble: false, playsThisRound: 0 });
    if (round <= 2) assert.equal(choice.body, expected.get(`r${round}_choose_card`));
    if (round === 4) assert.equal(getTutorialGuidance({ match, selectedInstanceId: choice.expectedCard!, selectedLane: null, squabble: true, playsThisRound: 0 }).body, expected.get('r4_choose_district'));
    if (round !== 3) match = playTurnCard(match, 'player', choice.expectedCard!, choice.expectedLane! as 0 | 1 | 2, round === 4);
    match = nextRound(revealCpuTurn(pass(match, 'player')));
  }
  assert.equal(coachBattle(match), expected.get('result-default'));
  assert.equal(getMatchWinner(match), 'player');
});
