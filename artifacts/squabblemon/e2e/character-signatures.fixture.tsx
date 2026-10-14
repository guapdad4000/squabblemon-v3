import React from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider,useQuery} from '@tanstack/react-query';
import {getGetPlayerBootstrapQueryKey,type PlayerBootstrap} from '@workspace/api-client-react';
import {CharacterStyles} from '../src/pages/game/CharacterStyles';
import {CharacterCollections} from '../src/pages/game/CharacterCollections';
import {DeckCarousel} from '../src/components/DeckCarousel';
import '../src/index.css';
import '../src/styles/venue.css';
import {cardCatalog} from '../src/data';
const ids=cardCatalog.map(c=>c.catalogId);
const bootstrap = {
  profile: {
    id: 'e2e-player', displayName: 'Sticker Test', avatarKey: 'guap', onboardingStep: 'complete',
    starterDeckId: null, streetRep: 0, xp: 0, level: 1, softCurrency: 500, packTickets: 3,
    styleShards: 1000, packPity: 0, deckSlots: 4, cosmeticCurrency: 0, collectionProgress: ids.length,
    storyChapter: 0, storyNode: 0, tutorialCompleted: true, starterRewardClaimed: true,
    ageConfirmedAt: new Date(0).toISOString(), termsAcceptedAt: new Date(0).toISOString(),
    settings: { reducedMotion: false, turnTimerEnabled: false }, ownedCardIds: ids,
    cardProgression: {}, discoveredCardIds: ids, ownedVariants: [], equippedVariants: {},
    unlockedCosmeticIds: [], unlockedCharacterIds: [], savedDecks: [], storyProgress: {},
    inbox: [], packHistory: [], lastActiveAt: new Date(0).toISOString(),
  },
  missions: [], collectionRoad: [],
  nextAction: { id: 'test', eyebrow: 'Test', title: 'Test', description: '', destination: 'play', rewardLabel: null },
  packConfig: { id: 'test', name: 'Test', oddsVersion: 'test', softCurrencyCost: 100, ticketCost: 1, rewardsPerPack: 1, pityLimit: 10, odds: [] },
  tenPullConfig: { id: 'test', name: 'Test', oddsVersion: 'test', pullCount: 10, ticketCost: 10, softCurrencyCost: 1000, rewardsPerPull: 1, rarePityBonusPerPull: 1 },
} as unknown as PlayerBootstrap;

const params=new URLSearchParams(location.search);
if(params.get('owned')==='false')bootstrap.profile.ownedCardIds=[];
bootstrap.profile.settings.reducedMotion=true;
document.documentElement.dataset.reducedMotion='true';
const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});
function Preview(){
 const {data}=useQuery({queryKey:getGetPlayerBootstrapQueryKey(),queryFn:async()=>bootstrap,initialData:bootstrap});
 const id=params.get('card')??'franklin-duke';
 if(params.get('view')==='collections')return <CharacterCollections bootstrap={data}/>;
 if(params.get('view')==='decks')return <DeckCarousel decks={['bushedo-brown','franklin-duke','chonk-lee'].map(heroCardId=>({id:heroCardId,name:heroCardId,heroCardId,cardIds:ids.slice(0,10)}))} selectedId="franklin-duke" onSelect={()=>{}} onOpen={()=>{}}/>;
 return <CharacterStyles bootstrap={data} cardId={id}/>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={client}><Preview/></QueryClientProvider></React.StrictMode>);
