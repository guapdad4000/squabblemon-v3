import assert from 'node:assert/strict';
import test from 'node:test';
import { RANK_TIERS } from '@workspace/squabblemon-engine/ranked';
import { isRankTierPromotion } from './rankPromotion';

test('same-tier RP gains, losses and absent results never promote', () => {
  for (const points of [{ before: 0, after: 25 }, { before: 100, after: 125 },
    { before: 320, after: 325 }, { before: 320, after: 305 }, { before: 110, after: 95 },
    { before: 2300, after: 2325 }, { before: 600, after: 600 }]) {
    assert.equal(isRankTierPromotion(points), false, JSON.stringify(points));
  }
  assert.equal(isRankTierPromotion(null), false);
  assert.equal(isRankTierPromotion(undefined), false);
  assert.equal(isRankTierPromotion({ before: NaN, after: 305 }), false);
  assert.equal(isRankTierPromotion({ before: 280, after: Infinity }), false);
});

test('every exact upward tier boundary promotes independently of reward receipts', () => {
  for (const { floor } of RANK_TIERS.slice(1)) {
    assert.equal(isRankTierPromotion({ before: floor - 1, after: floor }), true);
    assert.equal(isRankTierPromotion({ before: floor, after: floor + 1 }), false);
    assert.equal(isRankTierPromotion({ before: floor, after: floor - 1 }), false);
  }
  assert.equal(isRankTierPromotion({ before: 95, after: 100 }), true, 'A ranked draw can promote');
  assert.equal(isRankTierPromotion({ before: 280, after: 305 }), true, 'A re-promotion still advances tier without a new seasonal gift');
  assert.equal(isRankTierPromotion({ before: 95, after: 610 }), true, 'A multi-tier jump still opens one promotion');
});
