import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../artifacts/squabblemon');
const require = createRequire(path.join(root, 'package.json'));
const { createServer } = await import(pathToFileURL(require.resolve('vite')).href);

for (const base of ['/', '/squabblemon/']) {
  test(`Vite boot art uses exactly one ${base} base path and real public files`, async () => {
    const cacheDir = await mkdtemp(path.join(tmpdir(), 'boot-assets-'));
    const server = await createServer({ configFile: false, root, base, cacheDir, logLevel: 'silent',
      server: { middlewareMode: true, watch: null, preTransformRequests: false },
      optimizeDeps: { noDiscovery: true, include: [] },
    });
    try {
      const html = await server.transformIndexHtml(base, await readFile(path.join(root, 'index.html'), 'utf8'));
      for (const [role, asset] of [
        ['sbl-wordmark', 'brand/prismatic/logos/squabblemon-wordmark-standard-gold.webp'],
        ['sbl-fighters', 'brand/broadcast/loading/fighters-still.webp'],
      ]) {
        const tag = [...html.matchAll(/<img\b[^>]*>/g)].map(match => match[0]).find(tag => tag.includes(`class="${role}"`));
        assert.ok(tag, `Missing ${role}`);
        const src = /\bsrc="([^"]+)"/.exec(tag)?.[1];
        assert.equal(src, `${base}${asset}`, 'Vite applies the configured base to static public URLs once');
        await access(path.join(root, 'public', asset));
      }
      assert.ok(html.includes(`poster.src = '${base}brand/broadcast/loading/'`), 'Runtime-selected scene also receives one base');
      assert.ok(!html.includes('%BASE_URL%'), 'No unresolved base placeholders');
    } finally { await server.close(); await rm(cacheDir, { recursive: true, force: true }); }
  });
}
