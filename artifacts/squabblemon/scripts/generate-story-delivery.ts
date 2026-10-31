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
const tokens = Object.fromEntries(storyContent.chapters.flatMap(chapter => chapter.nodes.map(node => [node.id, storyDialogueToken(node.id, 'main', 0).split(':').slice(0, -2).join(':')])));
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


// Lightweight world markers and resume tokens. Screenplay remains chapter-on-demand.
const worldActors: Record<string, string> = {
  'Cornball':'cornball', 'Ganger Blue':'ganger-blue', 'Ganger Red':'ganger-red',
  'Wifey':'wifey', 'Baby Momma':'baby-momma', 'BabyMomma':'baby-momma',
  'Snitch':'snitch', 'Cracked Head':'cracked-head', 'Sherlock':'sherlock', 'Yasuke':'yasuke',
  'Inmate Kingpin':'inmate-kingpin', 'Homeless Guy':'homeless-guy', 'Leon':'homeless-guy',
  'SquabbleHouse Manager':'squabble-house-manager', 'Manager':'squabble-house-manager', 'Dr. Fade':'dr-fade',
};
const worldTracking = JSON.stringify({ revision, nodes: Object.fromEntries(storyContent.chapters.flatMap(chapter => chapter.nodes.map(node => {
  const lines = node.kind === 'battle' ? [...node.preDialogue, ...node.postDialogue] : node.scenes;
  return [node.id, { token: tokens[node.id] ?? `${node.id}:script-v3`, post: node.kind === 'battle' ? node.postDialogue.length : 0,
    participants: [...new Set(lines.flatMap(line => Object.hasOwn(worldActors, line.speaker) ? [worldActors[line.speaker]] : []))] }];
}))) }) + '\n';
const trackingDirectory = new URL('../src/lib/fadewood/', import.meta.url);
const trackingFile = new URL('node-tracking.json', trackingDirectory);
if (check) {
  if (await readFile(trackingFile, 'utf8').catch(() => '') !== worldTracking) throw new Error('Fadewood Story tracking is stale. Run generate-story-delivery.ts.');
} else {
  await mkdir(trackingDirectory, { recursive: true });
  await writeFile(trackingFile, worldTracking);
}
