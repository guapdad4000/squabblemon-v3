const BASE_URL = import.meta.env?.BASE_URL ?? '/';
export const RELAXED_IDLE = 'Fadewood_Relaxed_Idle';
export const AMBIENT_PACKS = Object.freeze(['og-blue','og-red','cornball','ganger-blue','ganger-red']);
const idle = (seconds=12,clip=RELAXED_IDLE)=>({clip,seconds,loop:true,idle:true});
const action = (clip,seconds,loop=false)=>({clip,seconds,loop});
const exercise = ()=>[action('idle_to_push_up',2.566666603088379),action('push_up',9,true),action('push_up_to_idle',3.066666603088379)];
/** Authored actions with quiet intervals; never random reactions or root-motion walks. */
export const AMBIENT_SCHEDULES = Object.freeze({
 'og-blue':[idle(8),action('Punch_Combo_3',6.5333333015441895,true),idle(13),...exercise(),idle(17)],
 'og-red':[idle(17),action('Stand_Talking_Angry',20.799999237060547),idle(12),...exercise(),idle(14)],
 'cornball':[idle(10,'Idle_02'),action('FunnyDancing_03',8),idle(14,'Idle_02'),action('All_Night_Dance',8.166666984558105),idle(9,'Idle_02')],
 'ganger-blue':[idle(9),action('Punch_Combo_1',4.400000095367432,true),idle(16),action('Punch_Combo_3',3.2666666507720947)],
 'ganger-red':[idle(18,'Idle_03'),action('Punch_Combo',2.4666666984558105),idle(14,'Idle_03')],
 'squabble-house-manager':[idle(12),action('Shouting_Angrily',7.166666507720947),idle(18)],
 'inmate-kingpin':[idle(11),action('Right_Upper_Hook_from_Guard',3.4666664600372314,true),idle(17)],
 'blue-yb':[idle(8,'Idle_5'),action('Boxing_Practice',6.833333492279053),idle(13,'Idle_5')],
 'dr-fade':[idle(15),action('Alert',4),idle(18),action('Boxing_Practice',6.833333492279053)],
 'officer-oinkston':[idle(10),action('Catching_Breath',7),idle(20)],
 'snitch':[idle(13),action('Head_Hold_in_Pain',3.700000047683716),action('Headache_Relief',4.833333492279053),idle(19)],
 'cracked-head':[idle(19),action('Zombie_Scream',2.799999952316284),idle(21)],
 'demario':[idle(12),action('Wave_One_Hand',4.099999904632568),idle(9)],
 'luigion':[idle(17)],
});
export function sampleAmbientAction(id,elapsedSeconds=0){
 const schedule=AMBIENT_SCHEDULES[id]; if(!schedule)return null;
 const total=schedule.reduce((sum,stage)=>sum+stage.seconds,0);
 const elapsed=Number.isFinite(elapsedSeconds)?Math.max(0,elapsedSeconds):0;
 let local=elapsed%total;
 for(let index=0;index<schedule.length;index++){
  const stage=schedule[index]; if(local<stage.seconds||index===schedule.length-1)return {...stage,index,local,cycle:Math.floor(elapsed/total)};
  local-=stage.seconds;
 }
}
/** Five tiny animation-only requests; meshes and textures remain shared. */
export async function loadAmbientAnimations(loader,{baseUrl=BASE_URL+'assets/ambient/'}={}){
 const result={};let next=0;
 async function worker(){while(next<AMBIENT_PACKS.length){const id=AMBIENT_PACKS[next++],asset=await loader.loadAsync(baseUrl+id+'.glb');
  if(!asset?.animations?.length)throw new Error('Missing authored actions for '+id);
  result[id]=asset.animations;
 }}
 await Promise.all([worker(),worker()]);return result;
}
/** Presentation clock follows the existing scene loop. Approaching a host settles it. */
export function createAmbientActions({cast,placements=[]}={}){
 const casts=Array.isArray(cast)?cast:[cast],wrappers=new Map(),owners=new Map();
 for(const owner of casts)for(const actor of owner?.group?.children??[]){const id=actor.userData.characterId;if(id){wrappers.set(id,actor);owners.set(id,owner);}}
 const states=placements.filter(p=>AMBIENT_SCHEDULES[p.id]&&wrappers.has(p.id)).map(p=>({id:p.id,placement:p,actor:wrappers.get(p.id),owner:owners.get(p.id),time:0,near:false,key:null,stage:null,settle:null}));
 let previous=0,disposed=false;
 return {
  update(elapsedSeconds,{playerPosition=null,activeCharacterId=null,reducedMotion=false}={}){
   if(disposed)return;
   const time=Number.isFinite(elapsedSeconds)?Math.max(0,elapsedSeconds):previous,backwards=time<previous,delta=backwards?0:time-previous;
   const player=Array.isArray(playerPosition)?playerPosition:playerPosition?.toArray?.();
   for(const state of states){
    if(backwards){state.time=time;state.key=null;state.near=false;state.settle=null;}
    const wasNear=state.near;
    const active=activeCharacterId===state.id||activeCharacterId===state.placement.locationId;
    const allowNearby=state.id==='demario'||state.id==='luigion';
    if(player?.every(Number.isFinite)&&!allowNearby){const p=state.actor.position;const distance=Math.hypot(player[0]-p.x,player[2]-p.z);state.near=Math.abs(player[1]-p.y)<2&&distance<(state.near?4.2:3.4);}else state.near=false;
    let beganSettle=false;
    if(active||reducedMotion)state.settle=null;
    else if(state.near&&!wasNear&&['idle_to_push_up','push_up'].includes(state.stage?.clip)){state.settle=0;beganSettle=true;}
    if(state.settle!==null&&!beganSettle){state.settle+=delta;if(state.settle>=3.066666603088379)state.settle=null;}
    const settling=state.settle!==null,quiet=active||state.near||reducedMotion||settling;
    if(quiet)state.time=0;else state.time+=delta;
    const stage=settling?{clip:'push_up_to_idle',seconds:3.066666603088379,loop:false,idle:false,index:-1,local:state.settle,cycle:0}:quiet?{...AMBIENT_SCHEDULES[state.id][0],index:0,local:0,cycle:0}:sampleAmbientAction(state.id,state.time);
    const key=settling?'settle:'+stage.clip:quiet?'quiet:'+stage.clip:`${stage.cycle}:${stage.index}:${stage.clip}`;
    if(state.key!==key){
     const okay=state.owner.setAnimation(state.id,stage.clip,{loop:stage.loop,clampWhenFinished:!stage.loop,restart:!stage.idle||backwards,seek:!stage.idle||backwards,time:stage.local,fadeDuration:quiet ? .28 : .3,groundSupport:true});
     if(!okay)throw new Error(`Missing ambient clip ${stage.clip} for ${state.id}`);
     state.key=key;
    }
    state.stage={clip:stage.clip,phase:settling?'settle':stage.idle?'idle':'action',quiet,local:stage.local,cycle:stage.cycle};
   }
   previous=time;
  },
  sample:()=>disposed?[]:states.map(state=>({id:state.id,...state.stage})),
  dispose(){disposed=true;states.length=0;wrappers.clear();owners.clear();},
 };
}
