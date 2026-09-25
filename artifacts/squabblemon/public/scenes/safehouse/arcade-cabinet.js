import * as T from '../shared/three.module.js';
import {createArcadeDisplay} from './room-upgrades.js';

// Local +Z is the player-facing side; the rear stays inside the existing footprint.
export function createArcadeCabinet(root){
  const material=(color,metalness=0,roughness=.55)=>new T.MeshStandardMaterial({color,metalness,roughness});
  const ink=material('#172a2c'),black=material('#111619'),red=material('#802f36'),yellow=material('#dfb94f',.25),steel=material('#8b9594',.8,.32);
  const add=(geometry,mat,x,y,z)=>{const m=new T.Mesh(geometry,mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;root.add(m);return m;};
  const box=(w,h,d,mat,x,y,z)=>add(new T.BoxGeometry(w,h,d),mat,x,y,z);
  const tube=(points,r,mat)=>{const path=new T.CurvePath();points.forEach((p,i)=>path.add(new T.LineCurve3(new T.Vector3(...p),new T.Vector3(...points[(i+1)%points.length]))));return add(new T.TubeGeometry(path,192,r,6,true),mat,0,0,0);};
  const label=(text,w,h,x,y,z,color='#ebd49d',bg='#15292c',size=50)=>{
    const c=document.createElement('canvas');c.width=768;c.height=160;const g=c.getContext('2d');g.fillStyle=bg;g.fillRect(0,0,768,160);g.textAlign='center';g.textBaseline='middle';g.fillStyle=color;g.font=`900 ${size}px sans-serif`;g.fillText(text,384,80);
    const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;
    return add(new T.PlaneGeometry(w,h),new T.MeshStandardMaterial({map:t,roughness:.65}),x,y,z);
  };
  box(.98,.13,.88,black,0,.115,0);
  box(.9,1.31,.77,ink,0,.82,-.025);
  box(.9,1.06,.44,black,0,2.02,-.2);
  // Beveled one-piece side profiles, rather than a tower of rectangular blocks.
  const profile=[[-.43,.17],[.37,.17],[.42,1.28],[.59,1.42],[.57,1.61],[.26,1.7],[.02,2.32],[.31,2.43],[.31,2.77],[-.43,2.77]];
  const shape=new T.Shape();profile.forEach(([z,y],i)=>i?shape.lineTo(z,y):shape.moveTo(z,y));shape.closePath();
  for(const side of [-1,1]){
    const panel=add(new T.ExtrudeGeometry(shape,{depth:.055,bevelEnabled:true,bevelSize:.014,bevelThickness:.012,bevelSegments:2,steps:1}),red,side*.49,0,0);panel.rotation.y=-Math.PI/2;
    tube(profile.map(([z,y])=>[side*.53,y,z]),.018,yellow);
    // Flush inset racing stripes follow the tall side panel.
    for(const [offset,color] of [[0,yellow],[.075,ink],[.15,yellow]]){
      const stripe=box(.012,1.8,.041,color,side*.534,1.25,-.25+offset);stripe.rotation.x=-.16;
    }
    const medallion=add(new T.CylinderGeometry(.22,.22,.015,48),ink,side*.545,1.09,.055);medallion.rotation.z=Math.PI/2;
    const ring=add(new T.TorusGeometry(.22,.013,8,48),yellow,side*.56,1.09,.055);ring.rotation.y=Math.PI/2;
    const badge=label('FC',.31,.17,side*.571,1.09,.055,'#edcc69','#15292c',95);badge.rotation.y=side*Math.PI/2;
  }
  // Recessed, tilted CRT assembly and wide speaker fascia.
  const monitor=new T.Group();monitor.position.set(0,2.025,.14);monitor.rotation.x=-.16;root.add(monitor);
  const bezel=new T.Mesh(new T.BoxGeometry(.94,.79,.10),black);monitor.add(bezel);
  for(const x of [-.431,.431]){const rail=new T.Mesh(new T.BoxGeometry(.023,.7,.025),steel);rail.position.set(x,0,.056);monitor.add(rail);}
  const displayRoot=new T.Group();displayRoot.position.set(0,-2.05,-.084);monitor.add(displayRoot);
  const display=createArcadeDisplay(displayRoot);
  box(.94,.12,.39,ink,0,2.423,.01);
  for(const x of [-.34,.34])for(let i=0;i<5;i++)box(.09,.009,.012,black,x,2.39+i*.014,.215);
  // Backlit marquee with the existing Fadecade identity under a raised frame.
  box(1,.32,.67,black,0,2.605,-.02);
  box(.95,.014,.018,yellow,0,2.756,.325);box(.95,.014,.018,yellow,0,2.454,.325);
  const logo=new T.TextureLoader().load('../../assets/fadecade/logo.webp');logo.colorSpace=T.SRGBColorSpace;
  const marquee=add(new T.PlaneGeometry(.91,.286),new T.MeshBasicMaterial({map:logo,transparent:true,toneMapped:false}),0,2.605,.322);marquee.castShadow=false;
  // Sloped control deck, joystick dust washer, six concave yellow buttons.
  const deck=new T.Group();deck.position.set(0,1.565,.365);deck.rotation.x=.12;root.add(deck);
  const deckMesh=new T.Mesh(new T.BoxGeometry(.99,.10,.46),ink);deck.add(deckMesh);
  const lip=new T.Mesh(new T.BoxGeometry(1.01,.027,.033),yellow);lip.position.set(0,-.016,.226);deck.add(lip);
  const part=(geo,mat,x,y,z)=>{const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;deck.add(m);return m;};
  part(new T.CylinderGeometry(.10,.10,.015,32),black,-.265,.06,0);
  part(new T.CylinderGeometry(.017,.017,.19,16),steel,-.265,.15,0);
  part(new T.SphereGeometry(.064,24,16),red,-.265,.262,0);
  for(let row=0;row<2;row++)for(let col=0;col<3;col++){
    const x=.055+col*.115,z=-.075+row*.15-col*.017;
    part(new T.CylinderGeometry(.049,.05,.017,24),black,x,.06,z);
    part(new T.CylinderGeometry(.04,.044,.023,24),yellow,x,.078,z);
    part(new T.TorusGeometry(.035,.004,6,24),yellow,x,.091,z).rotation.x=Math.PI/2;
  }
  for(const x of [-.44,.44])for(const z of [-.17,.17])part(new T.CylinderGeometry(.012,.012,.006,12),steel,x,.054,z);
  label('STRAIGHT TO THE BACK',.82,.10,0,1.38,.475,'#e7ce89');
  // Serviceable coin door, illuminated return button, lock and kick plate.
  box(.39,.49,.038,steel,0,.87,.379);box(.35,.45,.042,black,0,.87,.402);
  box(.15,.065,.032,steel,-.063,1.0,.436);box(.10,.011,.008,black,-.063,1.002,.457);
  box(.073,.066,.021,new T.MeshStandardMaterial({color:'#c88b36',emissive:'#e59a39',emissiveIntensity:.25}),.087,.999,.441);
  label('PUSH',.064,.027,.087,.998,.453,'#2c241c','#d9a751',65);
  box(.2,.12,.03,steel,0,.748,.436);box(.16,.077,.033,black,0,.75,.456);
  const lock=add(new T.CylinderGeometry(.022,.022,.018,16),steel,.115,.868,.441);lock.rotation.x=Math.PI/2;
  box(.006,.026,.005,black,.115,.868,.453);
  box(.85,.18,.025,steel,0,.31,.379);
  for(let i=0;i<7;i++)box(.72,.004,.008,black,0,.248+i*.021,.395);
  label('FADECADE  /  NO. 001',.34,.052,0,.51,.391,'#d6be83');
  return display;
}
