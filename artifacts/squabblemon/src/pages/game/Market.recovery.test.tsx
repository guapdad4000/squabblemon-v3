import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router } from 'wouter';
import type { ShopRequest } from '@workspace/squabblemon-engine/economy';
import { Market } from './Market';
import { profileBootstrap } from '../../../e2e/fighter-id.fixture';
import { saveShopRequest } from '../../lib/shopJournal';
import { shopPurchaseDestination } from '../../lib/shopDestination';
function render(t:TestContext, pending:ShopRequest) {
  const values=new Map<string,string>(), originals=Object.fromEntries(['sessionStorage','location'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
  Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:storage});Object.defineProperty(globalThis,'location',{configurable:true,value:{search:'?item=training&card=kyle'}});
  t.after(()=>{for(const [key,original] of Object.entries(originals)){if(original)Object.defineProperty(globalThis,key,original);else Reflect.deleteProperty(globalThis,key);}});
  const bootstrap=profileBootstrap({ownedCardIds:['cornball','kyle']});saveShopRequest(storage,bootstrap.profile.id,pending);
  const client=new QueryClient();const html=renderToStaticMarkup(<Router ssrPath="/game/shop?view=training"><QueryClientProvider client={client}><Market bootstrap={bootstrap}/></QueryClientProvider></Router>);client.clear();return html;
}
const key='89dbe5b8-9512-4a27-9938-44e589bcc653';
for(const request of [{itemId:'tagged-style',cardId:'cornball'},{itemId:'common-recruit',cardId:'young-bull'},{itemId:'player-mat',cardId:'kyle'},{itemId:'character-stickers',cardId:'kyle'},{itemId:'deck-slot'}] satisfies Omit<ShopRequest,'idempotencyKey'>[]) {
  test(`training keeps ${request.itemId} recovery on its owning counter`,t=>{
    const html=render(t,{...request,idempotencyKey:key});
    assert.ok(html.includes(`href="${shopPurchaseDestination(request).replaceAll('&','&amp;')}"`));
    assert.match(html,/data-training-purchase="true" disabled=""/);assert.doesNotMatch(html,/Your Style Shards/);
  });
}
test('a pending training purchase pins the original item and character despite a different URL',t=>{
  const html=render(t,{itemId:'training-intensive',cardId:'cornball',idempotencyKey:key});
  assert.match(html,/Intensive Training/);assert.match(html,/data-value="cornball"/);assert.match(html,/Recover session/);assert.doesNotMatch(html,/Finish your pending purchase first/);
});
