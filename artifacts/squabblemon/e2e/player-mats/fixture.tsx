import React, {useEffect} from 'react';
import {Router, Route, Switch, Redirect, Link, useLocation, useSearch} from 'wouter';
import {memoryLocation} from 'wouter/memory-location';
import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider,useQuery} from '@tanstack/react-query';
import {getGetPlayerBootstrapQueryKey,type PlayerBootstrap} from '@workspace/api-client-react';
import {planShopPurchase} from '@workspace/squabblemon-engine/economy';
import {validateCosmeticLoadout} from '@workspace/squabblemon-engine/cosmetics';
import {CharacterCollections} from '../../src/pages/game/CharacterCollections';
import {CinemaNavSheet} from '../../src/components/venue/GameNav';
import {CharacterStyles} from '../../src/pages/game/CharacterStyles';
import '../../src/index.css';
// Isolated browser fixture: no authenticated service or live wallet is contacted.
const key='player-mat-review-profile';
const initial={profile:{id:'mat-review',displayName:'Review Fighter',ownedCardIds:[],discoveredCardIds:[],ownedVariants:[],unlockedCosmeticIds:[],cardProgression:{},styleShards:600,styleShardBalances:{Legendary:150,Mythical:100,Rare:100},softCurrency:100,packTickets:0,deckSlots:4,collectionProgress:0,settings:{reducedMotion:matchMedia('(prefers-reduced-motion:reduce)').matches,cosmetics:{}},storyProgress:{'welcome-to-the-block':{cleared:true},'og-uncles-visit':{cleared:true}}}} as unknown as PlayerBootstrap;
const params=new URLSearchParams(location.search);
if(params.has('poor')){initial.profile.styleShards=0;initial.profile.styleShardBalances={};}
if(params.has('owned'))initial.profile.ownedCardIds=['kyle','guap','captain-jigga','ashlee','simmy'];
let bootstrap:PlayerBootstrap=JSON.parse(sessionStorage.getItem(key)??'null')??initial;
const original=window.fetch.bind(window);
let dropReply=new URLSearchParams(location.search).has('recover');
window.fetch=async(input,init)=>{
  const url=String(input);
  if(!url.includes('/api/player/'))return original(input,init);
  const respond=(data:unknown,status=200)=>Promise.resolve(new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}}));
  if(url.includes('/bootstrap'))return respond(bootstrap);
  try{
    const body=JSON.parse(String(init?.body));
    if(url.includes('/shop/purchases')){
      const receiptKey='mat-receipt:'+body.idempotencyKey;
      const prior=sessionStorage.getItem(receiptKey);
      if(prior)return respond({bootstrap,receipt:JSON.parse(prior)});
      const result=planShopPurchase(bootstrap.profile,body);
      bootstrap={...bootstrap,profile:{...bootstrap.profile,...result.wallet}};
      sessionStorage.setItem(key,JSON.stringify(bootstrap));sessionStorage.setItem(receiptKey,JSON.stringify(result.receipt));
      if(dropReply){dropReply=false;return respond({error:'Simulated lost reply'},503);}
      return respond({bootstrap,receipt:result.receipt});
    }
    if(url.includes('/cosmetics')){
      const invalid=validateCosmeticLoadout(bootstrap.profile,body);if(invalid)return respond({error:invalid},400);
      bootstrap={...bootstrap,profile:{...bootstrap.profile,settings:{...bootstrap.profile.settings,cosmetics:body}}};
      sessionStorage.setItem(key,JSON.stringify(bootstrap));return respond(bootstrap);
    }
  }catch(error){return respond({error:String(error)},400);}
  return respond({error:'Unknown fixture route'},404);
};
const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});
client.setQueryData(getGetPlayerBootstrapQueryKey(),bootstrap);
const navigation=memoryLocation({path:params.has('legacy')?'/game/mats':params.get('view')==='characters'?'/game/style?view=characters':sessionStorage.getItem('mat-review-route')??'/game/style',record:true});
(window as unknown as {matReviewNavigation:typeof navigation}).matReviewNavigation=navigation;
function Preview(){
 const {data=bootstrap}=useQuery({queryKey:getGetPlayerBootstrapQueryKey(),queryFn:async()=>bootstrap});
 const [path,navigate]=useLocation(),search=useSearch();
 useEffect(()=>{sessionStorage.setItem('mat-review-route',path+(search?'?'+search:''));},[path,search]);
 return <div className="game-shell__content" data-testid="style-scroll" style={{height:'100dvh',overflow:'auto',background:'#0e0c09'}}>
  {params.has('nav') && <CinemaNavSheet location={path} navigate={navigate} rewards={0}/>}
  <Switch>
   <Route path="/game/mats"><Redirect to="/game/style?view=mats"/></Route>
   <Route path="/game/style"><CharacterCollections bootstrap={data}/></Route>
   <Route path="/game/style/:cardId">{p=><CharacterStyles bootstrap={data} cardId={p.cardId}/>}</Route>
   <Route><main style={{padding:32}}><h1>{path==='/game/story'?'Story':'Fixture destination'}</h1><Link href="/game/style?view=mats">Back to Style</Link></main></Route>
  </Switch>
 </div>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><Router hook={navigation.hook}><Preview/></Router></QueryClientProvider>);
