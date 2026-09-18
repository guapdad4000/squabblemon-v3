// Historical one-time reference importer. The integrated scenes have since been
// edited directly; rerunning this script would overwrite those later changes.
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const dest = path.join(root, 'artifacts/squabblemon/public/scenes');
const source = path.join(root, 'artifacts/squabblemon/reference/safehouse-handoff/squabblemon-safehouse');
for (const dir of ['shared', 'safehouse', 'gym']) fs.mkdirSync(path.join(dest, dir), { recursive: true });
for (const file of ['three.module.js','three.core.js']) fs.copyFileSync(path.join(source,'app',file),path.join(dest,'shared',file));
fs.copyFileSync(path.join(source,'licenses/THREE-LICENSE.txt'),path.join(dest,'shared/THREE-LICENSE.txt'));
for (const file of ['scene.js','art-direction.js','story.js','concept.png','index.html']) fs.copyFileSync(path.join(source,'app',file),path.join(dest,'safehouse',file));
const write = (file, value) => fs.writeFileSync(path.join(dest,file),value);
let safe = fs.readFileSync(path.join(dest,'safehouse/scene.js'),'utf8').replace("'./three.module.js'", "'../shared/three.module.js'");
safe = safe.replace('const reduced=matchMedia', 'let reduced=matchMedia');
safe = safe.replace("function view(name){selected=name;", "function view(name){if(!['room','table','lounge','story','training','cards','phone'].includes(name))return;emit({type:'view',view:name});selected=name;");
safe = safe.replace('function animate(t){requestAnimationFrame(animate);if(contextLost)return;', 'function animate(t){requestAnimationFrame(animate);if(contextLost||document.hidden)return;');
safe = safe.replace("const notice=document.createElement('div');", "emit({type:'error'});const notice=document.createElement('div');");
safe += `
function emit(payload){parent.postMessage({channel:'squabblemon-scene',...payload},location.origin);}
addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==parent||e.data?.channel!=='squabblemon-scene')return;
  const d=e.data;
  if(d.type==='view')view(d.view);
  if(d.type==='story')window.Squabblemon.setStoryProgress(d.progress);
  if(d.type==='light'&&Boolean(d.night)!==night)document.querySelector('#light').click();
  if(d.type==='settings')reduced=Boolean(d.reducedMotion)||matchMedia('(prefers-reduced-motion: reduce)').matches;
});
addEventListener('error',()=>emit({type:'error'}));
requestAnimationFrame(()=>emit({type:'ready'}));
`;
write('safehouse/scene.js',safe);
write('safehouse/art-direction.js',fs.readFileSync(path.join(dest,'safehouse/art-direction.js'),'utf8').replace("'./three.module.js'","'../shared/three.module.js'"));
let html=fs.readFileSync(path.join(dest,'safehouse/index.html'),'utf8');
html=html.replace('Interactive 3D trap house','Interactive 3D safehouse');
write('safehouse/index.html',html);
write('safehouse/style.css',`*{box-sizing:border-box}html,body,#stage{margin:0;width:100%;height:100%;overflow:hidden;background:#211e31}canvas{display:block;touch-action:none;outline-offset:-4px}header,footer,.caption,.stations,aside,#punch,dialog,.sr-only{display:none!important}#loading{position:absolute;inset:0;display:grid;place-items:center;color:#e6bf6b;background:#171319;font:700 14px monospace}`);

// Retain the supplied procedural bag, gloves, leather textures, dents and impact art.
// The app owns payment, reward selection and all UI. No prototype cards or CDN scripts ship.
const prototype=fs.readFileSync('E:/Downloads/squabblemon_gym_gacha.html','utf8');
const between=(a,b)=>prototype.slice(prototype.indexOf(a),prototype.indexOf(b));
const textures=between('    function drawEmblem(', '    function createCardFrontTexture(');
let setup=between('    let scene, camera, renderer;', '    function buildCards(');
setup=setup.replace('renderer.outputEncoding = THREE.sRGBEncoding;','renderer.outputColorSpace = THREE.SRGBColorSpace;');
setup=setup.replace('Math.min(window.devicePixelRatio, 2)','Math.min(window.devicePixelRatio, 1.5)');
setup=setup.replace('sharedCardBackTexture = createCardBackTexture();','');
setup=setup.replace('      buildCards();','');
setup=setup.replace('Math.max(h, 480)','Math.max(h, 240)');
setup=setup.replace('0xfffbeb, 4.8,','0xfffbeb, 95,');
let effects=between('    let speedlineCanvas, speedlineCtx;', '    function updateComboHud(');
effects=effects.replace('const TARGET_KO_HITS = 28;', 'const TARGET_KO_HITS = 12;');
effects=effects.replace('if (isGachaTriggered) return;', 'if (isGachaTriggered || !armed) return;');
effects=effects.replace('      punchHits++;', '      punchHits++; emit({type:"hit",hits:punchHits});');
effects=effects.replace('screenShake = Math.min(0.35, 0.05 + heatRatio * 0.28);', 'screenShake = reduced ? 0 : Math.min(0.10, 0.025 + heatRatio * 0.07);');
// Remove full-screen strobing. Impacts use local rings, sparks and lettering.
effects=effects.replace('      activeImpactFrameTimer = durationFrames;', '      return;\n      activeImpactFrameTimer = durationFrames;');
effects=effects.replace('      speedlineIntensity = Math.min(1.0, speedlineIntensity + 0.22);','      speedlineIntensity = reduced ? 0 : Math.min(0.35, speedlineIntensity + 0.10);');
let loop=between('    function onWindowResize()', '    /* Resilient Loader Pattern */');
loop=loop.replace('      if (hitStopRemaining > 0)', '      if(document.hidden)return;\n      if (hitStopRemaining > 0)');
loop=loop.replace('const delta = clock.getDelta();','const delta = Math.min(clock.getDelta(), 0.04);');
loop=loop.replace('const time = clock.getElapsedTime();','const time = clock.elapsedTime;');
loop=loop.replace('bagAssembly.rotation.y = Math.sin(time * 0.8) * 0.04;', 'bagAssembly.rotation.y = reduced ? 0 : Math.sin(time * 0.8) * 0.025;');
loop=loop.replace('scene.remove(sfx);','scene.remove(sfx); sfx.geometry.dispose(); sfx.material.map?.dispose(); sfx.material.dispose();');
loop=loop.replace('scene.remove(sw);','scene.remove(sw); sw.geometry.dispose(); sw.material.dispose();');
loop=loop.replace('scene.remove(spark);','scene.remove(spark); spark.geometry.dispose(); spark.material.dispose();');
loop=loop.replace('scene.remove(ghost);', 'scene.remove(ghost); const materials=new Set();ghost.traverse(c=>{if(c.isMesh)materials.add(c.material)});materials.forEach(m=>m.dispose());');
write('gym/scene.js',`import * as THREE from '../shared/three.module.js';
let armed=false,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const emit=payload=>parent.postMessage({channel:'squabblemon-scene',...payload},location.origin);
const AudioEngine={enabled:false,context:null,init(){if(!this.enabled)return;try{this.context??=new AudioContext();this.context.resume();}catch{}},playPunch(){this.tone(95,.14)},playKO(){this.tone(52,.5)},tone(hz,duration){if(!this.enabled)return;this.init();const c=this.context;if(!c)return;const o=c.createOscillator(),g=c.createGain();o.frequency.setValueAtTime(hz,c.currentTime);o.frequency.exponentialRampToValueAtTime(28,c.currentTime+duration);g.gain.setValueAtTime(.16,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+duration);o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+duration);o.onended=()=>{o.disconnect();g.disconnect()}}};
${textures}\n${setup}\n${effects}
function updateComboHud(){}
function triggerGachaKnockout(){if(isGachaTriggered)return;isGachaTriggered=true;armed=false;AudioEngine.playKO();spawnShockwave(0,0,1.2,2);emit({type:'complete'});}
function bindInteractions(){document.getElementById('webgl-container').addEventListener('pointerdown',()=>{if(!reduced)deliverPunch()});}
addEventListener('message',e=>{
 if(e.origin!==location.origin||e.source!==parent||e.data?.channel!=='squabblemon-scene')return;
 const d=e.data;
 if(d.type==='settings'){reduced=Boolean(d.reducedMotion)||matchMedia('(prefers-reduced-motion: reduce)').matches;AudioEngine.enabled=Boolean(d.sound);}
 if(d.type==='arm'){punchHits=0;isGachaTriggered=false;armed=true;}
 if(d.type==='punch'&&!reduced)deliverPunch();
 if(d.type==='reset'){armed=false;punchHits=0;isGachaTriggered=false;bagVelocity={x:0,z:0};}
});
${loop}
addEventListener('error',()=>emit({type:'error'}));
try{init3DExperience();renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();armed=false;emit({type:'error'});});requestAnimationFrame(()=>emit({type:'ready'}));}catch(e){emit({type:'error',message:'The gym could not be rendered.'});}
`);
write('gym/index.html',`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Squabblemon — Heavy hitters</title><style>*{box-sizing:border-box}html,body,main{width:100%;height:100%;margin:0;overflow:hidden}body{background:radial-gradient(ellipse at 48% 40%,#352431,#09090e 73%)}canvas{display:block}main{touch-action:none}#speedline-canvas,#impact-frame-canvas{position:absolute;inset:0;pointer-events:none;width:100%;height:100%}#impact-frame-canvas{display:none}</style></head><body><main id="webgl-container" aria-label="Punching bag"></main><canvas id="speedline-canvas"></canvas><canvas id="impact-frame-canvas"></canvas><script type="module" src="scene.js"></script></body></html>`);
console.log('Safehouse and heavy-bag scenes integrated with local Three.js r180.');
