import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { decks, districts } from '../data';
import { createMatch, playCard, type EffectLogEntry, type Match } from '../gameEngine';
import { Battle, createBattleDecisionHandlers, tryLockInteraction } from './Battle';
import { ResultScreen } from './ResultScreen';
import { trackBattleFastForwarded, trackBattleTurnCommitted } from './PlayLoop';
import { trackEvent } from '../lib/analytics';

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

test('battle decision interactions emit only approved coarse analytics fields', () => {
  const originalWindow = globalThis.window;
  const calls: Array<{ name: string, data?: Record<string, string | number | boolean> }> = [];
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { umami: { track: (name: string, data?: Record<string, string | number | boolean>) => calls.push({ name, data }) } },
  });
  const match = createMatch('block', 'combo');
  const unavailable = match.playerHand.find(card => card.cost > match.playerHype)!;
  const available = match.playerHand.find(card => card.cost <= match.playerHype)!;
  const state = { selected: null as string | null, lane: null as number | null, squabble: false };
  const makeHandlers = () => createBattleDecisionHandlers({
    match, interactive: true, selectedInstanceId: state.selected, selectedLane: state.lane,
    squabble: state.squabble, lockedDistricts: 0, decisionStartedAt: Date.now(),
    setSelectedInstanceId: value => { state.selected = value; },
    setSelectedLane: value => { state.lane = value; },
    setSquabble: value => { state.squabble = value; },
  });

  try {
    makeHandlers().selectCard(unavailable, false);
    state.selected = available.instanceId;
    state.lane = 0;
    makeHandlers().selectDistrict(1, true);
    makeHandlers().toggleSquabble(available);
    state.squabble = true;
    makeHandlers().toggleSquabble(available);
    makeHandlers().openHistory(match.effectLog.length);
    trackBattleTurnCommitted(match, 'pass', false, false, Date.now(), null);
    trackBattleTurnCommitted(match, 'lock_in', false, true, Date.now(), 1);
    trackBattleFastForwarded(match, 'effects');
    trackEvent('battle_history_opened', {
      round: match.round,
      entries: 1,
      decision_time: 'under_3s',
      card_instance_id: available.instanceId,
      account_id: 'private-account',
    } as Record<string, string | number | boolean>);

    assert.deepEqual(calls.map(call => call.name), [
      'battle_unavailable_card_selected', 'battle_district_selected',
      'battle_squabble_toggled', 'battle_squabble_toggled',
      'battle_history_opened', 'battle_turn_committed',
      'battle_turn_committed', 'battle_fast_forwarded', 'battle_history_opened',
    ]);
    assert.equal(calls[2].data?.action, 'arm');
    assert.equal(calls[3].data?.action, 'cancel');
    assert.equal(calls[5].data?.action, 'pass');
    assert.equal(calls[6].data?.action, 'lock_in');
    assert.equal(calls[6].data?.district, 2);

    const approvedKeys: Record<string, string[]> = {
      battle_unavailable_card_selected: ['round', 'hype', 'locked_districts', 'reason', 'decision_time'],
      battle_district_selected: ['round', 'district', 'changed', 'decision_time'],
      battle_squabble_toggled: ['round', 'action', 'decision_time'],
      battle_history_opened: ['round', 'entries', 'decision_time'],
      battle_turn_committed: ['round', 'action', 'automatic', 'squabble', 'decision_time', 'district'],
      battle_fast_forwarded: ['round', 'phase'],
    };
    for (const call of calls) {
      assert.deepEqual(Object.keys(call.data ?? {}).sort(), approvedKeys[call.name].filter(key => key in (call.data ?? {})).sort());
      assert.equal(JSON.stringify(call.data).includes(available.instanceId), false);
      assert.equal(JSON.stringify(call.data).includes(unavailable.instanceId), false);
      assert.equal(JSON.stringify(call.data).match(/account|email|user_id|card_instance/), null);
      assert.equal(JSON.stringify(call.data).includes('private-account'), false);
    }
  } finally {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
  }
});

test('tracker failures cannot interrupt battle decision state changes', () => {
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { umami: { track: () => { throw new Error('tracker unavailable'); } } },
  });
  const match = createMatch('block', 'combo');
  const available = match.playerHand.find(card => card.cost <= match.playerHype)!;
  const state = { selected: null as string | null, lane: null as number | null, squabble: false };
  const makeHandlers = () => createBattleDecisionHandlers({
    match, interactive: true, selectedInstanceId: state.selected, selectedLane: state.lane,
    squabble: state.squabble, lockedDistricts: 0, decisionStartedAt: Date.now(),
    setSelectedInstanceId: value => { state.selected = value; },
    setSelectedLane: value => { state.lane = value; },
    setSquabble: value => { state.squabble = value; },
  });

  try {
    assert.doesNotThrow(() => makeHandlers().selectCard(available, true));
    assert.equal(state.selected, available.instanceId);
    assert.doesNotThrow(() => makeHandlers().selectDistrict(2, true));
    assert.equal(state.lane, 2);
    assert.doesNotThrow(() => makeHandlers().toggleSquabble(available));
    assert.equal(state.squabble, true);
  } finally {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
  }
});

test('rapid repeated battle interactions report once per state transition and reset later', () => {
  const originalWindow = globalThis.window;
  const calls: string[] = [];
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { umami: { track: (name: string) => calls.push(name) } },
  });
  const match = createMatch('block', 'combo');
  const available = match.playerHand.find(card => card.cost <= match.playerHype)!;

  try {
    const commitLock = { current: false };
    const commit = (action: 'lock_in' | 'pass') => {
      if (!tryLockInteraction(commitLock)) return;
      trackBattleTurnCommitted(match, action, false, false, Date.now(), action === 'lock_in' ? 0 : null);
    };
    commit('lock_in');
    commit('lock_in');
    commitLock.current = false;
    commit('pass');
    commit('pass');

    const squabbleLock = { current: false };
    const state = { squabble: false };
    const handlers = () => createBattleDecisionHandlers({
      match, interactive: true, selectedInstanceId: available.instanceId, selectedLane: 0,
      squabble: state.squabble, lockedDistricts: 0, decisionStartedAt: Date.now(),
      setSelectedInstanceId: noop, setSelectedLane: noop,
      setSquabble: value => { state.squabble = value; },
      beginSquabbleTransition: () => tryLockInteraction(squabbleLock),
    });
    handlers().toggleSquabble(available);
    handlers().toggleSquabble(available);
    squabbleLock.current = false;
    handlers().toggleSquabble(available);

    const historyLock = { current: false };
    const openHistory = () => {
      if (!tryLockInteraction(historyLock)) return;
      handlers().openHistory(0);
    };
    openHistory();
    openHistory();
    historyLock.current = false;
    openHistory();

    const fastForwardLock = { current: false };
    const fastForward = () => {
      if (!tryLockInteraction(fastForwardLock)) return;
      trackBattleFastForwarded(match, 'effects');
    };
    fastForward();
    fastForward();
    fastForwardLock.current = false;
    fastForward();

    assert.deepEqual(calls, [
      'battle_turn_committed',
      'battle_turn_committed',
      'battle_squabble_toggled',
      'battle_squabble_toggled',
      'battle_history_opened',
      'battle_history_opened',
      'battle_fast_forwarded',
      'battle_fast_forwarded',
    ]);
  } finally {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
  }
});
