import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { storyContent, storyDialogueToken, STORY_CHARACTERS, VENUE_BY_ID, MAX_STARS_PER_BATTLE, TICKETS_PER_PERFECT_BATTLE, COMPACT_TICKET_CHAPTER_BATTLES } from '@workspace/squabblemon-engine/story';
import { createChapterCatalog, type ChapterArtifact } from './chapterCatalog';
const directory = new URL('./generated/', import.meta.url);
const index = JSON.parse(await readFile(new URL('index.json', directory), 'utf8'));
const readChapter = async (id: string): Promise<ChapterArtifact> => JSON.parse(await readFile(new URL(`${id}.json`, directory), 'utf8'));
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('every delivered chapter is byte-equivalent canonical JSON, including rewards, puzzles and dialogue', async () => {
  assert.equal(index.revision, digest(storyContent));
  assert.equal(index.version, storyContent.version);
  assert.deepEqual(index.venues, VENUE_BY_ID);
  assert.deepEqual(index.rules, { MAX_STARS_PER_BATTLE, TICKETS_PER_PERFECT_BATTLE, COMPACT_TICKET_CHAPTER_BATTLES });
  assert.deepEqual(index.chapters.map(({ revision, ...chapter }) => chapter), storyContent.chapters.map(chapter => ({ ...chapter, nodes: chapter.nodes.map(node => ({ id: node.id, title: node.title, kind: node.kind, optional: node.optional })) })));
  assert.deepEqual(index.characters, JSON.parse(JSON.stringify(STORY_CHARACTERS)));
  assert.deepEqual(index.chapters.map((chapter: { id: string }) => chapter.id), storyContent.chapters.map(chapter => chapter.id));
  for (const chapter of storyContent.chapters) {
    const artifact = await readChapter(chapter.id);
    assert.deepEqual(artifact.chapter, JSON.parse(JSON.stringify(chapter)));
    assert.equal(artifact.revision, index.revision);
    assert.equal(artifact.chapterRevision, digest(chapter));
    for (const node of chapter.nodes) for (const section of ['pre', 'post', 'main'] as const)
      assert.equal(`${index.tokens[node.id] ?? `${node.id}:script-v3`}:${section}:0`, storyDialogueToken(node.id, section, 0));
  }
  assert(Object.entries(index.tokens).every(([id, token]) => token !== `${id}:script-v3`), 'default dialogue tokens are derived rather than shipped twice');
});

test('first load requests exactly one chapter, concurrent calls deduplicate and visited chapters reuse data', async () => {
  const requests: string[] = [];
  const catalog = createChapterCatalog(index, async id => { requests.push(id); return readChapter(id); });
  const chapter = storyContent.chapters[0];
  assert.equal(catalog.getStoryChapter(chapter.id), undefined);
  const a = catalog.loadStoryChapter(chapter.id);
  const b = catalog.loadStoryChapterForNode(chapter.nodes[0].id);
  assert.equal(a, b);
  const content = await a;
  assert.deepEqual(requests, [chapter.id]);
  assert(Object.isFrozen(content));
  assert(Object.isFrozen(content.nodes));
  assert(Object.isFrozen(content.nodes[0].rewards));
  assert.equal(catalog.getStoryNode(chapter.nodes[0].id), content.nodes[0]);
  assert.equal(await catalog.loadStoryChapter(chapter.id), content);
  assert.equal(catalog.getStoryChapter(storyContent.chapters[1].id), undefined);
  assert.equal(requests.length, 1);
});

test('failed loads retry; stale generation never enters the cache; unknown navigation fails explicitly', async () => {
  let attempts = 0;
  const chapter = storyContent.chapters[0];
  const catalog = createChapterCatalog(index, async id => {
    attempts++;
    if (attempts === 1) throw new Error('offline');
    const content = await readChapter(id);
    return attempts === 2 ? { ...content, revision: 'old-cached-generation' } : content;
  });
  await assert.rejects(catalog.loadStoryChapter(chapter.id), /offline/);
  assert.equal(catalog.getStoryChapter(chapter.id), undefined);
  await assert.rejects(catalog.loadStoryChapter(chapter.id), /Reload/);
  assert.equal(catalog.getStoryChapter(chapter.id), undefined);
  assert.equal((await catalog.loadStoryChapter(chapter.id)).id, chapter.id);
  await assert.rejects(catalog.loadStoryChapterForNode('no-such-node'), /Unknown Story node/);
  await assert.rejects(catalog.loadStoryChapter('no-such-chapter'), /Unknown Story chapter/);
  assert.equal(attempts, 3);
});

test('out of order loads preserve both chapters without replacing current selection or progress', async () => {
  const pending = new Map<string, (artifact: ChapterArtifact) => void>();
  const catalog = createChapterCatalog(index, id => new Promise(resolve => pending.set(id, resolve)));
  const [a, b] = storyContent.chapters;
  const first = catalog.loadStoryChapter(a.id);
  const second = catalog.loadStoryChapter(b.id);
  await Promise.resolve();
  pending.get(b.id)!(await readChapter(b.id));
  await second;
  assert.equal(catalog.getStoryChapter(a.id), undefined);
  pending.get(a.id)!(await readChapter(a.id));
  await first;
  assert.equal(catalog.getStoryChapter(b.id)?.id, b.id);
  assert.equal(catalog.getStoryChapter(a.id)?.id, a.id);
});
