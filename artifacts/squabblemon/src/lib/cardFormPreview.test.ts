import assert from 'node:assert/strict';
import test from 'node:test';
import { cards } from '../data';
import { getEffectiveCardPower } from '../gameEngine';
import { getCardFormPreview, previewCardForm, previewBuddyForm, tabletPreviewAsset } from './cardFormPreview';
import { anunakiCards } from '@workspace/squabblemon-engine/anunakiWave';
import sharp from 'sharp';

test('Buddy form preview switches element and art key without changing source or inventing battle buffs', () => {
  const source = JSON.stringify(cards.buddy);
  const preview = previewBuddyForm(cards.buddy, true);
  assert.ok('instanceId' in preview);
  assert.equal(preview.type, 'Earth');
  assert.equal(preview.buddyForm, 'squabble-earth');
  assert.equal(preview.power, cards.buddy.power * 2);
  assert.equal(getEffectiveCardPower(preview), cards.buddy.power * 2);
  assert.equal(preview.cost, cards.buddy.cost);
  assert.equal(preview.buddyEarthExpiresAtRound, undefined);
  assert.match(preview.effect, /For two rounds/);
  assert.equal(JSON.stringify(cards.buddy), source);
  assert.equal(previewBuddyForm(cards.buddy, false), cards.buddy);
  assert.equal(cards.buddy.type, 'Plant');
});
test('unrelated cards never receive a Buddy transformation', () => {
  assert.equal(previewBuddyForm(cards.folks, true), cards.folks);
});


test('Powered Luigion retains catalog identity and uses doubled base Hands before conditional reveal bonuses', () => {
  const original = JSON.stringify(cards.luigion);
  const preview = previewCardForm(cards.luigion, true);
  assert.ok('instanceId' in preview);
  assert.equal(preview.id, 'luigion-powered');
  assert.equal(preview.cardId, 'luigion');
  assert.equal(preview.name, 'Powered Luigion');
  assert.equal(preview.power, cards.luigion.power * 2);
  assert.equal(getEffectiveCardPower(preview), cards.luigion.power * 2);
  assert.equal(preview.cost, cards.luigion.cost);
  assert.match(preview.effect, /weakest other open district/);
  assert.equal(JSON.stringify(cards.luigion), original);
  assert.equal(previewCardForm(cards.luigion, false), cards.luigion);
});

test('Mary and Leroy show their real transformation triggers rather than claiming they require Squabble', () => {
  const mary = previewCardForm(cards['ms-mary-mack'], true);
  assert.ok('instanceId' in mary);
  assert.equal(mary.cardId, 'ms-mary-mack');
  assert.equal(mary.maryElephant, true);
  assert.equal(mary.maryCents, 15);
  assert.equal(mary.cost, 4);
  assert.equal(getEffectiveCardPower(mary), 4);
  assert.match(getCardFormPreview(cards['ms-mary-mack'])!.alternateLabel, /15¢/);
  const leroy = previewCardForm(cards.leroy, true);
  assert.ok('instanceId' in leroy);
  assert.equal(leroy.goldenGlow, true);
  assert.equal(leroy.statuses.protected, true);
  assert.equal(getEffectiveCardPower(leroy), cards.leroy.power + 3);
  assert.match(getCardFormPreview(cards.leroy)!.alternateHint, /three friendly elements/);
  assert.equal(previewCardForm(cards['ms-mary-mack'], false), cards['ms-mary-mack']);
  assert.equal(previewCardForm(cards.leroy, false), cards.leroy);
});

test('unsupported cards have no form controls or transformed state', () => {
  for (const card of [cards.folks, cards['the-concert'], cards.demario]) {
    assert.equal(getCardFormPreview(card), undefined);
    assert.equal(previewCardForm(card, true), card);
  }
});

test('approved tablet artworks are transparent, preview-only, and preserve every gameplay field', async () => {
  for (const id of ['anu', 'caucus-mountaineer', 'enlil', 'ereshkigal', 'inanna', 'utu']) {
    const card = anunakiCards[id];
    const before = JSON.stringify(card);
    const path = tabletPreviewAsset(card, true)!;
    assert.equal(path, `assets/characters/tablet-previews/${id}.webp`);
    assert.equal(tabletPreviewAsset(card, false), undefined);
    assert.equal(previewCardForm(card, true), card);
    assert.equal(JSON.stringify(card), before);
    assert.match(getCardFormPreview(card)!.alternateHint, /artwork preview only/);
    const metadata = await sharp(`public/${path}`).metadata();
    assert.equal(metadata.hasAlpha, true);
    assert.ok(metadata.width! <= 768 && metadata.height! <= 1344);
  }
  assert.equal(tabletPreviewAsset(anunakiCards.yakub, true), undefined);
});
