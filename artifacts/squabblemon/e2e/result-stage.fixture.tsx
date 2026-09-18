import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ResultScreen} from '../src/components/ResultScreen';
import {createMatch,createCardInstance,type Match} from '../src/gameEngine';
import {getStoryBattle} from '@workspace/squabblemon-engine/story';
import {districts} from '../src/data';
import '../src/index.css';
function Fixture(){
 const state=new URLSearchParams(location.search).get('state') ?? 'win';
 const [error,setError]=useState(state==='error');
 const match:Match={...createMatch('block','slide'),phase:'complete',round:6};
 const owner=state==='loss'?'cpu':'player';
 if(state!=='draw')match.boards=[['hooper','cornball'],['wifey'],['rastamon']].map((ids,lane)=>ids.map((id,i)=>({...createCardInstance(id,owner,'fixture',i),lane,playedRound:1}))) as Match['boards'];
 if(state==='story')match.storyEncounter=getStoryBattle('welcome-to-the-block')!.encounter;
 const reward={id:'visual',softCurrency:40,xp:50,streetRep:8,packTickets:0,cardXp:[{cardId:'cornball',xpGained:30,previousLevel:1,level:2,xp:130,moveTier:0},{cardId:'hooper',xpGained:30,previousLevel:3,level:3,xp:400,moveTier:0}],storyRewards:state==='story'?[{rewardKey:'first',description:'First-clear Street Pack Ticket'}]:[]};
 const action=(name:string)=>()=>{document.title=name;};
 return <ResultScreen match={match} districts={districts} reward={error?undefined:reward} rewardError={error?'Offline':null} onRetryReward={()=>setError(false)} rewardPending={false} isGuest={false} equippedVariants={{cornball:'cornball:chrome'}} storyMetadata={state==='story'?{outcome:'win',stars:3,firstClear:true}:undefined} onRestart={action('Restart requested')} onChangeDeck={action('Crew change requested')} onGoHome={action('Home requested')}/>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
