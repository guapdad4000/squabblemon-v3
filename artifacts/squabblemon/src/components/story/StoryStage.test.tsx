import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getStoryNode, storyContent, storySeasons } from '@workspace/squabblemon-engine/story';
import { CHAPTER_TWO_STAGES, createDialogueRevealRun, formatDialogueText, plainDialogueText, resolveDialoguePortrait, resolveDialogueTap, resolveStoryStage } from './StoryStage';

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
  let rendered = 0;
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
  assert.equal(rendered, 2);

  run.complete();
  assert.equal(rendered, 'A full line stays full.'.length);
  assert.equal(timerActive, false);

  if (timerActive) scheduledTick();
  assert.equal(rendered, 'A full line stays full.'.length);
  assert.equal(resolveDialogueTap({ pending: false, revealComplete: true, lastTap: 100, now: 300 }), 'advance');
});

test('screenplay emphasis and actor directions render as safe formatted text in stage and transcript', () => {
  const text = '*(Quietly, to the table.)* You earned it. **That is the *whole* thing.**';
  const markup = renderToStaticMarkup(createElement('p', null, formatDialogueText(text)));

  assert.equal(plainDialogueText(text), '(Quietly, to the table.) You earned it. That is the whole thing.');
  assert.match(markup, /story-dialogue-direction/);
  assert.match(markup, /story-dialogue-strong/);
  assert.match(markup, /story-dialogue-emphasis/);
  assert.doesNotMatch(markup, /\*(?:\(|\*|[A-Z])/);
  assert.equal(renderToStaticMarkup(createElement('p', null, formatDialogueText(text, 9))).includes('*(Quietly'), false);
});

test('player dialogue uses the side portrait while a listening player uses the rear portrait', () => {
  assert.equal(resolveDialoguePortrait('Player', 'assets/characters/player.webp', false), 'assets/characters/player.webp');
  assert.equal(resolveDialoguePortrait('Player', 'assets/characters/player.webp', true), 'assets/characters/player-rear.webp');
  assert.equal(resolveDialoguePortrait('Rae', 'assets/characters/rae.webp', true), 'assets/characters/rae.webp');
});

test('directions keep their parentheses and split emphasis markers never leak into dialogue', () => {
  const direction = '*(Picks up the crown.)*';
  assert.equal(plainDialogueText(direction), '(Picks up the crown.)');
  assert.equal(renderToStaticMarkup(createElement('p', null, formatDialogueText(direction))), '<p><span class="story-dialogue-direction">(Picks up the crown.)</span></p>');
  assert.equal(plainDialogueText('They said *don’t tell her,'), 'They said don’t tell her,');
  assert.equal(plainDialogueText('minute* one.'), 'minute one.');
  assert.match(renderToStaticMarkup(createElement('p', null, formatDialogueText('They said *don’t tell her,'))), /<em[^>]*>don’t tell her,<\/em>/);
  assert.match(renderToStaticMarkup(createElement('p', null, formatDialogueText('minute* one.'))), /<em[^>]*>minute<\/em> one\./);
});

test('all shipped Season One dialogue tuples render without markdown delimiter leakage', () => {
  const season = storySeasons.find(item => item.id === 'season-1');
  assert(season);
  const chapters = storyContent.chapters.filter(chapter => season.chapterIds.includes(chapter.id));
  const sections = chapters.flatMap(chapter => chapter.nodes.flatMap(node => node.kind === 'battle'
    ? [{ dialogue: node.preDialogue }, { dialogue: node.postDialogue }]
    : [{ dialogue: node.scenes }]));
  const lines = sections.flatMap(section => section.dialogue);
  assert.equal(lines.length, 2765);
  assert.equal(sections.length, 113);
  for (const line of lines) {
    assert.equal(plainDialogueText(line.text), line.text.replaceAll('*', ''), line.text);
  }
});
