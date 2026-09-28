// Shared by the application and the standalone scene documents. The probe is
// deliberately cheap: never allocate a second WebGL context just to benchmark.
export const GPU_TIERS = Object.freeze({
  static: Object.freeze({tier:'static',pixelRatio:1,shadows:false,outlines:false,particleDensity:0,fps:0}),
  low: Object.freeze({tier:'low',pixelRatio:1,shadows:false,outlines:false,particleDensity:.2,fps:24}),
  medium: Object.freeze({tier:'medium',pixelRatio:1.4,shadows:true,outlines:false,particleDensity:.5,fps:30}),
  high: Object.freeze({tier:'high',pixelRatio:2,shadows:true,outlines:true,particleDensity:1,fps:60}),
});
const key='squabblemon-gpu-tier-v2';
const valid=value=>value==='low'||value==='medium'||value==='high';
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches ||
  document.documentElement.dataset.reduceMotion==='true' ||
  document.documentElement.dataset.reducedMotion==='true';
let cached;

export function forcedGPUTier() {
  // Explicit developer/test opt-in, never silently read a player's query string.
  const forced=new URLSearchParams(location.search).get('gpuTier');
  return valid(forced)||forced==='static' ? forced : null;
}

export function gpuQuality(tier) {
  if (reduced()) return GPU_TIERS.static;
  const forced=forcedGPUTier();
  return GPU_TIERS[forced || (GPU_TIERS[tier]?tier:null) || cached || 'medium'];
}

export async function detectGPUQuality() {
  const forced=forcedGPUTier();
  if (forced) return gpuQuality(forced);
  if (cached) return gpuQuality(cached);
  try { const stored=sessionStorage.getItem(key); if(valid(stored)) cached=stored; } catch {}
  if (cached) return gpuQuality(cached);
  const nav=navigator;
  let score=0;
  if (nav.deviceMemory !== undefined) score+=nav.deviceMemory<=2?-2:nav.deviceMemory>=8?1:0;
  if (nav.hardwareConcurrency !== undefined) score+=nav.hardwareConcurrency<=4?-1:nav.hardwareConcurrency>=8?1:0;
  if (nav.connection?.saveData) score-=2;
  // iPadOS Safari reports as MacIntel and hides deviceMemory; it starts at high
  // quality and relies on the runtime frame guard to step down if frames drop.
  const iPad=/iPad/.test(nav.userAgent) || (nav.platform==='MacIntel' && nav.maxTouchPoints>1);
  if (iPad) score+=2;
  // A short main-thread probe, bounded to 12 ms, measures JS throughput without
  // taking a WebGL context away from a scene on context-limited phones.
  const start=performance.now();let samples=0,acc=1;
  while(samples<180000 && performance.now()-start<12){acc=(acc*1664525+1013904223)>>>0;samples++;}
  if(samples<50000) score--;
  if(samples>=180000) score++;
  // Query a temporary context before any scene mounts, then release it so the
  // real renderer is not competing for scarce context slots on mobile Safari.
  let gl;
  try {
    gl=document.createElement('canvas').getContext('webgl2',{powerPreference:'low-power'});
    if(!gl) { cached='static'; return GPU_TIERS.static; }
    if(gl.getParameter(gl.MAX_TEXTURE_SIZE)<4096 || gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)<4096)score-=2;
    const debug=gl.getExtension('WEBGL_debug_renderer_info');
    if(debug && /swiftshader|llvmpipe|software/i.test(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)))score-=2;
  } catch { cached='static'; return GPU_TIERS.static; }
  finally { gl?.getExtension('WEBGL_lose_context')?.loseContext(); }
  cached=score<=-1?'low':score>=3?'high':'medium';
  try { sessionStorage.setItem(key,cached); } catch {}
  return gpuQuality(cached);
}

// Runtime step-down: called only after measured frame drops while live effects run.
export function downgradeGPUQuality() {
  if (forcedGPUTier()) return null;
  const next = cached==='high' ? 'medium' : cached==='medium' ? 'low' : null;
  if (!next) return null;
  cached=next;
  try { sessionStorage.setItem(key,cached); } catch {}
  return gpuQuality(cached);
}
