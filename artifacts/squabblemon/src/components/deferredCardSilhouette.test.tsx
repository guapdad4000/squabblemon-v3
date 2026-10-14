import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const collectionSource = readFileSync(new URL('../pages/game/Collection.tsx', import.meta.url), 'utf8');
const collectionCss = readFileSync(new URL('../styles/collection.css', import.meta.url), 'utf8');
const deckWorkshopCss = readFileSync(new URL('../styles/deck-workshop.css', import.meta.url), 'utf8');

test('deferred collection card shell renders cost/power badge and rarity data attribute', () => {
  assert.match(collectionSource, /className="collection-card-grid__deferred\s+card-bevel"/);
  assert.match(collectionSource, /data-card-rarity=\{card\.rarity\.toLowerCase\(\)\}/);
  assert.match(collectionCss, /\.collection-card-grid__deferred\[data-card-rarity=/);
  assert.match(deckWorkshopCss, /\.deck-workbench__card-placeholder\s*\{/);
});
