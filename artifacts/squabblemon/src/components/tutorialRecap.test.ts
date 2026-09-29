import assert from 'node:assert/strict';
import test from 'node:test';
import { ROOKIE_CORE_IDS, ROOKIE_DECK_ID, catalogIdsToEngineIds } from '../data';
import { createGuidedTutorialTranscript, createStoryMatch, getDistrictResults, verifyStoryMatchTranscript } from '../gameEngine';
import { rookieDistricts, rookieEncounter } from '@workspace/squabblemon-engine/rookie';
import { describeTutorialBoard, describeTutorialEvent, tutorialNextAdjustment } from './tutorialRecap';

const encounter = rookieEncounter();
const districts = rookieDistricts();
const cardIds = catalogIdsToEngineIds(ROOKIE_CORE_IDS);
const moves = createGuidedTutorialTranscript(undefined, districts, encounter, cardIds, ROOKIE_DECK_ID);
const result = verifyStoryMatchTranscript(encounter, cardIds, moves, ROOKIE_DECK_ID, undefined, districts);

test('play, rival and SQUABBLE recaps use event scores/resources, not a predicted outcome', () => {
  for (const owner of ['player', 'cpu'] as const) {
    const event = result.effectLog.find(item => item.owner === owner && item.type === 'play');
    assert.ok(event, `${owner} actually played`);
    const text = describeTutorialEvent(event, result);
    assert.match(text, new RegExp(event.note.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(text, /Motion \d+ → \d+/);
    assert.match(text, /You \d+ → \d+, Rival \d+ → \d+|Scores did not change/);
  }
  const squabble = result.effectLog.find(item => item.type === 'play' && item.note.includes('SQUABBLE'));
  assert.ok(squabble?.source?.after);
  const base = squabble.source.after.basePower;
  assert.match(describeTutorialEvent(squabble, result), new RegExp(`from ${base} to ${base * 2}`));
});

test('board lesson counts district claims; ties and losses get actionable advice', () => {
  const text = describeTutorialBoard(result);
  for (const lane of getDistrictResults(result)) assert.match(text, new RegExp(`You ${lane.player}, Rival ${lane.cpu}`));
  assert.match(text, /won by claiming at least two districts/);
  assert.match(tutorialNextAdjustment(result), /Next time/);
  const blank = { ...createStoryMatch(encounter, cardIds, ROOKIE_DECK_ID, undefined, districts), round: 4, phase: 'complete' as const };
  assert.match(describeTutorialBoard(blank), /tied \(neither side claims it\)/);
  assert.match(describeTutorialBoard(blank), /draw/);
});