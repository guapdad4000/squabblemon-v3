import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cards, catalogCardById, decks, districts } from '../data';
import { createStoryMatch, type StoryEncounterSnapshot } from '@workspace/squabblemon-engine/gameEngine';
import { getStoryBattle } from '@workspace/squabblemon-engine/story';
import { Battle, createBattleDecisionHandlers, getRecentBattleActions, tryLockInteraction } from './Battle';
import { ResultScreen } from './ResultScreen';
import { CardUpgrades } from './CardUpgrades';
import { CardView } from './CardView';
import { CardInspector } from './CardInspector';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { applyEventState, buildReplayFrame, trackBattleFastForwarded, trackBattleTurnCommitted } from './PlayLoop';
import { createCanonicalMatch } from './PlayLoop';
import { trackEvent } from '../lib/analytics';
import { createMatch, playCard, type Match } from '../gameEngine';
import { createAbilityUpgradeSnapshot } from '@workspace/squabblemon-engine/abilityUpgrades';

const noop = () => {};
const renderBattle = (match: Match, props: Record<string, unknown> = {}) => renderToStaticMarkup(<Battle match={match} deck={decks.find(d => d.id === match.playerDeck)} rivalDeck={decks.find(d => d.id === match.cpuDeck)} selectedInstanceId={null} setSelectedInstanceId={noop} selectedLane={null} setSelectedLane={noop} commit={noop} skipSequence={noop} presentationPhase="player-ready" phaseMessage="Your move" timerSeconds={20} timerEnabled={false} impactLane={null} stagedRival={null} stagedPlayer={null} activeEffectId={null} activeEffectLane={null} activeEffect={null} presentationScores={null} squabble={false} setSquabble={noop} setInspect={noop} archiveMatch={noop} onShowRules={noop} {...props} />);

test('battle presentation names an authoritative triggered upgrade', () => {
  const match = createMatch('block', 'combo');
  const card = match.playerHand.find(c => c.cost <= match.playerMotion)!;
  const event = {
    sequence: 99,
    kind: 'normal' as const,
    cardInstanceId: card.instanceId,
    cardId: card.cardId,
    owner: 'player' as const,
    lane: 0 as const,
    targetIds: [],
    abilityMetadata: {
      upgradeId: 'cornball:upgrade:1',
      upgradeName: 'Pressure Point',
      sourceCardId: card.cardId,
      sourceInstanceId: card.instanceId,
      targetInstanceIds: [card.instanceId],
      result: 'applied' as const,
    },
    note: 'Upgrade applied',
    source: null,
    scores: { before: [], after: [] },
  };
  const html = renderBattle(match, { presentationPhase: 'effects', activeEffect: event, authoritativeHistory: [event] });
  assert.match(html, /data-testid="effect-upgrade-trigger"/);
  assert.match(html, /Upgrade · Pressure Point/);
});

test('upgrade card detail uses the shared unlock helper for locked and active states', () => {
  const html = renderToStaticMarkup(<CardUpgrades card={cards.cornball} progress={{ level: 2 }} />);
  assert.match(html, /Awkward Energy/);
  assert.match(html, />Active</);
  assert.match(html, /LV 5/);
});

test('upgrade card detail resolves catalog ids to canonical engine ids', () => {
  const html = renderToStaticMarkup(<CardUpgrades card={catalogCardById['snow-bunny']} progress={{ level: 2 }} />);
  assert.match(html, /Frostbite/);
  assert.match(html, />Active</);
});

test('collection and deck card shells render progression for catalog ids', () => {
  const html = renderToStaticMarkup(
    <CardView
      card={catalogCardById['all-jokes-roaster']}
      progress={{ xp: 120, level: 2 }}
      fillContainer
      presentationOnly
    />,
  );
  assert.match(html, /All Jokes Roaster/);
  assert.match(html, /1\/3 active/);
  assert.doesNotMatch(html, /<button/);
});

test('reward growth resolves catalog card ids and newly unlocked upgrades', () => {
  const match = createMatch('block', 'combo');
  const html = renderToStaticMarkup(
    <ResultScreen
      match={match}
      districts={districts}
      equippedVariants={{}}
      onRestart={noop}
      onChangeDeck={noop}
      onGoHome={noop}
      onRetryReward={noop}
      reward={{
        streetRep: 0,
        softCurrency: 0,
        cardXp: [{
          cardId: 'snow-bunny',
          xpGained: 120,
          previousXp: 0,
          previousLevel: 1,
          xp: 120,
          level: 2,
        }],
      }}
    />,
  );
  assert.match(html, /Snow Bunny/);
  assert.match(html, /New upgrade unlocked!/);
  assert.match(html, /Frostbite/);
});

test('authenticated initialization retains the server-issued leveled snapshot', () => {
  const snapshot = createAbilityUpgradeSnapshot(
    decks.find(deck => deck.id === 'block')!.cards,
    decks.find(deck => deck.id === 'combo')!.cards,
    { player: { cornball: { xp: 100, level: 2 } } },
  );
  const match = createCanonicalMatch('practice', 'block', 'combo', snapshot);
  assert.deepEqual(match.abilityUpgradeSnapshot, snapshot);
  assert.deepEqual(match.abilityUpgradeSnapshot.player.find(entry => entry.cardId === 'cornball')?.upgradeIds, ['cornball:upgrade:1']);
});

test('battle inspector shows all authored upgrades without collection bootstrap', () => {
  const match = createMatch('block', 'combo');
  const card = match.playerHand[0]!;
  const client = new QueryClient();
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <CardInspector card={card} match={match} onClose={noop} />
    </QueryClientProvider>,
  );
  assert.match(html, /Ability upgrades/);
  assert.equal((html.match(/data-testid="card-upgrade-/g) ?? []).length, 3);
});

test('player cards have one visual instance during travel and reveal', () => {
  let match = createMatch('block', 'combo');
  const card = match.playerHand.find(c => c.cost <= match.playerMotion)!;
  const travel = renderBattle(match, { presentationPhase: 'player-travel', impactLane: 0, stagedPlayer: card });
  assert.equal(travel.match(new RegExp(`data-instance-id="${card.instanceId}"`, 'g'))?.length, 1);
  match = playCard(match, 'player', card.instanceId, 0);
  assert.equal(renderBattle(match, { presentationPhase: 'player-reveal', impactLane: 0, stagedPlayer: card }).match(new RegExp(`data-instance-id="${card.instanceId}"`, 'g'))?.length, 1);
});
test('guidance, treatments, and broadcast signals remain available', () => {
  const match = createMatch('block', 'combo');
  const card = match.playerHand.find(c => c.cost <= match.playerMotion)!;
  const html = renderBattle(match, { selectedInstanceId: card.instanceId, equippedVariants: { [card.id]: `${card.id}:chrome` } });
  assert.match(html, /2\. Choose a lit district/); assert.match(html, /is-legal/); assert.match(html, /card-variant-chrome/);
  assert.match(renderBattle(match, { presentationPhase: 'round-intro', phaseMessage: 'ROUND 1' }), /broadcast-round-01/);
});

test('district-first selection stays selected when a card is chosen', () => {
  const match = createMatch('block', 'combo');
  const card = match.playerHand.find(c => c.cost <= match.playerMotion)!;
  const state: { card: string | null; lane: number | null; squabble: boolean } = { card: null, lane: null, squabble: false };
  const handlers = () => createBattleDecisionHandlers({
    match, interactive: true, selectedInstanceId: state.card, selectedLane: state.lane,
    squabble: state.squabble, lockedDistricts: 0,
    setSelectedInstanceId: value => { state.card = value; },
    setSelectedLane: value => { state.lane = value; },
    setSquabble: value => { state.squabble = value; },
  });
  handlers().selectDistrict(1, true);
  handlers().selectCard(card, true);
  assert.equal(state.lane, 1);
  assert.equal(state.card, card.instanceId);
  const html = renderBattle(match, { selectedInstanceId: card.instanceId, selectedLane: 1 });
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /Lock In ·/);
  assert.match(html, /Your Motion/);
  assert.match(html, /Rival Motion/);
});

test('unavailable cards explain the exact Motion shortfall', () => {
  const match = createMatch('block', 'combo');
  const unavailable = match.playerHand.find(card => card.cost > match.playerMotion)!;
  const html = renderBattle(match, { selectedLane: 0 });
  assert.match(html, new RegExp(`costs ${unavailable.cost} Motion in`));
  assert.match(html, new RegExp(`${unavailable.cost - match.playerMotion} short`));
});

test('decision handlers and commits remain privacy-safe and functional', () => {
  const match = createMatch('block', 'combo');
  const card = match.playerHand.find(c => c.cost <= match.playerMotion)!;
  const squabbleLock = { current: false };
  const state: { card: string | null; lane: number | null; squabble: boolean } = { card: card.instanceId, lane: 0, squabble: false };
  const handlers = createBattleDecisionHandlers({
      match, interactive: true, selectedInstanceId: state.card, selectedLane: state.lane,
      squabble: state.squabble, lockedDistricts: 0, decisionStartedAt: Date.now(),
      setSelectedInstanceId: value => { state.card = value; }, setSelectedLane: value => { state.lane = value; },
      setSquabble: value => { state.squabble = value; },
      beginSquabbleTransition: () => tryLockInteraction(squabbleLock),
    });
  assert.doesNotThrow(() => { handlers.selectDistrict(1, true); handlers.toggleSquabble(card); trackBattleTurnCommitted(match, 'lock_in', false, true, Date.now(), 1); });
  assert.equal(state.card, card.instanceId); assert.equal(state.lane, 1); assert.equal(state.squabble, true);
});

test('authoritative history helper ignores a rewound visual log', () => {
  const initial = createMatch('block', 'combo'), card = initial.playerHand.find(c => c.cost <= initial.playerMotion)!;

  const authoritative = playCard(initial, 'player', card.instanceId, 0);
  const resolved = playCard(initial, 'player', card.instanceId, 0), event = resolved.effectLog[0];
  const replayFrame = buildReplayFrame(resolved, event, 'before');
  assert.deepEqual(getRecentBattleActions({ ...replayFrame, effectLog: [] }, resolved.effectLog), [...resolved.effectLog].slice(-6).reverse());
  const html = renderBattle(replayFrame, { authoritativeHistory: resolved.effectLog, replay: { event, step: 'before' }, onReplayStep: noop, onExitReplay: noop });
  assert.match(html, /Replay · Before/); assert.match(html, /data-testid="button-battle-history"/); assert.match(html, /Return to live battle/);
});

test('replay frames do not mutate live match and rewind later actions', () => {
  const initial = createMatch('block', 'combo'), card = initial.playerHand.find(c => c.cost <= initial.playerMotion)!;
  const afterPlayer = playCard(initial, 'player', card.instanceId, 0), cpu = afterPlayer.cpuHand.find(c => c.cost <= afterPlayer.cpuMotion)!;
  const live = playCard(afterPlayer, 'cpu', cpu.instanceId, 1), event = afterPlayer.effectLog[0];
  assert.ok(applyEventState(live, live, event, 'before').playerHand.some(c => c.instanceId === card.instanceId));
  assert.ok(!buildReplayFrame(live, event, 'after').boards.flat().some(c => c.instanceId === cpu.instanceId));
  assert.ok(live.boards.flat().some(c => c.instanceId === cpu.instanceId));
});

test('story replay snapshots retain reinforcements and lane rules', () => {
  const base = getStoryBattle('welcome-to-the-block')!.encounter;
  const snapshot: StoryEncounterSnapshot = { ...base, modifiers: { ...base.modifiers, reinforcements: [{ round: 1, owner: 'cpu', cardId: 'snow' }] }, phases: [{ id: 'rules', name: 'Rules', trigger: { kind: 'round', atLeast: 1 }, onEnter: [{ kind: 'lane-power', owner: 'cpu', lane: 1, amount: 2 }] }] };
  const live = createStoryMatch(snapshot, 'block'), reinforcement = live.effectLog.find(e => e.note.includes('reinforcement'))!, rule = live.effectLog.find(e => e.note.includes('lane-power'))!;
  assert.equal(buildReplayFrame(live, reinforcement, 'after').cpuHand.filter(c => c.cardId === 'snow').length, buildReplayFrame(live, reinforcement, 'before').cpuHand.filter(c => c.cardId === 'snow').length + 1);
  assert.deepEqual(buildReplayFrame(live, rule, 'after').storyRuntime?.lanePowerBonuses.map(({ owner, lane, amount }) => ({ owner, lane, amount })), [{ owner: 'cpu', lane: 1, amount: 2 }]);
  const results = renderToStaticMarkup(<ResultScreen match={live} districts={districts} equippedVariants={{ 'officer-oink': 'officer-oink:chrome' }} onRestart={noop} onChangeDeck={noop} onGoHome={noop} onRetryReward={noop} isGuest />);
  assert.match(results, /variant-portrait-chrome/);
});

test('district impact and SQUABBLE wait until the impact beat', () => {
  const initial = createMatch('block', 'combo');
  const card = initial.playerHand.find(c => c.cost <= initial.playerMotion)!;
  const resolved = playCard(initial, 'player', card.instanceId, 0, true);
  const effect = { ...resolved.effectLog[0], targetIds: [] };
  const shared = { impactLane: 0, activeEffectLane: 0, activeEffectId: card.instanceId, activeEffect: effect };
  const travel = renderBattle(initial, { ...shared, presentationPhase: 'player-travel', stagedPlayer: card });
  const reveal = renderBattle(resolved, { ...shared, presentationPhase: 'player-reveal' });
  const impact = renderBattle(resolved, { ...shared, presentationPhase: 'player-impact' });
  assert.doesNotMatch(travel, /district-squabble-impact/);
  assert.doesNotMatch(travel, /card-squabble-armed/);
  assert.doesNotMatch(reveal, /district-impact/);
  assert.doesNotMatch(reveal, /card-squabble-armed/);
  assert.match(impact, /district-impact/);
  assert.match(impact, /district-squabble-impact/);
  assert.match(impact, /card-squabble-armed/);
});

test('battle decision interactions emit only approved coarse analytics fields', () => {
  const originalWindow = globalThis.window;
  const calls: Array<{ name: string; data?: Record<string, unknown> }> = [];
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { umami: { track: (name: string, data?: Record<string, unknown>) => calls.push({ name, data }) } },
  });
  const match = createMatch('block', 'combo');
  const unavailable = match.playerHand.find(card => card.cost > match.playerMotion)!;
  const available = match.playerHand.find(card => card.cost <= match.playerMotion)!;
  const state: { selected: string | null; lane: number | null; squabble: boolean } = { selected: null, lane: null, squabble: false };
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
      battle_unavailable_card_selected: ['round', 'motion', 'locked_districts', 'reason', 'decision_time'],
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
  const available = match.playerHand.find(card => card.cost <= match.playerMotion)!;
  const state: { selected: string | null; lane: number | null; squabble: boolean } = { selected: null, lane: null, squabble: false };
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
  const available = match.playerHand.find(card => card.cost <= match.playerMotion)!;

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
  const state: { selected: string | null; lane: number | null; squabble: boolean } = { selected: null, lane: null, squabble: false };
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
