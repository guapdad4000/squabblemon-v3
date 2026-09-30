import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { MatchCompletionGate, PresentationReadingGate, guidedNoteDuration } from './playerControlledPresentation';

test('reading waits for the matching explicit acknowledgment, not elapsed time', async () => {
  const gate = new PresentationReadingGate();
  let settled = false;
  const reading = gate.hold('match-1:event-7').then(value => { settled = true; return value; });
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(settled, false);
  assert.equal(gate.continue('match-1:event-6'), false);
  assert.equal(settled, false);
  assert.equal(gate.continue('match-1:event-7'), true);
  assert.equal(await reading, true);
  assert.equal(gate.continue('match-1:event-7'), false);
});

test('cancel and replacement release pending presentation without advancing it', async () => {
  const gate = new PresentationReadingGate();
  const old = gate.hold('old');
  const current = gate.hold('current');
  assert.equal(await old, false);
  assert.equal(gate.continue('old'), false);
  gate.cancel();
  assert.equal(await current, false);
  assert.equal(gate.continue('current'), false);
});

test('completion shares one pending save and never repeats a successful receipt', async () => {
  const gate = new MatchCompletionGate();
  let finish!: () => void;
  let saves = 0;
  const submit = async () => {
    saves++;
    await new Promise<void>(resolve => { finish = resolve; });
  };
  const first = gate.run('server-match', submit);
  const duplicate = gate.run('server-match', submit);
  assert.equal(first, duplicate);
  await Promise.resolve();
  assert.equal(saves, 1);
  finish();
  await first;
  await gate.run('server-match', submit);
  assert.equal(saves, 1);
});

test('failed completion is retryable without repeating success side effects', async () => {
  const gate = new MatchCompletionGate();
  let attempts = 0;
  let receipts = 0;
  const submit = async () => {
    if (++attempts === 1) throw new Error('Connection interrupted');
    receipts++;
  };
  await assert.rejects(gate.run('retryable-match', submit), /Connection interrupted/);
  await Promise.all([gate.run('retryable-match', submit), gate.run('retryable-match', submit)]);
  await gate.run('retryable-match', submit);
  assert.equal(attempts, 2);
  assert.equal(receipts, 1);
});

test('different match IDs finalize separately and guided notes retain readable duration', async () => {
  const gate = new MatchCompletionGate();
  let saves = 0;
  await Promise.all(['a', 'b'].map(id => gate.run(id, async () => { saves++; })));
  assert.equal(saves, 2);
  const note = 'Cornball reduced enemy Hands in this district.';
  assert.equal(guidedNoteDuration(note, 90), guidedNoteDuration(note, 650));
  assert.ok(guidedNoteDuration(note, 90) >= 2400);
  assert.equal(guidedNoteDuration(note, 9000), 9000);
});