import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, playerProfilesTable } from '@workspace/db';
import { getDailyClout, claimDailyClout } from './dailyClout';
test('daily Clout credits once across concurrent retries and resets only on a new UTC day', async t => {
  const user = `daily-clout-${randomUUID()}`;
  await db.insert(playerProfilesTable).values({ clerkUserId: user, softCurrency: 7 });
  t.after(async () => { await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, user)); });
  const now = new Date('2026-09-25T23:59:59Z');
  assert.equal((await getDailyClout(user, now)).available, true);
  const results = await Promise.all([claimDailyClout(user, now), claimDailyClout(user, now), claimDailyClout(user, now)]);
  assert.equal(results.filter(r => r.claimed).length, 1);
  assert.equal((await getDailyClout(user, now)).available, false);
  assert.equal((await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, user)))[0].softCurrency, 57);
  const tomorrow = new Date('2026-09-26T00:00:00Z');
  assert.equal((await getDailyClout(user, tomorrow)).available, true);
  assert.equal((await claimDailyClout(user, tomorrow)).claimed, true);
  assert.equal((await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, user)))[0].softCurrency, 107);
});
test('missing player cannot collect Clout', async () => {
  await assert.rejects(() => claimDailyClout(`missing-${randomUUID()}`));
});
