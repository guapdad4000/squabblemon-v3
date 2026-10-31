import { build } from 'vite';
import { runtimeIntegrity } from './runtime-integrity.mjs';
import { copyFile, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = new URL('../../../public/scenes/fadewood/', import.meta.url);
// Remove only generated bundles. Authored runtime art lives beside them.
const assets = new URL('assets/', output);
for (const name of await readdir(assets)) if (/\.(?:js|css)$/.test(name)) await unlink(new URL(name, assets));
await build({ root, configFile: `${root}vite.config.js` });
await copyFile(new URL('integrated.html', output), new URL('index.html', output));
await unlink(new URL('integrated.html', output));
await copyFile(new URL('../THIRD-PARTY-NOTICES.txt', import.meta.url), new URL('THIRD-PARTY-NOTICES.txt', output));
await runtimeIntegrity({ write: true });
console.log('Fadewood integrated runtime built at public/scenes/fadewood/index.html');
