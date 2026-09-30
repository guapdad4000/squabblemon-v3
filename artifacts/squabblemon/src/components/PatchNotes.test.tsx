import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { PatchDetail } from './PatchNotes';

const renderPatch = (version: string, artCardId: string) => renderToStaticMarkup(
  <PatchDetail patch={{
    version,
    title: `Patch ${version} title`,
    date: '2026-09-29',
    overview: 'Original overview text stays available to readers.',
    buffs: ['Original buff text.'],
    changes: ['Original change text.'],
    artCardId,
    mailStatus: 'complete',
  }} />,
);

test('patch 1.7 renders its wide accessible banner before the title, without portrait framing', () => {
  const html = renderPatch('1.7', 'triple-og-blue');
  assert.match(html, /src="\/assets\/events\/triple-og-patch-1-7\.webp"/);
  assert.match(html, /alt="Original Blue OG and Red OG with their dogs on the block"/);
  assert.ok(html.indexOf('patch-art--banner') < html.indexOf('Patch 1.7 title'));
  assert.doesNotMatch(html, /patch-art--portrait|<figcaption>/);
  assert.match(html, /Original overview text stays available to readers\./);
});

test('unrelated patches keep their existing portrait artwork', () => {
  const html = renderPatch('1.6', 'cracked-head');
  assert.match(html, /patch-art--portrait/);
  assert.match(html, /alt="Cracked Head artwork"/);
  assert.doesNotMatch(html, /triple-og-patch-1-7|patch-art--banner/);
});