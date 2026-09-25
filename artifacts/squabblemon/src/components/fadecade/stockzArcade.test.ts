import assert from 'node:assert/strict';
import test from 'node:test';
import { createStockzGate, resolveStockzOrder, isSettledStockzRound, signedClout, stockzClock, stockzReceipts, stockzTrace } from './stockzArcadeModel.ts';

const round = {
  id: 'test-order', ticker: 'DURG', direction: 'up' as const, stake: 25,
  openPrice: 120, startedAt: '2026-09-25T12:00:00Z', closesAt: '2026-09-25T12:00:30Z', date: '2026-09-25',
};
const win = { ...round, closePrice: 132, payout: 50 };
const loss = { ...round, id: 'loss', closePrice: 108, payout: 0 };

test('Stockz distinguishes pending rounds from verified zero-payout losses', () => {
  assert.equal(isSettledStockzRound(round), false);
  assert.equal(isSettledStockzRound({ ...round, closePrice: 130 }), false);
  assert.equal(isSettledStockzRound({ ...round, payout: 0 }), false);
  assert.equal(isSettledStockzRound(win), true);
  assert.equal(isSettledStockzRound(loss), true);
});
test('Stockz rejects malformed financial receipt values', () => {
  for (const value of [NaN, Infinity, -1]) {
    assert.equal(isSettledStockzRound({ ...win, payout: value }), false);
    assert.equal(isSettledStockzRound({ ...win, stake: value }), false);
    assert.equal(isSettledStockzRound({ ...win, closePrice: value }), false);
    assert.equal(isSettledStockzRound({ ...win, openPrice: value }), false);
  }
  assert.equal(isSettledStockzRound(null), false);
  assert.equal(isSettledStockzRound(undefined), false);
  assert.equal(isSettledStockzRound({ ...win, stake: 0 }), false);
});
test('Stockz timer uses server timestamps rather than counting interval ticks', () => {
  assert.deepEqual(stockzClock(round, Date.parse(round.startedAt)), { valid: true, seconds: 30, progress: 0 });
  assert.deepEqual(stockzClock(round, Date.parse(round.startedAt) + 15000), { valid: true, seconds: 15, progress: 0.5 });
  assert.deepEqual(stockzClock(round, Date.parse(round.closesAt)), { valid: true, seconds: 0, progress: 1 });
});
test('Stockz resumes after tab sleep and clamps elapsed progress', () => {
  assert.deepEqual(stockzClock(round, Date.parse(round.closesAt) + 600000), { valid: true, seconds: 0, progress: 1 });
  assert.equal(stockzClock(round, Date.parse(round.startedAt) - 10000).progress, 0);
  assert.equal(stockzClock(round, Date.parse(round.closesAt) - 1).seconds, 1);
});
test('Stockz invalid timestamps cannot enable an early settlement', () => {
  for (const invalid of [undefined, null, { ...round, closesAt: 'bad' }, { ...round, startedAt: round.closesAt }, { ...round, closesAt: round.startedAt }]) {
    assert.deepEqual(stockzClock(invalid, Date.now()), { valid: false, seconds: 0, progress: 0 });
  }
  assert.equal(stockzClock(round, NaN).valid, false);
});
test('Stockz receipt totals use net return, not gross payout or pending entries', () => {
  const summary = stockzReceipts([win, loss, round]);
  assert.equal(summary.net, 0);
  assert.equal(summary.wins, 1);
  assert.equal(summary.receipts.length, 2);
  assert.deepEqual(stockzReceipts([]), { receipts: [], wins: 0, net: 0 });
  assert.equal(stockzReceipts([win]).net, 25);
  assert.equal(stockzReceipts([loss]).net, -25);
});
test('Stockz signed Clout labels are unambiguous', () => {
  assert.equal(signedClout(25), '+25');
  assert.equal(signedClout(-25), '−25');
  assert.equal(signedClout(0), '0');
  assert.equal(signedClout(1250), '+1,250');
});
test('Stockz gate blocks double submissions synchronously and unlocks for retry', () => {
  const gate = createStockzGate();
  assert.equal(gate.acquire(), true);
  assert.equal(gate.acquire(), false);
  assert.equal(gate.acquire(), false);
  gate.release();
  assert.equal(gate.acquire(), true);
  gate.release();
});
test('Stockz each mounted account gets an independent request gate', () => {
  const a = createStockzGate(), b = createStockzGate();
  assert.equal(a.acquire(), true);
  assert.equal(b.acquire(), true);
  assert.equal(a.acquire(), false);
});
test('Stockz decorative trace is stable across re-renders', () => {
  assert.deepEqual(stockzTrace('same', 0.5), stockzTrace('same', 0.5));
  assert.notDeepEqual(stockzTrace('first', 0.5), stockzTrace('second', 0.5));
  assert.ok(stockzTrace('same', 0.5).line.startsWith('M20.0,108'));
});
test('Stockz trace handles all elapsed progress without NaN or unbounded points', () => {
  for (const progress of [-10, 0, 0.25, 1, 100, NaN, Infinity]) {
    const trace = stockzTrace('a', progress);
    assert.ok(Number.isFinite(trace.last.x));
    assert.ok(Number.isFinite(trace.last.y));
    assert.ok(trace.last.x >= 20 && trace.last.x <= 580);
    assert.ok(!trace.line.includes('NaN'));
    assert.ok(trace.line.split(' ').length <= 37);
  }
});
test('Stockz reveal endpoint matches the verified direction and remains in the viewbox', () => {
  assert.ok(stockzTrace(win.id, 1, win).last.y < 108);
  assert.ok(stockzTrace(loss.id, 1, loss).last.y > 108);
  assert.equal(stockzTrace(win.id, 1, win).last.x, 580);
  for (const receipt of [win, loss, { ...win, closePrice: 1000000 }]) {
    const end = stockzTrace(receipt.id, 1, receipt).last;
    assert.ok(end.y > 20 && end.y < 190);
  }
});

test('Stockz a retry reuses its original ID and all choices', () => {
  const pending = { id: 'once-only', ticker: 'DURG', direction: 'up' as const, stake: 25 };
  const retry = resolveStockzOrder(pending, { ticker: 'SNKR', direction: 'down', stake: 100 }, () => { throw new Error('must not generate a retry ID'); });
  assert.equal(retry, pending);
  assert.equal(retry.stake, 25);
});
test('Stockz a fresh order snapshots choices exactly once', () => {
  let calls = 0;
  const choices = { ticker: 'BODE', direction: 'down' as const, stake: 10 };
  const order = resolveStockzOrder(null, choices, () => { calls++; return 'new-order'; });
  choices.stake = 100;
  assert.deepEqual(order, { id: 'new-order', ticker: 'BODE', direction: 'down', stake: 10 });
  assert.equal(calls, 1);
});
