import * as T from '../shared/three.module.js';

// All prop heights are relative to the finished surface, never the slab centre.
export const TABLE_SURFACE = .94;
export const TABLE_RADIUS = 1.34;
export function createDominoTable(scene) {
  const root = new T.Group(); root.name = 'premium-domino-table';
  root.position.set(.1, 0, .7); scene.add(root);
  const mat = (color, roughness=.5, metalness=0) => new T.MeshStandardMaterial({color, roughness, metalness});
  const walnut=mat('#39251e',.42), edge=mat('#251b18',.4), brass=mat('#b69860',.34,.75);
  const ceramic=mat('#e6dcc5',.26), dark=mat('#181c20',.64), coffee=mat('#29170f',.3);
  const add=(geometry,material,x,y,z,parent=root)=>{const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
  const cyl=(r,h,m,x,y,z,p)=>add(new T.CylinderGeometry(r,r,h,64),m,x,y,z,p);
  const ring=(r,t,m,x,y,z,p)=>{const o=add(new T.TorusGeometry(r,t,8,64),m,x,y,z,p);o.rotation.x=-Math.PI/2;return o;};
  const lathe=(points,m,p)=>add(new T.LatheGeometry(points.map(([x,y])=>new T.Vector2(x,y)),48),m,0,0,0,p);
  const prop=(name,x,z,radius)=>{const g=new T.Group();g.name=name;g.position.set(x,TABLE_SURFACE,z);g.userData.footprintRadius=radius;root.add(g);return g;};
  // Bevelled hardwood slab with a fine brass reveal, rather than a solid gold disc.
  lathe([[0,.80],[1.26,.80],[1.32,.82],[1.34,.85],[1.34,.90],[1.31,.94],[0,.94]],walnut,root);
  ring(1.334,.009,brass,0,.874,0);
  ring(1.24,.003,brass,0,.941,0);
  cyl(.59,.64,edge,0,.45,0);cyl(.75,.065,brass,0,.066,0);
  cyl(.71,.024,edge,0,.022,0);cyl(.66,.04,brass,0,.78,0);
  for(let i=0;i<40;i++){const a=i*Math.PI/20;const f=cyl(.027,.62,walnut,Math.cos(a)*.59,.45,Math.sin(a)*.59);f.castShadow=false;}

  // Cup is behind the deck, on its own coaster. Real hollow rim, coffee below lip.
  const cup=prop('table-cup',.79,-.23,.17);
  cyl(.14,.012,edge,0,.006,0,cup);ring(.133,.004,brass,0,.013,0,cup);
  lathe([[0,.013],[.071,.013],[.079,.025],[.09,.193],[.088,.208],[.078,.208],[.075,.04],[0,.04]],ceramic,cup);
  cyl(.077,.004,coffee,0,.188,0,cup);
  const handle=add(new T.TorusGeometry(.053,.013,10,28),ceramic,.107,.115,0,cup);
  handle.scale.x=.85;

  // Shallow ceramic ashtray: recessed bowl and four understated brass rests.
  const ash=prop('table-ashtray',.05,-.64,.17);
  lathe([[0,0],[.13,0],[.16,.014],[.16,.044],[.145,.057],[.12,.049],[.105,.018],[0,.018]],mat('#4b675e',.3),ash);
  for(let i=0;i<4;i++){const a=i*Math.PI/2;const rest=add(new T.BoxGeometry(.025,.008,.038),brass,Math.cos(a)*.143,.052,Math.sin(a)*.143,ash);rest.rotation.y=-a+Math.PI/2;}

  // Compact remote, laid flat; buttons sit above the case, not inside the table.
  const remote=prop('table-remote',.90,.27,.18);remote.rotation.y=-.28;
  const body=new T.Shape();body.moveTo(-.055,-.15);body.lineTo(.055,-.15);body.quadraticCurveTo(.07,-.15,.07,-.13);body.lineTo(.07,.13);body.quadraticCurveTo(.07,.15,.05,.15);body.lineTo(-.05,.15);body.quadraticCurveTo(-.07,.15,-.07,.13);body.lineTo(-.07,-.13);body.quadraticCurveTo(-.07,-.15,-.055,-.15);
  const caseGeo=new T.ExtrudeGeometry(body,{depth:.025,bevelEnabled:true,bevelSize:.005,bevelThickness:.004,bevelSegments:2,steps:1});caseGeo.rotateX(-Math.PI/2);
  add(caseGeo,dark,0,.004,0,remote);
  cyl(.012,.007,mat('#984537'),-.035,.036,-.10,remote);
  ring(.027,.007,mat('#a6aaa4'),0,.035,-.034,remote);
  cyl(.013,.006,dark,0,.036,-.034,remote);
  for(let row=0;row<3;row++)for(let col=0;col<3;col++)cyl(.007,.005,ceramic,(col-1)*.033,.035,.028+row*.032,remote);

  // Small opal mushroom lamp: a warm practical light, with no extra shadow map.
  const lamp=prop('table-mushroom-lamp',-.67,-.57,.24);
  cyl(.14,.023,brass,0,.0115,0,lamp);
  lathe([[0,.023],[.09,.023],[.075,.05],[.06,.24],[.09,.28],[0,.28]],ceramic,lamp);
  const glow=new T.MeshStandardMaterial({color:'#edbd76',emissive:'#ffaf50',emissiveIntensity:.65,roughness:.38});
  lathe([[0,.447],[.055,.445],[.12,.422],[.183,.38],[.223,.32],[.23,.284],[.225,.27],[.20,.267],[.14,.275],[0,.285]].reverse(),glow,lamp);
  const light=new T.PointLight('#ffc17b',1.8,2.5,2);light.position.set(0,.265,0);lamp.add(light);
  return {root, cup, ash, remote, lamp};
}
