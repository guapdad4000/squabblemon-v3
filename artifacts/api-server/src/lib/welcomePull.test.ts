import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { db, playerProfilesTable, playerPackOpeningsTable } from '@workspace/db';
import { eq } from 'drizzle-orm';
import { STREET_PACK_RULES } from '@workspace/squabblemon-engine/packRules';
import { openWelcomePull, welcomePullAvailable } from './welcomePull';
import { openStreetPackForPlayer } from './collectionTransactions';
async function player(t: test.TestContext, ownedCardIds: string[] = []) {
  const id = `welcome-${randomUUID()}`;
  await db.insert(playerProfilesTable).values({ clerkUserId:id, ownedCardIds, softCurrency:500, packTickets:4, packPity:3 });
  t.after(async()=>{await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId,id))});
  return id;
}
test('free welcome ticket grants Dr. Fade exactly once across concurrent requests without changing wallet or pity', async t=>{
  const id=await player(t); assert(await welcomePullAvailable(id));
  const results=await Promise.all([openWelcomePull(id),openWelcomePull(id)]);
  assert.equal(results[0].opening.id,results[1].opening.id);
  assert.equal(results.filter(r=>!r.alreadyOpened).length,1);
  assert.equal(results[0].opening.rewards[0].cardId,'dr-fade');
  assert.equal(results[0].opening.rewards[0].kind,'card');
  assert.equal(results[0].opening.cost,0);
  const [p]=await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId,id));
  assert.equal(p.softCurrency,500);assert.equal(p.packTickets,4);assert.equal(p.packPity,3);
  assert.deepEqual(p.ownedCardIds,['dr-fade']);assert(p.discoveredCardIds.includes('dr-fade'));
  assert.equal(await welcomePullAvailable(id),false);
});
test('existing mentor converts to normal duplicate shards once; retry returns same receipt',async t=>{
  const id=await player(t,['dr-fade']);
  const first=await openWelcomePull(id);const retry=await openWelcomePull(id);
  assert.equal(first.opening.id,retry.opening.id);assert(retry.alreadyOpened);
  assert.equal(first.opening.rewards[0].kind,'styleShards');
  const [p]=await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId,id));
  assert.equal(p.styleShards,STREET_PACK_RULES.duplicateStyleShards);assert.deepEqual(p.ownedCardIds,['dr-fade']);
});
test('welcome ticket cannot be claimed after a regular first opening',async t=>{
  const id=await player(t);
  await openStreetPackForPlayer(id,{idempotencyKey:randomUUID(),paymentMethod:'ticket'});
  await assert.rejects(openWelcomePull(id),/before your first opening/);
  assert.equal(await welcomePullAvailable(id),false);
  assert.equal((await db.select().from(playerPackOpeningsTable).where(eq(playerPackOpeningsTable.clerkUserId,id))).length,1);
});
