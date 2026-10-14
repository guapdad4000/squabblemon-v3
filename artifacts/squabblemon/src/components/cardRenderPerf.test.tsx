import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { catalogCardById } from '../data';
import { CardView } from './CardView';

const cardFinishCss = readFileSync(new URL('./card-finish.css', import.meta.url), 'utf8');
const fadeParkSource = readFileSync(new URL('../pages/game/FadePark.tsx', import.meta.url), 'utf8');

test('CardView renders async decoding on character portraits and static css foil renderer attribute', () => {
  const html = renderToStaticMarkup(
    <CardView card={catalogCardById.cornball} isBoard fillContainer presentationOnly disableLayout />,
  );
  const portraitTag = html.match(/<img[^>]*class="[^"]*collector-portrait[^"]*"[^>]*>/)?.[0] ?? '';
  assert.ok(portraitTag, 'expected collector-portrait img tag');
  assert.match(portraitTag, /decoding="async"/);
  assert.match(html, /class="collector-webgl"[^>]*data-foil-renderer="css"/);
});

test('card-finish.css disables mask-image on inactive CSS collector-webgl spans', () => {
  assert.match(cardFinishCss, /\.collector-webgl:not\(\[data-foil-renderer=['"]webgl['"]\]\)\s*\{\s*mask-image:\s*none/);
});

test('FadePark throttles pointer parallax with requestAnimationFrame instead of synchronous getBoundingClientRect on every pointermove', () => {
  assert.match(fadeParkSource, /requestAnimationFrame/);
  assert.doesNotMatch(fadeParkSource, /handlePointerMove[\s\S]{0,180}getBoundingClientRect/);
});
