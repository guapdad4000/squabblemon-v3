import assert from 'node:assert/strict';
import test from 'node:test';
import { createMatch, createCardInstance, playTurnCard, type Match, type Owner, type Lane } from './gameEngine';

const unit = (id: string, owner: Owner, lane: Lane, i = 0) => ({ ...createCardInstance(id, owner, 'yard', i), lane });
const blank = (): Match => ({ ...createMatch('block', 'block'), round: 1, playerMotion: 30, cpuMotion: 30,
  boards: [[], [], []], playerHand: [], cpuHand: [] });
function cast(m: Match, id: string, lane: Lane, silenced = false) {
  const s = createCardInstance(id, 'player', 'cast', m.nextEventSequence);
  if (silenced) s.statuses.silenced = true;
  return playTurnCard({ ...m, phase: 'player', playerHand: [s] }, 'player', s.instanceId, lane);
}
const hands = (m: Match, id: string) => m.boards.flat().find(c => c.cardId === id)!.powerModifier;
const stash = (m: Match) => (m.creativeMarks ?? []).find(x => x.kind === 'stash');

test('first handoff goes to the weakest other Inmate anywhere', () => {
  const m = blank(); m.boards[2] = [unit('inmate-crafty', 'player', 2)];
  const after = cast(m, 'inmate-kingpin', 0);
  assert.equal(hands(after, 'inmate-crafty'), 1);
  assert.equal(hands(after, 'inmate-kingpin'), 0);
  assert.deepEqual(stash(after)?.seen?.length, 1);
});
test('with no Inmate yet, Kingpin holds Contraband for the next Inmate', () => {
  let m = cast(blank(), 'inmate-kingpin', 0);
  assert.equal(stash(m)?.seen?.length, 0);
  m = cast(m, 'inmate-informant', 1);
  assert.equal(hands(m, 'inmate-informant'), 1);
});
test('three distinct carriers pay +1 each, then survivors +1, once', () => {
  let m = blank(); m.boards[1] = [unit('inmate-crafty', 'player', 1)];
  m = cast(m, 'inmate-kingpin', 0);
  m = cast(m, 'inmate-informant', 2);
  assert.equal(hands(m, 'inmate-informant'), 1);
  m = cast(m, 'inmate-contraband', 2);
  assert.equal(stash(m), undefined);
  assert.equal(hands(m, 'inmate-crafty'), 2); // +1 carrier, +1 survivor
  assert.equal(hands(m, 'inmate-informant'), 2);
  assert.equal(hands(m, 'inmate-contraband'), 2);
  const later = cast(m, 'inmate-boyfriend', 1);
  assert.equal(hands(later, 'inmate-boyfriend'), 0);
});
test('a carrier moving does not count twice and non-Inmates never carry', () => {
  let m = cast(blank(), 'inmate-kingpin', 0);
  m = cast(m, 'rastamon', 0);
  assert.equal(stash(m)?.seen?.length, 0);
});
test('silenced Kingpin arms nothing and a second reveal cannot re-arm', () => {
  const m = blank(); m.boards[1] = [unit('inmate-crafty', 'player', 1)];
  const quiet = cast(m, 'inmate-kingpin', 0, true);
  assert.equal(stash(quiet), undefined);
  assert.equal(hands(quiet, 'inmate-crafty'), 0);
});
test('card text promises the hold-for-next behaviour', async () => {
  const { cards } = await import('./data');
  assert.match(cards['inmate-kingpin'].effect, /if none, Kingpin holds it/);
  assert.equal(cards['inmate-kingpin'].cost, 1);
  assert.equal(cards['inmate-kingpin'].power, 3);
});
