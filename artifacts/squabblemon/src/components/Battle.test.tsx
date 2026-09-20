import { getDistrictResults } from '../gameEngine';
import { asCard } from './MultiplayerBattle';
import { getCardRarity } from './CardRarityTreatment';
import { Router } from 'wouter';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
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
import { applyEventState, buildReplayFrame, shouldRunTurnTimer, trackBattleFastForwarded, trackBattleTurnCommitted } from './PlayLoop';
import { createCanonicalMatch } from './PlayLoop';
import { trackEvent } from '../lib/analytics';
import { DISTRICT_CATALOG, type DistrictSnapshot, createDistrictSnapshot, getMatchDistricts, playTurnCard, createCardInstance, createMatch, playCard, type Match } from '../gameEngine';
import { createAbilityUpgradeSnapshot } from '@workspace/squabblemon-engine/abilityUpgrades';
import { BattlePowerBreakdown } from './BattlePowerBreakdown';
import { BATTLE_VENUES, resolveBattleVenue } from '../battleVenues';
import { RulesModal } from './RulesModal';
import { MECHANIC_LESSONS, MECHANIC_LESSON_IDS, getTutorialGuidance } from './tutorialGuidance';

const noop = () => {};
const source = readFileSync(new URL('./Battle.tsx', import.meta.url), 'utf8');
const renderBattle = (match: Match, props: Record<string, unknown> = {}) => renderToStaticMarkup(<Battle match={match} deck={decks.find(d => d.id === match.playerDeck)} rivalDeck={decks.find(d => d.id === match.cpuDeck)} selectedInstanceId={null} setSelectedInstanceId={noop} selectedLane={null} setSelectedLane={noop} commit={noop} skipSequence={noop} presentationPhase="player-ready" phaseMessage="Your move" timerSeconds={20} timerEnabled={false} impactLane={null} stagedRival={null} stagedPlayer={null} activeEffectId={null} activeEffectLane={null} activeEffect={null} presentationScores={null} squabble={false} setSquabble={noop} setInspect={noop} archiveMatch={noop} onShowRules={noop} {...props} />);

test('battle venues map deterministically for training, story, and replay frames', () => {
  const trainingAssignments = {
    block: 'corner-store',
    slide: 'harbor-skyline',
    crashout: 'red-fence-night',
    receipts: 'red-fence-night',
    combo: 'civic-hill',
    vibes: 'crown-rooftop',
    compound: 'crown-rooftop',
  } as const;
  for (const [rival, venue] of Object.entries(trainingAssignments)) {
    const player = rival === 'block' ? 'slide' : 'block';
    const training = createMatch(player, rival);
    assert.equal(resolveBattleVenue(training).id, venue);
    assert.equal(resolveBattleVenue({ ...training }).id, venue);
  }
  const story = createStoryMatch(getStoryBattle('cracked-head-takes-the-block')!.encounter, 'block');
  assert.equal(resolveBattleVenue(story).id, 'crown-rooftop');
  assert.equal(resolveBattleVenue({ ...story }).id, resolveBattleVenue(story).id);
  const training = createMatch('block', 'slide');
  const html = renderBattle(training);
  assert.match(html, /data-venue="harbor-skyline"/);
  assert.ok(html.includes(BATTLE_VENUES['harbor-skyline'].assetId));
});

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

test('summoned token cards render with their own art instead of requiring a catalog rarity', () => {
  const steward = {
    id: 'steward', name: 'Steward', type: 'Air', cost: 0, power: 2,
    ability: 'Cabin Service', effect: 'On Reveal: target an enemy for -1 Hand.',
    kind: 'token' as const, abilityUpgrades: [],
  };
  const html = renderToStaticMarkup(<CardView card={steward} presentationOnly />);
  assert.match(html, /data-card-kind="token"/);
  assert.match(html, /data-card-rarity="Common"/);
  assert.match(html, /assets\/characters\/steward\.webp/);
});
test('board cards expose Burn, Weaken, Lock, and Boost status badges', () => {
  const base = createMatch('block', 'combo').playerHand[0];
  const card = {
    ...base,
    lane: 0 as const,
    statuses: {
      ...base.statuses,
      burnStacks: 2,
      weakened: true,
      locked: true,
      boosted: true,
    },
  };
  const html = renderToStaticMarkup(<CardView card={card} isBoard presentationOnly />);
  for (const status of ['burn', 'weakened', 'locked', 'boosted']) {
    assert.match(html, new RegExp(`data-card-status="${status}"`));
  }
  assert.match(html, /aria-label="[^"]*Burning: 2 burn stacks\. Weakened\. Locked\. Boosted\./);
});

test('reward growth resolves catalog card ids and links newly eligible move training', () => {
  const match = createMatch('block', 'combo');
  const html = renderToStaticMarkup(
    <Router ssrPath="/"><ResultScreen
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
    /></Router>,
  );
  assert.match(html, /Snow Bunny/);
  assert.match(html, /New move ready to train/);
  assert.match(html, /card=snow-bunny/);
});


test('tutorial mode disables the turn timer and automatic turn commits', () => {
  assert.equal(shouldRunTurnTimer('tutorial', true), false);
  assert.equal(shouldRunTurnTimer('tutorial', false), false);
  assert.equal(shouldRunTurnTimer('practice', true), true);
  assert.equal(shouldRunTurnTimer('story', true), true);
});

test('unverified tutorial completion requires a fresh guided restart', () => {
  const match = createMatch('block', 'combo');
  const failed = renderToStaticMarkup(
    <Router ssrPath="/"><ResultScreen
      tutorial
      match={match}
      districts={districts}
      equippedVariants={{}}
      onRestart={noop}
      onChangeDeck={noop}
      onGoHome={noop}
      onTutorialComplete={noop}
      onRetryReward={noop}
      rewardError
    /></Router>,
  );
  assert.match(failed, /Tutorial completion could not be verified/);
  assert.match(failed, /data-testid="button-restart-tutorial"/);
  assert.doesNotMatch(failed, /data-testid="button-complete-tutorial"/);
  assert.doesNotMatch(failed, /Retry Save/);

  const verifying = renderToStaticMarkup(
    <Router ssrPath="/"><ResultScreen
      tutorial
      match={match}
      districts={districts}
      equippedVariants={{}}
      onRestart={noop}
      onChangeDeck={noop}
      onGoHome={noop}
      onTutorialComplete={noop}
      onRetryReward={noop}
    /></Router>,
  );
  assert.match(verifying, /Saving Tutorial/);
  assert.match(openingButton(verifying, 'button-complete-tutorial'), /disabled/);

  const verified = renderToStaticMarkup(
    <Router ssrPath="/"><ResultScreen
      tutorial
      match={match}
      districts={districts}
      equippedVariants={{}}
      onRestart={noop}
      onChangeDeck={noop}
      onGoHome={noop}
      onTutorialComplete={noop}
      onRetryReward={noop}
      reward={{ streetRep: 0, softCurrency: 0, cardXp: [] }}
    /></Router>,
  );
  assert.match(verified, /data-testid="button-complete-tutorial"/);
  assert.doesNotMatch(verified, /data-testid="button-restart-tutorial"/);
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

test('custom deck story initialization uses the issued cards, order, and cover identity', () => {
  const encounter = getStoryBattle('welcome-to-the-block')!.encounter;
  const roster = ['cornball', 'nail', 'plug', 'hooper', 'snow', 'delivery', 'rastamon', 'wifey', 'roaster', 'baby'];
  const snapshot = createAbilityUpgradeSnapshot(roster, encounter.enemy.cardIds);
  const match = createCanonicalMatch('story', 'personal-deck', encounter.enemy.deckId, snapshot, encounter);
  assert.equal(match.playerDeck, 'personal-deck');
  assert.deepEqual(match.playerCardIds, roster);
  assert.equal(match.playerHand[1].id, 'nail-tech');
  assert.deepEqual(match.abilityUpgradeSnapshot, snapshot);
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
  assert.match(html, /Choose a lit district/); assert.match(html, /is-legal/); assert.match(html, /card-variant-chrome/);
  assert.match(renderBattle(match, { presentationPhase: 'round-intro', phaseMessage: 'ROUND 1' }), /broadcast-round-01/);
});

test('guided battle renders the current Dr. Fade action and focus target', () => {
  const match = createMatch('vibes', 'combo');
  const tutorialGuidance = getTutorialGuidance({
    match,
    selectedInstanceId: null,
    selectedLane: null,
    squabble: false,
    playsThisRound: 0,
  });
  const html = renderBattle(match, { tutorialCoach: true, tutorialGuidance });
  assert.match(html, /data-tutorial-focus="card"/);
  assert.match(html, /data-testid="tutorial-step-r1_choose_card"/);
  assert.match(html, /Choose your first fighter/);
  assert.match(html, /Cards cost Motion and add Hands/);
});


const openingButton = (html: string, testId: string) => {
  const tag = html.match(new RegExp('<button[^>]*data-testid="' + testId + '"[^>]*>'))?.[0];
  assert(tag, 'missing ' + testId);
  return tag;
};

test('guided rounds one and two require a play before either End Turn control enables', () => {
  for (const round of [1, 2]) {
    const match = { ...createMatch('vibes', 'combo'), round } as Match;
    const beforePlay = getTutorialGuidance({
      match, selectedInstanceId: null, selectedLane: null, squabble: false, playsThisRound: 0,
    });
    const blocked = renderBattle(match, {
      tutorialCoach: true,
      tutorialGuidance: beforePlay,
      endTurn: noop,
    });
    assert.match(blocked, /Play a Card First/);
    assert.match(openingButton(blocked, 'button-next-round'), /disabled/);
    assert.match(openingButton(blocked, 'button-menu-end-turn'), /disabled/);

    const card = match.playerHand.find(item => item.cost <= match.playerMotion)!;
    const selectedGuidance = getTutorialGuidance({
      match, selectedInstanceId: card.instanceId, selectedLane: 0, squabble: false, playsThisRound: 0,
    });
    const selected = renderBattle(match, {
      tutorialCoach: true,
      tutorialGuidance: selectedGuidance,
      selectedInstanceId: card.instanceId,
      selectedLane: 0,
      onPlayCard: noop,
    });
    assert.match(openingButton(selected, 'button-squabble'), /disabled/);

    const afterPlay = getTutorialGuidance({
      match, selectedInstanceId: null, selectedLane: null, squabble: false, playsThisRound: 1,
    });
    const enabled = renderBattle(match, {
      tutorialCoach: true,
      tutorialGuidance: afterPlay,
      endTurn: noop,
    });
    assert.match(enabled, />End Turn</);
    assert.doesNotMatch(openingButton(enabled, 'button-next-round'), /disabled/);
    assert.doesNotMatch(openingButton(enabled, 'button-menu-end-turn'), /disabled/);
  }
});

test('guided round three requires clearing a selected card before banking Motion', () => {
  const match = { ...createMatch('vibes', 'combo'), round: 3 } as Match;
  const card = match.playerHand.find(item => item.cost <= match.playerMotion)!;
  const selectedGuidance = getTutorialGuidance({
    match, selectedInstanceId: card.instanceId, selectedLane: 0, squabble: false, playsThisRound: 0,
  });
  const selected = renderBattle(match, {
    tutorialCoach: true,
    tutorialGuidance: selectedGuidance,
    selectedInstanceId: card.instanceId,
    selectedLane: 0,
    endTurn: noop,
    onPlayCard: noop,
  });
  assert.match(selected, /Clear Card to Bank Motion/);
  assert.match(openingButton(selected, 'button-tutorial-clear-card'), /disabled/);
  assert.match(openingButton(selected, 'button-menu-end-turn'), /disabled/);

  const bankGuidance = getTutorialGuidance({
    match, selectedInstanceId: null, selectedLane: null, squabble: false, playsThisRound: 0,
  });
  const ready = renderBattle(match, {
    tutorialCoach: true,
    tutorialGuidance: bankGuidance,
    endTurn: noop,
  });
  assert.doesNotMatch(openingButton(ready, 'button-next-round'), /disabled/);
  assert.doesNotMatch(openingButton(ready, 'button-menu-end-turn'), /disabled/);
});

test('guided round four gates play and End Turn until SQUABBLE is armed and used', () => {
  const match = { ...createMatch('vibes', 'combo'), round: 4, playerMotion: 6 } as Match;
  const card = match.playerHand.find(item => item.cost <= match.playerMotion)!;
  const chooseGuidance = getTutorialGuidance({
    match, selectedInstanceId: null, selectedLane: null, squabble: false, playsThisRound: 0,
  });
  const choose = renderBattle(match, {
    tutorialCoach: true,
    tutorialGuidance: chooseGuidance,
    endTurn: noop,
  });
  assert.match(choose, /Choose a Card for SQUABBLE/);
  assert.match(openingButton(choose, 'button-next-round'), /disabled/);

  const armGuidance = getTutorialGuidance({
    match, selectedInstanceId: card.instanceId, selectedLane: 0, squabble: false, playsThisRound: 0,
  });
  const arm = renderBattle(match, {
    tutorialCoach: true,
    tutorialGuidance: armGuidance,
    selectedInstanceId: card.instanceId,
    selectedLane: 0,
    endTurn: noop,
    onPlayCard: noop,
  });
  assert.match(arm, /Arm SQUABBLE First/);
  assert.match(openingButton(arm, 'button-tutorial-arm-squabble'), /disabled/);
  assert.match(openingButton(arm, 'button-menu-end-turn'), /disabled/);
  assert.doesNotMatch(openingButton(arm, 'button-squabble'), /disabled/);

  const playGuidance = getTutorialGuidance({
    match, selectedInstanceId: card.instanceId, selectedLane: 0, squabble: true, playsThisRound: 0,
  });
  const armed = renderBattle(match, {
    tutorialCoach: true,
    tutorialGuidance: playGuidance,
    selectedInstanceId: card.instanceId,
    selectedLane: 0,
    squabble: true,
    endTurn: noop,
    onPlayCard: noop,
  });
  assert.match(armed, /Play card · [0-9]+ Motion · ×2/);
  assert.doesNotMatch(openingButton(armed, 'button-lock'), /disabled/);
  assert.match(openingButton(armed, 'button-menu-end-turn'), /disabled/);

  const spentMatch = { ...match, squabbleUsed: true } as Match;
  const endGuidance = getTutorialGuidance({
    match: spentMatch, selectedInstanceId: null, selectedLane: null, squabble: false, playsThisRound: 1,
  });
  const spent = renderBattle(spentMatch, {
    tutorialCoach: true,
    tutorialGuidance: endGuidance,
    endTurn: noop,
  });
  assert.doesNotMatch(openingButton(spent, 'button-next-round'), /disabled/);
  assert.doesNotMatch(openingButton(spent, 'button-menu-end-turn'), /disabled/);
});

test('first-seen lesson and Field Manual expose the same mechanic reference', () => {
  const match = createMatch('block', 'combo');
  const html = renderBattle(match, {
    presentationPhase: 'effects',
    mechanicLesson: MECHANIC_LESSONS.burn,
    onDismissMechanicLesson: noop,
  });
  assert.match(html, /data-testid="mechanic-lesson"/);
  assert.match(html, /data-mechanic="burn"/);
  assert.match(html, /Burn stacks remove that many Hands/);
  const rules = renderToStaticMarkup(<RulesModal onClose={noop} />);
  assert.match(rules, /data-testid="mechanic-reference"/);
  assert.equal((rules.match(/data-mechanic=/g) ?? []).length, MECHANIC_LESSON_IDS.length);
});

test("status help distinguishes durable Church Auntie and Nail Salon shields from Wifey's round guard", () => {
  assert.match(source, /Church Auntie or Nail Salon blocks this card’s next targeted hostile ability, even in a later round/);
  assert.match(source, /Wifey blocks one targeted effect in her district this round/);
  let match = createMatch('vibes', 'vibes');
  const church = createCardInstance('church', 'player', 'covered-ui', 0);
  const ally = createCardInstance('cornball', 'player', 'covered-ui', 1);
  match = { ...match, playerMotion: 20, playerHand: [church], boards: [[ally], [], []] };
  match = playCard(match, 'player', church.instanceId, 0);
  const markup = renderBattle(match);
  assert.match(markup, /data-card-status="covered"/);
  assert.doesNotMatch(markup, /data-instance-id="[^"]*cornball[^"]*"[^>]*aria-label="[^"]*Protected this round/);
});

test('every authored round intro uses its matching fight-night asset', () => {
  const match = createMatch('block', 'combo');
  for (let round = 1; round <= 6; round += 1) {
    const html = renderBattle({ ...match, round } as Match, {
      presentationPhase: 'round-intro',
      phaseMessage: `ROUND ${round}`,
    });
    const productionName = `round-${String(round).padStart(2, '0')}`;
    assert.match(html, new RegExp(`broadcast-${productionName}`));
    assert.match(html, new RegExp(`assets/fight-night/${productionName}\\.webp`));
  }
});

test('battle HUD reflects authored four-round encounter length', () => {
  const encounter = getStoryBattle('blue-side-pressure')!.encounter;
  const match = createStoryMatch(encounter, 'block');
  const html = renderBattle(match, { rivalDeck: decks[0] });
  assert.match(html, /aria-label="Round 1 of 4"/);
  assert.ok(html.includes('<small> / 04</small>'));
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
  assert.match(html, /Play card ·/);
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

test('replay frames do not mutate live fade and rewind later actions', () => {
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


test('issued locations drive battle names, rules, canonical initialization and presentation state', () => {
  const issued = createDistrictSnapshot('location-ui');
  const base = createMatch('vibes', 'block');
  const match = createCanonicalMatch('practice', 'vibes', 'block', base.abilityUpgradeSnapshot, null, issued);
  const html = renderBattle(match);
  for (const district of getMatchDistricts(match)) {
    assert(html.includes(district.name));
    assert(html.includes(`data-location="${district.id}"`));
  }
  assert(html.includes('district-rule'));
  assert(!html.includes('THE TOWN'));
  const entry = match.playerHand.find(c => c.cost <= match.playerMotion)!;
  const after = playTurnCard(match, 'player', entry.instanceId, 0);
  const event = after.effectLog.find(e => e.type === 'play')!;
  const frame = applyEventState(match, after, event, 'after');
  assert.equal(frame.districtRuntime!.plays.player[0], 1);
  assert.equal(buildReplayFrame(after, event, 'before').districtRuntime!.plays.player[0], 0);
  assert.deepEqual(frame.districtSnapshot, issued);
});


test('negative district effects display a clean sign and Subway replay presents the moved card', () => {
  const issued: DistrictSnapshot = { version: 1, locations: ['dive-bar', 'the-subway', 'the-trap'].map(id => DISTRICT_CATALOG.find(d => d.id === id)!) as DistrictSnapshot['locations'] };
  const match = createMatch('vibes', 'block', undefined, undefined, issued);
  const card = { ...createCardInstance('hooper', 'player'), lane: 0 as const };
  match.boards[0] = [card];
  const html = renderToStaticMarkup(<BattlePowerBreakdown card={card} match={match} />);
  assert.match(html, /District bonus \/ penalty<\/dt><dd>-2<\/dd>/);
  assert(!html.includes('+-2'));
  const rider = createCardInstance('cornball', 'player');
  match.playerHand = [rider];
  const after = playTurnCard(match, 'player', rider.instanceId, 1);
  const event = after.effectLog.at(-1)!;
  const frame = applyEventState(match, after, event, 'after');
  assert(frame.boards[2].some(c => c.instanceId === rider.instanceId));
  assert.equal(buildReplayFrame(after, event, 'before').boards[1].length, 1);
});


test('Nail Salon shows lasting Covered protection on the board and in power details', () => {
  const issued: DistrictSnapshot = { version: 1, locations: ['nail-salon', 'the-subway', 'the-trap'].map(id => DISTRICT_CATALOG.find(d => d.id === id)!) as DistrictSnapshot['locations'] };
  const entry = createCardInstance('cornball', 'player');
  const base = createMatch('vibes', 'vibes', undefined, undefined, issued);
  const match = playTurnCard({ ...base, playerHand: [entry] }, 'player', entry.instanceId, 0);
  assert.match(renderBattle(match), /data-card-status="covered"/);
  const html = renderToStaticMarkup(<BattlePowerBreakdown card={match.boards[0][0]} match={match} />);
  assert.match(html, /NAIL SALON: blocks this card’s next targeted enemy ability/);
});

for (const [summoner, token, count] of [['ashlee', 'guyana', 1], ['captainjigga', 'steward', 2], ['kyle', 'smile-bomb', 4]] as const) {
  test(`battle renders after ${summoner} special and its summons have unique identities`, () => {
    const card = createCardInstance(summoner, 'player', 'test', 0);
    const match = playCard({ ...createMatch('block', 'slide'), playerHand: [card], playerMotion: 9 }, 'player', card.instanceId, 0);
    const summons = match.boards.flat().filter(c => c.cardId === token);
    assert.equal(summons.length, count);
    const html = renderBattle(match);
    assert.match(html, new RegExp('data-card-id="' + token + '"'));
    assert.equal(new Set(summons.map(c => c.instanceId)).size, count);
  });
}

test('summons render in multiplayer and can be inspected without becoming collectibles', () => {
  for (const summoner of ['ashlee', 'captainjigga', 'kyle']) {
    const card = createCardInstance(summoner, 'player', 'test', 0);
    const match = playCard({ ...createMatch('block', 'slide'), playerHand: [card], playerMotion: 9 }, 'player', card.instanceId, 0);
    for (const token of match.boards.flat().filter(c => c.kind === 'token')) {
      const publicCard = asCard({
        cardId: token.cardId, artworkId: token.id, instanceId: token.instanceId, owner: token.owner, lane: token.lane,
        power: token.basePower + token.powerModifier, basePower: token.basePower, powerModifier: token.powerModifier,
        statuses: token.statuses, covered: false, moved: token.moved, costs: [0, 0, 0],
      });
      assert.equal(publicCard.kind, 'token');
      assert.equal(publicCard.id, token.id);
      assert.equal(publicCard.name, token.name);
      assert.match(renderToStaticMarkup(<CardView card={publicCard} isBoard />), /Summoned token/);
      assert.doesNotThrow(() => renderToStaticMarkup(
        <QueryClientProvider client={new QueryClient()}><CardInspector card={token} match={match} onClose={noop} /></QueryClientProvider>,
      ));
      assert.equal(catalogCardById[token.id], undefined);
    }
  }
  assert.throws(() => getCardRarity('invalid-roster-card'), /unknown card/);
});

test('later copy, cheap ally buffs, and enemy targeting handle summoned cards', () => {
  const captain = createCardInstance('captainjigga', 'player', 'test', 0);
  const summoned = playCard({ ...createMatch('block', 'slide'), playerHand: [captain], playerMotion: 9 }, 'player', captain.instanceId, 0);
  const tokens = summoned.boards[0].filter(c => c.kind === 'token');
  for (const [id, owner] of [['scammer', 'cpu'], ['gothkid', 'cpu'], ['failedrapper', 'player']] as const) {
    const played = createCardInstance(id, owner, 'followup', 1);
    const match = playCard({ ...summoned, boards: [tokens, [], []],
      phase: owner === 'player' ? 'player' : 'cpu-reveal',
      playerHand: owner === 'player' ? [played] : [], cpuHand: owner === 'cpu' ? [played] : [],
      playerMotion: 9, cpuMotion: 9,
    }, owner, played.instanceId, 0);
    assert.doesNotThrow(() => renderBattle(match));
    if (id === 'scammer') assert.equal(match.boards[0].find(c => c.cardId === id)?.ability, tokens[0].ability);
    if (id === 'gothkid') assert.equal(match.boards[0].filter(c => c.kind === 'token' && c.statuses.silenced).length, 1);
    if (id === 'failedrapper') assert.ok(match.boards[0].filter(c => c.kind === 'token').every(c => c.powerModifier === 1));
  }
});

for (const summoner of ['ashlee', 'captainjigga', 'kyle']) {
  test(`summon Hands stay synchronized with live lane totals during ${summoner} animation`, () => {
    const actor = createCardInstance(summoner, 'player', 'test', 0);
    const base = { ...createMatch('block', 'slide'), playerHand: [actor], playerMotion: 9 };
    const resolved = playCard(base, 'player', actor.instanceId, 0);
    let frame = base;
    for (const event of resolved.effectLog) {
      frame = applyEventState(frame, resolved, event, 'after');
      assert.deepEqual(getDistrictResults(frame).map(({lane,player,cpu})=>({lane,player,cpu})), event.scores.after,
        event.note + ': visible cards and scoreboard must agree');
    }
    assert.deepEqual(frame.boards, resolved.boards);
    const tokens = frame.boards.flat().filter(c => c.kind === 'token');
    assert.equal(tokens.reduce((n,c)=>n+c.basePower+c.powerModifier,0), summoner === 'ashlee' ? 4 : summoner === 'captainjigga' ? 4 : 0);
  });
}

test('stewardesses each remove exactly 2 Hands from distinct unprotected enemies', () => {
  const actor = createCardInstance('captainjigga', 'player', 'test', 0);
  const foes = ['og','hooper'].map((id,i)=>({...createCardInstance(id,'cpu','test',i),lane:1 as const}));
  const base: Match = {...createMatch('block','slide'),playerHand:[actor],playerMotion:9,boards:[[],foes,[]]};
  const resolved=playCard(base,'player',actor.instanceId,0);
  for(const foe of foes) assert.equal(resolved.boards.flat().find(c=>c.instanceId===foe.instanceId)!.powerModifier,-2);
  assert.deepEqual(resolved.boards[0].filter(c=>c.cardId==='steward').map(c=>c.id), ['steward', 'steward-blue']);
  const event=resolved.effectLog.find(e=>e.type==='ability' && e.cardId==='captainjigga')!;
  assert.equal(event.scores.before[1].cpu-event.scores.after[1].cpu,4);
});
