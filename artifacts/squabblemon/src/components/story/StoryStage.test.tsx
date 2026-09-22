import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { getStoryNode, storyContent } from '@workspace/squabblemon-engine/story';
import { CHAPTER_TWO_STAGES, createDialogueRevealRun, resolveDialogueTap, resolveStoryStage } from './StoryStage';

const expectedChapterTwoStages = {
  'red-tapes-open-the-envelope': ['assets/layered/crown-court.webp', 'crown rooftop'],
  'red-tapes-red-side-open': ['assets/layered/morning-block.webp', 'next morning'],
  'red-tapes-courier-table': ['assets/layered/corner-store.webp', 'courier table'],
  'red-tapes-cheese-has-terms': ['assets/layered/corner-store.webp', 'corner store'],
  'red-tapes-pay-per-view': ['assets/layered/civic-summit.webp', 'media table'],
  'red-tapes-the-wrong-person': ['assets/layered/sunlit-hall.webp', 'private back room'],
  'red-tapes-roast-with-a-receipt': ['assets/layered/red-court.webp', 'early afternoon'],
  'red-tapes-side-eye-security': ['assets/layered/tidal-street.webp', 'harbor table'],
  'red-tapes-mama-has-the-floor': ['assets/layered/sunset-block.webp', 'sunset'],
  'red-tapes-let-her-grieve': ['assets/layered/old-town.webp', 'porch'],
} as const;

test('Chapter Two stages preserve authored time and place with shipped art', () => {
  assert.deepEqual(Object.keys(CHAPTER_TWO_STAGES).sort(), Object.keys(expectedChapterTwoStages).sort());
  for (const [nodeId, [assetId, place]] of Object.entries(expectedChapterTwoStages)) {
    const node = getStoryNode(nodeId);
    assert(node, nodeId);
    const chapter = storyContent.chapters.find(candidate => candidate.nodes.some(candidateNode => candidateNode.id === nodeId));
    const stage = resolveStoryStage(nodeId, node, chapter);
    assert.equal(stage.backdropAssetId, assetId);
    assert.match(stage.place.toLowerCase(), new RegExp(place));
    const shippedAsset = fileURLToPath(new URL(`../../../public/${assetId}`, import.meta.url));
    assert.equal(existsSync(shippedAsset), true, `${assetId} must ship with the client`);
  }
});

test('unmapped stages use node cinematic art before the chapter map', () => {
  const chapter = storyContent.chapters.find(candidate => candidate.id === 'blue-side-blues');
  assert(chapter);
  const node = chapter.nodes[0];
  assert.notEqual(node.cinematic.environmentAssetId, chapter.mapAssetId);
  assert.equal(resolveStoryStage(node.id, node, chapter).backdropAssetId, node.cinematic.environmentAssetId);
});

test('dialogue taps reveal first, advance second, and reject rapid duplicate input', () => {
  assert.equal(resolveDialogueTap({ pending: false, revealComplete: false, lastTap: 0, now: 20 }), 'reveal');
  assert.equal(resolveDialogueTap({ pending: false, revealComplete: true, lastTap: 20, now: 80 }), 'ignore');
  assert.equal(resolveDialogueTap({ pending: false, revealComplete: true, lastTap: 20, now: 220 }), 'advance');
});

test('pending saves block dialogue surface advancement', () => {
  assert.equal(resolveDialogueTap({ pending: true, revealComplete: false, lastTap: 0, now: 500 }), 'ignore');
  assert.equal(resolveDialogueTap({ pending: true, revealComplete: true, lastTap: 0, now: 500 }), 'ignore');
});

test('completing a partial reveal cancels later timer writes before the next tap advances', () => {
  let rendered = '';
  let scheduledTick: () => void = () => {};
  let timerActive = false;
  const run = createDialogueRevealRun({
    text: 'A full line stays full.',
    onReveal: value => { rendered = value; },
    schedule: tick => {
      scheduledTick = tick;
      timerActive = true;
      return () => { timerActive = false; };
    },
  });

  scheduledTick();
  scheduledTick();
  assert.equal(rendered, 'A ');

  run.complete();
  assert.equal(rendered, 'A full line stays full.');
  assert.equal(timerActive, false);

  if (timerActive) scheduledTick();
  assert.equal(rendered, 'A full line stays full.');
  assert.equal(resolveDialogueTap({ pending: false, revealComplete: true, lastTap: 100, now: 300 }), 'advance');
});
