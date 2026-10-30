import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { anunakiCards, anunakiRarities } from '@workspace/squabblemon-engine/anunakiWave';
import { catalogCardById, cards } from '../data';
import { ANUNAKI_ARTWORK_IDS } from '../lib/anunakiCardArt';
import { collectibleElementArtwork, collectiblePrintArtworkSources } from '../lib/collectiblePrintAssets';
import { getCardWallpaper, getCardWallpaperForCard } from '../lib/cardFinish';
import { CollectibleCard } from './CollectibleCard';
import { CardView } from './CardView';
import { createCardInstance } from '../gameEngine';

test('presentation artwork IDs match the engine roster without importing it on the public shell', () => {
  assert.deepEqual([...ANUNAKI_ARTWORK_IDS].sort(), Object.keys(anunakiCards).sort());
});

const card = anunakiCards.inanna;
(catalogCardById as Record<string, unknown>)[card.id] = { ...card, catalogId:card.id, rarity:anunakiRarities[card.id] };
test('Anunaki V2 print selects its own inner scene and plate while keeping the Normal fist', () => {
  const normal = collectibleElementArtwork(cards.cornball);
  const themed = collectibleElementArtwork(card);
  assert.notEqual(themed.plate, normal.plate);
  assert.equal(themed.fist, normal.fist);
  const html = renderToStaticMarkup(<CollectibleCard card={card} isInspector presentationOnly/>);
  assert.match(html, /data-layered-card="true"/);
  assert.match(html, /data-anunaki-scene="true"/);
  assert.match(html, /normal-fist\.webp/);
  assert.match(html, /anunaki-plate\.webp/);
  const normalHtml = renderToStaticMarkup(<CollectibleCard card={cards.cornball} isInspector presentationOnly/>);
  assert.doesNotMatch(normalHtml, /data-anunaki-scene|anunaki-plate/);
  assert.equal(getCardWallpaperForCard(cards.cornball), getCardWallpaper('Normal'));
  assert.ok(collectiblePrintArtworkSources({...card, rarity:'Legendary'}).some(path=>path.includes('anunaki-temple.webp')));
});
test('the themed collectible layers remain excluded from combat and hand', () => {
  for (const props of [{isBoard:true,boardPresentation:'combat' as const},{isBoard:false}]) {
    const html = renderToStaticMarkup(<CollectibleCard card={card} {...props} presentationOnly/>);
    assert.doesNotMatch(html, /data-anunaki-scene|anunaki-plate|data-layered-card/);
  }
});

test('tablet art override renders in catalog inspector only, never battle faces or instances', () => {
  const override = '/assets/characters/tablet-previews/inanna.webp';
  const catalog = renderToStaticMarkup(<CardView card={card} isInspector presentationOnly previewArtworkUrl={override}/>);
  assert.match(catalog, /characters\/tablet-previews\/inanna\.webp/);
  for (const props of [
    { isBoard: true, isInspector: true },
    { isInspector: true, battleArtwork: true },
    { isInspector: false },
  ]) {
    const html = renderToStaticMarkup(<CardView card={card} {...props} presentationOnly previewArtworkUrl={override}/>);
    assert.doesNotMatch(html, /characters\/tablet-previews/);
  }
  const matchCard = createCardInstance('inanna', 'player', 'preview-test', 0);
  const html = renderToStaticMarkup(<CardView card={matchCard} isInspector presentationOnly previewArtworkUrl={override}/>);
  assert.doesNotMatch(html, /characters\/tablet-previews/);
});
