import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const indexHtml = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const indexCss = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

test('index.css does not block font discovery behind CSS @import rules', () => {
  assert.doesNotMatch(indexCss, /@import\s+url\(['"]?https:\/\/api\.fontshare\.com/);
  assert.doesNotMatch(indexCss, /@import\s+url\(['"]?https:\/\/fonts\.googleapis\.com/);
  assert.match(indexHtml, /rel="preconnect"\s+href="https:\/\/api\.fontshare\.com"/);
  assert.match(indexHtml, /href="https:\/\/api\.fontshare\.com\/v2\/css\?f\[\]=clash-display@400,500,600,700&display=swap"/);
  assert.match(indexHtml, /Plus\+Jakarta\+Sans:wght@400;500;600;700/);
});

test('noise-overlay tiles a bounded 180px turbulence patch instead of rasterizing full-viewport SVG turbulence', () => {
  const noiseBlock = indexCss.match(/\.noise-overlay\s*\{[\s\S]*?\}/)?.[0] ?? '';
  assert.ok(noiseBlock, 'expected .noise-overlay rule in src/index.css');
  assert.match(noiseBlock, /background-size:\s*180px\s+180px/);
  assert.match(noiseBlock, /background-repeat:\s*repeat/);
});
