import assert from 'node:assert/strict';
import test from 'node:test';
import { squabbleHousePuzzles } from '../../../lib/squabblemon-engine/src/storySquabbleHouse';
import { isStoryPuzzleSolution, validateStoryPuzzle } from '../../../lib/squabblemon-engine/src/storyPuzzles';

function permutations<T>(items: readonly T[]): T[][] {
  return items.length === 0 ? [[]] : items.flatMap((item, index) =>
    permutations(items.filter((_, i) => i !== index)).map(rest => [item, ...rest]));
}

// These rules independently model the visible clues. They do not read solution.
const legal: Record<string, (order: readonly string[]) => boolean> = {
  'squabble-house-breakfast-line': order => {
    let hot = false, contents = 'empty', plated = false;
    for (const step of order) {
      if (step === 'heat') { if (contents !== 'empty') return false; hot = true; }
      if (step === 'batter') { if (!hot || contents !== 'empty') return false; contents = 'batter'; }
      if (step === 'cook') { if (contents !== 'batter') return false; contents = 'cooked'; }
      if (step === 'plate') { if (contents !== 'cooked') return false; contents = 'empty'; plated = true; }
      if (step === 'syrup' && !plated) return false;
    }
    return true;
  },
  'squabble-house-receipt-register': order => {
    const totals = { 'red-plate': 8 + 3 - 2, 'og-combo': 10 + 2 - 1, coffee: 6 + 1 - 3, 'blue-plate': 12 + 0 - 5, 'side-order': 9 + 2 - 5 };
    return order.every((id, i) => i === 0 || totals[order[i - 1] as keyof typeof totals] < totals[id as keyof typeof totals]);
  },
  'squabble-house-booth-truce': order => {
    const red = order.indexOf('red'), blue = order.indexOf('blue');
    return (red === 0 || red === 4) && blue > red && blue + red === 4
      && order.indexOf('manager') === 2 && order.indexOf('ken') === red + 1
      && Math.abs(order.indexOf('cuff') - blue) === 1;
  },
  'squabble-house-grill-rush': order => {
    const tickets: Record<string, readonly [number, number]> = { hash: [3, 10], toast: [1, 11], waffle: [3, 5], eggs: [2, 2], bacon: [2, 7] };
    let finish = 0;
    return order.every(id => { finish += tickets[id][0]; return finish <= tickets[id][1]; });
  },
  'squabble-house-dry-route': order => order[0] === 'a1' && order.at(-1) === 'd3' && order.every((id, i) => i === 0 ||
    Math.abs(id.charCodeAt(0) - order[i - 1].charCodeAt(0)) + Math.abs(Number(id[1]) - Number(order[i - 1][1])) === 1),
  'squabble-house-feather-file': order => {
    const realMinutes: Record<string, number> = { accusation: 25, theft: 20 + 3, escape: 29 - 2, plate: 19 + 2, entry: 24 - 2 };
    return order.every((id, i) => i === 0 || realMinutes[order[i - 1]] < realMinutes[id]);
  },
};

for (const puzzle of squabbleHousePuzzles) {
  test(`${puzzle.id}: visible rules admit exactly one of all permutations`, () => {
    assert.ok(validateStoryPuzzle(puzzle));
    assert.ok(legal[puzzle.id], 'Every authored puzzle needs an independent rule model');
    const solutions = permutations(puzzle.pieces.map(piece => piece.id)).filter(legal[puzzle.id]);
    assert.equal(solutions.length, 1, 'Ambiguous or impossible puzzle');
    assert.deepEqual(solutions[0], puzzle.solution, 'Authored answer disagrees with printed rules');
    assert.equal(isStoryPuzzleSolution(puzzle, puzzle.pieces.map(piece => piece.id)), false, 'Initial order must not be solved');
    for (const order of permutations(puzzle.solution)) assert.equal(isStoryPuzzleSolution(puzzle, order), legal[puzzle.id](order));
  });
}

test('every House puzzle has an independent rule model and malformed payloads fail', () => {
  assert.deepEqual(Object.keys(legal).sort(), squabbleHousePuzzles.map(p => p.id).sort());
  for (const puzzle of squabbleHousePuzzles) {
    assert.equal(isStoryPuzzleSolution(puzzle, puzzle.solution.slice(1)), false);
    assert.equal(isStoryPuzzleSolution(puzzle, [...puzzle.solution, 'foreign-piece']), false);
    assert.equal(isStoryPuzzleSolution(puzzle, puzzle.solution.map(() => puzzle.solution[0])), false);
    assert.equal(isStoryPuzzleSolution(puzzle, ['foreign-piece', ...puzzle.solution.slice(1)]), false);
    assert.equal(isStoryPuzzleSolution(puzzle, []), false);
    assert.equal(puzzle.presentation?.slotLabels.length, puzzle.pieces.length);
    assert.equal(puzzle.hints.length, 2);
  }
});
