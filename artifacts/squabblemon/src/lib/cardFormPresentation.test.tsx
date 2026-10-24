import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createMatch, createCardInstance, playTurnCard } from '../gameEngine';
import { cards, decks, catalogCardByEngineId } from '../data';
import { presentCardForm } from './cardFormPresentation';
import { CardView } from '../components/CardView';
import { CollectibleCard } from '../components/CollectibleCard';
import { CrewPreview } from '../components/fadecade/CrewPreview';
import { RewardCard } from '../pages/game/Shop';

function squabbled(id: string) {
  const initial = createMatch('block', 'combo');
  initial.playerMotion = 30;
  initial.playerHand = [createCardInstance(id, 'player', 'form-test', 0)];
  const next = playTurnCard(initial, 'player', initial.playerHand[0].instanceId, 0, true);
  return next.boards.flat().find(card => card.cardId === id)!;
}
test('actual Squabbled Buddy uses Earth ability copy while preserving every live rule value', () => {
  const buddy = squabbled('buddy');
  const before = JSON.stringify(buddy);
  const display = presentCardForm(buddy);
  assert.equal(display.ability, 'Earth Squabble');
  assert.match(display.effect, /does not plant Buds/);
  const { ability: _ability, effect: _effect, ...unchanged } = buddy;
  const { ability: _displayAbility, effect: _displayEffect, ...displayed } = display;
  assert.deepEqual(displayed, unchanged);
  assert.equal(JSON.stringify(buddy), before, 'presentation never mutates a match or replay snapshot');
  for (const View of [CardView, CollectibleCard]) {
    const html = renderToStaticMarkup(<View card={buddy} isInspector presentationOnly/>);
    assert.match(html, /Earth Squabble/);
    assert.match(html, /does not plant Buds/);
    assert.match(html, /data-buddy-form="squabble"/);
  }
});
test('Powered Luigion snapshots recover printed ability without changing identity or stats', () => {
  const live = squabbled('luigion');
  const legacy = { ...live, name: cards.luigion.name, ability: cards.luigion.ability, effect: cards.luigion.effect };
  const displayed = presentCardForm(legacy);
  assert.equal(displayed.name, 'Powered Luigion');
  assert.equal(displayed.ability, 'Powered Up');
  assert.match(displayed.effect, /Echoes never consume Mushrooms or jump/);
  assert.equal(displayed.instanceId, live.instanceId);
  assert.equal(displayed.powerModifier, live.powerModifier);
  assert.equal(displayed.cardId, 'luigion');
  assert.equal(presentCardForm(live), live, 'already-correct engine forms retain reference identity');
});
test('normal Buddy and unrelated Squabbled fighters keep their printed abilities', () => {
  for (const card of [cards.buddy, createCardInstance('buddy','player','normal',0), squabbled('cornball')]) assert.equal(presentCardForm(card), card);
});
test('gacha new cards, duplicate cards and variant rewards use approved printed layers', () => {
  const card = catalogCardByEngineId.buddy;
  for (const kind of ['card', 'variant', 'styleShards'] as const) {
    const html = renderToStaticMarkup(<RewardCard reward={{ kind, cardId: card.catalogId, amount: 1, rarity: card.rarity, name: card.name, variantId: null, isNew: kind === 'card' }} large/>);
    assert.match(html, /data-layered-card="true"/);
    assert.match(html, /plant-fist.webp/);
    assert.match(html, /layered-rules/);
  }
});
test('training lineup renders each card with the approved print', () => {
  const html = renderToStaticMarkup(<CrewPreview crew={decks[0]}/>);
  assert.equal((html.match(/data-layered-card="true"/g) ?? []).length, decks[0].cards.length);
  assert.equal((html.match(/data-testid="training-lineup-/g) ?? []).length, decks[0].cards.length);
  assert.doesNotMatch(html, /class="challenge-crew-cards" aria-hidden/);
});
