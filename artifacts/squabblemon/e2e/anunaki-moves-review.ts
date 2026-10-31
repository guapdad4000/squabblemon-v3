import { createChromaRenderer } from '../src/lib/chromaRenderer';
import { getMoveClipUrl, keyChromaPixels, resolveSpecialMove, ANUNAKI_CHROMA_KEY } from '../src/specialMoves';
const names=['yakub','utu','enlil','nabu','anu','ninhursag','ereshkigal','inanna','caucus-mountaineer','enki'];
const video=document.querySelector<HTMLVideoElement>('#source')!;
const select=document.querySelector<HTMLSelectElement>('#character')!;
const seek=document.querySelector<HTMLInputElement>('#seek')!;
const gpu=document.querySelector<HTMLCanvasElement>('#gpu')!;
const cpu=document.querySelector<HTMLCanvasElement>('#cpu')!;
gpu.width=cpu.width=288;gpu.height=cpu.height=512;
let clip: ReturnType<typeof resolveSpecialMove>;
const key=(pixels:Uint8ClampedArray)=>keyChromaPixels(pixels,'green',clip?.keyProfile);
const g=createChromaRenderer(gpu,'move-green',key,true,ANUNAKI_CHROMA_KEY)!;
const c=createChromaRenderer(cpu,'move-green',key,false,ANUNAKI_CHROMA_KEY)!;
const status=document.querySelector<HTMLElement>('#status')!;
names.forEach(n=>select.add(new Option(n,n)));
function draw(){if(video.readyState<2||video.seeking)return;g.draw(video);c.draw(video);seek.value=String(video.currentTime);document.querySelector<HTMLElement>('#time')!.textContent=`${video.currentTime.toFixed(2)} / ${video.duration.toFixed(2)}s`;status.textContent=`Renderer: ${g.kind} / CPU`;}
function load(){clip=resolveSpecialMove(select.value)!;video.pause();video.src=getMoveClipUrl(clip,'battle');video.load();}
select.onchange=load;video.onloadeddata=()=>{seek.max=String(video.duration);draw()};video.onseeked=draw;
document.querySelector<HTMLButtonElement>('#play')!.onclick=()=>{if(video.paused)void video.play();else video.pause()};seek.oninput=()=>{video.currentTime=Number(seek.value)};
function tick(){draw();requestAnimationFrame(tick)}
load();tick();
