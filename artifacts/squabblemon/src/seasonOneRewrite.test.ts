import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { storyContent, storyDialogueToken, storySeasons } from '@workspace/squabblemon-engine/story';
import { REWRITE_PORTRAITS, seasonOneRevisionForScript } from '../../../lib/squabblemon-engine/src/seasonOneRewrite';
import screenplay from '../../../lib/squabblemon-engine/src/storyChapters/seasonOneRewrite.json';

test('compiled tuples exactly preserve the delivered export, without fences or count annotations', () => {
  const exportText = readFileSync(new URL('../reference/season-one-delivered.md', import.meta.url), 'utf8');
  const delivered: Record<string, Record<string, [string, string][]>> = {};
  let section: [string, string][] | undefined;
  let inFence = false;
  for (const raw of exportText.split(/\r?\n/)) {
    const heading = /^### ([a-z0-9-]+) \/ (pre|post|main)\s+·\s+\d+ lines$/.exec(raw);
    if (heading) {
      const [, nodeId, part] = heading;
      const node = delivered[nodeId] ??= {};
      assert.equal(node[part], undefined, `${nodeId}/${part}: duplicate export section`);
      section = node[part] = [];
      inFence = false;
    } else if (raw === '```') {
      inFence = !inFence;
    } else if (inFence && section && raw.length) {
      const colon = raw.indexOf(': ');
      assert.ok(colon > 0, `Malformed delivered tuple: ${raw}`);
      section.push([raw.slice(0, colon), raw.slice(colon + 2)]);
    }
  }
  assert.equal(Object.keys(delivered).length, 62);
  assert.deepEqual(screenplay.scenes, delivered, 'No authored speaker, text, section, or ordering may be rewritten by normalization');
});

test('the rewritten screenplay covers every Season One scene using shipped portraits', () => {
  const ids = storySeasons.find(season => season.id === 'season-1')!.chapterIds;
  const nodes = storyContent.chapters.filter(chapter => ids.includes(chapter.id)).flatMap(chapter => chapter.nodes);
  assert.equal(nodes.length, 62);
  assert.deepEqual(Object.keys(screenplay.scenes).sort(), nodes.map(node => node.id).sort());
  assert.deepEqual(Object.keys(screenplay.revisions).sort(), Object.keys(screenplay.scenes).sort());
  assert.equal(Object.hasOwn(screenplay.scenes, 'crown-0730'), false);
  let sectionCount = 0;
  let lineCount = 0;
  const speakerCounts = new Map<string, number>();
  for (const node of nodes) {
    const script = screenplay.scenes[node.id as keyof typeof screenplay.scenes];
    assert.deepEqual(Object.keys(script).sort(), node.kind === 'battle' ? ['post', 'pre'] : ['main']);
    assert.ok(Object.values(script).every(lines => lines?.length), `${node.id} has an empty section`);
    assert.equal(screenplay.revisions[node.id as keyof typeof screenplay.revisions], seasonOneRevisionForScript(script));
    const sections = node.kind === 'battle' ? { pre: node.preDialogue, post: node.postDialogue } : { main: node.scenes };
    for (const [section, lines] of Object.entries(sections)) {
      assert.ok(lines.length, `${node.id}/${section}`);
      assert.deepEqual(lines.map(line => [line.speaker, line.text]), script[section as keyof typeof script]);
      sectionCount += 1;
      lineCount += lines.length;
      for (const line of lines) {
        assert.ok(line.text.trim());
        speakerCounts.set(line.speaker, (speakerCounts.get(line.speaker) ?? 0) + 1);
        assert.ok(existsSync(new URL(`../public/${line.portraitAssetId}`, import.meta.url)), line.portraitAssetId);
      }
    }
  }
  assert.equal(sectionCount, 113);
  assert.equal(lineCount, 2765);
  assert.equal(speakerCounts.get('Player'), 330);
  assert.equal(speakerCounts.get('Rae'), 9);
  assert.deepEqual(REWRITE_PORTRAITS, {
    Player: 'assets/characters/player.webp',
    Rae: 'assets/characters/rae.webp',
  });
});

test('node revisions only change when that node’s screenplay changes', () => {
  const scenes = screenplay.scenes as Record<string, Record<string, [string, string][]>>;
  const unchangedNode = Object.keys(scenes).find(id => id !== 'welcome-to-the-block')!;
  const changed = structuredClone(scenes['welcome-to-the-block']);
  changed.pre[0][1] += ' Changed.';
  const changedRevision = seasonOneRevisionForScript(changed);
  assert.notEqual(changedRevision, screenplay.revisions['welcome-to-the-block']);
  assert.equal(screenplay.revisions[unchangedNode as keyof typeof screenplay.revisions],
    seasonOneRevisionForScript(scenes[unchangedNode]));
  assert.equal(screenplay.revisions['welcome-to-the-block'],
    seasonOneRevisionForScript(scenes['welcome-to-the-block']));
});

test('new dialogue cannot be skipped by an old read marker; other seasons keep theirs', () => {
  const first = storyContent.chapters.find(chapter => chapter.id === 'block-party')!.nodes[0];
  assert.equal(storyDialogueToken(first.id, 'pre', 0),
    `${first.id}:script-${screenplay.revisions[first.id as keyof typeof screenplay.revisions]}:pre:0`);
  assert.notEqual(storyDialogueToken(first.id, 'pre', 0), `${first.id}:script-v4:pre:0`);
  assert.notEqual(storyDialogueToken(first.id, 'pre', 0), `${first.id}:script-v3:pre:0`);
  const secondSeason = storyContent.chapters.find(chapter => chapter.id === 's2-the-morning-after')!;
  assert.equal(storyDialogueToken(secondSeason.nodes[0].id, 'pre', 0), `${secondSeason.nodes[0].id}:script-v3:pre:0`);
});
