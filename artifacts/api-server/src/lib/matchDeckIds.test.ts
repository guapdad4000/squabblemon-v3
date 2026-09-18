import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { SavePlayerDeckParams, StartPlayerMatchBody } from '@workspace/api-zod';

test('every supported saved-deck ID length can start a practice or story match', () => {
  const ids = ['starter-rookie', randomUUID(), ...Array.from({ length: 78 }, (_, i) => 'd'.repeat(i + 3))];
  for (const playerDeckId of ids) {
    assert.ok(SavePlayerDeckParams.safeParse({ deckId: playerDeckId }).success);
    for (const mode of ['practice', 'story']) {
      const parsed = StartPlayerMatchBody.safeParse({ mode, playerDeckId, rivalDeckId: 'block', storyNodeId: 'welcome-to-the-block' });
      assert.ok(parsed.success, `${mode} must accept a saved ${playerDeckId.length}-character deck ID`);
      assert.equal(parsed.data.playerDeckId, playerDeckId, 'deck identity must not be truncated');
    }
  }
});

test('match requests still reject deck IDs beyond the saved-deck limit', () => {
  const playerDeckId = 'd'.repeat(81);
  assert.equal(SavePlayerDeckParams.safeParse({ deckId: playerDeckId }).success, false);
  assert.equal(StartPlayerMatchBody.safeParse({ mode: 'practice', playerDeckId, rivalDeckId: 'block' }).success, false);
});
