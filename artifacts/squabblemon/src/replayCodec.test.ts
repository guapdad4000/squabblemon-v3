import test from 'node:test';
import assert from 'node:assert/strict';
import { compactMatchReplay, restoreMatchReplay, createMatch, pass, revealCpuTurn, nextRound } from '@workspace/squabblemon-engine/gameEngine';
import { shareReplaySnapshot } from '../../../lib/squabblemon-engine/src/replayCodec';
const json = <T>(value: T): T => JSON.parse(JSON.stringify(value));
test('defensive snapshots share stable subtrees and isolate subsequent in-place mutations', () => {
  const input = { cards: [{ id: 'one', stats: { power: 3 } }], optional: undefined };
  const first = shareReplaySnapshot(input), second = shareReplaySnapshot(input, first);
  assert.equal(first, second); assert.notEqual(first.cards, input.cards);
  input.cards[0].stats.power = 9;
  const third = shareReplaySnapshot(input, second);
  assert.equal(first.cards[0].stats.power, 3); assert.equal(third.cards[0].stats.power, 9);
  assert.deepEqual(json(third), json(input));
  assert.deepEqual(shareReplaySnapshot({ cards: [] }, third), { cards: [] });
});
test('lossless replay archives preserve every frame and subsequent deterministic turns', () => {
  let full = 0, compact = 0;
  for (const deck of ['vibes', 'squabblehouse-shift']) {
    let match = createMatch(deck, 'vibes');
    for (let round = 0; round < 6 && match.phase !== 'complete'; round++) {
      match = revealCpuTurn(pass(match, 'player'));
      const encoded = compactMatchReplay(match), restored = restoreMatchReplay<typeof match>(json(encoded));
      assert.deepEqual(json(restored), json(match));
      assert.deepEqual(json(nextRound(restored)), json(nextRound(match)));
      const legacy = json(match); assert.equal(restoreMatchReplay(legacy), legacy);
      full += JSON.stringify(match).length; compact += JSON.stringify(encoded).length;
      match = nextRound(match);
    }
  }
  assert(full > 0); assert(compact < full * 0.65, `archive bytes ${compact}/${full}`);
  console.log(JSON.stringify({ replayArchiveBytes: { full, compact, reduction: 1 - compact / full } }));
});
test('unknown/incomplete replay archives fail closed', () => {
  const encoded = compactMatchReplay(createMatch('vibes', 'vibes'));
  assert.throws(() => restoreMatchReplay({ ...encoded, replayArchive: { version: 2, frames: [] } } as never), /Unsupported/);
  assert.throws(() => restoreMatchReplay({ ...encoded, replayArchive: { version: 1, frames: [null] } } as never), /Unsupported/);
});

test('snapshot values preserve historical JSON omission, sparse arrays and nonfinite normalization', () => {
  const sparse: any[] = []; sparse.length = 3; sparse[1] = undefined;
  const value = { omitted: undefined, numbers: [NaN, Infinity, -Infinity, -0], sparse, nested: { time: new Date('2026-01-01T00:00:00Z') } };
  assert.deepEqual(shareReplaySnapshot(value), json(value));
  assert.deepEqual(shareReplaySnapshot({ b: 1 }, { a: 1 } as never), { b: 1 });
});

test('lossless JSON keys cannot inherit, disappear or mutate snapshot prototypes', () => {
  const before = JSON.parse('{"toString":1,"__proto__":{"sentinel":"own-data"}}');
  const after = JSON.parse('{"constructor":2,"__proto__":{"sentinel":"changed"}}');
  assert.deepEqual(shareReplaySnapshot(before), before);
  assert.deepEqual(shareReplaySnapshot(after, before), after);
  const match = { effectLog: [ { replay: { before, after } }, { replay: { before: after, after: {} } } ] };
  const restored = restoreMatchReplay<typeof match>(json(compactMatchReplay(match)));
  assert.deepEqual(restored, match);
  assert.equal(Object.getPrototypeOf(restored.effectLog[0].replay.after), Object.prototype);
  assert.equal(({} as { sentinel?: string }).sentinel, undefined);
});
