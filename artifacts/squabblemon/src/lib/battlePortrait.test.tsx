import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CardView } from '../components/CardView';
import { cards, getCardImage } from '../data';
import { getAssetUrl } from './assets';
import { battlePortraitUrl } from './battlePortrait';
import portraits from './battlePortraits.json';
import { getMoveClipUrl, moveClips } from '../specialMoves';
import battleMoves from './battleMoves.json';

test('battle portraits preserve original URLs unless a current local derivative exists', () => {
  for (const [source, entry] of Object.entries(portraits)) {
    const original=getAssetUrl(source);
    assert.equal(battlePortraitUrl(original),getAssetUrl(entry.asset));
    assert.equal(battlePortraitUrl(original+'?unexpected=1'),original+'?unexpected=1');
  }
  for(const url of ['data:image/svg+xml,test','https://example.com/assets/characters/buddy.webp','/assets/characters/unknown.webp','/assets/characters/buddy.webp?v=future-art'])assert.equal(battlePortraitUrl(url),url);
  for(const [id,variant] of [['dorothy','dorothy:alternate'],['cologne-criminal','cologne-criminal:crazy'],['buddy-squabble',undefined],['buddy-bud',undefined],['ms-mary-mack-elephant',undefined],['cardguard',undefined]]) {
    assert.match(battlePortraitUrl(getCardImage(id!,variant)),/\/assets\/battle-portraits\//);
  }
});

test('battle faces use bounded artwork while collection and inspection retain originals', () => {
  const card=cards['buddy'];
  const original=getCardImage(card.id);
  const thumb=battlePortraitUrl(original);
  const render=(props:Record<string,unknown>)=>renderToStaticMarkup(<CardView card={card} inspectable={false} {...props}/>);
  assert.ok(render({battleArtwork:true}).includes(`src="${thumb}"`));
  assert.ok(render({battleArtwork:true,isInspector:true}).includes(`src="${original.replaceAll('&','&amp;')}"`));
  assert.ok(render({}).includes(`src="${original.replaceAll('&','&amp;')}"`));
});

test('battle move URLs retain original quality for galleries and fall back for future revisions',()=>{
  for(const [file,entry] of Object.entries(battleMoves)) {
    const clip=Object.values(moveClips).find(clip=>clip.file===file)!;
    assert.ok(clip);
    assert.equal(getMoveClipUrl(clip,'battle'),getAssetUrl(entry.asset));
    assert.match(getMoveClipUrl(clip),/assets\/special-moves\//);
    assert.equal(getMoveClipUrl({...clip,revision:'future'},'battle'),getMoveClipUrl({...clip,revision:'future'}));
  }
});
