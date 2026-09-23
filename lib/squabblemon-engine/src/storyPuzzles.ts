export type StoryPuzzleDefinition = {
  readonly id: string;
  readonly title: string;
  readonly instruction: string;
  readonly imageAssetId: string;
  readonly pieces: readonly { readonly id: string; readonly label: string; readonly detail: string }[];
  readonly solution: readonly string[];
  readonly hints: readonly string[];
  readonly solvedText: string;
  readonly skipText: string;
};

export function isStoryPuzzleSolution(puzzle: StoryPuzzleDefinition, order: readonly string[]): boolean {
  return order.length === puzzle.solution.length
    && new Set(order).size === order.length
    && order.every((id, index) => id === puzzle.solution[index]);
}

export function validateStoryPuzzle(puzzle: StoryPuzzleDefinition): boolean {
  const ids = puzzle.pieces.map(piece => piece.id);
  return !!puzzle.id && !!puzzle.title && !!puzzle.instruction && !!puzzle.imageAssetId
    && ids.length >= 3 && ids.length <= 8 && new Set(ids).size === ids.length
    && puzzle.pieces.every(piece => !!piece.id && !!piece.label && !!piece.detail)
    && puzzle.solution.length === ids.length && new Set(puzzle.solution).size === ids.length
    && puzzle.solution.every(id => ids.includes(id)) && puzzle.hints.length > 0
    && puzzle.hints.every(Boolean) && !!puzzle.solvedText && !!puzzle.skipText;
}