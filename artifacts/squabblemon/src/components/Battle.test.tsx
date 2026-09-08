import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { decks, districts } from '../data';
import { createMatch, playCard, type EffectLogEntry, type Match } from '../gameEngine';
import { Battle } from './Battle';
import { ResultScreen } from './ResultScreen';

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

function renderDecision(match: Match, selectedInstanceId: string | null, selectedLane: number | null, equippedVariants?: Record<string, string>) {
  return renderToStaticMarkup(
    <Battle
      match={match}
      deck={decks.find(deck => deck.id === match.playerDeck)}
      rivalDeck={decks.find(deck => deck.id === match.cpuDeck)}
      selectedInstanceId={selectedInstanceId}
      setSelectedInstanceId={noop}
      selectedLane={selectedLane}
      setSelectedLane={noop}
      commit={noop}
      skipSequence={noop}
      presentationPhase="player-ready"
      phaseMessage="Your move"
      timerSeconds={20}
      timerEnabled
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
      equippedVariants={equippedVariants}
    />,
  );
}
function renderEffect(match: Match, effect: EffectLogEntry) {
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
      presentationPhase="effects"
      phaseMessage={effect.note}
      timerSeconds={20}
      timerEnabled={false}
      impactLane={effect.lane}
      stagedRival={null}
      stagedPlayer={null}
      activeEffectId={effect.source?.cardInstanceId ?? effect.cardInstanceId}
      activeEffectLane={effect.lane}
      activeEffect={{ ...effect, targetIds: effect.targets.map(target => target.cardInstanceId) }}
      presentationScores={effect.scores.after}
      squabble={false}
      setSquabble={noop}
      setInspect={noop}
      archiveMatch={noop}
      onShowRules={noop}
    />,
  );
}

function renderOverlay(match: Match, phase: any) {
  const card = match.playerHand[0];
  return renderBattle(match, phase, card);
}

const occurrences = (html: string, instanceId: string) =>
  html.match(new RegExp(`data-instance-id="${instanceId}"`, 'g'))?.length ?? 0;

test('a player card has one visual instance through travel and reveal', () => {
  let match = createMatch('block', 'combo');
  const card = match.playerHand.find(item => item.cost <= match.playerHype)!;

  const travel = renderBattle(match, 'player-travel', card);
  assert.equal(occurrences(travel, card.instanceId), 1);
  assert.match(travel, /data-presentation-copy="staged"/);

  match = playCard(match, 'player', card.instanceId, 0);
  const reveal = renderBattle(match, 'player-reveal', card);
  assert.equal(occurrences(reveal, card.instanceId), 1);
  assert.doesNotMatch(reveal, /data-presentation-copy="staged"/);
});

test('the player decision flow exposes legal targets, costs, and a committed-play summary', () => {
  const match = { ...createMatch('block', 'combo'), round: 2 };
  const affordable = match.playerHand.find(card => card.cost <= match.playerHype)!;

  const chooseDistrict = renderDecision(match, affordable.instanceId, null);
  assert.match(chooseDistrict, /2\. Choose a lit district/);
  assert.equal(chooseDistrict.match(/is-legal/g)?.length, 3);
  assert.match(chooseDistrict, /Play · 1 Hype/);

  const ready = renderDecision(match, affordable.instanceId, 0);
  assert.match(ready, /3\. Review/);
  assert.match(ready, new RegExp(`Lock In · ${affordable.name} → THE TOWN · 1 Hype`));
  assert.match(ready, /Ready · 1 Hype/);
});

test('unaffordable cards and districts explain why they cannot be played', () => {
  const match = { ...createMatch('block', 'combo'), round: 2 };
  const expensive = match.playerHand.find(card => card.cost > match.playerHype)!;
  const html = renderDecision(match, expensive.instanceId, null);

  assert.match(html, /is-illegal/);
  assert.match(html, new RegExp(`Need ${expensive.cost} Hype`));
  assert.match(html, /Cannot play now\. Need more Hype or an unlocked district\./);
  assert.match(html, /cannot be played now: it needs more Hype or every district is locked/);
  assert.match(html, /aria-disabled="true"/);
  assert.doesNotMatch(html, /data-testid="lane-0"[^>]* disabled/);
  assert.doesNotMatch(html, new RegExp(`data-instance-id="${expensive.instanceId}"[^>]*aria-disabled`));
});

test('resolution text connects the acting card, affected district, and score change', () => {
  const initial = createMatch('block', 'combo');
  const card = initial.playerHand.find(item => item.cost <= initial.playerHype)!;
  const resolved = playCard(initial, 'player', card.instanceId, 0);
  const effect = resolved.effectLog[0];
  const html = renderEffect(resolved, effect);

  assert.match(html, /data-testid="effect-causality"/);
  assert.match(html, new RegExp(card.name));
  assert.match(html, /affected district 1/);
  assert.match(html, /Score: Rival 0 \/ You 0 → Rival 0 \/ You 1/);
  assert.match(html, /data-testid="button-fast-forward"/);
  assert.match(html, /data-testid="button-battle-history"/);
  assert.match(html, /data-testid="button-status-key"/);
});

test('broadcast artwork is assigned to first round, lock, reveal, and district flip beats', () => {
  const match = createMatch('block', 'combo');
  assert.match(renderOverlay(match, 'round-intro'), /broadcast-round-01/);
  assert.match(renderOverlay(match, 'lock-in'), /broadcast-lock-in/);
  assert.match(renderOverlay(match, 'player-reveal'), /broadcast-reveal/);
  assert.match(renderOverlay(match, 'rival-reveal'), /broadcast-reveal/);
  assert.match(renderOverlay(match, 'district-flipped'), /broadcast-district-flipped/);
});

test('later round intros retain the dynamic round indicator', () => {
  const match = { ...createMatch('block', 'combo'), round: 2 };
  const html = renderOverlay(match, 'round-intro');
  assert.doesNotMatch(html, /broadcast-round-01/);
  assert.match(html, /Card presentation/);
});

test('saved-deck gameplay carries equipped treatments into cards, hero art, and results', () => {
  const match = createMatch('block', 'combo');
  const equippedVariants = {
    rastamon: 'rastamon:chrome',
    'officer-oink': 'officer-oink:chrome',
  };
  const battle = renderDecision(match, null, null, equippedVariants);

  assert.match(battle, /data-card-variant="chrome"/);
  assert.match(battle, /variant-portrait-chrome/);

  const results = renderToStaticMarkup(
    <ResultScreen
      match={match}
      districts={districts}
      equippedVariants={equippedVariants}
      onRestart={noop}
      onChangeDeck={noop}
      onGoHome={noop}
      onRetryReward={noop}
      isGuest
    />,
  );
  assert.match(results, /variant-portrait-chrome/);
});
