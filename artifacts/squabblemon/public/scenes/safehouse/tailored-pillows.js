import * as T from '../shared/three.module.js';

// A sewn cushion has a thin perimeter and a generous, softly inflated middle.
export function addTailoredPillows(couch) {
  for (const [index,x] of [-1.25,1.25].entries()) {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
    const g=canvas.getContext('2d');g.fillStyle=index?'#284b46':'#dac49a';g.fillRect(0,0,512,512);
    if(!index){
      for(let y=-128;y<640;y+=128)for(let x=-128;x<640;x+=128){
        g.save();g.translate(x+64,y+64);g.rotate(Math.PI/4);g.fillStyle='#813f3c';g.fillRect(-32,-32,64,64);g.strokeStyle='#aa8050';g.lineWidth=5;g.strokeRect(-43,-43,86,86);g.fillStyle='#e8d4aa';g.fillRect(-10,-10,20,20);g.restore();
      }
    }else{
      for(const x of [88,344]){g.fillStyle='#bf9558';g.fillRect(x,0,65,512);g.fillStyle='#e0cba2';g.fillRect(x+22,0,21,512);g.fillRect(x-10,0,3,512);g.fillRect(x+72,0,3,512);}
    }
    for(let i=0;i<512;i+=3){g.fillStyle='rgba(255,239,207,.10)';g.fillRect(i,0,1,512);g.fillStyle='rgba(20,15,10,.12)';g.fillRect(0,i,512,1);}
    g.strokeStyle=index?'#c5a676':'#a47b57';g.lineWidth=2;g.setLineDash([5,5]);g.strokeRect(15,15,482,482);
    const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;
    const mat=new T.MeshStandardMaterial({map,roughness:1,bumpMap:map,bumpScale:.003});
    const group=new T.Group();group.position.set(x,1.14,.06);group.rotation.set(-.16,0,x*.13);couch.add(group);
    const positions=[],uv=[],indices=[],n=28;
    const point=(u,v,side)=>[.41*u*(1-.09*Math.pow(Math.abs(v),8)),.38*v*(1-.09*Math.pow(Math.abs(u),8)),side*(.018+.15*Math.pow(Math.max(0,(1-u*u)*(1-v*v)),.65))];
    for(const side of [1,-1])for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){positions.push(...point(i/n*2-1,j/n*2-1,side));uv.push(i/n,j/n);}
    const size=(n+1)**2;
    for(let side=0;side<2;side++)for(let j=0;j<n;j++)for(let i=0;i<n;i++){const a=side*size+j*(n+1)+i,b=a+1,c=a+n+1,d=c+1;indices.push(...(side?[a,c,b,b,c,d]:[a,b,c,b,d,c]));}
    const edge=[];for(let i=0;i<n;i++)edge.push(i);for(let j=0;j<n;j++)edge.push(j*(n+1)+n);for(let i=n;i>0;i--)edge.push(n*(n+1)+i);for(let j=n;j>0;j--)edge.push(j*(n+1));
    for(let k=0;k<edge.length;k++){const a=edge[k],b=edge[(k+1)%edge.length];indices.push(a,a+size,b,b,a+size,b+size);}
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
    const pillow=new T.Mesh(geometry,mat);pillow.castShadow=pillow.receiveShadow=true;group.add(pillow);
    const seamPoints=edge.filter((_,i)=>i%2===0).map(i=>new T.Vector3(positions[i*3],positions[i*3+1],0));
    const piping=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(seamPoints,true),112,.008,5,true),new T.MeshStandardMaterial({color:index?'#bd965f':'#803d37',roughness:1}));group.add(piping);
  }
}
