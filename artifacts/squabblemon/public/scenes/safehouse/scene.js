import { createArcadeCabinet } from './arcade-cabinet.js';
import { dressBags, addGardenDecor } from './room-upgrades.js';
import { addTailoredPillows } from './tailored-pillows.js';
import { createMailDoor } from './mail-door.js';
import { createGrowthCorner } from './growth-corner.js';
import * as T from '../shared/three.module.js';
import {demoStory,normalizeStory,campaignPercent} from './story.js';
import {installFightingGameStyle} from './art-direction.js';
import {dressSafehouse} from './room-details.js';
import {batchStaticMeshes} from './batch-static.js';
const host=document.querySelector('#stage');
let renderer;try{renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});}catch(e){document.querySelector('#loading').textContent='This room needs WebGL. Try a browser with hardware acceleration enabled.';throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<600?1.4:1.7));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.92;host.append(renderer.domElement);
const scene=new T.Scene();scene.background=new T.Color('#131d24');scene.fog=new T.Fog('#172329',23,42);const camera=new T.PerspectiveCamera(innerWidth/innerHeight<.95?57:44,innerWidth/innerHeight,.1,70);
const env=new T.Scene();env.background=new T.Color('#78848a');for(const [x,y,z,s,c] of [[0,8,0,7,'#e6eceb'],[8,3,0,6,'#bdccd1'],[-8,2,0,4,'#8ba4ad']]){const p=new T.Mesh(new T.PlaneGeometry(s,s),new T.MeshBasicMaterial({color:c,side:T.DoubleSide}));p.position.set(x,y,z);p.lookAt(0,0,0);env.add(p);}const pm=new T.PMREMGenerator(renderer);scene.environment=pm.fromScene(env,.03).texture;pm.dispose();
let seed=41;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
function texture(type){const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');g.fillStyle=type==='wood'?'#845a38':type==='rug'?'#37323e':'#96907b';g.fillRect(0,0,512,512);for(let i=0;i<10000;i++){g.fillStyle=`rgba(${rand()>.5?'15,12,8':'220,208,173'},${rand()*.12})`;let x=rand()*512,y=rand()*512;g.fillRect(x,y,type==='wood'?rand()*100:rand()*5,rand()*2+1);}if(type==='wood'){g.strokeStyle='#201c17';g.lineWidth=3;for(let y=0;y<512;y+=64){g.beginPath();g.moveTo(0,y);g.lineTo(512,y);g.stroke();g.fillRect((y*3)%512,y,2,64);}}if(type==='wall'){g.strokeStyle='#423e34';g.lineWidth=1.4;for(let i=0;i<13;i++){let x=rand()*512,y=rand()*512;g.beginPath();g.moveTo(x,y);for(let j=0;j<5;j++){x+=rand()*28-14;y+=rand()*25;g.lineTo(x,y);}g.stroke();}}if(type==='rug'){for(let j=0;j<8;j++){g.strokeStyle=j%2?'#b5955b':'#9b3c55';g.lineWidth=5;g.strokeRect(12+j*8,12+j*8,488-j*16,488-j*16);}for(let x=90;x<450;x+=44)for(let y=90;y<450;y+=44){g.save();g.translate(x,y);g.rotate(Math.PI/4);g.strokeStyle='#967d52';g.lineWidth=4;g.strokeRect(-12,-12,24,24);g.fillStyle='#733a35';g.fillRect(-5,-5,10,10);g.restore();}}const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;return t;}
const gold=new T.MeshPhysicalMaterial({color:'#ffc04c',metalness:.85,roughness:.27,clearcoat:.4,clearcoatRoughness:.3,envMapIntensity:.45});const brass=new T.MeshStandardMaterial({color:'#af772d',metalness:.8,roughness:.4});const black=new T.MeshStandardMaterial({color:'#181927',roughness:.7});const leather=new T.MeshPhysicalMaterial({color:'#732a3c',roughness:.65,clearcoat:.2,clearcoatRoughness:.65});const wood=new T.MeshStandardMaterial({map:texture('wood'),color:'#b09c81',roughness:.72});const plaster=new T.MeshStandardMaterial({map:texture('wall'),color:'#a29a82',roughness:1});const ivory=new T.MeshStandardMaterial({color:'#d7cfb4',roughness:.65});
function mesh(geo,mat,x,y,z,parent=scene){const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function box(w,h,d,mat,x,y,z,p){return mesh(new T.BoxGeometry(w,h,d),mat,x,y,z,p);}
function cyl(r1,r2,h,mat,x,y,z,p){return mesh(new T.CylinderGeometry(r1,r2,h,48),mat,x,y,z,p);}
function ball(x,y,z,s,mat,p){return mesh(new T.SphereGeometry(s,16,12),mat,x,y,z,p);}
function soft(w,h,d,mat,x,y,z,p){const r=Math.min(w,h,d)*.24;const shape=new T.Shape();shape.moveTo(-w/2+r,-h/2+r);shape.lineTo(w/2-r,-h/2+r);shape.lineTo(w/2-r,h/2-r);shape.lineTo(-w/2+r,h/2-r);shape.closePath();const geo=new T.ExtrudeGeometry(shape,{depth:d-2*r,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:r,bevelThickness:r});geo.translate(0,0,-d/2+r);geo.computeVertexNormals();return mesh(geo,mat,x,y,z,p);}
// Architecture: open front, deep back wall and a barred side window.
box(9,.25,10,wood,0,-.16,0);box(9.3,.3,10.3,black,0,-.42,0);box(9,4.8,.18,plaster,0,2.25,-5);box(.18,4.8,10,plaster,-4.5,2.25,0);
box(.18,1.65,7.4,plaster,4.5,.7,1.3);box(.18,3.6,.3,plaster,4.5,1.8,-4.85);box(.18,1,10,plaster,4.5,4.15,0);box(.18,2,3.3,plaster,4.5,2.6,3.35);
for(const x of [-4.4,4.4]){box(.1,.2,10,wood,x,.1,0);box(.12,.14,10,wood,x,4.43,0);}box(9,.2,.1,wood,0,.1,-4.85);box(9,.15,.15,wood,0,4.43,-4.85);
// Window beyond right wall.
const sky=new T.MeshBasicMaterial({color:'#8ba6b3'});box(.08,2.2,4.3,sky,4.62,2.65,-.2).castShadow=false;for(let z=-2.3;z<2;z+=.5){box(.13,2.25,.055,black,4.38,2.64,z);}for(const y of [1.48,2.1,3.8])box(.23,.12,4.5,wood,4.36,y,-.2);for(const z of [-2.45,2.05])box(.23,2.45,.15,wood,4.36,2.64,z);box(.4,.12,4.7,wood,4.28,1.44,-.2);
for(let i=0;i<15;i++){const h=.2+rand()*.8;box(.025,h,.18+rand()*.3,new T.MeshBasicMaterial({color:'#b38d60'}),4.56,1.55+h/2,-2.2+i*.28);}
// Exposed brick patches.
const brick=new T.MeshStandardMaterial({color:'#745448',roughness:1});for(let row=0;row<5;row++)for(let col=0;col<3+(row%2);col++)box(.43,.19,.04,brick,-4.2+col*.46+(row%2)*.15,3.15+row*.22,-4.89);
// Rug.
const rug=box(5.3,.025,5.7,new T.MeshStandardMaterial({map:texture('rug'),roughness:1}),.15,.005,.3);for(let i=0;i<70;i++)box(.025,.012,.15,ivory,-2.45+i*.075,.015,3.22);
// Burgundy tufted couch along right wall, oriented into room.
const couch=new T.Group();scene.add(couch);couch.position.set(3.22,0,.25);couch.rotation.y=-Math.PI/2;
for(const x of [-1.7,1.7])for(const z of [-.48,.48])cyl(.07,.05,.28,gold,x,.18,z,couch);
soft(4,.36,1.55,leather,0,.45,0,couch);soft(3.8,1.03,.35,leather,0,1.05,-.62,couch);
for(let i=0;i<3;i++){soft(1.16,.27,1.06,leather,-1.22+i*1.22,.72,.13,couch);}for(const x of [-1.94,1.94]){const arm=cyl(.26,.26,1.5,leather,x,.95,0,couch);arm.rotation.x=Math.PI/2;box(.38,.58,1.48,leather,x,.66,0,couch);}
for(let row=0;row<3;row++)for(let col=0;col<12;col++){ball(-1.68+col*.3, .83+row*.28,-.425,.038,brass,couch);}for(let i=0;i<24;i++)ball(-1.75+i*.15,.46,.79,.025,gold,couch);
addTailoredPillows(couch);
// Circular gold domino table.
cyl(1.27,1.22,.14,gold,.1,.87,.7);cyl(.58,.73,.68,gold,.1,.44,.7);cyl(.86,.86,.08,gold,.1,.08,.7);for(let i=0;i<12;i++){const a=i*Math.PI/6;box(.08,.58,.08,brass,.1+Math.cos(a)*.62,.43,.7+Math.sin(a)*.62);}
const dotMat=new T.MeshStandardMaterial({color:'#191b19'});for(let i=0;i<8;i++){const d=new T.Group();scene.add(d);d.position.set(-.6+rand()*1.1,.965,.3+rand()*.6);d.rotation.y=rand()*Math.PI;box(.13,.045,.26,ivory,0,0,0,d);box(.12,.002,.008,brass,0,.024,0,d);for(let j=0;j<2;j++){const n=1+Math.floor(rand()*4);for(let k=0;k<n;k++){const dot=cyl(.009,.009,.003,dotMat,((k%2)-.5)*.045,.026,(j-.5)*.125+(Math.floor(k/2)-.5)*.04,d);}}}
const money=new T.MeshStandardMaterial({color:'#8b9675'});for(let i=0;i<3;i++){const m=box(.37,.065,.18,money,-.73+i*.055,1+i*.065,1.25);box(.07,.068,.185,ivory,-.73+i*.055,1+i*.065,1.25);}cyl(.12,.09,.2,gold,.78,1.05,.65);
// The story TV sits on a low console with its speakers gathered beside it.
const tv=new T.Group();scene.add(tv);tv.position.set(-4.02,0,-1.15);tv.rotation.y=Math.PI/2;
const walnutTV=new T.MeshStandardMaterial({color:'#493024',roughness:.56});
const satinMetal=new T.MeshStandardMaterial({color:'#b3aaa0',metalness:.72,roughness:.38});
box(2.92,.07,.76,walnutTV,0,.62,0,tv);box(2.85,.07,.7,walnutTV,0,.22,0,tv);
box(2.8,.34,.035,black,0,.42,-.32,tv);
for(const x of [-1.4,1.4])box(.07,.36,.7,walnutTV,x,.42,0,tv);
for(const x of [-1.18,1.18])for(const z of [-.25,.25])cyl(.035,.025,.2,satinMetal,x,.1,z,tv);
for(const side of [-1,1]){box(.79,.3,.035,black,side*.98,.42,.31,tv);for(let i=0;i<10;i++)box(.045,.3,.04,walnutTV,side*.98-.35+i*.078,.42,.35,tv);}
box(1.06,.21,.4,black,0,.365,.09,tv);box(1.04,.18,.018,satinMetal,0,.365,.298,tv);
for(const x of [-.27,-.08]){box(.14,.065,.008,new T.MeshBasicMaterial({color:'#b78b49'}),x,.38,.31,tv);const needle=box(.004,.045,.009,black,x,.38,.318,tv);needle.rotation.z=-.35;}
for(const x of [.17,.36]){const knob=cyl(.044,.044,.03,satinMetal,x,.365,.328,tv);knob.rotation.x=Math.PI/2;}
box(2.87,1.67,.2,walnutTV,0,1.66,-.005,tv);box(2.77,1.57,.035,satinMetal,0,1.66,.103,tv);box(2.73,1.53,.028,black,0,1.66,.125,tv);
for(const x of [-.92,.92]){const leg=box(.035,.23,.04,satinMetal,x,.74,.01,tv);leg.rotation.z=x*.25;box(.3,.025,.27,black,x,.67,.08,tv);}
const screenCanvas=document.createElement('canvas');screenCanvas.width=1024;screenCanvas.height=704;
const screenTexture=new T.CanvasTexture(screenCanvas);screenTexture.colorSpace=T.SRGBColorSpace;screenTexture.anisotropy=8;
const screenMat=new T.MeshStandardMaterial({color:'#555555',map:screenTexture,emissiveMap:screenTexture,emissive:'#ffffff',emissiveIntensity:.8,roughness:.86,envMapIntensity:.06});
const tvScreen=mesh(new T.PlaneGeometry(2.5,1.32),screenMat,0,1.66,.145,tv);tvScreen.castShadow=false;
ball(1.3,.96,.15,.009,new T.MeshBasicMaterial({color:'#8fc5ac'}),tv);
let story=normalizeStory(demoStory);
function drawStory(){const g=screenCanvas.getContext('2d');const gradient=g.createLinearGradient(0,0,1024,704);gradient.addColorStop(0,'#132d2b');gradient.addColorStop(1,'#080e13');g.fillStyle=gradient;g.fillRect(0,0,1024,704);
g.strokeStyle='#3d5f53';g.lineWidth=2;g.strokeRect(28,28,968,648);g.fillStyle='#dbcb96';g.font='bold 27px monospace';g.fillText('SQUABBLEMON / STORY MODE',64,89);g.textAlign='right';g.fillStyle='#87a698';g.font='20px monospace';g.fillText(story.demo?'DEMO SAVE':'CAMPAIGN',956,88);g.textAlign='left';
g.fillStyle='#9eb7a6';g.font='25px monospace';g.fillText('CHAPTER '+String(story.chapter).padStart(2,'0')+' / '+String(story.totalChapters).padStart(2,'0'),64,165);
g.fillStyle='#f5e6b9';g.font='bold 58px sans-serif';g.fillText(story.title,60,252,900);
g.fillStyle='#b5c8b4';g.font='25px sans-serif';g.fillText(story.objective,64,310,896);
const pct=campaignPercent(story);g.fillStyle='#f3d692';g.font='bold 84px monospace';g.fillText(pct+'%',64,440);g.fillStyle='#a9bcae';g.font='23px monospace';g.fillText('CAMPAIGN COMPLETE',272,424);
g.fillStyle='#243932';g.fillRect(64,479,896,13);g.fillStyle='#dbb967';g.fillRect(64,479,896*pct/100,13);
for(let i=0;i<story.totalChapters;i++){const x=64+i*896/story.totalChapters;g.fillStyle=i<story.completedChapters?'#c8b776':i===story.chapter-1?'#edf0c1':'#3d534b';g.fillRect(x,526,Math.max(5,896/story.totalChapters-12),8);}
g.fillStyle='#91a99a';g.font='22px monospace';g.fillText(story.completedChapters+' / '+story.totalChapters+' CHAPTERS CLEARED',64,587);g.fillStyle='#d9c797';g.fillText(story.wins+' / '+story.targetWins+' BLOCK WINS',64,634);
for(let y=0;y<704;y+=4){g.fillStyle='rgba(0,0,0,.14)';g.fillRect(0,y,1024,1);}const vig=g.createRadialGradient(512,352,170,512,352,610);vig.addColorStop(0,'transparent');vig.addColorStop(1,'#0008');g.fillStyle=vig;g.fillRect(0,0,1024,704);screenTexture.needsUpdate=true;updateStoryPanel();}
function updateStoryPanel(){document.querySelector('#save-kind').textContent=story.demo?'DEMO SAVE':'CAMPAIGN';document.querySelector('#chapter-label').textContent='CHAPTER '+String(story.chapter).padStart(2,'0')+' / '+String(story.totalChapters).padStart(2,'0');document.querySelector('#story-title').textContent=story.title;document.querySelector('#objective').textContent=story.objective;document.querySelector('#story-percent').textContent=campaignPercent(story)+'%';document.querySelector('#story-progress').value=campaignPercent(story);document.querySelector('#chapters-cleared').textContent=story.completedChapters+' of '+story.totalChapters+' chapters cleared';document.querySelector('#block-wins').textContent=story.wins+' / '+story.targetWins+' block wins';}
window.Squabblemon={setStoryProgress(value){story=normalizeStory(value);drawStory();},getStoryProgress(){return {...story};}};
drawStory();
// Speakers sit beside the TV with their drivers recessed into the cabinet face.
for(const z of [-2.98,.68]){const s=new T.Group();scene.add(s);s.position.set(-4.03,0,z);s.rotation.y=Math.PI/2;box(.68,1.85,.58,black,0,.94,0,s);for(const [y,r]of [[.55,.24],[1.2,.24],[1.61,.09]]){const rim=cyl(r,r,.035,gold,0,y,.298,s);rim.rotation.x=Math.PI/2;const cone=cyl(r*.83,r*.68,.045,black,0,y,.292,s);cone.rotation.x=Math.PI/2;const cap=ball(0,y,.308,r*.22,black,s);cap.scale.z=.18;}}
// The black panel remains; the refrigerator, low cabinet and wooden surround are gone.
box(3.55,3.35,.05,black,0,2.25,-4.87);
const glow=new T.MeshBasicMaterial({color:'#d8e6e4'});
// A lush, tappable plant corner is the entrance to Buddy’s Growth Lab.
const growthCorner=createGrowthCorner({wood,brass});growthCorner.position.set(-3.52,0,-4.12);scene.add(growthCorner);addGardenDecor(scene);
const mailDoor=createMailDoor();scene.add(mailDoor.root);
// Foreground crate and records.
box(.9,.63,.8,wood,-2.9,.32,3.5);for(let i=0;i<8;i++){const sleeve=box(.7,.65,.045,i%2?black:leather,-2.9,.62,3.22+i*.07);sleeve.rotation.x=-.14;}for(let i=0;i<4;i++)box(.93,.035,.015,black,-2.9,.12+i*.13,3.91);
// Small-scale grain, real plank joints and dark contact beneath furniture.
function grainMap(){const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.fillStyle='#888';g.fillRect(0,0,256,256);for(let i=0;i<13000;i++){const v=75+Math.floor(rand()*90);g.fillStyle=`rgb(${v},${v},${v})`;g.fillRect(rand()*256,rand()*256,1,1);}const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(3,3);return t;}
const grain=grainMap();leather.bumpMap=grain;leather.bumpScale=.012;leather.roughnessMap=null;plaster.bumpMap=plaster.map;plaster.bumpScale=.018;wood.bumpMap=wood.map;wood.bumpScale=.012;
const seam=new T.MeshStandardMaterial({color:'#30271e',roughness:1});for(let z=-4.85;z<5;z+=.46){box(8.95,.008,.009,seam,0,-.029,z);for(let x=-4.5+rand()*1.4;x<4.5;x+=1.8+rand())box(.009,.008,.45,seam,x,-.029,z+.23);}
const sc=document.createElement('canvas');sc.width=sc.height=128;const sg=sc.getContext('2d');const gradient=sg.createRadialGradient(64,64,5,64,64,64);gradient.addColorStop(0,'#000b');gradient.addColorStop(.45,'#0005');gradient.addColorStop(1,'#0000');sg.fillStyle=gradient;sg.fillRect(0,0,128,128);const contact=new T.CanvasTexture(sc);
for(const [x,z,w,h] of [[.1,.7,3.6,3.6],[3.25,.25,2.3,5],[-3.05,-3.65,3.1,2],[1.35,-2.65,1.9,1.9]]){const shadow=mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:contact,transparent:true,depthWrite:false}),x,.027,z);shadow.rotation.x=-Math.PI/2;shadow.castShadow=false;}
// Soft diamond tufting replaces the slab-like sofa back.
const tuftGeo=new T.PlaneGeometry(3.55,.82,96,32);const pa=tuftGeo.attributes.position;
for(let i=0;i<pa.count;i++){const x=pa.getX(i),y=pa.getY(i);const a=Math.cos(x*Math.PI/.3+y*Math.PI/.28);const b=Math.cos(x*Math.PI/.3-y*Math.PI/.28);pa.setZ(i,.085*Math.pow(Math.abs(a*b),.55));}tuftGeo.computeVertexNormals();mesh(tuftGeo,leather,0,1.13,-.425,couch);
for(let i=0;i<3;i++){const curve=new T.CatmullRomCurve3([new T.Vector3(-1.78+i*1.22,.857,.62),new T.Vector3(-1.78+i*1.22,.865,-.28),new T.Vector3(-.66+i*1.22,.865,-.28),new T.Vector3(-.66+i*1.22,.857,.62)]);mesh(new T.TubeGeometry(curve,24,.011,5,false),brass,0,0,0,couch);}
// Heavy leather bag with rounded ends, brass straps and separate chain links.
const oxblood=new T.MeshPhysicalMaterial({color:'#be433d',roughness:.67,bumpMap:grain,bumpScale:.015,clearcoat:.14});
box(.6,.12,.6,black,1.35,4.45,-2.65);const bagPivot=new T.Group();bagPivot.position.set(1.35,4.35,-2.65);scene.add(bagPivot);
for(let strand=0;strand<3;strand++){const a=strand*Math.PI*2/3;for(let j=0;j<9;j++){const y=-.06-j*.085;const r=.35*(-y/.85);const link=mesh(new T.TorusGeometry(.035,.008,5,10),brass,Math.cos(a)*r,y,Math.sin(a)*r,bagPivot);link.rotation.y=j%2?Math.PI/2:0;}}
const bag=new T.Group();bagPivot.add(bag);bag.position.y=-1.75;
cyl(.42,.42,1.75,oxblood,0,0,0,bag);const cap1=ball(0,.86,0,.42,oxblood,bag);cap1.scale.y=.28;const cap2=ball(0,-.86,0,.42,oxblood,bag);cap2.scale.y=.28;
for(const y of [-.72,.72]){const band=mesh(new T.TorusGeometry(.424,.027,6,48),black,0,y,0,bag);band.rotation.x=Math.PI/2;}

// Wrap the official crest around the leather so it stays flush as the bag swings.
const bagLogo=new T.TextureLoader().load('../../brand/squabblemon-crest.webp');
bagLogo.colorSpace=T.SRGBColorSpace;bagLogo.anisotropy=8;
const bagBadge=mesh(new T.CylinderGeometry(.434,.434,.62,32,1,true,-.72,1.44),new T.MeshStandardMaterial({map:bagLogo,roughness:.78,alphaTest:.3}),0,.1,0,bag);
bagBadge.castShadow=false;
// Phone on a slim brass side table, tilted face up and readable in close-up.
const phoneTable=new T.Group();phoneTable.position.set(2.5,0,3.05);scene.add(phoneTable);cyl(.52,.52,.06,gold,0,.71,0,phoneTable);for(const a of [0,2.1,4.2])box(.045,.67,.045,brass,Math.sin(a)*.31,.35,Math.cos(a)*.31,phoneTable);
const phone=new T.Group();phone.position.set(2.5,.78,3.05);phone.rotation.y=-.25;phone.rotation.x=-Math.PI/2;scene.add(phone);
soft(.38,.76,.065,black,0,0,0,phone);soft(.352,.725,.071,brass,0,0,-.001,phone);soft(.334,.699,.076,black,0,0,.003,phone);
const pc=document.createElement('canvas');pc.width=384;pc.height=800;const pctx=pc.getContext('2d');const pgrad=pctx.createLinearGradient(0,0,384,800);pgrad.addColorStop(0,'#304957');pgrad.addColorStop(.6,'#846052');pgrad.addColorStop(1,'#1c2428');pctx.fillStyle=pgrad;pctx.fillRect(0,0,384,800);pctx.fillStyle='#f5e8c9';pctx.textAlign='center';pctx.font='18px sans-serif';pctx.fillText('THE BLOCK / ONLINE',192,170);pctx.font='80px sans-serif';pctx.fillText('4:00',192,260);pctx.font='bold 25px monospace';pctx.fillText('SQUABBLEMON',192,510);pctx.font='20px sans-serif';pctx.fillText('THE BLOCK IS CALLING',192,550);pctx.fillStyle='#ffffff30';pctx.fillRect(80,617,224,2);pctx.fillStyle='#dbceac';pctx.font='18px sans-serif';pctx.fillText('SAFEHOUSE',192,664);const ptex=new T.CanvasTexture(pc);ptex.colorSpace=T.SRGBColorSpace;const phoneScreen=mesh(new T.PlaneGeometry(.305,.665),new T.MeshBasicMaterial({map:ptex}),0,0,.043,phone);phoneScreen.castShadow=false;soft(.12,.027,.008,black,0,.301,.049,phone);box(.032,.08,.02,brass,.194,.14,0,phone);
// Gold-edged card deck with a foil back and a small face-up fan.
const crewCardCanvases=[];let crewGeneration=0,crewLoaded=0;
function cardTex(face){const c=document.createElement('canvas');c.width=384;c.height=544;const g=c.getContext('2d');g.fillStyle=face?'#ebdfbd':'#273e3a';g.fillRect(0,0,384,544);g.strokeStyle='#bf9a50';g.lineWidth=8;g.strokeRect(19,19,346,506);g.strokeRect(31,31,322,482);
if(face){g.fillStyle=face==='A'?'#192a26':'#9d3233';g.font='bold 62px serif';g.fillText(face,46,104);g.fillText(face==='A'?'♠':'♥',42,162);g.save();g.translate(384,544);g.rotate(Math.PI);g.fillText(face,46,104);g.fillText(face==='A'?'♠':'♥',42,162);g.restore();g.textAlign='center';g.font='150px serif';g.fillText(face==='A'?'♠':'♥',192,330);}else{g.strokeStyle='#987c45';g.lineWidth=1;for(let y=56;y<500;y+=20){g.beginPath();g.moveTo(40,y);g.lineTo(340,y-30);g.stroke();}g.fillStyle='#20332e';g.fillRect(51,190,282,168);g.fillStyle='#e7cc8c';g.textAlign='center';g.font='bold 34px sans-serif';g.font='bold 29px sans-serif';g.fillText('SQUABBLEMON',192,254);g.font='bold 18px sans-serif';g.fillText('HOME COURT EDITION',192,299);}const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;if(!face){const crest=new Image();crest.onload=()=>{if(contextLost)return;g.fillStyle='#182a26';g.fillRect(39,39,306,466);g.drawImage(crest,56,109,272,280);g.fillStyle='#e7cc8c';g.textAlign='center';g.font='bold 16px sans-serif';g.fillText('HOME COURT EDITION',192,471);t.needsUpdate=true;};crest.src=new URL('../../brand/squabblemon-crest.webp',import.meta.url).href;}if(face)crewCardCanvases.push({canvas:c,texture:t});return t;}
const cards=new T.Group();cards.position.set(.63,.984,1.36);cards.rotation.y=-.35;scene.add(cards);const cardBack=new T.MeshStandardMaterial({map:cardTex(null),roughness:.39,metalness:.35});
for(let i=0;i<14;i++)soft(.31,.006,.44,i%3?ivory:brass,0,i*.005,0,cards);
const cardTop=mesh(new T.PlaneGeometry(.298,.426),cardBack,0,.074,0,cards);cardTop.rotation.x=-Math.PI/2;cardTop.castShadow=false;
for(let i=0;i<3;i++){const f=new T.Group();cards.add(f);f.position.set(-.38-i*.105,-.025+i*.006,.01+i*.08);f.rotation.y=-.15-i*.21;soft(.31,.007,.44,ivory,0,0,0,f);const top=mesh(new T.PlaneGeometry(.30,.43),new T.MeshStandardMaterial({map:cardTex(i===0?'A':i===1?'K':'Q'),roughness:.68}),0,.006,0,f);top.rotation.x=-Math.PI/2;top.castShadow=false;}
function updateCrewCards(list){
  if(!Array.isArray(list))return;
  const generation=++crewGeneration;crewLoaded=0;
  list.slice(0,crewCardCanvases.length).forEach((card,index)=>{
    if(typeof card?.image!=='string'||typeof card?.name!=='string')return;
    const url=new URL(card.image,location.href);if(url.origin!==location.origin)return;
    const image=new Image();image.onload=()=>{
      if(generation!==crewGeneration||contextLost)return;
      const {canvas,texture}=crewCardCanvases[index],g=canvas.getContext('2d');
      g.fillStyle='#142c2b';g.fillRect(0,0,384,544);g.strokeStyle='#d6ad57';g.lineWidth=12;g.strokeRect(13,13,358,518);
      g.fillStyle='#dec17d';g.font='bold 19px monospace';g.textAlign='center';g.fillText('SQUABBLEMON',192,49);
      const scale=Math.min(344/image.width,390/image.height);g.drawImage(image,(384-image.width*scale)/2,73,image.width*scale,image.height*scale);
      g.fillStyle='#e9d59b';g.font='bold 26px sans-serif';g.fillText(card.name.toUpperCase(),192,503,334);texture.needsUpdate=true;crewLoaded++;
    };image.src=url.href;
  });
}
// More refined table edge and brushed concentric metal details.
for(const r of [1.15,1.23]){const trim=mesh(new T.TorusGeometry(r,.012,6,96),brass,.1,.947,.7);trim.rotation.x=Math.PI/2;}
const hemi=new T.HemisphereLight('#e9f0ee','#3b4650',1.55);scene.add(hemi);const sun=new T.DirectionalLight('#f0f3eb',4.2);sun.position.set(8,5,1);sun.target.position.set(-2,0,-2);sun.castShadow=true;sun.shadow.mapSize.set(innerWidth<600?1024:2048,innerWidth<600?1024:2048);Object.assign(sun.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:.1,far:25});sun.shadow.normalBias=.035;scene.add(sun,sun.target);const fill=new T.PointLight('#a8c3d0',22,12,2);fill.position.set(-3,2.8,4);scene.add(fill);const tvLight=new T.PointLight('#9ed8ca',8,6,2);tvLight.position.set(-3.4,1.8,-1.15);scene.add(tvLight);const bagLight=new T.SpotLight('#fff0cf',21,8,.6,.7,1.5);bagLight.position.set(2.6,4,-2);bagLight.target=bag;scene.add(bagLight);
// Floating dust catches the window light.
const points=new Float32Array(150*3);for(let i=0;i<points.length;i+=3){points[i]=rand()*8-4;points[i+1]=rand()*4;points[i+2]=rand()*9-4.5;}const pg=new T.BufferGeometry();pg.setAttribute('position',new T.BufferAttribute(points,3));const dust=new T.Points(pg,new T.PointsMaterial({color:'#ffe4a5',size:.018,transparent:true,opacity:.35,depthWrite:false}));scene.add(dust);
// Inventory duffel on the floor in front of the couch.
const inventoryBag=new T.Group();inventoryBag.position.set(1.75,0,1.75);inventoryBag.rotation.y=-.3;scene.add(inventoryBag);
// Fadecade sits at the opposite end of the couch, facing into the room.
const arcade=new T.Group();arcade.position.set(3.95,0,3.3);arcade.rotation.y=-Math.PI/2;scene.add(arcade);
const arcadeDisplay=createArcadeCabinet(arcade);
dressBags({inventoryBag,bag});
const roomDetails=dressSafehouse({scene,couch,brass,wood,black,ivory,plaster});
const batching=batchStaticMeshes(scene,[mailDoor.root,growthCorner,inventoryBag,tv,bagPivot,cards,phone,arcade,roomDetails.vinyl,...roomDetails.dynamicObjects]);
const art=installFightingGameStyle({renderer,scene,camera,screenMaterials:[screenMat]});
const roomPose=()=>innerWidth/innerHeight<.95?[.16,.48,12.1,.15,1.3,-.15]:[-.09,.23,10.7,.1,1.52,-.45];
// A front three-quarter approach makes the shared spherical easing curve around the table.
// Keep the focus attached to the cabinet so placement and camera destination cannot drift apart.
const arcadePose=()=>{const portrait=innerWidth/innerHeight<.95;return[-.82,.15,portrait?4.6:4.4,arcade.position.x,portrait?1.85:1.72,arcade.position.z];};
const initialPose=roomPose();const target=new T.Vector3(...initialPose.slice(3));let yaw=initialPose[0]+.12,pitch=initialPose[1],radius=initialPose[2]+.7,desired={yaw:initialPose[0],pitch,radius:initialPose[2],target:target.clone()};
let frameShift=0,desiredFrameShift=0;
let reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const el=renderer.domElement;const pointers=new Map();let pinch=0,px=0,py=0,downX=0,downY=0,moved=false,multi=false;let selected='room';let bagImpulse=0,bagStarted=0;
const raycaster=new T.Raycaster(),pointer=new T.Vector2();const interactive=[{object:mailDoor.root,key:'mail'},{object:growthCorner,key:'growth'},{object:inventoryBag,key:'inventory'},{object:tv,key:'story'},{object:bag,key:'training'},{object:cards,key:'cards'},{object:phone,key:'phone'},{object:roomDetails.vinyl,key:'music'},{object:arcade,key:'arcade'},{object:roomDetails.profileShelf,key:'profile'}];
function pick(e){pointer.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(scene.children,true).find(h=>h.object.visible&&!h.object.material?.transparent&&h.object.type==='Mesh');if(!hit)return null;for(const item of interactive){let p=hit.object;while(p){if(p===item.object)return item.key;p=p.parent;}}return null;}
el.addEventListener('pointerdown',e=>{el.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});downX=px=e.clientX;downY=py=e.clientY;moved=false;if(pointers.size>1)multi=true;});
el.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId)){el.style.cursor=pick(e)?'pointer':'grab';return;}pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(Math.hypot(e.clientX-downX,e.clientY-downY)>6)moved=true;if(pointers.size===2){const [a,b]=[...pointers.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch)desired.radius=T.MathUtils.clamp(desired.radius+(pinch-d)*.016,1.1,17);pinch=d;return;}desired.yaw=T.MathUtils.clamp(desired.yaw-(e.clientX-px)*.003,-1.12,1.3);desired.pitch=T.MathUtils.clamp(desired.pitch+(e.clientY-py)*.003,.06,1.2);px=e.clientX;py=e.clientY;});
function release(e){if(e.type==='pointerup'&&e.isTrusted)emit({type:'interact'});if(e.type==='pointerup'&&!moved&&!multi){const key=pick(e);if(key){view(key);if(key==='training')punch();}}pointers.delete(e.pointerId);pinch=0;if(!pointers.size)multi=false;const p=[...pointers.values()][0];if(p){px=p.x;py=p.y;}}
el.addEventListener('pointerup',release);el.addEventListener('pointercancel',release);el.addEventListener('wheel',e=>{e.preventDefault();desired.radius=T.MathUtils.clamp(desired.radius+e.deltaY*.006,1.1,17);},{passive:false});
function view(name){if(!['room','table','lounge','story','training','cards','phone','music','inventory','arcade','growth','profile','mail'].includes(name))return;emit({type:'view',view:name});selected=name;bagPivot.visible=name!=='mail';renderer.shadowMap.needsUpdate=true;mailDoor.setOpen(name==='mail');desiredFrameShift=(name==='room'||name==='mail')?0:innerHeight*(innerWidth/innerHeight<.95?.14:.10);document.body.dataset.view=name;document.querySelectorAll('button[data-view]').forEach(b=>{const on=b.dataset.view===name;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on);});document.querySelector('#story-panel').hidden=name!=='story';document.querySelector('#punch').hidden=name!=='training';
const v={mail:[-1.5,.12,innerWidth<600?6.2:5.3,4.1,1.8,-3.6],growth:[.65,.2,innerWidth/innerHeight<.95?4.8:4.5,growthCorner.position.x,1.95,growthCorner.position.z],arcade:arcadePose(),inventory:[.25,.65,innerWidth<600?3.8:3.1,inventoryBag.position.x,.45,inventoryBag.position.z],room:roomPose(),table:[.05,.66,4.8,.1,.75,.7],lounge:[-.48,.25,6.2,2.1,1,0],story:[1.18,.16,innerWidth<600?4.5:4,tv.position.x,1.65,tv.position.z],training:[.12,.14,innerWidth<600?5.4:4.8,1.35,2,-2.65],cards:[.03,1.05,innerWidth<600?2.5:1.85,.45,.96,1.4],phone:[-.15,1.15,innerWidth<600?2.4:1.75,2.5,.78,3.05],music:[.78,.46,innerWidth<600?3.6:3.1,roomDetails.vinyl.position.x,1.03,roomDetails.vinyl.position.z],profile:[0,.24,innerWidth<600?3.7:3.2,roomDetails.profileShelf.position.x,1.55,roomDetails.profileShelf.position.z]}[name];if(!v)return;desired={yaw:v[0],pitch:v[1],radius:v[2],target:new T.Vector3(...v.slice(3))};}
function punch(){bagImpulse=Math.min(.28,bagImpulse+.17);bagStarted=performance.now();document.querySelector('#action-status').textContent='Punch landed';}
document.querySelectorAll('button[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));document.querySelector('#reset').onclick=()=>view('room');document.querySelector('#punch').onclick=punch;document.querySelector('#close-story').onclick=()=>view('room');
let night=true;
function setLighting(value){night=Boolean(value);document.body.dataset.lighting=night?'night':'day';scene.environmentIntensity=night?.28:.37;sun.intensity=night?.5:1.35;sun.color.set(night?'#b7a08a':'#ffd29a');hemi.intensity=night?.51:.72;hemi.color.set(night?'#d0b18d':'#edbd86');hemi.groundColor.set(night?'#383332':'#514235');sky.color.set(night?'#35566d':'#a8c3ce');screenMat.emissiveIntensity=night?.62:.55;tvLight.intensity=night?3.5:3;fill.intensity=night?6:8;bagLight.intensity=night?7:9;fill.color.set('#dfb68b');roomDetails.setNight(night);mailDoor.setNight(night);renderer.shadowMap.needsUpdate=true;document.querySelector('#light').textContent=night?'Late night':'Daylight';emit({type:'lighting',night});}
setLighting(false);document.querySelector('#light').onclick=()=>setLighting(!night);
const dialog=document.querySelector('#concept');document.querySelector('#reference').onclick=()=>dialog.showModal();document.querySelector('#close').onclick=()=>dialog.close();dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
addEventListener('keydown',e=>{if(dialog.open||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;if(e.key==='Escape')view('room');if(e.target!==document.body&&e.target!==el)return;if(e.key==='ArrowLeft')desired.yaw-=.08;if(e.key==='ArrowRight')desired.yaw+=.08;if(e.key==='ArrowUp')desired.pitch=Math.min(1.2,desired.pitch+.08);if(e.key==='ArrowDown')desired.pitch=Math.max(.06,desired.pitch-.08);if(e.key==='+'||e.key==='=')desired.radius=Math.max(1.1,desired.radius-.4);if(e.key==='-')desired.radius=Math.min(17,desired.radius+.4);});
el.tabIndex=0;el.setAttribute('aria-label','Safehouse. Arrow keys rotate. Plus and minus zoom. Use the station buttons to inspect objects.');
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.fov=innerWidth/innerHeight<.95?57:44;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<600?1.35:1.65));renderer.setSize(innerWidth,innerHeight);art.resize();roomDetails.resize();view(selected);});
document.querySelector('#loading').remove();let lastTime=0;let contextLost=false;el.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;emit({type:'error'});const notice=document.createElement('div');notice.id='loading';notice.textContent='The room paused. Refresh to step back inside.';host.append(notice);});
let lastAnchorUpdate=0,mailOverlay=false,mailPauseAt=0;
const anchorPoint=new T.Vector3();
function publishAnchors(t){if(parent===window||t-lastAnchorUpdate<100)return;lastAnchorUpdate=t;const anchors=interactive.map(item=>{anchorPoint.set(0,item.key==='mail'?2.5:item.key==='growth'?1.28:item.key==='arcade'?2:item.key==='story'?1.66:item.key==='training'?.45:item.key==='music'?1.24:item.key==='profile'?1.05:.12,0);item.object.localToWorld(anchorPoint);anchorPoint.project(camera);return {id:item.key,x:(anchorPoint.x+1)*50,y:(1-anchorPoint.y)*50,visible:anchorPoint.z>-1&&anchorPoint.z<1&&Math.abs(anchorPoint.x)<.91&&anchorPoint.y<.69&&anchorPoint.y>-.38};});emit({type:'anchors',anchors});}
function animate(t){requestAnimationFrame(animate);if(contextLost||document.hidden||(mailOverlay&&t>mailPauseAt))return;const dt=Math.min((t-lastTime)/1000,.05);lastTime=t;const speed=reduced?1:1-Math.exp(-dt*5);yaw+=(desired.yaw-yaw)*speed;pitch+=(desired.pitch-pitch)*speed;radius+=(desired.radius-radius)*speed;target.lerp(desired.target,speed);camera.position.set(target.x+Math.sin(yaw)*Math.cos(pitch)*radius,target.y+Math.sin(pitch)*radius,target.z+Math.cos(yaw)*Math.cos(pitch)*radius);camera.lookAt(target);frameShift+=(desiredFrameShift-frameShift)*speed;camera.setViewOffset(innerWidth,innerHeight,0,frameShift,innerWidth,innerHeight);
if(!reduced){dust.position.y=Math.sin(t*.00015)*.09;const age=(t-bagStarted)/1000;bagPivot.rotation.z=Math.sin(age*5.5)*bagImpulse*Math.exp(-age*1.35)+Math.sin(t*.0007)*.004;bagPivot.rotation.x=Math.sin(age*4)*bagImpulse*.3*Math.exp(-age*1.35);}
if(mailDoor.update(t/1000,dt,reduced))renderer.shadowMap.needsUpdate=true;
if(roomDetails.update(t/1000,dt,reduced,camera.position.y))renderer.shadowMap.needsUpdate=true;if(bagImpulse>0&&(t-bagStarted)<5000)renderer.shadowMap.needsUpdate=true;renderer.info.reset();art.render();publishAnchors(t);}
requestAnimationFrame(animate);

function emit(payload){parent.postMessage({channel:'squabblemon-scene',...payload},location.origin);}
addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==parent||e.data?.channel!=='squabblemon-scene')return;
  const d=e.data;
  if(d.type==='ping'&&!contextLost)emit({type:'ready'});
  if(d.type==='view')view(d.view);
  if(d.type==='arcade')arcadeDisplay.update(d);
  if(d.type==='story')window.Squabblemon.setStoryProgress(d.progress);
  if(d.type==='light')setLighting(d.night);
  if(d.type==='music')roomDetails.setMusic(d.playing);
  if(d.type==='crew')updateCrewCards(d.cards);
  if(d.type==='mail')mailDoor.setUnread(d.unread);
  if(d.type==='mail-overlay'){mailOverlay=Boolean(d.open);mailPauseAt=performance.now()+900;}
  if(d.type==='profile')roomDetails.setProfile(d);
  if(d.type==='punch')punch();
  if(d.type==='settings')reduced=Boolean(d.reducedMotion)||matchMedia('(prefers-reduced-motion: reduce)').matches;
});
window.Squabblemon.getSceneStatus=()=>({view:selected,arcade:arcadeDisplay.status(),mail:mailDoor.status(),night,reduced,batching,crewCards:crewLoaded,music:roomDetails.status(),camera:{yaw,pitch,radius},drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles});
renderer.info.autoReset=false;
addEventListener('error',()=>emit({type:'error'}));
requestAnimationFrame(()=>emit({type:'ready'}));

addEventListener('pagehide',()=>{contextLost=true;crewGeneration++;roomDetails.dispose();art.dispose();scene.traverse(object=>{object.geometry?.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];for(const material of materials){if(!material)continue;for(const value of Object.values(material))if(value?.isTexture)value.dispose();material.dispose();}});scene.environment?.dispose();renderer.dispose();});
