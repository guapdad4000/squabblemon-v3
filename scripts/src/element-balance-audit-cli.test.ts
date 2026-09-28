import assert from 'node:assert/strict';
import test from 'node:test';
import { parseElementBalanceAuditArgs } from './element-balance-audit-cli';

test('element audit CLI defaults to the full greedy schedule', () => {
  assert.deepEqual(parseElementBalanceAuditArgs([]), { seeded: false, quick: false });
});

test('element audit CLI parses seeded, quick, output directory, and version labels', () => {
  assert.deepEqual(
    parseElementBalanceAuditArgs(['--seeded', '--quick', '--out-dir=tmp/audit', '--label=v10-balance']),
    { seeded: true, quick: true, outDir: 'tmp/audit', label: 'v10-balance' },
  );
});

test('element audit CLI permits digits in labels and rejects slash, backslash, or NUL', () => {
  assert.equal(parseElementBalanceAuditArgs(['--label=patch-10']).label, 'patch-10');
  for (const label of ['bad/name', 'bad\\name', `bad${'\0'}name`]) {
    assert.throws(() => parseElementBalanceAuditArgs([`--label=${label}`]), /path separators or NUL/);
  }
});

test('element audit CLI rejects unknown, malformed, empty, and duplicate flags', () => {
  for (const args of [
    ['--unknown'],
    ['--out-dir'],
    ['--out-dir='],
    ['--label='],
    ['--quick', '--quick'],
    ['--out-dir=first', '--out-dir=second'],
  ]) {
    assert.throws(() => parseElementBalanceAuditArgs(args));
  }
});