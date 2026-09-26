import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const source = new URL('artifacts/squabblemon/scripts/story/rewrites/season-one/READTHROUGH.md', root);
const destination = new URL('lib/squabblemon-engine/src/storyChapters/seasonOneRewrite.json', root);
const screenplay = {};
let section;
for (const [index, raw] of readFileSync(source, 'utf8').split('\n').entries()) {
  const heading = raw.match(/^### ([a-z0-9-]+) \/ (pre|post|main)$/);
  if (heading) {
    const [, node, part] = heading;
    const entry = screenplay[node] ??= {};
    if (entry[part]) throw new Error(`Duplicate scene ${node}/${part}`);
    section = entry[part] = [];
  } else if (raw.startsWith('#')) {
    section = undefined;
  } else if (section && raw.trim()) {
    const line = raw.match(/^([^:]+): (.+)$/);
    if (!line) throw new Error(`Malformed dialogue at line ${index + 1}`);
    section.push([line[1], line[2]]);
  }
}
const json = JSON.stringify(screenplay, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (readFileSync(destination, 'utf8') !== json) throw new Error('Screenplay JSON is stale. Run node scripts/compile-season-one-screenplay.mjs.');
} else writeFileSync(destination, json);
console.log(`${Object.keys(screenplay).length} scenes / ${Object.values(screenplay).flatMap(node => Object.values(node).flat()).length} lines: ${fileURLToPath(destination)}`);
