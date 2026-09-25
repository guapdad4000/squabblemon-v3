import * as T from '../shared/three.module.js';
const mat=(color,metalness=0,roughness=.7)=>new T.MeshStandardMaterial({color,metalness,roughness});
const add=(root,geometry,material,x,y,z)=>{const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh;};
const box=(root,size,material,pos)=>add(root,new T.BoxGeometry(...size),material,...pos);
function cord(root,points,radius,material,closed=false){return add(root,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)),closed),48,radius,6,closed),material,0,0,0);}

export function dressBags({inventoryBag,bag}) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const g=canvas.getContext('2d');g.fillStyle='#918779';g.fillRect(0,0,128,128);for(let i=0;i<128;i+=3){g.fillStyle='#6f685e';g.fillRect(i,0,1,128);g.fillStyle='#a99d89';g.fillRect(0,i,128,1);}
  const weave=new T.CanvasTexture(canvas);weave.wrapS=weave.wrapT=T.RepeatWrapping;weave.repeat.set(5,3);
  const fabric=new T.MeshStandardMaterial({color:'#353b36',roughness:.95,bumpMap:weave,bumpScale:.009});
  const strap=mat('#50372a'),piping=mat('#ab8760'),metal=mat('#c2a671',.7,.4),dark=mat('#1a201e');
  const body=add(inventoryBag,new T.SphereGeometry(1,40,24),fabric,0,.37,0);body.scale.set(.68,.33,.37);
  for(const x of [-.52,.52]){const end=add(inventoryBag,new T.SphereGeometry(1,24,16),strap,x,.37,0);end.scale.set(.13,.28,.32);cord(inventoryBag,Array.from({length:32},(_,i)=>{const a=i*Math.PI/16;return[x,.37+Math.sin(a)*.265,Math.cos(a)*.322];}),.012,piping,true);}
  for(const x of [-.34,.34]){
    cord(inventoryBag,[[x,.14,-.25],[x,.36,-.375],[x,.59,-.26],[x,.69,0],[x,.59,.26],[x,.36,.375],[x,.14,.25]],.027,strap);
    cord(inventoryBag,[[x,.56,-.23],[x,.91,-.19],[x,1.0,0],[x,.91,.19],[x,.56,.23]],.028,strap);
    for(const z of [-.23,.23]){const ring=add(inventoryBag,new T.TorusGeometry(.045,.009,6,16),metal,x,.62,z);ring.rotation.y=Math.PI/2;}
  }
  cord(inventoryBag,[[-.49,.655,0],[0,.705,0],[.49,.655,0]],.014,dark);
  for(let i=0;i<32;i++)box(inventoryBag,[.011,.01,.035],metal,[-.46+i*.029,.696-Math.abs(i-16)*.0025,0]);
  const pull=add(inventoryBag,new T.TorusGeometry(.029,.008,6,12),metal,.29,.723,.025);pull.rotation.x=Math.PI/2;
  box(inventoryBag,[.4,.21,.04],strap,[0,.36,.355]);
  for(let i=0;i<14;i++)for(const y of [.275,.445])box(inventoryBag,[.012,.006,.005],piping,[-.18+i*.028,y,.379]);
  const label=document.createElement('canvas');label.width=256;label.height=128;const c=label.getContext('2d');c.fillStyle='#c4ab7d';c.fillRect(0,0,256,128);c.fillStyle='#332b20';c.textAlign='center';c.font='900 37px sans-serif';c.fillText('SQUABBLE',128,58);c.font='18px monospace';c.fillText('EVERYDAY CARRY',128,91);const tex=new T.CanvasTexture(label);tex.colorSpace=T.SRGBColorSpace;add(inventoryBag,new T.PlaneGeometry(.29,.145),new T.MeshStandardMaterial({map:tex}),0,.36,.38);
  cord(inventoryBag,[[-.58,.45,-.12],[-.84,.19,.09],[-.61,.055,.41],[.25,.055,.52],[.64,.38,.16]],.025,strap);
  // Double saddle stitching, leather reinforcements, and riveted hang points.
  const thread=mat('#d5b791');
  for(let column=0;column<4;column++){
    const a=column*Math.PI/2+.38;
    for(let i=0;i<34;i++)for(const offset of [-.012,.012]){const stitch=box(bag,[.008,.023,.008],thread,[Math.sin(a+offset)*.427,-.66+i*.04,Math.cos(a+offset)*.427]);stitch.rotation.y=a;}
    const reinforcement=box(bag,[.13,.27,.027],strap,[Math.sin(a)*.422,.68,Math.cos(a)*.422]);reinforcement.rotation.y=a;
    for(const y of [.59,.76])add(bag,new T.SphereGeometry(.016,8,6),metal,Math.sin(a)*.447,y,Math.cos(a)*.447);
  }
  for(const y of [-.76,.76]){const ring=add(bag,new T.TorusGeometry(.427,.013,6,48),strap,0,y,0);ring.rotation.x=Math.PI/2;}
}

export function addGardenDecor(scene){
  const frame=mat('#422b20'),brass=mat('#b49b6b',.65,.4),dark=mat('#202b24');
  box(scene,[1.44,1.99,.075],frame,[-3.45,2.91,-4.855]);
  const poster=new T.TextureLoader().load('../../assets/story/posters/blockbuster.webp');poster.colorSpace=T.SRGBColorSpace;poster.anisotropy=8;
  add(scene,new T.PlaneGeometry(1.32,1.87),new T.MeshStandardMaterial({map:poster,roughness:.95}),-3.45,2.91,-4.808);
  add(scene,new T.CylinderGeometry(.025,.025,1.05,10),dark,-3.44,3.85,-3.95);
  add(scene,new T.CylinderGeometry(.09,.29,.22,32,1,true),new T.MeshStandardMaterial({color:'#334b3b',side:T.DoubleSide,metalness:.35,roughness:.5}),-3.44,3.27,-3.95);
  const rim=add(scene,new T.TorusGeometry(.29,.016,8,32),brass,-3.44,3.16,-3.95);rim.rotation.x=Math.PI/2;
  const bulb=add(scene,new T.SphereGeometry(.075,12,8),new T.MeshBasicMaterial({color:'#ffe0a0'}),-3.44,3.17,-3.95);bulb.castShadow=false;
  const light=new T.SpotLight('#ffdc9a',7,4,.65,.9,1.5);light.position.set(-3.44,3.12,-3.95);light.target.position.set(-3.5,.85,-4.08);scene.add(light,light.target);
}

export function createArcadeDisplay(root){
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=576;const g=canvas.getContext('2d');const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;
  const screen=add(root,new T.PlaneGeometry(.76,.58),new T.MeshBasicMaterial({map:texture}),0,2.05,.151);screen.castShadow=false;
  const light=new T.PointLight('#82cbb2',1.6,2.5,2);light.position.set(0,2.03,.43);root.add(light);
  let state={status:'loading',wins:0};
  const update=value=>{
    state={status:['continue','new','unavailable'].includes(value.status)?value.status:'loading',wins:Math.max(0,Number(value.wins)||0)};
    const grad=g.createLinearGradient(0,0,0,576);grad.addColorStop(0,'#113a35');grad.addColorStop(1,'#071815');g.fillStyle=grad;g.fillRect(0,0,768,576);
    g.strokeStyle='#387569';g.lineWidth=3;g.strokeRect(22,22,724,532);g.textAlign='center';g.fillStyle='#e5cb87';g.font='900 48px sans-serif';g.fillText('STRAIGHT',384,122);g.fillText('TO THE BACK',384,179);
    g.strokeStyle='#699c80';g.lineWidth=3;g.beginPath();g.moveTo(170,345);g.lineTo(325,220);g.lineTo(443,220);g.lineTo(598,345);g.stroke();g.setLineDash([12,15]);g.beginPath();g.moveTo(384,338);g.lineTo(384,226);g.stroke();g.setLineDash([]);
    g.fillStyle='#e5c36f';g.fillRect(66,363,636,84);g.fillStyle='#152c25';g.font='900 43px sans-serif';g.fillText(state.status==='continue'?'CONTINUE':state.status==='new'?'PLAY NEW GAME':state.status==='unavailable'?'OPEN FADECADE':'LOADING SAVE…',384,418);
    g.fillStyle='#a0c2a7';g.font='23px monospace';g.fillText(state.status==='continue'?`${state.wins} WINS · YOUR ROAD IS WAITING`:state.status==='new'?'ONE LOSS. BACK TO THE START.':state.status==='unavailable'?'CONNECT TO CHECK YOUR ROAD':'CHECKING YOUR ROAD',384,503);
    for(let y=0;y<576;y+=4){g.fillStyle='#00000015';g.fillRect(0,y,768,1);}texture.needsUpdate=true;
  };update(state);return{update,status:()=>({...state})};
}
