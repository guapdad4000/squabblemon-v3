import { createChromaRenderer } from '../src/lib/chromaRenderer';
import { getMoveClipUrl, keyChromaPixels, resolveSpecialMove } from '../src/specialMoves';
import auditUrl from '../../deliverables/openart-specials/review/technical-audit.json?url';

type Clip = { catalogId:string; name:string; move:string; file:string; generationId:string; width:number; height:number; duration:number; bytes:number; flags:string[]; meanVolumeDb:number; peakVolumeDb:number };
const get = <T extends HTMLElement>(id:string) => document.getElementById(id) as T;
const video=get<HTMLVideoElement>('source'), select=get<HTMLSelectElement>('character'), seek=get<HTMLInputElement>('seek');
const gpu=get<HTMLCanvasElement>('gpu'), cpu=get<HTMLCanvasElement>('cpu');
const key=(pixels:Uint8ClampedArray)=>keyChromaPixels(pixels,'cyan');
const renderGpu=createChromaRenderer(gpu,'move-cyan',key,true), renderCpu=createChromaRenderer(cpu,'move-cyan',key,false);
if(!renderGpu || !renderCpu) throw new Error('Could not initialize the game renderer');
get('gpuKind').textContent=renderGpu.kind==='gpu'?'':'(CPU fallback)';
const storageKey='squabblemon.openart-specials-review.v1';
let saved:Record<string,{decision:string;notes:string}>={};
try{saved=JSON.parse(localStorage.getItem(storageKey)||'{}')}catch{}
let clips:Clip[]=[], current:Clip, frame=0, findings:Record<string,{tags:string[];notes:string}>={};
function draw(){
  if(video.readyState<2 || video.seeking)return;
  try{
    renderGpu!.draw(video);renderCpu!.draw(video);
    get('status').textContent=`${renderGpu!.kind.toUpperCase()} + CPU rendered the same video frame`;
    seek.value=String(video.currentTime);get('time').textContent=`${video.currentTime.toFixed(2)} / ${video.duration.toFixed(2)}s`;
  }catch(e){get('error').textContent=String(e)}
}
function tick(){draw();frame=requestAnimationFrame(tick)}
function load(index:number){
  index=(index+clips.length)%clips.length;select.selectedIndex=index;current=clips[index];
  const installed=resolveSpecialMove(current.catalogId);
  video.pause();video.src=installed?getMoveClipUrl(installed):'/@fs'+current.file;video.load();get('play').textContent='Play';get('status').textContent='Loading…';get('error').textContent='';
  get<HTMLImageElement>('reference').src=`/assets/characters/${current.catalogId}.webp`;
  get('title').textContent=`${current.name} · ${current.move}`;
  get('meta').textContent=`${current.width} × ${current.height} · ${current.duration.toFixed(3)}s · ${(current.bytes/1e6).toFixed(1)} MB · audio mean ${current.meanVolumeDb} dB / peak ${current.peakVolumeDb} dB`;
  get('flags').textContent=current.flags.length?current.flags.join(' • '):'File checks passed. Creative approval still requires playback review.';
  const finding=findings[current.catalogId];get('finding').textContent=finding?`Sampled-frame review: ${finding.notes}`:'';
  const entry=saved[current.generationId];get<HTMLSelectElement>('decision').value=entry?.decision||'pending';get<HTMLTextAreaElement>('notes').value=entry?.notes||'';
  history.replaceState(null,'',`?character=${encodeURIComponent(current.catalogId)}`);
}
function save(){saved[current.generationId]={decision:get<HTMLSelectElement>('decision').value,notes:get<HTMLTextAreaElement>('notes').value};localStorage.setItem(storageKey,JSON.stringify(saved))}
video.addEventListener('loadeddata',()=>{gpu.width=cpu.width=288;gpu.height=cpu.height=Math.round(288*video.videoHeight/video.videoWidth);seek.max=String(video.duration);draw()});
video.addEventListener('seeked',draw);video.addEventListener('error',()=>{get('error').textContent=`Video failed to load: ${current?.catalogId}`});
video.addEventListener('ended',()=>{get('play').textContent='Play'});
get('play').onclick=async()=>{try{if(video.paused){await video.play();get('play').textContent='Pause'}else{video.pause();get('play').textContent='Play'}}catch(e){get('error').textContent=String(e)}};
get('restart').onclick=()=>{video.currentTime=0;draw()};
for(const [id,delta] of [['back',-.25],['forward',.25]] as const)get(id).onclick=()=>{video.pause();get('play').textContent='Play';video.currentTime=Math.max(0,Math.min(video.duration-.01,video.currentTime+delta))};
seek.oninput=()=>{video.currentTime=Number(seek.value)};
get<HTMLInputElement>('sound').onchange=e=>{video.muted=!(e.target as HTMLInputElement).checked};
get<HTMLSelectElement>('speed').onchange=e=>{video.playbackRate=Number((e.target as HTMLSelectElement).value)};
get<HTMLSelectElement>('backdrop').onchange=e=>{document.body.dataset.bg=(e.target as HTMLSelectElement).value};
get('previous').onclick=()=>load(select.selectedIndex-1);get('next').onclick=()=>load(select.selectedIndex+1);select.onchange=()=>load(select.selectedIndex);
get('notes').oninput=save;get('decision').onchange=save;
get('export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({exportedAt:new Date().toISOString(),reviews:saved},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='specials-review-notes.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);video.pause();renderGpu.dispose();renderCpu.dispose()});
try{
  const audit=await(await fetch(auditUrl)).json();clips=audit.clips;
  try{const url=new URL(auditUrl,location.href);url.pathname=url.pathname.replace(/technical-audit\.json$/,'visual-findings.json');const r=await fetch(url);if(r.ok)findings=await r.json()}catch{}
  select.replaceChildren(...clips.map(c=>new Option(c.name,c.catalogId)));
  get('summary').textContent=`${clips.length} completed renders · compare originals with game compositing · no automatic acceptance`;
  const requested=new URLSearchParams(location.search).get('character');load(Math.max(0,clips.findIndex(c=>c.catalogId===requested)));tick();
}catch(e){get('error').textContent=String(e)}
