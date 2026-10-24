import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { getStoryBattle, storyContent } from '../../../lib/squabblemon-engine/src/story';
import { buildStoryMusicRoutes, serializeStoryMusicRoutes } from '../scripts/generate-story-music-routes';
import { musicModeForRoute, soundtrackForRoute } from './musicModes';

test('generated soundtrack routing matches every authored Story node', () => {
  const nodeIds = new Set(storyContent.chapters.flatMap(chapter => chapter.nodes.map(node => node.id)));
  assert(nodeIds.size > 100, 'exercise the complete authored catalog');
  for (const nodeId of nodeIds) {
    const chapter = storyContent.chapters.find(candidate => candidate.nodes.some(node => node.id === nodeId))!;
    const battleType = getStoryBattle(nodeId)?.battleType;
    const mode = battleType === 'boss' || battleType === 'mini-boss' ? 'boss' : 'battle';
    const track = chapter.order && chapter.order % 2 === 0 ? 'story-music-3' : 'story-music';
    for (const suffix of ['', '?deck=block']) {
      const route = `/game/story/play/${nodeId}${suffix}`;
      assert.equal(musicModeForRoute(route), mode, route);
      assert.equal(soundtrackForRoute(route, 'story')[0].id, track, route);
    }
  }
});

test('unknown Story routes keep ordinary battle music and the odd chapter playlist', () => {
  for (const id of ['missing-story-node', '__proto__', 'constructor', 'toString']) {
    const route = `/game/story/play/${id}`;
    assert.equal(musicModeForRoute(route), 'battle');
    assert.equal(soundtrackForRoute(route, 'story')[0].id, 'story-music');
  }
  assert.equal(musicModeForRoute('/game/story'), 'cinema');
  assert.deepEqual(soundtrackForRoute('/game/story', 'story').map(track => track.id), ['story-music', 'story-music-3']);
});

test('metadata keeps first-match semantics even when a default node precedes a duplicate boss', () => {
  assert.deepEqual(buildStoryMusicRoutes([
    { order: 1, nodes: [{ id: 'duplicate', kind: 'dialogue' }, { id: 'first-boss', kind: 'battle', battleType: 'boss' }] },
    { order: 2, nodes: [{ id: 'duplicate', kind: 'battle', battleType: 'boss' }, { id: 'first-boss', kind: 'dialogue' }, { id: 'even-boss', kind: 'battle', battleType: 'mini-boss' }, { id: 'even-dialogue', kind: 'dialogue' }] },
    { order: 0, nodes: [{ id: 'zero-order', kind: 'dialogue' }] },
  ]), { 'even-boss': 3, 'even-dialogue': 2, 'first-boss': 1 });
});

test('checked-in music metadata is current with the authoritative Story content', async () => {
  assert.equal(await readFile(new URL('./storyMusicRoutes.json', import.meta.url), 'utf8'), serializeStoryMusicRoutes());
});


test('metadata serialization is stable when distinct authored nodes are reordered', () => {
  const nodes = [
    { id: 'z-last', kind: 'battle', battleType: 'boss' },
    { id: 'a-first', kind: 'dialogue' },
    { id: 'm-middle', kind: 'battle', battleType: 'mini-boss' },
  ];
  const forward = buildStoryMusicRoutes([{ order: 2, nodes }]);
  const reverse = buildStoryMusicRoutes([{ order: 2, nodes: [...nodes].reverse() }]);
  assert.deepEqual(Object.keys(forward), ['a-first', 'm-middle', 'z-last']);
  assert.equal(JSON.stringify(forward), JSON.stringify(reverse));
});
