import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '@workspace/api-client-react';
import type { OnlineRoomView } from '@workspace/squabblemon-engine/multiplayer';
import { rankedLobbyPollInterval, rankedRecoveryResolved, type RankedRecovery } from './rankedLobbyRecovery';

const room = (status: OnlineRoomView['status']) => ({ status } as OnlineRoomView);
const unavailable = new ApiError(new Response('', { status: 503 }), { error: 'Unavailable' }, { method: 'GET', url: '/api/multiplayer/ranked' });

// The read preceding a search can legitimately have no room. That snapshot
// must not disable recovery after the search write loses its acknowledgement.
test('an unacknowledged search keeps polling past the old empty lobby until the server confirms the queue or match', () => {
  const recovery: RankedRecovery = { kind: 'search', until: 30000 };
  assert.equal(rankedLobbyPollInterval(null, null, null, 0), false);
  assert.equal(rankedLobbyPollInterval(null, null, recovery, 1000), 1000);
  assert.equal(rankedRecoveryResolved(recovery, null), false);
  assert.equal(rankedRecoveryResolved(recovery, room('closed')), false);
  for (const state of ['waiting', 'active', 'complete'] as const) {
    assert.equal(rankedRecoveryResolved(recovery, room(state)), true);
  }
  assert.equal(rankedLobbyPollInterval(room('active'), null, null, 2000), false);
});

test('a lost cancellation acknowledges closure or a pairing race, while an unchanged queue keeps recovering', () => {
  const recovery: RankedRecovery = { kind: 'cancel', until: 30000 };
  assert.equal(rankedRecoveryResolved(recovery, room('waiting')), false);
  assert.equal(rankedLobbyPollInterval(room('waiting'), null, recovery, 1000), 1000);
  for (const state of [null, room('closed'), room('active'), room('complete')]) {
    assert.equal(rankedRecoveryResolved(recovery, state), true);
  }
});

test('an initial connection failure recovers without a cached room, but rejected access never creates a poll loop', () => {
  assert.equal(rankedLobbyPollInterval(undefined, unavailable, null, 1000), 3000);
  assert.equal(rankedLobbyPollInterval(room('waiting'), unavailable, null, 1000), 1000);
  for (const status of [400, 401, 403, 404]) {
    const rejected = new ApiError(new Response('', { status }), { error: 'Rejected' }, { method: 'GET', url: '/api/multiplayer/ranked' });
    assert.equal(rankedLobbyPollInterval(room('waiting'), rejected, { kind: 'search', until: 30000 }, 1000), false);
  }
});

test('uncertain search recovery is bounded while a real waiting queue continues heartbeats', () => {
  const recovery: RankedRecovery = { kind: 'search', until: 30000 };
  assert.equal(rankedLobbyPollInterval(null, null, recovery, 29999), 1000);
  assert.equal(rankedLobbyPollInterval(null, null, recovery, 30000), false);
  assert.equal(rankedLobbyPollInterval(room('waiting'), null, recovery, 30001), 1000);
});
