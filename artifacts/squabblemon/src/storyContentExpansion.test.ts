import assert from 'node:assert/strict';
import test from 'node:test';
import { sequelChapters } from '../../../lib/squabblemon-engine/src/seasonChapters';
import { expandSeasonOneDialogue } from '../../../lib/squabblemon-engine/src/seasonOneDialogueExpansion';
import { specialPresentationChapters } from '../../../lib/squabblemon-engine/src/storySpecials';
import { blockPartyChapter, validateStoryContent } from '../../../lib/squabblemon-engine/src/story';

test('Season One expansion keeps every shipped line as an exact prefix', () => {
  const expanded = expandSeasonOneDialogue(sequelChapters);
  assert.equal(expanded.length, sequelChapters.length);

  sequelChapters.forEach((chapter, chapterIndex) => {
    const nextChapter = expanded[chapterIndex];
    assert.equal(nextChapter.id, chapter.id);
    assert.equal(nextChapter.nodes.length, chapter.nodes.length);

    chapter.nodes.forEach((node, nodeIndex) => {
      const nextNode = nextChapter.nodes[nodeIndex];
      assert.equal(nextNode.id, node.id);
      if (node.kind === 'battle') {
        if (nextNode.kind !== 'battle') throw new Error(`Node ${node.id} stopped being a battle`);
        assert.deepEqual(nextNode.preDialogue.slice(0, node.preDialogue.length), node.preDialogue);
        assert.deepEqual(nextNode.postDialogue.slice(0, node.postDialogue.length), node.postDialogue);
      } else {
        if (nextNode.kind === 'battle') throw new Error(`Node ${node.id} changed to a battle`);
        assert.deepEqual(nextNode.scenes.slice(0, node.scenes.length), node.scenes);
      }
    });
  });
});

test('Season One expansion leaves encounters, rewards and routing untouched', () => {
  const expanded = expandSeasonOneDialogue(sequelChapters);
  sequelChapters.forEach((chapter, chapterIndex) => {
    const nextChapter = expanded[chapterIndex];
    assert.deepEqual(nextChapter.prerequisites, chapter.prerequisites);
    chapter.nodes.forEach((node, nodeIndex) => {
      const nextNode = nextChapter.nodes[nodeIndex];
      assert.deepEqual(nextNode.rewards, node.rewards);
      assert.deepEqual(nextNode.prerequisites, node.prerequisites);
      assert.deepEqual(nextNode.teaching, node.teaching);
      assert.deepEqual(nextNode.cinematic, node.cinematic);
      if (node.kind === 'battle') {
        if (nextNode.kind !== 'battle') throw new Error(`Node ${node.id} stopped being a battle`);
        assert.deepEqual(nextNode.encounter, node.encounter);
        assert.deepEqual(nextNode.starObjectives, node.starObjectives);
        assert.deepEqual(nextNode.recommendedCollection, node.recommendedCollection);
      }
    });
  });
});

test('Sherlock registry has unique IDs, two varied battles per chapter and one puzzle', () => {
  assert.deepEqual(
    specialPresentationChapters.map(({ id, order, prerequisites }) => ({ id, order, prerequisites })),
    [
      { id: 'special-sherlock-missing-motion', order: 17, prerequisites: ['block-party'] },
      { id: 'special-sherlock-false-bottom', order: 18, prerequisites: ['special-sherlock-missing-motion'] },
      { id: 'special-sherlock-last-reel', order: 19, prerequisites: ['special-sherlock-false-bottom'] },
    ],
  );

  const nodes = specialPresentationChapters.flatMap((chapter) => chapter.nodes);
  assert.equal(new Set(nodes.map((node) => node.id)).size, nodes.length);
  assert.deepEqual(
    specialPresentationChapters.map((chapter) =>
      chapter.nodes.filter((node) => node.kind === 'battle').map((node) => node.encounter.roundLimit)),
    [[4, 5], [5, 6], [4, 6]],
  );
  const puzzles = nodes.flatMap((node) => node.puzzle ? [node.puzzle] : []);
  assert.equal(puzzles.length, 1);
  assert.deepEqual(puzzles[0].solution, ['power-notice', 'empty-case', 'hallway-frame', 'leader-strip']);
});

test('Sherlock chapters satisfy executable story-content validation', () => {
  assert.doesNotThrow(() => validateStoryContent({
    version: 1,
    chapters: [blockPartyChapter, ...specialPresentationChapters],
  }));
});