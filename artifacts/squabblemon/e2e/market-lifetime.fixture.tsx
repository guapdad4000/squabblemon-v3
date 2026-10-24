import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { getGetPlayerBootstrapQueryKey, type PlayerBootstrap } from '@workspace/api-client-react';
import { Market } from '../src/pages/game/Market';
import { rewardReceipts } from '../src/lib/rewardReceiptStore';
import { profileBootstrap } from './fighter-id.fixture';
import '../src/index.css';
const initial = profileBootstrap({ id:'training-lifetime-a', softCurrency:5000 });
const key = getGetPlayerBootstrapQueryKey();
const client = new QueryClient({ defaultOptions:{ queries:{ retry:false } } });
client.setQueryData(key, initial);
const notifications:string[] = [];
const showReceipt = rewardReceipts.show.bind(rewardReceipts);
rewardReceipts.show = receipt => { notifications.push(receipt.id); showReceipt(receipt); };
function Sample() {
  const [visible, setVisible] = useState(true);
  const { data } = useQuery({ queryKey:key, queryFn:async()=>initial, initialData:initial, enabled:false });
  Object.assign(window, { __marketLifetime:{
    hide:()=>setVisible(false), show:()=>setVisible(true),
    switchAccount:(id:string)=>client.setQueryData(key, profileBootstrap({id,softCurrency:7300})),
    snapshot:()=>({bootstrap:client.getQueryData<PlayerBootstrap>(key),notifications:[...notifications]}),
  } });
  return visible ? <Market bootstrap={data}/> : <p data-testid="training-left">Training unmounted</p>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><Sample/></QueryClientProvider>);
