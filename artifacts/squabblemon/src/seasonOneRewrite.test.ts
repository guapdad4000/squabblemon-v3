import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { storyContent, storyDialogueToken, storySeasons } from '@workspace/squabblemon-engine/story';
import screenplay from '../../../lib/squabblemon-engine/src/storyChapters/seasonOneRewrite.json';

test('the rewritten screenplay covers every Season One scene using shipped portraits', () => {
  const ids = storySeasons.find(season => season.id === 'season-1')!.chapterIds;
  const nodes = storyContent.chapters.filter(chapter => ids.includes(chapter.id)).flatMap(chapter => chapter.nodes);
  assert.equal(nodes.length, 62);
  assert.deepEqual(Object.keys(screenplay).sort(), nodes.map(node => node.id).sort());
  for (const node of nodes) {
    const script = screenplay[node.id as keyof typeof screenplay];
    assert.deepEqual(Object.keys(script).sort(), node.kind === 'battle' ? ['post', 'pre'] : ['main']);
    const sections = node.kind === 'battle' ? { pre: node.preDialogue, post: node.postDialogue } : { main: node.scenes };
    for (const [section, lines] of Object.entries(sections)) {
      assert.ok(lines.length, `${node.id}/${section}`);
      assert.deepEqual(lines.map(line => [line.speaker, line.text]), script[section as keyof typeof script]);
      for (const line of lines) {
        assert.ok(line.text.trim());
        assert.ok(existsSync(new URL(`../public/${line.portraitAssetId}`, import.meta.url)), line.portraitAssetId);
      }
    }
  }
});

test('new dialogue cannot be skipped by an old read marker; other seasons keep theirs', () => {
  const first = storyContent.chapters.find(chapter => chapter.id === 'block-party')!.nodes[0];
  assert.notEqual(storyDialogueToken(first.id, 'pre', 0), `${first.id}:script-v3:pre:0`);
  const secondSeason = storyContent.chapters.find(chapter => chapter.id === 's2-the-morning-after')!;
  assert.equal(storyDialogueToken(secondSeason.nodes[0].id, 'pre', 0), `${secondSeason.nodes[0].id}:script-v3:pre:0`);
});
