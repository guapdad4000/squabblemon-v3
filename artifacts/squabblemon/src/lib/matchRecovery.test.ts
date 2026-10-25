import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '@workspace/api-client-react';
import { isMatchRulesUpdated } from './matchRecovery';

const responseError = (status: number, data: unknown) => new ApiError(new Response(null, { status }), data, { method: 'POST', url: '/api/player/matches/test/complete' });
test('a server rules update enables a fresh encounter instead of retrying an incompatible transcript', () => {
  assert.equal(isMatchRulesUpdated(responseError(409, { code: 'rules-updated', error: 'Start a new fade.' })), true);
});
test('network errors and unrelated conflicts never abandon the saved transcript', () => {
  for (const error of [new TypeError('Failed to fetch'), responseError(503, { code: 'rules-updated' }), responseError(409, { code: 'checkpoint-conflict' }), responseError(409, null), responseError(409, 'rules-updated'), { status: 409, data: { code: 'rules-updated' } }]) {
    assert.equal(isMatchRulesUpdated(error), false);
  }
});
