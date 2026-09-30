import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogCardById, cardCatalog, cards, STORY_ONLY_CARD_IDS, validateCardAbilityUpgrades, validateSavedDeck } from './src/data.ts';
import { createAbilityUpgradeSnapshot, createCardInstance, createMatch, playTurnCard } from './src/gameEngine.ts';
import { STORY_CHARACTER_WAVE } from './src/storyCharacterWave.ts';

const ids = STORY_CHARACTER_WAVE.map(([id]) => id);
const blank = () => ({ ...createMatch('block', 'block'), round: 1, playerMotion: 9, cpuMotion: 9,
  boards: [[], [], []], playerHand: [], cpuHand: [] });
const unit = (id, owner, lane = 0, index = 0) => ({
  ...createCardInstance(id, owner, 'story-character-wave-test', index), lane,
});
const find = (match, id) => match.boards.flat().find(card => card.cardId === id);
function cast(match, id, owner = 'player', targetLane = 0, level = 1) {
  const source = createCardInstance(id, owner, 'story-character-wave-cast', match.nextEventSequence);
  const snapshot = createAbilityUpgradeSnapshot(owner === 'player' ? [id] : [], owner === 'cpu' ? [id] : [], {
    [owner]: { [id]: { level, xp: 2800, moveTier: level >= 8 ? 3 : 0 } },
  });
  return playTurnCard({ ...match, abilityUpgradeSnapshot: snapshot, phase: owner === 'player' ? 'player' : 'cpu-reveal',
    [owner === 'player' ? 'playerHand' : 'cpuHand']: [source] }, owner, source.instanceId, targetLane);
}

test('story character cards have exact collectible identities, portraits, rarities, upgrades, and saved-deck legality', () => {
  validateCardAbilityUpgrades();
  const expectedRarities = {
    'ganger-blue': 'Epic', 'ganger-red': 'Epic', snitch: 'Mythical', 'cracked-head': 'Legendary',
  };
  assert.deepEqual(STORY_ONLY_CARD_IDS, ids);
  for (const [id] of STORY_CHARACTER_WAVE) {
    const card = catalogCardById[id];
    assert.equal(card.engineId, id);
    assert.equal(card.catalogId, id);
    assert.equal(card.artworkId, id);
    assert.equal(card.rarity, expectedRarities[id]);
    assert.equal(card.artworkLayout, 'portrait');
    assert.deepEqual(card.acquisitionSources, ['Story Rewards']);
    assert.equal(card.abilityUpgrades.length, 3);
    assert.deepEqual(card.abilityUpgrades.map(upgrade => upgrade.unlockLevel), [2, 5, 8]);
  }
  const extras = cardCatalog.filter(card => !ids.includes(card.engineId)).slice(0, 6).map(card => card.catalogId);
  const deck = [...ids, ...extras];
  assert.equal(validateSavedDeck(deck, deck, 'ganger-blue').valid, true);
  assert.equal(cards['cracked-head'].cost, 5);
});

test('Ganger Blue protects and grows the weakest remote ally, with a solo fallback', () => {
  let match = blank();
  const remote = unit('cornball', 'player', 1, 1);
  const local = unit('wifey', 'player', 0, 2);
  match.boards[0] = [local];
  match.boards[1] = [remote];
  let after = cast(match, 'ganger-blue');
  assert.equal(find(after, 'cornball').powerModifier, 2);
  assert.equal(find(after, 'cornball').statuses.protected, true);

  match = blank();
  after = cast(match, 'ganger-blue');
  assert.equal(find(after, 'ganger-blue').powerModifier, 1);
});

test('Ganger Red damages the strongest enemy and gains only when damage lands', () => {
  const match = blank();
  const highest = unit('hooper', 'cpu', 0, 1), lower = unit('cornball', 'cpu', 0, 2);
  highest.powerModifier = 3;
  match.boards[0] = [highest, lower];
  const after = cast(match, 'ganger-red');
  assert.equal(find(after, 'hooper').powerModifier, 1);
  assert.equal(find(after, 'cornball').powerModifier, 0);
  assert.equal(find(after, 'ganger-red').powerModifier, 1);
});

test('Snitch applies targeted control with protection and immunity respected', () => {
  let match = blank();
  const target = unit('hooper', 'cpu', 0, 1);
  match.boards[0] = [target];
  let after = cast(match, 'snitch');
  assert.equal(find(after, 'hooper').statuses.silenced, true);

  match = blank();
  const alreadySilenced = unit('hooper', 'cpu', 0, 2);
  alreadySilenced.statuses.silenced = true;
  match.boards[0] = [alreadySilenced];
  after = cast(match, 'snitch');
  assert.equal(find(after, 'hooper').statuses.weakened, true);

  for (const defense of ['protected', 'uncounterable']) {
    match = blank();
    const defended = unit('hooper', 'cpu', 0, 3);
    defended.statuses[defense] = true;
    match.boards[0] = [defended];
    if (defense === 'protected') match.timedEffects = [{ id: 'snitch-shield', kind: 'church-protection',
      sourceInstanceId: defended.instanceId, targetInstanceId: defended.instanceId, owner: 'cpu', lane: 0,
      startsAtRound: 1, expiresAtRound: 99, expiration: 'match-complete' }];
    after = cast(match, 'snitch');
    assert.equal(find(after, 'hooper').statuses.silenced, false);
  }
});

test('Cracked Head hits at most three strongest enemies and caps its growth at +2', () => {
  const match = blank();
  const foes = ['hooper', 'wifey', 'cornball', 'rastamon'].map((id, index) => unit(id, 'cpu', 0, index + 1));
  foes.forEach((foe, index) => { foe.powerModifier = index === 0 ? -4 : index * 2; });
  match.boards[0] = foes;
  const after = cast(match, 'cracked-head');
  assert.equal(find(after, 'rastamon').powerModifier, 5);
  assert.equal(find(after, 'cornball').powerModifier, 3);
  assert.equal(find(after, 'wifey').powerModifier, 1);
  assert.equal(find(after, 'hooper').powerModifier, -4, 'fourth enemy is outside the bounded sweep');
  assert.equal(find(after, 'cracked-head').powerModifier, 2);
});

test('upgraded story-character effects replay deterministically for either owner', () => {
  for (const owner of ['player', 'cpu']) {
    const enemy = owner === 'player' ? 'cpu' : 'player';
    for (const id of ids) {
      const match = blank();
      match.boards[0] = [unit('hooper', enemy, 0, 1)];
      match.boards[1] = [unit('cornball', owner, 1, 2)];
      const serialized = JSON.stringify(match);
      const first = cast(match, id, owner, 0, 8);
      assert.equal(JSON.stringify(match), serialized, 'resolution must not mutate its input snapshot');
      assert.deepEqual(cast(JSON.parse(serialized), id, owner, 0, 8), first);
      assert.equal(first.effectLog.filter(event => event.abilityMetadata?.sourceCardId === id).length, 3, id);
      assert.deepEqual(JSON.parse(JSON.stringify(first.effectLog.at(-1).replay.after)), first.effectLog.at(-1).replay.after);
    }
  }
});