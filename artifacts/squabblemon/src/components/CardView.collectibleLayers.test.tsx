import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CardView, type CollectibleCardLayers } from './CardView';
import { CardRarityStamp } from './CardRarityStamp';
import { cards, CARD_RARITY_DEFINITIONS, type CardRarity } from '../data';
import { previewBuddyForm } from '../lib/cardFormPreview';

const layers: CollectibleCardLayers = {
  foil:true,
  backdrop:<span data-print-plane="backdrop"/>,
  name:<span data-print-plane="name"/>,
  copy:<span data-print-plane="rules"/>,
};
test('collectible slots render in the card and remain opt-in',()=>{
  const print=renderToStaticMarkup(<CardView card={cards.buddy} isInspector presentationOnly collectibleLayers={layers}/>);
  assert.match(print,/data-layered-card="true"/);
  assert.match(print,/data-layered-foil="true"/);
  for(const plane of ['backdrop','name','rules']) assert.match(print,new RegExp(`data-print-plane="${plane}"`));
  const base=renderToStaticMarkup(<CardView card={cards.buddy} isInspector presentationOnly/>);
  assert.doesNotMatch(base,/data-layered-card|data-print-plane/);
});
test('combat and hand faces reject collectible slots even if mistakenly supplied',()=>{
  for(const props of [{isBoard:true,boardPresentation:'combat' as const},{isBoard:false}]) {
    const html=renderToStaticMarkup(<CardView card={cards.buddy} {...props} presentationOnly collectibleLayers={layers}/>);
    assert.doesNotMatch(html,/data-layered-card|data-print-plane/);
  }
});
test('the Squabbled preview keeps real Hands and element while receiving printed layers',()=>{
  const html=renderToStaticMarkup(<CardView card={previewBuddyForm(cards.buddy,true)} isInspector presentationOnly collectibleLayers={layers}/>);
  assert.match(html,/data-card-power="6"/);
  assert.match(html,/data-buddy-form="squabble"/);
  assert.match(html,/data-print-plane="rules"/);
});
test('every compact rarity retains its full accessible catalog name',()=>{
  for(const rarity of Object.keys(CARD_RARITY_DEFINITIONS) as CardRarity[]) {
    const html=renderToStaticMarkup(<CardRarityStamp rarity={rarity} compact/>);
    assert.ok(html.includes(`aria-label="${CARD_RARITY_DEFINITIONS[rarity].label} rarity"`));
  }
});

import { CollectibleCard } from './CollectibleCard';
import { cardCatalog } from '../data';
test('every catalog card renders its optimized element and rarity', () => {
  for (const card of cardCatalog) {
    const html = renderToStaticMarkup(<CollectibleCard card={card} isInspector presentationOnly/>);
    assert.match(html, /data-layered-card="true"/);
    assert.match(html, /collector-v2\/[^"]+-fist.webp/);
    assert.ok(html.includes('rarity-stamp'), card.name);
    assert.ok(html.includes('layered-rules'), card.name);
  }
});
test('production collection tiles get layers but battle hand and combat cannot', () => {
  const tile = renderToStaticMarkup(<CollectibleCard card={cards.buddy} isBoard fillContainer presentationOnly/>);
  assert.match(tile, /plant-fist.webp/);
  for (const props of [{isBoard:true,boardPresentation:'combat' as const}, {isBoard:false}]) {
    const html = renderToStaticMarkup(<CollectibleCard card={cards.buddy} {...props} presentationOnly/>);
    assert.doesNotMatch(html, /data-layered-card|layered-rules/);
  }
});
