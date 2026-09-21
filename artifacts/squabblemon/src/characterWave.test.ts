import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { CHARACTER_WAVE } from '../../../lib/squabblemon-engine/src/characterWave';
import { cardCatalog, cards, catalogCardById, validateCardAbilityUpgrades } from './data';
import { createCardInstance, createMatch, getEffectiveCardPower, nextRound, playTurnCard, type CardInstance, type Lane, type Match, type Owner } from './gameEngine';

const unit = (id: string, owner: Owner, lane: Lane, index: number): CardInstance => ({
  ...createCardInstance(id, owner, 'character-wave', index), lane,
});
const find = (match: Match, id: string) => match.boards.flat().find(card => card.instanceId === id);
const setup = (id: string, owner: Owner = 'player') => {
  const source = createCardInstance(id, owner, 'character-wave', 99);
  const match: Match = {
    ...createMatch('block', 'block'), round: 4, phase: owner === 'player' ? 'player' : 'cpu-reveal',
    playerMotion: 9, cpuMotion: 9, playerHand: owner === 'player' ? [source] : [], cpuHand: owner === 'cpu' ? [source] : [],
    boards: [[], [], []],
  };
  return { source, match, enemy: owner === 'player' ? 'cpu' as const : 'player' as const };
};

test('all twelve corrected characters are collectible, trained, and have portraits', () => {
  assert.equal(CHARACTER_WAVE.length, 12);
  assert.equal(cardCatalog.filter(card => card.kind !== 'support').length, 110);
  for (const [engineId, artworkId, name, rarity] of CHARACTER_WAVE) {
    assert.equal(cards[engineId].name, name);
    assert.equal(catalogCardById[artworkId].engineId, engineId);
    assert.equal(catalogCardById[artworkId].rarity, rarity);
    assert.equal(cards[engineId].abilityUpgrades.length, 3);
    assert(existsSync(path.resolve('public/assets/characters', artworkId + '.webp')), artworkId);
    validateCardAbilityUpgrades({ [engineId]: cards[engineId] });
  }
  assert.equal(cards.homelessguy.ability, 'Wild Card');
  assert.equal(catalogCardById['cologne-criminal'].variantSlots.at(-1)?.id, 'cologne-criminal:crazy');
  assert(existsSync(path.resolve('public/assets/characters/cologne-criminal-crazy.webp')));
});

for (const owner of ['player', 'cpu'] as const) test('every new reveal resolves without mutating its input for ' + owner, () => {
  for (const [id] of CHARACTER_WAVE) {
    const { source, match, enemy } = setup(id, owner);
    const ally = unit('rastamon', owner, 0, 1);
    const water = unit('alchy', owner, 0, 2);
    const electric = unit('yunghustle', owner, 1, 3);
    const hostile = unit('hooper', enemy, 0, 4);
    hostile.powerModifier = 8;
    match.boards = [[ally, water, hostile], [electric], []];
    const snapshot = JSON.stringify(match);
    const after = playTurnCard(match, owner, source.instanceId, 0);
    assert(after.effectLog.some(event => event.source?.cardId === id || event.cardId === id), id);
    assert.equal(JSON.stringify(match), snapshot, id + ' mutated its input');
  }
});

test('Wild Card adopts an elemental crew and keeps growing with it', () => {
  const { source, match } = setup('homelessguy');
  const plant = unit('rastamon', 'player', 1, 1);
  match.boards[1] = [plant];
  const played = playTurnCard(match, 'player', source.instanceId, 0);
  assert.equal(find(played, source.instanceId)?.type, 'Plant');
  assert.equal(find(played, source.instanceId)?.powerModifier, 2);
  const advanced = nextRound({ ...played, phase: 'resolved', playerHand: [], cpuHand: [] });
  assert.equal(find(advanced, source.instanceId)?.powerModifier, 3);
});

test('Fangirl and Grown-Man Fanboy protect their idol and boost the fan club', () => {
  const { source, match } = setup('fangirl');
  const fanboy = unit('grownfanboy', 'player', 0, 1);
  const idol = unit('hooper', 'player', 0, 2);
  match.boards[0] = [fanboy, idol];
  const after = playTurnCard(match, 'player', source.instanceId, 0);
  assert.equal(find(after, idol.instanceId)?.powerModifier, 2);
  assert.equal(find(after, idol.instanceId)?.statuses.protected, true);
  assert.equal(find(after, fanboy.instanceId)?.powerModifier, 1);
  assert.equal(find(after, source.instanceId)?.powerModifier, 1);
});

test('Lawless YN steals Protection instead of stacking another debuff', () => {
  const { source, match, enemy } = setup('lawlessyn');
  const target = unit('hooper', enemy, 0, 1);
  target.statuses.protected = true;
  match.boards[0] = [target];
  match.timedEffects = [{ id: 'cover', kind: 'church-protection', sourceInstanceId: 'guard', targetInstanceId: target.instanceId,
    owner: enemy, lane: 0, startsAtRound: 1, expiresAtRound: 7, expiration: 'match-complete' }];
  const after = playTurnCard(match, 'player', source.instanceId, 0);
  assert.equal(find(after, target.instanceId)?.statuses.protected, false);
  assert.equal(find(after, source.instanceId)?.statuses.protected, true);
});

test('Passport Bro moves and services the first Water passenger each round', () => {
  const { source, match } = setup('passportbro');
  const passenger = unit('alchy', 'player', 0, 1);
  passenger.statuses.weakened = true;
  match.boards[0] = [passenger];
  const after = playTurnCard(match, 'player', source.instanceId, 0);
  const moved = find(after, passenger.instanceId)!;
  assert.notEqual(moved.lane, 0);
  assert.equal(moved.statuses.weakened, false);
  assert.equal(moved.powerModifier, 1);
  assert.equal(after.playerMotion, 7);
});

test('Seafood Assassin, God of Hookah, and The Mailman deliver board-wide payoffs', () => {
  const seafood = setup('seafoodassassin');
  const burning = unit('hooper', seafood.enemy, 0, 1); burning.statuses.burnStacks = 1;
  const poison = unit('bottle', 'player', 1, 2);
  seafood.match.boards = [[burning], [poison], []];
  const sauced = playTurnCard(seafood.match, 'player', seafood.source.instanceId, 0);
  assert.equal(find(sauced, burning.instanceId)?.statuses.burnStacks, 4);
  assert.equal(find(sauced, burning.instanceId)?.statuses.weakened, true);
  assert.equal(find(sauced, poison.instanceId)?.powerModifier, 1);

  const hookah = setup('godofhookah');
  const targets = ([0, 1, 2] as Lane[]).map((lane, index) => unit('hooper', hookah.enemy, lane, index + 10));
  targets[1].statuses.weakened = true;
  hookah.match.boards = targets.map(target => [target]) as Match['boards'];
  const smoked = playTurnCard(hookah.match, 'player', hookah.source.instanceId, 0);
  assert.equal(find(smoked, targets[0].instanceId)?.statuses.weakened, true);
  assert.equal(find(smoked, targets[1].instanceId)?.statuses.burnStacks, 2);
  assert.equal(find(smoked, targets[2].instanceId)?.statuses.weakened, true);

  const mail = setup('mailman');
  const electrics = ([0, 1, 2] as Lane[]).map((lane, index) => unit('yunghustle', 'player', lane, index + 20));
  mail.match.boards = electrics.map(card => [card]) as Match['boards'];
  const delivered = playTurnCard(mail.match, 'player', mail.source.instanceId, 0);
  assert(electrics.every(card => (find(delivered, card.instanceId)?.powerModifier ?? 0) === 1));
  assert.equal(delivered.playerMotion, 6);
});

test('Homeless Legend survives one knockout and rallies every other Plant ally', () => {
  const legend = unit('homelesslegend', 'player', 0, 1);
  legend.powerModifier = -3;
  const ally = unit('rastamon', 'player', 1, 2);
  const source = createCardInstance('simmy', 'cpu', 'character-wave', 3);
  const match: Match = { ...createMatch('block', 'block'), round: 4, phase: 'cpu-reveal', cpuMotion: 9, cpuHand: [source],
    playerHand: [], boards: [[legend], [ally], []] };
  const after = playTurnCard(match, 'cpu', source.instanceId, 0);
  assert.equal(getEffectiveCardPower(find(after, legend.instanceId)!), 1);
  assert.equal(find(after, legend.instanceId)?.legendSaved, true);
  assert.equal(find(after, ally.instanceId)?.powerModifier, 1);
});

test('Apostles and Cologne Criminal turn their element into a real deck engine', () => {
  const street = unit('streetapostle', 'player', 0, 1);
  const remotePlant = unit('rastamon', 'player', 2, 2);
  const arrival = createCardInstance('stonerjr', 'player', 'character-wave', 3);
  let match: Match = { ...createMatch('block', 'block'), round: 3, playerMotion: 9, playerHand: [arrival],
    boards: [[street], [], [remotePlant]] };
  const spread = playTurnCard(match, 'player', arrival.instanceId, 1);
  assert.equal(find(spread, remotePlant.instanceId)?.powerModifier, 2);

  const asphalt = unit('asphaltapostle', 'player', 0, 4);
  const earth = unit('landlord', 'player', 0, 5);
  const held = nextRound({ ...createMatch('block', 'block'), round: 3, phase: 'resolved', playerHand: [], cpuHand: [],
    boards: [[asphalt, earth], [], []] });
  assert.equal(find(held, earth.instanceId)?.powerModifier, 2);
  assert.equal(find(held, earth.instanceId)?.statuses.protected, true);

  const cologne = unit('colognecriminal', 'player', 1, 6);
  const lawless = createCardInstance('lawlessyn', 'player', 'character-wave', 7);
  const enemy = unit('hooper', 'cpu', 0, 8);
  match = { ...createMatch('block', 'block'), round: 3, playerMotion: 9, playerHand: [lawless],
    boards: [[enemy], [cologne], []] };
  const sampled = playTurnCard(match, 'player', lawless.instanceId, 0);
  assert.equal(find(sampled, cologne.instanceId)?.powerModifier, 2);
});
