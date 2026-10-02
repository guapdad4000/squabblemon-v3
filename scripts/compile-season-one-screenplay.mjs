import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const source = new URL('artifacts/squabblemon/scripts/story/rewrites/season-one/READTHROUGH.md', root);
const destination = new URL('lib/squabblemon-engine/src/storyChapters/seasonOneRewrite.json', root);
const screenplay = {};
let section;
let sectionCount = 0;
let lineCount = 0;
for (const [index, raw] of readFileSync(source, 'utf8').split('\n').entries()) {
  const heading = raw.match(/^### ([a-z0-9-]+) \/ (pre|post|main)$/);
  if (heading) {
    const [, node, part] = heading;
    const entry = screenplay[node] ??= {};
    if (entry[part]) throw new Error(`Duplicate scene ${node}/${part}`);
    section = entry[part] = [];
    sectionCount += 1;
  } else if (raw.startsWith('#')) {
    section = undefined;
  } else if (section && raw.trim()) {
    const line = raw.match(/^([^:]+): (.+)$/);
    if (!line) throw new Error(`Malformed dialogue at line ${index + 1}`);
    if (!line[1].trim() || !line[2].trim()) throw new Error(`Empty speaker or dialogue at line ${index + 1}`);
    section.push([line[1], line[2]]);
    lineCount += 1;
  }
}
if (Object.keys(screenplay).length !== 62 || sectionCount !== 113 || lineCount !== 2765) {
  throw new Error(`Unexpected Season One screenplay shape: ${Object.keys(screenplay).length} nodes, ${sectionCount} sections, ${lineCount} lines`);
}
for (const [node, sections] of Object.entries(screenplay)) {
  const expected = node === 'block-crowned' || node === 'red-tapes-open-the-envelope' ||
    node === 'red-tapes-courier-table' || node === 'red-tapes-the-wrong-person' ||
    node === 'red-tapes-let-her-grieve' || node === 'og-uncles-visit' ||
    node === 'the-real-receipts' || node === 'the-family-blessed' ||
    node === 'function-after-hours' || node === 'the-block-changes-hands' ||
    node === 'crown-community-meal'
    ? ['main'] : ['pre', 'post'];
  if (Object.keys(sections).sort().join(',') !== [...expected].sort().join(',')) {
    throw new Error(`Invalid sections for ${node}: expected ${expected.join(', ')}, received ${Object.keys(sections).join(', ')}`);
  }
  for (const [part, lines] of Object.entries(sections)) {
    if (!lines.length) throw new Error(`Empty section ${node}/${part}`);
  }
}
const nodeRevision = sections => {
  let hash = 14695981039346656037n;
  for (const character of JSON.stringify(sections)) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(character.charCodeAt(0))) * 1099511628211n);
  }
  return hash.toString(16).padStart(16, '0');
};
const document = {
  revisions: Object.fromEntries(Object.entries(screenplay).map(([node, sections]) => [node, nodeRevision(sections)])),
  scenes: screenplay,
};
const json = JSON.stringify(document, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (readFileSync(destination, 'utf8') !== json) throw new Error('Screenplay JSON is stale. Run node scripts/compile-season-one-screenplay.mjs.');
} else writeFileSync(destination, json);
console.log(`${Object.keys(screenplay).length} scenes / ${sectionCount} sections / ${lineCount} lines: ${fileURLToPath(destination)}`);
