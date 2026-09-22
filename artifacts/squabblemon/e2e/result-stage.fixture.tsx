import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createPortal} from 'react-dom';
import {ResultScreen} from '../src/components/ResultScreen';
import {MultiplayerBattle} from '../src/components/MultiplayerBattle';
import {createMatch,createCardInstance,type Match} from '../src/gameEngine';
import {applyOnlineCommand,createOnlineRoom,joinOnlineRoom,onlineRoomView,type OnlineRoom} from '@workspace/squabblemon-engine/multiplayer';
import {getStoryBattle} from '@workspace/squabblemon-engine/story';
import {decks,districts} from '../src/data';
import '../src/index.css';
import '../src/styles/multiplayer.css';
function Fixture(){
 const state=new URLSearchParams(location.search).get('state') ?? 'win';
 const [error,setError]=useState(state==='error');
 const [reviewBoard,setReviewBoard]=useState(false);
 const match:Match={...createMatch('block','slide'),phase:'complete',round:6};
 const owner=state==='loss'?'cpu':'player';
 if(state!=='draw')match.boards=[['hooper','cornball'],['wifey'],['rastamon']].map((ids,lane)=>ids.map((id,i)=>({...createCardInstance(id,owner,'fixture',i),lane,playedRound:1}))) as Match['boards'];
 if(state==='story')match.storyEncounter=getStoryBattle('welcome-to-the-block')!.encounter;
 const reward={id:'visual',softCurrency:40,xp:50,streetRep:8,packTickets:0,cardXp:[{cardId:'cornball',xpGained:30,previousLevel:1,level:2,xp:130,moveTier:0},{cardId:'hooper',xpGained:30,previousLevel:3,level:3,xp:400,moveTier:0}],storyRewards:state==='story'?[{rewardKey:'first',description:'First-clear Street Pack Ticket'}]:[]};
 const action=(name:string)=>()=>{document.title=name;document.body.dataset.action=name;};
 return <div data-testid="transformed-result-parent" style={{height:'100dvh',transform:'translateZ(0)',overflow:'auto'}}>
   <div data-testid="final-board" style={{height:'180dvh',paddingTop:'70dvh',background:'linear-gradient(#17221d,#493b27)',color:'white',textAlign:'center'}}>Final board inspection</div>
   {reviewBoard && createPortal(<button className="result-stage__return" onClick={()=>setReviewBoard(false)}>View result</button>,document.body)}
   {!reviewBoard && <ResultScreen match={match} districts={districts} reward={error || state==='pending'?undefined:reward} rewardError={error?'Offline':null} onRetryReward={()=>setError(false)} rewardPending={state==='pending'} isGuest={state==='guest'} equippedVariants={{cornball:'cornball:chrome'}} storyMetadata={state==='story'?{outcome:'win',stars:3,firstClear:true}:undefined} onInspectBoard={()=>setReviewBoard(true)} onRestart={action('Restart requested')} onChangeDeck={action('Gang change requested')} onGoHome={action('Home requested')}/>}
 </div>;
}
function OnlineFixture(){
 const [room,setRoom]=useState<OnlineRoom>(()=>{
   const now=Date.now(),deck=decks.find(deck=>deck.id==='block')!;
   let next=joinOnlineRoom(createOnlineRoom({userId:'host',name:'Host',ready:false,deck},'player',now),{userId:'guest',name:'Guest',ready:false,deck},now);
   next=applyOnlineCommand(next,'player',{type:'ready'},now);
   next=applyOnlineCommand(next,'cpu',{type:'ready'},now);
   const finished={...next.match!,phase:'complete' as const,round:6};
   finished.boards=[['cornball'],['hooper'],['wifey']].map((ids,lane)=>ids.map((id,i)=>({...createCardInstance(id,'cpu','online-result',i),lane,playedRound:1}))) as Match['boards'];
   return {...next,status:'complete',winner:'cpu',reason:'districts',deadline:null,match:finished};
 });
 return <div style={{transform:'translate3d(0,0,0)'}}><MultiplayerBattle room={onlineRoomView(room,'RESULT','host',Date.now())} busy={false} connected reducedMotion send={command=>setRoom(current=>applyOnlineCommand(current,'player',command,Date.now()))} onLeave={()=>{document.body.dataset.action='Online exit';}} /></div>;
}
createRoot(document.getElementById('root')!).render(new URLSearchParams(location.search).get('flow')==='online'?<OnlineFixture/>:<Fixture/>);
