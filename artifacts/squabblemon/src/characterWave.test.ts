import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { CHARACTER_WAVE } from '../../../lib/squabblemon-engine/src/characterWave';
import { cardCatalog, cards, decks, catalogCardById, validateCardAbilityUpgrades } from './data';
import { createCardInstance, createMatch, getEffectiveCardPower, getLegalCardCost, nextRound, playTurnCard,
  createMatchFromEngineCards, pass, revealCpuTurn, verifyMatchTranscript, createAbilityUpgradeSnapshot,
  type CardInstance, type Lane, type Match, type Owner, type PlayerMove } from './gameEngine';
import { createOnlineRoom, joinOnlineRoom, applyOnlineCommand, onlineRoomView } from '@workspace/squabblemon-engine/multiplayer';

const unit = (id: string, owner: Owner, lane: Lane, index = 1): CardInstance => ({
  ...createCardInstance(id, owner, 'wave', index), lane,
});
const find = (m: Match, c: CardInstance) => m.boards.flat().find(card => card.instanceId === c.instanceId)!;
const blank = (): Match => ({ ...createMatch('block', 'block'), round: 3, playerMotion: 9, cpuMotion: 9, playerHand: [], cpuHand: [], boards: [[], [], []] });
function cast(m: Match, id: string, owner: Owner = 'player', lane: Lane = 0, investment = 0) {
  const source = createCardInstance(id, owner, 'cast', m.nextEventSequence);
  return { source, after: playTurnCard({ ...m, phase: owner === 'player' ? 'player' : 'cpu-reveal',
    [owner === 'player' ? 'playerHand' : 'cpuHand']: [source] }, owner, source.instanceId, lane, false, investment) };
}
function shield(m: Match, target: CardInstance) {
  target.statuses.protected = true;
  m.timedEffects.push({ id: 'shield:' + target.instanceId, kind: 'church-protection', owner: target.owner,
    sourceInstanceId: target.instanceId, targetInstanceId: target.instanceId, lane: target.lane!,
    startsAtRound: 1, expiresAtRound: 7, expiration: 'match-complete' });
}
const advance = (m: Match) => nextRound({ ...m, phase: 'resolved', playerHand: [], cpuHand: [] });

test('all twelve retain collection, rarity, artwork, cosmetics and training IDs at the approved costs', () => {
  const costs = [3, 1, 3, 2, 3, 3, 3, 3, 4, 4, 4, 3];
  assert.equal(CHARACTER_WAVE.length, 12);
  assert.equal(cardCatalog.filter(c => c.kind !== 'support').length, 110);
  CHARACTER_WAVE.forEach(([id, art, name, rarity], index) => {
    assert.equal(cards[id].name, name); assert.equal(cards[id].cost, costs[index]);
    assert.equal(catalogCardById[art].engineId, id); assert.equal(catalogCardById[art].rarity, rarity);
    assert(existsSync(path.resolve('public/assets/characters', art + '.webp')));
    assert.equal(cards[id].abilityUpgrades.length, 3); validateCardAbilityUpgrades({ [id]: cards[id] });
  });
  assert.equal(cards.grownfanboy.power, 4);
  assert.equal(catalogCardById['cologne-criminal'].variantSlots.at(-1)?.id, 'cologne-criminal:crazy');
});

for (const owner of ['player', 'cpu'] as const) {
  test('every redesigned reveal is deterministic and immutable for ' + owner, () => {
    for (const [id] of CHARACTER_WAVE) {
      const m = blank(), enemy = owner === 'player' ? 'cpu' : 'player';
      const ally = unit('rastamon', owner, 0), water = unit('alchy', owner, 0, 2), hostile = unit('hooper', enemy, 0, 3);
      hostile.powerModifier = 8; m.boards[0] = [ally, water, hostile];
      const before = JSON.stringify(m), first = cast(m, id, owner).after;
      assert.equal(JSON.stringify(m), before);
      assert.deepEqual(cast(JSON.parse(before), id, owner).after, first);
    }
  });
  test('Nothing to Lose spends a chosen amount; spending extra cannot activate the steal for ' + owner, () => {
    const m = blank(), enemy = unit('hooper', owner === 'player' ? 'cpu' : 'player', 0);
    m.boards[0] = [enemy]; m[owner === 'player' ? 'playerMotion' : 'cpuMotion'] = 5;
    const { source, after } = cast(m, 'homelessguy', owner, 0, 2);
    assert.equal(getEffectiveCardPower(find(after, source)), 5);
    assert.equal(find(after, enemy).powerModifier, 0);
    assert.equal(after[owner === 'player' ? 'playerMotion' : 'cpuMotion'], 0);
    m[owner === 'player' ? 'playerMotion' : 'cpuMotion'] = 3;
    const stolen = cast(m, 'homelessguy', owner);
    assert.equal(find(stolen.after, enemy).powerModifier, -2);
    assert.equal(getEffectiveCardPower(find(stolen.after, stolen.source)), 5);
  });
}
test('investment rejects fractions, negatives, overspend and other cards; shields stop a steal', () => {
  for (const amount of [-1, 1.5, 5, NaN]) assert.throws(() => cast(blank(), 'homelessguy', 'player', 0, amount), /investment/);
  assert.throws(() => cast(blank(), 'hooper', 'player', 0, 1), /investment/);
  const m = blank(); m.playerMotion = 3;
  assert.throws(() => cast(m, 'homelessguy', 'player', 0, 1), /investment/);
  const target = unit('hooper', 'cpu', 0); shield(m, target); m.boards[0] = [target];
  const { source, after } = cast(m, 'homelessguy');
  assert.equal(find(after, target).powerModifier, 0); assert.equal(find(after, source).powerModifier, 0);
});

test('Fangirl follows a specific idol, triggers once each round and survives serialization', () => {
  const m = blank(), idol = unit('stockz', 'player', 0); m.boards[0] = [idol];
  const fan = cast(m, 'fangirl');
  assert.equal(find(fan.after, fan.source).idolId, idol.instanceId);
  assert.equal(find(fan.after, fan.source).powerModifier, 0, 'earlier growth cannot trigger a newly chosen idol');
  let after = cast(JSON.parse(JSON.stringify(fan.after)), 'cornball').after;
  assert.equal(find(after, fan.source).powerModifier, 1);
  after = cast(after, 'hooper').after;
  assert.equal(find(after, fan.source).powerModifier, 1);
  after = cast({ ...after, round: 4, playerMotion: 9 }, 'cornball').after;
  assert.equal(find(after, fan.source).powerModifier, 2);
});

test('Fanboy intercepts one hostile package per round, then leaves the idol exposed', () => {
  const m = blank(), idol = unit('hooper', 'player', 0), girl = unit('fangirl', 'player', 1);
  idol.powerModifier = 8; m.boards = [[idol], [girl], []];
  const boy = cast(m, 'grownfanboy', 'player', 1);
  assert.equal(find(boy.after, boy.source).idolId, idol.instanceId);
  let after = cast(boy.after, 'roaster', 'cpu', 0).after;
  assert.equal(find(after, idol).powerModifier, 8);
  assert.equal(find(after, boy.source).powerModifier, 0, '-2 hit, +2 from Fangirl');
  assert.equal(find(after, boy.source).statuses.burnStacks, 2);
  after = cast(after, 'nerd', 'cpu', 0).after;
  assert.equal(find(after, idol).statuses.silenced, true);
});

test('Street Apostle echoes actual Plant growth once across other districts without recursive copies', () => {
  const m = blank(), leader = unit('streetapostle', 'player', 0), copy = unit('streetapostle', 'player', 2, 2);
  const growing = unit('rastamon', 'player', 1, 3), extra = unit('ashlee', 'player', 2, 4);
  growing.statuses.boosted = true; m.boards = [[leader], [growing], [copy, extra]];
  const after = advance(m);
  assert.equal(find(after, growing).powerModifier, 1);
  assert.equal(find(after, leader).powerModifier, 1);
  assert.equal(find(after, copy).powerModifier + find(after, extra).powerModifier, 1);
  assert.equal(after.pendingLeaderReactions?.length ?? 0, 0);
  assert.equal(after.leaderRounds?.player?.streetapostle, 3);
});

test('Wrong Block moves the weakest enemy to its strongest other district', () => {
  const m = blank(), weak = unit('cornball', 'cpu', 0), strong = unit('hooper', 'cpu', 0, 2);
  strong.powerModifier = 8; m.boards = [[weak, strong], [unit('hooper', 'cpu', 1, 3)], []];
  const after = cast(m, 'lawlessyn').after;
  assert.equal(find(after, weak).lane, 1); assert.equal(find(after, strong).lane, 0);
});
for (const protection of ['shield', 'locked', 'uncounterable', 'asphalt'] as const) test('Wrong Block respects ' + protection, () => {
  const m = blank(), target = unit('landlord', 'cpu', 0);
  m.boards[0] = [target];
  if (protection === 'shield') shield(m, target);
  else if (protection === 'asphalt') m.boards[2] = [unit('asphaltapostle', 'cpu', 2, 2)];
  else target.statuses[protection] = true;
  const after = cast(m, 'lawlessyn').after;
  assert.equal(find(after, target).lane, 0);
  assert.equal(find(after, target).powerModifier, protection === 'asphalt' ? 2 : 0);
});
test('Concrete Congregation protects on reveal and blocks only one forced Earth move per round', () => {
  const m = blank(), earth = unit('landlord', 'player', 0), other = unit('landlord', 'player', 1, 2);
  m.boards = [[earth], [other], []];
  const apostle = cast(m, 'asphaltapostle');
  assert.equal(find(apostle.after, earth).statuses.protected, true);
  const first = cast(apostle.after, 'lawlessyn', 'cpu', 1).after;
  assert.equal(find(first, other).lane, 1);
  const second = cast(first, 'lawlessyn', 'cpu', 1).after;
  assert.notEqual(find(second, other).lane, 1);
});

test('Scent ignores current enemies, triggers once per round on entry and expires after next round', () => {
  const m = blank(), existing = unit('hooper', 'cpu', 0); m.boards[0] = [existing];
  let after = cast(m, 'colognecriminal').after;
  assert.equal(find(after, existing).statuses.burnStacks, 0);
  const entering = cast(after, 'cornball', 'cpu');
  assert.equal(find(entering.after, entering.source).statuses.burnStacks, 2);
  const second = cast(entering.after, 'nightcashier', 'cpu');
  assert.equal(find(second.after, second.source).statuses.burnStacks, 0);
  after = advance(second.after);
  after.boards = after.boards.map(items => items.filter(c => c.cardId !== 'colognecriminal')) as Match['boards'];
  const next = cast(after, 'hooper', 'cpu');
  assert.equal(find(next.after, next.source).statuses.burnStacks, 2, 'Scent persists without the source');
  const expired = cast(advance(next.after), 'cornball', 'cpu');
  assert.equal(find(expired.after, expired.source).statuses.burnStacks, 0);
});
test('hostile forced movement can route an enemy into Lingering Scent', () => {
  let m = cast(blank(), 'colognecriminal', 'player', 1).after;
  const target = unit('cornball', 'cpu', 0), strong = unit('hooper', 'cpu', 1, 2);
  m = { ...m, boards: [[target], [...m.boards[1], strong], []] };
  const after = cast(m, 'lawlessyn').after;
  assert.equal(find(after, target).lane, 1); assert.equal(find(after, target).statuses.burnStacks, 2);
});

test('Passport Bro cleanses a Water passenger only when leaving a losing district, without a refund', () => {
  for (const losing of [false, true]) {
    const m = blank(), water = unit('alchy', 'player', 0), hostile = unit('hooper', 'cpu', 0, 2);
    water.statuses.weakened = true; hostile.powerModifier = losing ? 20 : -4; m.boards[0] = [water, hostile];
    const after = cast(m, 'passportbro').after;
    assert.notEqual(find(after, water).lane, 0);
    assert.equal(find(after, water).statuses.weakened, !losing);
    assert.equal(find(after, water).powerModifier, losing ? 2 : 0);
    assert.equal(after.playerMotion, 6);
  }
});

test('Extra Sauce detonates stored Burn immediately once; a shield blocks the entire package', () => {
  const m = blank(), exposed = unit('hooper', 'cpu', 0), covered = unit('hooper', 'cpu', 0, 2), immune = unit('hooper', 'cpu', 0, 3);
  for (const c of [exposed, covered, immune]) { c.powerModifier = 10; c.statuses.burnStacks = 3; }
  immune.statuses.uncounterable = true; shield(m, covered); m.boards[0] = [exposed, covered, immune];
  const after = cast(m, 'seafoodassassin').after;
  assert.equal(find(after, exposed).powerModifier, 5); assert.equal(find(after, exposed).statuses.burnStacks, 0);
  assert.equal(find(after, covered).powerModifier, 10); assert.equal(find(after, covered).statuses.burnStacks, 3);
  assert.equal(find(after, immune).powerModifier, 10); assert.equal(find(after, immune).statuses.burnStacks, 3);
});

test('Built Different survives overkill once, heals only damage and cannot manufacture growth', () => {
  const m = blank(), legend = unit('homelesslegend', 'cpu', 0); legend.statuses.burnStacks = 8; m.boards[0] = [legend];
  const hit = cast(m, 'seafoodassassin').after;
  assert.equal(find(hit, legend).legendSaved, true);
  assert.equal(getEffectiveCardPower(find(hit, legend)), 1); assert.equal(find(hit, legend).recoverableDamage, 3);
  const healed = advance(hit);
  assert.equal(getEffectiveCardPower(find(healed, legend)), 3);
  const whole = advance(healed);
  assert.equal(getEffectiveCardPower(find(whole, legend)), 4);
  assert.equal(getEffectiveCardPower(find(advance(whole), legend)), 4);
  assert.equal(find(cast(hit, 'seafoodassassin').after, legend), undefined);
});

test('Pass the Hose spreads once per district; incoming smoke never ticks or chains in the same round', () => {
  const m = blank(), source = unit('godofhookah', 'player', 2), duplicate = unit('godofhookah', 'player', 2, 7);
  const burning = unit('hooper', 'cpu', 0, 2), alsoBurning = unit('hooper', 'cpu', 0, 3), next = unit('hooper', 'cpu', 1, 4), last = unit('hooper', 'cpu', 2, 5);
  burning.statuses.burnStacks = 1; alsoBurning.statuses.burnStacks = 1;
  m.boards = [[burning, alsoBurning], [next], [source, duplicate, last]];
  const after = advance(m);
  assert.equal(find(after, next).statuses.burnStacks, 1); assert.equal(find(after, next).powerModifier, 0);
  assert.equal(find(after, last).statuses.burnStacks, 0);
  const roundTwo = advance(after);
  assert.equal(find(roundTwo, next).powerModifier, -1);
  assert.equal(find(roundTwo, last).statuses.burnStacks, 1);
});

test('Mailman creates one persistent Package; only the next Electric in that district consumes it', () => {
  const m = blank(), mail = unit('mailman', 'player', 0); m.boards[0] = [mail];
  m.electricPlays = { player: { round: 3, count: 1 } };
  const second = cast(m, 'nightcashier', 'player', 0);
  const packageToken = second.after.discountTokens.find(t => t.eligibility === 'electric-delivery')!;
  assert.equal(packageToken.targetLane, 1);
  const normal = createCardInstance('cornball', 'player'), electric = createCardInstance('techbro', 'player');
  assert.equal(getLegalCardCost(second.after, 'player', normal, 1), normal.cost);
  assert.equal(getLegalCardCost(second.after, 'player', electric, 2), electric.cost);
  assert.equal(getLegalCardCost(second.after, 'player', electric, 1), electric.cost - 1);
  const restored = JSON.parse(JSON.stringify(second.after)) as Match;
  const delivered = cast(restored, 'techbro', 'player', 1);
  assert.equal(delivered.after.discountTokens.filter(t => t.eligibility === 'electric-delivery').length, 0);
  assert.equal(find(delivered.after, delivered.source).powerModifier, 2);
  assert.equal(delivered.after.playerMotion, second.after.playerMotion - cards.techbro.cost + 1);
  assert(delivered.after.effectLog.some(e => e.replay.before.discountTokens.some(t => t.eligibility === 'electric-delivery')));
});

test('passive training pays once per match even across rounds and serialization', () => {
  const m = blank(), fan = unit('fangirl', 'player', 0), idol = unit('stockz', 'player', 1);
  fan.idolId = idol.instanceId; m.boards = [[fan], [idol], []];
  m.abilityUpgradeSnapshot = createAbilityUpgradeSnapshot(['fangirl'], [], { player: { fangirl: { level: 8, xp: 2800, moveTier: 3 } } });
  const first = cast(m, 'cornball').after;
  assert.equal(find(first, fan).powerModifier, 4);
  const second = cast({ ...JSON.parse(JSON.stringify(first)), round: 4, playerMotion: 9 }, 'cornball').after;
  assert.equal(find(second, fan).powerModifier, 5, 'only the recurring +1; no repeated training payout');
});

for (const seat of ['player', 'cpu'] as const) test('online commands and public markers work for ' + seat, () => {
  const member = (id: string) => ({ userId: id, name: id, ready: false, deck: { id: 'block', name: 'Wave', hero: 'homeless-guy',
    cards: ['homelessguy', 'fangirl', 'grownfanboy', 'lawlessyn', 'streetapostle', 'asphaltapostle', 'colognecriminal', 'passportbro', 'seafoodassassin', 'mailman'] } });
  let room = joinOnlineRoom(createOnlineRoom(member('a'), seat, 0), member('b'), 0);
  room = applyOnlineCommand(room, 'player', { type: 'ready' }, 1);
  room = applyOnlineCommand(room, 'cpu', { type: 'ready' }, 2);
  room.match = { ...room.match!, round: 3, playerMotion: 8, cpuMotion: 8 };
  const hand = seat === 'player' ? room.match.playerHand : room.match.cpuHand, source = hand.find(c => c.cardId === 'homelessguy')!;
  room = applyOnlineCommand(room, seat, { type: 'play', instanceId: source.instanceId, lane: 0, squabble: false, investment: 3 }, 3);
  assert.equal(find(room.match!, source).powerModifier, 3);
  assert.equal(room.match![seat === 'player' ? 'playerMotion' : 'cpuMotion'], 2);
  const view = onlineRoomView(room, 'ABC123', seat === 'player' ? 'a' : 'b', 4);
  assert.equal(view.hand.some(c => c.owner !== seat), false);
  assert.equal(view.boards[0].find(c => c.cardId === 'homelessguy')?.powerModifier, 3);
});
test('a complete custom-deck fade replays every paid investment through server verification', () => {
  const ids = ['homelessguy', 'fangirl', 'grownfanboy', 'lawlessyn', 'streetapostle', 'asphaltapostle', 'colognecriminal', 'passportbro', 'seafoodassassin', 'mailman'];
  let m = createMatchFromEngineCards('redesigned-wave', ids, 'block', [...decks.find(d => d.id === 'block')!.cards]);
  const moves: PlayerMove[] = [];
  let invested = false;
  while (m.phase !== 'complete') {
    const options = m.playerHand.flatMap(card => ([0, 1, 2] as Lane[]).map(lane => ({ card, lane, cost: getLegalCardCost(m, 'player', card, lane) })))
      .filter(o => o.cost <= m.playerMotion && (o.card.cardId !== 'homelessguy' || m.round >= 4));
    const choice = options.find(o => o.card.cardId === 'homelessguy' && o.cost < m.playerMotion) ?? options[0];
    if (choice) {
      const investment = choice.card.cardId === 'homelessguy' ? Math.min(4, m.playerMotion - choice.cost) : 0;
      invested ||= investment > 0;
      moves.push({ cardInstanceId: choice.card.instanceId, lane: choice.lane, squabble: false, investment, endTurn: false });
      m = playTurnCard(m, 'player', choice.card.instanceId, choice.lane, false, investment);
    }
    moves.push({ cardInstanceId: null, lane: null, squabble: false, endTurn: true });
    m = nextRound(revealCpuTurn(pass(m, 'player')));
  }
  assert(invested);
  assert.deepEqual(verifyMatchTranscript('redesigned-wave', 'block', moves, undefined, ids), m);
});

test('online projections expose Scent and Package markers without exposing engine state', () => {
  const member = (userId: string) => ({ userId, name: userId, ready: false, deck: decks[0] });
  let room = joinOnlineRoom(createOnlineRoom(member('a'), 'player', 0), member('b'), 0);
  room = applyOnlineCommand(applyOnlineCommand(room, 'player', { type: 'ready' }, 1), 'cpu', { type: 'ready' }, 2);
  room.match = cast(blank(), 'colognecriminal').after;
  room.match.discountTokens.push({ id: 'package', owner: 'cpu', sourceInstanceId: 'public-mailman', eligibility: 'electric-delivery', targetLane: 2, sourceLane: 1, createdOrder: 1 });
  for (const user of ['a', 'b']) {
    const view = onlineRoomView(room, 'ABC123', user, 3);
    assert.equal(view.districtMarks?.length, 2);
    assert(view.districtMarks?.some(mark => mark.owner === 'cpu' && mark.lane === 2 && mark.text.includes('Package')));
    assert(!JSON.stringify(view).includes('lingeringScents'));
  }
});
test('Fanboy redirects Buddy’s whole ability; the protected Mythical cannot award a hunt bonus', () => {
  const m = blank(), idol = unit('homelessguy', 'player', 0), girl = unit('fangirl', 'player', 1);
  idol.powerModifier = 8; m.boards = [[idol], [girl], []];
  const guard = cast(m, 'grownfanboy', 'player', 1);
  const attacked = cast(guard.after, 'buddy', 'cpu', 0);
  assert.equal(find(attacked.after, idol).powerModifier, 8);
  assert.equal(find(attacked.after, idol).statuses.silenced, false);
  assert.equal(find(attacked.after, attacked.source).powerModifier, 0);
  assert.equal(find(attacked.after, guard.source).powerModifier, 0, 'normal recipient takes 2, then Fangirl adds 2');
});

test('Scent replay starts with no mark and shows the newly created mark after reveal', () => {
  const result = cast(blank(), 'colognecriminal').after;
  const reveal = result.effectLog.find(event => event.type === 'ability' && event.note.startsWith('Lingering Scent marks'))!;
  assert.deepEqual(reveal.replay.before.lingeringScents, []);
  assert.equal(reveal.replay.after.lingeringScents?.length, 1);
});
