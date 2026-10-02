import { getDistrictResults } from '../gameEngine';
import { SIDE_OZ_WAVE } from '../../../../lib/squabblemon-engine/src/sideOzWave';
import { asCard } from './MultiplayerBattle';
import { getCardRarity } from './CardRarityTreatment';
import { Router } from 'wouter';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cards, catalogCardById, decks, districts, getCardImage } from '../data';
import characterRevisions from '../characterRevisions.json';
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
import { DISTRICT_CATALOG, type DistrictSnapshot, createDistrictSnapshot, getCharacterDistrictMarks, getMatchDistricts, playTurnCard, createCardInstance, createMatch, playCard, type Lane, type Match } from '../gameEngine';
import { createAbilityUpgradeSnapshot } from '@workspace/squabblemon-engine/abilityUpgrades';
import { BattlePowerBreakdown } from './BattlePowerBreakdown';
import { BATTLE_VENUES, resolveBattleVenue } from '../battleVenues';
import { RulesModal } from './RulesModal';
import { MECHANIC_LESSONS, MECHANIC_LESSON_IDS, getTutorialGuidance } from './tutorialGuidance';

const noop = () => {};
const source = readFileSync(new URL('./Battle.tsx', import.meta.url), 'utf8');
const renderBattle = (match: Match, props: Record<string, unknown> = {}) => renderToStaticMarkup(<Battle match={match} deck={decks.find(d => d.id === match.playerDeck)} rivalDeck={decks.find(d => d.id === match.cpuDeck)} selectedInstanceId={null} setSelectedInstanceId={noop} selectedLane={null} setSelectedLane={noop} commit={noop} skipSequence={noop} presentationPhase="player-ready" phaseMessage="Your move" timerSeconds={20} timerEnabled={false} impactLane={null} stagedRival={null} stagedPlayer={null} activeEffectId={null} activeEffectLane={null} activeEffect={null} presentationScores={null} squabble={false} setSquabble={noop} setInspect={noop} archiveMatch={noop} onShowRules={noop} {...props} />);
const districtSnapshotFor = (ids: string[]): DistrictSnapshot => ({
  version: 1,
  locations: ids.map(id => DISTRICT_CATALOG.find(district => district.id === id)!) as DistrictSnapshot['locations'],
});
const createTripleOgUiMatch = () => {
  const match = createMatch('block', 'combo', undefined, undefined, districtSnapshotFor(['county-jail', 'magic-city', 'time-square']));
  const blue = createCardInstance('triple-og-blue', 'player', 'triple-og-ui', 0);
  const red = createCardInstance('triple-og-red', 'player', 'triple-og-ui', 1);
  match.playerHand = [blue, red];
  match.playerMotion = 10;
  return { match, blue, red };
};
const onlinePresentationFor = (match: Match, lockedLanes: number[] = []) => ({
  districts: getMatchDistricts(match),
  scores: getDistrictResults(match),
  costs: Object.fromEntries(match.playerHand.map(card => [card.instanceId, [4, 4, 4]])),
  lockedLanes,
  covered: new Set<string>(),
  history: [],
  turnSeconds: 20,
  clockRunning: false,
  yourTurn: true,
  mode: 'ranked',
  status: 'Your move',
  rivalHandCount: 0,
});
const getRenderedLaneButton = (html: string, lane: number) =>
  html.match(new RegExp(`<button type="button" data-testid="lane-${lane}"[^>]*>`))?.[0] ?? '';

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

test('all twelve side and Oz cards show their own art and abilities in collection, deck, inspector, and battle', () => {
  for (const [engineId, art, name, , , , , ability] of SIDE_OZ_WAVE) {
    const card = catalogCardById[art];
    const image = `/assets/characters/${art}.webp?v=${(characterRevisions as Record<string, string>)[art]}`;
    for (const presentationOnly of [true, false]) {
      const shell = renderToStaticMarkup(<CardView card={card} fillContainer presentationOnly={presentationOnly} />);
      assert(shell.includes(image), `${name} collection/deck art`);
      assert(shell.includes(name), `${name} collection/deck name`);
    }
    const instance = createCardInstance(engineId, 'player', 'side-oz-render', 1);
    const match = createMatch('block', 'slide');
    const inspector = renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}>
      <CardInspector card={instance} match={match} onClose={noop} />
    </QueryClientProvider>);
    assert(inspector.includes(image), `${name} inspector art`);
    assert(inspector.includes(ability), `${name} inspector ability`);
    assert.equal((inspector.match(/data-testid="card-upgrade-/g) ?? []).length, 3);
    const board = renderBattle({ ...match, boards: [[{ ...instance, lane: 0 }], [], []] });
    assert(board.includes(image), `${name} board art`);
  }
});

test('summoned token cards render with their own art instead of requiring a catalog rarity', () => {
  const steward = {
    id: 'steward', name: 'Steward', type: 'Air', cost: 0, power: 2,
    ability: 'Cabin Service', effect: 'On Reveal: target an enemy for -1 Hand.',
    kind: 'token' as const, abilityUpgrades: [],
  };
  const html = renderToStaticMarkup(<CardView card={steward} presentationOnly />);
  assert.match(html, /data-card-kind="token"/);
  assert.match(html, /data-card-rarity="Mythical"/);
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

test('legacy Cashier movement-lock snapshots remain readable on local and online board cards', () => {
  const card = {
    ...createCardInstance('griddle-master', 'cpu', 'cashier-lock-ui', 1),
    lane: 1 as Lane,
    squabblehouseCannotMoveThroughRound: 2,
  };
  const match = {
    ...createMatch('block', 'combo'),
    round: 2,
    boards: [[], [card], []] as Match['boards'],
    playerHand: [],
  };
  const assertMovementCue = (html: string) => {
    assert.match(html, /data-card-status="movement-locked"/);
    assert.match(html, /title="Movement locked through the end of round 2\."/);
    assert.match(html, /Movement locked through the end of round 2\./);
  };

  assertMovementCue(renderBattle(match));

  const onlineCard = asCard({
    ...card,
    squabblehouseCannotMoveThroughRound: undefined,
    movementLockedThroughRound: 2,
  } as unknown as Parameters<typeof asCard>[0]);
  const onlineMatch = { ...match, boards: [[], [onlineCard], []] as Match['boards'] };
  assertMovementCue(renderBattle(onlineMatch));
  assert.doesNotMatch(renderBattle({ ...onlineMatch, round: 3 }), /data-card-status="movement-locked"/);
});

test('the mounted Janitor marker exposes distinct spent charges locally and in public battle projection', () => {
  const janitor = { ...createCardInstance('janitor', 'player', 'janitor-charge-ui', 0), lane: 0 as Lane };
  const ally = { ...createCardInstance('squabblehouse-security', 'player', 'janitor-charge-ui', 1), lane: 0 as Lane };
  const match: Match = {
    ...createMatch('block', 'slide'),
    boards: [[janitor, ally], [], []],
    janitorReversals: [{
      owner: 'player',
      lane: 0,
      round: 1,
      sourceInstanceId: janitor.instanceId,
      targetInstanceId: ally.instanceId,
      charge: 'harm',
    }],
  };
  const [janitorMark] = getCharacterDistrictMarks(match);
  assert.equal(janitorMark?.text, 'Turn It Around · harm spent · staff ready');
  assert.match(renderBattle(match), /Your Turn It Around · harm spent · staff ready/);

  const rivalMark = { ...janitorMark!, owner: 'cpu' as const };
  const guestHtml = renderBattle(match, {
    online: {
      ...onlinePresentationFor(match),
      districtMarks: [rivalMark],
    },
  });
  assert.match(guestHtml, /Rival Turn It Around · harm spent · staff ready/);
});

test('Buddy keeps plant collectible art and uses rock art for its Squabbled battle instance', () => {
  assert.equal(getCardImage('buddy'), `/assets/characters/buddy.webp?v=${characterRevisions.buddy}`);
  const baseMatch = createMatch('block', 'combo');
  const squabbleBuddy = createCardInstance('buddy', 'player', 'buddy-ui-test', 0);
  const squabbledMatch = playCard({
    ...baseMatch,
    phase: 'player',
    playerMotion: 9,
    playerHand: [squabbleBuddy],
    cpuHand: [],
  }, 'player', squabbleBuddy.instanceId, 1, true);
  const transformed = squabbledMatch.boards.flat().find(card => card.instanceId === squabbleBuddy.instanceId)!;
  assert.equal(transformed.buddyForm, 'squabble-earth');
  const rockHtml = renderToStaticMarkup(<CardView card={transformed} isBoard presentationOnly currentRound={squabbledMatch.round} />);
  assert.ok(rockHtml.includes(`/assets/characters/buddy-squabble.webp?v=${characterRevisions['buddy-squabble']}`));
  assert.match(rockHtml, /data-buddy-form="squabble"/);
  assert.match(rockHtml, /SQUABBLE · EARTH · 2T/);
  const reloadedMatch = JSON.parse(JSON.stringify(squabbledMatch)) as Match;
  const reloadedBuddy = reloadedMatch.boards.flat().find(card => card.instanceId === squabbleBuddy.instanceId)!;
  assert.equal(reloadedBuddy.buddyForm, 'squabble-earth');
  assert.match(renderToStaticMarkup(<CardView card={reloadedBuddy} isBoard presentationOnly currentRound={reloadedMatch.round} />), /buddy-squabble\.webp/);
  const buddyPlayEvent = squabbledMatch.effectLog.find(event => event.cardInstanceId === squabbleBuddy.instanceId && event.type === 'play')!;
  const replayFrame = buildReplayFrame(squabbledMatch, buddyPlayEvent, 'after');
  const replayBuddy = replayFrame.boards.flat().find(card => card.instanceId === squabbleBuddy.instanceId)!;
  assert.equal(replayBuddy.buddyForm, 'squabble-earth');
  assert.match(renderToStaticMarkup(<CardView card={replayBuddy} isBoard presentationOnly currentRound={replayFrame.round} />), /buddy-squabble\.webp/);

  const plantBuddy = createCardInstance('buddy', 'player', 'buddy-ui-test', 1);
  const plantedMatch = playCard({
    ...baseMatch,
    phase: 'player',
    playerMotion: 9,
    playerHand: [plantBuddy],
    cpuHand: [],
  }, 'player', plantBuddy.instanceId, 1);
  const planted = plantedMatch.boards.flat().find(card => card.instanceId === plantBuddy.instanceId)!;
  assert.equal(planted.buddyForm, 'earth');
  const plantHtml = renderToStaticMarkup(<CardView card={planted} isBoard presentationOnly currentRound={plantedMatch.round} />);
  assert.match(plantHtml, /assets\/characters\/buddy\.webp/);
  assert.match(plantHtml, /PLANT · −1 MOTION · \+3 IN 2T/);

  const bud = plantedMatch.boards.flat().find(card => card.buddyBud)!;
  assert.ok(bud, 'normal Buddy On Reveal plants battle-only Bud instances');
  const budHtml = renderToStaticMarkup(<CardView card={bud} isBoard presentationOnly currentRound={plantedMatch.round} />);
  assert.match(budHtml, /BUD PLANTED · 2T · \+3 LAST SUMMON/);
  assert.match(budHtml, /R3/);
  assert.match(budHtml, /last eligible friendly card summoned here/);
  assert.doesNotMatch(budHtml, /Explodes|random enemy here/);
  const budReplayEvent = plantedMatch.effectLog.find(event => event.cardInstanceId === plantBuddy.instanceId && event.type === 'ability' && event.note.includes('Buddy Buds: planted'))!;
  const budReplay = buildReplayFrame(plantedMatch, budReplayEvent, 'after').boards.flat().find(card => card.buddyBud);
  assert.ok(budReplay?.buddyBud, 'replay snapshots retain Buddy Bud form and maturity state');
  assert.match(renderToStaticMarkup(<CardView card={budReplay} isBoard presentationOnly currentRound={plantedMatch.round} />), /BUD PLANTED · 2T · \+3 LAST SUMMON/);
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

test('collection uses its current card copy while battle inspectors preserve frozen card text', () => {
  const authored = catalogCardById['squabblehouse-cashier'];
  const move = authored.abilityUpgrades[0];
  const collectionHtml = renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <CardInspector card={authored} onClose={noop} />
    </QueryClientProvider>,
  );
  assert.match(collectionHtml, new RegExp(move.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.ok(collectionHtml.includes(move.description));
  assert.match(collectionHtml, /Pay Your Tab/);
  assert.ok(collectionHtml.includes(authored.effect));

  // This serialized battle card predates the current Cashier package and must remain frozen.
  const instance = {
    ...createCardInstance('squabblehouse-cashier', 'player', 'authored-move-ui', 1),
    ability: 'Open Tab',
    effect: 'On Reveal: Open Tab here stops the first legal enemy character move/hand return each round until next round ends. Protection/immunity apply. Echoes extend expiry, not stops.',
  };
  const frozenCardFace = renderToStaticMarkup(<CardView card={instance} fillContainer />);
  const battleHtml = renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <CardInspector card={instance} match={createMatch('block', 'combo')} onClose={noop} />
    </QueryClientProvider>,
  );
  assert.match(battleHtml, new RegExp(move.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.ok(battleHtml.includes(move.description));
  assert.match(battleHtml, /Open Tab/);
  assert.match(battleHtml, /first legal enemy character move\/hand return each round until next round ends/);
  assert.match(frozenCardFace, /Open Tab/);
  assert.ok(frozenCardFace.includes(instance.effect));
  assert.doesNotMatch(frozenCardFace, /Pay Your Tab/);
});

test('historical card faces preserve their battle snapshot instead of showing current catalog text', () => {
  const snapshots = [
    {
      id: 'griddle-master',
      // v31 match snapshots used this label/copy; the current catalog now uses Hot Off the Griddle.
      ability: 'Cracked Plate',
      effect: 'On Reveal: Remove the strongest protected enemy character’s Protection here and deal 2 damage. Else, hit the strongest enemy for 2 damage + 1 Burn, or 4 if burning. Immunity/defenses apply.',
      currentAbility: 'Hot Off the Griddle',
    },
    {
      id: 'squabblehouse-cashier',
      // v31 match snapshots used this label/copy; the current catalog now uses Pay Your Tab.
      ability: 'Open Tab',
      effect: 'On Reveal: Open Tab here stops the first legal enemy character move/hand return each round until next round ends. Protection/immunity apply. Echoes extend expiry, not stops.',
      currentAbility: 'Pay Your Tab',
    },
    {
      id: 'janitor',
      ability: 'Turn It Around',
      effect: 'Ongoing: The first hostile Hands reduction or harmful status that would affect a friendly card in this district each round is negated. That card gains +2 Hands instead. Disabled Janitors cannot reverse an attack; duplicate Janitors share one district trigger.',
      currentAbility: 'Turn It Around',
    },
  ] as const;

  for (const [index, snapshot] of snapshots.entries()) {
    const currentCard = catalogCardById[snapshot.id];
    assert.equal(currentCard.ability, snapshot.currentAbility, `${snapshot.id} current catalog name`);
    assert.notEqual(currentCard.effect, snapshot.effect, `${snapshot.id} current and historical effect copy`);
    const instance = {
      ...createCardInstance(snapshot.id, 'player', 'historic-card-ui', index),
      ability: snapshot.ability,
      effect: snapshot.effect,
    };
    const html = renderToStaticMarkup(<CardView card={instance} fillContainer />);
    assert.ok(html.includes(snapshot.ability), `${snapshot.id} keeps its historic ability label`);
    assert.ok(html.includes(snapshot.effect), `${snapshot.id} keeps its historic effect text`);
    if (snapshot.id !== 'janitor') assert.ok(!html.includes(snapshot.currentAbility), `${snapshot.id} does not receive a live catalog label`);
  }
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

test('mythical Triple OGs preview and target only their own side', () => {
  for (const cardId of ['triple-og-blue', 'triple-og-red'] as const) {
    const { match, blue, red } = createTripleOgUiMatch();
    const card = cardId === 'triple-og-blue' ? blue : red;
    const homeLane = cardId === 'triple-og-blue' ? 0 : 2;
    const wrongLanes = ([0, 1, 2] as const).filter(lane => lane !== homeLane);
    const district = homeLane === 0 ? 'left district' : 'right district';

    const noLaneHtml = renderBattle(match, { selectedInstanceId: card.instanceId });
    assert.match(noLaneHtml, new RegExp(`Choose only the ${district}`));
    assert.match(noLaneHtml, new RegExp(`data-testid="preview-lane-${homeLane}"`));
    assert.match(getRenderedLaneButton(noLaneHtml, homeLane), /aria-disabled="false"/);
    for (const lane of wrongLanes) {
      assert.doesNotMatch(noLaneHtml, new RegExp(`data-testid="preview-lane-${lane}"`));
      assert.match(getRenderedLaneButton(noLaneHtml, lane), /aria-disabled="true"/);
      assert.match(getRenderedLaneButton(noLaneHtml, lane), new RegExp(`only the ${district}`));
    }
    assert.match(noLaneHtml, /<button[^>]*data-testid="button-pick-district"[^>]*disabled=""/);

    const legalHtml = renderBattle(match, { selectedInstanceId: card.instanceId, selectedLane: homeLane });
    assert.match(legalHtml, new RegExp(`data-testid="preview-lane-${homeLane}"`));
    assert.match(getRenderedLaneButton(legalHtml, homeLane), /aria-disabled="false"/);
    assert.match(legalHtml, new RegExp(`data-testid="lane-container-${homeLane}"[^>]*is-legal`));
    assert.match(legalHtml, new RegExp(`Play card · ${card.cost} Motion`));
    assert.doesNotMatch(legalHtml, /<button[^>]*data-testid="button-lock"[^>]*disabled=""/);

    for (const lane of wrongLanes) {
      const wrongLaneHtml = renderBattle(match, { selectedInstanceId: card.instanceId, selectedLane: lane });
      assert.doesNotMatch(wrongLaneHtml, new RegExp(`data-testid="preview-lane-${lane}"`));
      assert.match(getRenderedLaneButton(wrongLaneHtml, lane), /aria-disabled="true"/);
      assert.match(wrongLaneHtml, /data-testid="button-lock"/);
      assert.match(wrongLaneHtml, new RegExp(`Only ${district}`));
    }
  }
});

test('mythical Triple OGs bypass locks only in their home district; ordinary cards remain blocked', () => {
  for (const cardId of ['triple-og-blue', 'triple-og-red'] as const) {
    const match = createTripleOgUiMatch().match;
    match.storyEncounter = getStoryBattle('receipts-on-camera')!.encounter;
    const card = createCardInstance(cardId, 'player', 'locked-triple-og-ui', cardId === 'triple-og-blue' ? 0 : 1);
    match.playerHand = [card];
    match.playerMotion = 10;
    const homeLane = cardId === 'triple-og-blue' ? 0 : 2;
    const wrongLanes = ([0, 1, 2] as const).filter(lane => lane !== homeLane);
    const lockedLanes: Lane[] = [homeLane, wrongLanes[0]];
    const district = homeLane === 0 ? 'left district' : 'right district';
    match.storyRuntime = {
      ...match.storyRuntime!,
      laneLocks: [{ owner: 'player', lanes: lockedLanes }],
    };
    const html = renderBattle(match, { selectedInstanceId: card.instanceId });
    assert.match(html, new RegExp(`Choose only the ${district}`));
    assert.match(html, new RegExp(`data-testid="preview-lane-${homeLane}"`));
    assert.match(html, new RegExp(`data-testid="lane-container-${homeLane}"[^>]*is-legal[^>]*is-locked`));
    assert.match(getRenderedLaneButton(html, homeLane), /aria-disabled="false"/);
    assert.match(getRenderedLaneButton(html, homeLane), /Deploy/);
    for (const lane of wrongLanes) {
      assert.match(getRenderedLaneButton(html, lane), /aria-disabled="true"/);
      assert.match(getRenderedLaneButton(html, lane), new RegExp(`only the ${district}`));
    }
  }

  const match = createMatch('block', 'combo');
  const normalCard = createCardInstance('buddy', 'player', 'normal-card-ui', 0);
  match.playerHand = [normalCard];
  match.playerMotion = 10;
  const html = renderBattle(match, { selectedInstanceId: normalCard.instanceId, online: onlinePresentationFor(match, [1]) });
  assert.match(getRenderedLaneButton(html, 0), /aria-disabled="false"/);
  assert.match(getRenderedLaneButton(html, 1), /aria-disabled="true"/);
  assert.match(getRenderedLaneButton(html, 1), /district is locked this round/);
  assert.match(getRenderedLaneButton(html, 2), /aria-disabled="false"/);
});

test('a mythical Triple OG keeps its projected ability preview in a locked district', () => {
  const match = createTripleOgUiMatch().match;
  match.storyEncounter = getStoryBattle('receipts-on-camera')!.encounter;
  match.round = 2;
  const blue = createCardInstance('triple-og-blue', 'player', 'locked-og-preview', 0);
  match.playerHand = [blue];
  match.playerMotion = 10;
  const homeLane: Lane = 0;
  match.storyRuntime = {
    ...match.storyRuntime!,
    laneLocks: [{ owner: 'player', lanes: [homeLane] }],
  };

  const html = renderBattle(match, {
    deck: decks[0],
    rivalDeck: decks[1],
    selectedInstanceId: blue.instanceId,
    selectedLane: homeLane,
  });
  assert.match(html, new RegExp(`data-testid="lane-container-${homeLane}"[^>]*is-legal[^>]*is-locked`));
  assert.match(getRenderedLaneButton(html, homeLane), /aria-disabled="false"/);
  assert.match(html, new RegExp(`data-testid="preview-lane-${homeLane}"`));
  assert.match(html, /Play card · \d+ Motion/);
});

test('both mythical Triple OGs have no Corrupt Church home surcharge at their printed Motion', () => {
  for (const cardId of ['triple-og-blue', 'triple-og-red'] as const) {
    const homeLane = cardId === 'triple-og-blue' ? 0 : 2;
    const locations = ['time-square', 'county-jail', 'magic-city'];
    locations[homeLane] = 'corrupt-church';
    const match = createMatch('block', 'combo', undefined, undefined, districtSnapshotFor(locations));
    const card = createCardInstance(cardId, 'player', 'triple-og-church-cost', homeLane);
    match.playerHand = [card];
    match.playerMotion = card.cost;
    const html = renderBattle(match, { selectedInstanceId: card.instanceId, selectedLane: homeLane });

    assert.match(html, new RegExp(`data-testid="preview-lane-${homeLane}"`));
    assert.match(html, new RegExp(`Play card · ${card.cost} Motion`));
    assert.match(html, new RegExp(`data-testid="lane-container-${homeLane}"[^>]*is-legal`));
    assert.match(getRenderedLaneButton(html, homeLane), /aria-disabled="false"/);
    assert.doesNotMatch(html, new RegExp(`Need ${card.cost + 1} Motion|costs ${card.cost + 1} Motion`));
  }
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
  assert.match(results, /battle outcome artwork/i);
  assert.match(results, /Final district scores/);
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
        kind: token.kind, type: token.type, hazard: !!token.hazard,
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
    // Dead Air takes an empty district before attempting to Silence a target.
    // Fill the other districts so this fixture exercises its targeting branch.
    const blockers = [1, 2].map(lane => ({ ...createCardInstance('cornball', 'player', 'occupied', lane), lane: lane as 1 | 2 }));
    const match = playCard({ ...summoned, boards: [tokens, [blockers[0]], [blockers[1]]],
      phase: owner === 'player' ? 'player' : 'cpu-reveal',
      playerHand: owner === 'player' ? [played] : [], cpuHand: owner === 'cpu' ? [played] : [],
      playerMotion: 9, cpuMotion: 9,
    }, owner, played.instanceId, 0);
    assert.doesNotThrow(() => renderBattle(match));
    if (id === 'scammer') {
      const copy = match.boards[0].find(c => c.cardId === id)!;
      assert.equal(copy.ability, played.ability);
      assert.equal(copy.copiedAbilityCardId, undefined);
      assert.equal(copy.basePower, tokens[0].basePower);
      assert.equal(copy.powerModifier, 1);
    }
    if (id === 'gothkid') assert.equal(match.boards[0].filter(c => c.kind === 'token' && c.statuses.silenced).length, 1);
    if (id === 'failedrapper') { assert.ok(match.boards[0].filter(c => c.kind === 'token').every(c => c.powerModifier === 0)); assert.ok(match.creativeMarks?.some(x=>x.kind==='verse')); }
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

// Both seats reuse the solo board with server costs/scores, never a reconstructed rival hand.
test('online projection flips guest perspective and preserves authoritative costs, scores and public history', async () => {
  const { onlineBattleProjection } = await import('./MultiplayerBattle');
  const { createOnlineRoom, joinOnlineRoom, applyOnlineCommand, onlineRoomView } = await import('@workspace/squabblemon-engine/multiplayer');
  const member = (id: string, deck = decks[0]) => ({ userId: id, name: id, ready: false, deck });
  let room = createOnlineRoom(member('a'), 'cpu', Date.now());
  room = joinOnlineRoom(room, member('b', decks[1]), Date.now());
  room = applyOnlineCommand(room, 'player', { type: 'ready' }, Date.now());
  room = applyOnlineCommand(room, 'cpu', { type: 'ready' }, Date.now());
  const view = onlineRoomView(room, 'AABBCCDDEEFF', 'b', Date.now());
  view.scores = view.scores.map((score, i) => ({ ...score, player: 90 + i, cpu: 120 + i, winner: 'cpu' }));
  view.hand[0].costs = [0, 7, 8];
  const { match, presentation } = onlineBattleProjection(view);
  assert.deepEqual(match.cpuHand, []); assert.deepEqual(match.cpuCardIds, []);
  assert(match.playerHand.every(card => card.owner === 'player'));
  assert.equal(match.playerHand[0].instanceId, view.hand[0].instanceId);
  assert.equal(presentation.scores[0].player, 120); assert.equal(presentation.scores[0].cpu, 90);
  assert.equal(presentation.scores[0].winner, 'player');
  assert.deepEqual(presentation.costs[view.hand[0].instanceId], [0, 7, 8]);
  const html = renderBattle(match, { deck: view.ownDeck, rivalDeck: { hero: 'hooper', name: 'Human rival' },
    selectedInstanceId: view.hand[0].instanceId, selectedLane: 0,
    online: { ...presentation, status: 'Your turn', clockRunning: true, yourTurn: true },
    presentationScores: presentation.scores, timerEnabled: true, timerSeconds: 75,
  });
  assert.match(html, /battlefield-grid/); assert.match(html, /battle-hand-tray/);
  assert.match(html, /Play card · 0 Motion/); assert.match(html, /aria-valuemax="75"/);
  assert.doesNotMatch(html, /data-testid="preview-lane/); assert.doesNotMatch(html, /online-arena/);
});

test('online Buddy cards and Buds survive both-seat room reconnect projection', async () => {
  const { onlineBattleProjection } = await import('./MultiplayerBattle');
  const { createOnlineRoom, joinOnlineRoom, applyOnlineCommand, onlineRoomView } = await import('@workspace/squabblemon-engine/multiplayer');
  const member = (id: string, deck = decks[0]) => ({ userId: id, name: id, ready: false, deck });
  let room = createOnlineRoom(member('buddy-host'), 'cpu', Date.now());
  room = joinOnlineRoom(room, member('buddy-guest', decks[1]), Date.now());
  room = applyOnlineCommand(room, 'player', { type: 'ready' }, Date.now());
  room = applyOnlineCommand(room, 'cpu', { type: 'ready' }, Date.now());

  const plantBuddy = createCardInstance('buddy', 'player', 'online-buddy', 0);
  const rockBuddy = createCardInstance('buddy', 'cpu', 'online-buddy', 1);
  let plantMatch: Match = {
    ...createMatch('block', 'slide'),
    phase: 'player',
    playerMotion: 9,
    playerHand: [plantBuddy],
  };
  plantMatch = playCard(plantMatch, 'player', plantBuddy.instanceId, 0);
  const rockMatch = playCard({
    ...createMatch('block', 'slide'),
    phase: 'cpu-reveal',
    cpuMotion: 9,
    cpuHand: [rockBuddy],
    squabbleByOwner: { player: false, cpu: false },
  }, 'cpu', rockBuddy.instanceId, 2, true);
  const engineMatch: Match = {
    ...plantMatch,
    boards: plantMatch.boards.map((cardsInLane, lane) => [...cardsInLane, ...rockMatch.boards[lane]]) as Match['boards'],
  };
  room = { ...room, match: engineMatch };

  for (const [userId, seat] of [['buddy-host', 'player'], ['buddy-guest', 'cpu']] as const) {
    const roomView = onlineRoomView(room, 'BUDDY1234567', userId, Date.now());
    const publicCards = roomView.boards.flat();
    assert.equal(publicCards.find(card => card.instanceId === plantBuddy.instanceId)?.buddyForm, 'earth');
    assert.equal(publicCards.find(card => card.instanceId === plantBuddy.instanceId)?.buddyGrowthAtRound, 3);
    assert.equal(publicCards.find(card => card.instanceId === rockBuddy.instanceId)?.buddyForm, 'squabble-earth');
    assert.equal(publicCards.find(card => card.instanceId === rockBuddy.instanceId)?.buddyEarthExpiresAtRound, 3);
    assert.ok(publicCards.some(card => card.buddyBud?.sproutsAtRound === 3));
    // JSON round-tripping mirrors the room payload received after a reconnect.
    const reconnectView = JSON.parse(JSON.stringify(roomView));
    const projected = onlineBattleProjection(reconnectView);
    const buddyCards = projected.match.boards.flat().filter(card => card.cardId === 'buddy');
    const projectedPlant = buddyCards.find(card => card.instanceId === plantBuddy.instanceId)!;
    const projectedRock = buddyCards.find(card => card.instanceId === rockBuddy.instanceId)!;
    assert.equal(projectedPlant.owner, seat === 'player' ? 'player' : 'cpu');
    assert.equal(projectedPlant.buddyForm, 'earth');
    assert.equal(projectedRock.owner, seat === 'player' ? 'cpu' : 'player');
    assert.equal(projectedRock.buddyForm, 'squabble-earth');
    const buds = projected.match.boards.flat().filter(card => card.cardId === 'buddy-bud');
    assert.ok(buds.length > 0);
    assert.ok(buds.every(card => card.buddyBud?.sproutsAtRound === 3));

    const html = renderToStaticMarkup(<>{projected.match.boards.flat().map(card =>
      <CardView key={card.instanceId} card={card} isBoard presentationOnly currentRound={projected.match.round} />)}</>);
    assert.match(html, /data-buddy-form="squabble"/);
    assert.match(html, /SQUABBLE · EARTH · 2T/);
    assert.match(html, /BUD PLANTED · 2T · \+3 LAST SUMMON/);
    assert.match(html, /buddy-squabble\.webp\?v=/);
    assert.match(html, /data-card-id="buddy-bud"/);
    assert.doesNotMatch(html, /Explodes|random enemy here/);
  }
});

test('older Shiesty clone snapshots still resolve the revisioned character portrait', () => {
  assert.equal(getCardImage('shiesty'), getCardImage(cards.shiesty.id));
  assert.match(getCardImage('shiesty'), /shiesty-yn\.webp\?v=/);
});

test('guided reading cue renders a stable panel with continue and hides skip controls', () => {
  const match = createMatch('block', 'combo');
  const body = 'Rival Plug drained Motion. '.repeat(40);
  const html = renderBattle(match, {
    presentationPhase: 'round-result', phaseMessage: 'ROUND 1 RESULT',
    guidedReadingCue: { kind: 'round', title: 'Round one settled', body, continueLabel: 'Continue to round two' },
    onContinueGuidedReading: noop,
  });
  assert.match(html, /data-testid="guided-reading-cue"/);
  assert.match(openingButton(html, 'button-continue-guided-reading'), /Continue|type="button"/);
  assert.doesNotMatch(openingButton(html, 'button-continue-guided-reading'), /disabled/);
  assert.match(html, /Continue to round two/);
  assert.doesNotMatch(html, /data-testid="battle-guidance"/);
  assert.match(html, /data-testid="battle-phase-status"/);
  assert.match(html, /data-reading-cue="round"/);
  assert.doesNotMatch(html, /data-testid="button-fast-forward"/);
  assert.doesNotMatch(html, /aria-label="Continue past/);
  assert.match(html, /data-testid="button-battle-history"/);
  const without = renderBattle(match, { presentationPhase: 'round-result', phaseMessage: 'ROUND 1 RESULT' });
  assert.doesNotMatch(without, /guided-reading-cue/);
  assert.match(without, /data-testid="button-fast-forward"/);
});

test('phase status names the actual presentation phase in plain language', () => {
  const match = createMatch('block', 'combo');
  const status = (props: Record<string, unknown>) => renderBattle(match, props).match(/data-testid="battle-phase-status" data-phase-status="([^"]+)"/)?.[1];
  assert.equal(status({ presentationPhase: 'player-ready' }), 'your-turn');
  assert.equal(status({ presentationPhase: 'rival-reveal' }), 'rival-reveal');
  assert.equal(status({ presentationPhase: 'round-result' }), 'round-result');
  assert.equal(status({ presentationPhase: 'match-finish' }), 'match-complete');
  const card = match.cpuHand[0]!;
  const effect = { sequence: 5, kind: 'normal', type: 'ability', cardInstanceId: card.instanceId, cardId: card.cardId, owner: 'cpu', lane: 0, targetIds: [], targets: [], note: 'x', source: null, round: 1, scores: { before: [], after: [] } };
  const html = renderBattle(match, { presentationPhase: 'effects', activeEffect: effect });
  assert.match(html, /data-phase-status="effects"/);
  assert.match(html, /Effects resolve<\/b><span>Rival /);
});

test('reviewing the final board suppresses the finish cinematic but keeps a compact status', () => {
  const match = createMatch('block', 'combo');
  const cinematic = renderBattle(match, { presentationPhase: 'match-finish', phaseMessage: 'FINAL DISTRICTS' });
  assert.match(cinematic, /broadcast-overlay/);
  const review = renderBattle(match, { presentationPhase: 'match-finish', phaseMessage: 'FINAL DISTRICTS', reviewingFinalBoard: true });
  assert.doesNotMatch(review, /broadcast-overlay/);
  assert.match(review, /data-testid="final-board-review"/);
  assert.doesNotMatch(review, /data-testid="button-fast-forward"/);
  assert.match(review, /battle-guidance-message">[^]*data-testid="final-board-review"/);
  assert.match(review, /data-phase-status="match-complete"/);
  assert.match(review, /data-testid="button-resolving"[^>]*>(?:<[^>]*>)*Match complete/);
  assert.doesNotMatch(review, /Resolving\.\.\./);
});

test('mechanic lesson portrait is boxed separately from its text', () => {
  const html = renderBattle(createMatch('block', 'combo'), { presentationPhase: 'effects', mechanicLesson: MECHANIC_LESSONS.burn, onDismissMechanicLesson: noop });
  assert.match(html, /mechanic-lesson-card/);
  assert.match(html, /class="mechanic-lesson-portrait"[^>]*><img class="dr-fade-referee"/);
  assert.match(html, /mechanic-lesson-copy/);
});

test('PvE battles offer a 1.5x speed pill that scales presentation beats but not reading or the clock', async () => {
  const { scaleBattleBeat, normalizeBattleSpeed, FAST_BATTLE_SPEED } = await import('../battleSpeed');
  const { broadcastDelay } = await import('../broadcastPresentation');
  const { guidedNoteDuration } = await import('../lib/playerControlledPresentation');
  assert.equal(normalizeBattleSpeed('1.5'), FAST_BATTLE_SPEED);
  assert.equal(normalizeBattleSpeed(null), 1);
  assert.equal(normalizeBattleSpeed('2'), 1);
  assert.equal(scaleBattleBeat(900, 1), 900);
  assert.equal(scaleBattleBeat(900, FAST_BATTLE_SPEED), 600);
  assert.equal(scaleBattleBeat(0, FAST_BATTLE_SPEED), 0);
  // A skipped beat stays instant and reduced-motion beats stay proportional.
  assert.equal(scaleBattleBeat(broadcastDelay(1100, 90, false, true), FAST_BATTLE_SPEED), 0);
  assert.equal(scaleBattleBeat(broadcastDelay(1100, 90, true), FAST_BATTLE_SPEED), 60);
  // Guided reading holds are measured from the note, never from the speed choice.
  const note = 'Dr. Fade explains the freeze in enough words to need real reading time.';
  assert.equal(guidedNoteDuration(note, 450), guidedNoteDuration(note, scaleBattleBeat(450, FAST_BATTLE_SPEED)));

  const match = createMatch('block', 'combo');
  const normal = renderBattle(match, { presentationPhase: 'effects', onToggleBattleSpeed: noop });
  assert.match(normal, /data-testid="button-battle-speed"/);
  assert.match(normal, /data-battle-speed="normal"/);
  assert.match(normal, /--presentation-speed:1/);
  const fast = renderBattle(match, { presentationPhase: 'effects', onToggleBattleSpeed: noop, battleSpeed: 1.5 });
  assert.match(fast, /data-battle-speed="fast"/);
  assert.match(fast, /--presentation-speed:1\.5/);
  assert.match(fast, /data-testid="button-battle-speed"[^>]*aria-pressed="true"/);
  // The pill sits in the same control row as skip.
  assert.match(fast, /data-testid="button-fast-forward"[^]*?data-testid="button-battle-speed"/);
});

test('PvP battles never show the speed pill and keep normal presentation timing', () => {
  const match = createMatch('block', 'combo');
  const online = renderBattle(match, {
    presentationPhase: 'effects', onToggleBattleSpeed: noop, battleSpeed: 1.5,
    online: { mode: 'ranked', status: 'Rival turn', costs: {}, districts: getMatchDistricts(match), districtMarks: [], scores: null, rivalHandCount: 4 },
  });
  assert.doesNotMatch(online, /data-testid="button-battle-speed"/);
  assert.match(online, /data-battle-speed="normal"/);
  assert.match(online, /--presentation-speed:1[;"]/);
});
