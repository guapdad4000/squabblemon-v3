import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CardView } from './CardView';
import { BattleVictory } from './BattleVictory';
import { SummonDetails } from './SummonDetails';
import { asCard } from './MultiplayerBattle';
import { getCardImage } from '../data';
import { createArtworkReviewMatch, artworkReviewMarks } from '../../e2e/art-recovery/state';

test('real summoned Buds and Royal Guards keep dedicated art on board, inspection, and winning gang', () => {
  const match = createArtworkReviewMatch();
  for (const [id, artwork] of [['buddy-bud', 'buddy-bud'], ['cardguard', 'card-guard']] as const) {
    const card = match.boards.flat().find(card => card.cardId === id);
    assert.ok(card, `${id} must actually be summoned`);
    // Preserve the old guard snapshot to catch summoner-portrait regressions.
    if (id === 'cardguard') assert.equal(card.id, 'queen-of-hearts');
    for (const isInspector of [false, true]) {
      const html = renderToStaticMarkup(<CardView card={card} isBoard={!isInspector} isInspector={isInspector} presentationOnly />);
      assert.ok(html.includes(getCardImage(artwork)), `${id}, inspector=${isInspector}`);
    }
    const reconnected = asCard({ ...JSON.parse(JSON.stringify(card)), artworkId: card.id });
    assert.ok(renderToStaticMarkup(<CardView card={reconnected} presentationOnly />).includes(getCardImage(artwork)));
    const victory = renderToStaticMarkup(<BattleVictory match={{ ...match, boards: [[card], [], []] }} winner="player" />);
    assert.ok(victory.includes(getCardImage(artwork)));
  }
  for (const id of ['buddy', 'queenofhearts']) {
    const parent = match.boards.flat().find(card => card.cardId === id)!;
    assert.ok(renderToStaticMarkup(<CardView card={parent} presentationOnly />).includes(getCardImage(parent.id)));
  }
});

test('Abuela and Kingpin expose the surviving dedicated item art with actual owner and lane', () => {
  const marks = artworkReviewMarks(createArtworkReviewMatch());
  assert.ok(marks.some(mark => mark.artworkId === 'packed-lunch' && mark.owner === 'player' && mark.lane === 0));
  assert.ok(marks.some(mark => mark.artworkId === 'contraband' && mark.owner === 'cpu' && mark.lane === 0));
});

test('summon inspector identifies its creator and battle state without collectible controls', () => {
  const match=createArtworkReviewMatch();
  const guard=match.boards.flat().find(c=>c.cardId==='cardguard')!;
  const markup=renderToStaticMarkup(<SummonDetails card={guard} match={match}/>);
  assert.match(markup,/Created by Queen of Hearts/);
  assert.match(markup,/Lane Hands/);
  assert.match(markup,/Until removed/);
  assert.doesNotMatch(markup,/Mythical|Legendary|Finish|Craft|Equip|Upgrade|foil/i);
  const bud=match.boards.flat().find(c=>c.buddyBud)!;
  const budMarkup=renderToStaticMarkup(<SummonDetails card={bud} match={match}/>);
  assert.match(budMarkup,/Sprouts in 2 rounds/);
  assert.match(budMarkup,/Adds no lane Hands/);
});
