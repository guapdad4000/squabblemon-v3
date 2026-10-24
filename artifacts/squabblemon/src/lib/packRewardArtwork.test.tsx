import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PackReward } from '@workspace/api-client-react';
import { cardCatalog, catalogCardById } from '../data';
import { collectibleElementArtwork, collectiblePrintArtworkSources } from './collectiblePrintAssets';
import { RewardCard } from '../components/GachaRevealSequence';
import { packRewardArtworkSources, warmPackRewardArtwork } from './packRewardArtwork';

function reward(cardId: string, extra: Partial<PackReward> = {}): PackReward {
  const card = catalogCardById[cardId];
  return { kind: 'card', cardId, name: card?.name ?? cardId, rarity: card?.rarity ?? null, variantId: null, amount: 1, isNew: false, ...extra };
}
const receipt = [reward('cornball'), reward('cologne-criminal', { kind: 'variant', variantId: 'cologne-criminal:crazy' }), reward('dr-fade'), reward('cornball', { kind: 'styleShards', amount: 35, shardRarity: 'Common' })];

test('receipt warmup uses real portraits and authored layers plus only the first two print textures', () => {
  const printed = receipt.flatMap(item => {
    const html = renderToStaticMarkup(<RewardCard reward={item} large />);
    return [...html.matchAll(/<img\b[^>]*>/g)].map(match => match[0])
      .filter(tag => /class="[^"]*(?:collector-portrait|dr-fade-art__)/.test(tag))
      .map(tag => /src="([^"]+)"/.exec(tag)![1].replaceAll('&amp;', '&'));
  });
  const resources: PackReward[] = [{ kind: 'softCurrency', cardId: null, name: 'Clout', rarity: null, variantId: null, amount: 125, isNew: false }, reward('missing-card')];
  const sources = packRewardArtworkSources([...receipt, ...resources]);
  const firstPrints = receipt.slice(0, 2).flatMap(item => collectiblePrintArtworkSources(catalogCardById[item.cardId!]));
  assert.deepEqual([...sources].sort(), [...new Set([...printed, ...firstPrints])].sort());
  assert.equal(new Set(printed).size, 5, 'normal and variant portraits plus three authored layers; duplicate shared');
  assert.equal(sources[0], printed[0], 'the first portrait precedes speculative later portraits');
  assert.ok(sources.some(src => src.includes('cologne-criminal-crazy.webp')));
  assert.ok(sources.every(src => !/\.(?:mp4|webm|gif)(?:\?|$)/.test(src)));
});

test('restored oversized receipt cannot speculate beyond the largest supported opening', () => {
  const sources = packRewardArtworkSources([...Array.from({ length: 60 }, () => reward('cornball')), reward('buddy')]);
  assert.deepEqual(sources, packRewardArtworkSources([reward('cornball')]));
  assert.deepEqual(packRewardArtworkSources([]), []);
});

test('first-print preparation bounds element requests and matches rendered plate, fist and wordmark', () => {
  const byElement = new Map(cardCatalog.filter(card => card.kind !== 'blockbuster').map(card => [card.type, card]));
  const chosen = [...byElement.values()].slice(0, 3);
  assert.equal(chosen.length, 3);
  const sources = packRewardArtworkSources(chosen.map(card => reward(card.catalogId)));
  for (const card of chosen.slice(0, 2)) {
    const html = renderToStaticMarkup(<RewardCard reward={reward(card.catalogId)} large />);
    const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map(match => /src="([^"]+)"/.exec(match[0])![1].replaceAll('&amp;', '&'));
    for (const source of collectiblePrintArtworkSources(card).filter(source => /(?:-plate|-fist|card-wordmark-white)\.webp$/.test(source))) {
      assert.ok(imgs.includes(source), `${card.name}: warmup uses the rendered image URL`);
      assert.ok(sources.includes(source));
    }
  }
  const third = collectibleElementArtwork(chosen[2]);
  assert.ok(!sources.includes(third.plate) && !sources.includes(third.fist), 'later element textures wait for their actual view');
  assert.equal(sources.length, new Set(sources).size, 'shared print assets are requested once');
});

test('print assets respect Earth alias, blockbuster omission, neutral stock and the existing CSS URLs', () => {
  const ordinary = cardCatalog.find(card => card.kind !== 'blockbuster')!;
  assert.deepEqual(collectibleElementArtwork({ type: 'Rock' }), collectibleElementArtwork({ type: 'Earth' }));
  const neutral = collectiblePrintArtworkSources({ ...ordinary, rarity: 'Common' });
  assert.ok(!neutral.some(source => source.endsWith('prism-flakes.webp')), 'neutral printed rim has no visible flake texture');
  const premium = collectiblePrintArtworkSources({ ...ordinary, rarity: 'Rare' });
  assert.ok(premium.some(source => source.endsWith('prism-flakes.webp')));
  assert.ok(!collectiblePrintArtworkSources({ ...ordinary, rarity: 'Rare' }, false).some(source => source.endsWith('prism-flakes.webp')));
  const blockbuster = cardCatalog.find(card => card.kind === 'blockbuster')!;
  assert.ok(blockbuster);
  const movie = collectiblePrintArtworkSources(blockbuster);
  assert.ok(!movie.some(source => source.endsWith('-plate.webp')), 'blockbusters render no element plate');
  assert.ok(movie.includes(collectibleElementArtwork(blockbuster).fist));
  const foilCss = readFileSync(new URL('../styles/collectible-foil.css', import.meta.url), 'utf8');
  const nameCss = readFileSync(new URL('../styles/collectible-card.css', import.meta.url), 'utf8');
  const cardView = readFileSync(new URL('../components/CardView.tsx', import.meta.url), 'utf8');
  for (const [source, text] of [[premium.find(url => url.endsWith('prism-flakes.webp'))!, foilCss],
    [premium.find(url => url.endsWith('card-name-tag-paper.svg'))!, nameCss],
    [premium.find(url => url.endsWith('card-wordmark-white.webp'))!, cardView]] as const) {
    assert.ok(text.includes(`../assets/${source.split('/assets/')[1]}`), 'static warmup URL matches its existing renderer/CSS import');
  }
});

test('confirmed receipt immediately starts bounded decode work and restored call shares it', async t => {
  const OriginalImage = globalThis.Image;
  class ImageStub {
    static created: ImageStub[] = [];
    src = ''; decoding = ''; fetchPriority = '';
    onload: (() => void) | null = null; onerror: (() => void) | null = null;
    constructor() { ImageStub.created.push(this); }
    decode() { return Promise.resolve(); }
    removeAttribute() {}
  }
  globalThis.Image = ImageStub as unknown as typeof Image;
  t.after(() => { for (const image of ImageStub.created) image.onerror?.(); globalThis.Image = OriginalImage; });
  const result = warmPackRewardArtwork(receipt);
  const restored = warmPackRewardArtwork(receipt);
  assert.equal(ImageStub.created.length, 3, 'first requests start before the next view, bounded at three');
  assert.ok(ImageStub.created.every(image => image.decoding === 'async' && image.fetchPriority === 'low'));
  let finished = 0;
  while (finished < ImageStub.created.length) {
    ImageStub.created[finished++].onload!();
    await Promise.resolve(); await Promise.resolve();
  }
  assert.deepEqual(await result, packRewardArtworkSources(receipt).map(() => true));
  assert.deepEqual(await restored, await result);
  assert.deepEqual(ImageStub.created.map(image => image.src), packRewardArtworkSources(receipt));
});
