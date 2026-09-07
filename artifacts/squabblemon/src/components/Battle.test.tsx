import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { decks } from '../data';
import { createMatch, playCard, type Match } from '../gameEngine';
import { Battle } from './Battle';

const noop = () => {};

function renderBattle(match: Match, phase: 'player-travel' | 'player-reveal', stagedPlayer: Match['playerHand'][number]) {
  return renderToStaticMarkup(
    <Battle
      match={match}
      deck={decks.find(deck => deck.id === match.playerDeck)}
      rivalDeck={decks.find(deck => deck.id === match.cpuDeck)}
      selectedInstanceId={null}
      setSelectedInstanceId={noop}
      selectedLane={null}
      setSelectedLane={noop}
      commit={noop}
      skipSequence={noop}
      presentationPhase={phase}
      phaseMessage="Card presentation"
      timerSeconds={20}
      timerEnabled={false}
      impactLane={0}
      stagedRival={null}
      stagedPlayer={stagedPlayer}
      activeEffectId={null}
      activeEffectLane={null}
      activeEffect={null}
      presentationScores={null}
      squabble={false}
      setSquabble={noop}
      setInspect={noop}
      archiveMatch={noop}
      onShowRules={noop}
    />,
  );
}

const occurrences = (html: string, instanceId: string) =>
  html.match(new RegExp(`data-instance-id="${instanceId}"`, 'g'))?.length ?? 0;

test('a player card has one visual instance through travel and reveal', () => {
  let match = createMatch('block', 'combo');
  const card = match.playerHand[0];

  const travel = renderBattle(match, 'player-travel', card);
  assert.equal(occurrences(travel, card.instanceId), 1);
  assert.match(travel, /data-presentation-copy="staged"/);

  match = playCard(match, 'player', card.instanceId, 0);
  const reveal = renderBattle(match, 'player-reveal', card);
  assert.equal(occurrences(reveal, card.instanceId), 1);
  assert.doesNotMatch(reveal, /data-presentation-copy="staged"/);
});
