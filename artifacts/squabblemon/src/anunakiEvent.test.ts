import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ANUNAKI_STORY_CHAPTERS, anunakiClaimKey, anunakiEventStatus } from '../../../lib/squabblemon-engine/src/anunakiEvent';

const wins = Array.from({ length: 55 }, (_, i) => `battle-${i}`);
const status = (battles: string[], chapters: readonly string[], claims: string[] = [], cards: string[] = [], cosmetics: string[] = [], ready = true) => anunakiEventStatus(battles, chapters, claims, cards, cosmetics, ready);
const step = (result: ReturnType<typeof status>, id: string) => result.milestones.find(m => m.id === id)!;

test('Yakub requires the first two main chapters, not battle wins or unrelated chapters', () => {
  assert.equal(step(status(wins, ['block-party', 'special-yasuke']), 'yakub').state, 'locked');
  assert.equal(step(status(wins, ['red-side-tapes']), 'yakub').progress, 0);
  assert.equal(step(status([], ANUNAKI_STORY_CHAPTERS.slice(0,2)), 'yakub').state, 'ready');
});
test('battle thresholds deduplicate wins and disabled state never offers claims', () => {
  const result = status(['a', 'a', 'b'], [...ANUNAKI_STORY_CHAPTERS], [], [], [], false);
  assert.equal(step(result, 'first-contact').progress, 0);
  assert.ok(result.milestones.every(m => m.state === 'locked'));
});
test('claim and ownership state cover cards, mats, and sticker prerequisites', () => {
  const chapters = [...ANUNAKI_STORY_CHAPTERS];
  const before = status(wins, chapters, [], ['yakub'], ['player-mat:anunaki-yakub']);
  assert.equal(step(before, 'yakub').ownsReward, true);
  assert.equal(step(before, 'yakub-mat').ownsReward, true);
  assert.equal(step(before, 'anu-stickers').state, 'locked');
  const after = status(wins, chapters, [anunakiClaimKey('anu'), anunakiClaimKey('yakub')]);
  assert.equal(step(after, 'anu-stickers').state, 'locked', 'mastery requires actual Anunaki stars');
  assert.equal(step(after, 'yakub').state, 'claimed');
  assert.equal(after.milestones.length, 24);
});
