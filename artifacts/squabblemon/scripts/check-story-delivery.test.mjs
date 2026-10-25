import assert from 'node:assert/strict';
import test from 'node:test';
import { checkStoryDelivery, STORY_CHAPTER_BUDGET, STORY_INDEX_BUDGET } from './check-story-delivery.mjs';
const chunk = (fileName, modules, imports = [], bytes = 1000) => ({ fileName, modules, imports, dynamicImports: [], bytes });
const valid = () => ({ storyAssets: [{fileName:'block-party.json',chapterId:'block-party',bytes:1000},{fileName:'red-side.json',chapterId:'red-side',bytes:1000}], chunks: [
  chunk('Story.js', ['/repo/artifacts/squabblemon/src/pages/game/Story.tsx'], ['catalog.js']),
  chunk('catalog.js', ['/repo/artifacts/squabblemon/src/lib/story/generated/index.json']),
  chunk('block-party.js', ['/repo/artifacts/squabblemon/src/lib/story/generated/block-party.json']),
  chunk('red-side.js', ['/repo/artifacts/squabblemon/src/lib/story/generated/red-side-tapes.json']),
] });
test('accepts poster index and independently lazy chapters', () => { assert.equal(checkStoryDelivery(valid()).chapterCount, 2); });
test('rejects a transitive full-campaign eager import', () => {
  const report = valid(); report.chunks[1].imports.push('full.js'); report.chunks.push(chunk('full.js', ['/repo/lib/squabblemon-engine/src/story.ts']));
  assert.throws(() => checkStoryDelivery(report), /eagerly includes/);
});
test('rejects an eagerly prefetched chapter payload', () => {
  const report = valid(); report.chunks[0].imports.push('block-party.js');
  assert.throws(() => checkStoryDelivery(report), /eagerly includes/);
});
test('rejects missing or duplicate emitted chapter assets', () => {
  const report = valid(); report.storyAssets = [];
  assert.throws(() => checkStoryDelivery(report), /No external/);
  report.storyAssets = [{fileName:'a.json',chapterId:'a',bytes:1000},{fileName:'b.json',chapterId:'a',bytes:1000}];
  assert.throws(() => checkStoryDelivery(report), /more than once/);
});
test('enforces index and per-chapter byte ceilings', () => {
  const report = valid(); report.chunks[1].bytes = STORY_INDEX_BUDGET + 1;
  assert.throws(() => checkStoryDelivery(report), /index chunk exceeds/);
  report.chunks[1].bytes = 1000; report.storyAssets[0].bytes = STORY_CHAPTER_BUDGET + 1;
  assert.throws(() => checkStoryDelivery(report), /Chapter exceeds/);
});
test('allows eager hashed URL references while keeping chapter bodies external', () => {
  const report = valid();
  report.chunks[0].imports.push('url.js');
  report.chunks.push(chunk('url.js', ['/repo/artifacts/squabblemon/src/lib/story/generated/block-party.json?url&no-inline']));
  assert.equal(checkStoryDelivery(report).chapterCount, 2);
});
