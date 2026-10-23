import assert from 'node:assert/strict';
import test from 'node:test';
import { cards } from '../data';
import { getEffectiveCardPower } from '../gameEngine';
import { previewBuddyForm } from './cardFormPreview';

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
