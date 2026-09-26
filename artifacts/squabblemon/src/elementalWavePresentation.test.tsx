import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ELEMENTAL_WAVE } from '../../../lib/squabblemon-engine/src/elementalWave';
import { cardCatalog } from './data';
import { getCardImage } from './lib/assets';
import { CardView } from './components/CardView';

test('all wave portraits, rarity diamonds, element badges and descriptions render at Collection sizes', () => {
  for (const [engineId, catalogId, , rarity, element] of ELEMENTAL_WAVE) {
    const card = cardCatalog.find(entry => entry.engineId === engineId)!;
    assert(getCardImage(catalogId).startsWith('data:image/svg+xml'), catalogId);
    for (const props of [
      { isBoard: true, fillContainer: true, presentationOnly: true },
      { inspectable: false },
      { isInspector: true, presentationOnly: true },
    ]) {
      const html = renderToStaticMarkup(<CardView card={card} {...props} />);
      assert.match(html, new RegExp(`data-card-rarity="${rarity}"`), catalogId);
      assert(html.includes(element), catalogId);
      assert(html.includes(card.name), catalogId);
      if (!props.isBoard) {
        assert(html.includes(card.ability), catalogId);
        if (props.isInspector) assert(html.includes(card.effect), catalogId);
      }
      assert(html.includes('data:image/svg+xml'), catalogId);
      assert(html.includes('◆'), catalogId);
    }
  }
});