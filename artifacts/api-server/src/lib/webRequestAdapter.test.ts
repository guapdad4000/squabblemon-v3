import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { webRequestAdapter } from './webRequestAdapter';
import Stripe from 'stripe';

test('hosting adapter preserves JSON, query parameters, auth headers, and separate cookies', async () => {
  const app = express(); app.use(express.json());
  app.post('/api/echo', (req,res) => {
    res.setHeader('set-cookie',['session=a; HttpOnly; Secure','other=b; HttpOnly; Secure']);
    res.status(201).json({body:req.body, query:req.query, auth:req.header('authorization'), cookie:req.header('cookie'), host:req.header('x-forwarded-host')});
  });
  const response = await webRequestAdapter(app)(new Request('https://game.example/api/echo?tag=one&tag=two',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer test',cookie:'session=a','x-forwarded-host':'forged.example'},body:JSON.stringify({item:'ticket',text:'✓'})}));
  assert.equal(response.status,201);
  assert.deepEqual(await response.json(),{body:{item:'ticket',text:'✓'},query:{tag:['one','two']},auth:'Bearer test',cookie:'session=a',host:'game.example'});
  assert.equal(response.headers.getSetCookie().length,2);
});
test('hosting adapter preserves binary bodies and empty 204 responses', async () => {
  const app = express(); app.get('/api/binary',(_req,res)=>res.type('application/octet-stream').send(Buffer.from([0,128,255]))); app.post('/api/empty',(_req,res)=>res.status(204).end());
  const handle=webRequestAdapter(app);
  assert.deepEqual(new Uint8Array(await (await handle(new Request('https://game.example/api/binary'))).arrayBuffer()),new Uint8Array([0,128,255]));
  const empty=await handle(new Request('https://game.example/api/empty',{method:'POST'}));assert.equal(empty.status,204);assert.equal(await empty.text(),'');
});

test('Netlify adapter preserves signed UTF-8 JSON bytes before parsers or auth', async () => {
  const app = express();
  const secret = 'whsec_adapter_fixture_not_a_credential';
  // Whitespace, Unicode, and escape spelling must remain byte-for-byte intact.
  const raw = Buffer.from('{\n "id": "evt_adapter", "livemode": false, "text": "Clout ✓ café", "escaped": "\\u0061"\n}\n');
  const signature = Stripe.webhooks.generateTestHeaderString({ payload: raw.toString('utf8'), secret });
  app.post('/api/payments/webhook', express.raw({ type: 'application/json', inflate: false }), (req, res) => {
    assert.ok(Buffer.isBuffer(req.body));
    assert.deepEqual(req.body, raw);
    Stripe.webhooks.constructEvent(req.body, req.header('stripe-signature')!, secret, 300);
    res.json({ received: true });
  });
  app.use(express.json());
  app.use((_req, res) => { res.status(401).json({ error: 'Authentication required' }); });
  const handle = webRequestAdapter(app);
  const response = await handle(new Request('https://game.example/api/payments/webhook', {
    method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': signature }, body: raw,
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { received: true });
  assert.equal((await handle(new Request('https://game.example/api/player/payments/orders'))).status, 401);
});
