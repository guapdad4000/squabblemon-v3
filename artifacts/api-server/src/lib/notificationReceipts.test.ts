import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, playerProfilesTable } from '@workspace/db';
import { cleanNotificationReceiptIds, getNotificationReceipts, saveNotificationReceipts } from './notificationReceipts';

test('notification receipt input is bounded, unique, and rejects malformed ids', () => {
  assert.deepEqual(cleanNotificationReceiptIds(['card:kyle', 'card:kyle', '', 7, 'x'.repeat(513)]), ['card:kyle']);
  assert.equal(cleanNotificationReceiptIds(Array.from({ length: 300 }, (_, index) => `notice:${index}`)).length, 250);
});

test('notification receipts persist per account and concurrent saves stay idempotent', async t => {
  const first = `notification-first-${randomUUID()}`;
  const second = `notification-second-${randomUUID()}`;
  t.after(async () => {
    await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, first));
    await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, second));
  });
  await db.insert(playerProfilesTable).values([
    { clerkUserId: first, displayName: 'First' },
    { clerkUserId: second, displayName: 'Second' },
  ]);

  await Promise.all([
    saveNotificationReceipts(first, ['card:kyle', 'style:badge:after-hours']),
    saveNotificationReceipts(first, ['card:kyle', 'story:block-party-crowned']),
  ]);
  assert.deepEqual((await getNotificationReceipts(first)).sort(), [
    'card:kyle',
    'story:block-party-crowned',
    'style:badge:after-hours',
  ]);
  assert.deepEqual(await getNotificationReceipts(second), []);
});
