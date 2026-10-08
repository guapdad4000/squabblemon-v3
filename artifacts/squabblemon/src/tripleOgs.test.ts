import assert from 'node:assert/strict';
import test from 'node:test';
import { cards, cardCatalog, catalogCardById, validateCardAbilityUpgrades } from './data';
import { DISTRICT_CATALOG, createDistrictSnapshot, type DistrictSnapshot } from '../../../lib/squabblemon-engine/src/districts';
import { isMythicalTripleOg, TRIPLE_OG_LANE } from '../../../lib/squabblemon-engine/src/tripleOgs';
import { STREET_PACK_RARITY_WEIGHTS } from '../../../lib/squabblemon-engine/src/packRules';
import { canAffordSelection, createMatch, createCardInstance, playTurnCard, getEffectiveCardPower, getCharacterDistrictMarks,
  getCardCostExplanation, getDistrictResults, getLegalCardCost,
  type Match, type Owner, type Lane, type CardInstance } from './gameEngine';

const blank = (): Match => ({ ...createMatch('block', 'block'), round: 3, playerMotion: 9, cpuMotion: 9,
  boards: [[], [], []], playerHand: [], cpuHand: [] });
const unit = (id: string, owner: Owner, lane: Lane, index = 0): CardInstance => ({
  ...createCardInstance(id, owner, 'test', index), lane,
});
const find = (m: Match, id: string) => m.boards.flat().find(c => c.cardId === id)!;

function cast(m: Match, id: string, lane: Lane, owner: Owner = 'player') {
  const source = createCardInstance(id, owner, 'cast', m.round * 10 + lane);
  return playTurnCard({ ...m, phase: owner === 'player' ? 'player' : 'cpu-reveal',
    [owner === 'player' ? 'playerHand' : 'cpuHand']: [source] }, owner, source.instanceId, lane);
}

test('the Triple OG set ships as a complete, pullable catalog wave', () => {
  assert.deepEqual(TRIPLE_OG_LANE, { 'triple-og-blue': 0, 'triple-og-red': 2 });
  assert.equal(isMythicalTripleOg('triple-og-blue'), true);
  assert.equal(isMythicalTripleOg('triple-og-red'), true);
  assert.equal(isMythicalTripleOg('blueside1'), false);
  assert.equal(isMythicalTripleOg('redside2'), false);
  validateCardAbilityUpgrades();
  const expected: Record<string, [string, string, number, number]> = {
    'triple-og-blue': ['CLUE COOKY', 'Mythical', 4, 6],
    'triple-og-red': ['RED PUNCH', 'Mythical', 4, 3],
    initiation: ['INITIATION', 'Legendary', 1, 0],
    'block-spinner': ['BLOCK SPINNER', 'Epic', 1, 2],
    'look-out': ['LOOK OUT', 'Epic', 1, 2],
  };
  for (const [id, [name, rarity, cost, power]] of Object.entries(expected)) {
    const card = catalogCardById[id];
    assert.equal(card.name, name, id);
    assert.equal(card.rarity, rarity, id);
    assert.deepEqual([card.cost, card.power], [cost, power], id);
    assert.equal(card.faction, 'Triple OGs', id);
    assert.equal(card.artworkId, id);
    assert.equal(card.abilityUpgrades.length, 3, id);
    // Regular gacha: nothing in this set is locked behind story rewards.
    assert(card.acquisitionSources.includes('Street Packs'), `${id} must stay pullable`);
    assert(STREET_PACK_RARITY_WEIGHTS[card.rarity] > 0, `${id} rarity must be pullable`);
  }
  assert.equal(cardCatalog.filter(card => card.faction === 'Triple OGs').length, 5);
});

test('mythical Triple OGs remain on their assigned board sides', () => {
  const m = blank();
  for (const [id, homeLane, otherLanes, side] of [
    ['triple-og-blue', 0, [1, 2], 'left'],
    ['triple-og-red', 2, [0, 1], 'right'],
  ] as const) {
    assert.equal(find(cast(m, id, homeLane), id).lane, homeLane);
    for (const lane of otherLanes as readonly Lane[]) {
      const source = createCardInstance(id, 'player', 'side-test', lane);
      const candidate = { ...m, playerHand: [source] };
      assert.equal(canAffordSelection(candidate, 'player', source.instanceId, lane), false);
      assert.throws(() => playTurnCard(candidate, 'player', source.instanceId, lane), new RegExp(`${side} district`));
    }
  }
});

test('home-side Triple OG reveals resolve in story-scheduled, runtime-locked, and closed districts', () => {
  const snapshot = createDistrictSnapshot('triple-og-locks');
  const location = (id: string) => DISTRICT_CATALOG.find(district => district.id === id)!;
  const runtime = () => ({
    plays: { player: [0, 0, 0] as [number, number, number], cpu: [0, 0, 0] as [number, number, number] },
    roundPlays: { player: [0, 0, 0] as [number, number, number], cpu: [0, 0, 0] as [number, number, number] },
    trailing: { player: [false, false, false] as [boolean, boolean, boolean], cpu: [false, false, false] as [boolean, boolean, boolean] },
    trappedCardIds: [], detainedCardIds: [],
  });
  for (const [id, homeLane] of [['triple-og-blue', 0], ['triple-og-red', 2]] as const) {
    for (const lockKind of ['scheduled', 'runtime', 'close-lane'] as const) {
      const source = createCardInstance(id, 'player', `locked-${lockKind}`, homeLane);
      const boards: Match['boards'] = [[], [], []];
      if (id === 'triple-og-blue') {
        boards[homeLane] = [unit('hooper', 'player', homeLane, 40), { ...unit('oink', 'cpu', homeLane, 41), powerModifier: 20 }];
      } else {
        boards[homeLane] = [unit('hooper', 'cpu', homeLane, 42)];
      }
      let match: Match = { ...blank(), round: 4, playerMotion: 4, boards, playerHand: [source] };
      if (lockKind === 'scheduled') match.storyEncounter = {
        id: 'scheduled-lane-lock',
        enemy: { id: 'test', name: 'Test', portraitAssetId: 'test', deckId: 'block', cardIds: [], behaviorProfile: 'balanced' },
        battlefieldAssetId: 'test', soundHooks: {},
        modifiers: { laneLocks: [{ round: 4, owner: 'player', lanes: [homeLane] }] },
      };
      if (lockKind === 'runtime') match.storyRuntime = { activePhaseIndex: 0, appliedEffectIds: [],
        lanePowerBonuses: [], laneLocks: [{ owner: 'player', lanes: [homeLane] }] };
      if (lockKind === 'close-lane') {
        const ids = homeLane === 0 ? ['construction-site', 'bodega', 'vip-section'] : ['bodega', 'vip-section', 'construction-site'];
        match = { ...match, districtSnapshot: { ...snapshot, locations: ids.map(location) as unknown as typeof snapshot.locations },
          districtRuntime: runtime() };
      }
      assert(canAffordSelection(match, 'player', source.instanceId, homeLane), `${id} may enter its ${lockKind}-locked home`);
      const after = playTurnCard(match, 'player', source.instanceId, homeLane);
      assert.equal(find(after, id).lane, homeLane);
      if (id === 'triple-og-blue') {
        assert.equal(getEffectiveCardPower(find(after, 'triple-og-blue')), 7,
          `CLUE COOKY still receives homage in its ${lockKind}-locked home`);
        assert.equal(getEffectiveCardPower(after.boards[homeLane].find(card => card.cardId === 'hooper')!), 4);
      } else {
        assert.equal(getEffectiveCardPower(find(after, 'triple-og-red')), 4,
          `RED PUNCH still gains for its reveal in its ${lockKind}-locked home`);
        assert.equal(getEffectiveCardPower(after.boards[homeLane].find(card => card.cardId === 'hooper')!), cards.hooper.power - 1);
      }
      const ordinary = createCardInstance('hooper', 'player', 'ordinary-locked', 0);
      const blocked = { ...match, playerHand: [ordinary] };
      assert.equal(canAffordSelection(blocked, 'player', ordinary.instanceId, homeLane), false);
      assert.throws(() => playTurnCard(blocked, 'player', ordinary.instanceId, homeLane), /locked/);
    }
  }

  for (const [id, homeLane, wrongLane, side] of [
    ['triple-og-blue', 0, 2, 'left'],
    ['triple-og-red', 2, 0, 'right'],
  ] as const) {
    const wrong = createCardInstance(id, 'player', 'wrong-side', 0);
    const candidate = { ...blank(), playerHand: [wrong] };
    assert.equal(canAffordSelection(candidate, 'player', wrong.instanceId, wrongLane), false);
    assert.throws(() => playTurnCard(candidate, 'player', wrong.instanceId, wrongLane), new RegExp(`${side} district`));
  }

  const marked = cast(blank(), 'initiation', 0);
  const lockedMark: Match = { ...marked, storyRuntime: { activePhaseIndex: 0, appliedEffectIds: [],
    lanePowerBonuses: [], laneLocks: [{ owner: 'player', lanes: [0] }] } };
  const entrant = createCardInstance('triple-og-blue', 'player', 'locked-mark', 1);
  const initiated = playTurnCard({ ...lockedMark, playerHand: [entrant] }, 'player', entrant.instanceId, 0);
  assert.equal(getEffectiveCardPower(find(initiated, entrant.cardId)), 8,
    'a legal home-lane OG entering a locked district still consumes INITIATION');
  assert(!getCharacterDistrictMarks(initiated).some(mark => mark.lane === 0 && /Marked Territory/.test(mark.text)));
});

test('home-side OGs waive only Corrupt Church Motion while preserving other cost rules', () => {
  const location = (id: string) => DISTRICT_CATALOG.find(district => district.id === id)!;
  const districtRuntime = () => ({
    plays: { player: [0, 0, 0] as [number, number, number], cpu: [0, 0, 0] as [number, number, number] },
    roundPlays: { player: [0, 0, 0] as [number, number, number], cpu: [0, 0, 0] as [number, number, number] },
    trailing: { player: [false, false, false] as [boolean, boolean, boolean], cpu: [false, false, false] as [boolean, boolean, boolean] },
    trappedCardIds: [], detainedCardIds: [],
  });
  const build = (cardId: string, homeEffect: string) => {
    const homeLane = TRIPLE_OG_LANE[cardId];
    const ids = ['bodega', 'vip-section', 'corrupt-church', 'dive-bar']
      .filter(id => id !== homeEffect).slice(0, 2);
    ids.splice(homeLane, 0, homeEffect);
    const source = createCardInstance(cardId, 'player', `cost-${homeEffect}`, 0);
    return {
      source,
      match: {
        ...blank(), round: 4, playerMotion: 4, playerHand: [source],
        districtSnapshot: { ...createDistrictSnapshot(`og-cost-${cardId}-${homeEffect}`),
          locations: ids.map(location) as unknown as DistrictSnapshot['locations'] },
        districtRuntime: districtRuntime(),
      } as Match,
    };
  };
  for (const [cardId, homeLane] of [['triple-og-blue', 0], ['triple-og-red', 2]] as const) {
    const { source, match } = build(cardId, 'corrupt-church');
    match.storyRuntime = { activePhaseIndex: 0, appliedEffectIds: [], lanePowerBonuses: [],
      laneLocks: [{ owner: 'player', lanes: [homeLane] }] };
    assert.equal(getLegalCardCost(match, 'player', source, homeLane), cards[cardId].cost);
    const explanation = getCardCostExplanation(match, 'player', source, homeLane);
    assert.match(explanation, /Corrupt Church tithe ignored for home-side Triple OG/);
    assert.doesNotMatch(explanation, /\+1 Corrupt Church tithe/);
    assert(canAffordSelection(match, 'player', source.instanceId, homeLane),
      'home lane ignores its lock and location tithe at the printed Motion cost');
    const after = playTurnCard(match, 'player', source.instanceId, homeLane);
    assert.equal(after.playerMotion, 4 - cards[cardId].cost, 'the home-side OG pays its printed Motion');

    const unlocked = { ...match, storyRuntime: undefined };
    for (const regularId of ['hooper', 'blueside1', 'redside2']) {
      const regular = createCardInstance(regularId, 'player', 'church-tax', 1);
      assert.equal(getLegalCardCost(unlocked, 'player', regular, homeLane), cards[regularId].cost + 1,
        `${regularId} still pays Corrupt Church`);
    }
  }

  const { source, match } = build('triple-og-blue', 'corrupt-church');
  const landlord = unit('landlord', 'cpu', 0, 90);
  const dmv = createCardInstance('dmvworker', 'cpu', 'card-origin-tax', 91);
  const taxed: Match = {
    ...match,
    playerMotion: 6,
    boards: [[landlord], [], []],
    districtTraps: [{ kind: 'dmv', owner: 'cpu', lane: 0, source: dmv, expiresAfterRound: 5 }],
    storyRuntime: { activePhaseIndex: 0, appliedEffectIds: [], lanePowerBonuses: [],
      laneLocks: [{ owner: 'player', lanes: [0] }] },
  };
  assert.equal(getLegalCardCost(taxed, 'player', source, 0), 6,
    'Rent Due and Take a Number remain even when the location tithe is waived');
  assert.match(getCardCostExplanation(taxed, 'player', source, 0), /\+1 Rent Due tax/);
  assert.match(getCardCostExplanation(taxed, 'player', source, 0), /\+1 Take a Number/);
  const taxedPlay = playTurnCard(taxed, 'player', source.instanceId, 0);
  assert.equal(taxedPlay.playerMotion, 0);

  for (const [effectId, extra] of [['bodega', 1], ['dive-bar', 1]] as const) {
    const { source: discounted, match: discountMatch } = build('triple-og-blue', effectId);
    assert.equal(getLegalCardCost(discountMatch, 'player', discounted, 0), discounted.cost - extra,
      `${effectId} continues to discount the home-side OG`);
    discountMatch.playerMotion = discounted.cost - extra;
    discountMatch.storyRuntime = { activePhaseIndex: 0, appliedEffectIds: [], lanePowerBonuses: [],
      laneLocks: [{ owner: 'player', lanes: [0] }] };
    assert(canAffordSelection(discountMatch, 'player', discounted.instanceId, 0),
      `${effectId} discount still helps a locked-home OG afford its play`);
  }
  const { source: buddyDiscounted, match: buddyMatch } = build('triple-og-blue', 'vip-section');
  buddyMatch.boards[0] = [unit('buddy', 'player', 0, 92)];
  assert.equal(getLegalCardCost(buddyMatch, 'player', buddyDiscounted, 0), buddyDiscounted.cost - 1,
    'BUDDY’s card-origin discount remains');
  buddyMatch.playerMotion = buddyDiscounted.cost - 1;
  buddyMatch.storyRuntime = { activePhaseIndex: 0, appliedEffectIds: [], lanePowerBonuses: [],
    laneLocks: [{ owner: 'player', lanes: [0] }] };
  assert(canAffordSelection(buddyMatch, 'player', buddyDiscounted.instanceId, 0));
  const { source: plugDiscounted, match: plugMatch } = build('triple-og-blue', 'vip-section');
  plugMatch.plugDiscountLane.player = 1;
  assert.equal(getLegalCardCost(plugMatch, 'player', plugDiscounted, 0), plugDiscounted.cost - 1,
    'PLUG’s card-origin discount remains');
  plugMatch.playerMotion = plugDiscounted.cost - 1;
  plugMatch.storyRuntime = { activePhaseIndex: 0, appliedEffectIds: [], lanePowerBonuses: [],
    laneLocks: [{ owner: 'player', lanes: [0] }] };
  assert(canAffordSelection(plugMatch, 'player', plugDiscounted.instanceId, 0));
});

test('CLUE COOKY collects homage only while losing, and never loses Hands', () => {
  const held = blank();
  held.boards[0] = [unit('hooper', 'player', 0, 1)];
  held.boards[1] = [unit('hooper', 'player', 1, 2)];
  const notLosing = cast(held, 'triple-og-blue', 0);
  assert.equal(getEffectiveCardPower(find(notLosing, 'triple-og-blue')), 6, 'no homage is owed when the district is held');
  assert.equal(getEffectiveCardPower(notLosing.boards[1][0]), 5);

  const losing = blank();
  losing.boards[0] = [unit('hooper', 'player', 0, 1), unit('oink', 'cpu', 0, 2), unit('snow', 'cpu', 0, 3)];
  losing.boards[1] = [unit('hooper', 'player', 1, 4)];
  losing.boards[0][1].powerModifier = 20;
  const paid = cast(losing, 'triple-og-blue', 0);
  const cooky = find(paid, 'triple-og-blue');
  assert.equal(getEffectiveCardPower(cooky), 8, 'both allies paid 1 Hand each');
  assert.equal(getEffectiveCardPower(paid.boards.flat().find(c => c.owner === 'player' && c.cardId === 'hooper' && c.lane === 1)!), 4);
  // The weakest enemy is pushed into the district the player is strongest in, with -1 Hand.
  const pushed = paid.boards.flat().find(c => c.cardId === 'snow')!;
  assert.notEqual(pushed.lane, 0);
  assert.equal(getEffectiveCardPower(pushed), 1, 'the weakest enemy left with -1 Hand');

  const hit = { ...paid, boards: paid.boards.map(l => [...l]) as Match['boards'] };
  const after = cast(hit, 'roaster', 0, 'cpu');
  assert.equal(getEffectiveCardPower(find(after, 'triple-og-blue')), 8, 'CLUE COOKY cannot lose Hands');
});

test('RED PUNCH taxes his own district and moves anyone he cannot touch', () => {
  const m = blank();
  m.boards[2] = [unit('hooper', 'player', 2, 1), unit('oink', 'cpu', 2, 2), unit('cornball', 'cpu', 2, 3)];
  m.boards[2][0].statuses.protected = true;
  const after = cast(m, 'triple-og-red', 2);
  const punch = find(after, 'triple-og-red');
  assert.equal(getEffectiveCardPower(punch), 5, 'gained one Hand per card actually weakened');
  assert.equal(getEffectiveCardPower(after.boards.flat().find(c => c.cardId === 'oink')!), 5);
  const respected = after.boards.flat().find(c => c.cardId === 'hooper')!;
  assert.notEqual(respected.lane, 2, 'the protected ally was moved out of respect');
  assert.equal(getEffectiveCardPower(respected), 5, 'the moved ally kept every Hand');
});

test('a silenced Triple OG still answers roll call', () => {
  const m = blank();
  m.boards[2] = [unit('oink', 'cpu', 2, 2)];
  const source = createCardInstance('triple-og-red', 'player', 'cast', 7);
  source.statuses.silenced = true;
  const after = playTurnCard({ ...m, phase: 'player', playerHand: [source] }, 'player', source.instanceId, 2);
  assert.equal(getEffectiveCardPower(find(after, 'triple-og-red')), 4);
  assert.equal(getEffectiveCardPower(after.boards.flat().find(c => c.cardId === 'oink')!), 5);
});

test('INITIATION puts the next character on with the set already in the district', () => {
  const m = blank();
  m.boards[1] = [unit('triple-og-blue', 'player', 1, 1)];
  const marked = cast(m, 'initiation', 1);
  assert(getCharacterDistrictMarks(marked).some(mark => mark.lane === 1 && /Marked Territory/.test(mark.text)));
  const joined = cast(marked, 'cornball', 1);
  const recruit = joined.boards.flat().find(c => c.cardId === 'cornball')!;
  assert.equal(recruit.gangTag, 'blue');
  assert.equal(getEffectiveCardPower(recruit), 3, 'the initiate gained +2 Hands');
  // The mark is spent, so the next card joins nothing.
  const next = cast(joined, 'plug', 1);
  const second = next.boards.flat().find(c => c.cardId === 'plug')!;
  assert.equal(second.gangTag, undefined);
  assert.equal(getEffectiveCardPower(second), 2);

  const unclaimed = cast(cast(blank(), 'initiation', 0), 'cornball', 0);
  const founder = unclaimed.boards.flat().find(c => c.cardId === 'cornball')!;
  assert.equal(founder.gangTag, undefined);
  assert.equal(getEffectiveCardPower(founder), 3, 'with no set here the initiate still gains +2 Hands');
});

test('BLOCK SPINNER burns an enemy here and the next enemy played here', () => {
  const m = blank();
  m.boards[0] = [unit('oink', 'cpu', 0, 1)];
  const spun = cast(m, 'block-spinner', 0);
  assert.equal(spun.boards.flat().find(c => c.cardId === 'oink')!.statuses.burnStacks, 1);
  assert(getCharacterDistrictMarks(spun).some(mark => mark.lane === 0 && /Spinning/.test(mark.text)));
  const caught = cast(spun, 'cornball', 0, 'cpu');
  assert.equal(caught.boards.flat().find(c => c.cardId === 'cornball')!.statuses.burnStacks, 1);
  // The trap is single use.
  const later = cast(caught, 'plug', 0, 'cpu');
  assert.equal(later.boards.flat().find(c => c.cardId === 'plug')!.statuses.burnStacks, 0);
});

test('LOOK OUT discounts your next card in the district the opponent walked into', () => {
  const watching = cast(blank(), 'look-out', 1);
  assert.equal(find(watching, 'look-out').lookoutReady, true);
  const called = cast(watching, 'oink', 2, 'cpu');
  assert.equal(find(called, 'look-out').lookoutReady, false);
  const motionBefore = called.playerMotion;
  const discounted = cast(called, 'hooper', 2);
  assert.equal(motionBefore - discounted.playerMotion, cards.hooper.cost - 1, 'the called district costs 1 less Motion');
  // Only the called district is discounted, and only once.
  const again = cast(discounted, 'snow', 2);
  assert.equal(discounted.playerMotion - again.playerMotion, cards.snow.cost);
});

test('Roll Call removes a 1-Hand ally instead of leaving it at zero, and replays continuously', () => {
  const m = blank();
  m.boards[2] = [unit('cornball', 'player', 2, 1), unit('oink', 'cpu', 2, 2)];
  const after = cast(m, 'triple-og-red', 2);
  assert.equal(after.boards.flat().some(c => c.cardId === 'cornball'), false,
    'a 1-Hand ally that pays roll call leaves the board like any other defeated card');
  assert.equal(getEffectiveCardPower(find(after, 'triple-og-red')), 5, 'both the ally and the enemy paid');
});

test('a Triple OG reveal that moves someone leaves no discontinuous replay frame', () => {
  const m = blank();
  m.boards[2] = [unit('hooper', 'player', 2, 1), unit('oink', 'cpu', 2, 2)];
  m.boards[2][0].statuses.protected = true;
  const after = cast(m, 'triple-og-red', 2);
  // Arrival reactions may be attributed to the moved character. Check all frames.
  const frames = after.effectLog.filter(entry => entry.replay);
  assert(frames.length >= 2, 'the forced move and the roll call are separate frames');
  for (let i = 1; i < frames.length; i += 1) {
    assert.deepEqual(frames[i].replay.before, frames[i - 1].replay.after,
      'each frame must start where the previous one ended so playback never jumps');
  }
});
