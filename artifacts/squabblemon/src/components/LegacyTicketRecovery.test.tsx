import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ShopRequest } from '@workspace/squabblemon-engine/economy';
import { LegacyTicketRecovery } from './LegacyTicketRecovery';
import { profileBootstrap } from '../../e2e/fighter-id.fixture';
import { saveShopRequest } from '../lib/shopJournal';
function render(t:TestContext, pending?:ShopRequest, player='ticket-player') {
  const original=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage'), values=new Map<string,string>();
  const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
  Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:storage});
  t.after(()=>{if(original)Object.defineProperty(globalThis,'sessionStorage',original);else Reflect.deleteProperty(globalThis,'sessionStorage');});
  if(pending)saveShopRequest(storage,'ticket-player',pending);
  const client=new QueryClient(),bootstrap=profileBootstrap({id:player});
  const html=renderToStaticMarkup(<QueryClientProvider client={client}><LegacyTicketRecovery bootstrap={bootstrap}/></QueryClientProvider>);
  client.clear();return html;
}
const idempotencyKey='16cd92ec-6f16-41ba-8652-98ce19064b09';
test('legacy ticket panel offers recovery only for an existing ticket request',t=>{
  const html=render(t,{itemId:'ticket',idempotencyKey});
  assert.match(html,/Recover ticket purchase/);assert.doesNotMatch(html,/Buy|200 Clout|Open pack/);
});
test('no journal means no ticket offer',t=>assert.equal(render(t),''));
test('a foreign shop intent is not claimed by ticket recovery',t=>assert.equal(render(t,{itemId:'training',cardId:'kyle',idempotencyKey}),''));
test('another account cannot see the ticket recovery panel',t=>assert.equal(render(t,{itemId:'ticket',idempotencyKey},'other-player'),''));
