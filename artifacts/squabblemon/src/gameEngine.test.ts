import { completeEngineCrew } from '@workspace/squabblemon-engine/data';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canAffordSelection, chooseCpuPlay, createCardInstance, createMatch, createMatchFromCatalog, getEffectiveCardPower,
  getCardCostExplanation, getDistrictCardBonus, getLaneScore, getLegalCardCost, getMatchWinner, getRivalIntent, nextRound, pass, playCard, revealCpu, verifyMatchTranscript,
  createAbilityUpgradeSnapshot, validateAbilityUpgradeSnapshot, type Match,
} from './gameEngine';
import { ABILITY_UPGRADE_UNLOCK_LEVELS, cards, starterRecipes, validateCardAbilityUpgrades } from './data';

const custom = (id: string, owner: 'player' | 'cpu', index: number) => createCardInstance(id, owner, 'test', index);
const playOne = (id: string, setup?: (m: Match) => Match) => {
  let match = createMatch('vibes', 'vibes');
  match = { ...match, playerMotion: 20, playerHand: [custom(id, 'player', 0)] };
  return playCard(setup ? setup(match) : match, 'player', match.playerHand[0].instanceId, 0);
};

test("City Never Sleeps cards use deterministic reveal, protection, movement, and cost rules", () => {
  let m = createMatch("vibes", "vibes");
  const barber = custom("barber", "player", 1), ally = custom("delivery", "player", 2), enemy = custom("cornball", "cpu", 3);
  m = { ...m, playerMotion: 20, playerHand: [barber], boards: [[ally, enemy], [], []] };
  m = playCard(m, "player", barber.instanceId, 0);
  assert.equal(m.boards[0].find(card => card.instanceId === ally.instanceId)?.powerModifier, 2);
  assert.equal(m.boards[0].some(card => card.instanceId === enemy.instanceId), false, 'lethal Line Up destroys the enemy');

  const bottle = custom("bottle", "player", 4);
  m = { ...m, phase: "player", playerMotion: 5, playerHand: [bottle] };
  m = playCard(m, "player", bottle.instanceId, 1);
  assert(m.discountTokens.some(token => token.eligibility === "printed-two-cost"));

  const church = custom("church", "player", 5), protectedAlly = custom("cornball", "player", 6), roaster = custom("roaster", "cpu", 7);
  m = { ...m, phase: "player", playerMotion: 20, playerHand: [church], boards: [[protectedAlly], [], []] };
  m = playCard(m, "player", church.instanceId, 0);
  m = { ...m, phase: "cpu-reveal", cpuMotion: 20, cpuHand: [roaster], boards: m.boards.map(items => items.map(card => card.instanceId === church.instanceId ? { ...card, statuses: { ...card.statuses, frozen: true } } : card)) as Match["boards"] };
  m = playCard(m, "cpu", roaster.instanceId, 0);
  assert.equal(m.boards[0].find(card => card.instanceId === protectedAlly.instanceId)?.powerModifier, 2);
  assert(!m.timedEffects.some(effect => effect.kind === "church-protection"));

  const carMeet = custom("carmeet", "player", 8), delivery = custom("delivery", "player", 9);
  delivery.statuses.frozen = true;
  m = { ...m, phase: "player", playerMotion: 20, playerHand: [carMeet], boards: [[], [delivery], []] };
  m = playCard(m, "player", carMeet.instanceId, 0);
  assert.equal(m.boards.flat().find(card => card.instanceId === carMeet.instanceId)?.lane, 1);
  assert.equal(m.boards.flat().find(card => card.instanceId === delivery.instanceId)?.powerModifier, 1);

  const demon = custom("delivery", "player", 11), carried = custom("cornball", "player", 12);
  m = { ...m, phase: "player", playerMotion: 20, playerHand: [demon], boards: [[carried], [], []] };
  m = playCard(m, "player", demon.instanceId, 0);
  assert.equal(m.boards.flat().find(card => card.instanceId === carried.instanceId)?.lane, 1);
});

test("Church Auntie's Covered shield survives rounds until it blocks one hostile target", () => {
  let m = createMatch("vibes", "vibes");
  const church = custom("church", "player", 80);
  const ally = custom("cornball", "player", 81);
  const roaster = custom("roaster", "cpu", 82);
  m = { ...m, playerMotion: 20, playerHand: [church], boards: [[ally], [], []] };
  m = playCard(m, "player", church.instanceId, 0);
  assert(m.timedEffects.some(effect => effect.kind === "church-protection" && effect.targetInstanceId === ally.instanceId));
  m = pass(m, "cpu");
  m = nextRound(m);
  assert(m.timedEffects.some(effect => effect.kind === "church-protection" && effect.targetInstanceId === ally.instanceId));
  m = {
    ...m,
    phase: "cpu-reveal",
    cpuMotion: 20,
    cpuHand: [roaster],
    boards: m.boards.map(items => items.map(card => card.instanceId === church.instanceId
      ? { ...card, statuses: { ...card.statuses, frozen: true } }
      : card)) as Match["boards"],
  };
  m = playCard(m, "cpu", roaster.instanceId, 0);
  assert.equal(m.boards[0].find(card => card.instanceId === ally.instanceId)?.powerModifier, 2);
  assert(!m.timedEffects.some(effect => effect.kind === "church-protection"));
});

test("City Never Sleeps taxes, discounts, Sneaker, Promoter, Nail, and OG Uncle are deterministic", () => {
  let m = createMatch("vibes", "vibes");
  const landlord = custom("landlord", "cpu", 20), twoCost = custom("cornball", "player", 21);
  m = { ...m, boards: [[landlord], [], []], playerHand: [twoCost], playerMotion: 2 };
  assert.equal(getLegalCardCost(m, "player", twoCost, 0), 2);
  m = { ...m, discountTokens: [{ id: "old", owner: "player", sourceInstanceId: "x", eligibility: "any", sourceLane: null, createdOrder: 1 }] };
  assert.equal(getLegalCardCost(m, "player", twoCost, 0), 1);
  assert.match(getCardCostExplanation(m, "player", twoCost, 0), /1 base · −1 discount · \+1 Rent Due tax/);
  m = playCard(m, "player", twoCost.instanceId, 0);
  assert.equal(m.landlordTaxUsed.player[0], true);

  const reseller = custom("sneaker", "player", 22), og = custom("og", "cpu", 23);
  m = { ...m, phase: "cpu-reveal", cpuHand: [og], cpuMotion: 20, boards: [[reseller], [], []] };
  m = playCard(m, "cpu", og.instanceId, 0);
  assert(m.sneakerTriggered.player && m.discountTokens.some(token => token.owner === "player"));

  const promoter = custom("promoter", "player", 24), handHigh = custom("og", "cpu", 25), handLow = custom("cornball", "cpu", 26);
  m = { ...m, phase: "player", playerHand: [promoter], cpuHand: [handHigh, handLow], playerMotion: 20 };
  m = playCard(m, "player", promoter.instanceId, 0);
  assert.match(m.effectLog.at(-1)?.note ?? "", /Guest List/);
  assert.match(m.effectLog.at(-1)?.note ?? "", /OG Uncle \(4 Motion\)/);
  assert(m.discountTokens.some(token => token.sourceInstanceId === promoter.instanceId));

  const nail = custom("nail", "player", 27), target = custom("cornball", "player", 28), oink = custom("oink", "cpu", 29);
  m = { ...m, phase: "player", playerHand: [nail], playerMotion: 20, boards: [[target], [], []] };
  m = playCard(m, "player", nail.instanceId, 0);
  m = { ...m, phase: "cpu-reveal", cpuHand: [oink], cpuMotion: 20 };
  m = playCard(m, "cpu", oink.instanceId, 0);
  assert.equal(m.boards[0].find(card => card.instanceId === target.instanceId)?.powerModifier, 2);
});

test('initial hands are stable, owner-specific instances', () => {
  const match = createMatch('block', 'combo');
  assert.equal(match.playerHand.length, 5);
  assert.equal(match.cpuHand.length, 5);
  assert.equal(new Set([...match.playerHand, ...match.cpuHand].map((c) => c.instanceId)).size, 10);
  assert(match.playerHand.every((c) => c.owner === 'player' && c.lane === null));
  assert.equal(match.playerMotion, 2);
});

test('every starter opens with multiple legal card and district decisions', () => {
  for (const deck of starterRecipes) {
    const match = createMatch(deck.id, 'combo');
    const legalCards = match.playerHand.filter(card => ([0, 1, 2] as const).some(lane => canAffordSelection(match, 'player', card.instanceId, lane)));
    assert(legalCards.length >= 2, `${deck.id} should open with a choice`);
  }
});

test('one Motion carries forward while the six-round economy stays capped', () => {
  let match = createMatch('block', 'combo');
  match = pass(match, 'player');
  match = pass(match, 'cpu');
  match = nextRound(match);
  assert.equal(match.playerMotion, 3);
  assert.equal(match.cpuMotion, 3);
  match = { ...match, playerMotion: 99, cpuMotion: 99, phase: 'resolved' };
  assert.equal(nextRound(match).playerMotion, 4);
});

test('district bonuses and rival tells expose strategic pressure without exact moves', () => {
  const fire = custom('hooper', 'player', 90);
  assert.equal(getDistrictCardBonus(fire, 0), 2);
  assert.equal(getDistrictCardBonus(fire, 2), 0);
  const match = createMatch('block', 'slide');
  const intent = getRivalIntent({ ...match, phase: 'cpu-reveal' });
  assert.equal(intent.style, 'Movement');
  assert(intent.tell.length > 20);
  assert(intent.likelyLane !== null);
});

test('a legal saved catalog deck can enter the same local CPU engine', () => {
  const recipe = starterRecipes[0];
  const match = createMatchFromCatalog('saved-test', recipe.catalogCardIds, 'combo');
  assert.equal(match.playerDeck, 'saved-test');
  assert.equal(match.playerCardIds.length, 10);
  assert.equal(match.playerHand.length, 5);
  assert.equal(match.cpuHand.length, 5);
});

test('exact instance is removed and both owners spend their actual Motion', () => {
  let match = createMatch('vibes', 'combo');
  const selected = match.playerHand[0];
  match = { ...match, playerMotion: 10, cpuMotion: 10 };
  match = playCard(match, 'player', selected.instanceId, 0);
  assert(!match.playerHand.some((c) => c.instanceId === selected.instanceId));
  assert.equal(match.playerMotion, 10 - selected.cost);
  assert.equal(match.effectLog.at(-1)?.state.after.phase, 'cpu-reveal');
  const cpu = match.cpuHand[0];
  match = playCard(match, 'cpu', cpu.instanceId, 1);
  assert.equal(match.cpuMotion, 10 - cpu.cost);
  assert.equal(match.effectLog.at(-1)?.state.after.phase, 'resolved');
});

test('printed abilities resolve with an effect note, including fire and water mapping', () => {
  const ids = ['rastamon', 'roaster', 'nerd', 'cornball', 'plug', 'streamer', 'gamer', 'techbro', 'bikelife', 'vibe', 'hooper', 'baby', 'oink', 'snow', 'wifey'];
  for (const id of ids) {
    const resolved = playOne(id);
    assert(resolved.effectLog.length > 0, `${id} should log its resolution`);
  }
  assert.equal(playOne('snow').effectLog.at(-1)?.kind, 'water');
  assert.equal(playOne('hooper').effectLog.at(-1)?.kind, 'fire');
});

test('every gameplay card has the fixed, valid three-upgrade path', () => {
  assert.equal(validateCardAbilityUpgrades(), cards);
  for (const [cardId, card] of Object.entries(cards)) {
    assert.equal(card.abilityUpgrades.length, 3, cardId);
    assert.deepEqual(card.abilityUpgrades.map((upgrade) => upgrade.unlockLevel), ABILITY_UPGRADE_UNLOCK_LEVELS, cardId);
    assert.equal(new Set(card.abilityUpgrades.map((upgrade) => upgrade.id)).size, 3, cardId);
  }
});

test('fade-start upgrade snapshots are immutable, tiered, ordered, and reject forgery', () => {
  const player = completeEngineCrew(['cornball', 'hooper', 'plug', 'snow', 'wifey', 'baby', 'bikelife']);
  const cpu = completeEngineCrew(['rastamon', 'roaster', 'nerd', 'streamer', 'gamer', 'techbro', 'vibe']);
  for (const [level, unlocked] of [[1, 0], [2, 1], [5, 2], [8, 3], [10, 3]] as const) {
    const snapshot = createAbilityUpgradeSnapshot(player, cpu, { player: { cornball: { xp: 50 * level * (level - 1), level } } });
    assert.equal(snapshot.player[0].upgradeIds.length, unlocked);
    assert(Object.isFrozen(snapshot));
  }
  const snapshot = createAbilityUpgradeSnapshot(player, cpu, { player: { cornball: { xp: 2800, level: 8 } } });
  const forged = { ...snapshot, player: snapshot.player.map((entry) => ({ ...entry, upgradeIds: [...entry.upgradeIds] })) };
  forged.player[0].upgradeIds.push('cornball:upgrade:99');
  assert.throws(() => validateAbilityUpgradeSnapshot(forged, player, cpu), /Forged/);
  assert.throws(() => validateAbilityUpgradeSnapshot({ ...snapshot, version: 0 } as any, player, cpu), /version/);
});

test('upgrades use the captured snapshot, resolve in order, and replay identically', () => {
  const snapshot = createAbilityUpgradeSnapshot(
    completeEngineCrew(['cornball', 'snow', 'roaster', 'rastamon', 'wifey', 'oink', 'baby']),
    completeEngineCrew(['cornball', 'roaster', 'nerd', 'snow', 'plug', 'baby', 'hooper']),
    { player: { cornball: { xp: 2800, level: 10 } } },
  );
  // A later live level cannot change this level-two match snapshot.
  const stale = createAbilityUpgradeSnapshot(snapshot.player.map((entry) => entry.cardId), snapshot.cpu.map((entry) => entry.cardId), { player: { cornball: { xp: 100, level: 2 } } });
  let match = createMatch('block', 'receipts', undefined, stale);
  const enemies = [0, 1, 2].map((index) => ({ ...custom('snow', 'cpu', 100 + index), lane: 0 as const }));
  match = { ...match, playerMotion: 20, playerHand: [custom('cornball', 'player', 0)], boards: [enemies, [], []] };
  const resolved = playCard(match, 'player', match.playerHand[0].instanceId, 0);
  const upgrades = resolved.effectLog.filter((event) => event.abilityMetadata);
  assert.equal(upgrades.length, 1);
  assert.equal(upgrades[0].abilityMetadata?.upgradeId, 'cornball:upgrade:1');
  assert.equal(resolved.boards[0].find((card) => card.cardId === 'cornball')?.powerModifier, 1);
  const passes = Array.from({ length: 6 }, () => ({ cardInstanceId: null, lane: null, squabble: false }));
  assert.deepEqual(
    verifyMatchTranscript('block', 'receipts', passes, stale),
    verifyMatchTranscript('block', 'receipts', passes, stale),
  );
});

test('conditional upgrade families affect authored targets only after a successful base ability', () => {
  const player = completeEngineCrew(['cornball', 'snow', 'roaster', 'rastamon', 'wifey', 'oink', 'baby']);
  const cpu = completeEngineCrew(['cornball', 'roaster', 'nerd', 'snow', 'plug', 'baby', 'hooper']);
  const full = createAbilityUpgradeSnapshot(player, cpu, { player: { roaster: { xp: 4500, level: 10 } } });
  let match = createMatch('block', 'receipts', undefined, full);
  const enemy = { ...custom('hooper', 'cpu', 120), basePower: 8, lane: 0 as const, playedRound: 1 };
  match = { ...match, playerMotion: 20, playerHand: [custom('roaster', 'player', 0)], boards: [[enemy], [], []] };
  const resolved = playCard(match, 'player', match.playerHand[0].instanceId, 0);
  const events = resolved.effectLog.filter((event) => event.abilityMetadata);
  assert.deepEqual(events.map((event) => event.abilityMetadata?.upgradeId), [
    'roaster:upgrade:1', 'roaster:upgrade:2', 'roaster:upgrade:3',
  ]);
  assert.equal(resolved.boards[0].find((card) => card.instanceId === enemy.instanceId)?.powerModifier, -5);
  assert.equal(resolved.boards[0].find((card) => card.cardId === 'roaster')?.powerModifier, 1);
  const failed = playOne('roaster', (base) => ({
    ...base,
    abilityUpgradeSnapshot: full,
  }));
  assert.equal(failed.effectLog.filter((event) => event.abilityMetadata).length, 0);
  const protector = {
    ...custom('wifey', 'cpu', 121),
    lane: 0 as const,
    statuses: { frozen: false, silenced: false, protected: true, blocked: false },
  };
  const protectedEnemy = { ...custom('hooper', 'cpu', 122), lane: 0 as const, playedRound: 1 };
  const protectedMatch = createMatch('block', 'receipts', undefined, full);
  const protectedSource = custom('roaster', 'player', 0);
  const protectedResult = playCard({
    ...protectedMatch,
    playerMotion: 20,
    playerHand: [protectedSource],
    boards: [[protector, protectedEnemy], [], []],
  }, 'player', protectedSource.instanceId, 0);
  assert.equal(protectedResult.boards[0].find((card) => card.instanceId === protectedEnemy.instanceId)?.powerModifier, 0);
  assert.equal(protectedResult.effectLog.filter((event) => event.abilityMetadata).length, 0);
  assert.equal(protectedResult.boards[0].find((card) => card.instanceId === protector.instanceId)?.statuses.blocked, true);
  const effects = Object.values(cards).flatMap((card) => card.abilityUpgrades.map((upgrade) => upgrade.effect.kind));
  assert(effects.includes('self-power') && effects.includes('target-power'));
});

test('Wifey blocks one targeted effect and movement cards visibly move', () => {
  const wifey = { ...custom('wifey', 'cpu', 1), lane: 0 as const, statuses: { frozen: false, silenced: false, protected: true, blocked: false } };
  const victim = { ...custom('snow', 'cpu', 2), lane: 0 as const, powerModifier: 5 };
  const blocked = playOne('redpill', (m) => ({ ...m, boards: [[wifey, victim], [], []] }));
  assert(blocked.boards[0].find((c) => c.instanceId === wifey.instanceId)?.statuses.blocked);
  assert(!blocked.boards[0].find((c) => c.instanceId === victim.instanceId)?.statuses.silenced);
  const bike = playOne('bikelife');
  const bikeOnBoard = bike.boards.flat().find((c) => c.cardId === 'bikelife')!;
  assert(bikeOnBoard.moved);
  const ally = { ...custom('cornball', 'player', 8), lane: 1 as const };
  const vibe = playOne('vibe', (m) => ({ ...m, boards: [[], [ally], []] }));
  const movedAlly = vibe.boards[0].find((c) => c.instanceId === ally.instanceId);
  assert(movedAlly?.moved);
  assert.equal(movedAlly?.powerModifier, 1);
});

test('Closet Nerd bypasses Side Eye, but a direct shield still absorbs its silence', () => {
  const wifey = { ...custom('wifey', 'cpu', 10), lane: 0 as const, statuses: { frozen: false, silenced: false, protected: true, blocked: false } };
  const victim = { ...custom('snow', 'cpu', 11), lane: 0 as const, powerModifier: 5 };
  const pierced = playOne('nerd', m => ({ ...m, boards: [[wifey, victim], [], []] }));
  assert.equal(pierced.boards[0].find(c => c.instanceId === victim.instanceId)?.statuses.silenced, true);
  assert.equal(pierced.boards[0].find(c => c.instanceId === wifey.instanceId)?.statuses.blocked, false);
  const shielded = playOne('nerd', m => ({
    ...m,
    boards: [[wifey, victim], [], []],
    timedEffects: [{ id: 'cover', kind: 'church-protection', sourceInstanceId: 'church', targetInstanceId: victim.instanceId, owner: 'cpu', lane: 0, startsAtRound: 1, expiresAtRound: 7, expiration: 'match-complete' }],
  }));
  assert.equal(shielded.boards[0].find(c => c.instanceId === victim.instanceId)?.statuses.silenced, false);
  assert.equal(shielded.boards[0].find(c => c.instanceId === wifey.instanceId)?.statuses.blocked, false);
  assert.equal(shielded.timedEffects.some(effect => effect.id === 'cover'), false);
});

test('freeze, silence and power modifiers affect scoring; Plug discounts its next other-lane play', () => {
  const frozen = { ...custom('hooper', 'player', 1), statuses: { frozen: true, silenced: false, protected: false, blocked: false } };
  assert.equal(getEffectiveCardPower(frozen), 0);
  const boosted = { ...custom('cornball', 'player', 2), powerModifier: 2 };
  assert.equal(getLaneScore([boosted], 0), 3);
  let match = playOne('plug');
  const cheap = custom('snow', 'player', 3);
  match = { ...match, phase: 'player', playerMotion: cheap.cost - 1, playerHand: [cheap] };
  assert(canAffordSelection(match, 'player', cheap.instanceId, 1));
  match = playCard(match, 'player', cheap.instanceId, 1);
  assert.equal(match.playerMotion, 0);
});

test('hostile abilities change real enemy cards and scoring', () => {
  const recentEnemy = { ...custom('hooper', 'cpu', 20), lane: 0 as const, playedRound: 1 };
  const roasted = playOne('roaster', m => ({ ...m, boards: [[recentEnemy], [], []] }));
  assert.equal(roasted.boards[0].find(c => c.instanceId === recentEnemy.instanceId)?.powerModifier, -3);

  const silenced = playOne('nerd', m => ({ ...m, boards: [[recentEnemy], [], []] }));
  assert(silenced.boards[0].find(c => c.instanceId === recentEnemy.instanceId)?.statuses.silenced);

  const frozen = playOne('snow', m => ({ ...m, boards: [[recentEnemy], [], []] }));
  assert(frozen.boards[0].find(c => c.instanceId === recentEnemy.instanceId)?.statuses.frozen);
  assert.equal(getLaneScore(frozen.boards[0].filter(c => c.owner === 'cpu'), 0), 2);

  const secondEnemy = { ...custom('plug', 'cpu', 21), lane: 0 as const };
  const pressured = playOne('oink', m => ({ ...m, boards: [[recentEnemy, secondEnemy], [], []] }));
  assert(pressured.boards[0].filter(c => c.owner === 'cpu').every(c => c.powerModifier === -1));
});

test('sustain and comeback abilities visibly cleanse and swing Hands', () => {
  const frozenAlly = {
    ...custom('snow', 'player', 30),
    lane: 0 as const,
    statuses: { frozen: true, silenced: false, protected: false, blocked: false },
  };
  const cured = playOne('rastamon', m => ({ ...m, boards: [[frozenAlly], [], []] }));
  const clean = cured.boards[0].find(c => c.instanceId === frozenAlly.instanceId)!;
  assert(!clean.statuses.frozen);
  assert.equal(clean.powerModifier, 2);

  const enemyA = { ...custom('wifey', 'cpu', 31), lane: 0 as const };
  const enemyB = { ...custom('baby', 'cpu', 32), lane: 0 as const };
  const mama = playOne('baby', m => ({ ...m, boards: [[enemyA, enemyB], [], []] }));
  assert.equal(mama.boards[0].find(c => c.owner === 'player')?.powerModifier, 2);

  const giant = { ...custom('oink', 'cpu', 33), lane: 0 as const, powerModifier: 8 };
  const comeback = playOne('hooper', m => ({ ...m, boards: [[giant], [], []] }));
  assert.equal(comeback.boards[0].find(c => c.owner === 'player')?.powerModifier, 2);
  assert.equal(comeback.boards[0].find(c => c.instanceId === giant.instanceId)?.powerModifier, 6);
});

test('movement and engine cards keep their persistent board changes', () => {
  const enemies = [0, 1, 2].map(i => ({ ...custom(i === 0 ? 'plug' : i === 1 ? 'snow' : 'vibe', 'cpu', 40 + i), lane: 0 as const }));
  const scared = playOne('cornball', m => ({ ...m, boards: [[...enemies], [], []] }));
  assert.equal(scared.boards[1].filter(c => c.owner === 'cpu').length, 1);
  assert(scared.boards[1][0].moved);

  const streamer = { ...custom('streamer', 'player', 50), lane: 0 as const };
  let frenzy = createMatch('combo', 'vibes');
  frenzy = { ...frenzy, playerMotion: 10, playerHand: [custom('cornball', 'player', 51)], boards: [[streamer], [], []] };
  frenzy = playCard(frenzy, 'player', frenzy.playerHand[0].instanceId, 0);
  assert.equal(frenzy.boards[0].find(c => c.cardId === 'cornball')?.powerModifier, 1);

  const gamer = { ...custom('gamer', 'player', 52), lane: 0 as const };
  let combo = createMatch('combo', 'vibes');
  combo = { ...combo, playerMotion: 10, playerHand: [custom('plug', 'player', 53)], boards: [[gamer], [], []] };
  combo = playCard(combo, 'player', combo.playerHand[0].instanceId, 0);
  assert.equal(combo.boards[0].find(c => c.instanceId === gamer.instanceId)?.powerModifier, 1);
  assert.equal(combo.boards[0].find(c => c.cardId === 'plug')?.powerModifier, 1);

  const flexed = playOne('techbro', m => ({ ...m, playerMotion: 6, boards: [[streamer], [], []] }));
  assert.equal(flexed.playerMotion, 2);
  assert.equal(flexed.boards[0].find(c => c.cardId === 'techbro')?.powerModifier, 2);
});

test('Plug discount waits for a different district and is then consumed', () => {
  let match = playOne('plug');
  const sameLane = custom('snow', 'player', 60);
  match = { ...match, phase: 'player', playerMotion: 10, playerHand: [sameLane] };
  assert.equal(getLegalCardCost(match, 'player', sameLane, 0), sameLane.cost);
  match = playCard(match, 'player', sameLane.instanceId, 0);
  assert.equal(match.plugDiscountLane.player, 0);

  const otherLane = custom('vibe', 'player', 61);
  match = { ...match, phase: 'player', playerMotion: 10, playerHand: [otherLane] };
  assert.equal(getLegalCardCost(match, 'player', otherLane, 1), 1);
  match = playCard(match, 'player', otherLane.instanceId, 1);
  assert.equal(match.plugDiscountLane.player, null);
});

test('SQUABBLE is a once-per-fade card modifier', () => {
  let match = createMatch('vibes', 'combo');
  const card = match.playerHand[0];
  match = { ...match, playerMotion: 20 };
  match = playCard(match, 'player', card.instanceId, 0, true);
  const played = match.boards.flat().find((c) => c.instanceId === card.instanceId)!;
  assert.equal(played.powerModifier, card.basePower);
  assert(match.squabbleUsed);
  const play = match.effectLog.find(event => event.type === 'play')!;
  assert.match(play.note, /SQUABBLE/);
  assert.equal(play.source?.before?.lane, null);
  assert.equal(play.source?.after?.lane, 0);
  assert.equal(play.source?.before?.power, card.basePower);
  assert.equal(play.source?.after?.power, card.basePower * 2);
  assert.equal(play.resources.before.playerMotion, 20);
  assert.equal(play.resources.after.playerMotion, 20 - card.cost);
  assert.throws(() => playCard({ ...match, phase: 'player' }, 'player', match.playerHand[0].instanceId, 1, true));
});

test('a complete six-round pass fade resolves deterministically', () => {
  let match = createMatch('vibes', 'combo');
  for (let round = 1; round <= 6; round += 1) {
    match = pass(match, 'player');
    match = pass(match, 'cpu');
    match = nextRound(match);
    assert.equal(match.round, round < 6 ? round + 1 : 6);
  }
  assert.equal(match.phase, 'complete');
  assert.equal(match.effectLog.filter((event) => event.type === 'pass').length, 12);
  assert.equal(match.effectLog.at(-1)?.type, 'match-complete');
});

test('CPU selects only an affordable exact hand card; rounds draw unused cards and final result is 2-of-3 or draw', () => {
  let match = createMatch('vibes', 'combo');
  match = { ...pass(match, 'player'), cpuMotion: 0 };
  assert.equal(chooseCpuPlay(match), null);
  match = { ...match, cpuMotion: 20 };
  const choice = chooseCpuPlay(match)!;
  assert(match.cpuHand.some((c) => c.instanceId === choice.instanceId));
  match = revealCpu(match);
  assert.equal(match.phase, 'resolved');
  const afterDraw = nextRound(match);
  assert.equal(afterDraw.playerHand.length, 6);
  assert.equal(afterDraw.cpuHand.length, 5);
  const won: Match = { ...afterDraw, round: 6, phase: 'complete', boards: [[{ ...custom('cornball', 'player', 20), lane: 0 }], [{ ...custom('cornball', 'player', 21), lane: 1 }], []] };
  assert.equal(getMatchWinner(won), 'player');
  assert.equal(getMatchWinner({ ...won, boards: [[], [], []] }), 'draw');
});

test('battle events identify play, reveal, ability source and ordered target state changes', () => {
  const enemy = { ...custom('hooper', 'cpu', 70), lane: 0 as const, playedRound: 1 };
  const match = playOne('roaster', m => ({ ...m, boards: [[enemy], [], []] }));
  assert.deepEqual(match.effectLog.map(event => event.type), ['play', 'reveal', 'ability']);
  assert.deepEqual(match.effectLog.map(event => event.sequence), [1, 2, 3]);

  const ability = match.effectLog[2];
  assert.equal(ability.source?.cardId, 'roaster');
  assert.equal(ability.source?.after?.lane, 0);
  assert.equal(ability.timing, 'instant');
  assert.equal(ability.duration, null);
  assert.equal(ability.targets.length, 1);
  assert.equal(ability.targets[0].cardInstanceId, enemy.instanceId);
  assert.equal(ability.targets[0].before?.power, enemy.basePower);
  assert.equal(ability.targets[0].after?.power, enemy.basePower - 3);
  assert.deepEqual(ability.targets[0].before?.statuses, enemy.statuses);
  assert.equal(ability.scores.before[0].cpu, enemy.basePower + 2);
  assert.equal(ability.scores.after[0].cpu, enemy.basePower - 3 + 2);
  assert.equal(ability.scores.after[0].player, 3);
});

test('blocked targeted effects record both intended target and protecting Wifey', () => {
  const wifey = { ...custom('wifey', 'cpu', 71), lane: 0 as const, statuses: { frozen: false, silenced: false, protected: true, blocked: false } };
  const victim = { ...custom('snow', 'cpu', 72), lane: 0 as const, powerModifier: 5 };
  const match = playOne('redpill', m => ({ ...m, boards: [[wifey, victim], [], []] }));
  const ability = match.effectLog.at(-1)!;
  assert.equal(ability.type, 'ability');
  assert.deepEqual(new Set(ability.targets.map(target => target.cardInstanceId)), new Set([wifey.instanceId, victim.instanceId]));
  assert.equal(ability.targets.find(target => target.cardInstanceId === victim.instanceId)?.after?.statuses.silenced, false);
  assert.equal(ability.targets.find(target => target.cardInstanceId === wifey.instanceId)?.after?.statuses.blocked, true);
});

test('movement abilities are move events with authoritative lane snapshots', () => {
  const bike = playOne('bikelife');
  const bikeMove = bike.effectLog.at(-1)!;
  assert.equal(bikeMove.kind, 'move');
  assert.equal(bikeMove.source?.before?.lane, 0);
  assert.equal(bikeMove.source?.after?.lane, 1);
  assert.equal(bikeMove.source?.before?.moved, false);
  assert.equal(bikeMove.source?.after?.moved, true);

  const ally = { ...custom('cornball', 'player', 73), lane: 1 as const };
  const vibe = playOne('vibe', m => ({ ...m, boards: [[], [ally], []] }));
  const vibeMove = vibe.effectLog.at(-1)!;
  const pulled = vibeMove.targets.find(target => target.cardInstanceId === ally.instanceId)!;
  assert.equal(vibeMove.kind, 'move');
  assert.equal(pulled.before?.lane, 1);
  assert.equal(pulled.after?.lane, 0);

  const enemies = [0, 1, 2].map(index => ({ ...custom('snow', 'cpu', 80 + index), lane: 0 as const }));
  const cornball = playOne('cornball', m => ({ ...m, boards: [[...enemies], [], []] }));
  const cornballMove = cornball.effectLog.at(-1)!;
  assert.equal(cornballMove.kind, 'move');
  assert.equal(cornballMove.targets[0].before?.lane, 0);
  assert.equal(cornballMove.targets[0].after?.lane, 1);
});

test('Wifey protection has deterministic round duration, expiration, and renewal', () => {
  let match = playOne('wifey');
  const protection = match.effectLog.at(-1)!;
  assert.equal(protection.timing, 'timed');
  assert.deepEqual(protection.duration, { unit: 'round', startsAtRound: 1, expiresAtRound: 2, expiration: 'round-start' });
  assert.equal(match.timedEffects[0].expiresAtRound, 2);
  const firstEffectId = match.timedEffects[0].id;

  match = pass(match, 'cpu');
  match = nextRound(match);
  const expiration = match.effectLog.find(event => event.type === 'expiration')!;
  const roundStart = match.effectLog.at(-1)!;
  assert.equal(expiration.round, 2);
  assert.equal(expiration.source?.before?.statuses.protected, true);
  assert.equal(expiration.source?.after?.statuses.protected, false);
  assert.equal(roundStart.type, 'round-start');
  assert.equal(roundStart.duration?.expiresAtRound, 3);
  assert(!match.timedEffects.some(effect => effect.id === firstEffectId));
  assert.equal(match.timedEffects[0].id.endsWith(':2'), true);
  assert.equal(match.boards[0].find(card => card.cardId === 'wifey')?.statuses.protected, true);
  assert.deepEqual(match.effectLog.map(event => event.sequence), match.effectLog.map((_, index) => index + 1));
});

test('passes are synchronous authoritative events and survive round transitions', () => {
  let match = createMatch('vibes', 'combo');
  const controller = new AbortController();
  match = pass(match, 'player');
  controller.abort();
  assert.equal(match.phase, 'cpu-reveal');
  assert.equal(match.effectLog[0].type, 'pass');
  assert.equal(match.effectLog[0].owner, 'player');
  assert.equal(match.effectLog[0].source, null);
  assert.deepEqual(match.effectLog[0].scores.before, match.effectLog[0].scores.after);

  match = pass(match, 'cpu');
  const priorCount = match.effectLog.length;
  match = nextRound(match);
  assert.equal(match.phase, 'player');
  assert.equal(match.effectLog.length, priorCount + 1);
  const roundStart = match.effectLog.at(-1)!;
  assert.equal(roundStart.type, 'round-start');
  assert.equal(roundStart.state.before.round, 1);
  assert.equal(roundStart.state.after.round, 2);
  assert.equal(roundStart.state.after.phase, 'player');
  const draws = roundStart.targets.filter((target) => target.before === null && target.after?.lane === null);
  assert.equal(draws.length, 2);
  assert.deepEqual(match.effectLog.map(event => event.sequence), [1, 2, 3]);
});

test('Church Auntie buff adds immediate Hands, preserves existing shields, and respects silence', () => {
  assert.equal(cards.church.cost,3); assert.equal(cards.church.power,4);
  validateCardAbilityUpgrades({church:cards.church});
  for(const protectedAlready of [false,true]){
    const ally={...custom('cornball','player',91),lane:0 as const};
    ally.statuses.protected=protectedAlready;
    const result=playOne('church',m=>({...m,boards:[[ally],[],[]]}));
    const target=result.boards[0].find(c=>c.instanceId===ally.instanceId)!;
    assert.equal(target.powerModifier,2);
    assert.equal(target.statuses.protected,true);
    assert.equal(result.timedEffects.filter(e=>e.kind==='church-protection').length,protectedAlready?0:1);
  }
  const alone=playOne('church');
  assert.equal(alone.boards[0][0].basePower,4);
  assert.equal(alone.boards[0][0].statuses.protected,false);
  const ally={...custom('cornball','player',92),lane:0 as const};
  const silenced=playOne('church',m=>({...m,playerHand:m.playerHand.map(c=>({...c,statuses:{...c.statuses,silenced:true}})),boards:[[ally],[],[]]}));
  assert.equal(silenced.boards[0].find(c=>c.instanceId===ally.instanceId)!.powerModifier,0);
});
