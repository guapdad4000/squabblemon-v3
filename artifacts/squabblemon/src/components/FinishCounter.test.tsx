import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router } from 'wouter';
import { FinishCounter } from './FinishCounter';
import { profileBootstrap } from '../../e2e/fighter-id.fixture';
import { saveShopRequest } from '../lib/shopJournal';
function render(t: TestContext, {owned=true,pending=false}={}) {
  const original=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage'), values=new Map<string,string>();
  const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
  Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:storage});
  t.after(()=>{if(original)Object.defineProperty(globalThis,'sessionStorage',original);else Reflect.deleteProperty(globalThis,'sessionStorage');});
  const bootstrap=profileBootstrap({ownedCardIds:owned?['cornball']:[],discoveredCardIds:['cornball'],styleShards:200});
  if(pending)saveShopRequest(storage,bootstrap.profile.id,{idempotencyKey:'89dbe5b8-9512-4a27-9938-44e589bcc653',itemId:'deck-slot'});
  const client=new QueryClient();
  const html=renderToStaticMarkup(<Router ssrPath="/game/style?view=finishes&item=chrome-style&card=cornball"><QueryClientProvider client={client}><FinishCounter bootstrap={bootstrap}/></QueryClientProvider></Router>);
  client.clear();return html;
}
test('finish counter renders the real selected print, matching wallet and actual shop price',t=>{
  const html=render(t);assert.match(html,/data-card-variant="chrome"/);assert.match(html,/data-layered-card="true"/);assert.match(html,/aria-label="Your Style Shards"/);assert.match(html,/Unlock Chrome Finish · 140/);assert.match(html,/View &amp; equip|Inspect Cornball/);
});
test('foreign pending purchase links to its own recovery counter and disables new finish spending',t=>{
  const html=render(t,{pending:true});assert.match(html,/Extra Gang Slot purchase still needs confirmation/);assert.match(html,/href="\/game\/shop\?view=corner&amp;item=deck-slot"/);assert.match(html,/disabled="">Unlock Chrome Finish/);assert.doesNotMatch(html,/>Recover purchase</);
});
test('empty collections have no purchasable character or invented finish ownership',t=>{
  const html=render(t,{owned:false});assert.match(html,/Choose an owned character to preview a finish/);assert.match(html,/Find your first character/);assert.match(html,/disabled="">Unlock Chrome Finish/);assert.doesNotMatch(html,/Already unlocked|data-card-variant="chrome"/);
});
