import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { cards } from '../data';
import { DrFadeWelcome } from './DrFadeWelcome';

test('welcome card and promised Motion/Hands/SQUABBLE all use the live card definition', () => {
  const html = renderToStaticMarkup(<DrFadeWelcome onContinue={() => {}} />);
  assert.ok(html.includes(`data-card-cost="${cards.drfade.cost}"`));
  assert.ok(html.includes(`data-card-power="${cards.drfade.power}"`));
  assert.ok(html.includes(`<b>${cards.drfade.cost} Motion</b>`));
  assert.ok(html.includes(`<b>${cards.drfade.power} Hands</b>`));
  assert.ok(html.includes(`<b>${cards.drfade.power * 2} base Hands</b>`));
});

test('a changed printed definition cannot leave the welcome promise at an old balance value', () => {
  const original = { cost: cards.drfade.cost, power: cards.drfade.power };
  try {
    Object.assign(cards.drfade, { cost: 7, power: 9 });
    const html = renderToStaticMarkup(<DrFadeWelcome onContinue={() => {}} />);
    assert.ok(html.includes('data-card-cost="7"'));
    assert.ok(html.includes('data-card-power="9"'));
    assert.ok(html.includes('<b>7 Motion</b>'));
    assert.ok(html.includes('<b>9 Hands</b>'));
    assert.ok(html.includes('<b>18 base Hands</b>'));
  } finally { Object.assign(cards.drfade, original); }
});
