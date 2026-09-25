import * as T from '../shared/three.module.js';

/** Buddy's little indoor garden: ceramic pots, ribbed leaves, trailing stems and a brass stand. */
export function createGrowthCorner({ wood, brass, shelf = false }) {
  const root = new T.Group(); root.name = 'buddys-growth-lab'; root.position.set(3.22, 0, -3.13);
  const mat = color => new T.MeshStandardMaterial({ color, roughness: .82 });
  const clay = mat('#b06b42'), cream = mat('#d8cda8'), soil = mat('#28251a'), stem = mat('#547344');
  const add = (geometry, material, x, y, z) => { const m = new T.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; root.add(m); return m; };
  // Let a tap between leaves select the whole plant arrangement. This writes neither color nor depth.
  const hitArea = add(new T.BoxGeometry(1.18,1.72,.86),new T.MeshBasicMaterial({colorWrite:false,depthWrite:false}),-.08,.91,.08);
  hitArea.name='growth-hit-area';hitArea.castShadow=hitArea.receiveShadow=false;
  const box = (w,h,d,m,x,y,z) => add(new T.BoxGeometry(w,h,d),m,x,y,z);
  if (!shelf) {
  box(.98,.075,.82,wood,0,.66,0);
  for(const x of [-.4,.4])for(const z of [-.32,.32])box(.035,.63,.035,brass,x,.32,z);
  box(.92,.035,.035,brass,0,.18,.32);box(.92,.035,.035,brass,0,.18,-.32);
  }
  function pot(x,y,z,r,h,material){add(new T.CylinderGeometry(r,r*.74,h,20),material,x,y+h/2,z);const rim=add(new T.TorusGeometry(r,.021,6,28),material,x,y+h,z);rim.rotation.x=Math.PI/2;add(new T.CylinderGeometry(r*.89,r*.89,.012,20),soil,x,y+h+.004,z);}
  pot(-.12,.7,-.04,.19,.29,cream);if(!shelf){pot(.29,.7,.16,.115,.19,clay);pot(-.57,0,.17,.18,.3,clay);}
  const shape = new T.Shape();shape.moveTo(0,0);shape.bezierCurveTo(-.22,.24,-.48,.27,-.38,.58);shape.bezierCurveTo(-.34,.9,-.08,.86,0,1);shape.bezierCurveTo(.08,.86,.34,.9,.38,.58);shape.bezierCurveTo(.48,.27,.22,.24,0,0);
  const leaf = new T.ShapeGeometry(shape,8);const p=leaf.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);p.setZ(i,Math.sin(y*Math.PI)*.15-Math.abs(x)*.14);leaf.attributes.uv.setXY(i,x/.8+.5,y);}leaf.computeVertexNormals();
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const g=canvas.getContext('2d');g.fillStyle='#397746';g.fillRect(0,0,128,128);g.strokeStyle='#91af65';g.lineWidth=2;g.beginPath();g.moveTo(64,128);g.lineTo(64,0);g.stroke();g.lineWidth=1;for(let y=22;y<126;y+=19){g.beginPath();g.moveTo(64,y);g.lineTo(12,y-22);g.moveTo(64,y);g.lineTo(116,y-22);g.stroke();}const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  const green=new T.MeshStandardMaterial({color:'#d4df8f',map:texture,emissive:'#294719',emissiveIntensity:.22,roughness:.65,side:T.DoubleSide});
  const growLight=new T.PointLight('#ddffc1',2.2,2.8,2);growLight.position.set(-.35,1.95,.7);if(!shelf)root.add(growLight);
  const dummy=new T.Object3D();const leaves=new T.InstancedMesh(leaf,green,shelf?9:21);leaves.castShadow=leaves.receiveShadow=true;root.add(leaves);
  for(let i=0;i<9;i++){
    const a=i*2.399,h=.28+(i%3)*.1,r=.13+(i%2)*.09;
    const from=new T.Vector3(-.12,.99,-.04),to=new T.Vector3(-.12+Math.sin(a)*r,1.07+h,-.04+Math.cos(a)*r);
    const curve=new T.CatmullRomCurve3([from,from.clone().lerp(to,.5).add(new T.Vector3(0,.05,0)),to]);add(new T.TubeGeometry(curve,6,.008,4,false),stem,0,0,0);
    dummy.position.copy(to);dummy.rotation.set(.7+(i%3)*.18,a,Math.sin(a)*.45);dummy.scale.set(.57,.47+(i%3)*.07,.65);dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);
  }
  if(shelf){root.remove(hitArea);return root;}
  // Pothos trails over the front of the table, leaving the arcade marquee clear.
  for(let i=0;i<12;i++){const side=i%2?1:-1,t=Math.floor(i/2)/5;dummy.position.set(.28+side*(.07+t*.04),.91-t*.54,.19+t*.28);dummy.rotation.set(.18,side*.75,side*(.9+t*.3)+Math.PI);dummy.scale.set(.22,.22,.25);dummy.updateMatrix();leaves.setMatrixAt(i+9,dummy.matrix);}
  for(const side of [-1,1])add(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(.29,.89,.16),new T.Vector3(.29+side*.08,.8,.39),new T.Vector3(.29+side*.12,.32,.47)]),10,.008,4,false),stem,0,0,0);
  const snakeMat=new T.MeshStandardMaterial({color:'#8ba653',map:texture,roughness:.75,side:T.DoubleSide});const snake=new T.InstancedMesh(leaf,snakeMat,7);snake.castShadow=true;root.add(snake);
  for(let i=0;i<7;i++){const a=i*2.4;dummy.position.set(-.57+Math.sin(a)*.07,.3,.17+Math.cos(a)*.07);dummy.rotation.set(.14*Math.cos(a),a,.2*Math.sin(a));dummy.scale.set(.14,.56+(i%3)*.12,.4);dummy.updateMatrix();snake.setMatrixAt(i,dummy.matrix);}
  const sign=document.createElement('canvas');sign.width=256;sign.height=128;const c=sign.getContext('2d');c.fillStyle='#243f2b';c.fillRect(0,0,256,128);c.strokeStyle='#bfb274';c.lineWidth=5;c.strokeRect(7,7,242,114);c.textAlign='center';c.fillStyle='#e2d99c';c.font='bold 33px sans-serif';c.fillText('BUDDY’S',128,53);c.font='20px monospace';c.fillText('GROWTH LAB',128,91);const signTexture=new T.CanvasTexture(sign);signTexture.colorSpace=T.SRGBColorSpace;add(new T.PlaneGeometry(.35,.175),new T.MeshStandardMaterial({map:signTexture,roughness:.9}),-.22,.58,.415);
  return root;
}
