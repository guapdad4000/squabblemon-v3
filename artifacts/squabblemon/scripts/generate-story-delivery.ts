/** Build-only: canonical evaluation validates the complete campaign before delivery. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile, unlink } from 'node:fs/promises';
import { storyContent, STORY_CHARACTERS, storyDialogueToken, VENUE_BY_ID, MAX_STARS_PER_BATTLE, TICKETS_PER_PERFECT_BATTLE, COMPACT_TICKET_CHAPTER_BATTLES } from '../../../lib/squabblemon-engine/src/story';

const directory = new URL('../src/lib/story/generated/', import.meta.url);
const check = process.argv.includes('--check');
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const revision = digest(storyContent);
const files = new Map<string, string>();
const chapters = storyContent.chapters.map(chapter => {
  const chapterRevision = digest(chapter);
  files.set(`${chapter.id}.json`, JSON.stringify({ revision, chapterRevision, chapter }) + '\n');
  return { ...chapter, revision: chapterRevision, nodes: chapter.nodes.map(node => ({
    id: node.id, title: node.title, kind: node.kind, optional: node.optional,
  })) };
});
// catalog.ts already derives the default namespace. Ship only authored overrides
// (for example revised Season Two dialogue) instead of repeating each node ID.
const tokens = Object.fromEntries(storyContent.chapters.flatMap(chapter => chapter.nodes.flatMap(node => {
  const token = storyDialogueToken(node.id, 'main', 0).split(':').slice(0, -2).join(':');
  return token === `${node.id}:script-v3` ? [] : [[node.id, token]];
})));
files.set('index.json', JSON.stringify({ revision, version: storyContent.version, chapters, characters: STORY_CHARACTERS, venues: VENUE_BY_ID, rules: { MAX_STARS_PER_BATTLE, TICKETS_PER_PERFECT_BATTLE, COMPACT_TICKET_CHAPTER_BATTLES }, tokens }) + '\n');
if (!check) await mkdir(directory, { recursive: true });
for (const [name, content] of files) {
  if (check) {
    const actual = await readFile(new URL(name, directory), 'utf8').catch(() => '');
    if (actual !== content) throw new Error(`Story delivery is stale: ${name}. Run generate-story-delivery.ts.`);
  } else await writeFile(new URL(name, directory), content);
}
for (const name of await readdir(directory)) if (name.endsWith('.json') && !files.has(name)) {
  if (check) throw new Error(`Unexpected obsolete Story delivery artifact: ${name}`);
  await unlink(new URL(name, directory));
}
console.log(`Story delivery ${check ? 'verified' : 'generated'}: ${chapters.length} chapters, ${revision}`);
