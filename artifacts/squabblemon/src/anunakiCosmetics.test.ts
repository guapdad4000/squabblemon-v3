import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AnunakiMotionSprite, anunakiMotionSource } from './components/fadecade/AnunakiMotionSprite';
import { ANUNAKI_EVENT_REACTION_PACKS, REACTION_PACKS, REACTIONS, addReaction, ownedReactions, reactionCollectionSize, resolveReactionTray } from '../../../lib/squabblemon-engine/src/reactions';
import { ANUNAKI_EVENT_GAMEPLAY_READY } from '../../../lib/squabblemon-engine/src/anunakiEvent';
import { cardCatalog } from '../../../lib/squabblemon-engine/src/data';
import { avatarSticker, isAnunakiEventStickerPack, styleSetFor, validateCosmeticLoadout } from '../../../lib/squabblemon-engine/src/cosmetics';
import { planShopPurchase, type ShopWallet } from '../../../lib/squabblemon-engine/src/economy';

const publicFile = (asset: string) => fileURLToPath(new URL(`../public/${asset}`, import.meta.url));

test('drawn Anunaki animation sources retain four distinct cels per action and transparent runtime media', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../../docs/events/anunaki-drawn-animation-sources.json', import.meta.url), 'utf8'));
  assert.equal(manifest.sources.length, 6);
  assert.equal(manifest.assets.length, 22);
  for (const source of manifest.sources) {
    const bytes = await readFile(new URL(`../../../${source.path}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), source.sha256);
    const metadata = await sharp(bytes).metadata();
    assert(metadata.hasAlpha, source.path);
  }
  for (const asset of manifest.assets) {
    assert.equal(asset.distinctDrawnCels, 4);
    assert.equal(new Set(asset.celPixelSha256).size, 4);
    assert.equal(asset.sequence.length, asset.durationsMs.length);
    for (const file of asset.files) {
      const bytes = await readFile(publicFile(file.path));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
      const metadata = await sharp(bytes, { animated: true }).metadata();
      assert(metadata.hasAlpha, file.path);
      assert.equal(metadata.width, asset.size[0]);
      assert.equal(metadata.pageHeight ?? metadata.height, asset.size[1]);
      if (file.path.endsWith('-animated.webp') || (file.path.includes('/boss-raid/') && !file.path.includes('-still.webp'))) {
        assert.equal(metadata.pages, asset.sequence.length, file.path);
      }
    }
  }
});

test('Anunaki boss animation begins on its poster and every action obeys playback gating', () => {
  for (const phase of ['idle', 'windup', 'strike', 'recoil'] as const) {
    assert.equal(anunakiMotionSource('anunaki:boss-anu', phase, false), `assets/boss-raid/anunaki-motion-v1/boss-anu-${phase === 'idle' ? 'still' : `${phase}-still`}.webp`);
    assert.equal(anunakiMotionSource('anunaki:boss-anu', phase, true), `assets/boss-raid/anunaki-motion-v1/boss-anu-${phase}.webp`);
    const markup = renderToStaticMarkup(createElement(AnunakiMotionSprite, { asset: 'anunaki:boss-anu', name: 'Anu', phase }));
    assert(markup.includes(anunakiMotionSource('anunaki:boss-anu', phase, false)));
    assert(!markup.includes(`boss-anu-${phase}.webp`));
  }
  assert.equal(anunakiMotionSource('anunaki:yakub', 'strike', true), 'assets/boss-raid/anunaki-motion-v1/yakub-idle.webp');
});

test('event sticker claims authorize exactly the matching animated reactions and tray', async () => {
  for (const pack of ANUNAKI_EVENT_REACTION_PACKS) {
    const expected = REACTIONS.filter(r => r.packId === pack.id);
    assert.equal(expected.length, 4);
    assert.deepEqual(expected.map(r => r.id), [...pack.reactionIds]);
    assert(!REACTION_PACKS.some(p => String(p.id) === pack.id), 'event reward is never sold as a shop pack');
    const owned = ownedReactions([pack.unlock]);
    for (const reaction of expected) {
      assert(owned.includes(reaction.id));
      assert(!ownedReactions().includes(reaction.id));
      assert.deepEqual(resolveReactionTray([reaction.id], [pack.unlock]), [reaction.id]);
      assert.deepEqual(resolveReactionTray([reaction.id], []), []);
      assert.throws(() => addReaction(undefined, { id: 'one', reactionId: reaction.id, seat: 'player', gameNumber: 1 }, [], 10000));
      assert.equal(addReaction(undefined, { id: 'one', reactionId: reaction.id, seat: 'player', gameNumber: 1 }, owned, 10000).latest.player?.reactionId, reaction.id);
      for (const asset of [reaction.gif, reaction.animatedWebp, reaction.poster]) await access(publicFile(asset));
      const meta = await sharp(publicFile(reaction.animatedWebp), { animated: true }).metadata();
      assert((meta.pages ?? 0) > 1, `${reaction.id} should animate`);
    }
    const other = ANUNAKI_EVENT_REACTION_PACKS.find(p => p.id !== pack.id)!;
    assert(REACTIONS.filter(r => r.packId === other.id).every(r => !owned.includes(r.id)));
  }
});

test('collection totals follow the event gate and retain owned rewards after rollback', () => {
  assert.equal(reactionCollectionSize([]), REACTIONS.length - (ANUNAKI_EVENT_GAMEPLAY_READY ? 0 : 9));
  assert.equal(reactionCollectionSize(['style:yakub:stickers']), REACTIONS.length - (ANUNAKI_EVENT_GAMEPLAY_READY ? 0 : 5));
});

test('event deck covers ship optimized at the existing deck-box proportions', async () => {
  for (const fighter of ['yakub', 'anu']) {
    const metadata = await sharp(publicFile(`assets/cosmetics/anunaki/${fighter}-deck-cover.webp`)).metadata();
    assert.equal(metadata.format, 'webp');
    assert.equal(metadata.width, 768);
    assert.equal(metadata.height, 1152);
  }
});

test('every released Anunaki has a full signature, with owned-only sticker acquisition', async () => {
  const characters = cardCatalog.filter(card => card.faction === 'Anunaki');
  const wallet: ShopWallet = { softCurrency: 1000, packTickets: 0, styleShards: 1000, deckSlots: 4,
    ownedCardIds: [], discoveredCardIds: [], ownedVariants: [], unlockedCosmeticIds: [], cardProgression: {}, collectionProgress: 0 };
  for (const card of characters) {
    const set = styleSetFor(card.catalogId)!;
    assert(set, card.name);
    for (const [file, width, height] of [[set.banner!, 1200, 400], [set.deckCover!, 768, 1152]] as const) {
      const meta = await sharp(publicFile(file)).metadata();
      assert.equal(meta.format, 'webp'); assert.equal(meta.width, width); assert.equal(meta.height, height);
    }
    assert.equal(set.stickers.length, 3);
    assert.equal(new Set(set.stickers.map(sticker => sticker.image)).size, 3);
    const imageHashes = new Set<string>();
    for (const sticker of set.stickers) {
      const image = await sharp(publicFile(sticker.image)).metadata();
      assert.equal(image.width, 512); assert.equal(image.height, 512); assert(image.hasAlpha);
      const bytes = await readFile(publicFile(sticker.image));
      imageHashes.add(createHash('sha256').update(bytes).digest('hex'));
    }
    assert.equal(imageHashes.size, 3, 'each design has distinct artwork');
    const sticker = set.stickers[0];
    assert.equal(avatarSticker(`sticker:${sticker.id}`), undefined, 'event art is not a free avatar bypass');
    assert.throws(() => planShopPurchase(wallet, { itemId: 'character-stickers', cardId: card.catalogId }), /Unlock this character first/);
    const owner = { ...wallet, ownedCardIds: [card.catalogId] };
    assert.match(validateCosmeticLoadout(owner, { bannerCardId: card.catalogId, stickers: [sticker.id] })!, /Unlock this sticker pack/);
    if (isAnunakiEventStickerPack(card.catalogId)) {
      assert.throws(() => planShopPurchase(owner, { itemId: 'character-stickers', cardId: card.catalogId }), /event roadmap/);
    } else {
      const result = planShopPurchase(owner, { itemId: 'character-stickers', cardId: card.catalogId });
      assert.equal(result.receipt.currency, 'styleShards');
      assert.equal(result.receipt.cost, 100);
      assert.equal(validateCosmeticLoadout(result.wallet, { bannerCardId: card.catalogId, stickers: [sticker.id] }), null);
    }
  }
});
