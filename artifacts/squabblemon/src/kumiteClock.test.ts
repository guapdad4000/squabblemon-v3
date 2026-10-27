import assert from 'node:assert/strict';
import test from 'node:test';
import type { KumiteCurrent } from './lib/kumite';
import { kumiteBracketClock } from './lib/kumiteClock';
const server = Date.parse('2026-10-14T00:00:00Z');
const receipt = Date.parse('2030-01-01T09:00:00Z');
function state(status: KumiteCurrent['tournament']['status'] = 'registration') {
  return { serverTime: server, tournament: { status, startsAt: Date.parse('2026-10-16T00:00:00Z') } } as KumiteCurrent;
}
test('bracket countdown uses the server Friday deadline despite a wildly incorrect client calendar', () => {
  assert.deepEqual(kumiteBracketClock(state(), receipt, receipt), { label: 'BRACKET LOCK', value: '2D 00H 00M' });
});
test('elapsed client time advances the last verified server clock without shifting the deadline', () => {
  const current = state(); current.tournament.startsAt = server + 3 * 3600000;
  assert.equal(kumiteBracketClock(current, receipt + 65 * 60000, receipt).value, '01:55:00');
});
test('missing server time, receipt or deadline never produces a guessed weekly countdown', () => {
  for (const value of [undefined, { ...state(), serverTime: NaN }, { ...state(), tournament: { ...state().tournament, startsAt: NaN } }])
    assert.equal(kumiteBracketClock(value, receipt, receipt).value, 'SYNCING…');
  assert.equal(kumiteBracketClock(state(), receipt, 0).value, 'SYNCING…');
});
test('active, completed and cancelled tournaments remain distinct at both clock surfaces', () => {
  assert.deepEqual(kumiteBracketClock(state('active'), receipt, receipt), { label: 'LIVE NOW', value: 'IN PROGRESS' });
  assert.equal(kumiteBracketClock(state('complete'), receipt, receipt).value, 'COMPLETE');
  assert.equal(kumiteBracketClock(state('cancelled'), receipt, receipt).value, 'CANCELLED');
});
test('a passed registration deadline clamps to zero while waiting for the authoritative status', () => {
  assert.equal(kumiteBracketClock(state(), receipt + 3 * 86400000, receipt).value, '00:00:00');
});
