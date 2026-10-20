import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StoryMovieScreen } from './StoryMovie';

test('an unopened chapter renders its original poster and navigation but no media source', () => {
  const html = renderToStaticMarkup(<StoryMovieScreen
    cinematic={{
      videoAssetId: 'assets/original-chapter.mp4',
      posterAssetId: 'assets/original-chapter-poster.webp',
      environmentAssetId: 'assets/original-environment.webp',
    }}
    title="Original chapter"
    onContinue={() => {}}
    onClose={() => {}}
  />);
  const video = html.match(/<video\b[^>]*>/)?.[0];
  assert.ok(video);
  assert.match(video, /preload="none"/);
  assert.match(video, /poster="\/assets\/original-chapter-poster\.webp"/);
  assert.doesNotMatch(video, /\ssrc=/);
  assert.doesNotMatch(html, /original-chapter\.mp4/);
  assert.match(html, /Play chapter/);
  assert.match(html, /Continue to dialogue/);
  assert.match(html, /Back to map/);
  assert.match(html, /role="dialog"/);
});
