import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const venueCss = readFileSync(new URL('./venue.css', import.meta.url), 'utf8');
const cardFinishCss = readFileSync(new URL('../components/card-finish.css', import.meta.url), 'utf8');

test('venue.css animates game-route-stage transitions and disables animation under reduced motion', () => {
  assert.match(venueCss, /@keyframes\s+sq-route-stage-in/);
  assert.match(venueCss, /\.game-route-stage\s*\{[\s\S]*?animation:\s*sq-route-stage-in/);
  assert.match(venueCss, /html\[data-reduce-motion=["']true["']\]\s+\.game-route-stage/);
});

test('card-finish.css adds dynamic foil-x/foil-y specular rim highlight on tactile cards', () => {
  assert.match(cardFinishCss, /\.collector-card--tactile:hover\s+\.collector-art-rim/);
  assert.match(cardFinishCss, /\.collector-card\[data-tilting=['"]true['"]\]\s+\.collector-art-rim/);
});
