import { fragment } from './shader';

export type Finish = 'gold' | 'shards' | 'cosmos';
export type FinishClient = {
  target: HTMLElement;
  host: HTMLElement;
  rotor: HTMLElement;
  finish: Finish;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  visible: boolean;
  pointer: [number, number] | null;
  light: [number, number];
  tilt: [number, number];
  velocity: [number, number];
  phase: number;
};
const W = 320, H = 447;
const vertex = `#version 300 es
in vec2 position;
void main(){gl_Position=vec4(position,0.0,1.0);}`;
const presets = { gold: 7, shards: 2, cosmos: 3 };
const clients = new Set<FinishClient>();
let atlas: HTMLCanvasElement | undefined, gl: WebGL2RenderingContext | null;
let program: WebGLProgram | null, buffer: WebGLBuffer | null;
let lossExtension: WEBGL_lose_context | null = null;
let uniforms: Record<string, WebGLUniformLocation | null> = {};
let frame = 0, last = 0, drift = true, intensity = .56, enabled = true, lost = false;
let frames = 0, draws = 0, errors: string[] = [], cpuMs = 0;
const media = () => window.matchMedia('(prefers-reduced-motion: reduce)');
let motion: MediaQueryList | undefined;

function compile(type: number, source: string) {
  const shader = gl!.createShader(type)!;
  gl!.shaderSource(shader, source); gl!.compileShader(shader);
  if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) {
    const reason = gl!.getShaderInfoLog(shader) ?? 'Shader compile failed';
    gl!.deleteShader(shader); throw new Error(reason);
  }
  return shader;
}
function resources() {
  const v = compile(gl!.VERTEX_SHADER, vertex), f = compile(gl!.FRAGMENT_SHADER, fragment);
  program = gl!.createProgram()!;
  gl!.attachShader(program, v); gl!.attachShader(program, f);
  gl!.bindAttribLocation(program, 0, 'position'); gl!.linkProgram(program);
  gl!.deleteShader(v); gl!.deleteShader(f);
  if (!gl!.getProgramParameter(program, gl!.LINK_STATUS)) throw new Error(gl!.getProgramInfoLog(program) ?? 'Shader link failed');
  buffer = gl!.createBuffer(); gl!.bindBuffer(gl!.ARRAY_BUFFER, buffer);
  gl!.bufferData(gl!.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl!.STATIC_DRAW);
  gl!.enableVertexAttribArray(0); gl!.vertexAttribPointer(0,2,gl!.FLOAT,false,0,0);
  for (const name of ['uOrigin','uSize','uAspect','uTilt','uLight','uPreset','uIntensity','uScale','uEdge','uFoil']) uniforms[name] = gl!.getUniformLocation(program,name);
}
function fallback(reason?: unknown) {
  if (reason) errors.push(String(reason));
  cancelAnimationFrame(frame); frame=0;
  for (const client of clients) { client.host.dataset.renderer='css'; client.rotor.style.transform='none'; }
}
function onLost(event: Event) { event.preventDefault(); lost=true; fallback(); }
function onRestored() {
  try { resources(); lost=false; wake(); } catch(error) { fallback(error); }
}
function initialize() {
  if (atlas) return;
  atlas=document.createElement('canvas'); atlas.width=W*3; atlas.height=H;
  atlas.dataset.holoAtlas='true';
  gl=atlas.getContext('webgl2',{alpha:true,premultipliedAlpha:true,antialias:false,preserveDrawingBuffer:true,powerPreference:'low-power'});
  if (!gl) return;
  lossExtension=gl.getExtension('WEBGL_lose_context');
  atlas.addEventListener('webglcontextlost',onLost); atlas.addEventListener('webglcontextrestored',onRestored);
  try { resources(); } catch(error) { fallback(error); gl=null; }
  motion=media(); motion.addEventListener('change',sync);
  document.addEventListener('visibilitychange',sync);
}
function sync() {
  if(document.hidden || motion?.matches || !enabled) fallback(); else wake();
}
function spring(value:number,velocity:number,target:number,dt:number):[number,number] {
  const v=velocity+((target-value)*150-velocity*16)*dt;
  return [value+v*dt,v];
}
function draw(client:FinishClient,index:number,dt:number,time:number) {
  const idle=drift && !client.pointer;
  const x=client.pointer?.[0] ?? (idle?.5+Math.sin(time*.42+client.phase)*.37:.48);
  const y=client.pointer?.[1] ?? (idle?.4+Math.sin(time*.31+client.phase)*.28:.36);
  const targetX=(.5-y)*10, targetY=(x-.5)*12;
  const steps=Math.max(1,Math.ceil(dt/(1/240)));
  for(let i=0;i<steps;i++) {
    [client.tilt[0],client.velocity[0]]=spring(client.tilt[0],client.velocity[0],targetX,dt/steps);
    [client.tilt[1],client.velocity[1]]=spring(client.tilt[1],client.velocity[1],targetY,dt/steps);
  }
  const ease=1-Math.exp(-12*dt);
  client.light[0]+=(x-client.light[0])*ease; client.light[1]+=(y-client.light[1])*ease;
  client.rotor.style.transform=`perspective(1100px) rotateX(${client.tilt[0]}deg) rotateY(${client.tilt[1]}deg)`;
  client.rotor.style.setProperty('--prism-light-x',`${client.light[0]*100}%`);
  client.rotor.style.setProperty('--prism-light-y',`${client.light[1]*100}%`);
  if(client.finish==='gold'){client.rotor.style.setProperty('--gold-light-x',`${client.light[0]*100}%`);client.rotor.style.setProperty('--gold-light-y',`${client.light[1]*100}%`);}
  if(client.finish==='cosmos'){client.rotor.style.setProperty('--astral-light-x',`${client.light[0]*100}%`);client.rotor.style.setProperty('--astral-light-y',`${client.light[1]*100}%`);}
  const offset=index*W;
  gl!.viewport(offset,0,W,H); gl!.scissor(offset,0,W,H);
  gl!.useProgram(program);
  gl!.uniform2f(uniforms.uOrigin,offset,0); gl!.uniform2f(uniforms.uSize,W,H);
  gl!.uniform1f(uniforms.uAspect,H/W); gl!.uniform2f(uniforms.uTilt,client.tilt[0]*Math.PI/180,client.tilt[1]*Math.PI/180);
  gl!.uniform2f(uniforms.uLight,...client.light); gl!.uniform1i(uniforms.uPreset,presets[client.finish]);
  gl!.uniform1f(uniforms.uIntensity,intensity); gl!.uniform1f(uniforms.uScale,client.finish==='gold'?1.2:.85);
  gl!.uniform1f(uniforms.uEdge,.3); gl!.uniform3f(uniforms.uFoil,1,.8,.5);
  gl!.drawArrays(gl!.TRIANGLES,0,3); draws++;
}
function tick(now:number) {
  frame=0;
  if(!enabled || document.hidden || motion?.matches) { fallback(); return; }
  if (!gl || !program || lost) return;
  if(last && now-last<1000/30-1) { frame=requestAnimationFrame(tick); return; }
  const start=performance.now(), dt=Math.min(1/30,(now-(last||now-16))/1000); last=now;
  const visible=[...clients].filter(c=>c.visible&&c.host.isConnected);
  gl.enable(gl.SCISSOR_TEST); gl.scissor(0,0,atlas!.width,atlas!.height);
  gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
  visible.forEach((client,i)=>draw(client,i,dt,now/1000));
  for(const [index,client] of visible.entries()) {
    const dpr=Math.min(devicePixelRatio,1.5);
    const width=Math.max(1,Math.min(480,Math.round(client.host.clientWidth*dpr)));
    const height=Math.max(1,Math.round(width*H/W));
    if(client.canvas.width!==width)client.canvas.width=width;
    if(client.canvas.height!==height)client.canvas.height=height;
    client.context.clearRect(0,0,width,height);
    client.context.drawImage(atlas!,index*W,0,W,H,0,0,width,height);
    client.host.dataset.renderer='webgl';
  }
  frames++; cpuMs+=performance.now()-start;
  const moving=visible.some(c=>c.pointer || Math.abs(c.velocity[0])+Math.abs(c.velocity[1])>.01);
  if(visible.length&&(drift||moving))frame=requestAnimationFrame(tick);
}
function wake() {
  if(!frame&&gl&&!lost&&enabled&&!document.hidden&&!motion?.matches)frame=requestAnimationFrame(tick);
}
const observer = new Map<HTMLElement,FinishClient>();
let visibility: IntersectionObserver | undefined;
export function mountFinish(target:HTMLElement,host:HTMLElement,rotor:HTMLElement,finish:Finish) {
  initialize();
  host.dataset.renderer='css';
  const canvas=document.createElement('canvas'), context=canvas.getContext('2d');
  if(!context)return ()=>{};
  canvas.className='holo-finish-canvas'; canvas.setAttribute('aria-hidden','true'); host.append(canvas);
  const client:FinishClient={target,host,rotor,finish,canvas,context,visible:true,pointer:null,light:[.48,.36],tilt:[0,0],velocity:[0,0],phase:clients.size*1.1};
  clients.add(client); observer.set(target,client);
  visibility??=new IntersectionObserver(entries=>{for(const entry of entries){const c=observer.get(entry.target as HTMLElement);if(c)c.visible=entry.isIntersecting;}wake();});
  visibility.observe(target);
  const resize=new ResizeObserver(wake);resize.observe(target);
  const move=(event:PointerEvent)=>{
    if(event.pointerType==='touch'&&event.type==='pointermove'&&!event.buttons)return;
    const box=target.getBoundingClientRect();
    client.pointer=[Math.max(0,Math.min(1,(event.clientX-box.x)/box.width)),Math.max(0,Math.min(1,(event.clientY-box.y)/box.height))];wake();
  };
  const leave=()=>{client.pointer=null;wake();};
  const key=(event:KeyboardEvent)=>{
    const shifts:Record<string,[number,number]>={ArrowLeft:[-.12,0],ArrowRight:[.12,0],ArrowUp:[0,-.12],ArrowDown:[0,.12]};
    const shift=shifts[event.key];if(!shift)return;
    event.preventDefault();const p=client.pointer??[.48,.36];client.pointer=[Math.max(.05,Math.min(.95,p[0]+shift[0])),Math.max(.05,Math.min(.95,p[1]+shift[1]))];wake();
  };
  target.addEventListener('pointermove',move);target.addEventListener('pointerdown',move);
  target.addEventListener('pointerleave',leave);target.addEventListener('pointercancel',leave);target.addEventListener('pointerup',leave);
  target.addEventListener('keydown',key);target.addEventListener('blur',leave,true);
  wake();
  return ()=>{
    clients.delete(client);observer.delete(target);visibility?.unobserve(target);resize.disconnect();canvas.remove();rotor.style.transform='none';
    target.removeEventListener('pointermove',move);target.removeEventListener('pointerdown',move);target.removeEventListener('pointerleave',leave);
    target.removeEventListener('pointercancel',leave);target.removeEventListener('pointerup',leave);target.removeEventListener('keydown',key);target.removeEventListener('blur',leave,true);
    if(!clients.size){
      fallback();visibility?.disconnect();visibility=undefined;
      motion?.removeEventListener('change',sync);document.removeEventListener('visibilitychange',sync);
      atlas?.removeEventListener('webglcontextlost',onLost);atlas?.removeEventListener('webglcontextrestored',onRestored);
      if(!lost){gl?.deleteProgram(program);gl?.deleteBuffer(buffer);}gl?.getExtension('WEBGL_lose_context')?.loseContext();
      atlas=undefined;gl=null;program=null;buffer=null;uniforms={};lossExtension=null;lost=false;last=0;
    }
  };
}
export function setFinishOptions(options:{drift:boolean;intensity:number;enabled:boolean}) {
  drift=options.drift;intensity=options.intensity;enabled=options.enabled;sync();
}
export function rendererSnapshot() {
  return {contexts:gl?1:0,clients:clients.size,visible:[...clients].filter(c=>c.visible).length,frames,draws,running:!!frame,hidden:document.hidden,reduced:motion?.matches??false,enabled,lost,errors:[...errors],meanCpuMs:frames?cpuMs/frames:0};
}
export function losePreviewContext() { lossExtension?.loseContext(); }
export function restorePreviewContext() { lossExtension?.restoreContext(); }
