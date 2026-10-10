import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cardCatalog, CARD_RARITY_DEFINITIONS } from './data';
import { createCardInstance } from './gameEngine';
import { CardView } from './components/CardView';

const decode = (html: string) => html.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#x27;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>');

test('every live card renders its actual identity, printed budget and complete inspector copy', () => {
  for (const card of cardCatalog) for (const format of ['collection', 'board', 'inspector'] as const) {
    const html = decode(renderToStaticMarkup(<CardView card={card} isBoard={format === 'board'} isInspector={format === 'inspector'} presentationOnly={format === 'board'} inspectable={false} />));
    assert(html.includes(`data-card-id="${card.catalogId}"`), `${card.engineId}/${format}: ownership identity`);
    assert(html.includes(`data-card-cost="${card.cost}"`), `${card.engineId}/${format}: Motion`);
    assert(html.includes(`data-card-power="${card.power}"`), `${card.engineId}/${format}: printed Hands`);
    assert(html.includes(`data-card-rarity="${card.rarity}"`), `${card.engineId}/${format}: rarity`);
    assert(html.includes(card.name), `${card.engineId}/${format}: real name`);
    assert(html.includes(CARD_RARITY_DEFINITIONS[card.rarity].label), `${card.engineId}/${format}: accessible rarity`);
    if (format !== 'board') {
      assert(html.includes(card.ability), `${card.engineId}/${format}: current ability name`);
      assert(html.includes(card.effect), `${card.engineId}/${format}: current effect copy`);
    }
  }
});

test('the board renders resolved Hands rather than XP growth or printed Hands for every card', () => {
  for (const card of cardCatalog) {
    const instance = createCardInstance(card.engineId, 'player');
    instance.lane = 0;
    instance.powerModifier = 2;
    const gained = renderToStaticMarkup(<CardView card={instance} isBoard presentationOnly inspectable={false} />);
    assert(gained.includes(`data-card-power="${card.power + 2}"`), card.engineId);
    instance.statuses.frozen = true;
    const frozen = renderToStaticMarkup(<CardView card={instance} isBoard presentationOnly inspectable={false} />);
    assert(frozen.includes('data-card-power="0"'), card.engineId);
    assert(frozen.includes('data-card-status="frozen"'), card.engineId);
  }
});
