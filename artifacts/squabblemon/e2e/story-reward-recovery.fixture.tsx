import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGetPlayerStory } from '@workspace/api-client-react';
import { NodeOverlay, Story } from '../src/pages/game/Story';
import { RewardReveal } from '../src/components/RewardReveal';
import { rewardReceipts } from '../src/lib/rewardReceipts';
import '../src/index.css';
const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
function Fixture() {
 const {data} = useGetPlayerStory();
 const nodeId = new URLSearchParams(location.search).get('node') ?? 'block-crowned';
 const receiptOnly = new URLSearchParams(location.search).has('receipt');
 const showReceipt = (id:string, long=false) => rewardReceipts.show({
  id,title:long?'The Whole Block Remembers':'Block Crowned',
  items:long?Array.from({length:22},(_,i)=>({label:`An exceptionally long neighborhood reward name number ${i+1}`,amount:i+1,glyph:i%2?'ticket':'clout'} as const)):[{label:'Clout',amount:250,glyph:'clout'},{label:'Street Pack Tickets',amount:10,glyph:'ticket'}],
  story:{chapterTitle:long?'A long chapter title that wraps gracefully':'Block Party',backgroundAssetId:'assets/story/chapter-one/environments/map.webp',cloutBalance:{from:675,to:925}},
 });
 return <div style={{position:'relative',height:'100dvh'}}>{new URLSearchParams(location.search).has('panel')
  ? <Story bootstrap={{profile:{id:'fixture-player'}} as any} />
   : receiptOnly ? <><button data-testid="show-animated-story-receipt" onClick={()=>showReceipt('animated-claim')}>Show receipt</button><button data-testid="show-skippable-story-receipt" onClick={()=>showReceipt('skippable-claim')}>Show skip receipt</button><button data-testid="show-long-story-receipt" onClick={()=>showReceipt('long-claim',true)}>Show long receipt</button></>
   : data && <NodeOverlay nodeId={nodeId} campaign={data} onClose={()=>{document.title='Map'}} onStartBattle={()=>{}} />}<RewardReveal /></div>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><Fixture /></QueryClientProvider>);
