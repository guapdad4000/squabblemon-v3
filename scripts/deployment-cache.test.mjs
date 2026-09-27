import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const config = await readFile(new URL('../netlify.toml', import.meta.url), 'utf8');
const notFound = await readFile(new URL('../artifacts/squabblemon/public/404.html', import.meta.url), 'utf8');

test('missing hashed assets return 404 before the SPA fallback', () => {
  const assetRule = config.indexOf('from = "/assets/*"');
  const spaRule = config.indexOf('from = "/*"');
  assert.ok(assetRule >= 0 && assetRule < spaRule);
  assert.match(config.slice(assetRule, spaRule), /to = "\/404\.html"\s+status = 404/);
  assert.match(notFound, /Asset not found/);
});

test('hashed assets are immutable while the HTML manifest revalidates', () => {
  assert.match(config, /for = "\/assets\/\*"[\s\S]*?Cache-Control = "public, max-age=31536000, immutable"/);
  assert.match(config, /for = "\/index\.html"[\s\S]*?Cache-Control = "public, max-age=0, must-revalidate"/);
});
