import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { cardCatalog, catalogCardById, getCardImage, decks } from './data';
import { styleSetFor, hasCharacterStickers } from '@workspace/squabblemon-engine/cosmetics';
import { STREET_LEGENDS_STYLE_SCENES } from '../../../lib/squabblemon-engine/src/streetLegendsStyles';
import revisions from './characterRevisions.json';

const waveIds = Object.keys(STREET_LEGENDS_STYLE_SCENES);
test('the thirty-entry release adds thirty unique identities while Nail Tech retains her original ownership, artwork and cosmetics', () => {
  assert.equal(waveIds.length, 30);
  assert.equal(new Set(waveIds).size, 30);
  assert.equal(cardCatalog.length, 267);
  assert.equal(cardCatalog.filter(card => (card.kind ?? 'character') === 'character').length, 245);
  assert.equal(cardCatalog.filter(card => card.kind === 'support').length, 12);
  assert.equal(cardCatalog.filter(card => card.kind === 'blockbuster').length, 10);
  assert.equal(catalogCardById['nail-tech'].engineId, 'nail');
  assert.equal(cardCatalog.filter(card => card.engineId === 'nail').length, 1);
  assert.equal(catalogCardById['nail-tech'].ability, 'Fresh Set');
  assert.equal(catalogCardById['lash-tech'].engineId, 'lash-tech');
  assert.equal(catalogCardById['lash-tech'].ability, 'Lash Out');
  assert.equal(catalogCardById['lash-tech'].faction, 'Beauty');
  assert(!waveIds.includes('nail-tech'));
  assert(waveIds.includes('lash-tech'));
  assert.notEqual(getCardImage('nail-tech'), getCardImage('lash-tech'));
  assert(styleSetFor('nail-tech')!.stickers.some(sticker => sticker.id === 'nail-tech:street-legends-portrait'));
  assert.equal((revisions as Record<string, string>)['nail-tech'], 'b1a18cf2a135f801');
  for (const id of waveIds) {
    const card = catalogCardById[id];
    assert(card, id);
    assert.equal(card.kind ?? 'character', 'character');
    assert.equal(card.artworkId, id);
    assert.equal(card.abilityUpgrades.length, 3);
    const style = styleSetFor(id);
    assert(style && hasCharacterStickers(style), id + ' has a real signature style');
    assert.equal(style.deckCover, `assets/characters/${id}.webp`);
    assert(style.stickers.some(sticker => sticker.id === `${id}:street-legends-portrait`));
  }
  assert.equal(new Set(cardCatalog.map(card => card.catalogId)).size, cardCatalog.length);
  assert.equal(new Set(cardCatalog.map(card => card.name.toLocaleLowerCase())).size, cardCatalog.length);
});

test('all thirty fighter portraits are distinct finished cutouts with valid shared cache revisions', async () => {
  const hashes = new Set<string>();
  for (const id of waveIds) {
    const bytes = await readFile(new URL(`../public/assets/characters/${id}.webp`, import.meta.url));
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.format, 'webp', id);
    assert(metadata.hasAlpha, id + ' must have a transparent backdrop');
    assert(metadata.width! >= 512 && metadata.height! >= 512, id + ' needs finished-resolution art');
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let empty = 0, visible = 0;
    for (let pixel = 0; pixel < info.width * info.height; pixel++) {
      const alpha = data[pixel * info.channels + info.channels - 1];
      empty += Number(alpha <= 16); visible += Number(alpha >= 128);
    }
    assert(empty / (info.width * info.height) >= 0.2, id + ' must not keep a background box');
    assert(visible / (info.width * info.height) >= 0.1, id + ' must contain visible fighter art');
    const hash = createHash('sha256').update(bytes).digest('hex');
    assert(!hashes.has(hash), id + ' may not reuse another character portrait'); hashes.add(hash);
    assert.equal((revisions as Record<string, string>)[id], hash.slice(0, 16));
    assert.equal(getCardImage(id), `/assets/characters/${id}.webp?v=${hash.slice(0, 16)}`);
  }
});

test('Music and Fitness crews are discoverable recipes with distinct hero artwork', () => {
  const music = decks.find(deck => deck.id === 'music-industry')!;
  const fitness = decks.find(deck => deck.id === 'fitness-circuit')!;
  assert(music && fitness);
  assert.equal(music.name, 'WHO GOT THE AUX');
  for (const deck of [music, fitness]) {
    assert.equal(deck.cards.length, 10);
    assert.equal(new Set(deck.cards).size, 10);
    assert(catalogCardById[deck.hero]);
    assert(styleSetFor(deck.hero));
  }
  assert.notEqual(music.hero, fitness.hero);
});

test('every new offered pack contains three different finished assets, including readable vector signatures and emblems', async () => {
  for (const id of waveIds) {
    const set = styleSetFor(id)!;
    assert(set.stickers.length >= 3, id + ' must offer a complete pack');
    const hashes = new Set<string>();
    for (const suffix of ['portrait', 'signature', 'emblem']) {
      const sticker = set.stickers.find(s => s.id === `${id}:street-legends-${suffix}`)!;
      assert(sticker?.image, id + ':' + suffix);
      const bytes = await readFile(new URL('../public/' + sticker.image, import.meta.url));
      const hash = createHash('sha256').update(bytes).digest('hex');
      assert(!hashes.has(hash), id + ' must not repeat its portrait three times');
      hashes.add(hash);
      const stats = await sharp(bytes).ensureAlpha().stats();
      assert.equal(stats.channels[3].min, 0, id + ':' + suffix + ' remains transparent');
      assert(stats.channels[3].max >= 250, id + ':' + suffix + ' contains visible artwork');
      if (suffix !== 'portrait') assert.match(bytes.toString(), /<title>.+<\/title>/, 'vector artwork retains an accessible name');
    }
  }
});
