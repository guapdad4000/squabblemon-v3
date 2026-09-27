import { WebGLRenderer, Scene, OrthographicCamera, PlaneGeometry, ShaderMaterial, Mesh, Vector2,
  CanvasTexture, MeshPhysicalMaterial, DirectionalLight, PMREMGenerator, EquirectangularReflectionMapping,
  SRGBColorSpace, ACESFilmicToneMapping } from '../shared/three.module.js';

// The supplied foil demos' selective metal, embossing, roughness, thin film and studio
// reflections, adapted to a card face. No remote modules, orbit controls or per-card animation loop.
const palettes = ['#bda681','#dce7e1','#71cfa6','#7abefa','#c79feb','#efc368','#ee5762'];
const maps = new Map();
const canvas = (w,h) => { const c=document.createElement('canvas'); c.width=w; c.height=h; return c; };
function stockMaps(tier, variant) {
  const key = tier + ':' + (variant || 'base');
  if (maps.has(key)) return maps.get(key);
  const mask=canvas(384,536), ctx=mask.getContext('2d');
  ctx.fillStyle='#000'; ctx.fillRect(0,0,384,536);
  ctx.strokeStyle='#fff'; ctx.lineWidth=1.5; ctx.strokeRect(6,6,372,524);
  ctx.lineWidth=.65; ctx.strokeRect(10,10,364,516);
  // Fine guilloche keeps the center clear for the character and lower copy matte.
  if (tier >= 2 || variant) {
    for (const side of [0,1]) {
      for(let j=0;j<7;j++) {
        ctx.beginPath();
        for(let y=20;y<368;y++) { const x=16+j*1.8+Math.sin(y*.085+j*.6)*5; const xx=side?384-x:x; if(y===20)ctx.moveTo(xx,y);else ctx.lineTo(xx,y); }
        ctx.stroke();
      }
    }
    ctx.lineWidth=1.2;
    for(const x of [16,368]) { ctx.beginPath();ctx.moveTo(x,45);ctx.lineTo(x,17);ctx.lineTo(x+(x<100?38:-38),17);ctx.stroke(); }
  }
  if (tier >= 5 || variant === 'tagged') {
    ctx.lineWidth=.9;
    for (const x of [42,342]) for(let y=70;y<340;y+=62) {
      ctx.beginPath();ctx.moveTo(x-10,y);ctx.lineTo(x-7,y+12);ctx.lineTo(x+7,y+12);ctx.lineTo(x+10,y);ctx.lineTo(x+4,y+5);ctx.lineTo(x,y-5);ctx.lineTo(x-4,y+5);ctx.closePath();ctx.stroke();
      ctx.beginPath();ctx.moveTo(x-6,y+15);ctx.lineTo(x+6,y+15);ctx.stroke();
    }
  }
  if (variant === 'chrome' || variant === 'prismatic') {
    for(let y=36;y<366;y+=18)for(const x of [38,346]){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+5,y+8);ctx.lineTo(x,y+16);ctx.lineTo(x-5,y+8);ctx.closePath();ctx.stroke();}
  }
  if (variant === 'prismatic') {
    ctx.lineWidth=.55;
    // Reverse holo: dense facets live on the border and lower stock while the portrait remains matte.
    for(let y=374;y<520;y+=14)for(let x=14;x<374;x+=16){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+8,y-7);ctx.lineTo(x+16,y);ctx.lineTo(x+8,y+7);ctx.closePath();ctx.stroke();}
  }
  const rough=canvas(384,536), r=rough.getContext('2d');
  // Luminance, not destination-out: an opaque black mask must remain matte.
  const pixels=ctx.getImageData(0,0,384,536), out=r.createImageData(384,536);
  for(let i=0;i<pixels.data.length;i+=4){const v=Math.round(220-pixels.data[i]*.74);out.data[i]=out.data[i+1]=out.data[i+2]=v;out.data[i+3]=255;} r.putImageData(out,0,0);
  const film=canvas(128,128), f=film.getContext('2d'), field=f.createImageData(128,128);
  let seed=719;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const sites=Array.from({length:32},()=>({x:rand()*128,y:rand()*128,v:60+rand()*195}));
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){
    let distance=Infinity,value=0;
    for(const site of sites){const d=(x-site.x)**2+(y-site.y)**2;if(d<distance){distance=d;value=site.v;}}
    const i=(y*128+x)*4;field.data[i]=field.data[i+1]=field.data[i+2]=value;field.data[i+3]=255;
  } f.putImageData(field,0,0);
  const result={mask,rough,film};
  // Bounded cache: seven stocks and two editions per stock.
  maps.set(key,result);return result;
}
let studio;
function studioMap() {
  if(studio)return studio;
  studio=canvas(512,256);const c=studio.getContext('2d');c.fillStyle='#101318';c.fillRect(0,0,512,256);
  const softbox=(x,y,w,h,color)=>{const g=c.createLinearGradient(x,0,x+w,0);g.addColorStop(0,'#151820');g.addColorStop(.15,color);g.addColorStop(.85,color);g.addColorStop(1,'#151820');c.fillStyle=g;c.fillRect(x,y,w,h);};
  softbox(75,25,80,190,'#ffffff');softbox(280,48,24,154,'#b3deff');softbox(375,0,90,100,'#ffedc9');return studio;
}

// One offscreen GPU context paints a small atlas of stock/edition finishes. Each card
// owns only a 2D presentation canvas; scrolling and battle transitions move that
// canvas with the card without starting a separate animation clock.
// Source tiles match the largest common grid card at 1x. Scaling only the
// transparent light layer avoids full-resolution physical shaders per card.
const TILE_W=128, TILE_H=179, COLS=4, ROWS=4;
const clients=new Set();
const finishes=new Map();
let shared, frame=0, delayed=0, lastFlush=0;
const intersection=new IntersectionObserver(entries=>{
  for(const entry of entries){
    const client=[...clients].find(item=>item.host===entry.target);
    if(client){client.visible=entry.isIntersecting;if(client.visible)schedule();}
  }
});
const resize=new ResizeObserver(entries=>{
  for(const entry of entries){
    const client=[...clients].find(item=>item.host===entry.target);
    if(client && client.visible)paintClient(client);
  }
});

function createShared() {
  const renderer=new WebGLRenderer({alpha:true,antialias:false,powerPreference:'low-power',preserveDrawingBuffer:true});
  renderer.setPixelRatio(1);renderer.setClearColor(0,0);
  renderer.toneMapping=ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  const scene=new Scene(), camera=new OrthographicCamera(-1,1,1,-1,.1,10);camera.position.z=3;
  const geometry=new PlaneGeometry(2,2), pointer=new Vector2(.48,.68);
  const material=new ShaderMaterial({transparent:true,depthWrite:false,
    uniforms:{pointer:{value:pointer},tier:{value:0},edition:{value:0}},
    vertexShader: `varying vec2 p;void main(){p=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `precision highp float;
      varying vec2 p;uniform vec2 pointer;uniform float tier;uniform float edition;
      vec2 hash(vec2 n){return fract(sin(vec2(dot(n,vec2(127.1,311.7)),dot(n,vec2(269.5,183.3))))*43758.5453);}
      vec3 cell(vec2 uv){vec2 g=floor(uv),f=fract(uv);float d=8.,d2=8.,id=0.;
        for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(float(x),float(y));vec2 h=hash(g+o);float q=length(o+h-f);if(q<d){d2=d;d=q;id=h.x;}else{d2=min(d2,q);}}
        return vec3(d,id,d2-d);}
      void main(){
        float stock=tier;vec2 uv=vec2(p.x,p.y*1.4);vec3 c=cell(uv*12.);
        float travel=p.x*.82+p.y*.46-pointer.x*.78-pointer.y*.32;
        float beam=exp(-pow(travel/.15,2.));
        float strip=exp(-pow((travel-.3)/.018,2.));
        float face=1.-.8*exp(-dot((p-vec2(.5,.67))*vec2(3.1,4.),(p-vec2(.5,.67))*vec2(3.1,4.)));
        float matte=smoothstep(.18,.4,p.y);
        // Thin-film optical phase (nm), with cell thickness variation from the reference.
        float thickness=340.+c.y*360.+travel*210.;
        vec3 film=.5+.5*cos(12.56637*1.45*thickness/vec3(650.,510.,475.));
        vec3 color=vec3(.72,.83,.83);float structure=0.;float strength=.12;
        if(stock>1.5){color=mix(vec3(.14,.65,.42),vec3(.79,1.,.87),film.g);structure=pow(.5+.5*sin(length(uv-vec2(.18,.8))*260.),22.)*.2;strength=.19;}
        if(stock>2.5){color=mix(vec3(.15,.39,.9),vec3(.51,.93,1.),film.g);color=mix(color,film,.22);structure=pow(.5+.5*sin((uv.x+uv.y*.7)*490.),20.)*.22;strength=.23;}
        if(stock>3.5){color=mix(vec3(.38,.16,.68),vec3(.84,.63,1.),c.y);color=mix(color,film,.28);structure=pow(max(0.,1.-c.z*22.),3.)*.12+c.y*.14;strength=.29;}
        if(stock>4.5){color=mix(vec3(.57,.26,.045),vec3(1.,.88,.53),film.r);color=mix(color,film,.09);structure=pow(.5+.5*sin(uv.x*640.+uv.y*90.),25.)*.15;strength=.36;}
        if(stock>5.5){color=mix(vec3(.41,.015,.1),vec3(1.,.22,.15),film.r);color=mix(color,vec3(1.,.68,.3),pow(film.g,7.)*.65);structure=pow(max(0.,1.-c.z*18.),4.)*.26;strength=.38;}
        if(edition>1.5){color=mix(vec3(.55,.68,.78),vec3(.9,.98,1.),film.r);color=mix(color,film,.14);structure+=pow(max(0.,1.-c.z*28.),4.)*.15;strength=.33;}
        if(edition>2.5){color=mix(film,vec3(1.,.92,.62),pow(c.y,5.)*.28);structure+=pow(max(0.,1.-c.z*36.),3.)*.32;strength=.52;}
        if(edition>.5&&edition<1.5){color=mix(color,vec3(1.,.67,.2),.24);strength=max(strength,.23);}
        vec2 dust=hash(floor(uv*vec2(145.,145.)));float glint=pow(dust.x,70.)*pow(max(0.,cos(dust.y*35.+travel*28.)),28.);
        float alpha=(beam*strength+strip*.1+structure*beam+glint*beam*.55)*matte*face;
        gl_FragColor=vec4(color+strip*.23+glint*.65,min(.58,alpha));
      }`
  });
  const sheen=new Mesh(geometry,material);scene.add(sheen);
  const textures=[];
  const texture=(c)=>{const t=new CanvasTexture(c);t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());textures.push(t);return t;};
  const envSource=texture(studioMap());envSource.mapping=EquirectangularReflectionMapping;envSource.colorSpace=SRGBColorSpace;
  const pmrem=new PMREMGenerator(renderer), environment=pmrem.fromEquirectangular(envSource);pmrem.dispose();
  const plate=new Mesh(geometry);plate.position.z=.01;scene.add(plate);
  const key=new DirectionalLight('#fff2d7',3.5);key.position.set(-2,3,4);scene.add(key);
  const rim=new DirectionalLight('#d2eaff',2);rim.position.set(3,-1,3);scene.add(rim);
  renderer.debug.onShaderError=()=>{throw new Error('Foil shader compilation failed');};
  renderer.setSize(TILE_W*COLS,TILE_H*ROWS,false);
  renderer.setScissorTest(true);
  const lost=event=>{
    event.preventDefault();
    shared.lost=true;
    for(const finish of finishes.values())finish.metal.dispose();
    finishes.clear();
    for(const client of clients)client.host.dataset.foilRenderer='css';
  };
  const restored=()=>{
    shared.lost=false;
    for(const client of clients)client.finish=finishFor(client.finish.tier,client.finish.variant);
    schedule();
  };
  renderer.domElement.addEventListener('webglcontextlost',lost);
  renderer.domElement.addEventListener('webglcontextrestored',restored);
  return {renderer,scene,camera,geometry,pointer,material,plate,key,rim,textures,environment,lost:false,
    dispose(){
      renderer.domElement.removeEventListener('webglcontextlost',lost);
      renderer.domElement.removeEventListener('webglcontextrestored',restored);
      for(const finish of finishes.values())finish.metal.dispose();
      finishes.clear();geometry.dispose();material.dispose();environment.dispose();
      textures.forEach(t=>t.dispose());renderer.dispose();renderer.forceContextLoss();
    }};
}

function finishFor(tier,variant){
  const id=tier+':'+(variant||'base');
  if(finishes.has(id))return finishes.get(id);
  const source=stockMaps(tier,variant);
  const mask=new CanvasTexture(source.mask), rough=new CanvasTexture(source.rough), film=new CanvasTexture(source.film);
  shared.textures.push(mask,rough,film);
  const metal=new MeshPhysicalMaterial({color:variant==='prismatic'?'#dffcff':variant==='chrome'?'#c5e4f4':variant==='tagged'?'#e9bd64':palettes[tier],alphaMap:mask,transparent:true,depthWrite:false,
    metalness:1,roughness:.7,roughnessMap:rough,bumpMap:mask,bumpScale:.012,
    iridescence:tier<2&&!variant?0:variant==='prismatic'?1:variant==='chrome'?.8:.45,iridescenceMap:mask,
    iridescenceIOR:variant==='prismatic'?2.15:1.6,iridescenceThicknessMap:film,iridescenceThicknessRange:variant==='prismatic'?[180,880]:[280,640],
    envMap:shared.environment.texture,envMapIntensity:variant==='prismatic'?2.35:1.7,clearcoat:1,clearcoatRoughness:variant==='prismatic'?.08:.16,opacity:.85});
  const finish={id,tier,variant,metal,tile:null};
  finishes.set(id,finish);return finish;
}

function renderTile(finish,x,y,pointer){
  const {renderer,scene,camera,material,plate,key,rim}=shared;
  material.uniforms.tier.value=finish.tier;
  material.uniforms.edition.value=finish.variant==='prismatic'?3:finish.variant==='chrome'?2:finish.variant==='tagged'?1:0;
  material.uniforms.pointer.value.set(pointer[0],pointer[1]);
  plate.material=finish.metal;
  key.position.set((pointer[0]-.5)*8,(pointer[1]-.5)*7,3);
  rim.position.set(3-pointer[0]*5,-2+pointer[1]*4,2);
  renderer.setViewport(x,y,TILE_W,TILE_H);renderer.setScissor(x,y,TILE_W,TILE_H);
  renderer.clear();renderer.render(scene,camera);
}

function paintClient(client,source=client.finish.tile){
  if(!source||!client.visible||!client.host.isConnected)return;
  const ratio=Math.min(devicePixelRatio,client.quality.pixelRatio);
  const width=Math.min(512,Math.ceil(client.host.clientWidth*ratio));
  const height=Math.min(716,Math.ceil(client.host.clientHeight*ratio));
  if(!width||!height)return;
  if(client.canvas.width!==width)client.canvas.width=width;
  if(client.canvas.height!==height)client.canvas.height=height;
  client.context.clearRect(0,0,width,height);
  client.context.drawImage(source,0,0,width,height);
  client.host.dataset.foilRenderer='webgl';
}

function flush(){
  frame=0;lastFlush=performance.now();
  if(!shared||shared.lost||document.hidden)return;
  try{
    const active=[...clients].filter(client=>client.visible&&client.host.isConnected);
    const missing=[...new Set(active.map(client=>client.finish))].filter(finish=>!finish.tile);
    // Scissored tiles are rendered together on the same GPU canvas. Cache by
    // catalog tier + cosmetic edition so hundreds of grid cards reuse a tile.
    for(let offset=0;offset<missing.length;offset+=COLS*ROWS){
      const batch=missing.slice(offset,offset+COLS*ROWS);
      batch.forEach((finish,i)=>renderTile(finish,(i%COLS)*TILE_W,(ROWS-1-Math.floor(i/COLS))*TILE_H,[.48,.68]));
      batch.forEach((finish,i)=>{
        const tile=canvas(TILE_W,TILE_H),ctx=tile.getContext('2d');
        ctx.drawImage(shared.renderer.domElement,(i%COLS)*TILE_W,Math.floor(i/COLS)*TILE_H,TILE_W,TILE_H,0,0,TILE_W,TILE_H);
        finish.tile=tile;
      });
    }
    active.forEach(client=>{
      if(client.pointer){
        renderTile(client.finish,0,(ROWS-1)*TILE_H,client.pointer);
        const tile=canvas(TILE_W,TILE_H);
        tile.getContext('2d').drawImage(shared.renderer.domElement,0,0,TILE_W,TILE_H,0,0,TILE_W,TILE_H);
        paintClient(client,tile);
      }else if(client.host.dataset.foilRenderer!=='webgl')paintClient(client);
    });
  }catch(error){
    for(const client of clients)client.host.dataset.foilRenderer='css';
    console.debug('Foil material unavailable:',error);
    shared.dispose();shared=null;
  }
}

function schedule(){
  if(frame||delayed||document.hidden||!clients.size)return;
  const fps=Math.min(...[...clients].filter(client=>client.visible).map(client=>client.quality.fps),60);
  const remaining=1000/fps-(performance.now()-lastFlush);
  if(remaining>0){
    delayed=window.setTimeout(()=>{delayed=0;schedule();},remaining);
    return;
  }
  frame=requestAnimationFrame(flush);
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});

export function mountFoil(host,tier,variant,quality){
  tier=Math.max(0,Math.min(6,Number(tier)||0));
  if(quality?.tier==='static')return ()=>{};
  if(!shared)try{shared=createShared();}catch(error){console.debug('Foil material unavailable:',error);return ()=>{};}
  const card=host.closest('[data-card-id]');
  const display=canvas(1,1),context=display.getContext('2d');
  if(!context)return ()=>{};
  host.appendChild(display);
  const client={host,card,canvas:display,context,finish:finishFor(tier,variant),quality,visible:false,pointer:null};
  clients.add(client);intersection.observe(host);resize.observe(host);
  const move=event=>{
    const r=card.getBoundingClientRect();if(!r.width||!r.height)return;
    client.pointer=[Math.max(0,Math.min(1,(event.clientX-r.left)/r.width)),1-Math.max(0,Math.min(1,(event.clientY-r.top)/r.height))];
    schedule();
  };
  const reset=()=>{client.pointer=null;paintClient(client);};
  const keyboard=event=>{
    const steps={ArrowLeft:[-.12,0],ArrowRight:[.12,0],ArrowUp:[0,.12],ArrowDown:[0,-.12]};
    const step=steps[event.key];if(!step)return;
    event.preventDefault();
    const p=client.pointer||[.48,.68];
    client.pointer=[Math.max(0,Math.min(1,p[0]+step[0])),Math.max(0,Math.min(1,p[1]+step[1]))];
    schedule();
  };
  card?.addEventListener('pointermove',move,{passive:true});
  card?.addEventListener('pointerleave',reset);
  card?.addEventListener('pointercancel',reset);
  card?.addEventListener('keydown',keyboard);
  schedule();
  return ()=>{
    intersection.unobserve(host);resize.unobserve(host);
    card?.removeEventListener('pointermove',move);
    card?.removeEventListener('pointerleave',reset);
    card?.removeEventListener('pointercancel',reset);
    card?.removeEventListener('keydown',keyboard);
    clients.delete(client);display.remove();host.dataset.foilRenderer='css';
    if(!clients.size){
      cancelAnimationFrame(frame);frame=0;
      clearTimeout(delayed);delayed=0;lastFlush=0;
      shared?.dispose();shared=null;
    }
  };
}
