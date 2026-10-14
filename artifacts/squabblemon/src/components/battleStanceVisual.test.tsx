import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { decks } from '../data';
import { createCardInstance, createMatch } from '../gameEngine';
import { Battle } from './Battle';

const noop = () => {};
const battleBoardCss = readFileSync(new URL('./battle-board.css', import.meta.url), 'utf8');

test('rival board cards receive is-leading when cpu score leads the lane and is-trailing when player score leads', () => {
  const match = createMatch('block', 'combo');
  const playerCard = createCardInstance('cornball', 'player', 'stance-test', 0);
  playerCard.basePower = 2;
  const rivalCard = createCardInstance('plug', 'cpu', 'stance-test', 1);
  rivalCard.basePower = 6;
  match.boards[0] = [playerCard, rivalCard];

  const html = renderToStaticMarkup(
    <Battle
      match={match}
      deck={decks[0]}
      rivalDeck={decks[1]}
      selectedInstanceId={null}
      setSelectedInstanceId={noop}
      selectedLane={null}
      setSelectedLane={noop}
      commit={noop}
      skipSequence={noop}
      presentationPhase="player-ready"
      phaseMessage="Your move"
      timerSeconds={20}
      timerEnabled={false}
      impactLane={null}
      stagedRival={null}
      stagedPlayer={null}
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

  const rivalCardTag = html.match(/<button[^>]*data-testid="card-board-rival-0-[^"]+"[^>]*>/)?.[0] ?? '';
  const playerCardTag = html.match(/<button[^>]*data-testid="card-board-player-0-[^"]+"[^>]*>/)?.[0] ?? '';
  assert.match(rivalCardTag, /\bis-leading\b/);
  assert.match(playerCardTag, /\bis-trailing\b/);
  assert.match(battleBoardCss, /\.collector-card--combat\.is-leading/);
});
