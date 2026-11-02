import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db, pool, playerProfilesTable, onlineRoomsTable, parkRivalStandingsTable } from '@workspace/db';
import { eq } from 'drizzle-orm';
import { createOnlineRoom, type OnlineRoom } from '@workspace/squabblemon-engine/multiplayer';
import { PARK_BOT_PERSONAS } from '@workspace/squabblemon-engine/parkBots';
import { starterRecipes, cardCatalog } from '@workspace/squabblemon-engine/data';
import { settleRankedRoom } from './onlineMatches';
import { rankedStandings } from './rankedStandings';
import { storeOnlineRoom, restoreOnlineRoom } from './onlineRoomPersistence';
test('named rival standings settle real results once under concurrent retries and roll back atomically', async () => {
  assert.equal(PARK_BOT_PERSONAS.length, 14);
  assert.equal(new Set(PARK_BOT_PERSONAS.map(p=>p.id)).size,14);
  for (const p of PARK_BOT_PERSONAS) { assert.doesNotMatch(p.name,/bot|cpu/i); assert(cardCatalog.some(c=>c.catalogId===p.avatarKey),p.avatarKey); }
  const users = [randomUUID(),randomUUID()], recipe=starterRecipes[0], now=Date.now();
  await db.insert(playerProfilesTable).values(users.map((clerkUserId,i)=>({clerkUserId,displayName:`Rival Test ${i}`,onboardingStep:'complete',storyProgress:{}})));
  async function make(userId:string) {
    const member={userId,name:'Test challenger',avatarKey:recipe.hero,ready:false,level:1,deck:{id:recipe.id,name:recipe.name,hero:recipe.hero,cards:recipe.cards}};
    const room:OnlineRoom={...createOnlineRoom(member,'player',now),status:'complete',winner:'cpu',reason:'surrender',completedAt:now,
      members:{player:member,cpu:{...member,userId:'park-bot:test',name:PARK_BOT_PERSONAS[0].name}},
      ranked:{queuedAt:now,heartbeatAt:now,botAfter:now,bot:true,botPersona:'coach',ratings:{player:1000,cpu:1000}}};
    const [row]=await db.insert(onlineRoomsTable).values({code:randomUUID().slice(0,8),hostUserId:userId,createRequestId:randomUUID(),state:storeOnlineRoom(room),expiresAt:new Date(now+60000)}).returning();return row.id;
  }
  async function settle(id:string, fail=false) {return db.transaction(async tx=>{
    const [row]=await tx.select().from(onlineRoomsTable).where(eq(onlineRoomsTable.id,id)).for('update');
    const result=await settleRankedRoom(tx,restoreOnlineRoom(row.state),now,id);
    await tx.update(onlineRoomsTable).set({state:storeOnlineRoom(result)}).where(eq(onlineRoomsTable.id,id));
    if(fail)throw Error('rollback rival');
    return result;
  });}
  try {
    const first=await make(users[0]);await Promise.all([settle(first),settle(first)]);
    let [record]=await db.select().from(parkRivalStandingsTable).where(eq(parkRivalStandingsTable.personaId,'coach'));
    assert.equal(record.stats.games,1);assert.equal(record.stats.wins,1);assert.equal(record.stats.points,12);
    const second=await make(users[1]);await assert.rejects(settle(second,true),/rollback rival/);
    [record]=await db.select().from(parkRivalStandingsTable).where(eq(parkRivalStandingsTable.personaId,'coach'));assert.equal(record.stats.games,1);
    await settle(second);[record]=await db.select().from(parkRivalStandingsTable).where(eq(parkRivalStandingsTable.personaId,'coach'));assert.equal(record.stats.games,2);
    const standings=await rankedStandings(users[0]);assert.equal(standings.total,16);assert.equal(standings.leaders.filter(p=>p.automated).length,14);
    assert.equal(standings.leaders.find(p=>p.name==='Coach Fade')?.points,24);
    assert(!JSON.stringify(standings).includes('park-bot:'));
  } finally {
    for(const id of users) await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId,id));
    await db.delete(parkRivalStandingsTable);
    await pool.end();
  }
});
