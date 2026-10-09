import { STARTER_MYTHIC } from './starterMythic';
export type BountyTask = 'training'|'training-win'|'friendly'|'friendly-win'|'pvp'|'pvp-win'|'cleanse'|'movement-win'|'story-win'|'neighborhood-win'|'draft-win'|'challenge-win'|'fire-win'|'support-win'|'sweep-win'|'boss-win';
export type BountyReward = {softCurrency:number;packTickets:number;styleShards:number};
export type BountyNode = {id:string;title:string;description:string;tip:string;task:BountyTask;goal:number;href:string;reward:BountyReward};
const node=(id:string,title:string,task:BountyTask,goal:number,description:string,tip:string,href:string,index:number):BountyNode=>({id,title,task,goal,description,tip,href,reward:index===0?{softCurrency:150,packTickets:0,styleShards:0}:index===1?{softCurrency:0,packTickets:1,styleShards:0}:{softCurrency:250,packTickets:0,styleShards:10}});
const training='/game/training',friends='/game/online?tab=friends',pvp='/game/online',story='/game/story',challenge='/game/challenges';
/** Chain alternates inward from the original bar's outer seats. */
export const LEGEND_BOUNTIES = [
 {id:'block-party-titan',name:'Block Party Titan',title:'Everybody Outside',theme:'titan',accent:'#f5a137',flavor:'Turn up the speakers. Show the whole block you can hold your own.',nodes:[
 node('soundcheck','Soundcheck','training',3,'Finish 3 training fades.','Complete the full fade. Wins, draws and losses count.',training,0),
 node('invite-the-block','Invite the Block','friendly',2,'Finish 2 friendly fades.','Invite a friend and play to the final result. Surrenders do not count.',friends,1),
 node('main-stage','Main Stage','pvp',2,'Finish 2 real-player Fade Park battles.','Play ranked against real opponents. Bot matches and surrenders do not count.',pvp,2)]},
 {id:'ashlee',name:'Ashlee',title:'Big Heart, Bigger Backup',theme:'ashlee',accent:'#92bb63',flavor:'A crew is only as strong as the person looking out for it.',nodes:[
 node('looking-out','Looking Out','cleanse',2,'Cleanse a frozen or silenced ally in 2 verified fades.','Bring a cleanser. The server checks that a real negative status was removed.',training,0),
 node('crew-first','Crew First','story-win',3,'Win 3 story battles.','Take your support crew into the campaign. Challenge-run battles are separate.',story,1),
 node('protect-the-block','Protect the Block','neighborhood-win',1,'Win a Neighborhood battle.','Enter a Neighborhood activity and finish with a win.',challenge,2)]},
 {id:'p-tang',name:'P. Tang',title:'Belt Check',theme:'ptang',accent:'#e7bb45',flavor:'Timing, positioning, and a little disrespect. Make every move count.',nodes:[
 node('slide-through','Slide Through','movement-win',2,'Win 2 fades with a moved ally in a winning district.','Movement must help secure a district. Verified training or story battles count.',training,0),
 node('friendly-reminder','Friendly Reminder','friendly-win',2,'Win 2 full friendly fades.','Finish against a real friend; surrender and timeout results do not count.',friends,1),
 node('belt-check','Belt Check','pvp-win',1,'Win a real-player Fade Park battle.','Win a complete ranked battle against a human opponent.',pvp,2)]},
 {id:'simmy',name:'Simmy',title:'After Hours',theme:'simmy',accent:'#d58baf',flavor:'Stay patient. Keep your heart guarded. Let the result speak.',nodes:[
 node('quiet-confidence','Quiet Confidence','training-win',2,'Win 2 training fades.','Practice your opening, then secure the districts.',training,0),
 node('rose-from-concrete','Rose from Concrete','draft-win',2,'Win 2 Street Draft battles.','Build from the draft offer and adapt your play.',challenge,1),
 node('after-hours','After Hours','pvp',3,'Finish 3 real-player Fade Park battles.','Wins, losses and draws count when the full ranked battle completes.',pvp,2)]},
 {id:'folks',name:'FOLKS',title:'Whole Block Hot',theme:'folks',accent:'#ff7339',flavor:'Bring the heat without burning your own crew. The block is watching.',nodes:[
 node('heat-check','Heat Check','fire-win',3,'Win 3 verified fades after playing a Fire character.','The Fire character must actually be played, not just sit in your deck.',training,0),
 node('hold-the-line','Hold the Line','challenge-win',3,'Win 3 Challenge Run encounters.','Enter Straight to the Back and earn three encounter victories.',challenge,1),
 node('whole-block-hot','Whole Block Hot','pvp-win',2,'Win 2 real-player Fade Park battles.','Finish the full human-ranked battle with a win.',pvp,2)]},
 {id:'kyle',name:'KYLE',title:'Good Company',theme:'kyle',accent:'#83c5f4',flavor:'Good company. Big smiles. A little chaos when the timing is right.',nodes:[
 node('good-company','Good Company','friendly',3,'Finish 3 friendly fades.','Call someone out, then play through the final district result.',friends,0),
 node('big-grin','Big Grin','sweep-win',2,'Win all 3 districts in 2 verified fades.','Training or story battles count. Spread your Hands across the board.',training,1),
 node('last-laugh','Last Laugh','challenge-win',4,'Win 4 Challenge Run encounters.','Build a steady run in Straight to the Back. No perfect streak required.',challenge,2)]},
 {id:'foodz',name:'Foodz',title:'Everybody Eats',theme:'foodz',accent:'#efd56e',flavor:'Feed the crew. Clean up the mess. Everybody leaves with something.',nodes:[
 node('fresh-plate','Fresh Plate','cleanse',3,'Cleanse a frozen or silenced ally in 3 verified fades.','Only real removed statuses count; a wasted cleanse does not.',training,0),
 node('family-table','Family Table','support-win',3,'Win 3 verified fades after playing a Support-role card.','Play the support card during the battle, then finish with a win.',training,1),
 node('everybody-eats','Everybody Eats','boss-win',1,'Win an After Hours boss battle.','Bring your support crew into an After Hours activity.',challenge,2)]},
] as const;
export const LEGEND_SEAT_ORDER=['block-party-titan','p-tang','folks','foodz','kyle','simmy','ashlee'] as const;
export const legendBountyKey=(id:string)=>`legend-bar:${id}:v1`;
export const legendNodeKey=(id:string,nodeId:string)=>`legend-bar:${id}:node:${nodeId}:v2`;
export function readBountyCounters(value:unknown):Record<string,number>{
 if(!value||typeof value!=='object')return {};
 return Object.fromEntries(Object.entries(value).filter(([,v])=>typeof v==='number'&&Number.isFinite(v)&&v>=0)) as Record<string,number>;
}
export function legendBountyStatuses(_gameplay:unknown,_cosmetics:readonly string[],owned:readonly string[],claimed:readonly string[],counters:unknown={}){
 const saved=readBountyCounters(counters);const homelessComplete=claimed.includes(STARTER_MYTHIC.key);
 return LEGEND_BOUNTIES.map((b,index)=>{
 const collected=claimed.includes(legendBountyKey(b.id));
 const predecessor=index===0?homelessComplete:claimed.includes(legendBountyKey(LEGEND_BOUNTIES[index-1].id));
 const available=homelessComplete&&predecessor;
 const nodes=b.nodes.map((n,i)=>{
 const done=collected||claimed.includes(legendNodeKey(b.id,n.id));
 const open=available&&(i===0||claimed.includes(legendNodeKey(b.id,b.nodes[i-1].id)));
 const progress=done?n.goal:Math.min(n.goal,saved[legendNodeKey(b.id,n.id)]??0);
 return {...n,progress,state:done?'claimed' as const:!open?'locked' as const:progress>=n.goal?'ready' as const:'active' as const};
 });
 const currentNode=nodes.find(n=>n.state!=='claimed');
 return {...b,order:index+1,nodes,currentNodeId:currentNode?.id??null,progress:nodes.filter(n=>n.state==='claimed').length,goal:3,ownsCard:owned.includes(b.id),
 gate:!homelessComplete?'Complete and collect Nothing to Lose first.':!predecessor?`Recruit ${LEGEND_BOUNTIES[index-1].name} first.`:null,
 rule:collected?'Bounty complete':!available?'Follow the bounty trail':currentNode?.description??'Recruit your legend',
 state:collected?'claimed' as const:!available?'locked' as const:currentNode?.state==='ready'?'ready' as const:'active' as const};
 });
}
export type LegendBountyStatus=ReturnType<typeof legendBountyStatuses>[number];
/** One verified event advances only the currently available node. */
export function advanceBountyCounters(statuses:LegendBountyStatus[],counters:unknown,tasks:readonly BountyTask[]){
 const next=readBountyCounters(counters);const bounty=statuses.find(b=>b.state==='active');
 const n=bounty?.nodes.find(n=>n.id===bounty.currentNodeId);
 if(bounty&&n?.state==='active'&&tasks.includes(n.task)){const key=legendNodeKey(bounty.id,n.id);next[key]=Math.min(n.goal,(next[key]??0)+1);}
 return next;
}
