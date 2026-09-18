import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { webRequestAdapter } from './webRequestAdapter';

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
