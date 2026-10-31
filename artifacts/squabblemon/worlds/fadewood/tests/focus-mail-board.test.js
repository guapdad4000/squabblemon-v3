import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PerspectiveCamera, Group, Mesh, BoxGeometry, MeshBasicMaterial, Scene, Texture, Vector3, Raycaster } from 'three';
import { Capsule } from 'three/addons/math/Capsule.js';
import { createWorldPicker } from '../src/world-picker.js';
import { createParkBulletin, BULLETIN_ART, BULLETIN_FACE } from '../src/park-bulletin.js';
import { createFocusController } from '../src/focus-controller.js';
import { characterCameraShot } from '../src/character-interactions.js';
import { CHARACTER_PLACEMENTS } from '../src/character-placements.js';
import { BULLETIN_SOURCE, sourceAtVisibleHit, sourceCanBePicked } from '../src/world-sources.js';
import { createMailFlightPlanner, createMailDeliveryController, prepareMailFlight } from '../src/mail-delivery.js';
import { createPhysics } from '../src/physics.js';
import { createAnimeEnvironment } from '../src/anime-environment.js';
import { loadWorldGeometry } from './world-geometry.js';
const from = { position: new Vector3(0, 2.4, 29), target: new Vector3(0, 1.2, 24.5), fov: 58, roll: 0 };
const cornball = { ...CHARACTER_PLACEMENTS[0], feet: [...CHARACTER_PLACEMENTS[0].position] };

test('focus visibly reaches the authored character shot before one completion and holds it', () => {
  const completed = [], cancelled = [];
  const controller = createFocusController({ getCharacters: () => [cornball], onComplete: e => completed.push(e), onCancelled: e => cancelled.push(e) });
  assert.equal(controller.start({ requestId: 'focus-1', sourceId: 'cornball', now: 1000, from }), true);
  assert.deepEqual(controller.sample(1000).position.toArray(), from.position.toArray());
  const halfway = controller.sample(1400); assert.notDeepEqual(halfway.position.toArray(), from.position.toArray()); assert.equal(completed.length, 0);
  const final = controller.sample(1850), expected = characterCameraShot(cornball, 1, {});
  assert.deepEqual(final.position.toArray(), expected.position.toArray()); assert.equal(final.fov, expected.fov);
  assert.deepEqual(completed, [{ requestId: 'focus-1', sourceId: 'cornball' }]);
  controller.sample(10000); assert.equal(completed.length, 1); assert.equal(controller.active, true); assert.equal(controller.complete, true);
  controller.cancel(); assert.equal(controller.active, false); assert.equal(cancelled.length, 0, 'releasing an already presented focus is not a late cancellation');
});
test('reduced motion reaches the final board shot immediately; unknown and cancelled requests cannot strand or complete later', () => {
  const completed = [], cancelled = [];
  const controller = createFocusController({ getPortals: () => [BULLETIN_SOURCE], onComplete: e => completed.push(e), onCancelled: e => cancelled.push(e) });
  controller.start({ requestId: 'board', sourceId: 'fade-park-bulletin', now: 0, from, reducedMotion: true });
  assert.deepEqual(controller.sample(0).position.toArray(), BULLETIN_SOURCE.camera.position); assert.equal(completed.length, 1);
  controller.start({ requestId: 'unknown', sourceId: 'external-url', now: 0, from });
  assert.equal(controller.active, false); assert.equal(cancelled.at(-1).reason, 'unavailable');
  controller.start({ requestId: 'pending', sourceId: 'fade-park-bulletin', now: 0, from });
  controller.sample(200); controller.cancel('cancelled'); controller.sample(5000);
  assert.equal(completed.length, 1); assert.equal(cancelled.at(-1).requestId, 'pending');
});
test('old focus releases cannot cancel a newer request', () => {
  const completed = [], cancelled = [];
  const controller = createFocusController({ getCharacters: () => [cornball], onComplete: e => completed.push(e), onCancelled: e => cancelled.push(e) });
  controller.start({ requestId: 'old', sourceId: 'cornball', now: 0, from });
  controller.start({ requestId: 'new', sourceId: 'cornball', now: 300, from });
  assert.equal(controller.cancel('cancelled', 'old'), false);
  controller.sample(1150); assert.equal(completed[0].requestId, 'new'); assert.equal(cancelled[0].requestId, 'old');
});
test('short-tap picking resolves real wrapper identities and board geometry, with local reach checks', () => {
  const root = new Group(); root.userData.characterId = 'cornball'; const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial()); root.add(mesh);
  assert.equal(sourceAtVisibleHit({ object: mesh, point: new Vector3() }), 'cornball');
  assert.equal(sourceAtVisibleHit({ object: new Group(), point: new Vector3(18, 2.65, -16.2) }), 'fade-park-bulletin');
  assert.equal(sourceCanBePicked('cornball', [cornball], new Vector3(17.65, .25, 33)), true);
  assert.equal(sourceCanBePicked('cornball', [cornball], new Vector3(0, .25, 24.5)), false);
  mesh.geometry.dispose(); mesh.material.dispose();
});

let physicalPromise;
function physical() {
  return physicalPromise ??= (async () => {
    const world = loadWorldGeometry(), scene = new Scene(); scene.add(world);
    const environment = await createAnimeEnvironment({ world, parent: scene, preserveParkBulletin: true, textures: { leaves: new Texture({width:1,height:1}), panorama: new Texture({width:1,height:1}) } });
    return { world, scene, environment, physics: createPhysics(world) };
  })();
}
test('the obsolete park placard frame remains toward the safe approach', async () => {
  const { world, environment } = await physical();
  assert.equal(environment.changes?.parkCleanup?.some?.(part => part.reason === 'duplicate garden sign backing') ?? false, false);
  world.updateMatrixWorld(true);
  const hits = new Raycaster(new Vector3(18, 2.65, -18), new Vector3(0, 0, 1), 0, 5).intersectObject(world, true);
  assert.ok(hits.some(hit => hit.point.z > -16.5 && hit.point.z < -15.7), 'actual authored board surface remains at the interaction target');
});
test('the physical bulletin face covers the old lettering with existing cork and undistorted canonical flyers', async () => {
  const parent=new Group(), textures=BULLETIN_ART.map(art=>new Texture({width:art.pixels[0],height:art.pixels[1]}));
  const board=await createParkBulletin({parent,textures});parent.updateMatrixWorld(true);
  const ray=new Raycaster(new Vector3(18,2.1,-22.3),new Vector3(0,.55,5.93).normalize());
  const hits=ray.intersectObject(parent,true);assert.ok(hits.length);assert.ok(hits[0].point.z < -16.35,'new art must be in front of the old cyan face and text');
  assert.equal(sourceAtVisibleHit(hits[0]),'fade-park-bulletin');
  assert.equal(board.stats.structuralGeometry,0);assert.equal(board.stats.triangles,14);
  for(const flyer of board.posterSizes)assert.ok(Math.abs(flyer.width/flyer.height-flyer.pixels[0]/flyer.pixels[1])<1e-10,'canonical flyer proportions cannot stretch');
  const [u0,v0,u1,v1]=board.corkCrop;
  assert.ok(Math.abs((u1-u0)/(v1-v0)*1.5-BULLETIN_FACE.size[0]/BULLETIN_FACE.size[1])<1e-10,'cork grain is cropped to the sign ratio rather than stretched');
  board.dispose();assert.equal(parent.children.length,0);
});
test('board delivery art is bounded, traceable to existing canonical images, and reduces decoded texture cost', () => {
  const root=new URL('../public/assets/bulletin/',import.meta.url), provenance=JSON.parse(readFileSync(new URL('provenance.json',root)));
  const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
  assert.equal(provenance.art.length,4);assert.ok(provenance.decodedBytes < provenance.sourceDecodedBytes*.26,'tiny physical flyers cannot carry full-resolution master texture cost');
  for(const art of provenance.art){
    assert.ok(Math.max(...art.pixels)<=art.maxDimension);assert.equal(hash(readFileSync(new URL(art.file,root))),art.sha256);
    assert.equal(hash(readFileSync(new URL(`../../../public/${art.source}`,import.meta.url))),art.sourceSha256,'delivery art must trace to the current canonical host image');
    assert.ok(Math.abs(art.pixels[0]/art.pixels[1]-art.sourcePixels[0]/art.sourcePixels[1]) < .006,'delivery resizing cannot crop or distort artwork');
  }
});
test('courier routes and landings clear actual solid world geometry and leave player space', async () => {
  const { physics } = await physical(); const planner = createMailFlightPlanner(physics.colliders.octree), body = new Capsule();
  for (const player of [[0,.085,24.5],[0,.085,-18],[18,.3635,-18],[20.1,.031,18.1],[23.8,.3685,-35.5]]) {
    const plan = planner.nearPlayer([10.1,.261,-8.9], player); assert.ok(plan, `a safe approach exists near ${player}`);
    assert.ok(Math.hypot(plan.to[0]-player[0],plan.to[2]-player[2]) >= 2.79);
    for (let time=0;time<=plan.duration;time+=.04) {
      const pose=plan.sample(time);body.radius=.34;body.start.set(pose.position[0],pose.position[1]+.37,pose.position[2]);body.end.set(pose.position[0],pose.position[1]+1.43,pose.position[2]);
      const hit=physics.colliders.octree.capsuleIntersect(body);assert.ok(!hit||hit.depth<.018,`courier crossed solid geometry at ${time}`);
    }
  }
});
test('courier landings stay beyond the player from each actual follow-camera direction', async () => {
  const { physics } = await physical(), planner=createMailFlightPlanner(physics.colliders.octree), player=[0,.085,24.5];
  for (const cameraPosition of [[0,2.4,29.2],[4.7,2.4,24.5],[0,2.4,19.8],[-4.7,2.4,24.5]]) {
    const plan=planner.nearPlayer([10.1,.261,-8.9],player,[],cameraPosition);assert.ok(plan);
    const toLens=[cameraPosition[0]-player[0],cameraPosition[2]-player[2]], toCourier=[plan.to[0]-player[0],plan.to[2]-player[2]];
    assert.ok(toLens[0]*toCourier[0]+toLens[1]*toCourier[1] <= 0, 'the courier cannot land between the follow lens and avatar');
  }
});
test('one pending attention makes one courier visit, waits without auto-opening, then returns after acknowledgement', async () => {
  const { physics } = await physical(); const handled = [], home = [];
  const controller = createMailDeliveryController({planner:createMailFlightPlanner(physics.colliders.octree),onHandled:ids=>handled.push(ids),onHome:()=>home.push(true)});
  const context={safe:true,player:[0,.085,24.5],mailman:{position:[10.1,.261,-8.9]},records:[],cameraPosition:[0,2.4,29.2]};
  controller.setAttention({attentionId:'account-a:letters-1',unread:1,gifts:1,opened:false});
  assert.equal(controller.update(1,{...context,safe:false}),null,'travel/dialogue defer a new visit');
  let pose=controller.update(0,context);assert.equal(pose.phase,'delivery-takeoff');
  const departure=[...pose.position];controller.update(50,{...context,safe:false});assert.deepEqual(controller.state.position,departure,'no flight advances behind an overlay/travel');
  for(let time=0;time<15;time+=.1) pose=controller.update(.1,context);
  assert.equal(pose.phase,'delivery-waiting');const landing=[...pose.position];
  controller.setAttention({attentionId:'account-a:letters-1',unread:1,gifts:1});
  for(let i=0;i<10;i++)assert.deepEqual(controller.update(1,context).position,landing,'same pending batch never restarts flight');
  controller.setAttention({attentionId:'account-a:letters-2',unread:2,gifts:1});
  assert.deepEqual(controller.update(.1,context).position,landing,'new attention joins the current waiting visit without another takeoff');
  assert.equal(handled.length,0,'landing and waiting are not acknowledgement');
  assert.ok(landing[2]<context.player[2],'the delivered courier waits on the far side of the avatar');
  controller.setAttention({attentionId:'account-a:letters-1-read',unread:0,gifts:1,opened:true});
  for(let time=0;time<20;time+=.1)controller.update(.1,context);
  assert.equal(home.length,1);assert.equal(controller.active,false);
  assert.ok(handled.flat().includes('account-a:letters-1'),'opening mail acknowledges the waiting batch');
  assert.equal(controller.update(1,context),null,'acknowledged batch cannot fly again');
});

test('unacknowledged mail can visit again on re-entry, while opened mail never repeats', async () => {
  const { physics }=await physical(),planner=createMailFlightPlanner(physics.colliders.octree), context={safe:true,player:[0,.085,24.5],mailman:{position:[10.1,.261,-8.9]},cameraPosition:[0,2.4,29.2]};
  let saved=[];
  const make=()=>createMailDeliveryController({planner,handled:saved,onHandled:ids=>{saved=ids;}});
  const mail={attentionId:'account-a:pending',unread:1,gifts:1};
  const first=make();first.setAttention(mail);for(let t=0;t<20;t+=.1)first.update(.1,context);
  assert.equal(first.state.phase,'delivery-waiting');assert.deepEqual(saved,[]);first.dispose();
  const returned=make();returned.setAttention(mail);assert.equal(returned.update(0,context).phase,'delivery-takeoff','leaving before opening must not permanently hide the courier');
  returned.acknowledge();assert.ok(saved.includes(mail.attentionId));returned.dispose();
  const acknowledged=make();acknowledged.setAttention(mail);assert.equal(acknowledged.update(1,context),null,'an acknowledged batch never nags after re-entry');
});

test('blocked courier planning is bounded and retries immediately for new attention or player movement', () => {
  const context={safe:true,player:[0,0,0],mailman:{position:[10,0,10]},cameraPosition:[0,2,5]}, mail={attentionId:'blocked',unread:1,gifts:0};
  let initialCalls=0;
  const initial=createMailDeliveryController({planner:{nearPlayer(){initialCalls++;return null;}}});initial.setAttention(mail);
  for(let i=0;i<60;i++){initial.setAttention(mail);initial.update(1/60,context);}
  assert.ok(initialCalls<=2,'a blocked arrival cannot run a geometry scan on every frame');
  const previous=initialCalls;initial.update(0,{...context,player:[3,0,0]});assert.equal(initialCalls,previous+1,'moving to a new area retries immediately');
  initial.setAttention({...mail,attentionId:'new-mail'});initial.update(0,context);assert.equal(initialCalls,previous+2,'a new pending batch retries immediately');
  let returnCalls=0;
  const returning=createMailDeliveryController({planner:{flight(){returnCalls++;return null;}}});returning.setAttention(mail);
  assert.equal(returning.update(0,{...context,mailman:{position:[0,0,-2.8]}}).phase,'delivery-waiting');returning.acknowledge();
  returning.setAttention({unread:0,gifts:0});
  for(let i=0;i<60;i++){returning.setAttention({unread:0,gifts:0});returning.update(1/60,context);}
  assert.ok(returnCalls<=2,'a blocked return has the same retry budget');
  let retargetCalls=0;
  const plan={duration:10,landingAt:9,to:[0,0,-2.8],sample:()=>({position:[0,8,-2.8],phase:'delivery-flight'})};
  const retarget=createMailDeliveryController({planner:{nearPlayer(){retargetCalls++;return retargetCalls===1?plan:null;}}});retarget.setAttention(mail);
  retarget.update(0,context);for(let i=0;i<30;i++)retarget.update(1/60,context);assert.equal(retargetCalls,1,'successful flight does not replan or delay');
  retarget.update(1,{...context,safe:false});for(let i=0;i<60;i++)retarget.update(1/60,context);
  assert.ok(retargetCalls<=3,'a deferred blocked retarget cannot scan every frame');
});

test('actual scene picking accepts a short local click and excludes look drags, remote targets and disabled input', () => {
  const handlers=new Map(),picked=[],scene=new Scene(),root=new Group();root.userData.characterId='cornball';scene.add(root);
  const mesh=new Mesh(new BoxGeometry(1,2,1),new MeshBasicMaterial());mesh.position.y=1;root.add(mesh);
  const camera=new PerspectiveCamera(60,1,.05,100);camera.position.set(0,1,5);camera.lookAt(new Vector3(0,1,0));camera.updateMatrixWorld();
  let enabled=true,player=new Vector3(0,0,1);
  const canvas={addEventListener:(n,f)=>handlers.set(n,f),removeEventListener:n=>handlers.delete(n),getBoundingClientRect:()=>({left:0,top:0,width:200,height:200})};
  const picker=createWorldPicker({canvas,camera,scene,getRecords:()=>[{id:'cornball',position:[0,0,0]}],getPlayer:()=>player,enabled:()=>enabled,onInspect:id=>picked.push(id)});
  const send=(name,x=100,y=100,timeStamp=100)=>handlers.get(name)?.({pointerId:1,button:0,clientX:x,clientY:y,timeStamp});
  send('pointerdown');send('pointerup',100,100,200);assert.deepEqual(picked,['cornball']);
  send('pointerdown');send('pointermove',150,100,150);send('pointerup',100,100,200);assert.equal(picked.length,1,'looking away and back cannot click a character');
  player=new Vector3(0,0,20);send('pointerdown');send('pointerup',100,100,200);assert.equal(picked.length,1,'remote character cannot be clicked through the map');
  enabled=false;send('pointerdown');send('pointerup',100,100,200);assert.equal(picked.length,1);
  picker.dispose();assert.equal(handlers.size,0);mesh.geometry.dispose();mesh.material.dispose();
});


test('disposed courier attention cannot plan, acknowledge or restart a late visit', () => {
  let plans = 0, handled = 0, home = 0;
  const planner = { nearPlayer() { plans++; return null; }, flight() { plans++; return null; } };
  const courier = createMailDeliveryController({ planner, onHandled: () => handled++, onHome: () => home++ });
  const context = { safe: true, player: [0, 0, 0], mailman: { position: [10, 0, 10] } };
  courier.setAttention({ attentionId: 'account-a:letter', unread: 1 });
  courier.update(0, context);
  assert.equal(plans, 1);
  courier.dispose(); courier.dispose();
  courier.setAttention({ attentionId: 'account-b:letter', unread: 1, opened: true });
  courier.acknowledge();
  assert.equal(courier.update(100, context), null);
  assert.equal(courier.active, false);
  assert.equal(plans, 1);
  assert.equal(handled, 0);
  assert.equal(home, 0);
});


test('the actual courier rig flies, lands into a live authored idle, waits for explicit acknowledgement, then flies home', async () => {
  const [{ loadCharacterCast }, { createResidentMotion }, { RESIDENT_PLACEMENTS }, { loadCpuGlb }] = await Promise.all([
    import('../src/character-cast.js'), import('../src/resident-motion.js'), import('../src/character-placements.js'), import('./helpers/verify-assets.mjs'),
  ]);
  const original = RESIDENT_PLACEMENTS.find(item => item.id === 'mailman');
  const placement = { ...original, idle: { clip: 'Fadewood_Relaxed_Idle' },
    animation: { clip: 'Fadewood_Relaxed_Idle', loop: true },
    motionClips: { ...original.motionClips, idle: { clip: 'Fadewood_Relaxed_Idle', paused: false } } };
  const loader = { async loadAsync(path) { return loadCpuGlb(readFileSync(new URL(`../public/assets/${path}`, import.meta.url))); } };
  const cast = await loadCharacterCast(new Scene(), { loader, placements: [placement], baseUrl: 'residents/' });
  const motion = createResidentMotion({ cast, placements: [placement] });
  let time = 0, handled = 0, home = 0;
  const player = [0, .1, 0], landing = [0, .1, -2.8];
  const planner = { nearPlayer: from => prepareMailFlight(from, landing, { yaw: 0 }),
    flight: (from, to, yaw) => prepareMailFlight(from, to, { yaw }) };
  const delivery = createMailDeliveryController({ planner, onHandled: () => handled++,
    onHome: () => { home++; motion.resetRoute('mailman'); } });
  const step = () => {
    time += .1; cast.update(time);
    const pose = delivery.update(.1, { safe: true, player, mailman: motion.getInteractionRecords()[0], cameraPosition: [0, 2, 5] });
    motion.update(time, { overrides: pose ? { mailman: pose } : {} });
    return pose;
  };
  delivery.setAttention({ attentionId: 'account-a:waiting-letter', unread: 1, gifts: 1 });
  try {
    let pose = step();
    assert.equal(pose.clipRole, 'fly');
    assert.equal(cast.sampleMotion()[0].animated, true);
    for (let frame = 0; frame < 250 && pose.phase !== 'delivery-waiting'; frame++) pose = step();
    assert.equal(pose.phase, 'delivery-waiting');
    for (let frame = 0; frame < 10; frame++) step();
    const idle = cast.sampleMotion()[0], feet = motion.getInteractionRecords()[0].feet.slice();
    assert.equal(idle.clip, 'Fadewood_Relaxed_Idle');
    assert.equal(idle.animated, true, 'grounded delivery is not a frozen Walking pose');
    assert.ok(Math.abs(idle.footHeight - landing[1]) < .01, 'the retargeted idle remains on its checked landing');
    for (let frame = 0; frame < 10; frame++) step();
    const later = cast.sampleMotion()[0];
    assert.notEqual(later.playhead, idle.playhead);
    assert.notEqual(later.boneChecksum, idle.boneChecksum);
    assert.deepEqual(motion.getInteractionRecords()[0].feet, feet);
    assert.equal(handled, 0, 'landing and idle motion do not acknowledge/read/claim the delivery');
    delivery.acknowledge();
    pose = step();
    assert.equal(pose.clipRole, 'fly');
    assert.equal(cast.sampleMotion()[0].clip, placement.motionClips.fly);
    assert.equal(cast.sampleMotion()[0].animated, true);
    for (let frame = 0; frame < 250 && delivery.active; frame++) step();
    assert.equal(delivery.active, false);
    assert.equal(home, 1);
    assert.equal(handled, 1);
    for (let frame = 0; frame < 10; frame++) step();
    const resting = cast.sampleMotion()[0];
    assert.equal(resting.clip, 'Fadewood_Relaxed_Idle');
    assert.equal(resting.animated, true, 'the post-office home dwell uses the same living idle');
    assert.equal(home, 1, 'the acknowledged attention cannot start another visit');
  } finally { delivery.dispose(); motion.dispose(); cast.dispose(); }
});
