import assert from 'node:assert/strict';
import test from 'node:test';
import { loadingScenes } from './broadcastCatalog';
import { selectLoadingScene } from './loadingScenes';

test('random selection can choose every authored scene without repeating the last visit', () => {
  for (const previous of [null, ...loadingScenes.map(scene => scene.id)]) {
    const available = loadingScenes.filter(scene => scene.id !== previous);
    assert.deepEqual(available.map((_, index) => selectLoadingScene(previous, () => (index + .5) / available.length).id), available.map(scene => scene.id));
    for (const value of [0, .2, .5, .9, .999999]) assert.notEqual(selectLoadingScene(previous, () => value).id, previous);
  }
});
