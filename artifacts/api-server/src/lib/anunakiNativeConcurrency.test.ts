import assert from 'node:assert/strict';
import test from 'node:test';
import { sql } from 'drizzle-orm';
import { db } from '@workspace/db';

test('native PostgreSQL holds independent transaction connections simultaneously', { skip: process.env.ANUNAKI_NATIVE_TEST_OWNED !== '1' }, async () => {
  const version = await db.execute(sql`select version() as version`);
  assert.match(String(version.rows[0]?.version), /PostgreSQL/);
  assert.doesNotMatch(String(version.rows[0]?.version), /PGlite/i);
  let entered = 0;
  let release!: () => void;
  const both = new Promise<void>(resolve => { release = resolve; });
  const hold = () => db.transaction(async tx => {
    const result = await tx.execute(sql`select pg_backend_pid() as pid`);
    if (++entered === 2) release();
    await both;
    return Number(result.rows[0]?.pid);
  });
  const [first, second] = await Promise.all([hold(), hold()]);
  assert.notEqual(first, second);
});
