import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { getGetPlayerBootstrapQueryKey } from '@workspace/api-client-react';
import { Shop } from '../src/pages/game/Shop';
import { profileBootstrap } from './fighter-id.fixture';
import '../src/index.css';
import '../src/styles/venue.css';
const params = new URLSearchParams(location.search);
const initial = profileBootstrap({ id:'e2e-player', packTickets:50, softCurrency:10000, packHistory:[], settings:{reducedMotion:params.has('reduced'),turnTimerEnabled:false} });
const client = new QueryClient({ defaultOptions:{queries:{retry:false}} });
client.setQueryData(getGetPlayerBootstrapQueryKey(),initial);
function Fixture(){
  const {data=initial}=useQuery({queryKey:getGetPlayerBootstrapQueryKey(),queryFn:async()=>initial,staleTime:Infinity});
  return <main style={{height:'100dvh',display:'flex',flexDirection:'column',overflow:'auto'}}>
    <header style={{display:'flex',flexWrap:'wrap',gap:'12px',padding:'8px 16px',background:'#07140f',color:'#f1deb3',font:'12px/1.4 sans-serif',flexShrink:0}}>
      <strong>LOCAL SAMPLE · no real rewards or charges</strong>
      <a href="./gacha-reveal.fixture.html?phase=summary&count=6" style={{color:'inherit'}}>Card haul</a>
      <button style={{background:'none',border:0,padding:0,color:'inherit',textDecoration:'underline'}} onClick={()=>{sessionStorage.removeItem('squabblemon:pack-reveal:e2e-player');sessionStorage.removeItem('squabblemon:pack-request:e2e-player');location.reload();}}>Reset sample</button>
    </header>
    <Shop bootstrap={data}/>
  </main>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><Fixture/></QueryClientProvider>);
