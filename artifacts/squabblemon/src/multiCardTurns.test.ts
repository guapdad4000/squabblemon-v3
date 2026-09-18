import { completeEngineCrew } from '@workspace/squabblemon-engine/data';
import assert from 'node:assert/strict';
import test from 'node:test';
import { CompletePlayerMatchBody } from '@workspace/api-zod';
import { cards } from './data';
import {
  canAffordSelection, createMatchFromEngineCards, createStoryMatch, nextRound, pass,
  playTurnCard, revealCpuTurn, validateTurnRules, verifyMatchTranscript, verifyStoryMatchTranscript,
  type Lane, type Match, type PlayerMove,
} from './gameEngine';
import { makeActivityEncounter } from '@workspace/squabblemon-engine/activities';

const crew = completeEngineCrew(['cornball', 'earthy', 'plug', 'gamer', 'snow', 'wifey', 'baby']);
const create = () => createMatchFromEngineCards('my-crew', crew, 'my-rival', crew);

test('two affordable cards spend Motion in one turn, with no rival action or extra draw', () => {
  let match = create();
  const initialHand = match.playerHand.length;
  for (const cardId of ['cornball', 'earthy']) {
    const card = match.playerHand.find(card => card.cardId === cardId)!;
    match = playTurnCard(match, 'player', card.instanceId, 0);
    assert.equal(match.round, 1);
    assert.equal(match.phase, 'player');
    assert.equal(match.playerDrawIndex, 5);
    assert.equal(match.effectLog.filter(event => event.owner === 'cpu' && event.type === 'play').length, 0);
  }
  assert.equal(match.playerMotion, 0);
  assert.equal(match.playerHand.length, initialHand - 2);
  assert.equal(match.boards[0].filter(card => card.owner === 'player').length, 2);
  assert.throws(() => playTurnCard(match, 'player', match.playerHand[0].instanceId, 1), /Not enough Motion/);
  assert.equal(pass(match, 'player').phase, 'cpu-reveal');
});

test('same-turn discounts apply immediately and Squabble stays once per match', () => {
  let match = { ...create(), playerMotion: cards.plug.cost + cards.snow.cost - 1 };
  const plug = match.playerHand.find(card => card.cardId === 'plug')!;
  match = playTurnCard(match, 'player', plug.instanceId, 0, true);
  assert.equal(match.playerMotion, cards.snow.cost - 1);
  const snow = match.playerHand.find(card => card.cardId === 'snow')!;
  assert(canAffordSelection(match, 'player', snow.instanceId, 1));
  assert.throws(() => playTurnCard(match, 'player', snow.instanceId, 1, true), /SQUABBLE is unavailable/);
  match = playTurnCard(match, 'player', snow.instanceId, 1);
  assert.equal(match.playerMotion, 0);
  assert.equal(match.squabbleUsed, true);
  assert.equal(match.phase, 'player');
});

test('the rival spends its budget across multiple cards and then ends its turn', () => {
  const match = pass({ ...create(), cpuMotion: 6 }, 'player');
  const result = revealCpuTurn(match);
  assert.equal(result.phase, 'resolved');
  assert.equal(result.round, 1);
  const plays = result.effectLog.filter(event => event.owner === 'cpu' && event.type === 'play');
  assert(plays.length > 1);
  assert(result.cpuMotion >= 0);
  const newRound = nextRound(result);
  assert.equal(newRound.round, 2);
  assert.equal(newRound.playerMotion, 3);
  assert.equal(newRound.playerDrawIndex, 6);
});

function finish(initial: Match) {
  let match = initial;
  const moves: PlayerMove[] = [];
  for (let round = 1; round <= 6; round++) {
    while (true) {
      const option = match.playerHand.flatMap(card => ([0, 1, 2] as Lane[])
        .map(lane => ({ card, lane })))
        .find(({ card, lane }) => canAffordSelection(match, 'player', card.instanceId, lane));
      if (!option) break;
      moves.push({ cardInstanceId: option.card.instanceId, lane: option.lane, squabble: false, endTurn: false });
      match = playTurnCard(match, 'player', option.card.instanceId, option.lane);
    }
    moves.push({ cardInstanceId: null, lane: null, squabble: false, endTurn: true });
    match = nextRound(revealCpuTurn(pass(match, 'player')));
  }
  return { match, moves };
}

test('standard and story multi-card transcripts replay exactly and pass API validation', () => {
  const initial = createMatchFromEngineCards('my-crew', crew, 'block', completeEngineCrew(['cornball', 'snow', 'roaster', 'rastamon', 'wifey', 'oink', 'baby']));
  const normal = finish(initial);
  assert(normal.moves.length > 6);
  const payload = CompletePlayerMatchBody.parse({ moves: normal.moves });
  assert.deepEqual(payload.moves, normal.moves);
  validateTurnRules(payload.moves, 2);
  assert.deepEqual(verifyMatchTranscript('my-crew', 'block', payload.moves, initial.abilityUpgradeSnapshot, crew), normal.match);

  const encounter = makeActivityEncounter('boss', 'multi-card-test', 'block', '2026-09-14');
  const story = finish(createStoryMatch(encounter, crew, 'my-crew'));
  assert.deepEqual(verifyStoryMatchTranscript(encounter, crew, story.moves, 'my-crew'), story.match);
});

test('transcripts reject overspending, duplicate cards, unfinished rounds, extra turns and legacy downgrades', () => {
  const initial = create();
  const first = initial.playerHand[0];
  const move: PlayerMove = { cardInstanceId: first.instanceId, lane: 0, squabble: false, endTurn: false };
  const end: PlayerMove = { cardInstanceId: null, lane: null, squabble: false, endTurn: true };
  const encounter = makeActivityEncounter('freeze', 'rejections', 'block', '2026-09-14');
  const replay = (moves: PlayerMove[]) => verifyStoryMatchTranscript(encounter, crew, moves, 'my-crew');
  assert.throws(() => replay([move, move, ...Array(6).fill(end)]), /not in this hand/);
  assert.throws(() => replay([{ ...move, cardInstanceId: 'player:my-crew:2:plug' }, { ...move, cardInstanceId: 'player:my-crew:4:snow' }, ...Array(6).fill(end)]), /Not enough Motion/);
  assert.throws(() => replay([...Array(5).fill(end), move]), /six rounds|not in this hand/);
  assert.throws(() => replay(Array(7).fill(end)), /after the match ended/);
  assert.throws(() => replay([{ ...end, endTurn: false }, ...Array(6).fill(end)]), /Invalid end turn/);
  assert.throws(() => validateTurnRules([{ cardInstanceId: null, lane: null, squabble: false }], 2), /turn rules/);
  assert.equal(CompletePlayerMatchBody.safeParse({ moves: Array(65).fill(end) }).success, false);
  assert.equal(cards.earthy.cost, 1);
});
