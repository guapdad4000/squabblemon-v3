import * as T from '../shared/three.module.js';

export function createMailDoor() {
  const root = new T.Group(); root.name = 'mail-door';
  root.position.set(4.29, 0, -3.6); root.rotation.y = -Math.PI / 2;
  const oak = new T.MeshStandardMaterial({ color: '#98572e', roughness: .72 });
  const edge = new T.MeshStandardMaterial({ color: '#513020', roughness: .8 });
  const metal = new T.MeshStandardMaterial({ color: '#c5a06a', metalness: .75, roughness: .32 });
  // A softly lit street beyond the threshold, rather than an unlit void.
  const outside=document.createElement('canvas');outside.width=512;outside.height=768;
  const street=outside.getContext('2d');
  const dusk=street.createLinearGradient(0,0,0,768);dusk.addColorStop(0,'#b8aaa0');dusk.addColorStop(.48,'#edbd7d');dusk.addColorStop(.7,'#ba9272');dusk.addColorStop(1,'#756757');street.fillStyle=dusk;street.fillRect(0,0,512,768);
  street.fillStyle='#817368';street.fillRect(0,335,130,205);street.fillRect(155,285,110,255);street.fillRect(335,325,177,215);
  for(const x of [25,75,175,220,360,415,470])for(const y of [355,405,455]){street.fillStyle='#dfbb83';street.fillRect(x,y,13,22);}
  street.fillStyle='#aa9279';street.fillRect(0,540,512,24);street.fillStyle='#c5aa89';street.fillRect(0,560,512,5);
  street.fillStyle='#615b50';street.fillRect(370,235,9,323);street.fillRect(345,228,57,9);
  const halo=street.createRadialGradient(374,234,3,374,234,148);halo.addColorStop(0,'#ffe4ab');halo.addColorStop(.12,'#ffd28bbb');halo.addColorStop(1,'#ffd28b00');street.fillStyle=halo;street.fillRect(210,70,310,330);
  const outsideTexture=new T.CanvasTexture(outside);outsideTexture.colorSpace=T.SRGBColorSpace;
  const outsideMaterial=new T.MeshBasicMaterial({map:outsideTexture,color:'#d7c2a3'});
  const add = (w,h,d,x,y,z,material,parent=root) => { const mesh = new T.Mesh(new T.BoxGeometry(w,h,d),material); mesh.position.set(x,y,z); mesh.castShadow=mesh.receiveShadow=true; parent.add(mesh); return mesh; };
  add(2.2,3.6,.08,0,1.8,-.28,outsideMaterial);
  const spill=new T.SpotLight('#ffd19a',0,7,.64,.85,1.5);spill.position.set(0,2.8,.05);spill.target.position.set(0,.1,2.6);root.add(spill,spill.target);
  const floorGlow=document.createElement('canvas');floorGlow.width=floorGlow.height=128;const fg=floorGlow.getContext('2d');const pool=fg.createRadialGradient(64,64,0,64,64,64);pool.addColorStop(0,'#ffd5a4aa');pool.addColorStop(1,'#ffd5a400');fg.fillStyle=pool;fg.fillRect(0,0,128,128);
  const poolTexture=new T.CanvasTexture(floorGlow);poolTexture.colorSpace=T.SRGBColorSpace;
  const spillMaterial=new T.MeshBasicMaterial({map:poolTexture,transparent:true,depthWrite:false,opacity:0});const floorSpill=new T.Mesh(new T.PlaneGeometry(2.1,3.5),spillMaterial);floorSpill.rotation.x=-Math.PI/2;floorSpill.position.set(0,.035,1.55);root.add(floorSpill);
  for(const x of [-1.13,1.13]) add(.18,3.72,.3,x,1.86,0,edge);
  add(2.44,.19,.3,0,3.68,0,edge);
  const hinge = new T.Group(); hinge.position.x=-1.03; root.add(hinge);
  const leaf = new T.Group(); leaf.position.x=1.03; hinge.add(leaf);
  add(2.06,3.5,.15,0,1.77,0,oak,leaf);
  for(const x of [-.77,-.38,0,.38,.77]) add(.018,3.36,.012,x,1.78,.081,edge,leaf);
  for(const y of [.24,1.2,3.25]) add(1.95,.16,.08,0,y,.12,edge,leaf);
  const knob = new T.Mesh(new T.SphereGeometry(.09,16,12),metal); knob.position.set(.79,1.57,.22); leaf.add(knob);
  add(.2,.36,.035,.79,1.57,.1,metal,leaf);
  const plaque = document.createElement('canvas'); plaque.width=512; plaque.height=128;
  const g=plaque.getContext('2d'); g.fillStyle='#f2dfb6'; g.fillRect(0,0,512,128); g.fillStyle='#472c20'; g.textAlign='center'; g.font='bold 57px sans-serif'; g.fillText('SPECIAL DELIVERY',256,84);
  const tex=new T.CanvasTexture(plaque); tex.colorSpace=T.SRGBColorSpace;
  add(1.55,.39,.04,0,2.77,.11,new T.MeshStandardMaterial({map:tex,roughness:.8}),leaf);
  const notice=new T.Mesh(new T.SphereGeometry(.11,16,12),new T.MeshStandardMaterial({color:'#ff5141',emissive:'#d22718',emissiveIntensity:1.2})); notice.position.set(.9,3.68,.2); root.add(notice);
  notice.visible=false;
  let unread=0, opened=false, angle=0,night=false;
  return { root, setUnread(value){unread=Math.max(0,Number(value)||0);notice.visible=unread>0;}, setOpen(value){opened=!!value;}, setNight(value){night=!!value;outsideMaterial.color.set(night?'#a18b75':'#d7c2a3');},
    update(t,dt,reduced){
      const previous=angle; angle+=( (opened?-1.52:0)-angle)*(reduced?1:1-Math.exp(-dt*6)); hinge.rotation.y=angle;
      const openness=Math.min(1,Math.abs(angle)/1.52);spill.intensity=openness*(night?17:13);spillMaterial.opacity=openness*(night?.29:.2);
      const cycle=t%4.4; const knock=unread&&!opened&&!reduced&&cycle<1.15 ? Math.max(0,Math.sin(cycle*Math.PI*6))*Math.exp(-cycle*.7):0;
      leaf.scale.set(1+knock*.045,1+knock*.025,1+knock*.65); leaf.position.z=knock*.17; leaf.rotation.z=Math.sin(cycle*39)*knock*.025;
      return knock>0||Math.abs(previous-angle)>.0001;
    }, status(){return {unread,opened,angle};}
  };
}
