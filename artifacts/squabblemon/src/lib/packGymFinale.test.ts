import assert from 'node:assert/strict';
import test from 'node:test';
import { PACK_GYM_FINALE_TIMING, PACK_GYM_RARITY_FLIGHT, normalizePackGymRarity, packGymFinaleSpeed, packGymFinaleArt, packGymFinaleMedia, startPackGymFinale } from './packGymFinale';
import { createPackGymAudio, takePackGymFinaleSounds, packGymFlightProgress, packGymFinaleSpeed as sceneSpeed, bagFinaleFrame, PACK_GYM_FINALE_TIMING as sceneTiming, PACK_GYM_RARITY_FLIGHT as sceneRarities, normalizePackGymRarity as normalizeSceneRarity } from '../../public/scenes/gym/finale.js';
import { CARD_RARITY_DEFINITIONS } from '../../../../lib/squabblemon-engine/src/data';
function fakeClock() {
  let now = 0, id = 0;
  const jobs = new Map<number, { at: number; run: () => void }>();
  const clock = { now: () => now, schedule: (run: () => void, delay: number) => { const key = ++id; jobs.set(key, { at: now + delay, run }); return key; }, cancel: (key: unknown) => { jobs.delete(key as number); } };
  return { clock, jobs, advance(ms: number) { const end = now + ms; for (;;) { const job = [...jobs].sort((a,b) => a[1].at-b[1].at)[0]; if (!job || job[1].at > end) break; now = job[1].at; jobs.delete(job[0]); job[1].run(); } now = end; } };
}
test('three punch cels lead to a fast launch, POV and uninterrupted smoke transition', () => {
  assert.deepEqual(PACK_GYM_FINALE_TIMING, sceneTiming);
  const time = fakeClock(), stages: string[] = []; let completed = 0;
  startPackGymFinale({ pullCount: 1, clock: time.clock, onStage: stage => stages.push(stage), onComplete: () => completed++ });
  assert.deepEqual(stages, ['compression']);
  for (const [delay, stage] of [[90,'contact'],[140,'release'],[120,'flight'],[900,'flight-pov'],[1400,'impact']] as const) {
    const previous=stages.at(-1);time.advance(delay-1);assert.equal(stages.at(-1),previous);
    time.advance(1);assert.equal(stages.at(-1),stage);
  }
  time.advance(2666); assert.equal(stages.at(-1), 'impact'); assert.equal(completed, 0);
  time.advance(1); assert.deepEqual(stages.slice(-2), ['settle', 'done']); assert.equal(completed, 1);
  const landing = packGymFinaleMedia('Common').landing;
  assert.equal(PACK_GYM_FINALE_TIMING.single, Math.ceil(landing.start + landing.duration * 1000), 'reveal has no post-film hold');
  time.advance(5000); assert.equal(completed, 1); assert.equal(time.jobs.size, 0);
});
test('ten-pack also completes at the smoke boundary and scales with presentation speed', () => {
  const time = fakeClock(); let completed = 0;
  startPackGymFinale({ pullCount: 10, speed: 2, clock: time.clock, onStage: () => {}, onComplete: () => completed++ });
  assert.equal(PACK_GYM_FINALE_TIMING.ten, PACK_GYM_FINALE_TIMING.settle);
  time.advance(4253); assert.equal(completed, 0); time.advance(1); assert.equal(completed, 1);
});
test('hidden time does not consume the finale and unmount cancels remaining work', () => {
  const time = fakeClock(), stages: string[] = []; let completed = 0;
  const timeline = startPackGymFinale({ pullCount: 10, clock: time.clock, onStage: stage => stages.push(stage), onComplete: () => completed++ });
  time.advance(1000); timeline.pause(); assert.equal(timeline.elapsed(),1000); assert.equal(time.jobs.size, 0);
  time.advance(60000); assert.equal(timeline.elapsed(),1000); assert.deepEqual(stages, ['compression','contact','release','flight']); assert.equal(completed, 0);
  timeline.resume(); time.advance(1649); assert.equal(stages.at(-1), 'flight-pov'); time.advance(1); assert.equal(stages.at(-1), 'impact');
  timeline.cancel(); time.advance(60000); assert.equal(completed, 0); assert.equal(time.jobs.size, 0);
});
test('reduced motion has a short static arrival and one completion without flight', () => {
  const time = fakeClock(), stages: string[] = []; let completed = 0;
  startPackGymFinale({ pullCount: 10, reduced: true, clock: time.clock, onStage: stage => stages.push(stage), onComplete: () => completed++ });
  time.advance(219); assert.deepEqual(stages, ['settle']); time.advance(1); assert.deepEqual(stages, ['settle','done']); assert.equal(completed,1);
});
test('real bag launches immediately into depth and ten-pack mesh disappears at the smoke cut', () => {
  assert.equal(Math.abs(bagFinaleFrame(349).z), 0); assert.equal(Math.abs(bagFinaleFrame(350).z), 0);
  const early = bagFinaleFrame(500), late = bagFinaleFrame(1250);
  assert.ok(early.z < 0 && late.z < early.z * 4); assert.ok(late.y > early.y);
  assert.equal(bagFinaleFrame(2649,true).visible,true); assert.equal(bagFinaleFrame(2650,true).visible,false);
  assert.equal(bagFinaleFrame(2650).visible,true); assert.equal(bagFinaleFrame(2650).z,-20);
  assert.equal(bagFinaleFrame(4600,true).burst,1); assert.equal(bagFinaleFrame(4600,true).done,false); assert.equal(bagFinaleFrame(5316,true).done,false); assert.equal(bagFinaleFrame(5317,true).done,true);
});


test('repeated contact, flight and impact pauses retain the final ten-pack completion', () => {
  const time = fakeClock(), stages: string[] = []; let completed = 0;
  const timeline = startPackGymFinale({ pullCount: 10, clock: time.clock, onStage: stage => stages.push(stage), onComplete: () => completed++ });
  timeline.pause(); time.advance(120); timeline.resume();
  time.advance(370); timeline.pause(); time.advance(400); timeline.resume();
  time.advance(400); timeline.pause(); time.advance(200); timeline.resume();
  time.advance(4546); assert.equal(completed,0); time.advance(1); assert.equal(completed,1);
  assert.deepEqual(stages,['compression','contact','release','flight','flight-pov','impact','settle','done']);
});

test('contact camera holds, recoils with launch, then returns exactly to its authored framing', () => {
  const first = bagFinaleFrame(0), hold = bagFinaleFrame(349), launch = bagFinaleFrame(350), impact = bagFinaleFrame(2650);
  assert.equal(first.cameraFov,41); assert.equal(first.cameraZ,-1.4);
  assert.equal(hold.cameraFov,first.cameraFov); assert.equal(hold.cameraZ,first.cameraZ);
  assert.equal(launch.cameraFov,49); assert.equal(launch.cameraZ,1.1);
  assert.equal(impact.cameraFov,47.5); assert.equal(impact.cameraZ,.85);
  for (const t of [3700,4200,4600,60000]) {
    const pose=bagFinaleFrame(t,true);
    assert.equal(pose.cameraFov,45); assert.equal(Math.abs(pose.cameraZ),0);
    assert.equal(Math.abs(pose.cameraX),0); assert.equal(Math.abs(pose.cameraY),0); assert.equal(Math.abs(pose.cameraRoll),0);
  }
});

test('single and partial pulls use intact arrival while only ten requests burst foreground', () => {
  for (const count of [1,3,9]) {
    const art=packGymFinaleArt(count); assert.match(art.arrival,/single-arrival-wall-v2\.webp$/); assert.equal(art.foreground,null);
  }
  const ten=packGymFinaleArt(10); assert.match(ten.arrival,/single-arrival-wall-v2\.webp$/); assert.match(ten.foreground!,/burst-foreground\.webp$/);
});


test('every catalog rarity has its exact card color and a strictly increasing physical flight distance', () => {
  assert.deepEqual(PACK_GYM_RARITY_FLIGHT,sceneRarities);
  assert.deepEqual(Object.keys(PACK_GYM_RARITY_FLIGHT),Object.keys(CARD_RARITY_DEFINITIONS));
  let previous=0;
  for (const rarity of Object.keys(PACK_GYM_RARITY_FLIGHT) as (keyof typeof PACK_GYM_RARITY_FLIGHT)[]) {
    const profile=PACK_GYM_RARITY_FLIGHT[rarity],catalog=CARD_RARITY_DEFINITIONS[rarity];
    assert.equal(profile.color,catalog.color);assert.equal(profile.label,catalog.label);
    assert.ok(profile.distance>previous);previous=profile.distance;
    for(const ten of [false,true]) {
      const pose=bagFinaleFrame(2650,ten,rarity);
      assert.equal(pose.z,-profile.distance);assert.equal(pose.color,catalog.color);
      assert.equal(bagFinaleFrame(1250,ten,rarity).z,-profile.distance*.75);
      assert.equal(bagFinaleFrame(60000,ten,rarity).z,pose.z,'flight is bounded after completion');
    }
  }
});
test('normalization retains Super Common and refuses inherited or invalid rarity keys', () => {
  for(const normalize of [normalizePackGymRarity,normalizeSceneRarity]) {
    assert.equal(normalize('SuperCommon'),'SuperCommon');
    for(const value of [undefined,null,'','common','toString','constructor','__proto__',{}]) assert.equal(normalize(value),'Common');
  }
});
test('only the three punch cels and final arrival preload; no old side-view crash frame', () => {
  const single=packGymFinaleArt(1),ten=packGymFinaleArt(10);
  assert.equal(new Set([single.compression,single.contact,single.release]).size,3);
  assert.equal(Object.values(single).filter(Boolean).length,4);
  assert.equal(Object.values(ten).filter(Boolean).length,5);
  assert.equal(single.arrival,ten.arrival);
  assert.ok(!Object.values(single).some(path=>path?.includes('wall-impact')));
  for (const [rarity,color] of Object.entries({SuperCommon:'neutral',Common:'neutral',Uncommon:'green',Rare:'blue',Epic:'purple',Legendary:'yellow',Mythical:'red'})) {
    const media=packGymFinaleMedia(rarity); assert.ok(media.pov.src.endsWith(`pov-${color}.mp4`));
    assert.equal(media.pov.duration,1.4); assert.equal(media.landing.duration,80/30);
    assert.ok(media.landing.src.endsWith('/landing.mp4'));
  }
});


test('trimmed finale audio follows contact, release and wall exactly once without stale cue bursts', () => {
  const played=new Set<string>();
  assert.deepEqual(takePackGymFinaleSounds(89,played),[]);
  assert.deepEqual(takePackGymFinaleSounds(90,played).map(c=>c.name),['bag-impact']);
  assert.deepEqual(takePackGymFinaleSounds(229,played),[]);
  assert.deepEqual(takePackGymFinaleSounds(230,played).map(c=>c.name),['travel-wind-launch-v3','chain-rattle']);
  assert.deepEqual(takePackGymFinaleSounds(2650,played).map(c=>c.name),['impact-cels']);
  assert.deepEqual(takePackGymFinaleSounds(2650,played),[]);
  assert.deepEqual(takePackGymFinaleSounds(6000,new Set()),[],'stalled rendering does not stack four expired clips');
});
test('audio honors gain, mute, speed, hidden documents, reset and disposal without synthetic fallbacks', async () => {
  const made: {src:string;volume:number;playbackRate:number;_packGain:number;preload:string;onended:(()=>void)|null;onerror:(()=>void)|null;paused:boolean;plays:number;play:()=>Promise<void>;pause:()=>void}[]=[];
  let hidden=false;
  const engine=createPackGymAudio({source:(name:string)=>`/audio/${name}.mp3`,blocked:()=>hidden,createAudio:(src:string)=>{
    const audio={src,volume:1,playbackRate:1,_packGain:1,preload:'',onended:null as (()=>void)|null,onerror:null as (()=>void)|null,paused:false,plays:0,play(){this.plays++;return Promise.resolve();},pause(){this.paused=true;}};
    made.push(audio);return audio;
  }});
  engine.sample('bag-impact');assert.equal(made.length,0,'muted by default');
  engine.configure({enabled:true,volume:.5,speed:2});engine.init();engine.init();assert.equal(made.length,4,'bounded prewarm');
  engine.sample('bag-impact',.8);const hit=made.at(-1)!;assert.equal(hit.volume,.4);assert.equal(hit.playbackRate,2);assert.equal(hit.plays,1);
  engine.configure({enabled:true,volume:.25});assert.equal(hit.volume,.2,'volume updates active clip');
  hidden=true;engine.stop();const before=made.length;engine.sample('travel-wind-launch-v3');assert.equal(made.length,before);assert.equal(hit.paused,true);assert.equal(engine.clips.size,0);
  hidden=false;engine.sample('impact-cels',1,.5);assert.equal(made.at(-1)!.playbackRate,.5);
  engine.configure({enabled:false});assert.equal(engine.clips.size,0);assert.equal(made.at(-1)!.paused,true);
  engine.configure({enabled:true,volume:10,speed:10});engine.sample('chain-rattle',10);assert.equal(made.at(-1)!.volume,1);assert.equal(made.at(-1)!.playbackRate,2);
  engine.stop();assert.equal(engine.clips.size,0,'reset stops retained clips');
  engine.sample('bag-impact');const ended=made.at(-1)!;ended.onended!();assert.equal(engine.clips.size,0);
  engine.sample('jab');assert.equal(made.at(-1),ended,'old duplicate samples cannot play');
  engine.dispose();const count=made.length;engine.configure({enabled:true});engine.sample('bag-impact');assert.equal(made.length,count);
});
test('rejected audio is released silently and never starts a substitute tone', async () => {
  let count=0;
  const engine=createPackGymAudio({source:(name:string)=>name,createAudio:()=>{count++;return {play:()=>Promise.reject(new Error('autoplay blocked')),pause(){}};}});
  engine.configure({enabled:true});engine.sample('bag-impact');await Promise.resolve();await Promise.resolve();
  assert.equal(count,1);assert.equal(engine.clips.size,0);
});


test('cinematic speed remains readable and identical in the overlay and scene', () => {
  for(const [input,expected] of [[.1,.5],[.5,.5],[1,1],[1.25,1.25],[1.5,1.25],[3,1.25],[NaN,1],[Infinity,1]]) {
    assert.equal(packGymFinaleSpeed(input),expected);assert.equal(sceneSpeed(input),expected);
  }
  assert.equal((PACK_GYM_FINALE_TIMING.pov-PACK_GYM_FINALE_TIMING.flight)/1.25,720);
  assert.equal((PACK_GYM_FINALE_TIMING.impact-PACK_GYM_FINALE_TIMING.pov)/1.25,1120);
});
test('real mesh covers seventy-five percent in 900ms with immediate impulse and continuous motion', () => {
  assert.equal(packGymFlightProgress(350),0);assert.equal(packGymFlightProgress(1250),.75);assert.equal(packGymFlightProgress(2650),1);
  let previous=0;
  for(let t=350;t<=2650;t+=10) {const p=packGymFlightProgress(t);assert.ok(p>=previous&&p<=1);previous=p;}
  const epsilon=.01,cut=1250;
  const before=(packGymFlightProgress(cut)-packGymFlightProgress(cut-epsilon))/epsilon;
  const after=(packGymFlightProgress(cut+epsilon)-packGymFlightProgress(cut))/epsilon;
  assert.ok(Math.abs(before-after)<1e-7,'velocity stays continuous at the camera cut');
  const first=bagFinaleFrame(450,false,'Mythical'),late=bagFinaleFrame(1200,false,'Mythical');
  assert.ok(late.z<first.z-15,'visible mesh travels substantially');assert.ok(late.cameraZ<first.cameraZ-3,'camera follows with enough lag to expose the fast receding bag');
  assert.ok(late.cameraZ>late.z,'camera stays behind the departing bag');assert.ok(late.scale>.85,'mesh is not shrunk away prematurely');
  assert.ok(packGymFlightProgress(500)>.15,'first150ms launches decisively rather than easing in');
  const quarter=packGymFlightProgress(575);assert.ok(quarter>.23,'at least23% of the whole flight happens in the first225ms');
});
