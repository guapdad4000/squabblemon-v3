import test from 'node:test';
import assert from 'node:assert/strict';
import { highestPackRewardRarity } from './packRewardRarity';

test('all-SuperCommon receipts keep the lowest-tier rarity tell', () => {
  assert.equal(highestPackRewardRarity([{ rarity: 'SuperCommon' }, { rarity: 'SuperCommon' }]), 'SuperCommon');
});
test('the highest issued rarity wins regardless of reveal order and currency entries', () => {
  const receipt = [{ rarity: 'Rare' }, {}, { rarity: 'Mythical' }, { rarity: 'Common' }, { rarity: 'Legendary' }];
  assert.equal(highestPackRewardRarity(receipt), 'Mythical');
  assert.equal(highestPackRewardRarity([...receipt].reverse()), 'Mythical');
});
test('missing or unknown rarities use the neutral fallback without inventing a higher tier', () => {
  assert.equal(highestPackRewardRarity([]), 'Common');
  assert.equal(highestPackRewardRarity([{}, { rarity: 'currency' }, { rarity: 'constructor' }]), 'Common');
  assert.equal(highestPackRewardRarity([{ rarity: 'constructor' }, { rarity: 'SuperCommon' }]), 'SuperCommon');
});
