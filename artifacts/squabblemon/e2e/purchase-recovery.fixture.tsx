import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { getGetPlayerBootstrapQueryKey, type PlayerBootstrap } from '@workspace/api-client-react';
import { Shop } from '../src/pages/game/Shop';
import { rewardReceipts } from '../src/lib/rewardReceiptStore';
import { profileBootstrap } from './fighter-id.fixture';
import '../src/index.css';
const initial=profileBootstrap({id:'recovery-player-a',softCurrency:5000,packTickets:7,settings:{reducedMotion:true,turnTimerEnabled:true}});
const key=getGetPlayerBootstrapQueryKey(), client=new QueryClient({defaultOptions:{queries:{retry:false}}});
client.setQueryData(key,initial);
const notifications:string[]=[];const show=rewardReceipts.show.bind(rewardReceipts);
rewardReceipts.show=receipt=>{notifications.push(receipt.id);show(receipt);};
function Sample(){
  const [visible,setVisible]=useState(true);
  const {data}=useQuery({queryKey:key,queryFn:async()=>initial,initialData:initial,enabled:false});
  Object.assign(window,{__purchaseRecovery:{
    hide:()=>setVisible(false),show:()=>setVisible(true),
    switchAccount:()=>client.setQueryData(key,profileBootstrap({id:'recovery-player-b',softCurrency:7300,settings:{reducedMotion:true,turnTimerEnabled:true}})),
    snapshot:()=>({bootstrap:client.getQueryData<PlayerBootstrap>(key),notifications:[...notifications]}),
  }});
  return visible?<Shop bootstrap={data}/>:<p data-testid="purchase-left">Shop unmounted</p>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><Sample/></QueryClientProvider>);
