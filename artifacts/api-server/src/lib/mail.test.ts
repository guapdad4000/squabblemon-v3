import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import express from 'express';
import { eq } from 'drizzle-orm';
import { db, playerProfilesTable as profiles } from '@workspace/db';
import { deliverMail, getMail, updateMail, parseMail, isMail } from './mail';
import router from '../routes/mail';

const letter = () => ({ id: `mail-${randomUUID()}`, title: 'A gift from the block', body: 'Thanks for playing.', sender: 'The team', gift: { softCurrency: 500, packTickets: 2, styleShards: 30 } });
async function player(t: test.TestContext, softCurrency = 0) {
  const id=`mail-player-${randomUUID()}`;
  await db.insert(profiles).values({ clerkUserId: id, softCurrency });
  t.after(async () => { await db.delete(profiles).where(eq(profiles.clerkUserId,id)); });
  return id;
}
test('mail validates gifts, preflights recipients, preserves unread state, and credits exactly once under concurrent claims', async t => {
  const id=await player(t), other=await player(t), message=letter();
  assert.throws(() => parseMail({...message,id:undefined}));
  assert.throws(() => parseMail({...message,gift:{...message.gift,packTickets:-1}}));
  assert.throws(() => parseMail({...message,gift:{...message.gift,softCurrency:1.5}}));
  assert.equal(isMail({ ...parseMail(message), gift: undefined }),false);
  assert.equal((await deliverMail(message,[id])).delivered,0);
  assert.equal((await getMail(id)).length,0);
  await assert.rejects(deliverMail(message,[id,'missing-profile'],true));
  assert.equal((await getMail(id)).length,0);
  await Promise.all([deliverMail(message,[id],true),deliverMail(message,[id],true)]);
  assert.equal((await getMail(id)).length,1);
  assert.equal((await getMail(id))[0].readAt,null);
  await assert.rejects(updateMail(other,message.id,true));
  await updateMail(id,message.id,false);
  assert.ok((await getMail(id))[0].readAt);
  assert.equal((await getMail(id))[0].claimedAt,null);
  const results=await Promise.all(Array.from({length:8},()=>updateMail(id,message.id,true)));
  assert.equal(results.filter(r=>r.credited).length,1);
  const [profile]=await db.select().from(profiles).where(eq(profiles.clerkUserId,id));
  assert.equal(profile.softCurrency,500); assert.equal(profile.packTickets,2); assert.equal(profile.styleShards,30);
  await deliverMail(message,[id],true);
  assert.ok((await getMail(id))[0].claimedAt);
  await assert.rejects(deliverMail({...message,body:'Changed'},[id],true));
});
test('failed credit rolls back mail and all wallet fields together',async t=>{
  const id=await player(t,2147483600), message=letter();
  await deliverMail(message,[id],true);
  await assert.rejects(updateMail(id,message.id,true));
  assert.equal((await getMail(id))[0].claimedAt,null);
  assert.equal((await getMail(id))[0].readAt,null);
  const [profile]=await db.select().from(profiles).where(eq(profiles.clerkUserId,id));
  assert.equal(profile.softCurrency,2147483600); assert.equal(profile.packTickets,0);
});
test('mail HTTP routes require authentication and isolate recipients',async t=>{
  const id=await player(t), other=await player(t), message=letter(); await deliverMail(message,[id],true);
  const app=express();
  app.use((req,_res,next)=>{const userId=req.header('x-test-user-id');(req as any).auth=Object.assign(()=>({userId,sessionId:'mail-test',tokenType:'session_token',isAuthenticated:!!userId}),{[Symbol.for('@clerk/express.auth')]:true});next();});
  app.use('/api',router); const server=app.listen(0,'127.0.0.1'); await new Promise<void>(resolve=>server.once('listening',resolve));
  t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
  const address=server.address() as {port:number}; const url=`http://127.0.0.1:${address.port}/api/player/mail`;
  assert.equal((await fetch(url)).status,401);
  assert.equal((await fetch(`${url}/${message.id}/claim`,{method:'POST'})).status,401);
  assert.deepEqual(await (await fetch(url,{headers:{'x-test-user-id':other}})).json(),{messages:[]});
  assert.equal((await fetch(`${url}/${message.id}/claim`,{method:'POST',headers:{'x-test-user-id':other}})).status,409);
  assert.equal((await fetch(`${url}/${message.id}/claim`,{method:'POST',headers:{'x-test-user-id':id}})).status,200);
});
// Broadcast affects every profile: exercise it only on the runner's disposable native cluster.
if(process.env.MAIL_TEST_OWNED==='1') test('all-player broadcast delivers once to every existing account and preserves unrelated inbox entries',async t=>{
  const a=await player(t),b=await player(t),message=letter();
  await db.update(profiles).set({inbox:[{type:'legacy',text:'Keep me'}]}).where(eq(profiles.clerkUserId,a));
  assert.equal((await deliverMail(message,'all')).delivered,0);
  assert.equal((await deliverMail(message,'all',true)).delivered,2);
  assert.equal((await deliverMail(message,'all',true)).delivered,0);
  assert.equal((await getMail(a)).length,1);assert.equal((await getMail(b)).length,1);
  const [profile]=await db.select().from(profiles).where(eq(profiles.clerkUserId,a));
  assert.deepEqual(profile.inbox[0],{type:'legacy',text:'Keep me'});
});
