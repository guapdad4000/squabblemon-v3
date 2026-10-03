import assert from 'node:assert/strict';
import test from 'node:test';
import { createRivalryRoom, applyRivalryCommand, rivalryRecipes } from './rivalry-online-model';
import { allRankingDecks } from './all-decks-ranking-decks';
for (const [side, id] of [['blue', 'focused-blue-set'], ['red', 'focused-red-set']] as const) test(`${side} playtest roster matches the audited roster and excludes GUAP and FOLKS`, () => {
  assert.deepEqual(rivalryRecipes[side], allRankingDecks().find(deck => deck.id === id)!.cardIds);
  assert(!rivalryRecipes[side].some(id => ['guap', 'folks'].includes(id)));
});
for (const openingSeat of ['player', 'cpu'] as const) test(`playtest uses alternating multiplayer turns from ${openingSeat}`, () => {
  let room = createRivalryRoom({ first: 'blue', seed: 'online-model-test', tier: 2, openingSeat });
  const other = openingSeat === 'player' ? 'cpu' : 'player';
  for (let round = 1; round <= 6; round++) {
    const opener = round % 2 === 1 ? openingSeat : other;
    assert.equal(room.activeSeat, opener);
    assert.equal(room.match?.round, round);
    assert.throws(() => applyRivalryCommand(room, { kind: 'pass', owner: opener === 'player' ? 'cpu' : 'player' }), /Wait for your turn/);
    room = applyRivalryCommand(room, { kind: 'pass', owner: opener });
    assert.equal(room.match?.round, round, 'only one side ended; do not advance');
    room = applyRivalryCommand(room, { kind: 'pass', owner: room.activeSeat });
  }
  assert.equal(room.status, 'complete');
  assert.equal(room.match?.phase, 'complete');
});
test('swapping seats retains deck-specific draws and requested intermediate upgrades', () => {
  const settings = { seed: 'matched-draws', tier: 2 };
  const a = createRivalryRoom({ ...settings, first: 'blue' }).match!;
  const b = createRivalryRoom({ ...settings, first: 'red' }).match!;
  assert.deepEqual(a.playerCardIds, b.cpuCardIds);
  assert.deepEqual(a.cpuCardIds, b.playerCardIds);
  assert(a.abilityUpgradeSnapshot.player.every(card => card.moveTier === 2));
  assert(a.abilityUpgradeSnapshot.cpu.every(card => card.moveTier === 2));
});

for (const forbidden of ['guap', 'folks']) test('custom audit recipes reject ' + forbidden, () => {
  const recipes = { blue: [...rivalryRecipes.blue], red: [...rivalryRecipes.red] };
  recipes.red[7] = forbidden;
  assert.throws(() => createRivalryRoom({ first: 'blue', tier: 0, seed: 'excluded', recipes }), /excluded/);
});
