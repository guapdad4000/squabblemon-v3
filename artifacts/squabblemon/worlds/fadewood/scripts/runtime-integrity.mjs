/** Dependency-free release gate for the checked-in nested scene build. */
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const sourceRoot = fileURLToPath(new URL('../', import.meta.url));
const outputRoot = fileURLToPath(new URL('../../../public/scenes/fadewood/', import.meta.url));
const manifestPath = resolve(outputRoot, 'source-manifest.json');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
async function walk(root, { source = false } = {}) {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isSymbolicLink() || (source && (entry.name === '__pycache__' || /\.py[co]$/.test(entry.name)))) continue;
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path, { source }));
    else if (entry.isFile()) files.push(path);
  }
  return files.sort();
}
async function hashes(root, files) {
  const result = {};
  for (const path of files) result[relative(root, path).replaceAll('\\', '/')] = sha256(await readFile(path));
  return result;
}
export async function collectRuntimeSourceHashes() {
  const sourceFiles = [
    ...await walk(resolve(sourceRoot, 'src'), { source: true }),
    ...await walk(resolve(sourceRoot, 'scripts'), { source: true }),
    ...['integrated.html', 'vite.config.js', 'package.json', 'package-lock.json', 'THIRD-PARTY-NOTICES.txt'].map(path => resolve(sourceRoot, path)),
  ].sort();
  return hashes(sourceRoot, sourceFiles);
}
export async function runtimeIntegrity({ write = false } = {}) {
  const source = await collectRuntimeSourceHashes();
  const runtime = await hashes(outputRoot, (await walk(outputRoot)).filter(path => path !== manifestPath));
  if (!runtime['index.html'] || !Object.keys(runtime).some(path => /^assets\/integrated-[^/]+\.js$/.test(path)) || !runtime['assets/squabble-block.glb']) throw new Error('Fadewood runtime is incomplete. Run npm run build in worlds/fadewood.');
  const current = { version: 1, source, runtime };
  if (write) { await writeFile(manifestPath, JSON.stringify(current, null, 2) + '\n'); return { sourceFiles: Object.keys(source).length, runtimeFiles: Object.keys(runtime).length }; }
  const saved = JSON.parse(await readFile(manifestPath, 'utf8'));
  for (const [label, actual] of [['source', source], ['runtime', runtime]]) {
    const expected = saved[label] ?? {};
    const changed = [...new Set([...Object.keys(actual), ...Object.keys(expected)])].filter(path => actual[path] !== expected[path]);
    if (changed.length) throw new Error(`Fadewood ${label} differs from its verified build (${changed.slice(0, 6).join(', ')}). Rebuild worlds/fadewood and retain generated output.`);
  }
  if (saved.version !== 1) throw new Error('Unsupported Fadewood source manifest. Rebuild the scene.');
  return { sourceFiles: Object.keys(source).length, runtimeFiles: Object.keys(runtime).length };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log('Fadewood runtime integrity:', await runtimeIntegrity({ write: process.argv.includes('--write') })); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
