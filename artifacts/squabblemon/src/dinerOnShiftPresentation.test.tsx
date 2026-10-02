import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Battle } from './components/Battle';
import { BattleAttack } from './components/BattleAttack';
import { BattlePowerBreakdown } from './components/BattlePowerBreakdown';
import { CardInspector } from './components/CardInspector';
import { battleChanges, participantPower } from './battleChoreography';
import { cards, decks } from './data';
import { createCardInstance, createMatch, getEffectiveCardPower, playCard, type EventParticipant, type Match } from './gameEngine';
import type { EffectLogEntry } from './gameEngine';

const noop = () => {};

function renderBattle(match: Match, event: EffectLogEntry) {
  return renderToStaticMarkup(<Battle
    match={match}
    deck={decks.find(deck => deck.id === match.playerDeck)}
    rivalDeck={decks.find(deck => deck.id === match.cpuDeck)}
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
    replay={{ event, step: 'after' }}
    onReplayStep={noop}
    onExitReplay={noop}
  />);
}

test('ongoing Hands are itemized separately from permanent modifiers in breakdown and inspector', () => {
  const original = createCardInstance('hooper', 'player', 'diner-on-shift-ui', 0);
  const card = { ...original, lane: 0 as const, powerModifier: 2, continuousPower: 3 };
  const match = {
    ...createMatch('block', 'combo'),
    boards: [[card], [], []] as Match['boards'],
  };
  const breakdown = renderToStaticMarkup(<BattlePowerBreakdown card={card} match={match} />);
  assert.match(breakdown, /<dt>Buffs \/ penalties<\/dt><dd>\+2<\/dd>/);
  assert.match(breakdown, /<dt>Ongoing Hands<\/dt><dd>\+3<\/dd>/);
  assert.match(breakdown, new RegExp(`<dt>Current card Hands</dt><dd>${getEffectiveCardPower(card)}</dd>`));
  assert.doesNotMatch(breakdown, /Minimum Hands adjustment/);
  const { continuousPower: _omitted, ...legacyCard } = card;
  const legacyBreakdown = renderToStaticMarkup(<BattlePowerBreakdown card={legacyCard} match={match} />);
  assert.doesNotMatch(legacyBreakdown, /Ongoing Hands/);
  assert.match(legacyBreakdown, new RegExp(`<dt>Current card Hands</dt><dd>${getEffectiveCardPower(legacyCard)}</dd>`));

  const inspector = renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}>
    <CardInspector card={card} match={match} onClose={noop} />
  </QueryClientProvider>);
  assert.match(inspector, /<div class="dossier-vital__label">Modifier<\/div><div class="dossier-vital__value">\+2<\/div>/);
  assert.match(inspector, /<div class="dossier-vital__label">Ongoing<\/div><div class="dossier-vital__value">\+3<\/div>/);
  assert.match(inspector, new RegExp(`<div class="dossier-vital__label">Effective</div><div class="dossier-vital__value">${getEffectiveCardPower(card)}</div>`));
});

test('historical battle captions use recorded replay power rather than the different live board', () => {
  const card = createCardInstance('hooper', 'player', 'diner-on-shift-history', 0);
  const match = { ...createMatch('block', 'combo'), playerHand: [card], playerMotion: 20 };
  const resolved = playCard(match, 'player', card.instanceId, 0);
  const originalEvent = resolved.effectLog.at(-1)!;
  assert.ok(originalEvent.source?.before && originalEvent.source.after);
  const source = originalEvent.source!;
  const historicalPower = card.basePower + 3;
  const historicalEvent: EffectLogEntry = {
    ...originalEvent,
    source: {
      ...source,
      after: { ...source.after!, continuousPower: 3, power: historicalPower },
    },
  };
  const liveBoard = resolved.boards.map(lane => lane.map(current =>
    current.instanceId === card.instanceId ? { ...current, continuousPower: 20 } : current,
  )) as Match['boards'];
  const html = renderBattle({ ...resolved, boards: liveBoard }, historicalEvent);
  assert.ok(html.includes(`Hands ${card.basePower} → ${historicalPower}`));
  assert.ok(!html.includes(`Hands ${card.basePower} → ${card.basePower + 20}`));
});

test('continuous power changes are visible as power but do not animate as damage; permanent hits still do', () => {
  const sourceCard = createCardInstance('snow', 'player', 'diner-on-shift-combat', 0);
  const targetCard = { ...createCardInstance('hooper', 'cpu', 'diner-on-shift-combat-target', 0), lane: 0 as const };
  const initial = {
    ...createMatch('block', 'combo'),
    playerHand: [sourceCard],
    playerMotion: 20,
    boards: [[targetCard], [], []] as Match['boards'],
  };
  const resolved = playCard(initial, 'player', sourceCard.instanceId, 0);
  const event = resolved.effectLog.find(entry => entry.type === 'ability'
    && entry.targets.some(participant => participant.cardInstanceId === targetCard.instanceId))!;
  const originalTarget = event.targets.find(participant => participant.cardInstanceId === targetCard.instanceId)!;
  const before = originalTarget.before!;
  const after = originalTarget.after!;
  const standingStatuses = { ...before.statuses, frozen: false };
  const auraBefore = { ...before, lane: 0 as const, statuses: standingStatuses, power: before.basePower + before.powerModifier };
  const auraAfter = {
    ...after,
    lane: 0 as const,
    statuses: standingStatuses,
    continuousPower: 3,
    power: after.basePower + after.powerModifier + 3,
  };
  const unchangedSource = event.source && {
    ...event.source,
    before: { ...event.source.after!, lane: 0 as const },
    after: { ...event.source.after!, lane: 0 as const },
  };
  const auraEvent = {
    ...event,
    source: unchangedSource,
    targets: event.targets.map(participant => participant.cardInstanceId === targetCard.instanceId
      ? { ...participant, before: auraBefore, after: auraAfter }
      : participant),
    targetIds: [targetCard.instanceId],
  };
  const auraChange = battleChanges(auraEvent).find(change => change.cardInstanceId === targetCard.instanceId)!;
  assert.equal(auraChange.delta, 3);
  assert.equal(auraChange.permanentDelta, 0);
  const oldSnapshot = { ...auraBefore };
  delete (oldSnapshot as { continuousPower?: number }).continuousPower;
  assert.equal(participantPower(oldSnapshot), before.basePower + before.powerModifier);
  assert.equal(participantPower({ ...auraAfter, statuses: { ...standingStatuses, frozen: true } }), 0);

  const ongoingMarkup = renderToStaticMarkup(<BattleAttack card={cards.snow} effect={auraEvent} impact />);
  assert.doesNotMatch(ongoingMarkup, /attack-material/);
  assert.doesNotMatch(ongoingMarkup, /data-testid="battle-power-change"/);

  const damagedEvent = {
    ...auraEvent,
    targets: auraEvent.targets.map(participant => participant.cardInstanceId === targetCard.instanceId
      ? {
        ...participant,
        after: {
          ...auraAfter,
          continuousPower: undefined,
          powerModifier: auraAfter.powerModifier - 1,
          power: auraAfter.basePower + auraAfter.powerModifier - 1,
        },
      }
      : participant),
  };
  const damageChange = battleChanges(damagedEvent).find(change => change.cardInstanceId === targetCard.instanceId)!;
  assert.equal(damageChange.permanentDelta, -1);
  const damageMarkup = renderToStaticMarkup(<BattleAttack card={cards.snow} effect={damagedEvent} impact />);
  assert.match(damageMarkup, /attack-material/);
  assert.match(damageMarkup, /data-testid="battle-power-change"/);
});

test('aura-loss Manager departures fade neutrally while same-event employee deaths retain hit feedback', () => {
  const sourceCard = createCardInstance('snow', 'player', 'diner-on-shift-departure', 0);
  const targetCard = { ...createCardInstance('hooper', 'cpu', 'diner-on-shift-departure-target', 0), lane: 0 as const };
  const initial = {
    ...createMatch('block', 'combo'),
    playerHand: [sourceCard],
    playerMotion: 20,
    boards: [[targetCard], [], []] as Match['boards'],
  };
  const resolved = playCard(initial, 'player', sourceCard.instanceId, 0);
  const event = resolved.effectLog.find(entry => entry.type === 'ability'
    && entry.targets.some(participant => participant.cardInstanceId === targetCard.instanceId))!;
  const template = event.targets.find(participant => participant.cardInstanceId === targetCard.instanceId)!.before!;
  const makeBefore = (instanceId: string, cardId: string, basePower: number, powerModifier: number, continuousPower: number) => ({
    ...template,
    cardInstanceId: instanceId,
    cardId,
    owner: 'cpu' as const,
    lane: 0 as const,
    basePower,
    powerModifier,
    continuousPower,
    power: Math.max(0, basePower + powerModifier + continuousPower),
    statuses: { ...template.statuses, frozen: false },
  });
  const employeeId = 'presentation-employee-hit';
  const managerId = 'presentation-neutral-manager';
  const employee: EventParticipant = {
    cardInstanceId: employeeId,
    cardId: 'griddle-master',
    owner: 'cpu',
    before: makeBefore(employeeId, 'griddle-master', 1, 0, 0),
    after: null,
  };
  const manager = {
    cardInstanceId: managerId,
    cardId: 'squabble-house-manager',
    owner: 'cpu' as const,
    before: makeBefore(managerId, 'squabble-house-manager', 2, -2, 1),
    after: null,
    departureCause: 'aura-loss' as const,
  };
  const publicManager = {
    cardInstanceId: manager.cardInstanceId,
    cardId: manager.cardId,
    owner: manager.owner,
    before: manager.before,
    after: manager.after,
    departureCause: manager.departureCause,
  } as EventParticipant & { departureCause?: 'aura-loss' };

  for (const projectedManager of [manager, publicManager]) {
    const mixedEvent = {
      ...event,
      targets: [employee, projectedManager],
      targetIds: [employeeId, managerId],
    };
    const changes = battleChanges(mixedEvent);
    assert.deepEqual(changes.find(change => change.cardInstanceId === managerId)?.labels, ['Ongoing aura faded']);
    assert.deepEqual(changes.find(change => change.cardInstanceId === employeeId)?.labels, ['Destroyed']);

    const markup = renderToStaticMarkup(<BattleAttack card={cards.snow} effect={mixedEvent} impact />);
    assert.match(markup, new RegExp(`data-testid="neutral-departure"[^>]*data-geo-change="${managerId}"`));
    assert.match(markup, new RegExp(`data-testid="destroyed-card"[^>]*data-geo-change="${employeeId}"`));
    assert.match(markup, new RegExp(`class="attack-material" data-geo-change="${employeeId}"`));
    assert.doesNotMatch(markup, new RegExp(`data-testid="destroyed-card"[^>]*data-geo-change="${managerId}"`));
    assert.doesNotMatch(markup, new RegExp(`class="attack-material" data-geo-change="${managerId}"`));
    assert.doesNotMatch(markup, new RegExp(`<g data-attack-target="${managerId}"`));
    const managerCue = markup.match(new RegExp(`<div data-testid="battle-power-change"[^>]*data-geo-change="${managerId}"[^>]*>(.*?)</div>`))?.[1] ?? '';
    assert.match(managerCue, /Ongoing aura faded/);
    assert.doesNotMatch(managerCue, /<strong>/);
  }
});