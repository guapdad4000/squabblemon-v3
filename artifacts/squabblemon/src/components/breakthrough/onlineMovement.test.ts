import test from 'node:test';
import assert from 'node:assert/strict';
import { OnlineMovementCadence } from './onlineMovement';
test('live interpolation spans sparse frames, absorbs jitter and never predicts through reconnect', () => {
  const cadence = new OnlineMovementCadence();
  assert.equal(cadence.receive(0, 0), 200);
  assert.equal(cadence.receive(200, 200), 200);
  assert.equal(cadence.receive(400, 500), 300);
  assert.equal(cadence.receive(600, 501), 200, 'coalesced network batch cannot collapse animation to 1ms');
  assert.equal(cadence.receive(600, 502), 200, 'repeated snapshot does not restart cadence');
  assert.equal(cadence.receive(1200, 1100), 400, 'slow delivery remains bounded');
  assert.equal(cadence.receive(5000, 5000), 0, 'reconnect jumps to authoritative state');
  assert.equal(cadence.receive(5200, 5200), 200);
});
